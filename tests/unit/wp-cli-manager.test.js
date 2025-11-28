// tests/unit/wp-cli-manager.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ensureWpCli, getWpCliCommand } from '../../src/wp-cli-manager.js';
import { mockFilesystem } from '../helpers/mock-filesystem.js';
import { createExecaResponse } from '../helpers/mock-execa.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const WP_CLI_PATH = path.join(__dirname, '../../bin/wp-cli.phar');

// Mock modules
vi.mock('execa', () => ({
  execa: vi.fn()
}));

vi.mock('https', () => ({
  default: {
    get: vi.fn()
  }
}));

describe('WP-CLI Manager', () => {
  let execaMock;
  let httpsMock;
  let fsMocks;

  beforeEach(async () => {
    const { execa } = await import('execa');
    const https = await import('https');
    execaMock = execa;
    httpsMock = https.default.get;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getWpCliCommand', () => {
    it('should return the WP-CLI command array', () => {
      const result = getWpCliCommand();
      expect(result).toEqual(['php', expect.stringContaining('wp-cli.phar')]);
      expect(result[0]).toBe('php');
      expect(result[1]).toContain('bin/wp-cli.phar');
    });
  });

  describe('ensureWpCli', () => {
    it('should return command if wp-cli.phar already exists', async () => {
      fsMocks = mockFilesystem({
        [WP_CLI_PATH]: '__PHAR_FILE__'
      });

      execaMock.mockResolvedValue(createExecaResponse('PHP 8.1.0'));

      const result = await ensureWpCli();
      expect(result).toEqual(['php', expect.stringContaining('wp-cli.phar')]);
      expect(httpsMock).not.toHaveBeenCalled();
    });

    it('should download wp-cli.phar if it does not exist', async () => {
      fsMocks = mockFilesystem({});

      execaMock.mockResolvedValue(createExecaResponse('PHP 8.1.0'));

      // Mock HTTPS download
      const mockWriteStream = {
        close: vi.fn(),
        on: vi.fn((event, callback) => {
          if (event === 'finish') {
            setTimeout(() => {
              fsMocks._storage[WP_CLI_PATH] = '__DOWNLOADED_PHAR__';
              callback();
            }, 0);
          }
          return mockWriteStream;
        })
      };

      const mockResponse = {
        statusCode: 200,
        pipe: vi.fn(() => {
          setTimeout(() => {
            mockWriteStream.on('finish', mockWriteStream.on.mock.calls[0][1]);
          }, 0);
          return mockResponse;
        })
      };

      httpsMock.mockImplementation((url, callback) => {
        callback(mockResponse);
        return { on: vi.fn() };
      });

      // Mock fs.createWriteStream and chmodSync
      const fsModule = await import('fs');
      const createWriteStreamSpy = vi.spyOn(fsModule.default, 'createWriteStream').mockReturnValue(mockWriteStream);
      const chmodSyncSpy = vi.spyOn(fsModule.default, 'chmodSync').mockImplementation(() => {});

      const result = await ensureWpCli();

      expect(result).toEqual(['php', expect.stringContaining('wp-cli.phar')]);
      expect(httpsMock).toHaveBeenCalledWith(
        'https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar',
        expect.any(Function)
      );
      expect(createWriteStreamSpy).toHaveBeenCalled();
      expect(chmodSyncSpy).toHaveBeenCalledWith(expect.stringContaining('wp-cli.phar'), '755');

      createWriteStreamSpy.mockRestore();
      chmodSyncSpy.mockRestore();
    });

    it('should throw error if PHP is not installed', async () => {
      fsMocks = mockFilesystem({
        [WP_CLI_PATH]: '__PHAR_FILE__'
      });

      execaMock.mockRejectedValue(new Error('Command not found: php'));

      await expect(ensureWpCli()).rejects.toThrow(
        'PHP is not installed or not in PATH'
      );
    });

    it('should throw error if download fails with non-200 status', async () => {
      fsMocks = mockFilesystem({});

      execaMock.mockResolvedValue(createExecaResponse('PHP 8.1.0'));

      const mockResponse = {
        statusCode: 404
      };

      httpsMock.mockImplementation((url, callback) => {
        callback(mockResponse);
        return { on: vi.fn() };
      });

      await expect(ensureWpCli()).rejects.toThrow(
        'Failed to download WP-CLI: HTTP 404'
      );
    });

    it('should handle download network errors', async () => {
      fsMocks = mockFilesystem({});

      execaMock.mockResolvedValue(createExecaResponse('PHP 8.1.0'));

      const networkError = new Error('Network error');

      httpsMock.mockImplementation(() => ({
        on: vi.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(networkError), 0);
          }
        })
      }));

      // Mock fs.createWriteStream and unlinkSync
      const fsModule = await import('fs');
      const mockWriteStream = {
        close: vi.fn(),
        on: vi.fn()
      };

      vi.spyOn(fsModule.default, 'createWriteStream').mockReturnValue(mockWriteStream);
      const unlinkSyncSpy = vi.spyOn(fsModule.default, 'unlinkSync').mockImplementation(() => {});

      await expect(ensureWpCli()).rejects.toThrow('Network error');
      expect(unlinkSyncSpy).toHaveBeenCalledWith(expect.stringContaining('wp-cli.phar'));
    });

    it('should verify PHP version can be checked', async () => {
      fsMocks = mockFilesystem({
        [WP_CLI_PATH]: '__PHAR_FILE__'
      });

      execaMock.mockResolvedValue(createExecaResponse('PHP 8.2.15 (cli)'));

      const result = await ensureWpCli();

      expect(execaMock).toHaveBeenCalledWith('php', ['--version']);
      expect(result).toEqual(['php', expect.stringContaining('wp-cli.phar')]);
    });
  });
});