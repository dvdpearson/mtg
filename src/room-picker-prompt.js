import chalk from 'chalk';
import figures from 'figures';
import cliCursor from 'cli-cursor';
import { fromEvent } from 'rxjs';
import { filter, map, share, takeUntil } from 'rxjs/operators';
import Base from 'inquirer/lib/prompts/base.js';
import observe from 'inquirer/lib/utils/events.js';
import Paginator from 'inquirer/lib/utils/paginator.js';

class RoomPickerPrompt extends Base {
  constructor(questions, rl, answers) {
    super(questions, rl, answers);

    if (!this.opt.choices) {
      this.throwParamError('choices');
    }

    this.pointer = 0;
    this.selected = new Set();
    this.markedForDecline = new Set();
    this.roomSelections = new Map();
    this.showHelp = false;
    this.showAll = true;

    // Filter out separators for navigation
    this.selectableChoices = this.opt.choices.filter(
      (choice) => choice.type !== 'separator'
    );

    // Restore previous selections if provided
    const initial = this.opt.initialState;
    if (initial) {
      if (initial.selections) {
        initial.selections.forEach(({ meetingIndex, room }) => {
          const idx = this.selectableChoices.findIndex(c => c.meetingIndex === meetingIndex);
          if (idx >= 0) {
            this.selected.add(idx);
            // Find the room index in the choice's rooms array
            const choice = this.selectableChoices[idx];
            if (choice.rooms && room) {
              const roomIdx = choice.rooms.findIndex(r => r.email === room.email);
              if (roomIdx >= 0) this.roomSelections.set(idx, roomIdx);
            }
          }
        });
      }
      if (initial.declined) {
        initial.declined.forEach((meetingIndex) => {
          const idx = this.selectableChoices.findIndex(c => c.meetingIndex === meetingIndex);
          if (idx >= 0) this.markedForDecline.add(idx);
        });
      }
    }

    // Precompute day group boundaries: indices into selectableChoices that start each day
    this.dayStarts = [];
    this.todayDayIndex = -1;
    let selectableIndex = 0;
    for (const choice of this.opt.choices) {
      if (choice.type === 'separator' && choice.line) {
        this.dayStarts.push(selectableIndex);
        if (choice.line.startsWith('Today')) {
          this.todayDayIndex = this.dayStarts.length - 1;
        }
      } else if (choice.type !== 'separator') {
        selectableIndex++;
      }
    }
    // If no "Today" group, fall back to the first day (nearest future)
    if (this.todayDayIndex < 0 && this.dayStarts.length > 0) {
      this.todayDayIndex = 0;
    }

    // Initialize paginator
    this.paginator = new Paginator(this.screen);
  }

  isVisible(index) {
    if (this.showAll) return true;
    if (this.markedForDecline.has(index)) return true;
    return !this.selectableChoices[index].hasRoom;
  }

  nextVisible(from, direction) {
    const len = this.selectableChoices.length;
    let idx = from;
    for (let i = 0; i < len; i++) {
      idx = direction > 0
        ? (idx < len - 1 ? idx + 1 : 0)
        : (idx > 0 ? idx - 1 : len - 1);
      if (this.isVisible(idx)) return idx;
    }
    return from;
  }

  ensureVisiblePointer() {
    if (!this.isVisible(this.pointer)) {
      this.pointer = this.nextVisible(this.pointer, 1);
    }
  }

  _run(cb) {
    this.done = cb;

    const events = observe(this.rl);
    const validation = this.handleSubmitEvents(
      events.line.pipe(map(() => this.getSelectedValues()))
    );

    validation.success.subscribe(this.onEnd.bind(this));
    validation.error.subscribe(this.onError.bind(this));

    events.keypress
      .pipe(takeUntil(validation.success))
      .subscribe(this.onKeypress.bind(this));

    cliCursor.hide();
    this.render();

    return this;
  }

  onKeypress(e) {
    const len = this.selectableChoices.length;
    const key = e.key;

    if (key.name === 'q' || key.name === 'escape') {
      this.status = 'answered';
      this.render();
      this.screen.done();
      cliCursor.show();
      const hasChanges = this.selected.size > 0 || this.markedForDecline.size > 0;
      if (hasChanges) {
        const current = this.getSelectedValues();
        this.done({ ...current, quit: true });
      } else {
        this.done({ selections: [], declined: [], quit: true });
      }
    } else if (key.name === 'up' || key.name === 'k') {
      this.pointer = this.nextVisible(this.pointer, -1);
      this.render();
    } else if (key.name === 'down' || key.name === 'j') {
      this.pointer = this.nextVisible(this.pointer, 1);
      this.render();
    } else if (key.name === 'space') {
      const choiceIndex = this.pointer;
      const choice = this.selectableChoices[choiceIndex];
      // Only allow room selection for meetings without rooms
      if (!choice.hasRoom) {
        if (this.selected.has(choiceIndex)) {
          this.selected.delete(choiceIndex);
        } else {
          this.selected.add(choiceIndex);
          this.markedForDecline.delete(choiceIndex);
        }
      }
      this.render();
    } else if (e.value === 'd' || e.value === 'D') {
      const choiceIndex = this.pointer;
      const choice = this.selectableChoices[choiceIndex];
      if (choice.canDecline) {
        if (this.markedForDecline.has(choiceIndex)) {
          this.markedForDecline.delete(choiceIndex);
        } else {
          this.markedForDecline.add(choiceIndex);
          this.selected.delete(choiceIndex);
        }
        this.render();
      }
    } else if (key.name === 'left') {
      const choice = this.selectableChoices[this.pointer];
      if (!choice.hasRoom && !this.markedForDecline.has(this.pointer) && choice.rooms && choice.rooms.length > 1) {
        const current = this.roomSelections.get(this.pointer) || 0;
        const newIndex = current > 0 ? current - 1 : choice.rooms.length - 1;
        this.roomSelections.set(this.pointer, newIndex);
        this.render();
      }
    } else if (key.name === 'right') {
      const choice = this.selectableChoices[this.pointer];
      if (!choice.hasRoom && !this.markedForDecline.has(this.pointer) && choice.rooms && choice.rooms.length > 1) {
        const current = this.roomSelections.get(this.pointer) || 0;
        const newIndex = current < choice.rooms.length - 1 ? current + 1 : 0;
        this.roomSelections.set(this.pointer, newIndex);
        this.render();
      }
    } else if (e.value === ']') {
      // Jump to next day group
      const nextDay = this.dayStarts.find(start => start > this.pointer && this.isVisible(start));
      if (nextDay !== undefined) {
        this.pointer = nextDay;
        this.ensureVisiblePointer();
        this.render();
      }
    } else if (e.value === '[') {
      // Jump to previous day group
      const prevDays = this.dayStarts.filter(start => start < this.pointer && this.isVisible(start));
      if (prevDays.length > 0) {
        this.pointer = prevDays[prevDays.length - 1];
        this.ensureVisiblePointer();
        this.render();
      }
    } else if (e.value === 't' || e.value === 'T') {
      // Jump to today
      if (this.todayDayIndex >= 0) {
        this.pointer = this.dayStarts[this.todayDayIndex];
        this.ensureVisiblePointer();
        this.render();
      }
    } else if (e.value === '?') {
      this.showHelp = !this.showHelp;
      this.render();
    } else if (e.value === 'a' || e.value === 'A') {
      this.showAll = !this.showAll;
      this.ensureVisiblePointer();
      this.render();
    }
  }

  getSelectedValues() {
    const selections = Array.from(this.selected).map((index) => {
      const choice = this.selectableChoices[index];
      const roomIndex = this.roomSelections.get(index) || 0;
      return {
        meetingIndex: choice.meetingIndex,
        room: choice.rooms[roomIndex]
      };
    });

    const declined = Array.from(this.markedForDecline).map((index) => {
      return this.selectableChoices[index].meetingIndex;
    });

    return { selections, declined };
  }

  onEnd(state) {
    this.status = 'answered';
    this.render();
    this.screen.done();
    cliCursor.show();
    this.done(state.value);
  }

  onError(state) {
    this.render(state.isValid);
  }

  render(error) {
    let message = this.getQuestion();
    let bottomContent = '';

    const cols = process.stdout.columns || 80;
    message += '\n' + chalk.dim('─'.repeat(cols));

    let choiceIndex = 0;
    let allChoicesOutput = '';
    let realIndexPosition = 0;

    // Pre-scan to determine which separators have visible choices after them
    const visibleSeparators = new Set();
    let lastSepIndex = -1;
    let scanIndex = 0;
    this.opt.choices.forEach((choice, index) => {
      if (choice.type === 'separator') {
        lastSepIndex = index;
      } else {
        if (this.isVisible(scanIndex)) {
          if (lastSepIndex >= 0) visibleSeparators.add(lastSepIndex);
        }
        scanIndex++;
      }
    });

    this.opt.choices.forEach((choice, index) => {
      if (choice.type === 'separator') {
        if (!this.showAll && !visibleSeparators.has(index)) return;
        const label = choice.line || '';
        allChoicesOutput += '\n  ' + chalk.underline.bold(label) + '\n';
        return;
      }

      if (!this.isVisible(choiceIndex)) {
        choiceIndex++;
        return;
      }

      const isSelected = this.selected.has(choiceIndex);
      const isDeclined = this.markedForDecline.has(choiceIndex);
      const isCursor = choiceIndex === this.pointer;
      const roomIndex = this.roomSelections.get(choiceIndex) || 0;

      // Track the actual line position for the cursor
      if (isCursor) {
        realIndexPosition = allChoicesOutput.split('\n').length;
      }

      let line;

      if (choice.hasRoom) {
        // Meeting with existing room
        let checkbox = isDeclined ? chalk.green(figures.radioOn) : figures.radioOff;
        line = `${checkbox} ${choice.name} ${chalk.gray(`(${choice.time})`)}`;
        line += ` ${chalk.dim(`✓ ${choice.existingRoom}`)}`;
        if (isDeclined) {
          line += ` ${chalk.red.bold('DECLINE')}`;
        }
      } else {
        // Meeting needing a room
        let checkbox = (isSelected || isDeclined) ? chalk.green(figures.radioOn) : figures.radioOff;
        line = `${checkbox} ${choice.name} ${chalk.gray(`(${choice.time})`)}`;

        if (choice.rooms && choice.rooms.length > 0) {
          const room = choice.rooms[roomIndex];
          const arrow = isSelected ? chalk.green('→') : chalk.gray('→');
          const roomName = isSelected ? chalk.green(room.name) : room.name;
          const roomLabel = choice.rooms.length > 1
            ? `${arrow} ${roomName} ${chalk.gray(`[${room.capacity}]`)} ${chalk.dim(`(${roomIndex + 1}/${choice.rooms.length})`)}`
            : `${arrow} ${roomName} ${chalk.gray(`[${room.capacity}]`)}`;
          line += ` ${roomLabel}`;
        }

        if (isDeclined) {
          line += ` ${chalk.red.bold('DECLINE')}`;
        }
      }

      if (isCursor) {
        allChoicesOutput += chalk.cyan(`${figures.pointer}${figures.pointer} ${line}\n`);
      } else {
        allChoicesOutput += `   ${line}\n`;
      }

      choiceIndex++;
    });

    if (error) {
      bottomContent = chalk.red('>> ') + error;
    } else {
      const footerSeparator = chalk.dim('─'.repeat(cols));

      // Build context-aware help text
      const choice = this.selectableChoices[this.pointer];
      const isDeclined = this.markedForDecline.has(this.pointer);
      const canSelect = choice && !choice.hasRoom;
      const canDecline = choice && choice.canDecline;
      const canCycleRoom = choice && !choice.hasRoom && !isDeclined && choice.rooms && choice.rooms.length > 1;
      const hi = (text) => chalk.white.bold(text);
      const lo = (text) => chalk.dim(text);

      const hasNextDay = this.dayStarts.some(start => start > this.pointer);
      const hasPrevDay = this.dayStarts.some(start => start < this.pointer);
      const hasToday = this.todayDayIndex >= 0;

      const meetingInfo = choice
        ? chalk.cyan('Organizer: ') + chalk.white(choice.organizer || 'Unknown') +
          chalk.cyan('  Guests: ') + chalk.white(String(choice.guestCount || 0))
        : '';

      let helpText;
      if (this.showHelp) {
        // Build 3-column shortcut grid like Claude Code
        const colWidth = Math.floor(cols / 3);
        const pad = (str, visible) => {
          const padding = Math.max(0, colWidth - visible.length);
          return str + ' '.repeat(padding);
        };
        const entry = (active, key, desc) => {
          const text = `${key} ${desc}`;
          return active ? lo(key + ' ') + chalk.white(desc) : lo(text);
        };

        const selectLabel = this.selected.has(this.pointer) ? 'unselect' : 'select';
        const declineLabel = isDeclined ? 'cancel decline' : 'decline';

        // Column layout: [col1, col2, col3] per row
        const filterLabel = this.showAll ? 'needs room only' : 'show all';

        const rows = [
          [
            entry(canSelect, 'space', 'to ' + selectLabel),
            entry(true, '↑↓', 'to move'),
            entry(hasNextDay, ']', 'next day'),
          ],
          [
            entry(canDecline, 'd', 'to ' + declineLabel),
            entry(canCycleRoom, '←→', 'to change room'),
            entry(hasPrevDay, '[', 'prev day'),
          ],
          [
            entry(true, 'enter', 'to submit'),
            entry(hasToday, 't', 'to jump to today'),
            entry(true, 'a', filterLabel),
          ],
          [
            entry(true, 'q/esc', 'to quit'),
            entry(true, '?', 'to hide help'),
            '',
          ],
        ];

        const grid = rows.map(row => {
          const filledCells = row.filter(cell => cell);
          if (filledCells.length === 0) return null;
          const cells = filledCells.map((cell, i) => {
            if (i === filledCells.length - 1) return cell;
            const visible = cell.replace(/\x1b\[[0-9;]*m/g, '');
            const padding = Math.max(0, colWidth - visible.length);
            return cell + ' '.repeat(padding);
          });
          return '  ' + cells.join('');
        }).filter(Boolean).join('\n');

        helpText = meetingInfo + '\n\n' + grid;
      } else {
        helpText = meetingInfo + '\n' + chalk.dim('(? for help)');
      }

      bottomContent = this.paginator.paginate(allChoicesOutput, realIndexPosition, this.opt.pageSize);
      const hintText = '(Move up and down to reveal more choices)';
      bottomContent = bottomContent.replace(hintText, '');
      bottomContent += '\n' + footerSeparator + '\n' + helpText;
    }

    this.screen.render(message, bottomContent);
  }
}

export default RoomPickerPrompt;
