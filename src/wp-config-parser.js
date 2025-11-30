// src/wp-config-parser.js
import fs from 'fs';
import path from 'path';

/**
 * Extract database configuration from wp-config.php
 * @param {string} wpConfigPath - Path to wp-config.php file
 * @returns {Object} Database configuration
 */
export function parseWpConfig(wpConfigPath) {
    if (!fs.existsSync(wpConfigPath)) {
        throw new Error('wp-config.php not found');
    }

    const content = fs.readFileSync(wpConfigPath, 'utf8');

    // Extract database name
    const dbNameMatch = content.match(/define\s*\(\s*['"]DB_NAME['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
    const dbName = dbNameMatch ? dbNameMatch[1] : null;

    // Extract database user
    const dbUserMatch = content.match(/define\s*\(\s*['"]DB_USER['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
    const dbUser = dbUserMatch ? dbUserMatch[1] : null;

    // Extract database host
    const dbHostMatch = content.match(/define\s*\(\s*['"]DB_HOST['"]\s*,\s*['"]([^'"]+)['"]\s*\)/);
    const dbHost = dbHostMatch ? dbHostMatch[1] : null;

    // Extract table prefix
    const tablePrefixMatch = content.match(/\$table_prefix\s*=\s*['"]([^'"]+)['"]/);
    const tablePrefix = tablePrefixMatch ? tablePrefixMatch[1] : 'wp_';

    return {
        dbName,
        dbUser,
        dbHost,
        tablePrefix
    };
}

/**
 * Get site URL and admin info from WordPress database using WP-CLI
 * @param {string} sitePath - Path to WordPress installation
 * @returns {Promise<Object>} Site information from database
 */
export async function getWpSiteInfo(sitePath) {
    const { execa } = await import('execa');
    const { getWpCliCommand } = await import('./wp-cli-manager.js');

    const [phpCmd, wpCliPath] = getWpCliCommand();

    try {
        // Get site URL
        const { stdout: url } = await execa(phpCmd, [
            wpCliPath,
            'option', 'get', 'siteurl',
            '--quiet'
        ], { cwd: sitePath });

        // Get admin user (get first administrator user)
        const { stdout: adminUser } = await execa(phpCmd, [
            wpCliPath,
            'user', 'list',
            '--role=administrator',
            '--field=user_login',
            '--format=csv',
            '--quiet'
        ], { cwd: sitePath });

        const firstAdmin = adminUser.split('\n')[0] || 'admin';

        // Get admin email
        const { stdout: adminEmail } = await execa(phpCmd, [
            wpCliPath,
            'user', 'get', firstAdmin,
            '--field=user_email',
            '--quiet'
        ], { cwd: sitePath });

        return {
            url: url.replace(/^https?:\/\//, ''),
            adminUser: firstAdmin,
            adminEmail: adminEmail.trim()
        };
    } catch (error) {
        // If WP-CLI commands fail, return defaults
        return {
            url: null,
            adminUser: null,
            adminEmail: null
        };
    }
}