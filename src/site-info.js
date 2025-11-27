// src/site-info.js
import { execa } from 'execa';
import fs from 'fs';
import { getWpCliCommand } from './wp-cli-manager.js';
import { getSite } from './site-registry.js';

/**
 * Get directory size in human-readable format
 */
async function getDirectorySize(dirPath) {
    try {
        const { stdout } = await execa('du', ['-sh', dirPath]);
        return stdout.split('\t')[0];
    } catch (error) {
        return 'Unknown';
    }
}

/**
 * Get WordPress version
 */
async function getWordPressVersion(sitePath) {
    try {
        const [phpCmd, wpCliPath] = getWpCliCommand();
        const { stdout } = await execa(phpCmd, [wpCliPath, 'core', 'version'], { cwd: sitePath });
        return stdout.trim();
    } catch (error) {
        return 'Unknown';
    }
}

/**
 * Get active plugins
 */
async function getActivePlugins(sitePath) {
    try {
        const [phpCmd, wpCliPath] = getWpCliCommand();
        const { stdout } = await execa(phpCmd, [wpCliPath, 'plugin', 'list', '--status=active', '--field=name', '--quiet'], { cwd: sitePath });
        return stdout.trim().split('\n').filter(p => p);
    } catch (error) {
        return [];
    }
}

/**
 * Get active theme
 */
async function getActiveTheme(sitePath) {
    try {
        const [phpCmd, wpCliPath] = getWpCliCommand();
        const { stdout } = await execa(phpCmd, [wpCliPath, 'theme', 'list', '--status=active', '--field=name', '--quiet'], { cwd: sitePath });
        return stdout.trim();
    } catch (error) {
        return 'Unknown';
    }
}

/**
 * Get database information
 */
async function getDatabaseInfo(sitePath) {
    try {
        const [phpCmd, wpCliPath] = getWpCliCommand();

        // Get table count
        const { stdout: tables } = await execa(phpCmd, [wpCliPath, 'db', 'query', 'SHOW TABLES', '--skip-column-names', '--quiet'], { cwd: sitePath });
        const tableCount = tables.trim().split('\n').filter(t => t).length;

        // Get database size
        const { stdout: size } = await execa(phpCmd, [wpCliPath, 'db', 'size', '--human-readable', '--quiet'], { cwd: sitePath });

        return {
            tableCount,
            size: size.trim()
        };
    } catch (error) {
        return {
            tableCount: 0,
            size: 'Unknown'
        };
    }
}

/**
 * Get PHP version from the site
 */
async function getPhpVersion(sitePath) {
    try {
        const [phpCmd, wpCliPath] = getWpCliCommand();
        const { stdout } = await execa(phpCmd, [wpCliPath, 'cli', 'info', '--format=json', '--quiet'], { cwd: sitePath });
        const info = JSON.parse(stdout);
        return info.php_version || 'Unknown';
    } catch (error) {
        // Fallback to system PHP version
        try {
            const { stdout } = await execa('php', ['--version']);
            const match = stdout.match(/PHP (\d+\.\d+\.\d+)/);
            return match ? match[1] : 'Unknown';
        } catch {
            return 'Unknown';
        }
    }
}

/**
 * Get comprehensive site information
 */
export async function getFullSiteInfo(siteName) {
    // Get registry data
    const site = getSite(siteName);
    if (!site) {
        return null;
    }

    // Check if directory exists
    const exists = fs.existsSync(site.path);
    if (!exists) {
        return {
            ...site,
            exists: false
        };
    }

    // Get live data
    const [directorySize, wpVersion, plugins, theme, dbInfo, phpVersion] = await Promise.all([
        getDirectorySize(site.path),
        getWordPressVersion(site.path),
        getActivePlugins(site.path),
        getActiveTheme(site.path),
        getDatabaseInfo(site.path),
        getPhpVersion(site.path)
    ]);

    return {
        ...site,
        exists: true,
        directorySize,
        wpVersion,
        plugins,
        theme,
        dbInfo,
        phpVersion
    };
}

/**
 * Get basic site information (without WP-CLI queries)
 */
export async function getBasicSiteInfo(siteName) {
    const site = getSite(siteName);
    if (!site) {
        return null;
    }

    const exists = fs.existsSync(site.path);
    const directorySize = exists ? await getDirectorySize(site.path) : 'N/A';

    return {
        ...site,
        exists,
        directorySize
    };
}