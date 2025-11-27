// tests/helpers/e2e/temp-env.js
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Create a temporary test environment for E2E tests
 * @returns {Object} Environment paths and cleanup function
 */
export function createTempTestEnv() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wpmax-e2e-'));
  const sitesDir = path.join(tempDir, 'sites');
  const configDir = path.join(tempDir, 'config');
  const sitesFile = path.join(configDir, 'sites.json');
  const configFile = path.join(configDir, 'config.json');

  // Create directories
  fs.mkdirSync(sitesDir, { recursive: true });
  fs.mkdirSync(configDir, { recursive: true });

  // Create empty sites.json
  fs.writeFileSync(sitesFile, JSON.stringify({ sites: [] }, null, 2));

  // Create default config.json
  const defaultConfig = {
    defaultPluginsPath: path.join(tempDir, 'plugins'),
    publicPlugins: [],
    dbuser: 'root',
    dbhost: '127.0.0.1',
    dbprefix: 'wp_',
    adminUser: 'admin',
    adminEmail: 'admin@test.com',
    tld: '.test'
  };
  fs.writeFileSync(configFile, JSON.stringify(defaultConfig, null, 2));

  return {
    tempDir,
    sitesDir,
    configDir,
    sitesFile,
    configFile,
    cleanup: () => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  };
}

/**
 * Create a mock WordPress site structure in the temp environment
 * @param {string} siteDir - Path to site directory
 */
export function createMockWordPressSite(siteDir) {
  fs.mkdirSync(siteDir, { recursive: true });

  // Create essential WordPress files/directories
  fs.mkdirSync(path.join(siteDir, 'wp-content'), { recursive: true });
  fs.mkdirSync(path.join(siteDir, 'wp-content', 'plugins'), { recursive: true });
  fs.mkdirSync(path.join(siteDir, 'wp-content', 'themes'), { recursive: true });
  fs.mkdirSync(path.join(siteDir, 'wp-admin'), { recursive: true });
  fs.mkdirSync(path.join(siteDir, 'wp-includes'), { recursive: true });

  // Create wp-config.php
  fs.writeFileSync(
    path.join(siteDir, 'wp-config.php'),
    '<?php\n// WordPress configuration\ndefine("DB_NAME", "test_db");\n'
  );

  // Create index.php
  fs.writeFileSync(
    path.join(siteDir, 'index.php'),
    '<?php\n// WordPress entry point\n'
  );
}

/**
 * Verify WordPress site structure exists
 * @param {string} siteDir - Path to site directory
 * @returns {boolean} True if site structure is valid
 */
export function verifyWordPressSiteStructure(siteDir) {
  const requiredPaths = [
    siteDir,
    path.join(siteDir, 'wp-content'),
    path.join(siteDir, 'wp-config.php')
  ];

  return requiredPaths.every(p => fs.existsSync(p));
}

/**
 * Add site to registry file
 * @param {string} sitesFile - Path to sites.json
 * @param {Object} site - Site object to add
 */
export function addSiteToRegistry(sitesFile, site) {
  const data = JSON.parse(fs.readFileSync(sitesFile, 'utf8'));
  data.sites = data.sites || [];

  // Remove existing site with same name
  data.sites = data.sites.filter(s => s.name !== site.name);

  // Add new site
  data.sites.push(site);

  fs.writeFileSync(sitesFile, JSON.stringify(data, null, 2));
}

/**
 * Get site from registry file
 * @param {string} sitesFile - Path to sites.json
 * @param {string} siteName - Name of site to get
 * @returns {Object|null} Site object or null if not found
 */
export function getSiteFromRegistry(sitesFile, siteName) {
  const data = JSON.parse(fs.readFileSync(sitesFile, 'utf8'));
  return data.sites?.find(s => s.name === siteName) || null;
}

/**
 * Remove site from registry file
 * @param {string} sitesFile - Path to sites.json
 * @param {string} siteName - Name of site to remove
 */
export function removeSiteFromRegistry(sitesFile, siteName) {
  const data = JSON.parse(fs.readFileSync(sitesFile, 'utf8'));
  data.sites = data.sites?.filter(s => s.name !== siteName) || [];
  fs.writeFileSync(sitesFile, JSON.stringify(data, null, 2));
}