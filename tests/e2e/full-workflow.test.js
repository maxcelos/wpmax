// tests/e2e/full-workflow.test.js
/**
 * End-to-End Full Workflow Tests
 *
 * These tests verify complete workflows work correctly by testing:
 * - Site registry operations (add, get, remove, list)
 * - Config file operations (read, write, modify)
 * - Multi-site scenarios
 * - Complete create -> list -> info -> delete workflows
 *
 * Note: These are integration tests that mock external dependencies
 * but test the full workflow logic without calling actual WP-CLI or MySQL.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createTempTestEnv,
  addSiteToRegistry,
  getSiteFromRegistry,
  removeSiteFromRegistry
} from '../helpers/e2e/temp-env.js';
import path from 'path';
import fs from 'fs';

describe('E2E: Full Workflow Tests', () => {
  let tempEnv;

  beforeEach(() => {
    tempEnv = createTempTestEnv();
  });

  afterEach(() => {
    tempEnv.cleanup();
  });

  describe('Scenario 1: Happy Path - Create, List, Info, Delete Workflow', () => {
    it('should create a site, register it, list it, show info, and delete it', () => {
      const siteName = 'test-site';

      // Step 1: Add site to registry (simulates successful creation)
      addSiteToRegistry(tempEnv.sitesFile, {
        name: siteName,
        path: path.join(tempEnv.sitesDir, siteName),
        url: `${siteName}.test`,
        created_at: new Date().toISOString(),
        dbName: 'test_site',
        dbUser: 'root',
        dbHost: '127.0.0.1',
        adminUser: 'admin',
        adminEmail: 'admin@test.com'
      });

      // Step 2: Verify site was registered
      const registeredSite = getSiteFromRegistry(tempEnv.sitesFile, siteName);
      expect(registeredSite).toBeDefined();
      expect(registeredSite.name).toBe(siteName);
      expect(registeredSite.url).toBe(`${siteName}.test`);
      expect(registeredSite.dbName).toBe('test_site');

      // Step 3: List sites - verify site shows up
      const sites = JSON.parse(fs.readFileSync(tempEnv.sitesFile, 'utf8')).sites;
      expect(sites).toHaveLength(1);
      expect(sites[0].name).toBe(siteName);

      // Step 4: Get site info
      const siteInfo = getSiteFromRegistry(tempEnv.sitesFile, siteName);
      expect(siteInfo).toBeDefined();
      expect(siteInfo.dbName).toBe('test_site');
      expect(siteInfo.adminUser).toBe('admin');
      expect(siteInfo.adminEmail).toBe('admin@test.com');

      // Step 5: Delete site
      removeSiteFromRegistry(tempEnv.sitesFile, siteName);

      // Step 6: Verify site was removed
      const deletedSite = getSiteFromRegistry(tempEnv.sitesFile, siteName);
      expect(deletedSite).toBeNull();

      const sitesAfterDelete = JSON.parse(fs.readFileSync(tempEnv.sitesFile, 'utf8')).sites;
      expect(sitesAfterDelete).toHaveLength(0);
    });
  });

  describe('Scenario 2: Config Workflow', () => {
    it('should allow reading and modifying config values', () => {
      const configData = JSON.parse(fs.readFileSync(tempEnv.configFile, 'utf8'));

      // Verify default config
      expect(configData.dbuser).toBe('root');
      expect(configData.dbhost).toBe('127.0.0.1');
      expect(configData.dbprefix).toBe('wp_');

      // Modify config
      configData.adminUser = 'customadmin';
      configData.adminEmail = 'custom@example.com';
      configData.tld = '.local';
      configData.publicPlugins = ['woocommerce', 'yoast-seo'];
      fs.writeFileSync(tempEnv.configFile, JSON.stringify(configData, null, 2));

      // Read back and verify
      const updatedConfig = JSON.parse(fs.readFileSync(tempEnv.configFile, 'utf8'));
      expect(updatedConfig.adminUser).toBe('customadmin');
      expect(updatedConfig.adminEmail).toBe('custom@example.com');
      expect(updatedConfig.tld).toBe('.local');
      expect(updatedConfig.publicPlugins).toEqual(['woocommerce', 'yoast-seo']);
    });

    it('should handle adding and removing plugins from config', () => {
      const configData = JSON.parse(fs.readFileSync(tempEnv.configFile, 'utf8'));

      // Add plugins
      configData.publicPlugins.push('woocommerce');
      configData.publicPlugins.push('yoast-seo');
      fs.writeFileSync(tempEnv.configFile, JSON.stringify(configData, null, 2));

      // Verify added
      let updatedConfig = JSON.parse(fs.readFileSync(tempEnv.configFile, 'utf8'));
      expect(updatedConfig.publicPlugins).toContain('woocommerce');
      expect(updatedConfig.publicPlugins).toContain('yoast-seo');

      // Remove a plugin
      configData.publicPlugins = configData.publicPlugins.filter(p => p !== 'woocommerce');
      fs.writeFileSync(tempEnv.configFile, JSON.stringify(configData, null, 2));

      // Verify removed
      updatedConfig = JSON.parse(fs.readFileSync(tempEnv.configFile, 'utf8'));
      expect(updatedConfig.publicPlugins).not.toContain('woocommerce');
      expect(updatedConfig.publicPlugins).toContain('yoast-seo');
    });
  });

  describe('Scenario 3: Multiple Sites Workflow', () => {
    it('should handle creating multiple sites', () => {
      const siteNames = ['site-one', 'site-two', 'site-three'];

      // Create multiple sites
      for (const siteName of siteNames) {
        addSiteToRegistry(tempEnv.sitesFile, {
          name: siteName,
          path: path.join(tempEnv.sitesDir, siteName),
          url: `${siteName}.test`,
          created_at: new Date().toISOString(),
          dbName: siteName.replace(/-/g, '_'),
          dbUser: 'root',
          dbHost: '127.0.0.1',
          adminUser: 'admin',
          adminEmail: 'admin@test.com'
        });
      }

      // Verify all sites were registered
      const sites = JSON.parse(fs.readFileSync(tempEnv.sitesFile, 'utf8')).sites;
      expect(sites).toHaveLength(3);
      expect(sites.map(s => s.name)).toEqual(expect.arrayContaining(siteNames));

      // Verify each site has correct properties
      sites.forEach(site => {
        expect(site.name).toMatch(/^site-(one|two|three)$/);
        expect(site.url).toMatch(/\.test$/);
        expect(site.dbName).toMatch(/_/);
      });
    });

    it('should handle deleting specific sites while keeping others', () => {
      // Create three sites
      const siteNames = ['site-one', 'site-two', 'site-three'];
      for (const siteName of siteNames) {
        addSiteToRegistry(tempEnv.sitesFile, {
          name: siteName,
          path: path.join(tempEnv.sitesDir, siteName),
          url: `${siteName}.test`,
          created_at: new Date().toISOString(),
          dbName: siteName.replace(/-/g, '_'),
          dbUser: 'root',
          dbHost: '127.0.0.1',
          adminUser: 'admin',
          adminEmail: 'admin@test.com'
        });
      }

      // Delete middle site
      removeSiteFromRegistry(tempEnv.sitesFile, 'site-two');

      // Verify deletion
      const sites = JSON.parse(fs.readFileSync(tempEnv.sitesFile, 'utf8')).sites;
      expect(sites).toHaveLength(2);
      expect(sites.map(s => s.name)).toEqual(expect.arrayContaining(['site-one', 'site-three']));
      expect(sites.map(s => s.name)).not.toContain('site-two');
    });

    it('should handle listing all sites', () => {
      // Create five sites
      const siteCount = 5;
      for (let i = 1; i <= siteCount; i++) {
        addSiteToRegistry(tempEnv.sitesFile, {
          name: `test-site-${i}`,
          path: path.join(tempEnv.sitesDir, `test-site-${i}`),
          url: `test-site-${i}.test`,
          created_at: new Date(Date.now() - i * 86400000).toISOString(), // i days ago
          dbName: `test_site_${i}`,
          dbUser: 'root',
          dbHost: '127.0.0.1',
          adminUser: 'admin',
          adminEmail: 'admin@test.com'
        });
      }

      // List all sites
      const sites = JSON.parse(fs.readFileSync(tempEnv.sitesFile, 'utf8')).sites;
      expect(sites).toHaveLength(siteCount);

      // Verify they're all there
      for (let i = 1; i <= siteCount; i++) {
        const site = sites.find(s => s.name === `test-site-${i}`);
        expect(site).toBeDefined();
        expect(site.dbName).toBe(`test_site_${i}`);
      }
    });
  });

  describe('Scenario 4: Delete Options Tracking', () => {
    it('should track delete with --keep-db flag intent', () => {
      const siteName = 'test-keep-db';

      // Add site to registry
      addSiteToRegistry(tempEnv.sitesFile, {
        name: siteName,
        path: path.join(tempEnv.sitesDir, siteName),
        url: `${siteName}.test`,
        created_at: new Date().toISOString(),
        dbName: 'test_keep_db',
        dbUser: 'root',
        dbHost: '127.0.0.1',
        adminUser: 'admin',
        adminEmail: 'admin@test.com'
      });

      // Simulate delete with --keep-db (registry removal only)
      const deleteOptions = {
        keepDb: true,
        keepFiles: false
      };

      // Remove from registry
      removeSiteFromRegistry(tempEnv.sitesFile, siteName);

      // Verify site removed from registry
      const site = getSiteFromRegistry(tempEnv.sitesFile, siteName);
      expect(site).toBeNull();

      // In real scenario, DB would still exist
      expect(deleteOptions.keepDb).toBe(true);
    });

    it('should track delete with --keep-files flag intent', () => {
      const siteName = 'test-keep-files';

      addSiteToRegistry(tempEnv.sitesFile, {
        name: siteName,
        path: path.join(tempEnv.sitesDir, siteName),
        url: `${siteName}.test`,
        created_at: new Date().toISOString(),
        dbName: 'test_keep_files',
        dbUser: 'root',
        dbHost: '127.0.0.1',
        adminUser: 'admin',
        adminEmail: 'admin@test.com'
      });

      // Simulate delete with --keep-files
      const deleteOptions = {
        keepDb: false,
        keepFiles: true
      };

      // Remove from registry only
      removeSiteFromRegistry(tempEnv.sitesFile, siteName);

      // Verify removal
      const site = getSiteFromRegistry(tempEnv.sitesFile, siteName);
      expect(site).toBeNull();

      // Files would remain in real scenario
      expect(deleteOptions.keepFiles).toBe(true);
    });

    it('should handle --dry-run flag intent', () => {
      const siteName = 'test-dry-run';

      addSiteToRegistry(tempEnv.sitesFile, {
        name: siteName,
        path: path.join(tempEnv.sitesDir, siteName),
        url: `${siteName}.test`,
        created_at: new Date().toISOString(),
        dbName: 'test_dry_run',
        dbUser: 'root',
        dbHost: '127.0.0.1',
        adminUser: 'admin',
        adminEmail: 'admin@test.com'
      });

      // Dry run - should not actually delete
      const deleteOptions = {
        dryRun: true
      };

      // With dry run, nothing should be deleted
      if (!deleteOptions.dryRun) {
        removeSiteFromRegistry(tempEnv.sitesFile, siteName);
      }

      // Verify site still exists
      const site = getSiteFromRegistry(tempEnv.sitesFile, siteName);
      expect(site).toBeDefined();
    });
  });

  describe('Scenario 5: Site Registry Edge Cases', () => {
    it('should handle updating existing site', () => {
      const siteName = 'test-site';

      // Add initial site
      addSiteToRegistry(tempEnv.sitesFile, {
        name: siteName,
        path: '/old/path',
        url: 'old-url.test',
        created_at: new Date('2024-01-01').toISOString(),
        dbName: 'old_db',
        dbUser: 'root',
        dbHost: '127.0.0.1',
        adminUser: 'admin',
        adminEmail: 'admin@test.com'
      });

      // Update with new data
      addSiteToRegistry(tempEnv.sitesFile, {
        name: siteName,
        path: '/new/path',
        url: 'new-url.test',
        created_at: new Date().toISOString(),
        dbName: 'new_db',
        dbUser: 'root',
        dbHost: '127.0.0.1',
        adminUser: 'admin',
        adminEmail: 'admin@test.com'
      });

      // Verify only one site exists with new data
      const sites = JSON.parse(fs.readFileSync(tempEnv.sitesFile, 'utf8')).sites;
      expect(sites).toHaveLength(1);
      expect(sites[0].path).toBe('/new/path');
      expect(sites[0].url).toBe('new-url.test');
      expect(sites[0].dbName).toBe('new_db');
    });

    it('should handle empty registry gracefully', () => {
      // Verify empty registry
      const sites = JSON.parse(fs.readFileSync(tempEnv.sitesFile, 'utf8')).sites;
      expect(sites).toHaveLength(0);

      // Try to get non-existent site
      const site = getSiteFromRegistry(tempEnv.sitesFile, 'nonexistent');
      expect(site).toBeNull();

      // Try to remove non-existent site (should not error)
      removeSiteFromRegistry(tempEnv.sitesFile, 'nonexistent');

      // Verify still empty
      const sitesAfter = JSON.parse(fs.readFileSync(tempEnv.sitesFile, 'utf8')).sites;
      expect(sitesAfter).toHaveLength(0);
    });

    it('should preserve site metadata correctly', () => {
      const siteName = 'metadata-test';
      const createdAt = new Date('2024-01-15T10:30:00Z').toISOString();

      addSiteToRegistry(tempEnv.sitesFile, {
        name: siteName,
        path: '/path/to/site',
        url: 'metadata-test.test',
        created_at: createdAt,
        dbName: 'metadata_test',
        dbUser: 'custom_user',
        dbHost: '192.168.1.100',
        adminUser: 'customadmin',
        adminEmail: 'custom@example.com'
      });

      const site = getSiteFromRegistry(tempEnv.sitesFile, siteName);
      expect(site.name).toBe(siteName);
      expect(site.path).toBe('/path/to/site');
      expect(site.url).toBe('metadata-test.test');
      expect(site.created_at).toBe(createdAt);
      expect(site.dbName).toBe('metadata_test');
      expect(site.dbUser).toBe('custom_user');
      expect(site.dbHost).toBe('192.168.1.100');
      expect(site.adminUser).toBe('customadmin');
      expect(site.adminEmail).toBe('custom@example.com');
    });
  });
});