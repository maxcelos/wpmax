// src/mysql-detector.js
import fs from 'fs';
import { execa } from 'execa';

/**
 * Common MySQL socket locations across different installations
 */
const COMMON_SOCKET_PATHS = [
    '/tmp/mysql_3306.sock',           // Laravel Herd
    '/tmp/mysql.sock',                 // Homebrew MySQL
    '/var/run/mysqld/mysqld.sock',    // Standard Linux
    '/Applications/MAMP/tmp/mysql/mysql.sock', // MAMP
    '/opt/homebrew/var/mysql/mysql.sock', // Homebrew on Apple Silicon
    '/usr/local/var/mysql/mysql.sock',     // Homebrew on Intel
];

/**
 * TCP/IP connection options to try (prioritized - simpler and more universal)
 */
const TCP_OPTIONS = [
    '127.0.0.1',      // Most reliable - numeric IP
    'localhost',      // Common alias for 127.0.0.1
];

/**
 * Tests if a MySQL connection works using a simple query
 * @param {string} socketPath - Socket path (for socket connections)
 * @param {string} host - Host (for TCP connections)
 * @param {string} user - MySQL username
 * @returns {Promise<boolean>}
 */
async function testMysqlConnection(socketPath = null, host = null, user = 'root') {
    try {
        const args = [];

        if (socketPath) {
            // Socket connection: use --socket flag
            args.push(`--socket=${socketPath}`);
        } else if (host) {
            // TCP connection: use -h flag
            args.push(`-h${host}`);
        }

        args.push(`-u${user}`, '-e', 'SELECT 1', '--silent');

        await execa('mysql', args);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Detects the MySQL connection string by trying common locations
 * @param {string} user - MySQL username (default: 'root')
 * @returns {Promise<string>} - The working MySQL host string
 * @throws {Error} - If no working connection is found
 */
export async function detectMySQLConnection(user = 'root') {
    // First, check if mysql command is available
    try {
        await execa('mysql', ['--version']);
    } catch (error) {
        throw new Error('MySQL client is not installed or not in PATH. Please install MySQL.');
    }

    // 1. Try TCP/IP connections first (simpler and more universal)
    for (const host of TCP_OPTIONS) {
        if (await testMysqlConnection(null, host, user)) {
            // Return just the host (WP-CLI will use default port 3306)
            return host;
        }
    }

    // 2. Fall back to socket paths if TCP doesn't work
    for (const socketPath of COMMON_SOCKET_PATHS) {
        if (fs.existsSync(socketPath)) {
            if (await testMysqlConnection(socketPath, null, user)) {
                // Return in WP-CLI format: localhost:/path/to/socket
                return `localhost:${socketPath}`;
            }
        }
    }

    // 3. If nothing worked, throw an error with helpful info
    throw new Error(
        'Could not detect MySQL connection. Please ensure MySQL is running.\n' +
        '\nTCP/IP connections tried:\n' +
        TCP_OPTIONS.map(h => `  - ${h}`).join('\n') +
        '\n\nSocket locations checked:\n' +
        COMMON_SOCKET_PATHS.map(p => `  - ${p}`).join('\n')
    );
}

/**
 * Cached connection strings to avoid repeated detection (keyed by user)
 */
const connectionCache = {};

/**
 * Gets the MySQL connection string, using cache if available
 * @param {string} user - MySQL username (default: 'root')
 * @returns {Promise<string>}
 */
export async function getMySQLConnection(user = 'root') {
    if (!connectionCache[user]) {
        connectionCache[user] = await detectMySQLConnection(user);
    }
    return connectionCache[user];
}