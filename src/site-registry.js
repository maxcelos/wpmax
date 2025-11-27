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