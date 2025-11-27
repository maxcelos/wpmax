// tests/helpers/e2e/cli-runner.js
import { execa } from 'execa';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, '../../../bin/index.js');

/**
 * Run wpmax CLI command for E2E testing
 * @param {string|string[]} args - Command arguments
 * @param {Object} options - Execution options
 * @returns {Promise<Object>} Command result with stdout, stderr, exitCode
 */
export async function runCLI(args, options = {}) {
  const argArray = Array.isArray(args) ? args : args.split(' ');

  try {
    const result = await execa('node', [CLI_PATH, ...argArray], {
      reject: false,
      env: {
        ...process.env,
        ...options.env,
        // Disable TTY for testing
        CI: 'true'
      },
      ...options
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.exitCode,
      failed: result.failed
    };
  } catch (error) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || error.message,
      exitCode: error.exitCode || 1,
      failed: true,
      error
    };
  }
}

/**
 * Run wpmax create command
 * @param {string} siteName - Name of site to create
 * @param {Object} options - Creation options and flags
 * @returns {Promise<Object>} Command result
 */
export async function runCreate(siteName, options = {}) {
  const args = [siteName];

  if (options.yes) args.push('--yes');
  if (options.verbose) args.push('--verbose');
  if (options.docker) args.push('--docker');
  if (options.plugins) {
    options.plugins.forEach(plugin => {
      args.push('--plugin', plugin);
    });
  }

  return runCLI(args, { env: options.env });
}

/**
 * Run wpmax list command
 * @param {Object} options - Command options
 * @returns {Promise<Object>} Command result
 */
export async function runList(options = {}) {
  return runCLI(['list'], { env: options.env });
}

/**
 * Run wpmax info command
 * @param {string} siteName - Name of site
 * @param {Object} options - Command options
 * @returns {Promise<Object>} Command result
 */
export async function runInfo(siteName, options = {}) {
  return runCLI(['info', siteName], { env: options.env });
}

/**
 * Run wpmax delete command
 * @param {string} siteName - Name of site to delete
 * @param {Object} options - Deletion options and flags
 * @returns {Promise<Object>} Command result
 */
export async function runDelete(siteName, options = {}) {
  const args = ['delete', siteName];

  if (options.yes) args.push('--yes');
  if (options.keepDb) args.push('--keep-db');
  if (options.keepFiles) args.push('--keep-files');
  if (options.dryRun) args.push('--dry-run');

  return runCLI(args, { env: options.env });
}

/**
 * Run wpmax config command
 * @param {string} action - Config action (list, set, add, remove)
 * @param {Object} options - Config options
 * @returns {Promise<Object>} Command result
 */
export async function runConfig(action = 'list', options = {}) {
  const args = ['config'];

  if (action === 'set' && options.key && options.value !== undefined) {
    args.push(options.key, options.value);
  } else if (action === 'add' && options.key && options.value) {
    args.push(options.key, options.value, '--add');
  } else if (action === 'remove' && options.key && options.value) {
    args.push(options.key, options.value, '--remove');
  }

  return runCLI(args, { env: options.env });
}

/**
 * Run wpmax doctor command
 * @param {Object} options - Command options
 * @returns {Promise<Object>} Command result
 */
export async function runDoctor(options = {}) {
  return runCLI(['doctor'], { env: options.env });
}

/**
 * Run wpmax update command
 * @param {Object} options - Update options and flags
 * @returns {Promise<Object>} Command result
 */
export async function runUpdate(options = {}) {
  const args = ['update'];

  if (options.check) args.push('--check');
  if (options.yes) args.push('--yes');

  return runCLI(args, { env: options.env });
}

/**
 * Parse CLI output to extract structured data
 * @param {string} output - CLI stdout
 * @returns {Object} Parsed data
 */
export function parseCliOutput(output) {
  const lines = output.split('\n').filter(line => line.trim());

  return {
    lines,
    raw: output,
    hasError: output.toLowerCase().includes('error'),
    hasSuccess: output.toLowerCase().includes('success') || output.toLowerCase().includes('✓'),
    hasWarning: output.toLowerCase().includes('warning'),
    isEmpty: lines.length === 0
  };
}

/**
 * Wait for condition to be true
 * @param {Function} condition - Async function that returns boolean
 * @param {number} timeout - Max time to wait in ms
 * @param {number} interval - Check interval in ms
 * @returns {Promise<boolean>} True if condition met, false if timeout
 */
export async function waitFor(condition, timeout = 5000, interval = 100) {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    if (await condition()) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  return false;
}