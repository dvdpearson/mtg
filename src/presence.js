import { execSync } from 'child_process';
import { loadConfig, saveConfig } from './config.js';

// Run a shell command, returning stdout or null on any failure.
function tryExec(command) {
  try {
    return execSync(command, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

// The primary default-route interface (e.g. "en0"), or null.
function getDefaultInterface() {
  const out = tryExec('route -n get default');
  if (!out) return null;
  const match = out.match(/interface:\s*(\S+)/);
  return match ? match[1] : null;
}

// The default gateway IP, or null.
function getGateway() {
  const out = tryExec('route -n get default');
  if (!out) return null;
  const match = out.match(/gateway:\s*(\S+)/);
  return match ? match[1] : null;
}

// Wi-Fi SSID via networksetup. Location Services gates this on modern macOS,
// so treat it as best-effort: null when unavailable rather than an error.
function getSSID(iface) {
  if (!iface) return null;
  const out = tryExec(`networksetup -getairportnetwork ${iface}`);
  if (!out) return null;
  const match = out.match(/Current Wi-Fi Network:\s*(.+)/);
  return match ? match[1].trim() : null;
}

// Subnet mask, DNS servers, and DHCP domain from the DHCP lease. These need
// no special permission, which is why they anchor the fingerprint.
function getDhcpDetails(iface) {
  const details = { subnet: null, dns: [], domain: null };
  if (!iface) return details;

  const out = tryExec(`ipconfig getpacket ${iface}`);
  if (!out) return details;

  const subnet = out.match(/subnet_mask \(ip\):\s*(\S+)/);
  if (subnet) details.subnet = subnet[1];

  const dns = out.match(/domain_name_server \(ip_mult\):\s*\{([^}]*)\}/);
  if (dns) {
    details.dns = dns[1].split(',').map(s => s.trim()).filter(Boolean).sort();
  }

  const domain = out.match(/domain_name \(string\):\s*(\S+)/);
  if (domain) details.domain = domain[1];

  return details;
}

// Snapshot of the network we're currently on.
export function getNetworkFingerprint() {
  const iface = getDefaultInterface();
  const gateway = getGateway();
  const { subnet, dns, domain } = getDhcpDetails(iface);
  const ssid = getSSID(iface);
  return { iface, gateway, subnet, dns, domain, ssid };
}

// A network is usable as an office anchor only if we can read a gateway.
export function isNetworkIdentifiable(fp) {
  return Boolean(fp && fp.gateway);
}

// Does the current network match the learned office?
// Primary anchor: gateway + subnet (stable across floors/APs on one LAN).
// SSID is a secondary match so multi-subnet offices on one Wi-Fi still count.
export function matchesOffice(current, office) {
  if (!current || !office) return false;

  const gatewayMatch =
    Boolean(current.gateway) &&
    current.gateway === office.gateway &&
    current.subnet === office.subnet;

  const ssidMatch =
    Boolean(current.ssid) &&
    Boolean(office.ssid) &&
    current.ssid === office.ssid;

  return gatewayMatch || ssidMatch;
}

// --- Config persistence -----------------------------------------------------

export function getOfficeFingerprint() {
  const config = loadConfig();
  return config.office || null;
}

export function saveOfficeFingerprint(fp) {
  const config = loadConfig();
  config.office = {
    gateway: fp.gateway,
    subnet: fp.subnet,
    dns: fp.dns,
    domain: fp.domain,
    ssid: fp.ssid || null
  };
  saveConfig(config);
  return config.office;
}

export function isAtOffice() {
  const office = getOfficeFingerprint();
  if (!office) return false;
  return matchesOffice(getNetworkFingerprint(), office);
}

// Human-readable one-liner for `office status`.
export function describeNetwork(fp) {
  if (!fp || !fp.gateway) return 'no network detected';
  const parts = [`gateway ${fp.gateway}`];
  if (fp.subnet) parts.push(`subnet ${fp.subnet}`);
  if (fp.ssid) parts.push(`Wi-Fi "${fp.ssid}"`);
  if (fp.domain) parts.push(`domain ${fp.domain}`);
  return parts.join(', ');
}
