# mtg

CLI tool to find meetings without rooms and book them automatically.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/dvdpearson/mtg/main/scripts/install.sh | bash
```

Requires Node.js 18+.

## Setup

You'll need Google Calendar API credentials:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project and enable the Calendar API
3. Create OAuth credentials (Desktop application type)
4. Download the credentials JSON

Then run:

```bash
mtg setup
```

Follow the prompts to authenticate and configure your rooms.

### Sharing Credentials

To share credentials with teammates (so they don't need to create their own OAuth app):

```bash
# Export your credentials as a shareable command
mtg setup export

# Others can import using the generated command
mtg setup import <base64-string>
```

## Usage

```bash
mtg
```

The tool will:
- Find meetings this week that don't have a room booked
- Show available rooms based on capacity and schedule
- Let you select which meetings to update
- Book the rooms automatically

## Configuration

Manage rooms and settings:

```bash
# Add a room
mtg config rooms add "Conference Room A" room-a@resource.calendar.google.com 8

# List configured rooms
mtg config rooms list

# Add remote workers (excluded from attendee counts)
mtg config remote-workers add user@example.com
```

## Features

- Detects meetings without rooms (including declined room invites)
- Filters by room capacity based on attendee count
- Supports both Google Workspace rooms and custom room resources
- Handles room rebooking when previous room declined

## License

MIT
