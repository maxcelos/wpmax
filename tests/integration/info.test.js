// tests/integration/info.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getFullSiteInfo } from '../../src/site-info.js';
import { addSite } from '../../src/site-registry.js';
import { mockFilesystem } from '../helpers/mock-filesystem.js';
import { createExecaResponse } from '../helpers/mock-execa.js';
import { createTestSite } from '../helpers/test-data.js';
import path from 'path';
import os from 'os';

// Mock modules
vi.mock('execa', () => ({
  execa: vi.fn()
}));

vi.mock('../../src/wp-cli-manager.js', () => ({
  getWpCliCommand: vi.fn(() => ['php', '/path/to/wp-cli.phar'])
}));

describe('Info Command Integration', () => {
  let execaMock;
  let fsMocks;
  const sitesFile = path.join(os.homedir(), '.config', 'wpmax', 'sites.json');

  beforeEach(async () => {
    const { execa } = await import('execa');
    execaMock = execa;
    vi.clearAllMocks();

    // Reset registry file for each test
    fsMocks = mockFilesystem({
      [sitesFile]: JSON.stringify({ sites: [] })
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('wpmax info <name>', () => {
    it('should return null for non-existent site', async () => {
      const info = await getFullSiteInfo('non-existent-site');

      expect(info).toBeNull();
    });

    it.skip('should show full site information for existing site', async () => {
      const site = createTestSite('my-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        const command = args.join(' ');

        if (command.includes('core version')) return createExecaResponse('6.4.2');
        if (command.includes('plugin list')) return createExecaResponse('woocommerce\nyoast-seo');
        if (command.includes('theme list')) return createExecaResponse('twentytwentyfour');
        if (command.includes('db query')) return createExecaResponse('wp_posts\nwp_users\nwp_options');
        if (command.includes('db size')) return createExecaResponse('25.5M');
        if (command.includes('cli info')) {
          return createExecaResponse(JSON.stringify({ php_version: '8.2.15' }));
        }
        if (cmd === 'du') return createExecaResponse('350M\t' + site.path);
      });

      const info = await getFullSiteInfo('my-site');

      expect(info).toBeDefined();
      expect(info.name).toBe('my-site');
      expect(info.exists).toBe(true);
      expect(info.wpVersion).toBe('6.4.2');
      expect(info.plugins).toEqual(['woocommerce', 'yoast-seo']);
      expect(info.theme).toBe('twentytwentyfour');
      expect(info.dbInfo.tableCount).toBe(3);
      expect(info.dbInfo.size).toBe('25.5M');
      expect(info.phpVersion).toBe('8.2.15');
      expect(info.directorySize).toBe('350M');
    });

    it.skip('should show warning for deleted sites', async () => {
      const site = createTestSite('deleted-site');
      addSite(site);

      fsMocks = mockFilesystem({}); // Site directory does not exist

      const info = await getFullSiteInfo('deleted-site');

      expect(info).toBeDefined();
      expect(info.exists).toBe(false);
      expect(info.name).toBe('deleted-site');
    });

    it.skip('should display site metadata correctly', async () => {
      const site = createTestSite('my-site', {
        url: 'custom-domain.test',
        adminUser: 'superadmin',
        adminEmail: 'admin@example.com'
      });
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        const command = args.join(' ');

        if (command.includes('core version')) return createExecaResponse('6.4.3');
        if (command.includes('plugin list')) return createExecaResponse('');
        if (command.includes('theme list')) return createExecaResponse('storefront');
        if (command.includes('db query')) return createExecaResponse('wp_posts');
        if (command.includes('db size')) return createExecaResponse('10.0M');
        if (command.includes('cli info')) {
          return createExecaResponse(JSON.stringify({ php_version: '8.3.0' }));
        }
        if (cmd === 'du') return createExecaResponse('200M\t' + site.path);
      });

      const info = await getFullSiteInfo('my-site');

      expect(info.url).toBe('custom-domain.test');
      expect(info.adminUser).toBe('superadmin');
      expect(info.adminEmail).toBe('admin@example.com');
    });

    it.skip('should show database information', async () => {
      const site = createTestSite('my-site', { dbName: 'custom_database' });
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        const command = args.join(' ');

        if (command.includes('core version')) return createExecaResponse('6.4.2');
        if (command.includes('plugin list')) return createExecaResponse('');
        if (command.includes('theme list')) return createExecaResponse('twentytwentyfour');
        if (command.includes('db query')) {
          return createExecaResponse('wp_posts\nwp_postmeta\nwp_users\nwp_usermeta\nwp_options');
        }
        if (command.includes('db size')) return createExecaResponse('125.8M');
        if (command.includes('cli info')) {
          return createExecaResponse(JSON.stringify({ php_version: '8.2.15' }));
        }
        if (cmd === 'du') return createExecaResponse('500M\t' + site.path);
      });

      const info = await getFullSiteInfo('my-site');

      expect(info.dbName).toBe('custom_database');
      expect(info.dbInfo.tableCount).toBe(5);
      expect(info.dbInfo.size).toBe('125.8M');
    });

    it.skip('should handle sites with many plugins', async () => {
      const site = createTestSite('plugin-heavy-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        const command = args.join(' ');

        if (command.includes('core version')) return createExecaResponse('6.4.2');
        if (command.includes('plugin list')) {
          return createExecaResponse('woocommerce\nyoast-seo\ncontact-form-7\nakismet\njetpack\nwordpress-seo\nall-in-one-seo');
        }
        if (command.includes('theme list')) return createExecaResponse('storefront');
        if (command.includes('db query')) return createExecaResponse('wp_posts');
        if (command.includes('db size')) return createExecaResponse('500M');
        if (command.includes('cli info')) {
          return createExecaResponse(JSON.stringify({ php_version: '8.2.15' }));
        }
        if (cmd === 'du') return createExecaResponse('2.5G\t' + site.path);
      });

      const info = await getFullSiteInfo('plugin-heavy-site');

      expect(info.plugins).toHaveLength(7);
      expect(info.plugins).toContain('woocommerce');
      expect(info.plugins).toContain('jetpack');
    });

    it.skip('should handle sites with no plugins', async () => {
      const site = createTestSite('minimal-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        const command = args.join(' ');

        if (command.includes('core version')) return createExecaResponse('6.4.2');
        if (command.includes('plugin list')) return createExecaResponse('');
        if (command.includes('theme list')) return createExecaResponse('twentytwentyfour');
        if (command.includes('db query')) return createExecaResponse('wp_posts');
        if (command.includes('db size')) return createExecaResponse('5.0M');
        if (command.includes('cli info')) {
          return createExecaResponse(JSON.stringify({ php_version: '8.2.15' }));
        }
        if (cmd === 'du') return createExecaResponse('75M\t' + site.path);
      });

      const info = await getFullSiteInfo('minimal-site');

      expect(info.plugins).toEqual([]);
    });

    it.skip('should display WordPress version correctly', async () => {
      const site = createTestSite('versioned-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        const command = args.join(' ');

        if (command.includes('core version')) return createExecaResponse('6.5.0-RC1-57793');
        if (command.includes('plugin list')) return createExecaResponse('');
        if (command.includes('theme list')) return createExecaResponse('twentytwentyfour');
        if (command.includes('db query')) return createExecaResponse('wp_posts');
        if (command.includes('db size')) return createExecaResponse('10M');
        if (command.includes('cli info')) {
          return createExecaResponse(JSON.stringify({ php_version: '8.2.15' }));
        }
        if (cmd === 'du') return createExecaResponse('100M\t' + site.path);
      });

      const info = await getFullSiteInfo('versioned-site');

      expect(info.wpVersion).toBe('6.5.0-RC1-57793');
    });

    it.skip('should display PHP version correctly', async () => {
      const site = createTestSite('my-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        const command = args.join(' ');

        if (command.includes('core version')) return createExecaResponse('6.4.2');
        if (command.includes('plugin list')) return createExecaResponse('');
        if (command.includes('theme list')) return createExecaResponse('twentytwentyfour');
        if (command.includes('db query')) return createExecaResponse('wp_posts');
        if (command.includes('db size')) return createExecaResponse('10M');
        if (command.includes('cli info')) {
          return createExecaResponse(JSON.stringify({ php_version: '8.3.2' }));
        }
        if (cmd === 'du') return createExecaResponse('100M\t' + site.path);
      });

      const info = await getFullSiteInfo('my-site');

      expect(info.phpVersion).toBe('8.3.2');
    });

    it.skip('should fallback to system PHP when cli info fails', async () => {
      const site = createTestSite('my-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        const command = args.join(' ');

        if (cmd === 'php' && args[0] === '--version') {
          return createExecaResponse('PHP 8.1.25 (cli)');
        }
        if (command.includes('core version')) return createExecaResponse('6.4.2');
        if (command.includes('plugin list')) return createExecaResponse('');
        if (command.includes('theme list')) return createExecaResponse('twentytwentyfour');
        if (command.includes('db query')) return createExecaResponse('wp_posts');
        if (command.includes('db size')) return createExecaResponse('10M');
        if (command.includes('cli info')) {
          throw new Error('cli info failed');
        }
        if (cmd === 'du') return createExecaResponse('100M\t' + site.path);
      });

      const info = await getFullSiteInfo('my-site');

      expect(info.phpVersion).toBe('8.1.25');
    });

    it.skip('should handle large sites (>1GB)', async () => {
      const site = createTestSite('large-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        const command = args.join(' ');

        if (command.includes('core version')) return createExecaResponse('6.4.2');
        if (command.includes('plugin list')) return createExecaResponse('woocommerce');
        if (command.includes('theme list')) return createExecaResponse('storefront');
        if (command.includes('db query')) return createExecaResponse('wp_posts\nwp_postmeta');
        if (command.includes('db size')) return createExecaResponse('850M');
        if (command.includes('cli info')) {
          return createExecaResponse(JSON.stringify({ php_version: '8.2.15' }));
        }
        if (cmd === 'du') return createExecaResponse('3.2G\t' + site.path);
      });

      const info = await getFullSiteInfo('large-site');

      expect(info.directorySize).toBe('3.2G');
      expect(info.dbInfo.size).toBe('850M');
    });
  });

  describe('error handling', () => {
    it.skip('should handle WP-CLI errors gracefully', async () => {
      const site = createTestSite('broken-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        throw new Error('WP-CLI error');
      });

      const info = await getFullSiteInfo('broken-site');

      expect(info.exists).toBe(true);
      expect(info.wpVersion).toBe('Unknown');
      expect(info.plugins).toEqual([]);
      expect(info.theme).toBe('Unknown');
      expect(info.phpVersion).toBe('Unknown');
      expect(info.directorySize).toBe('Unknown');
    });

    it.skip('should handle database query failures', async () => {
      const site = createTestSite('db-broken-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        const command = args.join(' ');

        if (command.includes('core version')) return createExecaResponse('6.4.2');
        if (command.includes('plugin list')) return createExecaResponse('');
        if (command.includes('theme list')) return createExecaResponse('twentytwentyfour');
        if (command.includes('db query')) throw new Error('Database connection failed');
        if (command.includes('db size')) throw new Error('Database connection failed');
        if (command.includes('cli info')) {
          return createExecaResponse(JSON.stringify({ php_version: '8.2.15' }));
        }
        if (cmd === 'du') return createExecaResponse('100M\t' + site.path);
      });

      const info = await getFullSiteInfo('db-broken-site');

      expect(info.dbInfo.tableCount).toBe(0);
      expect(info.dbInfo.size).toBe('Unknown');
    });
  });

  describe('creation timestamp', () => {
    it.skip('should display creation date', async () => {
      const createdAt = Date.now() - 86400000 * 7; // 7 days ago
      const site = createTestSite('week-old-site', { created_at: createdAt });
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        const command = args.join(' ');

        if (command.includes('core version')) return createExecaResponse('6.4.2');
        if (command.includes('plugin list')) return createExecaResponse('');
        if (command.includes('theme list')) return createExecaResponse('twentytwentyfour');
        if (command.includes('db query')) return createExecaResponse('wp_posts');
        if (command.includes('db size')) return createExecaResponse('10M');
        if (command.includes('cli info')) {
          return createExecaResponse(JSON.stringify({ php_version: '8.2.15' }));
        }
        if (cmd === 'du') return createExecaResponse('100M\t' + site.path);
      });

      const info = await getFullSiteInfo('week-old-site');

      expect(info.created_at).toBe(createdAt);
    });
  });

  describe('theme information', () => {
    it.skip('should display custom themes', async () => {
      const site = createTestSite('custom-theme-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        const command = args.join(' ');

        if (command.includes('core version')) return createExecaResponse('6.4.2');
        if (command.includes('plugin list')) return createExecaResponse('');
        if (command.includes('theme list')) return createExecaResponse('storefront');
        if (command.includes('db query')) return createExecaResponse('wp_posts');
        if (command.includes('db size')) return createExecaResponse('10M');
        if (command.includes('cli info')) {
          return createExecaResponse(JSON.stringify({ php_version: '8.2.15' }));
        }
        if (cmd === 'du') return createExecaResponse('100M\t' + site.path);
      });

      const info = await getFullSiteInfo('custom-theme-site');

      expect(info.theme).toBe('storefront');
    });
  });
});