import fs from 'fs';
import path from 'path';
import os from 'os';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { ensureConfigDir } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LABEL = 'com.mtg.daemon';
const INTERVAL_SECONDS = 300; // re-check presence every 5 minutes

function getPlistPath() {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', `${LABEL}.plist`);
}

function getLogPath() {
  return path.join(ensureConfigDir(), 'daemon.log');
}

// Absolute path to this package's CLI entry point.
function getCliPath() {
  return path.join(__dirname, 'cli.js');
}

function buildPlist() {
  const node = process.execPath;
  const cli = getCliPath();
  const log = getLogPath();
  // launchd hands processes a minimal PATH; presence detection shells out to
  // route/ipconfig/networksetup (/sbin, /usr/sbin) and notifications use
  // osascript (/usr/bin).
  const pathEnv = '/usr/bin:/bin:/usr/sbin:/sbin';

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${node}</string>
    <string>${cli}</string>
    <string>daemon</string>
    <string>run</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${pathEnv}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>StartInterval</key>
  <integer>${INTERVAL_SECONDS}</integer>
  <key>StandardOutPath</key>
  <string>${log}</string>
  <key>StandardErrorPath</key>
  <string>${log}</string>
</dict>
</plist>
`;
}

function launchctl(args) {
  try {
    execFileSync('launchctl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

export function installDaemon() {
  if (process.platform !== 'darwin') {
    return { success: false, message: 'The daemon is only supported on macOS.' };
  }

  const plistPath = getPlistPath();
  fs.mkdirSync(path.dirname(plistPath), { recursive: true });
  fs.writeFileSync(plistPath, buildPlist());

  // Reload cleanly if it was already installed.
  launchctl(['unload', '-w', plistPath]);
  const loaded = launchctl(['load', '-w', plistPath]);

  if (!loaded) {
    return { success: false, message: `Wrote ${plistPath} but launchctl load failed.` };
  }
  return { success: true, message: `Daemon installed and running (checks every ${INTERVAL_SECONDS / 60} min).`, plistPath };
}

export function uninstallDaemon() {
  const plistPath = getPlistPath();
  if (!fs.existsSync(plistPath)) {
    return { success: false, message: 'Daemon is not installed.' };
  }
  launchctl(['unload', '-w', plistPath]);
  fs.unlinkSync(plistPath);
  return { success: true, message: 'Daemon uninstalled.' };
}

export function isDaemonInstalled() {
  return fs.existsSync(getPlistPath());
}

export { getLogPath, getPlistPath };
