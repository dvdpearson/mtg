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

## Auto-booking (office days only)

`mtg` can run as a background daemon that books rooms for you automatically — but
only on the days you actually come into the office. It detects the office by
fingerprinting the network you're on (gateway, subnet, DNS), so there's nothing
to toggle and no schedule to keep up to date.

```bash
# At your desk, once: teach mtg what the office network looks like
mtg office learn

# Install the background daemon (checks every 5 minutes)
mtg daemon install
```

From then on, whenever your laptop is on the office network, the daemon silently
books the best available room for each of that day's room-less meetings and sends
a macOS notification summarizing what it grabbed. On any other network it stays
idle. Each meeting is only booked once per day.

```bash
# See the current network, whether it matches the office, and last activity
mtg office status

# Check or remove the daemon
mtg daemon status
mtg daemon uninstall
```

### Notifications

When the daemon books rooms it sends a macOS notification summarizing what it
grabbed. To make it **persist** on screen until you dismiss it (rather than
auto-vanishing after a few seconds), set the notification style to **Alerts**
once: **System Settings → Notifications → Script Editor → Alerts**. (Notifications
are delivered via `osascript`, so they're attributed to Script Editor.)

If you change desks or offices, just run `mtg office learn` again. Requires macOS.

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
- Optional background daemon that auto-books rooms on office days (detected via network)

## License

MIT
