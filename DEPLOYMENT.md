# Deployment Guide

This guide explains how to build, package, and deploy the Meeting Room Assistant CLI tool.

## Building from Source

### Prerequisites

- Node.js 18 or higher
- npm

### Installation

```bash
npm install
```

### Running in Development

```bash
node cli.js
# or
npm start
```

### Testing Commands

```bash
# Test help
node cli.js --help

# Test config
node cli.js config path
node cli.js config rooms

# Test setup
node cli.js setup
```

## Building Binaries

### Option 1: Using pkg (Recommended for distribution)

Build for all platforms:
```bash
npm run build
```

This creates binaries in `./dist/`:
- `mtg-macos-x64` - macOS Intel
- `mtg-linux-x64` - Linux x64

Build for specific platform:
```bash
npm run build:macos
npm run build:linux
```

### Option 2: Using npm global install (For personal use)

Install globally on your machine:
```bash
npm install -g .
```

This creates a `mtg` command available globally.

To uninstall:
```bash
npm uninstall -g meeting-room-assistant
```

## Known Issues with pkg and ES Modules

The current version uses ES modules (`"type": "module"` in package.json). When using `pkg` to create standalone binaries, you may encounter warnings about ES modules. The binaries will still work, but if you encounter issues:

### Workaround 1: Use npm link instead

```bash
npm link
```

This creates a symlink to the CLI in your global node_modules, allowing you to run `mtg` from anywhere while still using Node.js to execute the script.

### Workaround 2: Convert to CommonJS

If you need fully working standalone binaries, you can convert the code to CommonJS:

1. Remove `"type": "module"` from package.json
2. Change `import` statements to `require()`
3. Change `export` statements to `module.exports`
4. Update file extensions if needed

## GitHub Actions CI/CD

The repository includes a GitHub Actions workflow (`.github/workflows/release.yml`) that automatically:

1. Builds binaries for all platforms when you push a git tag
2. Creates a GitHub release
3. Uploads the binaries as release assets

### Creating a Release

```bash
# Commit your changes
git add .
git commit -m "Release v1.0.0"

# Create and push a version tag
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions will automatically build and create a release.

## Publishing to npm (Optional)

If you want to publish to npm for easy installation via `npm install -g meeting-room-assistant`:

1. Create an npm account at https://www.npmjs.com
2. Login to npm:
   ```bash
   npm login
   ```
3. Update package.json with your information:
   - Set a unique name (check npm for availability)
   - Add your repository URL
   - Add author information
4. Publish:
   ```bash
   npm publish
   ```

Users can then install with:
```bash
npm install -g meeting-room-assistant
```

## Distribution Options

### Option 1: GitHub Releases (Recommended)

1. Push your code to GitHub
2. Create releases using tags (see above)
3. Users download binaries from releases page
4. Update `install.sh` with your GitHub username/repo
5. Users install with:
   ```bash
   curl -fsSL https://raw.githubusercontent.com/dvdpearson/mtg/main/install.sh | bash
   ```

### Option 2: npm Global Package

Publish to npm and users install with:
```bash
npm install -g meeting-room-assistant
```

### Option 3: Direct Binary Distribution

1. Build binaries locally
2. Host them on your own server
3. Update install.sh with your URLs
4. Users download and install manually

### Option 4: Homebrew (macOS)

Create a Homebrew formula for easy macOS installation:

```ruby
class MeetingRoomAssistant < Formula
  desc "Automatically add meeting rooms to Google Calendar events"
  homepage "https://github.com/dvdpearson/mtg"
  url "https://github.com/dvdpearson/mtg/releases/download/v1.0.0/mtg-macos-x64"
  sha256 "YOUR_BINARY_SHA256"
  version "1.0.0"

  def install
    bin.install "mtg-macos-x64" => "mtg"
  end

  test do
    system "#{bin}/mtg", "--version"
  end
end
```

## Configuration for Distribution

Before distributing, verify these files are configured correctly:

1. **install.sh**: Check that GitHub repo URL is correct
2. **README-CLI.md**: Verify all URLs point to the right repository
3. **package.json**: Add author, keywords, and other metadata as needed
4. **.github/workflows/release.yml**: Verify it matches your needs

## Security Notes

- Never commit `credentials.json` or `token.json` to the repository
- Add them to `.gitignore` (already done)
- Users will set up their own OAuth credentials
- Credentials are stored locally in `~/.config/meeting-room-assistant/`

## Support

For issues:
- Check the troubleshooting section in README-CLI.md
- Review GitHub issues
- Create a new issue if needed
