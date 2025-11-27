// src/updater.js
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { execa } from 'execa';
import semver from 'semver';
import { getConfig, setConfig } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get the current installed version from package.json
 */
export function getCurrentVersion() {
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.version;
}

/**
 * Get the package name from package.json
 */
export function getPackageName() {
    const packageJsonPath = join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    return packageJson.name;
}

/**
 * Fetch the latest version from npm registry
 * @param {string} packageName - The npm package name
 * @returns {Promise<{version: string, publishedAt: string}>}
 */
export async function getLatestVersion(packageName) {
    const registryUrl = `https://registry.npmjs.org/${packageName}`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        const response = await fetch(registryUrl, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Registry returned ${response.status}`);
        }

        const data = await response.json();
        const latestVersion = data['dist-tags'].latest;
        const publishedAt = data.time[latestVersion];

        return {
            version: latestVersion,
            publishedAt: publishedAt
        };
    } catch (error) {
        if (error.name === 'AbortError') {
            throw new Error('Registry request timed out');
        }
        throw new Error(`Failed to check for updates: ${error.message}`);
    }
}

/**
 * Check if an update is available
 * @returns {Promise<{updateAvailable: boolean, currentVersion: string, latestVersion: string, publishedAt: string}>}
 */
export async function checkForUpdate() {
    const packageName = getPackageName();
    const currentVersion = getCurrentVersion();
    const latest = await getLatestVersion(packageName);

    const updateAvailable = semver.gt(latest.version, currentVersion);

    return {
        updateAvailable,
        currentVersion,
        latestVersion: latest.version,
        publishedAt: latest.publishedAt
    };
}

/**
 * Detect which package manager is being used
 * @returns {Promise<string>} - 'npm', 'pnpm', or 'yarn'
 */
export async function detectPackageManager() {
    // Check for pnpm first
    try {
        await execa('pnpm', ['--version']);
        return 'pnpm';
    } catch {}

    // Check for yarn
    try {
        await execa('yarn', ['--version']);
        return 'yarn';
    } catch {}

    // Default to npm (should always be available)
    return 'npm';
}

/**
 * Perform the update by running global install
 * @param {string} packageName - The npm package name
 * @returns {Promise<void>}
 */
export async function performUpdate(packageName) {
    const pm = await detectPackageManager();

    let args;
    if (pm === 'npm') {
        args = ['install', '-g', `${packageName}@latest`];
    } else if (pm === 'pnpm') {
        args = ['add', '-g', `${packageName}@latest`];
    } else { // yarn
        args = ['global', 'add', `${packageName}@latest`];
    }

    try {
        await execa(pm, args, { stdio: 'inherit' });
    } catch (error) {
        // Check for permission errors
        if (error.message.includes('EACCES') || error.message.includes('permission denied')) {
            throw new Error(`Permission denied. Try running with sudo:\n  sudo ${pm} ${args.join(' ')}`);
        }
        throw error;
    }
}

/**
 * Check if we should auto-check for updates (once per day)
 * @returns {boolean}
 */
export function shouldAutoCheck() {
    const config = getConfig();
    const lastCheck = config.lastUpdateCheck;

    if (!lastCheck) {
        return true;
    }

    const oneDayInMs = 24 * 60 * 60 * 1000;
    const timeSinceLastCheck = Date.now() - lastCheck;

    return timeSinceLastCheck > oneDayInMs;
}

/**
 * Update the last update check timestamp
 */
export function updateLastCheckTime() {
    setConfig('lastUpdateCheck', Date.now());
}

/**
 * Get a human-readable time difference
 * @param {string} dateString - ISO date string
 * @returns {string}
 */
export function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now - date;

    const seconds = Math.floor(diffInMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years} year${years > 1 ? 's' : ''} ago`;
    if (months > 0) return `${months} month${months > 1 ? 's' : ''} ago`;
    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'just now';
}