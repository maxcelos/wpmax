// tests/integration/list.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { listAllSites, addSite, removeSite } from '../../src/site-registry.js';
import { getBasicSiteInfo } from '../../src/site-info.js';
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

describe('List Command Integration', () => {
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

  describe('wpmax list', () => {
    it('should show empty message when no sites exist', () => {
      const sites = listAllSites();

      expect(sites).toHaveLength(0);
    });

    it.skip('should list a single site', async () => {
      const site = createTestSite('my-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockResolvedValue(createExecaResponse('100M\t' + site.path));

      const sites = listAllSites();
      const info = await getBasicSiteInfo(site.name);

      expect(sites).toHaveLength(1);
      expect(sites[0].name).toBe('my-site');
      expect(info.exists).toBe(true);
      expect(info.directorySize).toBe('100M');
    });

    it.skip('should list multiple sites', async () => {
      const site1 = createTestSite('site-1');
      const site2 = createTestSite('site-2');
      const site3 = createTestSite('site-3');

      addSite(site1);
      addSite(site2);
      addSite(site3);

      fsMocks = mockFilesystem({
        [site1.path]: '__DIR__',
        [site2.path]: '__DIR__',
        [site3.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        const targetPath = args[args.length - 1];
        return createExecaResponse('100M\t' + targetPath);
      });

      const sites = listAllSites();

      expect(sites).toHaveLength(3);
      expect(sites.map(s => s.name)).toEqual(['site-1', 'site-2', 'site-3']);
    });

    it.skip('should show deleted sites with warning', async () => {
      const existingSite = createTestSite('existing-site');
      const deletedSite = createTestSite('deleted-site');

      addSite(existingSite);
      addSite(deletedSite);

      fsMocks = mockFilesystem({
        [existingSite.path]: '__DIR__'
        // deletedSite path does not exist
      });

      execaMock.mockImplementation(async (cmd, args) => {
        const targetPath = args[args.length - 1];
        if (targetPath === existingSite.path) {
          return createExecaResponse('200M\t' + targetPath);
        }
        throw new Error('No such file or directory');
      });

      const sites = listAllSites();
      const existingInfo = await getBasicSiteInfo(existingSite.name);
      const deletedInfo = await getBasicSiteInfo(deletedSite.name);

      expect(sites).toHaveLength(2);
      expect(existingInfo.exists).toBe(true);
      expect(deletedInfo.exists).toBe(false);
      expect(deletedInfo.directorySize).toBe('N/A');
    });

    it.skip('should display site URLs correctly', async () => {
      const site1 = createTestSite('site-1', { url: 'site-1.test' });
      const site2 = createTestSite('site-2', { url: 'custom-domain.local' });

      addSite(site1);
      addSite(site2);

      fsMocks = mockFilesystem({
        [site1.path]: '__DIR__',
        [site2.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        return createExecaResponse('100M\t' + args[args.length - 1]);
      });

      const sites = listAllSites();

      expect(sites[0].url).toBe('site-1.test');
      expect(sites[1].url).toBe('custom-domain.local');
    });

    it('should show creation dates', () => {
      const now = Date.now();
      const site = createTestSite('my-site', { created_at: now });
      addSite(site);

      const sites = listAllSites();

      expect(sites[0].created_at).toBe(now);
    });

    it('should handle sites created at different times', () => {
      const oldSite = createTestSite('old-site', { created_at: Date.now() - 86400000 * 30 }); // 30 days ago
      const newSite = createTestSite('new-site', { created_at: Date.now() }); // now

      addSite(oldSite);
      addSite(newSite);

      const sites = listAllSites();

      expect(sites).toHaveLength(2);
      expect(sites[0].created_at).toBeLessThan(sites[1].created_at);
    });

    it.skip('should show directory sizes for existing sites', async () => {
      const smallSite = createTestSite('small-site');
      const largeSite = createTestSite('large-site');

      addSite(smallSite);
      addSite(largeSite);

      fsMocks = mockFilesystem({
        [smallSite.path]: '__DIR__',
        [largeSite.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        const targetPath = args[args.length - 1];
        if (targetPath === smallSite.path) {
          return createExecaResponse('50M\t' + targetPath);
        }
        if (targetPath === largeSite.path) {
          return createExecaResponse('1.5G\t' + targetPath);
        }
      });

      const smallInfo = await getBasicSiteInfo(smallSite.name);
      const largeInfo = await getBasicSiteInfo(largeSite.name);

      expect(smallInfo.directorySize).toBe('50M');
      expect(largeInfo.directorySize).toBe('1.5G');
    });

    it.skip('should handle du command failures gracefully', async () => {
      const site = createTestSite('my-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockRejectedValue(new Error('du failed'));

      const info = await getBasicSiteInfo(site.name);

      expect(info.exists).toBe(true);
      expect(info.directorySize).toBe('Unknown');
    });
  });

  describe('wpmax ls (alias)', () => {
    it.skip('should work identically to wpmax list', async () => {
      const site = createTestSite('my-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockResolvedValue(createExecaResponse('100M\t' + site.path));

      const sites = listAllSites();
      const info = await getBasicSiteInfo(site.name);

      expect(sites).toHaveLength(1);
      expect(sites[0].name).toBe('my-site');
      expect(info.directorySize).toBe('100M');
    });
  });

  describe('site registry integration', () => {
    it('should reflect changes when sites are added', () => {
      expect(listAllSites()).toHaveLength(0);

      const site1 = createTestSite('site-1');
      addSite(site1);

      expect(listAllSites()).toHaveLength(1);

      const site2 = createTestSite('site-2');
      addSite(site2);

      expect(listAllSites()).toHaveLength(2);
    });

    it('should reflect changes when sites are removed', () => {
      const site1 = createTestSite('site-1');
      const site2 = createTestSite('site-2');

      addSite(site1);
      addSite(site2);

      expect(listAllSites()).toHaveLength(2);

      removeSite(site1.name);

      expect(listAllSites()).toHaveLength(1);
      expect(listAllSites()[0].name).toBe('site-2');
    });
  });

  describe('sorting and display', () => {
    it('should maintain insertion order', () => {
      const site1 = createTestSite('zebra-site');
      const site2 = createTestSite('alpha-site');
      const site3 = createTestSite('beta-site');

      addSite(site1);
      addSite(site2);
      addSite(site3);

      const sites = listAllSites();

      expect(sites.map(s => s.name)).toEqual(['zebra-site', 'alpha-site', 'beta-site']);
    });
  });

  describe('performance with many sites', () => {
    it('should handle 50 sites efficiently', async () => {
      const sites = [];

      for (let i = 1; i <= 50; i++) {
        const site = createTestSite(`site-${i}`);
        sites.push(site);
        addSite(site);
      }

      const allSites = listAllSites();

      expect(allSites).toHaveLength(50);
      expect(allSites[0].name).toBe('site-1');
      expect(allSites[49].name).toBe('site-50');
    });
  });

  describe('edge cases', () => {
    it.skip('should handle sites with special characters in names', async () => {
      const site = createTestSite('my-site_v2.0');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockResolvedValue(createExecaResponse('100M\t' + site.path));

      const sites = listAllSites();

      expect(sites).toHaveLength(1);
      expect(sites[0].name).toBe('my-site_v2.0');
    });

    it('should handle sites with custom database names', () => {
      const site = createTestSite('my-site', { dbName: 'custom_database_name' });
      addSite(site);

      const sites = listAllSites();

      expect(sites[0].dbName).toBe('custom_database_name');
    });

    it('should handle sites with different admin users', () => {
      const site = createTestSite('my-site', { adminUser: 'superadmin' });
      addSite(site);

      const sites = listAllSites();

      expect(sites[0].adminUser).toBe('superadmin');
    });
  });
});