import { createRequire } from 'module';
import chalk from 'chalk';
import figures from 'figures';
import cliCursor from 'cli-cursor';
import { fromEvent } from 'rxjs';
import { filter, map, share, takeUntil } from 'rxjs/operators';

const require = createRequire(import.meta.url);
const Base = require('inquirer/lib/prompts/base');
const observe = require('inquirer/lib/utils/events');

class RoomPickerPrompt extends Base {
  constructor(questions, rl, answers) {
    super(questions, rl, answers);

    if (!this.opt.choices) {
      this.throwParamError('choices');
    }

    this.pointer = 0;
    this.selected = new Set();
    this.roomSelections = new Map();

    // Filter out separators for navigation
    this.selectableChoices = this.opt.choices.filter(
      (choice) => choice.type !== 'separator'
    );
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

    if (key.name === 'up' || key.name === 'k') {
      this.pointer = this.pointer > 0 ? this.pointer - 1 : len - 1;
      this.render();
    } else if (key.name === 'down' || key.name === 'j') {
      this.pointer = this.pointer < len - 1 ? this.pointer + 1 : 0;
      this.render();
    } else if (key.name === 'space') {
      const choiceIndex = this.pointer;
      if (this.selected.has(choiceIndex)) {
        this.selected.delete(choiceIndex);
      } else {
        this.selected.add(choiceIndex);
      }
      this.render();
    } else if (key.name === 'left') {
      const choice = this.selectableChoices[this.pointer];
      if (choice.rooms && choice.rooms.length > 1) {
        const current = this.roomSelections.get(this.pointer) || 0;
        const newIndex = current > 0 ? current - 1 : choice.rooms.length - 1;
        this.roomSelections.set(this.pointer, newIndex);
        this.render();
      }
    } else if (key.name === 'right') {
      const choice = this.selectableChoices[this.pointer];
      if (choice.rooms && choice.rooms.length > 1) {
        const current = this.roomSelections.get(this.pointer) || 0;
        const newIndex = current < choice.rooms.length - 1 ? current + 1 : 0;
        this.roomSelections.set(this.pointer, newIndex);
        this.render();
      }
    }
  }

  getSelectedValues() {
    return Array.from(this.selected).map((index) => {
      const choice = this.selectableChoices[index];
      const roomIndex = this.roomSelections.get(index) || 0;
      return {
        meetingIndex: choice.meetingIndex,
        room: choice.rooms[roomIndex]
      };
    });
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

    if (!error) {
      message += chalk.dim('(Press <space> to select, <↑↓> to move, <←→> to change room, <enter> to submit)');
    }

    let choiceIndex = 0;
    this.opt.choices.forEach((choice) => {
      if (choice.type === 'separator') {
        if (choice.line === '') {
          bottomContent += '\n' + chalk.dim('──────────────') + '\n';
        } else {
          bottomContent += '\n' + chalk.bold(choice.line) + '\n';
        }
        return;
      }

      const isSelected = this.selected.has(choiceIndex);
      const isCursor = choiceIndex === this.pointer;
      const roomIndex = this.roomSelections.get(choiceIndex) || 0;
      const room = choice.rooms[roomIndex];

      let checkbox = isSelected ? chalk.green(figures.radioOn) : figures.radioOff;
      let line = `${checkbox} ${choice.name} ${chalk.gray(`(${choice.time})`)}`;

      if (choice.rooms && choice.rooms.length > 0) {
        const roomLabel = choice.rooms.length > 1
          ? `${chalk.green('→')} ${room.name} ${chalk.gray(`[${room.capacity}]`)} ${chalk.dim(`(${roomIndex + 1}/${choice.rooms.length})`)}`
          : `${chalk.green('→')} ${room.name} ${chalk.gray(`[${room.capacity}]`)}`;
        line += ` ${roomLabel}`;
      }

      if (isCursor) {
        bottomContent += chalk.cyan(`${figures.pointer} ${line}\n`);
      } else {
        bottomContent += `  ${line}\n`;
      }

      choiceIndex++;
    });

    if (error) {
      bottomContent += '\n' + chalk.red('>> ') + error;
    }

    this.screen.render(message, bottomContent);
  }
}

export default RoomPickerPrompt;
