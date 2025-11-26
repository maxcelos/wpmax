import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'wpmax');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

/**
 * Ensure the config directory exists
 */
function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Read the entire config object
 * @returns {Object} Config object with all settings
 */
export function getConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    return {};
  }

  try {
    const data = fs.readFileSync(CONFIG_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading config file:', error.message);
    return {};
  }
}

/**
 * Set a specific config value
 * @param {string} key - Config key (e.g., 'defaultPluginsPath')
 * @param {string} value - Config value (comma-separated for array keys)
 */
export function setConfig(key, value) {
  ensureConfigDir();

  const config = getConfig();

  // Array keys: store as array
  const arrayKeys = ['publicPlugins'];
  if (arrayKeys.includes(key)) {
    config[key] = value.split(',').map(v => v.trim()).filter(v => v);
  } else {
    config[key] = value;
  }

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing config file:', error.message);
    throw error;
  }
}

/**
 * Get a specific config value
 * @param {string} key - Config key
 * @returns {string|undefined} Config value or undefined if not set
 */
export function getConfigValue(key) {
  const config = getConfig();
  return config[key];
}

/**
 * Add a value to an array config key
 * @param {string} key - Config key
 * @param {string} value - Value to add (can be comma-separated list)
 */
export function addToConfig(key, value) {
  ensureConfigDir();

  const config = getConfig();

  // Get existing array or create new one
  let currentValue = config[key] || [];

  // Ensure it's an array
  if (!Array.isArray(currentValue)) {
    currentValue = [];
  }

  // Split comma-separated values and add each
  const newValues = value.split(',').map(v => v.trim()).filter(v => v);

  // Add only unique values
  for (const newValue of newValues) {
    if (!currentValue.includes(newValue)) {
      currentValue.push(newValue);
    }
  }

  config[key] = currentValue;

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing config file:', error.message);
    throw error;
  }
}

/**
 * Remove a value from an array config key
 * @param {string} key - Config key
 * @param {string} value - Value to remove (can be comma-separated list)
 */
export function removeFromConfig(key, value) {
  ensureConfigDir();

  const config = getConfig();

  // Get existing array
  let currentValue = config[key];

  if (!Array.isArray(currentValue)) {
    return; // Nothing to remove
  }

  // Split comma-separated values and remove each
  const removeValues = value.split(',').map(v => v.trim()).filter(v => v);

  config[key] = currentValue.filter(item => !removeValues.includes(item));

  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing config file:', error.message);
    throw error;
  }
}

/**
 * Ensures default configuration values are set on the first run
 * @returns {void}
 */
export function ensureDefaultConfig() {
  const config = getConfig();
  let modified = false;

  // Set default public plugins if not configured
  if (!config.publicPlugins) {
    config.publicPlugins = [];
    modified = true;
  }

  // Save config if modified
  if (modified) {
    ensureConfigDir();
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
    } catch (error) {
      console.error('Error writing config file:', error.message);
    }
  }
}