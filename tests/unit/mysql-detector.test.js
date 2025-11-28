// tests/unit/mysql-detector.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { detectMySQLConnection, getMySQLConnection } from '../../src/mysql-detector.js';
import { mockExeca, createExecaResponse, createExecaError } from '../helpers/mock-execa.js';
import { mockFilesystem } from '../helpers/mock-filesystem.js';

// Mock execa module
vi.mock('execa', () => ({
  execa: vi.fn()
}));

describe('MySQL Detector', () => {
  let execaMock;
  let fsMocks;

  beforeEach(async () => {
    // Import the real execa module to get the mock
    const { execa } = await import('execa');
    execaMock = execa;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectMySQLConnection', () => {
    it('should throw error if mysql client is not installed', async () => {
      execaMock.mockRejectedValue(new Error('Command not found: mysql'));

      await expect(detectMySQLConnection()).rejects.toThrow(
        'MySQL client is not installed or not in PATH'
      );
    });

    it('should return 127.0.0.1 when TCP connection works', async () => {
      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'mysql' && args[0] === '--version') {
          return createExecaResponse('mysql Ver 8.0.33');
        }
        if (cmd === 'mysql' && args.includes('-h127.0.0.1')) {
          return createExecaResponse('1');
        }
        throw new Error('Connection failed');
      });

      const result = await detectMySQLConnection();
      expect(result).toBe('127.0.0.1');
    });

    it('should return localhost when TCP 127.0.0.1 fails but localhost works', async () => {
      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'mysql' && args[0] === '--version') {
          return createExecaResponse('mysql Ver 8.0.33');
        }
        if (cmd === 'mysql' && args.includes('-hlocalhost')) {
          return createExecaResponse('1');
        }
        throw new Error('Connection failed');
      });

      const result = await detectMySQLConnection();
      expect(result).toBe('localhost');
    });

    it('should fall back to socket path when TCP connections fail', async () => {
      fsMocks = mockFilesystem({
        '/tmp/mysql_3306.sock': '__SOCKET__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'mysql' && args[0] === '--version') {
          return createExecaResponse('mysql Ver 8.0.33');
        }
        if (cmd === 'mysql' && args.includes('--socket=/tmp/mysql_3306.sock')) {
          return createExecaResponse('1');
        }
        throw new Error('Connection failed');
      });

      const result = await detectMySQLConnection();
      expect(result).toBe('localhost:/tmp/mysql_3306.sock');
    });

    it('should try multiple socket paths if first ones fail', async () => {
      fsMocks = mockFilesystem({
        '/tmp/mysql.sock': '__SOCKET__',
        '/var/run/mysqld/mysqld.sock': '__SOCKET__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'mysql' && args[0] === '--version') {
          return createExecaResponse('mysql Ver 8.0.33');
        }
        if (cmd === 'mysql' && args.includes('--socket=/tmp/mysql.sock')) {
          return createExecaResponse('1');
        }
        throw new Error('Connection failed');
      });

      const result = await detectMySQLConnection();
      expect(result).toBe('localhost:/tmp/mysql.sock');
    });

    it('should skip non-existent socket paths', async () => {
      fsMocks = mockFilesystem({
        '/opt/homebrew/var/mysql/mysql.sock': '__SOCKET__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'mysql' && args[0] === '--version') {
          return createExecaResponse('mysql Ver 8.0.33');
        }
        if (cmd === 'mysql' && args.includes('--socket=/opt/homebrew/var/mysql/mysql.sock')) {
          return createExecaResponse('1');
        }
        throw new Error('Connection failed');
      });

      const result = await detectMySQLConnection();
      expect(result).toBe('localhost:/opt/homebrew/var/mysql/mysql.sock');
    });

    it('should throw error when no connection method works', async () => {
      fsMocks = mockFilesystem({
        '/tmp/mysql_3306.sock': '__SOCKET__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'mysql' && args[0] === '--version') {
          return createExecaResponse('mysql Ver 8.0.33');
        }
        throw new Error('Connection failed');
      });

      await expect(detectMySQLConnection()).rejects.toThrow(
        'Could not detect MySQL connection'
      );
    });

    it('should accept custom MySQL user', async () => {
      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'mysql' && args[0] === '--version') {
          return createExecaResponse('mysql Ver 8.0.33');
        }
        if (cmd === 'mysql' && args.includes('-ucustomuser') && args.includes('-h127.0.0.1')) {
          return createExecaResponse('1');
        }
        throw new Error('Connection failed');
      });

      const result = await detectMySQLConnection('customuser');
      expect(result).toBe('127.0.0.1');
      expect(execaMock).toHaveBeenCalledWith(
        'mysql',
        expect.arrayContaining(['-ucustomuser'])
      );
    });
  });

  describe('getMySQLConnection', () => {
    it('should cache connection strings by user', async () => {
      // Re-import to get fresh module with clean cache
      vi.resetModules();
      const { getMySQLConnection: freshGetConnection } = await import('../../src/mysql-detector.js');

      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'mysql' && args[0] === '--version') {
          return createExecaResponse('mysql Ver 8.0.33');
        }
        if (cmd === 'mysql' && args.includes('-h127.0.0.1')) {
          return createExecaResponse('1');
        }
        throw new Error('Connection failed');
      });

      const result1 = await freshGetConnection('root');
      const result2 = await freshGetConnection('root');

      expect(result1).toBe('127.0.0.1');
      expect(result2).toBe('127.0.0.1');

      // Should only call detectMySQLConnection once due to caching
      // Count calls to mysql --version (detection calls it once)
      const versionCalls = execaMock.mock.calls.filter(
        call => call[0] === 'mysql' && call[1][0] === '--version'
      );
      expect(versionCalls.length).toBe(1);
    });

    it('should cache separately for different users', async () => {
      // Re-import to get fresh module with clean cache
      vi.resetModules();
      const { getMySQLConnection: freshGetConnection } = await import('../../src/mysql-detector.js');

      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'mysql' && args[0] === '--version') {
          return createExecaResponse('mysql Ver 8.0.33');
        }
        if (cmd === 'mysql') {
          return createExecaResponse('1');
        }
        throw new Error('Connection failed');
      });

      const result1 = await freshGetConnection('root');
      const result2 = await freshGetConnection('admin');

      expect(result1).toBe('127.0.0.1');
      expect(result2).toBe('127.0.0.1');

      // Should call detectMySQLConnection twice for different users
      const versionCalls = execaMock.mock.calls.filter(
        call => call[0] === 'mysql' && call[1][0] === '--version'
      );
      expect(versionCalls.length).toBe(2);
    });
  });
});