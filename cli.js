#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import inquirer from 'inquirer';
import ora from 'ora';
import Table from 'cli-table3';
import { google } from 'googleapis';
import {
  loadConfig,
  saveConfig,
  addRoom,
  removeRoom,
  listRooms,
  addRemoteWorker,
  removeRemoteWorker,
  listRemoteWorkers,
  resetConfig,
  getConfigPath,
  getCredentialsPath,
  getTokenPath,
  ensureConfigDir
} from './config.js';
import {
  loadCredentials,
  authorize,
  getThisWeeksMeetings,
  filterMeetingsWithoutRooms,
  findAvailableRoom,
  addRoomToMeeting,
  formatDateTime,
  getAttendeeCount
} from './calendar.js';
import fs from 'fs';

const program = new Command();

// Show welcome message
function showWelcome() {
  console.clear();

  const logo = `
     ██╗ █████╗ ███╗   ██╗██╗   ██╗ █████╗ ██████╗ ██╗   ██╗
     ██║██╔══██╗████╗  ██║██║   ██║██╔══██╗██╔══██╗╚██╗ ██╔╝
     ██║███████║██╔██╗ ██║██║   ██║███████║██████╔╝ ╚████╔╝
██   ██║██╔══██║██║╚██╗██║██║   ██║██╔══██║██╔══██╗  ╚██╔╝
╚█████╔╝██║  ██║██║ ╚████║╚██████╔╝██║  ██║██║  ██║   ██║
 ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝
  `;

  console.log(chalk.cyan.bold(logo));
  console.log(chalk.gray('  Automatically add meeting rooms to your calendar events\n'));
}

// Process selected meetings
async function processSelectedMeetings(calendar, meetings, availableRooms, selectedIndices) {
  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const index of selectedIndices) {
    const meeting = meetings[index];
    const room = availableRooms[index];

    if (!room) {
      console.log(chalk.red(`\n✗ ${meeting.summary} - No room available`));
      skipped++;
      continue;
    }

    const spinner = ora({
      text: chalk.gray(`Adding ${room.name} to "${meeting.summary}"...`),
      spinner: 'dots'
    }).start();

    try {
      await addRoomToMeeting(calendar, meeting.id, room.email);
      spinner.succeed(chalk.green(`${room.name} added to "${meeting.summary}"`));
      added++;
    } catch (error) {
      spinner.fail(chalk.red(`Failed to add room to "${meeting.summary}": ${error.message}`));
      failed++;
    }
  }

  return { added, skipped, failed };
}

// Show summary
function showSummary(added, skipped, failed) {
  console.log('');
  const summaryLines = [
    chalk.bold('Summary:'),
    '',
    chalk.green(`✓ ${added} room${added !== 1 ? 's' : ''} added successfully`),
  ];

  if (skipped > 0) {
    summaryLines.push(chalk.yellow(`⊘ ${skipped} meeting${skipped !== 1 ? 's' : ''} skipped (no room available)`));
  }

  if (failed > 0) {
    summaryLines.push(chalk.red(`✗ ${failed} failed`));
  }

  const summary = boxen(summaryLines.join('\n'), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: added > 0 ? 'green' : 'yellow'
  });

  console.log(summary);
}

// Main run command
async function runCommand() {
  try {
    showWelcome();
    loadCredentials();

    const spinner = ora({
      text: chalk.gray('Connecting to Google Calendar...'),
      spinner: 'dots'
    }).start();

    const auth = await authorize();
    const calendar = google.calendar({ version: 'v3', auth });

    spinner.text = chalk.gray('Fetching meetings for the next 2 weeks...');

    const meetings = await getThisWeeksMeetings(calendar);
    const meetingsWithoutRooms = filterMeetingsWithoutRooms(meetings);

    if (meetingsWithoutRooms.length === 0) {
      spinner.succeed(chalk.green('All upcoming meetings have rooms assigned!'));
      console.log('');
      return;
    }

    spinner.text = chalk.gray('Checking room availability...');

    const availableRooms = [];
    for (const meeting of meetingsWithoutRooms) {
      try {
        const room = await findAvailableRoom(calendar, meeting);
        availableRooms.push(room);
      } catch (error) {
        availableRooms.push(null);
      }
    }

    spinner.succeed(chalk.green(`Found ${meetingsWithoutRooms.length} meeting${meetingsWithoutRooms.length !== 1 ? 's' : ''} without rooms`));
    console.log('');

    // Group meetings by day
    const groupedMeetings = {};
    meetingsWithoutRooms.forEach((meeting, index) => {
      const date = new Date(meeting.start.dateTime || meeting.start.date);
      const dateKey = date.toDateString();

      if (!groupedMeetings[dateKey]) {
        groupedMeetings[dateKey] = [];
      }

      groupedMeetings[dateKey].push({ meeting, index, date });
    });

    // Create choices with day separators
    const choices = [];
    Object.keys(groupedMeetings).forEach((dateKey, groupIndex) => {
      const group = groupedMeetings[dateKey];
      const firstDate = group[0].date;

      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let dayLabel;
      if (firstDate.toDateString() === today.toDateString()) {
        dayLabel = chalk.bold.green('Today, ') + firstDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (firstDate.toDateString() === tomorrow.toDateString()) {
        dayLabel = chalk.bold.yellow('Tomorrow, ') + firstDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        dayLabel = chalk.bold(firstDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }));
      }

      if (groupIndex > 0) {
        choices.push(new inquirer.Separator());
      }
      choices.push(new inquirer.Separator(dayLabel));

      group.forEach(({ meeting, index, date }) => {
        const room = availableRooms[index];
        const name = meeting.summary || 'Untitled Meeting';
        const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const roomInfo = room ? chalk.green(`→ ${room.name}`) : chalk.red('(no room available)');

        choices.push({
          name: `  ${name} ${chalk.gray(`(${time})`)} ${roomInfo}`,
          value: index,
          disabled: !room
        });
      });
    });

    const answers = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'meetings',
        message: chalk.cyan('Select meetings to add rooms to:'),
        choices: choices,
        pageSize: 15
      },
      {
        type: 'confirm',
        name: 'confirm',
        message: chalk.yellow('Are you sure you want to add these rooms?'),
        default: true,
        when: (answers) => answers.meetings.length > 0
      }
    ]);

    if (!answers.meetings || answers.meetings.length === 0) {
      console.log(chalk.yellow('\n⊘ No meetings selected. Exiting.\n'));
      return;
    }

    if (!answers.confirm) {
      console.log(chalk.yellow('\n⊘ Cancelled. No changes made.\n'));
      return;
    }

    console.log('');
    const { added, skipped, failed } = await processSelectedMeetings(
      calendar,
      meetingsWithoutRooms,
      availableRooms,
      answers.meetings
    );

    showSummary(added, skipped, failed);

  } catch (error) {
    console.log(chalk.red.bold(`\n✗ Error: ${error.message}\n`));
    process.exit(1);
  }
}

// Config command handlers
async function configCommand(action, options) {
  ensureConfigDir();

  if (action === 'list') {
    const config = loadConfig();
    console.log(chalk.cyan.bold('\n📋 Current Configuration\n'));
    console.log(JSON.stringify(config, null, 2));
    console.log('');
    return;
  }

  if (action === 'path') {
    console.log(chalk.cyan.bold('\n📁 Configuration Paths\n'));
    console.log(chalk.gray('Config file:      ') + chalk.white(getConfigPath()));
    console.log(chalk.gray('Credentials file: ') + chalk.white(getCredentialsPath()));
    console.log(chalk.gray('Token file:       ') + chalk.white(getTokenPath()));
    console.log('');
    return;
  }

  if (action === 'reset') {
    const result = resetConfig();
    console.log(result.success ? chalk.green(`\n✓ ${result.message}\n`) : chalk.red(`\n✗ ${result.message}\n`));
    return;
  }

  if (action === 'rooms') {
    if (options.add) {
      const [name, email, capacity] = options.add.split(',').map(s => s.trim());
      if (!name || !email || !capacity) {
        console.log(chalk.red('\n✗ Usage: --add "Room Name,email@resource.calendar.google.com,10"\n'));
        return;
      }
      const result = addRoom(name, email, capacity);
      console.log(result.success ? chalk.green(`\n✓ ${result.message}\n`) : chalk.red(`\n✗ ${result.message}\n`));
      return;
    }

    if (options.remove) {
      const result = removeRoom(options.remove);
      console.log(result.success ? chalk.green(`\n✓ ${result.message}\n`) : chalk.red(`\n✗ ${result.message}\n`));
      return;
    }

    const rooms = listRooms();
    console.log(chalk.cyan.bold('\n🏢 Meeting Rooms\n'));
    if (rooms.length === 0) {
      console.log(chalk.gray('No rooms configured.\n'));
      return;
    }

    const table = new Table({
      head: [chalk.cyan('Name'), chalk.cyan('Email'), chalk.cyan('Capacity')],
      colWidths: [20, 60, 10]
    });

    rooms.forEach(room => {
      table.push([room.name, room.email, room.capacity]);
    });

    console.log(table.toString());
    console.log('');
    return;
  }

  if (action === 'remote-workers') {
    if (options.add) {
      const result = addRemoteWorker(options.add);
      console.log(result.success ? chalk.green(`\n✓ ${result.message}\n`) : chalk.red(`\n✗ ${result.message}\n`));
      return;
    }

    if (options.remove) {
      const result = removeRemoteWorker(options.remove);
      console.log(result.success ? chalk.green(`\n✓ ${result.message}\n`) : chalk.red(`\n✗ ${result.message}\n`));
      return;
    }

    const workers = listRemoteWorkers();
    console.log(chalk.cyan.bold('\n🌐 Remote Workers\n'));
    if (workers.length === 0) {
      console.log(chalk.gray('No remote workers configured.\n'));
      return;
    }

    workers.forEach(worker => {
      console.log(chalk.gray('  • ') + worker);
    });
    console.log('');
    return;
  }

  console.log(chalk.red('\n✗ Unknown config action. Use --help for usage information.\n'));
}

// Setup command
async function setupCommand() {
  console.clear();
  console.log(chalk.cyan.bold('\n🔧 Meeting Room Assistant Setup\n'));

  ensureConfigDir();

  console.log(chalk.yellow('Setting up Google Calendar OAuth credentials...\n'));
  console.log(chalk.gray('Follow these steps:\n'));
  console.log(chalk.gray('1. Go to https://console.cloud.google.com/'));
  console.log(chalk.gray('2. Create/select a project'));
  console.log(chalk.gray('3. Enable Google Calendar API'));
  console.log(chalk.gray('4. Create OAuth 2.0 credentials (Desktop app)'));
  console.log(chalk.gray('5. Download the JSON file\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'credentialsPath',
      message: 'Path to your downloaded credentials JSON file:',
      validate: (input) => {
        if (!input) return 'Please provide a path';
        if (!fs.existsSync(input)) return 'File does not exist';
        return true;
      }
    }
  ]);

  try {
    const content = fs.readFileSync(answers.credentialsPath);
    JSON.parse(content); // Validate JSON

    fs.copyFileSync(answers.credentialsPath, getCredentialsPath());
    console.log(chalk.green('\n✓ Credentials saved successfully!\n'));
    console.log(chalk.gray('Config location: ') + chalk.white(getCredentialsPath()));
    console.log(chalk.yellow('\nRun ') + chalk.cyan('meeting-rooms') + chalk.yellow(' to start using the tool!\n'));
  } catch (error) {
    console.log(chalk.red(`\n✗ Error: ${error.message}\n`));
    process.exit(1);
  }
}

// Version
const packageJson = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url)));

// CLI setup
program
  .name('mtg')
  .description('Automatically add meeting rooms to Google Calendar events')
  .version(packageJson.version);

// Run command (default)
program
  .command('run', { isDefault: true })
  .description('Run the interactive meeting room assistant')
  .action(runCommand);

// Setup command
program
  .command('setup')
  .description('Set up Google Calendar OAuth credentials')
  .action(setupCommand);

// Config command
program
  .command('config <action>')
  .description('Manage configuration (list, path, reset, rooms, remote-workers)')
  .option('--add <value>', 'Add an item (format depends on action)')
  .option('--remove <value>', 'Remove an item')
  .action(configCommand);

// Parse arguments
program.parse();
