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

    // Filter out separators for navigation
    this.selectableChoices = this.opt.choices.filter(
      (choice) => choice.type !== 'separator'
    );

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

    // Initialize paginator
    this.paginator = new Paginator(this.screen);
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
      this.done({ selections: [], declined: [] });
    } else if (key.name === 'up' || key.name === 'k') {
      this.pointer = this.pointer > 0 ? this.pointer - 1 : len - 1;
      this.render();
    } else if (key.name === 'down' || key.name === 'j') {
      this.pointer = this.pointer < len - 1 ? this.pointer + 1 : 0;
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
      const nextDay = this.dayStarts.find(start => start > this.pointer);
      if (nextDay !== undefined) {
        this.pointer = nextDay;
        this.render();
      }
    } else if (e.value === '[') {
      // Jump to previous day group
      const prevDays = this.dayStarts.filter(start => start < this.pointer);
      if (prevDays.length > 0) {
        // If pointer is already at a day start, go to the one before it
        const currentDayStart = this.dayStarts.find(start => start === this.pointer);
        if (currentDayStart !== undefined && prevDays.length > 0) {
          this.pointer = prevDays[prevDays.length - 1];
        } else {
          this.pointer = prevDays[prevDays.length - 1];
        }
        this.render();
      }
    } else if (e.value === 't' || e.value === 'T') {
      // Jump to today
      if (this.todayDayIndex >= 0) {
        this.pointer = this.dayStarts[this.todayDayIndex];
        this.render();
      }
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

    this.opt.choices.forEach((choice, index) => {
      if (choice.type === 'separator') {
        const label = choice.line || '';
        allChoicesOutput += '\n' + chalk.bold.bgHex('#444').whiteBright(` ${label} `) + '\n';
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
        let checkbox = isDeclined ? chalk.green(figures.radioOn) : chalk.dim('–');
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
        allChoicesOutput += chalk.cyan(`${figures.pointer} ${line}\n`);
      } else {
        allChoicesOutput += `  ${line}\n`;
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

      const parts = [
        canSelect ? (this.selected.has(this.pointer) ? hi('<space> unselect') : hi('<space> select')) : lo('<space> select'),
        canDecline ? (isDeclined ? hi('<d> cancel decline') : hi('<d> decline')) : lo('<d> decline'),
        hi('<↑↓> move'),
        canCycleRoom ? hi('<←→> room') : lo('<←→> room'),
        hasNextDay ? hi('<]> next day') : lo('<]> next day'),
        hasPrevDay ? hi('<[> prev day') : lo('<[> prev day'),
        hasToday ? hi('<t> today') : lo('<t> today'),
        hi('<enter> submit'),
        hi('<q/esc> quit'),
      ];
      const helpText = chalk.dim('Shortcuts: ') + parts.join('  ');

      bottomContent = this.paginator.paginate(allChoicesOutput, realIndexPosition, this.opt.pageSize);
      const hintText = '(Move up and down to reveal more choices)';
      bottomContent = bottomContent.replace(hintText, '');
      bottomContent += '\n' + footerSeparator + '\n' + helpText;
    }

    this.screen.render(message, bottomContent);
  }
}

export default RoomPickerPrompt;
