// src/wp-cli-manager.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { execa } from 'execa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WP_CLI_URL = 'https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar';
const WP_CLI_PATH = path.join(__dirname, '../bin/wp-cli.phar');

/**
 * Downloads wp-cli.phar to the local bin directory
 */
async function downloadWpCli() {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(WP_CLI_PATH);

        https.get(WP_CLI_URL, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download WP-CLI: HTTP ${response.statusCode}`));
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close();
                // Make it executable
                fs.chmodSync(WP_CLI_PATH, '755');
                resolve();
            });
        }).on('error', (err) => {
            fs.unlinkSync(WP_CLI_PATH);
            reject(err);
        });
    });
}

/**
 * Ensures wp-cli.phar is available, downloads if needed
 * Returns the command array to use for running WP-CLI
 */
export async function ensureWpCli() {
    if (!fs.existsSync(WP_CLI_PATH)) {
        await downloadWpCli();
    }

    // Verify PHP is available
    try {
        await execa('php', ['--version']);
    } catch (error) {
        throw new Error('PHP is not installed or not in PATH. WordPress and WP-CLI require PHP to run.');
    }

    return ['php', WP_CLI_PATH];
}

/**
 * Get the WP-CLI command prefix
 * Returns array like ['php', '/path/to/wp-cli.phar']
 */
export function getWpCliCommand() {
    return ['php', WP_CLI_PATH];
}