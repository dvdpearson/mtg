# mtg

Find meetings without rooms and book them automatically.

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/dvdpearson/mtg/main/scripts/install.sh | bash
```

Requires Node.js 18+.

## Setup

You'll need Google Calendar API credentials:

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project and enable Calendar API
3. Create OAuth credentials (Web application type)
4. Add redirect URI: `http://localhost:3000`
5. Download the credentials JSON

Then run:

```bash
mtg setup
```

## Usage

```bash
mtg
```

The tool will:
- List meetings without rooms
- Find available rooms
- Let you pick which meetings to update
- Book the rooms

## Configuration

Manage rooms and settings:

```bash
mtg config rooms add "Room Name" email@resource.calendar.google.com 8
mtg config rooms list
mtg config remote-workers add user@example.com
```

## License

MIT
