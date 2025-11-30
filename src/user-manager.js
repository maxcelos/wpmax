// src/user-manager.js
import { execa } from 'execa';
import { getWpCliCommand } from './wp-cli-manager.js';

/**
 * Check if a WordPress user exists
 * @param {string} username - The username to check
 * @param {string} sitePath - The path to the WordPress site
 * @returns {Promise<boolean>} - True if user exists, false otherwise
 */
export async function userExists(username, sitePath) {
    const [phpCmd, wpCliPath] = getWpCliCommand();

    try {
        await execa(phpCmd, [
            wpCliPath,
            'user', 'get',
            username,
            '--quiet'
        ], { cwd: sitePath });
        return true;
    } catch (error) {
        // If user doesn't exist, WP-CLI returns error
        return false;
    }
}

/**
 * Create a new WordPress user
 * @param {string} username - The username for the new user
 * @param {string} email - The email for the new user
 * @param {string} password - The password for the new user
 * @param {string} sitePath - The path to the WordPress site
 * @param {string} [role='administrator'] - The user role (default: administrator)
 * @returns {Promise<void>}
 */
export async function createUser(username, email, password, sitePath, role = 'administrator') {
    const [phpCmd, wpCliPath] = getWpCliCommand();

    await execa(phpCmd, [
        wpCliPath,
        'user', 'create',
        username,
        email,
        `--user_pass=${password}`,
        `--role=${role}`,
        '--quiet'
    ], { cwd: sitePath });
}

/**
 * Update a WordPress user's password
 * @param {string} username - The username to update
 * @param {string} password - The new password
 * @param {string} sitePath - The path to the WordPress site
 * @returns {Promise<void>}
 */
export async function updateUserPassword(username, password, sitePath) {
    const [phpCmd, wpCliPath] = getWpCliCommand();

    await execa(phpCmd, [
        wpCliPath,
        'user', 'update',
        username,
        `--user_pass=${password}`,
        '--quiet'
    ], { cwd: sitePath });
}