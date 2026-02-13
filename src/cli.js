#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import boxen from 'boxen';
import inquirer from 'inquirer';
import RoomPickerPrompt from './room-picker-prompt.js';

inquirer.registerPrompt('room-picker', RoomPickerPrompt);
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
  filterMeetingsWithRooms,
  findAvailableRoom,
  findAllAvailableRooms,
  addRoomToMeeting,
  declineMeeting,
  formatDateTime,
  getAttendeeCount
} from './calendar.js';
import fs from 'fs';
import os from 'os';

const program = new Command();

// Helper function to expand tilde in paths
function expandTilde(filepath) {
  if (filepath.startsWith('~/')) {
    return filepath.replace('~', os.homedir());
  }
  return filepath;
}

// Show welcome message
function showWelcome() {
  console.clear();

  const logo = `
  ███╗   ███╗████████╗ ██████╗
  ████╗ ████║╚══██╔══╝██╔════╝
  ██╔████╔██║   ██║   ██║  ███╗
  ██║╚██╔╝██║   ██║   ██║   ██║
  ██║ ╚═╝ ██║   ██║   ╚██████╔╝
  ╚═╝     ╚═╝   ╚═╝    ╚═════╝
  `;

  console.log(chalk.cyan.bold(logo));
  console.log(chalk.gray('  Automatically add meeting rooms to your calendar events\n'));
}

// Process selected meetings
async function processSelectedMeetings(calendar, meetings, selections) {
  let added = 0;
  let skipped = 0;
  let failed = 0;

  for (const selection of selections) {
    const { meetingIndex, room } = selection;
    const meeting = meetings[meetingIndex];

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

// Process declined meetings
async function processDeclinedMeetings(calendar, meetings, declinedIndices) {
  let declined = 0;
  let failed = 0;

  for (const meetingIndex of declinedIndices) {
    const meeting = meetings[meetingIndex];

    const spinner = ora({
      text: chalk.gray(`Declining "${meeting.summary}"...`),
      spinner: 'dots'
    }).start();

    try {
      await declineMeeting(calendar, meeting.id);
      spinner.succeed(chalk.red(`Declined "${meeting.summary}"`));
      declined++;
    } catch (error) {
      spinner.fail(chalk.red(`Failed to decline "${meeting.summary}": ${error.message}`));
      failed++;
    }
  }

  return { declined, failed };
}

// Show summary
function showSummary(added, skipped, failed, declined, declineFailed) {
  console.log('');
  const summaryLines = [
    chalk.bold('Summary:'),
    '',
  ];

  if (added > 0) {
    summaryLines.push(chalk.green(`✓ ${added} room${added !== 1 ? 's' : ''} added successfully`));
  }

  if (declined > 0) {
    summaryLines.push(chalk.red(`✗ ${declined} meeting${declined !== 1 ? 's' : ''} declined`));
  }

  if (skipped > 0) {
    summaryLines.push(chalk.yellow(`⊘ ${skipped} meeting${skipped !== 1 ? 's' : ''} skipped (no room available)`));
  }

  const totalFailed = (failed || 0) + (declineFailed || 0);
  if (totalFailed > 0) {
    summaryLines.push(chalk.red(`✗ ${totalFailed} failed`));
  }

  const hasSuccess = added > 0 || declined > 0;

  const summary = boxen(summaryLines.join('\n'), {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: hasSuccess ? 'green' : 'yellow'
  });

  console.log(summary);
}

// Helper to get the existing room name from a meeting
function getExistingRoomName(meeting) {
  const config = loadConfig();
  const ROOMS = config.rooms || [];
  const configuredRoomEmails = ROOMS.map(r => r.email.toLowerCase());

  const isRoom = (attendee) =>
    attendee.resource === true ||
    (attendee.email && attendee.email.includes('@resource.calendar.google.com')) ||
    (attendee.email && configuredRoomEmails.includes(attendee.email.toLowerCase()));

  if (!meeting.attendees) return null;

  for (const attendee of meeting.attendees) {
    if (isRoom(attendee)) {
      const status = attendee.responseStatus || 'needsAction';
      if (status === 'accepted' || status === 'tentative' || status === 'needsAction') {
        // Try to find a friendly name from config
        const configured = ROOMS.find(r => r.email.toLowerCase() === (attendee.email || '').toLowerCase());
        return configured ? configured.name : (attendee.displayName || attendee.email);
      }
    }
  }
  return null;
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
    const meetingsWithRooms = filterMeetingsWithRooms(meetings);

    if (meetingsWithoutRooms.length === 0 && meetingsWithRooms.length === 0) {
      spinner.succeed(chalk.green('No upcoming meetings found!'));
      console.log('');
      return;
    }

    // Merge into allMeetings sorted by start time, tagged with needsRoom
    const allMeetings = [
      ...meetingsWithoutRooms.map(m => ({ meeting: m, needsRoom: true })),
      ...meetingsWithRooms.map(m => ({ meeting: m, needsRoom: false }))
    ].sort((a, b) => {
      const aTime = new Date(a.meeting.start.dateTime || a.meeting.start.date);
      const bTime = new Date(b.meeting.start.dateTime || b.meeting.start.date);
      return aTime - bTime;
    });

    spinner.text = chalk.gray('Checking room availability...');

    // Check room availability only for meetings that need rooms
    const roomAvailabilityMap = new Map();
    for (let i = 0; i < allMeetings.length; i++) {
      if (allMeetings[i].needsRoom) {
        try {
          const rooms = await findAllAvailableRooms(calendar, allMeetings[i].meeting);
          roomAvailabilityMap.set(i, rooms);
        } catch (error) {
          roomAvailabilityMap.set(i, []);
        }
      }
    }

    const roomlessCount = meetingsWithoutRooms.length;
    const withRoomCount = meetingsWithRooms.length;
    let statusMsg = `Found ${allMeetings.length} meeting${allMeetings.length !== 1 ? 's' : ''}`;
    if (roomlessCount > 0) {
      statusMsg += ` (${roomlessCount} without rooms)`;
    }
    spinner.succeed(chalk.green(statusMsg));
    console.log('');

    // Group meetings by day
    const groupedMeetings = {};
    allMeetings.forEach((entry, index) => {
      const date = new Date(entry.meeting.start.dateTime || entry.meeting.start.date);
      const dateKey = date.toDateString();

      if (!groupedMeetings[dateKey]) {
        groupedMeetings[dateKey] = [];
      }

      groupedMeetings[dateKey].push({ ...entry, index, date });
    });

    // Create choices for custom prompt with day separators
    const choices = [];
    Object.keys(groupedMeetings).forEach((dateKey, groupIndex) => {
      const group = groupedMeetings[dateKey];
      const firstDate = group[0].date;

      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      let dayLabel;
      if (firstDate.toDateString() === today.toDateString()) {
        dayLabel = 'Today, ' + firstDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else if (firstDate.toDateString() === tomorrow.toDateString()) {
        dayLabel = 'Tomorrow, ' + firstDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } else {
        dayLabel = firstDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      }

      choices.push({ type: 'separator', line: dayLabel });

      group.forEach(({ meeting, needsRoom, index, date }) => {
        const name = meeting.summary || 'Untitled Meeting';
        const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        const canDecline = !meeting.organizer?.self;
        const organizer = meeting.organizer?.self ? 'You' : (meeting.organizer?.displayName || meeting.organizer?.email || 'Unknown');
        const guestCount = getAttendeeCount(meeting);

        if (needsRoom) {
          const rooms = roomAvailabilityMap.get(index) || [];
          if (rooms.length === 0 && !canDecline) return; // Skip if no rooms and can't decline

          choices.push({
            name,
            time,
            meetingIndex: index,
            rooms,
            canDecline,
            organizer,
            guestCount
          });
        } else {
          const existingRoom = getExistingRoomName(meeting);
          choices.push({
            name,
            time,
            meetingIndex: index,
            hasRoom: true,
            existingRoom: existingRoom || 'Room',
            canDecline,
            organizer,
            guestCount
          });
        }
      });
    });

    // Check if there are any selectable choices
    const selectableChoices = choices.filter(c => c.type !== 'separator');
    if (selectableChoices.length === 0) {
      console.log(chalk.green('All meetings have rooms and no actions available!\n'));
      return;
    }

    let confirmed = false;
    let finalSelections = [];
    let finalDeclined = [];
    let previousState = null;
    while (!confirmed) {
      const answer = await inquirer.prompt([{
        type: 'room-picker',
        name: 'selections',
        message: 'Select meetings and rooms',
        choices: choices,
        initialState: previousState,
        pageSize: 15
      }]);

      const { selections, declined, quit } = answer.selections;

      if (quit) {
        const hasChanges = (selections && selections.length > 0) || (declined && declined.length > 0);
        if (hasChanges) {
          const quitAnswer = await inquirer.prompt([{
            type: 'confirm',
            name: 'confirm',
            message: chalk.yellow('You have unsaved changes. Are you sure you want to quit?'),
            default: true
          }]);
          if (!quitAnswer.confirm) {
            previousState = { selections, declined };
            console.clear();
            showWelcome();
            console.log(chalk.green(`✓ ${statusMsg}`));
            console.log('');
            continue;
          }
        }
        console.log(chalk.yellow('\n⊘ No changes made. Exiting.\n'));
        return;
      }

      if ((!selections || selections.length === 0) && (!declined || declined.length === 0)) {
        console.log(chalk.yellow('\n⊘ No meetings selected. Exiting.\n'));
        return;
      }

      // Show summary of changes
      console.log(chalk.cyan.bold('\n📋 Changes to be made:\n'));
      if (selections && selections.length > 0) {
        selections.forEach((selection) => {
          const meeting = allMeetings[selection.meetingIndex].meeting;
          const meetingName = meeting.summary || 'Untitled Meeting';
          const date = new Date(meeting.start.dateTime || meeting.start.date);
          const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          console.log(chalk.gray('  • ') + chalk.white(meetingName) + chalk.gray(` (${time})`) + chalk.green(` → ${selection.room.name}`));
        });
      }
      if (declined && declined.length > 0) {
        declined.forEach((meetingIndex) => {
          const meeting = allMeetings[meetingIndex].meeting;
          const meetingName = meeting.summary || 'Untitled Meeting';
          const date = new Date(meeting.start.dateTime || meeting.start.date);
          const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
          console.log(chalk.gray('  • ') + chalk.white(meetingName) + chalk.gray(` (${time})`) + chalk.red(' ✗ DECLINE'));
        });
      }
      console.log('');

      const confirmAnswer = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: chalk.yellow('Are you sure you want to make these changes?'),
        default: true
      }]);

      if (confirmAnswer.confirm) {
        confirmed = true;
        finalSelections = selections;
        finalDeclined = declined;
      } else {
        previousState = { selections, declined };
        console.clear();
        showWelcome();
        console.log(chalk.green(`✓ ${statusMsg}`));
        console.log('');
      }
    }

    console.log('');

    // Process declines first
    let declineResult = { declined: 0, failed: 0 };
    if (finalDeclined && finalDeclined.length > 0) {
      declineResult = await processDeclinedMeetings(
        calendar,
        allMeetings.map(e => e.meeting),
        finalDeclined
      );
    }

    // Process room additions
    let roomResult = { added: 0, skipped: 0, failed: 0 };
    if (finalSelections && finalSelections.length > 0) {
      roomResult = await processSelectedMeetings(
        calendar,
        allMeetings.map(e => e.meeting),
        finalSelections
      );
    }

    showSummary(roomResult.added, roomResult.skipped, roomResult.failed, declineResult.declined, declineResult.failed);

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
  console.log(chalk.gray('1. Go to ') + chalk.cyan('https://console.cloud.google.com/'));
  console.log(chalk.gray('2. Create/select a project'));
  console.log(chalk.gray('3. Enable ') + chalk.white('Google Calendar API'));
  console.log(chalk.gray('4. Go to ') + chalk.cyan('APIs & Services > Credentials'));
  console.log(chalk.gray('5. Create Credentials > OAuth 2.0 Client ID'));
  console.log(chalk.gray('6. Choose ') + chalk.white('Web application') + chalk.gray(' (NOT Desktop app)'));
  console.log(chalk.gray('7. Under "Authorized redirect URIs", add: ') + chalk.cyan('http://localhost:3000'));
  console.log(chalk.gray('8. Click Create and download the JSON file\n'));

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'credentialsPath',
      message: 'Path to your downloaded credentials JSON file:',
      validate: (input) => {
        if (!input) return 'Please provide a path';
        const expandedPath = expandTilde(input);
        if (!fs.existsSync(expandedPath)) return 'File does not exist';
        return true;
      }
    }
  ]);

  try {
    const expandedPath = expandTilde(answers.credentialsPath);
    const content = fs.readFileSync(expandedPath);
    JSON.parse(content); // Validate JSON

    fs.copyFileSync(expandedPath, getCredentialsPath());
    console.log(chalk.green('\n✓ Credentials saved successfully!\n'));
    console.log(chalk.gray('Config location: ') + chalk.white(getCredentialsPath()));
    console.log(chalk.yellow('\nRun ') + chalk.cyan('mtg') + chalk.yellow(' to start using the tool!\n'));
  } catch (error) {
    console.log(chalk.red(`\n✗ Error: ${error.message}\n`));
    process.exit(1);
  }
}

// Setup import command - import credentials from base64 string
async function setupImportCommand(base64Creds) {
  ensureConfigDir();

  try {
    const jsonStr = Buffer.from(base64Creds, 'base64').toString('utf-8');
    const creds = JSON.parse(jsonStr);

    // Validate it looks like OAuth credentials
    if (!creds.installed && !creds.web) {
      throw new Error('Invalid credentials format - missing "installed" or "web" key');
    }

    fs.writeFileSync(getCredentialsPath(), JSON.stringify(creds, null, 2));
    console.log(chalk.green('\n✓ Credentials imported successfully!\n'));
    console.log(chalk.gray('Config location: ') + chalk.white(getCredentialsPath()));
    console.log(chalk.yellow('\nRun ') + chalk.cyan('mtg') + chalk.yellow(' to start using the tool!\n'));
  } catch (error) {
    console.log(chalk.red(`\n✗ Error: ${error.message}\n`));
    process.exit(1);
  }
}

// Setup export command - export credentials as base64 for sharing
async function setupExportCommand() {
  try {
    const credsPath = getCredentialsPath();
    if (!fs.existsSync(credsPath)) {
      console.log(chalk.red('\n✗ No credentials found. Run "mtg setup" first.\n'));
      process.exit(1);
    }

    const content = fs.readFileSync(credsPath, 'utf-8');
    JSON.parse(content); // Validate JSON

    const base64 = Buffer.from(content).toString('base64');
    console.log(chalk.cyan.bold('\n📋 Share this command with others:\n'));
    console.log(chalk.white(`mtg setup import ${base64}\n`));
  } catch (error) {
    console.log(chalk.red(`\n✗ Error: ${error.message}\n`));
    process.exit(1);
  }
}

// Rooms command - interactive room management
async function roomsCommand() {
  ensureConfigDir();

  while (true) {
    const rooms = listRooms();

    console.log(chalk.cyan.bold('\n🏢 Meeting Rooms\n'));

    if (rooms.length > 0) {
      const table = new Table({
        head: [chalk.cyan('Name'), chalk.cyan('Email'), chalk.cyan('Capacity')],
        colWidths: [25, 60, 10]
      });
      rooms.forEach(room => {
        table.push([room.name, room.email, room.capacity]);
      });
      console.log(table.toString());
      console.log('');
    } else {
      console.log(chalk.gray('No rooms configured.\n'));
    }

    const action = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What would you like to do?',
      choices: [
        { name: 'Add a room', value: 'add' },
        { name: 'Remove a room', value: 'remove' },
        { name: 'Exit', value: 'exit' }
      ]
    }]);

    if (action.action === 'exit') {
      console.log('');
      break;
    }

    if (action.action === 'add') {
      const roomDetails = await inquirer.prompt([
        {
          type: 'input',
          name: 'name',
          message: 'Room name:',
          validate: input => input ? true : 'Room name is required'
        },
        {
          type: 'input',
          name: 'email',
          message: 'Room email (e.g., room@resource.calendar.google.com):',
          validate: input => {
            if (!input) return 'Email is required';
            if (!input.includes('@')) return 'Invalid email format';
            return true;
          }
        },
        {
          type: 'input',
          name: 'capacity',
          message: 'Room capacity (number of people):',
          validate: input => {
            const num = parseInt(input);
            if (isNaN(num) || num < 1) return 'Please enter a valid number';
            return true;
          }
        }
      ]);

      const result = addRoom(roomDetails.name, roomDetails.email, roomDetails.capacity);
      console.log(result.success ? chalk.green(`\n✓ ${result.message}`) : chalk.red(`\n✗ ${result.message}`));
    } else if (action.action === 'remove') {
      if (rooms.length === 0) {
        console.log(chalk.yellow('\nNo rooms to remove.\n'));
        continue;
      }

      const removeChoice = await inquirer.prompt([{
        type: 'list',
        name: 'email',
        message: 'Which room would you like to remove?',
        choices: rooms.map(room => ({
          name: `${room.name} (${room.email})`,
          value: room.email
        }))
      }]);

      const result = removeRoom(removeChoice.email);
      console.log(result.success ? chalk.green(`\n✓ ${result.message}`) : chalk.red(`\n✗ ${result.message}`));
    }
  }
}

// Version
const packageJson = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url)));

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

// Setup command with subcommands
const setupCmd = program
  .command('setup')
  .description('Set up Google Calendar OAuth credentials')
  .action(setupCommand);

setupCmd
  .command('import <base64>')
  .description('Import credentials from base64 string')
  .action(setupImportCommand);

setupCmd
  .command('export')
  .description('Export credentials as base64 for sharing')
  .action(setupExportCommand);

// Rooms command
program
  .command('rooms')
  .description('Manage meeting rooms interactively')
  .action(roomsCommand);

// Config command
program
  .command('config <action>')
  .description('Manage configuration (list, path, reset, rooms, remote-workers)')
  .option('--add <value>', 'Add an item (format depends on action)')
  .option('--remove <value>', 'Remove an item')
  .action(configCommand);

// Parse arguments
program.parse();
