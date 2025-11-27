// tests/unit/config.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getConfig,
  setConfig,
  getConfigValue,
  addToConfig,
  removeFromConfig,
  ensureDefaultConfig
} from '../../src/config.js';
import { mockFilesystem, restoreFilesystem } from '../helpers/mock-filesystem.js';
import path from 'path';
import os from 'os';

const CONFIG_FILE = path.join(os.homedir(), '.config', 'wpmax', 'config.json');
const CONFIG_DIR = path.join(os.homedir(), '.config', 'wpmax');

describe('config', () => {
  let fsMocks;

  beforeEach(() => {
    // Setup clean filesystem mock before each test
    fsMocks = mockFilesystem({
      [CONFIG_DIR]: '__DIR__'
    });
  });

  afterEach(() => {
    restoreFilesystem();
  });

  describe('getConfig', () => {
    it('should return empty object if config file does not exist', () => {
      const config = getConfig();
      expect(config).toEqual({});
    });

    it('should return parsed config when file exists', () => {
      const testConfig = { dbuser: 'root', dbhost: '127.0.0.1' };
      fsMocks._storage[CONFIG_FILE] = JSON.stringify(testConfig);

      const config = getConfig();
      expect(config).toEqual(testConfig);
    });

    it('should return empty object on JSON parse error', () => {
      fsMocks._storage[CONFIG_FILE] = 'invalid json';

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const config = getConfig();

      expect(config).toEqual({});
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle empty config file', () => {
      fsMocks._storage[CONFIG_FILE] = '{}';

      const config = getConfig();
      expect(config).toEqual({});
    });
  });

  describe('setConfig', () => {
    it('should set a simple string value', () => {
      setConfig('dbuser', 'myuser');

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.dbuser).toBe('myuser');
    });

    it('should set array values for publicPlugins', () => {
      setConfig('publicPlugins', 'woocommerce,yoast-seo');

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.publicPlugins).toEqual(['woocommerce', 'yoast-seo']);
    });

    it('should trim whitespace in array values', () => {
      setConfig('publicPlugins', 'plugin1 , plugin2 , plugin3');

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.publicPlugins).toEqual(['plugin1', 'plugin2', 'plugin3']);
    });

    it('should filter out empty array values', () => {
      setConfig('publicPlugins', 'plugin1,,plugin2,');

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.publicPlugins).toEqual(['plugin1', 'plugin2']);
    });

    it('should update existing config values', () => {
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({ dbuser: 'olduser' });

      setConfig('dbuser', 'newuser');

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.dbuser).toBe('newuser');
    });

    it('should preserve other config values when setting new one', () => {
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({ dbuser: 'root', dbhost: '127.0.0.1' });

      setConfig('dbprefix', 'wp_');

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.dbuser).toBe('root');
      expect(config.dbhost).toBe('127.0.0.1');
      expect(config.dbprefix).toBe('wp_');
    });

    it('should create config directory if it does not exist', () => {
      delete fsMocks._storage[CONFIG_DIR];

      setConfig('dbuser', 'root');

      expect(fsMocks._storage[CONFIG_DIR]).toBe('__DIR__');
    });
  });

  describe('getConfigValue', () => {
    it('should return value for existing key', () => {
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({ dbuser: 'root' });

      const value = getConfigValue('dbuser');
      expect(value).toBe('root');
    });

    it('should return undefined for non-existent key', () => {
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({ dbuser: 'root' });

      const value = getConfigValue('nonexistent');
      expect(value).toBeUndefined();
    });

    it('should return undefined when config file does not exist', () => {
      const value = getConfigValue('dbuser');
      expect(value).toBeUndefined();
    });

    it('should return array values correctly', () => {
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({ publicPlugins: ['plugin1', 'plugin2'] });

      const value = getConfigValue('publicPlugins');
      expect(value).toEqual(['plugin1', 'plugin2']);
    });
  });

  describe('addToConfig', () => {
    it('should add value to non-existent array', () => {
      addToConfig('publicPlugins', 'woocommerce');

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.publicPlugins).toEqual(['woocommerce']);
    });

    it('should add value to existing array', () => {
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({ publicPlugins: ['plugin1'] });

      addToConfig('publicPlugins', 'plugin2');

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.publicPlugins).toEqual(['plugin1', 'plugin2']);
    });

    it('should add multiple comma-separated values', () => {
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({ publicPlugins: ['plugin1'] });

      addToConfig('publicPlugins', 'plugin2,plugin3');

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.publicPlugins).toEqual(['plugin1', 'plugin2', 'plugin3']);
    });

    it('should not add duplicate values', () => {
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({ publicPlugins: ['plugin1'] });

      addToConfig('publicPlugins', 'plugin1,plugin2');

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.publicPlugins).toEqual(['plugin1', 'plugin2']);
    });

    it('should convert non-array value to array', () => {
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({ publicPlugins: 'not-an-array' });

      addToConfig('publicPlugins', 'plugin1');

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(Array.isArray(config.publicPlugins)).toBe(true);
      expect(config.publicPlugins).toEqual(['plugin1']);
    });

    it('should handle whitespace in comma-separated values', () => {
      addToConfig('publicPlugins', 'plugin1 , plugin2 , plugin3');

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.publicPlugins).toEqual(['plugin1', 'plugin2', 'plugin3']);
    });
  });

  describe('removeFromConfig', () => {
    it('should remove value from array', () => {
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({ publicPlugins: ['plugin1', 'plugin2', 'plugin3'] });

      removeFromConfig('publicPlugins', 'plugin2');

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.publicPlugins).toEqual(['plugin1', 'plugin3']);
    });

    it('should remove multiple comma-separated values', () => {
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({ publicPlugins: ['plugin1', 'plugin2', 'plugin3'] });

      removeFromConfig('publicPlugins', 'plugin1,plugin3');

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.publicPlugins).toEqual(['plugin2']);
    });

    it('should handle non-existent values gracefully', () => {
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({ publicPlugins: ['plugin1', 'plugin2'] });

      removeFromConfig('publicPlugins', 'nonexistent');

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.publicPlugins).toEqual(['plugin1', 'plugin2']);
    });

    it('should do nothing if config key is not an array', () => {
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({ dbuser: 'root' });

      removeFromConfig('dbuser', 'root');

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.dbuser).toBe('root');
    });

    it('should handle empty array', () => {
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({ publicPlugins: [] });

      removeFromConfig('publicPlugins', 'plugin1');

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.publicPlugins).toEqual([]);
    });

    it('should handle whitespace in comma-separated values', () => {
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({ publicPlugins: ['plugin1', 'plugin2', 'plugin3'] });

      removeFromConfig('publicPlugins', 'plugin1 , plugin3');

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.publicPlugins).toEqual(['plugin2']);
    });
  });

  describe('ensureDefaultConfig', () => {
    it('should create config with default publicPlugins array', () => {
      ensureDefaultConfig();

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.publicPlugins).toEqual([]);
    });

    it('should not override existing config values', () => {
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({
        dbuser: 'root',
        publicPlugins: ['woocommerce']
      });

      ensureDefaultConfig();

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.dbuser).toBe('root');
      expect(config.publicPlugins).toEqual(['woocommerce']);
    });

    it('should add publicPlugins if missing but keep other values', () => {
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({ dbuser: 'root' });

      ensureDefaultConfig();

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.dbuser).toBe('root');
      expect(config.publicPlugins).toEqual([]);
    });

    it('should not write file if no changes needed', () => {
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({ publicPlugins: [] });
      const initialContent = fsMocks._storage[CONFIG_FILE];

      ensureDefaultConfig();

      expect(fsMocks._storage[CONFIG_FILE]).toBe(initialContent);
    });

    it('should create config directory if it does not exist', () => {
      delete fsMocks._storage[CONFIG_DIR];

      ensureDefaultConfig();

      expect(fsMocks._storage[CONFIG_DIR]).toBe('__DIR__');
    });
  });
});