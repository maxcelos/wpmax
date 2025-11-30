// src/site-registry.js
import fs from 'fs';
import path from 'path';
import os from 'os';

const SITES_FILE = path.join(os.homedir(), '.config', 'wpmax', 'sites.json');

/**
 * Ensure the sites file exists
 */
function ensureSitesFile() {
    const dir = path.dirname(SITES_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(SITES_FILE)) {
        fs.writeFileSync(SITES_FILE, JSON.stringify({ sites: [] }, null, 2));
    }
}

/**
 * Read all sites from the registry
 */
export function listAllSites() {
    ensureSitesFile();
    try {
        const data = fs.readFileSync(SITES_FILE, 'utf8');
        const parsed = JSON.parse(data);
        return parsed.sites || [];
    } catch (error) {
        return [];
    }
}

/**
 * Get a single site by name
 */
export function getSite(siteName) {
    const sites = listAllSites();
    return sites.find(site => site.name === siteName);
}

/**
 * Check if a site exists in the registry
 */
export function siteExists(siteName) {
    return getSite(siteName) !== undefined;
}

/**
 * Add a new site to the registry
 */
export function addSite(siteData) {
    ensureSitesFile();
    const sites = listAllSites();

    // Remove existing site with same name if it exists
    const filtered = sites.filter(site => site.name !== siteData.name);

    // Add new site
    filtered.push({
        name: siteData.name,
        path: siteData.path,
        url: siteData.url,
        created_at: siteData.created_at || new Date().toISOString(),
        dbName: siteData.dbName,
        dbUser: siteData.dbUser,
        dbHost: siteData.dbHost,
        adminUser: siteData.adminUser,
        adminEmail: siteData.adminEmail
    });

    // Save
    fs.writeFileSync(SITES_FILE, JSON.stringify({ sites: filtered }, null, 2));
}

/**
 * Remove a site from the registry
 */
export function removeSite(siteName) {
    ensureSitesFile();
    const sites = listAllSites();
    const filtered = sites.filter(site => site.name !== siteName);
    fs.writeFileSync(SITES_FILE, JSON.stringify({ sites: filtered }, null, 2));
}

/**
 * Get the sites file path (for display purposes)
 */
export function getSitesFilePath() {
    return SITES_FILE;
}

/**
 * Check if a directory is a WordPress installation
 * @param {string} dirPath - Directory path to check
 * @returns {boolean}
 */
function isWordPressDirectory(dirPath) {
    const wpConfigPath = path.join(dirPath, 'wp-config.php');
    const wpLoadPath = path.join(dirPath, 'wp-load.php');
    const wpContentPath = path.join(dirPath, 'wp-content');

    return fs.existsSync(wpConfigPath) &&
           fs.existsSync(wpLoadPath) &&
           fs.existsSync(wpContentPath);
}

/**
 * Get the current site based on the current working directory
 * Returns the site object if found in registry, or a basic site object for non-wpmax WordPress sites
 * Returns null if not a WordPress directory
 */
export function getCurrentSite() {
    const cwd = process.cwd();
    const sites = listAllSites();

    // First, check if current directory matches any site in the registry
    const registeredSite = sites.find(site => site.path === cwd);
    if (registeredSite) {
        return registeredSite;
    }

    // If not in registry, check if it's a WordPress directory
    if (isWordPressDirectory(cwd)) {
        // Return a basic site object for non-wpmax WordPress installations
        const dirName = path.basename(cwd);
        return {
            name: dirName,
            path: cwd,
            url: null,
            created_at: null,
            dbName: null,
            dbUser: null,
            dbHost: null,
            adminUser: null,
            adminEmail: null,
            isExternal: true // Flag to indicate this is not a wpmax-managed site
        };
    }

    return null;
}