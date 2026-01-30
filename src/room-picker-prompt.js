import chalk from 'chalk';
import figures from 'figures';
import cliCursor from 'cli-cursor';
import { createPrompt, useState, useKeypress, usePrefix, isEnterKey, isSpaceKey } from '@inquirer/core';

export default createPrompt((config, done) => {
  const [status, setStatus] = useState('pending');
  const [cursorPos, setCursorPos] = useState(0);
  const [selectedItems, setSelectedItems] = useState(new Set());
  const [roomSelections, setRoomSelections] = useState(new Map());
  const prefix = usePrefix({ status });

  useKeypress((key, rl) => {
    if (isEnterKey(key)) {
      const selections = config.choices
        .map((choice, i) => {
          if (choice.type === 'separator') return null;
          if (selectedItems.has(i)) {
            const roomIndex = roomSelections.get(i) || 0;
            return {
              meetingIndex: choice.meetingIndex,
              room: choice.rooms[roomIndex]
            };
          }
          return null;
        })
        .filter(Boolean);

      setStatus('done');
      done(selections);
    } else if (isSpaceKey(key)) {
      const choice = config.choices[cursorPos];
      if (choice.type === 'separator') return;

      const newSet = new Set(selectedItems);
      if (newSet.has(cursorPos)) {
        newSet.delete(cursorPos);
      } else {
        newSet.add(cursorPos);
      }
      setSelectedItems(newSet);
    } else if (key.name === 'up' || key.name === 'k') {
      let newPos = cursorPos;
      do {
        newPos = newPos > 0 ? newPos - 1 : config.choices.length - 1;
      } while (config.choices[newPos].type === 'separator' && newPos !== cursorPos);
      setCursorPos(newPos);
    } else if (key.name === 'down' || key.name === 'j') {
      let newPos = cursorPos;
      do {
        newPos = newPos < config.choices.length - 1 ? newPos + 1 : 0;
      } while (config.choices[newPos].type === 'separator' && newPos !== cursorPos);
      setCursorPos(newPos);
    } else if (key.name === 'left') {
      const choice = config.choices[cursorPos];
      if (choice.type === 'separator') return;
      if (choice.rooms && choice.rooms.length > 1) {
        const current = roomSelections.get(cursorPos) || 0;
        const newIndex = current > 0 ? current - 1 : choice.rooms.length - 1;
        const newMap = new Map(roomSelections);
        newMap.set(cursorPos, newIndex);
        setRoomSelections(newMap);
      }
    } else if (key.name === 'right') {
      const choice = config.choices[cursorPos];
      if (choice.type === 'separator') return;
      if (choice.rooms && choice.rooms.length > 1) {
        const current = roomSelections.get(cursorPos) || 0;
        const newIndex = current < choice.rooms.length - 1 ? current + 1 : 0;
        const newMap = new Map(roomSelections);
        newMap.set(cursorPos, newIndex);
        setRoomSelections(newMap);
      }
    }
  });

  const message = chalk.bold(config.message);

  if (status === 'done') {
    return `${prefix} ${message}`;
  }

  const instructions = chalk.dim('(Press <space> to select, <↑↓> to move, <←→> to change room, <enter> to submit)');

  const lines = [
    `${prefix} ${message}`,
    instructions,
    ...config.choices.map((choice, index) => {
      // Handle separators
      if (choice.type === 'separator') {
        if (choice.line === '') {
          return chalk.dim('──────────────');
        }
        return chalk.bold(choice.line);
      }

      const isSelected = selectedItems.has(index);
      const isCursor = cursorPos === index;
      const roomIndex = roomSelections.get(index) || 0;
      const room = choice.rooms[roomIndex];

      let checkbox = isSelected ? chalk.green(figures.radioOn) : figures.radioOff;
      let line = `${checkbox} ${choice.name} ${chalk.gray(`(${choice.time})`)}`;

      if (choice.rooms && choice.rooms.length > 0) {
        const roomLabel = choice.rooms.length > 1
          ? `${chalk.green('→')} ${room.name} ${chalk.gray(`[${room.capacity}]`)} ${chalk.dim(`(${roomIndex + 1}/${choice.rooms.length})`)}`
          : `${chalk.green('→')} ${room.name} ${chalk.gray(`[${room.capacity}]`)}`;
        line += ` ${roomLabel}`;
      } else {
        line += ` ${chalk.red('(no room available)')}`;
      }

      if (isCursor) {
        return chalk.cyan(`❯ ${line}`);
      }
      return `  ${line}`;
    })
  ];

  return lines.join('\n');
});
