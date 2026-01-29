import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get the config directory
export function getConfigDir() {
  // Use XDG_CONFIG_HOME if set, otherwise use ~/.config
  const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
  return path.join(configHome, 'meeting-room-assistant');
}

// Ensure config directory exists
export function ensureConfigDir() {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Get config file path
export function getConfigPath() {
  return path.join(ensureConfigDir(), 'config.json');
}

// Get credentials path
export function getCredentialsPath() {
  return path.join(ensureConfigDir(), 'credentials.json');
}

// Get token path
export function getTokenPath() {
  return path.join(ensureConfigDir(), 'token.json');
}

// Default configuration - customize these for your organization
const DEFAULT_CONFIG = {
  rooms: [
    {
      name: 'Conference Room A',
      email: 'c_123abc@resource.calendar.google.com',
      capacity: 8
    },
    {
      name: 'Conference Room B',
      email: 'c_456def@resource.calendar.google.com',
      capacity: 12
    },
    {
      name: 'Small Meeting Room',
      email: 'c_789ghi@resource.calendar.google.com',
      capacity: 4
    }
  ],
  remoteWorkers: []
};

// Load configuration
export function loadConfig() {
  const configPath = getConfigPath();

  // If config doesn't exist, create it with defaults
  if (!fs.existsSync(configPath)) {
    saveConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error loading config:', error.message);
    return DEFAULT_CONFIG;
  }
}

// Save configuration
export function saveConfig(config) {
  const configPath = getConfigPath();
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving config:', error.message);
    return false;
  }
}

// Get specific config value
export function getConfigValue(key) {
  const config = loadConfig();
  return config[key];
}

// Set specific config value
export function setConfigValue(key, value) {
  const config = loadConfig();
  config[key] = value;
  return saveConfig(config);
}

// Add a room to configuration
export function addRoom(name, email, capacity) {
  const config = loadConfig();
  if (!config.rooms) {
    config.rooms = [];
  }

  // Check if room already exists
  const exists = config.rooms.some(r => r.email === email);
  if (exists) {
    return { success: false, message: 'Room already exists' };
  }

  config.rooms.push({ name, email, capacity: parseInt(capacity) });
  saveConfig(config);
  return { success: true, message: 'Room added successfully' };
}

// Remove a room from configuration
export function removeRoom(email) {
  const config = loadConfig();
  const initialLength = config.rooms.length;
  config.rooms = config.rooms.filter(r => r.email !== email);

  if (config.rooms.length === initialLength) {
    return { success: false, message: 'Room not found' };
  }

  saveConfig(config);
  return { success: true, message: 'Room removed successfully' };
}

// List all rooms
export function listRooms() {
  const config = loadConfig();
  return config.rooms || [];
}

// Add remote worker
export function addRemoteWorker(name) {
  const config = loadConfig();
  if (!config.remoteWorkers) {
    config.remoteWorkers = [];
  }

  const normalized = name.toLowerCase();
  if (config.remoteWorkers.includes(normalized)) {
    return { success: false, message: 'Remote worker already exists' };
  }

  config.remoteWorkers.push(normalized);
  saveConfig(config);
  return { success: true, message: 'Remote worker added successfully' };
}

// Remove remote worker
export function removeRemoteWorker(name) {
  const config = loadConfig();
  const normalized = name.toLowerCase();
  const initialLength = config.remoteWorkers.length;
  config.remoteWorkers = config.remoteWorkers.filter(w => w !== normalized);

  if (config.remoteWorkers.length === initialLength) {
    return { success: false, message: 'Remote worker not found' };
  }

  saveConfig(config);
  return { success: true, message: 'Remote worker removed successfully' };
}

// List remote workers
export function listRemoteWorkers() {
  const config = loadConfig();
  return config.remoteWorkers || [];
}

// Reset configuration to defaults
export function resetConfig() {
  saveConfig(DEFAULT_CONFIG);
  return { success: true, message: 'Configuration reset to defaults' };
}
