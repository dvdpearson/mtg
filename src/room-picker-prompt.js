import inquirer from 'inquirer';
import chalk from 'chalk';
import figures from 'figures';

class RoomPickerPrompt extends inquirer.prompts.checkbox {
  constructor(questions, rl, answers) {
    super(questions, rl, answers);
    this.roomSelections = new Map();
  }

  onKeypress(e) {
    const key = e.key;

    if (key.name === 'left') {
      const currentChoice = this.choices.getChoice(this.pointer);
      if (currentChoice && currentChoice.rooms && currentChoice.rooms.length > 1) {
        const current = this.roomSelections.get(this.pointer) || 0;
        const newIndex = current > 0 ? current - 1 : currentChoice.rooms.length - 1;
        this.roomSelections.set(this.pointer, newIndex);
        this.render();
      }
      return;
    }

    if (key.name === 'right') {
      const currentChoice = this.choices.getChoice(this.pointer);
      if (currentChoice && currentChoice.rooms && currentChoice.rooms.length > 1) {
        const current = this.roomSelections.get(this.pointer) || 0;
        const newIndex = current < currentChoice.rooms.length - 1 ? current + 1 : 0;
        this.roomSelections.set(this.pointer, newIndex);
        this.render();
      }
      return;
    }

    super.onKeypress(e);
  }

  getCurrentValue() {
    const choices = this.choices.filter((choice) => {
      return !choice.type || choice.type === 'choice';
    });

    return choices.filter((choice) => choice.checked).map((choice) => {
      const roomIndex = this.roomSelections.get(choice.realIndex) || 0;
      return {
        meetingIndex: choice.meetingIndex,
        room: choice.rooms[roomIndex]
      };
    });
  }

  getQuestion() {
    let message = chalk.bold(this.opt.message) + ' ';
    message += chalk.dim('(Press <space> to select, <↑↓> to move, <←→> to change room, <enter> to submit)');
    return message;
  }

  renderChoices() {
    let output = '';
    let choiceIndex = 0;

    this.choices.forEach((choice, index) => {
      if (choice.type === 'separator') {
        if (choice.line === '') {
          output += '\n' + chalk.dim('──────────────') + '\n';
        } else {
          output += '\n' + chalk.bold(choice.line) + '\n';
        }
        return;
      }

      const isSelected = choice.checked;
      const isCursor = choiceIndex === this.pointer;
      const roomIndex = this.roomSelections.get(choiceIndex) || 0;
      const room = choice.rooms[roomIndex];

      choice.realIndex = choiceIndex;

      let checkbox = isSelected ? chalk.green(figures.radioOn) : figures.radioOff;
      let line = `${checkbox} ${choice.name} ${chalk.gray(`(${choice.time})`)}`;

      if (choice.rooms && choice.rooms.length > 0) {
        const roomLabel = choice.rooms.length > 1
          ? `${chalk.green('→')} ${room.name} ${chalk.gray(`[${room.capacity}]`)} ${chalk.dim(`(${roomIndex + 1}/${choice.rooms.length})`)}`
          : `${chalk.green('→')} ${room.name} ${chalk.gray(`[${room.capacity}]`)}`;
        line += ` ${roomLabel}`;
      }

      if (isCursor) {
        output += chalk.cyan(`${figures.pointer} ${line}\n`);
      } else {
        output += `  ${line}\n`;
      }

      choiceIndex++;
    });

    return output;
  }
}

export default RoomPickerPrompt;
