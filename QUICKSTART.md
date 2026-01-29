# Quick Start Guide

Get up and running with Meeting Room Assistant in 5 minutes!

## For End Users

### Step 1: Install

**Supported Platforms:** macOS and Linux

```bash
curl -fsSL https://raw.githubusercontent.com/dvdpearson/mtg/main/install.sh | bash
```

**Or download manually:**
1. Go to [Releases](https://github.com/dvdpearson/mtg/releases)
2. Download the binary for your platform
3. Make it executable: `chmod +x mtg-*`
4. Move to PATH: `mv mtg-* ~/.local/bin/mtg`

### Step 2: Get Google Calendar Credentials

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable **Google Calendar API**
4. Go to **APIs & Services > Credentials**
5. Create Credentials > **OAuth 2.0 Client ID**
6. Choose **"Web application"** (NOT Desktop app)
7. Under "Authorized redirect URIs", add: `http://localhost:3000`
8. Click Create and download credentials JSON file

### Step 3: Setup

```bash
mtg setup
```

When prompted, provide the path to your downloaded credentials file.

### Step 4: Run

```bash
mtg
```

That's it! The tool will:
- Show you meetings without rooms
- Find available rooms for each meeting
- Let you select which ones to update
- Add rooms to your calendar

## For Developers

### Local Development

```bash
# Clone the repo
git clone https://github.com/dvdpearson/mtg.git
cd mtg

# Install dependencies
npm install

# Run directly
node cli.js

# Or use npm script
npm start
```

### Build Binaries

```bash
npm run build
```

Binaries will be in `./dist/`

### Configuration Commands

```bash
# View configuration
mtg config list
mtg config path

# Manage rooms
mtg config rooms
mtg config rooms --add "Room Name,email@resource.calendar.google.com,10"
mtg config rooms --remove "email@resource.calendar.google.com"

# Manage remote workers
mtg config remote-workers
mtg config remote-workers --add "John"
mtg config remote-workers --remove "John"

# Reset configuration
mtg config reset
```

## Configuration File Location

Your configuration is stored at:
- `~/.config/meeting-room-assistant/`

Files:
- `config.json` - Your rooms and remote workers
- `credentials.json` - OAuth credentials (you provide this)
- `token.json` - Auth token (auto-generated)

## Customizing Your Room List

Edit your `config.json` file or use the CLI:

```bash
# Add your company's meeting rooms
mtg config rooms --add "Conference A,c_123abc@resource.calendar.google.com,10"
mtg config rooms --add "Small Room,c_456def@resource.calendar.google.com,4"
```

To find your room emails:
1. Go to Google Calendar
2. Search for your meeting room in the sidebar
3. Click on it and view settings
4. Copy the email address

## Common Issues

**"credentials.json not found"**
- Run `mtg setup` first

**"No meetings found"**
- Make sure you have meetings scheduled in the next 2 weeks
- Check that meetings don't already have rooms
- Ensure meetings have more than 1 attendee

**"No rooms available"**
- All rooms are booked during your meeting times
- Add more rooms to your configuration
- Try different meeting times

**Permission errors on binary**
- Run: `chmod +x mtg-*`

## Need Help?

- Run `mtg --help`
- Check [README-CLI.md](./README-CLI.md)
- View [DEPLOYMENT.md](./DEPLOYMENT.md) for building/distribution
- Open an issue on GitHub

## Tips

1. **Run regularly**: Add to your morning routine to check meetings
2. **Configure remote workers**: Avoid booking rooms for remote-only meetings
3. **Customize rooms**: Keep your room list up to date
4. **Batch updates**: Select multiple meetings at once

---

Happy meeting room booking! 🎉
