// tests/unit/site-registry.test.js
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  addSite,
  getSite,
  siteExists,
  listAllSites,
  removeSite,
  getSitesFilePath
} from '../../src/site-registry.js';
import { mockFilesystem, restoreFilesystem } from '../helpers/mock-filesystem.js';
import { createTestSite } from '../helpers/test-data.js';
import path from 'path';
import os from 'os';

const SITES_FILE = path.join(os.homedir(), '.config', 'wpmax', 'sites.json');
const SITES_DIR = path.join(os.homedir(), '.config', 'wpmax');

describe('site-registry', () => {
  let fsMocks;

  beforeEach(() => {
    fsMocks = mockFilesystem({
      [SITES_DIR]: '__DIR__'
    });
  });

  afterEach(() => {
    restoreFilesystem();
  });

  describe('listAllSites', () => {
    it('should return empty array when sites file does not exist', () => {
      const sites = listAllSites();
      expect(sites).toEqual([]);
    });

    it('should return empty array when sites array is empty', () => {
      fsMocks._storage[SITES_FILE] = JSON.stringify({ sites: [] });

      const sites = listAllSites();
      expect(sites).toEqual([]);
    });

    it('should return all sites from registry', () => {
      const testSites = [
        createTestSite('site1'),
        createTestSite('site2'),
        createTestSite('site3')
      ];
      fsMocks._storage[SITES_FILE] = JSON.stringify({ sites: testSites });

      const sites = listAllSites();
      expect(sites).toHaveLength(3);
      expect(sites).toEqual(testSites);
    });

    it('should return empty array on JSON parse error', () => {
      fsMocks._storage[SITES_FILE] = 'invalid json';

      const sites = listAllSites();
      expect(sites).toEqual([]);
    });

    it('should handle missing sites property in JSON', () => {
      fsMocks._storage[SITES_FILE] = JSON.stringify({});

      const sites = listAllSites();
      expect(sites).toEqual([]);
    });
  });

  describe('getSite', () => {
    it('should return site by name', () => {
      const testSite = createTestSite('my-site');
      fsMocks._storage[SITES_FILE] = JSON.stringify({ sites: [testSite] });

      const site = getSite('my-site');
      expect(site).toEqual(testSite);
    });

    it('should return undefined for non-existent site', () => {
      fsMocks._storage[SITES_FILE] = JSON.stringify({ sites: [] });

      const site = getSite('nonexistent');
      expect(site).toBeUndefined();
    });

    it('should return first match when multiple sites have same name', () => {
      const site1 = createTestSite('my-site', { path: '/path1' });
      const site2 = createTestSite('my-site', { path: '/path2' });
      fsMocks._storage[SITES_FILE] = JSON.stringify({ sites: [site1, site2] });

      const site = getSite('my-site');
      expect(site.path).toBe('/path1');
    });

    it('should return undefined when sites file does not exist', () => {
      const site = getSite('my-site');
      expect(site).toBeUndefined();
    });
  });

  describe('siteExists', () => {
    it('should return true for existing site', () => {
      const testSite = createTestSite('my-site');
      fsMocks._storage[SITES_FILE] = JSON.stringify({ sites: [testSite] });

      expect(siteExists('my-site')).toBe(true);
    });

    it('should return false for non-existent site', () => {
      fsMocks._storage[SITES_FILE] = JSON.stringify({ sites: [] });

      expect(siteExists('nonexistent')).toBe(false);
    });

    it('should return false when sites file does not exist', () => {
      expect(siteExists('my-site')).toBe(false);
    });
  });

  describe('addSite', () => {
    it('should add new site to empty registry', () => {
      const testSite = createTestSite('my-site');

      addSite(testSite);

      const data = JSON.parse(fsMocks._storage[SITES_FILE]);
      expect(data.sites).toHaveLength(1);
      expect(data.sites[0]).toEqual(testSite);
    });

    it('should add new site to existing registry', () => {
      const site1 = createTestSite('site1');
      fsMocks._storage[SITES_FILE] = JSON.stringify({ sites: [site1] });

      const site2 = createTestSite('site2');
      addSite(site2);

      const data = JSON.parse(fsMocks._storage[SITES_FILE]);
      expect(data.sites).toHaveLength(2);
      expect(data.sites[0]).toEqual(site1);
      expect(data.sites[1]).toEqual(site2);
    });

    it('should replace existing site with same name', () => {
      const oldSite = createTestSite('my-site', { path: '/old/path' });
      fsMocks._storage[SITES_FILE] = JSON.stringify({ sites: [oldSite] });

      const newSite = createTestSite('my-site', { path: '/new/path' });
      addSite(newSite);

      const data = JSON.parse(fsMocks._storage[SITES_FILE]);
      expect(data.sites).toHaveLength(1);
      expect(data.sites[0].path).toBe('/new/path');
    });

    it('should create sites file if it does not exist', () => {
      const testSite = createTestSite('my-site');

      addSite(testSite);

      expect(fsMocks._storage[SITES_FILE]).toBeDefined();
      const data = JSON.parse(fsMocks._storage[SITES_FILE]);
      expect(data.sites).toHaveLength(1);
    });

    it('should preserve other sites when replacing', () => {
      const site1 = createTestSite('site1');
      const site2 = createTestSite('site2');
      const site3 = createTestSite('site3');
      fsMocks._storage[SITES_FILE] = JSON.stringify({ sites: [site1, site2, site3] });

      const updatedSite2 = createTestSite('site2', { path: '/updated/path' });
      addSite(updatedSite2);

      const data = JSON.parse(fsMocks._storage[SITES_FILE]);
      expect(data.sites).toHaveLength(3);

      // When replacing, the site is removed and added to the end
      expect(data.sites[0]).toEqual(site1);
      expect(data.sites[1]).toEqual(site3);
      expect(data.sites[2].name).toBe('site2');
      expect(data.sites[2].path).toBe('/updated/path');
    });

    it('should add created_at if not provided', () => {
      const siteWithoutDate = {
        name: 'test-site',
        path: '/path/to/site',
        url: 'test-site.test',
        dbName: 'test_site',
        dbUser: 'root',
        dbHost: '127.0.0.1',
        adminUser: 'admin',
        adminEmail: 'admin@test.com'
      };

      addSite(siteWithoutDate);

      const data = JSON.parse(fsMocks._storage[SITES_FILE]);
      expect(data.sites[0].created_at).toBeDefined();
      expect(typeof data.sites[0].created_at).toBe('string');
    });

    it('should create directory if it does not exist', () => {
      delete fsMocks._storage[SITES_DIR];

      const testSite = createTestSite('my-site');
      addSite(testSite);

      expect(fsMocks._storage[SITES_DIR]).toBe('__DIR__');
    });
  });

  describe('removeSite', () => {
    it('should remove site from registry', () => {
      const site1 = createTestSite('site1');
      const site2 = createTestSite('site2');
      fsMocks._storage[SITES_FILE] = JSON.stringify({ sites: [site1, site2] });

      removeSite('site1');

      const data = JSON.parse(fsMocks._storage[SITES_FILE]);
      expect(data.sites).toHaveLength(1);
      expect(data.sites[0].name).toBe('site2');
    });

    it('should handle removing non-existent site', () => {
      const site1 = createTestSite('site1');
      fsMocks._storage[SITES_FILE] = JSON.stringify({ sites: [site1] });

      removeSite('nonexistent');

      const data = JSON.parse(fsMocks._storage[SITES_FILE]);
      expect(data.sites).toHaveLength(1);
      expect(data.sites[0]).toEqual(site1);
    });

    it('should handle removing from empty registry', () => {
      fsMocks._storage[SITES_FILE] = JSON.stringify({ sites: [] });

      removeSite('my-site');

      const data = JSON.parse(fsMocks._storage[SITES_FILE]);
      expect(data.sites).toEqual([]);
    });

    it('should create empty registry if file does not exist', () => {
      removeSite('my-site');

      const data = JSON.parse(fsMocks._storage[SITES_FILE]);
      expect(data.sites).toEqual([]);
    });

    it('should preserve other sites when removing one', () => {
      const site1 = createTestSite('site1');
      const site2 = createTestSite('site2');
      const site3 = createTestSite('site3');
      fsMocks._storage[SITES_FILE] = JSON.stringify({ sites: [site1, site2, site3] });

      removeSite('site2');

      const data = JSON.parse(fsMocks._storage[SITES_FILE]);
      expect(data.sites).toHaveLength(2);
      expect(data.sites[0]).toEqual(site1);
      expect(data.sites[1]).toEqual(site3);
    });
  });

  describe('getSitesFilePath', () => {
    it('should return correct sites file path', () => {
      const filePath = getSitesFilePath();
      expect(filePath).toBe(SITES_FILE);
    });
  });
});