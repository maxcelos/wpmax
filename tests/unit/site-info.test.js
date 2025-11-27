// tests/unit/site-info.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getFullSiteInfo, getBasicSiteInfo } from '../../src/site-info.js';
import { mockFilesystem } from '../helpers/mock-filesystem.js';
import { createExecaResponse } from '../helpers/mock-execa.js';
import { createTestSite } from '../helpers/test-data.js';

// Mock modules
vi.mock('execa', () => ({
  execa: vi.fn()
}));

vi.mock('../../src/wp-cli-manager.js', () => ({
  getWpCliCommand: vi.fn(() => ['php', '/path/to/wp-cli.phar'])
}));

vi.mock('../../src/site-registry.js', () => ({
  getSite: vi.fn()
}));

describe('Site Info', () => {
  let execaMock;
  let getSiteMock;
  let fsMocks;

  beforeEach(async () => {
    const { execa } = await import('execa');
    const { getSite } = await import('../../src/site-registry.js');

    execaMock = execa;
    getSiteMock = getSite;

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getFullSiteInfo', () => {
    it('should return null when site is not in registry', async () => {
      getSiteMock.mockReturnValue(null);

      const result = await getFullSiteInfo('non-existent-site');

      expect(result).toBeNull();
    });

    it('should return site with exists=false when directory does not exist', async () => {
      const testSite = createTestSite('test-site');
      getSiteMock.mockReturnValue(testSite);
      fsMocks = mockFilesystem({});

      const result = await getFullSiteInfo('test-site');

      expect(result).toBeDefined();
      expect(result.exists).toBe(false);
      expect(result.name).toBe('test-site');
    });

    it('should return full site information when site exists', async () => {
      const testSite = createTestSite('test-site');
      getSiteMock.mockReturnValue(testSite);
      fsMocks = mockFilesystem({
        [testSite.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        const command = args.join(' ');

        if (command.includes('core version')) {
          return createExecaResponse('6.4.2');
        }
        if (command.includes('plugin list')) {
          return createExecaResponse('woocommerce\nyoast-seo\nakismet');
        }
        if (command.includes('theme list')) {
          return createExecaResponse('twentytwentyfour');
        }
        if (command.includes('db query')) {
          return createExecaResponse('wp_posts\nwp_users\nwp_options');
        }
        if (command.includes('db size')) {
          return createExecaResponse('15.2M');
        }
        if (command.includes('cli info')) {
          return createExecaResponse(JSON.stringify({ php_version: '8.2.15' }));
        }
        if (cmd === 'du') {
          return createExecaResponse('125M\t' + testSite.path);
        }

        throw new Error('Unexpected command: ' + command);
      });

      const result = await getFullSiteInfo('test-site');

      expect(result.exists).toBe(true);
      expect(result.wpVersion).toBe('6.4.2');
      expect(result.plugins).toEqual(['woocommerce', 'yoast-seo', 'akismet']);
      expect(result.theme).toBe('twentytwentyfour');
      expect(result.dbInfo.tableCount).toBe(3);
      expect(result.dbInfo.size).toBe('15.2M');
      expect(result.phpVersion).toBe('8.2.15');
      expect(result.directorySize).toBe('125M');
    });

    it('should handle empty plugin list', async () => {
      const testSite = createTestSite('test-site');
      getSiteMock.mockReturnValue(testSite);
      fsMocks = mockFilesystem({
        [testSite.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        const command = args.join(' ');

        if (command.includes('plugin list')) {
          return createExecaResponse(''); // No plugins
        }
        if (command.includes('core version')) {
          return createExecaResponse('6.4.2');
        }
        if (command.includes('theme list')) {
          return createExecaResponse('twentytwentyfour');
        }
        if (command.includes('db query')) {
          return createExecaResponse('wp_posts');
        }
        if (command.includes('db size')) {
          return createExecaResponse('5.0M');
        }
        if (command.includes('cli info')) {
          return createExecaResponse(JSON.stringify({ php_version: '8.2.15' }));
        }
        if (cmd === 'du') {
          return createExecaResponse('50M\t' + testSite.path);
        }
      });

      const result = await getFullSiteInfo('test-site');

      expect(result.plugins).toEqual([]);
    });

    it('should handle WP-CLI errors gracefully', async () => {
      const testSite = createTestSite('test-site');
      getSiteMock.mockReturnValue(testSite);
      fsMocks = mockFilesystem({
        [testSite.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        const command = args.join(' ');

        if (command.includes('core version')) {
          throw new Error('WP-CLI not found');
        }
        if (command.includes('plugin list')) {
          throw new Error('Error');
        }
        if (command.includes('theme list')) {
          throw new Error('Error');
        }
        if (command.includes('db query')) {
          throw new Error('Error');
        }
        if (command.includes('db size')) {
          throw new Error('Error');
        }
        if (command.includes('cli info')) {
          throw new Error('Error');
        }
        if (cmd === 'du') {
          throw new Error('Permission denied');
        }
      });

      const result = await getFullSiteInfo('test-site');

      expect(result.exists).toBe(true);
      expect(result.wpVersion).toBe('Unknown');
      expect(result.plugins).toEqual([]);
      expect(result.theme).toBe('Unknown');
      expect(result.dbInfo.tableCount).toBe(0);
      expect(result.dbInfo.size).toBe('Unknown');
      expect(result.phpVersion).toBe('Unknown');
      expect(result.directorySize).toBe('Unknown');
    });

    it('should fall back to system PHP when WP-CLI cli info fails', async () => {
      const testSite = createTestSite('test-site');
      getSiteMock.mockReturnValue(testSite);
      fsMocks = mockFilesystem({
        [testSite.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        const command = args.join(' ');

        if (cmd === 'php' && args[0] === '--version') {
          return createExecaResponse('PHP 8.1.25 (cli)');
        }
        if (command.includes('cli info')) {
          throw new Error('Error getting info');
        }
        if (command.includes('core version')) {
          return createExecaResponse('6.4.2');
        }
        if (command.includes('plugin list')) {
          return createExecaResponse('');
        }
        if (command.includes('theme list')) {
          return createExecaResponse('twentytwentyfour');
        }
        if (command.includes('db query')) {
          return createExecaResponse('wp_posts');
        }
        if (command.includes('db size')) {
          return createExecaResponse('5.0M');
        }
        if (cmd === 'du') {
          return createExecaResponse('50M\t' + testSite.path);
        }

        throw new Error('Unexpected: ' + cmd);
      });

      const result = await getFullSiteInfo('test-site');

      expect(result.phpVersion).toBe('8.1.25');
    });

    it('should handle all async operations in parallel', async () => {
      const testSite = createTestSite('test-site');
      getSiteMock.mockReturnValue(testSite);
      fsMocks = mockFilesystem({
        [testSite.path]: '__DIR__'
      });

      let callOrder = [];

      execaMock.mockImplementation(async (cmd, args) => {
        const command = args.join(' ');

        // Simulate async delay
        await new Promise(resolve => setTimeout(resolve, 10));

        if (command.includes('core version')) {
          callOrder.push('version');
          return createExecaResponse('6.4.2');
        }
        if (command.includes('plugin list')) {
          callOrder.push('plugins');
          return createExecaResponse('plugin1');
        }
        if (command.includes('theme list')) {
          callOrder.push('theme');
          return createExecaResponse('theme1');
        }
        if (command.includes('db query')) {
          callOrder.push('db-query');
          return createExecaResponse('table1');
        }
        if (command.includes('db size')) {
          callOrder.push('db-size');
          return createExecaResponse('10M');
        }
        if (command.includes('cli info')) {
          callOrder.push('cli-info');
          return createExecaResponse(JSON.stringify({ php_version: '8.2.15' }));
        }
        if (cmd === 'du') {
          callOrder.push('du');
          return createExecaResponse('100M\t' + testSite.path);
        }
      });

      await getFullSiteInfo('test-site');

      // All operations should be called (order doesn't matter due to Promise.all)
      expect(callOrder).toContain('version');
      expect(callOrder).toContain('plugins');
      expect(callOrder).toContain('theme');
    });
  });

  describe('getBasicSiteInfo', () => {
    it('should return null when site is not in registry', async () => {
      getSiteMock.mockReturnValue(null);

      const result = await getBasicSiteInfo('non-existent-site');

      expect(result).toBeNull();
    });

    it('should return basic info when site directory exists', async () => {
      const testSite = createTestSite('test-site');
      getSiteMock.mockReturnValue(testSite);
      fsMocks = mockFilesystem({
        [testSite.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'du') {
          return createExecaResponse('200M\t' + testSite.path);
        }
      });

      const result = await getBasicSiteInfo('test-site');

      expect(result.exists).toBe(true);
      expect(result.directorySize).toBe('200M');
      expect(result.name).toBe('test-site');
    });

    it('should return N/A for directory size when site does not exist', async () => {
      const testSite = createTestSite('test-site');
      getSiteMock.mockReturnValue(testSite);
      fsMocks = mockFilesystem({});

      const result = await getBasicSiteInfo('test-site');

      expect(result.exists).toBe(false);
      expect(result.directorySize).toBe('N/A');
    });

    it('should handle du command errors', async () => {
      const testSite = createTestSite('test-site');
      getSiteMock.mockReturnValue(testSite);
      fsMocks = mockFilesystem({
        [testSite.path]: '__DIR__'
      });

      execaMock.mockRejectedValue(new Error('du failed'));

      const result = await getBasicSiteInfo('test-site');

      expect(result.exists).toBe(true);
      expect(result.directorySize).toBe('Unknown');
    });

    it('should include all registry data', async () => {
      const testSite = createTestSite('test-site', {
        url: 'custom.test',
        dbName: 'custom_db'
      });
      getSiteMock.mockReturnValue(testSite);
      fsMocks = mockFilesystem({
        [testSite.path]: '__DIR__'
      });

      execaMock.mockResolvedValue(createExecaResponse('100M\t' + testSite.path));

      const result = await getBasicSiteInfo('test-site');

      expect(result.name).toBe('test-site');
      expect(result.url).toBe('custom.test');
      expect(result.dbName).toBe('custom_db');
      expect(result.path).toBe(testSite.path);
    });
  });

  describe('integration scenarios', () => {
    it('should handle a realistic full site info query', async () => {
      const testSite = createTestSite('production-site');
      getSiteMock.mockReturnValue(testSite);
      fsMocks = mockFilesystem({
        [testSite.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        const command = args.join(' ');

        if (cmd === 'du') return createExecaResponse('1.2G\t' + testSite.path);
        if (command.includes('core version')) return createExecaResponse('6.4.3');
        if (command.includes('plugin list')) {
          return createExecaResponse('woocommerce\nwordpress-seo\ncontact-form-7');
        }
        if (command.includes('theme list')) return createExecaResponse('storefront');
        if (command.includes('db query')) {
          return createExecaResponse(
            'wp_posts\nwp_postmeta\nwp_users\nwp_usermeta\nwp_options\nwp_comments'
          );
        }
        if (command.includes('db size')) return createExecaResponse('245.8M');
        if (command.includes('cli info')) {
          return createExecaResponse(JSON.stringify({ php_version: '8.3.0' }));
        }
      });

      const result = await getFullSiteInfo('production-site');

      expect(result.exists).toBe(true);
      expect(result.wpVersion).toBe('6.4.3');
      expect(result.plugins.length).toBe(3);
      expect(result.theme).toBe('storefront');
      expect(result.dbInfo.tableCount).toBe(6);
      expect(result.dbInfo.size).toBe('245.8M');
      expect(result.directorySize).toBe('1.2G');
    });
  });
});