// tests/integration/config.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getConfig, setConfig, getConfigValue, addToConfig, removeFromConfig, ensureDefaultConfig } from '../../src/config.js';
import { mockFilesystem } from '../helpers/mock-filesystem.js';
import path from 'path';
import os from 'os';

describe('Config Command Integration', () => {
  let fsMocks;
  const configPath = path.join(os.homedir(), '.config', 'wpmax', 'config.json');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('config --list', () => {
    it('should list all configuration values', () => {
      fsMocks = mockFilesystem({
        [configPath]: JSON.stringify({
          defaultPluginsPath: '/Users/test/plugins',
          dbuser: 'root',
          publicPlugins: ['woocommerce', 'yoast-seo']
        })
      });

      const config = getConfig();

      expect(config.defaultPluginsPath).toBe('/Users/test/plugins');
      expect(config.dbuser).toBe('root');
      expect(config.publicPlugins).toEqual(['woocommerce', 'yoast-seo']);
    });

    it('should handle empty config', () => {
      fsMocks = mockFilesystem({});

      const config = getConfig();

      expect(Object.keys(config)).toHaveLength(0);
    });
  });

  describe('config --set', () => {
    it('should set a simple config value', () => {
      fsMocks = mockFilesystem({});

      setConfig('dbuser', 'admin');
      const config = getConfig();

      expect(config.dbuser).toBe('admin');
    });

    it('should set multiple config values', () => {
      fsMocks = mockFilesystem({});

      setConfig('dbuser', 'root');
      setConfig('dbhost', 'localhost');
      setConfig('dbprefix', 'wp_');

      const config = getConfig();

      expect(config.dbuser).toBe('root');
      expect(config.dbhost).toBe('localhost');
      expect(config.dbprefix).toBe('wp_');
    });

    it('should overwrite existing config value', () => {
      fsMocks = mockFilesystem({
        [configPath]: JSON.stringify({ dbuser: 'root' })
      });

      setConfig('dbuser', 'admin');
      const config = getConfig();

      expect(config.dbuser).toBe('admin');
    });

    it('should set admin-user config', () => {
      fsMocks = mockFilesystem({});

      setConfig('adminUser', 'superadmin');
      const config = getConfig();

      expect(config.adminUser).toBe('superadmin');
    });

    it('should set admin-email config', () => {
      fsMocks = mockFilesystem({});

      setConfig('adminEmail', 'test@example.com');
      const config = getConfig();

      expect(config.adminEmail).toBe('test@example.com');
    });

    it('should set tld config', () => {
      fsMocks = mockFilesystem({});

      setConfig('tld', '.local');
      const config = getConfig();

      expect(config.tld).toBe('.local');
    });
  });

  describe('config --add (array values)', () => {
    it('should add plugin to empty publicPlugins array', () => {
      fsMocks = mockFilesystem({});

      addToConfig('publicPlugins', 'woocommerce');
      const config = getConfig();

      expect(config.publicPlugins).toEqual(['woocommerce']);
    });

    it('should add multiple plugins to publicPlugins', () => {
      fsMocks = mockFilesystem({});

      addToConfig('publicPlugins', 'woocommerce');
      addToConfig('publicPlugins', 'yoast-seo');
      addToConfig('publicPlugins', 'contact-form-7');

      const config = getConfig();

      expect(config.publicPlugins).toEqual(['woocommerce', 'yoast-seo', 'contact-form-7']);
    });

    it('should not add duplicate plugin', () => {
      fsMocks = mockFilesystem({
        [configPath]: JSON.stringify({ publicPlugins: ['woocommerce'] })
      });

      addToConfig('publicPlugins', 'woocommerce');
      const config = getConfig();

      expect(config.publicPlugins).toEqual(['woocommerce']);
    });

    it('should add comma-separated plugins', () => {
      fsMocks = mockFilesystem({});

      addToConfig('publicPlugins', 'woocommerce,yoast-seo,akismet');
      const config = getConfig();

      expect(config.publicPlugins).toEqual(['woocommerce', 'yoast-seo', 'akismet']);
    });
  });

  describe('config --remove (array values)', () => {
    it('should remove plugin from publicPlugins', () => {
      fsMocks = mockFilesystem({
        [configPath]: JSON.stringify({ publicPlugins: ['woocommerce', 'yoast-seo', 'akismet'] })
      });

      removeFromConfig('publicPlugins', 'yoast-seo');
      const config = getConfig();

      expect(config.publicPlugins).toEqual(['woocommerce', 'akismet']);
    });

    it('should handle removing non-existent plugin', () => {
      fsMocks = mockFilesystem({
        [configPath]: JSON.stringify({ publicPlugins: ['woocommerce'] })
      });

      removeFromConfig('publicPlugins', 'yoast-seo');
      const config = getConfig();

      expect(config.publicPlugins).toEqual(['woocommerce']);
    });

    it('should handle empty array after removal', () => {
      fsMocks = mockFilesystem({
        [configPath]: JSON.stringify({ publicPlugins: ['woocommerce'] })
      });

      removeFromConfig('publicPlugins', 'woocommerce');
      const config = getConfig();

      expect(config.publicPlugins).toEqual([]);
    });

    it('should remove comma-separated plugins', () => {
      fsMocks = mockFilesystem({
        [configPath]: JSON.stringify({ publicPlugins: ['woocommerce', 'yoast-seo', 'akismet', 'jetpack'] })
      });

      removeFromConfig('publicPlugins', 'yoast-seo,akismet');
      const config = getConfig();

      expect(config.publicPlugins).toEqual(['woocommerce', 'jetpack']);
    });
  });

  describe('getConfigValue', () => {
    it('should get specific config value', () => {
      fsMocks = mockFilesystem({
        [configPath]: JSON.stringify({ dbuser: 'root', dbhost: 'localhost' })
      });

      const dbuser = getConfigValue('dbuser');
      const dbhost = getConfigValue('dbhost');

      expect(dbuser).toBe('root');
      expect(dbhost).toBe('localhost');
    });

    it('should return undefined for non-existent key', () => {
      fsMocks = mockFilesystem({});

      const value = getConfigValue('nonExistent');

      expect(value).toBeUndefined();
    });

    it('should get array config value', () => {
      fsMocks = mockFilesystem({
        [configPath]: JSON.stringify({ publicPlugins: ['woocommerce', 'yoast-seo'] })
      });

      const plugins = getConfigValue('publicPlugins');

      expect(plugins).toEqual(['woocommerce', 'yoast-seo']);
    });
  });

  describe('ensureDefaultConfig', () => {
    it('should create config file if it does not exist', async () => {
      const fs = await import('fs');
      const mkdirSyncSpy = vi.spyOn(fs.default, 'mkdirSync').mockImplementation(() => {});
      const existsSyncSpy = vi.spyOn(fs.default, 'existsSync').mockReturnValue(false);
      const writeFileSyncSpy = vi.spyOn(fs.default, 'writeFileSync').mockImplementation(() => {});

      ensureDefaultConfig();

      expect(mkdirSyncSpy).toHaveBeenCalled();
      expect(writeFileSyncSpy).toHaveBeenCalled();

      mkdirSyncSpy.mockRestore();
      existsSyncSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
    });

    it('should not overwrite existing config', async () => {
      const fs = await import('fs');
      const existsSyncSpy = vi.spyOn(fs.default, 'existsSync').mockReturnValue(true);
      const writeFileSyncSpy = vi.spyOn(fs.default, 'writeFileSync').mockImplementation(() => {});

      ensureDefaultConfig();

      expect(writeFileSyncSpy).not.toHaveBeenCalled();

      existsSyncSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
    });
  });

  describe('config path handling', () => {
    it('should handle defaultPluginsPath', () => {
      fsMocks = mockFilesystem({});

      setConfig('defaultPluginsPath', '/Users/test/plugins');
      const config = getConfig();

      expect(config.defaultPluginsPath).toBe('/Users/test/plugins');
    });

    it('should handle defaultThemesPath', () => {
      fsMocks = mockFilesystem({});

      setConfig('defaultThemesPath', '/Users/test/themes');
      const config = getConfig();

      expect(config.defaultThemesPath).toBe('/Users/test/themes');
    });
  });

  describe('config persistence', () => {
    it('should persist config across multiple operations', () => {
      fsMocks = mockFilesystem({});

      setConfig('dbuser', 'root');
      setConfig('dbhost', 'localhost');
      addToConfig('publicPlugins', 'woocommerce');
      addToConfig('publicPlugins', 'yoast-seo');

      const config = getConfig();

      expect(config.dbuser).toBe('root');
      expect(config.dbhost).toBe('localhost');
      expect(config.publicPlugins).toEqual(['woocommerce', 'yoast-seo']);
    });

    it('should maintain other values when setting new ones', () => {
      fsMocks = mockFilesystem({
        [configPath]: JSON.stringify({
          dbuser: 'root',
          publicPlugins: ['woocommerce']
        })
      });

      setConfig('dbhost', 'localhost');
      const config = getConfig();

      expect(config.dbuser).toBe('root');
      expect(config.dbhost).toBe('localhost');
      expect(config.publicPlugins).toEqual(['woocommerce']);
    });
  });

  describe('edge cases', () => {
    it('should handle special characters in config values', () => {
      fsMocks = mockFilesystem({});

      setConfig('dbprefix', 'my_custom_prefix_');
      const config = getConfig();

      expect(config.dbprefix).toBe('my_custom_prefix_');
    });

    it('should handle numeric values as strings', () => {
      fsMocks = mockFilesystem({});

      setConfig('dbhost', '127.0.0.1');
      const config = getConfig();

      expect(config.dbhost).toBe('127.0.0.1');
    });

    it('should handle port in dbhost', () => {
      fsMocks = mockFilesystem({});

      setConfig('dbhost', 'localhost:3306');
      const config = getConfig();

      expect(config.dbhost).toBe('localhost:3306');
    });
  });
});