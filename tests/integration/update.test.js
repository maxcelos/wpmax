// tests/integration/update.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  checkForUpdate,
  performUpdate,
  detectPackageManager,
  shouldAutoCheck,
  updateLastCheckTime,
  getTimeAgo
} from '../../src/updater.js';
import { setConfig, getConfig } from '../../src/config.js';
import { mockFilesystem } from '../helpers/mock-filesystem.js';
import { createExecaResponse } from '../helpers/mock-execa.js';
import path from 'path';
import os from 'os';

// Mock modules
vi.mock('execa', () => ({
  execa: vi.fn()
}));

// Mock global fetch
global.fetch = vi.fn();

describe('Update Command Integration', () => {
  let execaMock;
  let fsMocks;
  const configPath = path.join(os.homedir(), '.config', 'wpmax', 'config.json');

  beforeEach(async () => {
    const { execa } = await import('execa');
    execaMock = execa;
    vi.clearAllMocks();
    fsMocks = mockFilesystem({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('wpmax update --check', () => {
    it('should check for updates and find one available', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          'dist-tags': { latest: '1.5.0' },
          time: { '1.5.0': '2024-01-15T10:00:00.000Z' }
        })
      });

      const updateInfo = await checkForUpdate();

      expect(updateInfo.updateAvailable).toBe(true);
      expect(updateInfo.latestVersion).toBe('1.5.0');
      expect(updateInfo.publishedAt).toBe('2024-01-15T10:00:00.000Z');
    });

    it('should check for updates and find none', async () => {
      const currentVersion = '0.1.0'; // Assuming we're on 0.1.0

      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          'dist-tags': { latest: currentVersion },
          time: { [currentVersion]: '2024-01-01T10:00:00.000Z' }
        })
      });

      const updateInfo = await checkForUpdate();

      expect(updateInfo.updateAvailable).toBe(false);
      expect(updateInfo.currentVersion).toBe(currentVersion);
      expect(updateInfo.latestVersion).toBe(currentVersion);
    });

    it('should handle registry timeout', async () => {
      global.fetch.mockImplementation(() => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            const error = new Error('Timeout');
            error.name = 'AbortError';
            reject(error);
          }, 100);
        });
      });

      await expect(checkForUpdate()).rejects.toThrow('Registry request timed out');
    });

    it('should handle registry errors', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 404
      });

      await expect(checkForUpdate()).rejects.toThrow('Registry returned 404');
    });

    it('should handle network errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      await expect(checkForUpdate()).rejects.toThrow('Failed to check for updates');
    });
  });

  describe('wpmax update (perform update)', () => {
    it('should update using npm', async () => {
      // Mock npm as available, others not
      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'npm' && args[0] === '--version') {
          throw new Error('Command not found');
        }
        if (cmd === 'pnpm' && args[0] === '--version') {
          throw new Error('Command not found');
        }
        if (cmd === 'yarn' && args[0] === '--version') {
          throw new Error('Command not found');
        }
        if (cmd === 'npm' && args.includes('install')) {
          return createExecaResponse('Success');
        }
        throw new Error('Unexpected command');
      });

      const pm = await detectPackageManager();
      expect(pm).toBe('npm');

      await performUpdate('wpmax');

      expect(execaMock).toHaveBeenCalledWith(
        'npm',
        ['install', '-g', 'wpmax@latest'],
        { stdio: 'inherit' }
      );
    });

    it('should update using pnpm', async () => {
      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'pnpm' && args[0] === '--version') {
          return createExecaResponse('8.0.0');
        }
        if (cmd === 'pnpm' && args.includes('add')) {
          return createExecaResponse('Success');
        }
        throw new Error('Command not found');
      });

      const pm = await detectPackageManager();
      expect(pm).toBe('pnpm');

      await performUpdate('wpmax');

      expect(execaMock).toHaveBeenCalledWith(
        'pnpm',
        ['add', '-g', 'wpmax@latest'],
        { stdio: 'inherit' }
      );
    });

    it('should update using yarn', async () => {
      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'pnpm') {
          throw new Error('Command not found');
        }
        if (cmd === 'yarn' && args[0] === '--version') {
          return createExecaResponse('1.22.0');
        }
        if (cmd === 'yarn' && args.includes('global')) {
          return createExecaResponse('Success');
        }
        throw new Error('Command not found');
      });

      const pm = await detectPackageManager();
      expect(pm).toBe('yarn');

      await performUpdate('wpmax');

      expect(execaMock).toHaveBeenCalledWith(
        'yarn',
        ['global', 'add', 'wpmax@latest'],
        { stdio: 'inherit' }
      );
    });

    it('should handle permission errors', async () => {
      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'npm' && args[0] === '--version') {
          throw new Error('Command not found');
        }
        if (cmd === 'pnpm' && args[0] === '--version') {
          throw new Error('Command not found');
        }
        if (cmd === 'yarn' && args[0] === '--version') {
          throw new Error('Command not found');
        }
        if (args.includes('install') || args.includes('add')) {
          const error = new Error('EACCES: permission denied');
          throw error;
        }
      });

      await expect(performUpdate('wpmax')).rejects.toThrow('Permission denied');
    });

    it('should handle update failures', async () => {
      execaMock.mockImplementation(async (cmd, args) => {
        if (args[0] === '--version') {
          throw new Error('Command not found');
        }
        if (args.includes('install')) {
          throw new Error('Update failed');
        }
      });

      await expect(performUpdate('wpmax')).rejects.toThrow('Update failed');
    });
  });

  describe('wpmax update --yes', () => {
    it('should skip confirmation and update immediately', async () => {
      execaMock.mockImplementation(async (cmd, args) => {
        if (args[0] === '--version') {
          throw new Error('Command not found');
        }
        if (args.includes('install')) {
          return createExecaResponse('Success');
        }
      });

      // Simulate --yes flag behavior (no inquirer prompt)
      await performUpdate('wpmax');

      expect(execaMock).toHaveBeenCalledWith(
        'npm',
        ['install', '-g', 'wpmax@latest'],
        { stdio: 'inherit' }
      );
    });
  });

  describe('auto-check for updates', () => {
    it('should auto-check when no previous check', () => {
      fsMocks = mockFilesystem({});

      const shouldCheck = shouldAutoCheck();

      expect(shouldCheck).toBe(true);
    });

    it('should auto-check when last check was >24 hours ago', () => {
      const twoDaysAgo = Date.now() - (2 * 24 * 60 * 60 * 1000);
      fsMocks = mockFilesystem({
        [configPath]: JSON.stringify({ lastUpdateCheck: twoDaysAgo })
      });

      const shouldCheck = shouldAutoCheck();

      expect(shouldCheck).toBe(true);
    });

    it('should not auto-check when last check was <24 hours ago', () => {
      const oneHourAgo = Date.now() - (1 * 60 * 60 * 1000);
      fsMocks = mockFilesystem({
        [configPath]: JSON.stringify({ lastUpdateCheck: oneHourAgo })
      });

      const shouldCheck = shouldAutoCheck();

      expect(shouldCheck).toBe(false);
    });

    it('should update last check time', () => {
      fsMocks = mockFilesystem({});

      const before = Date.now();
      updateLastCheckTime();
      const after = Date.now();

      const config = getConfig();
      expect(config.lastUpdateCheck).toBeGreaterThanOrEqual(before);
      expect(config.lastUpdateCheck).toBeLessThanOrEqual(after);
    });
  });

  describe('time ago formatting', () => {
    it('should format "just now" correctly', () => {
      const now = new Date().toISOString();
      const timeAgo = getTimeAgo(now);

      expect(timeAgo).toBe('just now');
    });

    it('should format minutes correctly', () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const timeAgo = getTimeAgo(fiveMinutesAgo);

      expect(timeAgo).toBe('5 minutes ago');
    });

    it('should format hours correctly', () => {
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
      const timeAgo = getTimeAgo(threeHoursAgo);

      expect(timeAgo).toBe('3 hours ago');
    });

    it('should format days correctly', () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const timeAgo = getTimeAgo(fiveDaysAgo);

      expect(timeAgo).toBe('5 days ago');
    });

    it('should format months correctly', () => {
      const twoMonthsAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
      const timeAgo = getTimeAgo(twoMonthsAgo);

      expect(timeAgo).toBe('2 months ago');
    });

    it('should format years correctly', () => {
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
      const timeAgo = getTimeAgo(oneYearAgo);

      expect(timeAgo).toBe('1 year ago');
    });

    it('should use singular for 1 unit', () => {
      const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
      const timeAgo = getTimeAgo(oneDayAgo);

      expect(timeAgo).toBe('1 day ago');
    });

    it('should use plural for multiple units', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const timeAgo = getTimeAgo(threeDaysAgo);

      expect(timeAgo).toBe('3 days ago');
    });
  });

  describe('package manager detection', () => {
    it('should detect pnpm first', async () => {
      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'pnpm' && args[0] === '--version') {
          return createExecaResponse('8.0.0');
        }
        throw new Error('Command not found');
      });

      const pm = await detectPackageManager();

      expect(pm).toBe('pnpm');
    });

    it('should detect yarn second', async () => {
      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'pnpm') {
          throw new Error('Command not found');
        }
        if (cmd === 'yarn' && args[0] === '--version') {
          return createExecaResponse('1.22.0');
        }
        throw new Error('Command not found');
      });

      const pm = await detectPackageManager();

      expect(pm).toBe('yarn');
    });

    it('should default to npm', async () => {
      execaMock.mockImplementation(async (cmd) => {
        throw new Error('Command not found');
      });

      const pm = await detectPackageManager();

      expect(pm).toBe('npm');
    });
  });

  describe('version comparison', () => {
    it('should detect major version update', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          'dist-tags': { latest: '2.0.0' },
          time: { '2.0.0': '2024-01-15T10:00:00.000Z' }
        })
      });

      const updateInfo = await checkForUpdate();

      expect(updateInfo.updateAvailable).toBe(true);
    });

    it('should detect minor version update', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          'dist-tags': { latest: '0.2.0' },
          time: { '0.2.0': '2024-01-15T10:00:00.000Z' }
        })
      });

      const updateInfo = await checkForUpdate();

      expect(updateInfo.updateAvailable).toBe(true);
    });

    it('should detect patch version update', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          'dist-tags': { latest: '0.1.1' },
          time: { '0.1.1': '2024-01-15T10:00:00.000Z' }
        })
      });

      const updateInfo = await checkForUpdate();

      expect(updateInfo.updateAvailable).toBe(true);
    });

    it('should handle pre-release versions', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          'dist-tags': { latest: '1.0.0-beta.1' },
          time: { '1.0.0-beta.1': '2024-01-15T10:00:00.000Z' }
        })
      });

      const updateInfo = await checkForUpdate();

      expect(updateInfo.latestVersion).toBe('1.0.0-beta.1');
    });
  });

  describe('edge cases', () => {
    it('should handle malformed registry response', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          // Missing dist-tags
        })
      });

      await expect(checkForUpdate()).rejects.toThrow();
    });

    it('should handle network timeout gracefully', async () => {
      global.fetch.mockImplementation(() => {
        return new Promise((_, reject) => {
          const error = new Error('Timeout');
          error.name = 'AbortError';
          setTimeout(() => reject(error), 100);
        });
      });

      await expect(checkForUpdate()).rejects.toThrow('Registry request timed out');
    });
  });
});