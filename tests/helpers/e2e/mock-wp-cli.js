// tests/helpers/e2e/mock-wp-cli.js
import { vi } from 'vitest';

/**
 * Create comprehensive WP-CLI command responses for E2E testing
 * @returns {Object} Map of WP-CLI commands to their mock responses
 */
export function createWpCliMockResponses() {
  return {
    // Core download
    'php /path/to/wp-cli.phar core download --quiet': {
      stdout: '',
      stderr: '',
      exitCode: 0
    },

    // Config create
    '*config create*': {
      stdout: 'Success: Generated wp-config.php file.',
      stderr: '',
      exitCode: 0
    },

    // Core install
    '*core install*': {
      stdout: 'Success: WordPress installed successfully.',
      stderr: '',
      exitCode: 0
    },

    // Plugin install - public
    '*plugin install*woocommerce*': {
      stdout: 'Success: Plugin installed successfully.',
      stderr: '',
      exitCode: 0
    },

    '*plugin install*yoast-seo*': {
      stdout: 'Success: Plugin installed successfully.',
      stderr: '',
      exitCode: 0
    },

    // Plugin activate
    '*plugin activate*': {
      stdout: 'Success: Plugin activated.',
      stderr: '',
      exitCode: 0
    },

    // Plugin list
    '*plugin list*': {
      stdout: JSON.stringify([
        { name: 'woocommerce', status: 'active', version: '8.0.0' },
        { name: 'yoast-seo', status: 'active', version: '21.0.0' }
      ]),
      stderr: '',
      exitCode: 0
    },

    // Theme list
    '*theme list*': {
      stdout: JSON.stringify([
        { name: 'twentytwentyfour', status: 'active', version: '1.0' }
      ]),
      stderr: '',
      exitCode: 0
    },

    // Core version
    '*core version*': {
      stdout: '6.4.2',
      stderr: '',
      exitCode: 0
    },

    // DB info
    '*db size*': {
      stdout: '2.5 MB',
      stderr: '',
      exitCode: 0
    },

    // Option get (siteurl)
    '*option get siteurl*': {
      stdout: 'https://test-site.test',
      stderr: '',
      exitCode: 0
    },

    // Option get (admin_email)
    '*option get admin_email*': {
      stdout: 'admin@test.com',
      stderr: '',
      exitCode: 0
    },

    // Database drop
    '*db drop*': {
      stdout: 'Success: Database dropped.',
      stderr: '',
      exitCode: 0
    },

    // Database reset
    '*db reset*': {
      stdout: 'Success: Database reset.',
      stderr: '',
      exitCode: 0
    },

    // Eval PHP version
    '*eval*phpversion*': {
      stdout: '8.2.0',
      stderr: '',
      exitCode: 0
    },

    // Default catch-all for other WP-CLI commands
    '*wp-cli.phar*': {
      stdout: '',
      stderr: '',
      exitCode: 0
    }
  };
}

/**
 * Create mock responses for WP-CLI errors
 * @returns {Object} Error response mappings
 */
export function createWpCliErrorResponses() {
  return {
    // Core download failure
    'download-error': {
      stdout: '',
      stderr: 'Error: Failed to download WordPress.',
      exitCode: 1
    },

    // Database connection failure
    'db-connection-error': {
      stdout: '',
      stderr: 'Error: Could not connect to database.',
      exitCode: 1
    },

    // Installation failure
    'install-error': {
      stdout: '',
      stderr: 'Error: WordPress installation failed.',
      exitCode: 1
    },

    // Plugin not found
    'plugin-not-found': {
      stdout: '',
      stderr: 'Error: Plugin not found.',
      exitCode: 1
    },

    // Permission denied
    'permission-denied': {
      stdout: '',
      stderr: 'Error: Permission denied.',
      exitCode: 1
    },

    // WP-CLI not available
    'wp-cli-not-found': {
      stdout: '',
      stderr: 'Error: WP-CLI could not be found.',
      exitCode: 127
    }
  };
}

/**
 * Create mock for ensureWpCli function
 * @param {boolean} shouldSucceed - Whether WP-CLI should be available
 * @returns {Function} Mock function
 */
export function createEnsureWpCliMock(shouldSucceed = true) {
  return vi.fn(async () => {
    if (!shouldSucceed) {
      throw new Error('WP-CLI could not be downloaded or found');
    }
    return '/path/to/wp-cli.phar';
  });
}

/**
 * Create mock for MySQL detection
 * @param {string|null} connection - MySQL connection string or null if unavailable
 * @returns {Function} Mock function
 */
export function createMySQLMock(connection = '127.0.0.1') {
  return vi.fn(async () => {
    if (!connection) {
      throw new Error('MySQL connection not available');
    }
    return connection;
  });
}

/**
 * Create mock for Herd detection
 * @param {boolean} installed - Whether Herd is installed
 * @returns {Object} Mock functions for Herd operations
 */
export function createHerdMocks(installed = false) {
  return {
    isHerdInstalled: vi.fn(async () => installed),
    herdLink: vi.fn(async () => {
      if (!installed) {
        throw new Error('Herd is not installed');
      }
      return { stdout: 'Site linked successfully', exitCode: 0 };
    }),
    herdSecure: vi.fn(async () => {
      if (!installed) {
        throw new Error('Herd is not installed');
      }
      return { stdout: 'Site secured successfully', exitCode: 0 };
    })
  };
}

/**
 * Setup complete E2E mocking environment
 * @param {Object} options - Mock configuration options
 * @returns {Object} All mock functions and cleanup
 */
export function setupE2EMocks(options = {}) {
  const {
    wpCliAvailable = true,
    mysqlConnection = '127.0.0.1',
    herdInstalled = false,
    customResponses = {}
  } = options;

  const wpCliResponses = {
    ...createWpCliMockResponses(),
    ...customResponses
  };

  const mocks = {
    ensureWpCli: createEnsureWpCliMock(wpCliAvailable),
    getMySQLConnection: createMySQLMock(mysqlConnection),
    ...createHerdMocks(herdInstalled),
    wpCliResponses
  };

  return {
    mocks,
    cleanup: () => {
      vi.restoreAllMocks();
    }
  };
}