# Meeting Room Assistant - Interactive CLI

A modern, interactive command-line tool to automatically find Google Calendar meetings without meeting rooms and add available rooms with beautiful UI.

## ✨ Features

- 🎨 **Beautiful UI** - Colored output, tables, and interactive menus
- ⚡ **Fast & Interactive** - Select multiple meetings at once with checkbox interface
- 🔄 **Live Spinners** - Real-time progress indicators
- 📊 **Smart Matching** - Automatically finds the smallest available room that fits your meeting
- 🚫 **Smart Filtering** - Skips solo meetings and only shows future meetings
- ✅ **Confirmation** - Review selections before making changes

## Setup Instructions

### 1. Install Node.js

Make sure you have Node.js installed (version 18 or higher).

### 2. Install Dependencies

```bash
npm install
```

### 3. Create OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Calendar API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API" and click "Enable"

4. Create OAuth 2.0 credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose **"Desktop app"** as the application type
   - Name it: "Meeting Room Assistant CLI"
   - Click "Create"

5. Download the credentials:
   - Click the download icon (⬇️) next to your newly created OAuth client
   - Save the file as `credentials.json` in this folder

### 4. Configure OAuth Consent Screen

1. Go to "APIs & Services" > "OAuth consent screen"
2. Choose "Internal" (if using Google Workspace) or "External"
3. Fill in required fields:
   - App name: `Meeting Room Assistant`
   - User support email: your email
   - Developer contact email: your email
4. Click "Save and Continue"
5. Add scope: `https://www.googleapis.com/auth/calendar`
6. If using "External", add yourself as a test user
7. Complete the setup

## Usage

Run the script:

```bash
npm start
```

Or directly:

```bash
node cli.js
```

## Interactive Experience

### Welcome Screen
```
╭─────────────────────────────────────╮
│                                     │
│   Meeting Room Assistant            │
│                                     │
│   Automatically add meeting rooms   │
│   to your calendar events           │
│                                     │
╰─────────────────────────────────────╯
```

### Loading with Spinners
- ⠋ Connecting to Google Calendar...
- ⠙ Fetching meetings for the next 2 weeks...
- ⠹ Checking room availability...
- ✓ Found 5 meetings without rooms

### Meetings Table
```
┌───┬──────────────────────┬──────────────────┬────────┬──────────────────┐
│ # │ Meeting              │ Time             │ People │ Available Room   │
├───┼──────────────────────┼──────────────────┼────────┼──────────────────┤
│ 1 │ Team Sync            │ Today at 02:00PM │ 4      │ Bag End (4)      │
│ 2 │ Planning Session     │ Tomorrow at 10AM │ 7      │ Rivendell (12)   │
│ 3 │ 1:1 with Manager     │ Wed, Jan 30 at 3 │ 2      │ Prancing Pony (3)│
└───┴──────────────────────┴──────────────────┴────────┴──────────────────┘
```

### Interactive Selection
```
? Select meetings to add rooms to: (Use arrow keys, space to select)
❯ ◯ Team Sync → Bag End
  ◉ Planning Session → Rivendell
  ◯ 1:1 with Manager → Prancing Pony

? Are you sure you want to add these rooms? (Y/n)
```

### Live Progress
```
✓ Rivendell added to "Planning Session"
⠋ Adding Bag End to "Team Sync"...
```

### Summary Box
```
╭─────────────────────────────────╮
│                                 │
│   Summary:                      │
│                                 │
│   ✓ 2 rooms added successfully  │
│   ⊘ 1 meeting skipped           │
│                                 │
╰─────────────────────────────────╯
```

## What It Does

1. **Fetches** upcoming meetings from this week and next week without meeting rooms
2. **Filters** out:
   - Past meetings (only shows future meetings)
   - Solo meetings (meetings with only you)
   - Meetings that already have rooms
3. **Checks** room availability for each meeting
4. **Suggests** the best room based on:
   - Room availability during meeting time
   - Room capacity matching attendee count
   - Smallest room that fits (efficient use)
5. **Interactive selection** - Use checkbox interface to select which meetings to update
6. **Confirmation** - Reviews your selections before making changes
7. **Batch processing** - Adds all selected rooms with live progress updates
8. **Summary** - Shows final results in a beautiful box

## Meeting Rooms

The script checks these three rooms:
- **Bag End** - 4 people capacity
- **Prancing Pony** - 3 people capacity
- **Rivendell** - 12 people capacity

To add more rooms, edit the `ROOMS` array at the top of `cli.js`.

## Keyboard Shortcuts

- **Arrow keys** - Navigate menu
- **Space** - Select/deselect meeting
- **A** - Select all
- **I** - Invert selection
- **Enter** - Confirm selection
- **Ctrl+C** - Cancel/exit

## Technologies Used

- **googleapis** - Google Calendar API client
- **inquirer** - Interactive command line prompts
- **chalk** - Terminal string styling
- **ora** - Elegant terminal spinners
- **boxen** - Create boxes in the terminal
- **cli-table3** - Beautiful tables for the terminal

## Troubleshooting

### Error: credentials.json not found
Make sure you've downloaded the OAuth credentials from Google Cloud Console and saved them as `credentials.json` in this folder.

### Authentication Issues
Delete `token.json` and run the script again to re-authenticate.

### API Errors
Ensure the Google Calendar API is enabled in your Google Cloud project.

### No Rooms Available
The script checks room availability using the FreeBusy API. If all rooms are booked during the meeting time, it will show "No rooms available" in red.

## Files

- `cli.js` - Main interactive script
- `package.json` - Node.js dependencies
- `credentials.json` - OAuth credentials (you create this)
- `token.json` - Stored auth token (auto-generated)

## Security

- Never commit `credentials.json` or `token.json` to version control
- The token gives access to your calendar, keep it secure
- Only share the app with trusted users
