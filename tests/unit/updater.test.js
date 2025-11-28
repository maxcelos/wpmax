// tests/unit/updater.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getCurrentVersion,
  getPackageName,
  getTimeAgo,
  shouldAutoCheck,
  updateLastCheckTime
} from '../../src/updater.js';
import { mockFilesystem, restoreFilesystem } from '../helpers/mock-filesystem.js';
import path from 'path';
import os from 'os';

const CONFIG_FILE = path.join(os.homedir(), '.config', 'wpmax', 'config.json');
const CONFIG_DIR = path.join(os.homedir(), '.config', 'wpmax');

describe('updater', () => {
  let fsMocks;

  beforeEach(() => {
    fsMocks = mockFilesystem({
      [CONFIG_DIR]: '__DIR__'
    });
  });

  afterEach(() => {
    restoreFilesystem();
  });

  describe('getCurrentVersion', () => {
    it('should return version from package.json', () => {
      const version = getCurrentVersion();
      expect(version).toBeDefined();
      expect(typeof version).toBe('string');
      expect(version).toMatch(/^\d+\.\d+\.\d+/);
    });
  });

  describe('getPackageName', () => {
    it('should return package name from package.json', () => {
      const name = getPackageName();
      expect(name).toBe('wpmax');
    });
  });

  describe('getTimeAgo', () => {
    it('should return "just now" for very recent dates', () => {
      const now = new Date().toISOString();
      expect(getTimeAgo(now)).toBe('just now');
    });

    it('should return minutes for dates within last hour', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const result = getTimeAgo(fiveMinutesAgo);
      expect(result).toMatch(/\d+ minute(s)? ago/);
    });

    it('should return hours for dates within last day', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const result = getTimeAgo(twoHoursAgo);
      expect(result).toMatch(/\d+ hour(s)? ago/);
    });

    it('should return days for dates within last month', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const result = getTimeAgo(threeDaysAgo);
      expect(result).toMatch(/\d+ day(s)? ago/);
    });

    it('should return months for dates within last year', () => {
      const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const result = getTimeAgo(twoMonthsAgo);
      expect(result).toMatch(/\d+ month(s)? ago/);
    });

    it('should return years for dates over a year ago', () => {
      const oneYearAgo = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
      const result = getTimeAgo(oneYearAgo);
      expect(result).toMatch(/\d+ year(s)? ago/);
    });

    it('should handle singular vs plural correctly', () => {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      expect(getTimeAgo(oneMinuteAgo)).toBe('1 minute ago');

      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      expect(getTimeAgo(twoMinutesAgo)).toBe('2 minutes ago');
    });

    it('should handle exact boundaries correctly', () => {
      const exactly24HoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const result = getTimeAgo(exactly24HoursAgo);
      expect(result).toMatch(/\d+ (day|hour)(s)? ago/);
    });
  });

  describe('shouldAutoCheck', () => {
    it('should return true when no last check exists', () => {
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({});

      const result = shouldAutoCheck();
      expect(result).toBe(true);
    });

    it('should return true when last check was over 24 hours ago', () => {
      const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({
        lastUpdateCheck: twoDaysAgo
      });

      const result = shouldAutoCheck();
      expect(result).toBe(true);
    });

    it('should return false when last check was less than 24 hours ago', () => {
      const twelveHoursAgo = Date.now() - (12 * 60 * 60 * 1000);
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({
        lastUpdateCheck: twelveHoursAgo
      });

      const result = shouldAutoCheck();
      expect(result).toBe(false);
    });

    it('should return false when last check was very recent', () => {
      const now = Date.now();
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({
        lastUpdateCheck: now
      });

      const result = shouldAutoCheck();
      expect(result).toBe(false);
    });

    it('should return true when last check was exactly 24 hours ago', () => {
      const exactlyOneDayAgo = Date.now() - (24 * 60 * 60 * 1000) - 1; // Just over 24h
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({
        lastUpdateCheck: exactlyOneDayAgo
      });

      const result = shouldAutoCheck();
      expect(result).toBe(true);
    });

    it('should handle missing config file', () => {
      const result = shouldAutoCheck();
      expect(result).toBe(true);
    });
  });

  describe('updateLastCheckTime', () => {
    it('should update lastUpdateCheck in config', () => {
      const beforeTime = Date.now();

      updateLastCheckTime();

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.lastUpdateCheck).toBeDefined();
      expect(config.lastUpdateCheck).toBeGreaterThanOrEqual(beforeTime);
      expect(config.lastUpdateCheck).toBeLessThanOrEqual(Date.now());
    });

    it('should update existing config without removing other keys', () => {
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({
        dbuser: 'root',
        publicPlugins: []
      });

      updateLastCheckTime();

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.dbuser).toBe('root');
      expect(config.publicPlugins).toEqual([]);
      expect(config.lastUpdateCheck).toBeDefined();
    });

    it('should overwrite previous lastUpdateCheck', () => {
      const oldTime = Date.now() - 1000000;
      fsMocks._storage[CONFIG_FILE] = JSON.stringify({
        lastUpdateCheck: oldTime
      });

      updateLastCheckTime();

      const config = JSON.parse(fsMocks._storage[CONFIG_FILE]);
      expect(config.lastUpdateCheck).toBeGreaterThan(oldTime);
    });
  });
});