# Meeting Room Assistant

> Automatically add meeting rooms to your Google Calendar events via an interactive CLI

```
     ██╗ █████╗ ███╗   ██╗██╗   ██╗ █████╗ ██████╗ ██╗   ██╗
     ██║██╔══██╗████╗  ██║██║   ██║██╔══██╗██╔══██╗╚██╗ ██╔╝
     ██║███████║██╔██╗ ██║██║   ██║███████║██████╔╝ ╚████╔╝
██   ██║██╔══██║██║╚██╗██║██║   ██║██╔══██║██╔══██╗  ╚██╔╝
╚█████╔╝██║  ██║██║ ╚████║╚██████╔╝██║  ██║██║  ██║   ██║
 ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝
```

## Features

- 🎨 **Beautiful Interactive UI** - Colored output, tables, and checkbox menus
- ⚡ **Fast & Smart** - Automatically finds the best available room for your meetings
- 📊 **Intelligent Matching** - Considers room capacity and availability
- 🔄 **Batch Processing** - Update multiple meetings at once
- ⚙️  **Fully Configurable** - Customize rooms and remote workers via CLI
- 🔐 **Secure** - Uses Google OAuth 2.0, credentials stored locally
- 🚀 **Easy Install** - One-line installation with cURL

## Quick Install

```bash
curl -fsSL https://raw.githubusercontent.com/dvdpearson/mtg/main/install.sh | bash
```

**Note:** This tool supports macOS and Linux only.

### Manual Install

Download the binary for your platform from the [releases page](https://github.com/dvdpearson/mtg/releases) and place it in your PATH.

## Setup

After installation, run the setup wizard:

```bash
mtg setup
```

This will guide you through:
1. Setting up Google Calendar API credentials
2. Configuring OAuth authentication

### Getting Google Calendar Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Calendar API**
4. Create **OAuth 2.0 credentials** (choose "Desktop app")
5. Download the credentials JSON file
6. Run `mtg setup` and provide the path to the file

## Usage

### Run the Interactive Assistant

```bash
mtg
```

or

```bash
mtg run
```

This will:
1. Fetch your upcoming meetings (next 2 weeks)
2. Filter meetings without rooms
3. Check room availability
4. Let you interactively select which meetings to update
5. Add the best available room to each selected meeting

### Configuration Commands

#### View all configuration

```bash
mtg config list
```

#### View configuration file paths

```bash
mtg config path
```

#### Manage Meeting Rooms

List all rooms:
```bash
mtg config rooms
```

Add a room:
```bash
mtg config rooms --add "Conference Room,c_room123@resource.calendar.google.com,10"
```

Remove a room:
```bash
mtg config rooms --remove "c_room123@resource.calendar.google.com"
```

#### Manage Remote Workers

List remote workers (meetings with only remote workers are skipped):
```bash
mtg config remote-workers
```

Add a remote worker:
```bash
mtg config remote-workers --add "John"
```

Remove a remote worker:
```bash
mtg config remote-workers --remove "John"
```

#### Reset Configuration

Reset to default configuration:
```bash
mtg config reset
```

## Configuration

Configuration is stored in:
- `~/.config/meeting-room-assistant/`

Files:
- `config.json` - Room and remote worker settings
- `credentials.json` - Google OAuth credentials
- `token.json` - Stored authentication token (auto-generated)

### Example config.json

```json
{
  "rooms": [
    {
      "name": "Conference Room A",
      "email": "c_123abc@resource.calendar.google.com",
      "capacity": 10
    },
    {
      "name": "Small Meeting Room",
      "email": "c_456def@resource.calendar.google.com",
      "capacity": 4
    }
  ],
  "remoteWorkers": ["john", "jane", "bob"]
}
```

## How It Works

1. **Fetches Meetings**: Gets your upcoming meetings for the next 2 weeks
2. **Filters**: Removes meetings that:
   - Already have rooms
   - Are solo meetings (only you)
   - Are with only remote workers
3. **Checks Availability**: Queries Google Calendar's FreeBusy API to find available rooms
4. **Smart Matching**:
   - Finds rooms that fit the number of attendees
   - Selects the smallest room that fits (efficient use of space)
   - Falls back to any available room if no perfect match
5. **Interactive Selection**: Shows you all options with a beautiful checkbox interface
6. **Updates Calendar**: Adds selected rooms to meetings (no notifications sent to attendees)

## Building from Source

### Prerequisites

- Node.js 18+
- npm

### Install Dependencies

```bash
npm install
```

### Run in Development

```bash
npm start
```

### Build Binaries

Build for all platforms:
```bash
npm run build
```

This creates binaries in `./dist/`:
- `mtg-macos-x64` - macOS Intel
- `mtg-linux-x64` - Linux x64

## Troubleshooting

### "credentials.json not found"

Run `mtg setup` to configure your Google Calendar credentials.

### Authentication Issues

Delete the token file and re-authenticate:
```bash
rm ~/.config/meeting-room-assistant/token.json
mtg
```

### "No rooms available"

All configured rooms are busy during your meeting times. You can:
- Add more rooms to your configuration
- Manually book a different time

### Permission Errors

Make sure the binary is executable:
```bash
chmod +x ~/.local/bin/mtg
```

## Privacy & Security

- All credentials and tokens are stored locally on your machine
- No data is sent to any third-party servers (except Google Calendar API)
- OAuth tokens are stored in your home directory with restricted permissions
- Calendar updates are made with `sendUpdates: 'none'` so attendees don't receive notifications

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

If you encounter any issues or have questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Read the troubleshooting section above

## Roadmap

- [ ] Support for recurring meetings
- [ ] Configurable date ranges
- [ ] Email notifications
- [ ] Calendar event creation
- [ ] Team calendars support
- [ ] Web interface
- [ ] Slack integration

---

Made with ❤️ for busy people who forget to book meeting rooms
