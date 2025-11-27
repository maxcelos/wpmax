// tests/unit/doctor.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DoctorCheck } from '../../src/doctor.js';
import { mockFilesystem } from '../helpers/mock-filesystem.js';
import { createExecaResponse } from '../helpers/mock-execa.js';
import path from 'path';
import os from 'os';

// Mock modules
vi.mock('execa', () => ({
  execa: vi.fn()
}));

vi.mock('../../src/wp-cli-manager.js', () => ({
  getWpCliCommand: vi.fn(() => ['php', '/path/to/wp-cli.phar'])
}));

vi.mock('../../src/mysql-detector.js', () => ({
  detectMySQLConnection: vi.fn()
}));

vi.mock('../../src/herd-manager.js', () => ({
  isHerdInstalled: vi.fn()
}));

vi.mock('../../src/config.js', () => ({
  getConfig: vi.fn(() => ({
    defaultPluginsPath: '/Users/test/plugins',
    publicPlugins: ['woocommerce']
  }))
}));

describe('Doctor', () => {
  let execaMock;
  let detectMySQLMock;
  let isHerdInstalledMock;
  let getConfigMock;
  let fsMocks;
  let doctor;

  beforeEach(async () => {
    const { execa } = await import('execa');
    const { detectMySQLConnection } = await import('../../src/mysql-detector.js');
    const { isHerdInstalled } = await import('../../src/herd-manager.js');
    const { getConfig } = await import('../../src/config.js');

    execaMock = execa;
    detectMySQLMock = detectMySQLConnection;
    isHerdInstalledMock = isHerdInstalled;
    getConfigMock = getConfig;

    vi.clearAllMocks();

    doctor = new DoctorCheck();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkWpCli', () => {
    it('should return ok when WP-CLI is found and accessible', async () => {
      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__'
      });

      execaMock.mockResolvedValue(createExecaResponse('WP-CLI 2.9.0'));

      const result = await doctor.checkWpCli();

      expect(result.ok).toBe(true);
      expect(result.version).toBe('2.9.0');
      expect(doctor.issues).toHaveLength(0);
    });

    it('should return error when WP-CLI file does not exist', async () => {
      fsMocks = mockFilesystem({});

      const result = await doctor.checkWpCli();

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Not found');
      expect(doctor.issues).toHaveLength(1);
      expect(doctor.issues[0].description).toBe('WP-CLI not found');
    });

    it('should handle WP-CLI execution errors', async () => {
      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__'
      });

      execaMock.mockRejectedValue(new Error('Permission denied'));

      const result = await doctor.checkWpCli();

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Not accessible');
      expect(doctor.issues).toHaveLength(1);
      expect(doctor.issues[0].description).toBe('WP-CLI not accessible');
    });

    it('should parse version from WP-CLI output', async () => {
      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__'
      });

      execaMock.mockResolvedValue(createExecaResponse('WP-CLI 2.10.0\nPHP 8.2.0'));

      const result = await doctor.checkWpCli();

      expect(result.version).toBe('2.10.0');
    });
  });

  describe('checkPhp', () => {
    it('should return ok when PHP is installed with correct version', async () => {
      execaMock.mockImplementation(async (cmd, args) => {
        if (args[0] === '--version') {
          return createExecaResponse('PHP 8.2.15 (cli)');
        }
        if (args[0] === '-m') {
          return createExecaResponse('mysqli\ncurl\njson\nmbstring\nxml');
        }
      });

      const result = await doctor.checkPhp();

      expect(result.ok).toBe(true);
      expect(result.version).toBe('8.2.15');
      expect(result.missingExtensions).toHaveLength(0);
      expect(doctor.issues).toHaveLength(0);
    });

    it('should add issue when PHP version is too old', async () => {
      execaMock.mockImplementation(async (cmd, args) => {
        if (args[0] === '--version') {
          return createExecaResponse('PHP 7.3.0 (cli)');
        }
        if (args[0] === '-m') {
          return createExecaResponse('mysqli\ncurl\njson\nmbstring');
        }
      });

      const result = await doctor.checkPhp();

      expect(result.ok).toBe(true);
      expect(result.version).toBe('7.3.0');
      expect(doctor.issues.some(i => i.description.includes('PHP 7.3.0 is outdated'))).toBe(true);
    });

    it('should detect missing PHP extensions', async () => {
      execaMock.mockImplementation(async (cmd, args) => {
        if (args[0] === '--version') {
          return createExecaResponse('PHP 8.2.15 (cli)');
        }
        if (args[0] === '-m') {
          return createExecaResponse('curl\njson'); // Missing mysqli and mbstring
        }
      });

      const result = await doctor.checkPhp();

      expect(result.ok).toBe(true);
      expect(result.missingExtensions).toContain('mysqli');
      expect(result.missingExtensions).toContain('mbstring');
      expect(doctor.issues.some(i => i.description.includes('Missing PHP extensions'))).toBe(true);
    });

    it('should return error when PHP is not installed', async () => {
      execaMock.mockRejectedValue(new Error('Command not found: php'));

      const result = await doctor.checkPhp();

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Not installed');
      expect(doctor.issues.some(i => i.description === 'PHP not found')).toBe(true);
    });

    it('should handle version parsing edge cases', async () => {
      execaMock.mockImplementation(async (cmd, args) => {
        if (args[0] === '--version') {
          return createExecaResponse('PHP 8.1.0-dev (cli)');
        }
        if (args[0] === '-m') {
          return createExecaResponse('mysqli\ncurl\njson\nmbstring');
        }
      });

      const result = await doctor.checkPhp();

      expect(result.ok).toBe(true);
      expect(result.version).toBe('8.1.0');
    });
  });

  describe('checkMySQL', () => {
    it('should return ok when MySQL is accessible', async () => {
      execaMock.mockResolvedValue(createExecaResponse('mysql Ver 8.0.33'));
      detectMySQLMock.mockResolvedValue('127.0.0.1');

      const result = await doctor.checkMySQL();

      expect(result.ok).toBe(true);
      expect(result.connection).toBe('127.0.0.1');
      expect(doctor.issues).toHaveLength(0);
    });

    it('should return error when MySQL client is not found', async () => {
      execaMock.mockRejectedValue(new Error('Command not found: mysql'));

      const result = await doctor.checkMySQL();

      expect(result.ok).toBe(false);
      expect(result.error).toBe('MySQL client not installed');
      expect(doctor.issues.some(i => i.description === 'MySQL client not found')).toBe(true);
    });

    it('should return error when MySQL is not accessible', async () => {
      execaMock.mockResolvedValue(createExecaResponse('mysql Ver 8.0.33'));
      detectMySQLMock.mockRejectedValue(new Error('Connection refused'));

      const result = await doctor.checkMySQL();

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Not accessible');
      expect(doctor.issues.some(i => i.description === 'MySQL not accessible')).toBe(true);
    });

    it('should work with socket connections', async () => {
      execaMock.mockResolvedValue(createExecaResponse('mysql Ver 8.0.33'));
      detectMySQLMock.mockResolvedValue('localhost:/tmp/mysql_3306.sock');

      const result = await doctor.checkMySQL();

      expect(result.ok).toBe(true);
      expect(result.connection).toBe('localhost:/tmp/mysql_3306.sock');
    });
  });

  describe('checkHerd', () => {
    it('should return installed true when Herd is available', async () => {
      isHerdInstalledMock.mockResolvedValue(true);
      execaMock.mockResolvedValue(createExecaResponse('Laravel Herd 1.7.3'));

      const result = await doctor.checkHerd();

      expect(result.ok).toBe(true);
      expect(result.installed).toBe(true);
      expect(result.version).toBe('Laravel Herd 1.7.3');
    });

    it('should return installed false when Herd is not available', async () => {
      isHerdInstalledMock.mockResolvedValue(false);

      const result = await doctor.checkHerd();

      expect(result.ok).toBe(true);
      expect(result.installed).toBe(false);
      expect(result.version).toBeUndefined();
    });

    it('should handle errors gracefully', async () => {
      isHerdInstalledMock.mockRejectedValue(new Error('Unexpected error'));

      const result = await doctor.checkHerd();

      expect(result.ok).toBe(true);
      expect(result.installed).toBe(false);
    });
  });

  describe('checkPermissions', () => {
    it('should return ok when all directories are writable', async () => {
      const fs = await import('fs');
      const writeFileSyncSpy = vi.spyOn(fs.default, 'writeFileSync').mockImplementation(() => {});
      const unlinkSyncSpy = vi.spyOn(fs.default, 'unlinkSync').mockImplementation(() => {});

      const result = await doctor.checkPermissions();

      expect(result.ok).toBe(true);
      expect(doctor.issues).toHaveLength(0);

      writeFileSyncSpy.mockRestore();
      unlinkSyncSpy.mockRestore();
    });

    it('should detect permission issues', async () => {
      const fs = await import('fs');
      const writeFileSyncSpy = vi.spyOn(fs.default, 'writeFileSync').mockImplementation(() => {
        const error = new Error('EACCES: permission denied');
        error.code = 'EACCES';
        throw error;
      });
      const unlinkSyncSpy = vi.spyOn(fs.default, 'unlinkSync').mockImplementation(() => {});

      const result = await doctor.checkPermissions();

      expect(result.ok).toBe(false);
      expect(result.failedDirs).toBeDefined();
      expect(doctor.issues.some(i => i.description.includes('No write permission'))).toBe(true);

      writeFileSyncSpy.mockRestore();
      unlinkSyncSpy.mockRestore();
    });

    it('should check ~/Sites directory if it exists', async () => {
      const fs = await import('fs');
      const sitesDir = path.join(os.homedir(), 'Sites');

      const existsSyncSpy = vi.spyOn(fs.default, 'existsSync').mockImplementation((p) => {
        return p === sitesDir;
      });
      const writeFileSyncSpy = vi.spyOn(fs.default, 'writeFileSync').mockImplementation(() => {});
      const unlinkSyncSpy = vi.spyOn(fs.default, 'unlinkSync').mockImplementation(() => {});

      const result = await doctor.checkPermissions();

      expect(result.ok).toBe(true);

      existsSyncSpy.mockRestore();
      writeFileSyncSpy.mockRestore();
      unlinkSyncSpy.mockRestore();
    });
  });

  describe('checkConfig', () => {
    it('should return ok when config exists and is valid', async () => {
      const configPath = path.join(os.homedir(), '.config', 'wpmax', 'config.json');
      fsMocks = mockFilesystem({
        [configPath]: JSON.stringify({ defaultPluginsPath: '/test' })
      });

      const result = await doctor.checkConfig();

      expect(result.ok).toBe(true);
      expect(result.exists).toBeDefined();
      expect(result.hasSettings).toBe(true);
    });

    it('should handle config errors', async () => {
      getConfigMock.mockImplementation(() => {
        throw new Error('Invalid JSON');
      });

      const result = await doctor.checkConfig();

      expect(result.ok).toBe(false);
      expect(result.error).toBe('Invalid JSON');
      expect(doctor.issues.some(i => i.description === 'Config file error')).toBe(true);
    });
  });

  describe('getEnvironmentInfo', () => {
    it('should return environment information', () => {
      const result = doctor.getEnvironmentInfo();

      expect(result.os).toBeDefined();
      expect(result.osVersion).toBeDefined();
      expect(result.node).toBeDefined();
      expect(result.arch).toBeDefined();
      expect(result.configPath).toContain('.config/wpmax');
    });
  });

  describe('runAllChecks', () => {
    it('should run all diagnostic checks', async () => {
      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__',
        [path.join(os.homedir(), '.config', 'wpmax', 'config.json')]: '{}'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'php') {
          if (args[0] === '--version') {
            return createExecaResponse('PHP 8.2.15');
          }
          if (args[0] === '-m') {
            return createExecaResponse('mysqli\ncurl\njson\nmbstring');
          }
          return createExecaResponse('WP-CLI 2.9.0');
        }
        if (cmd === 'mysql') {
          return createExecaResponse('mysql Ver 8.0.33');
        }
        if (cmd === 'herd') {
          return createExecaResponse('Laravel Herd 1.7.3');
        }
      });

      detectMySQLMock.mockResolvedValue('127.0.0.1');
      isHerdInstalledMock.mockResolvedValue(true);

      const results = await doctor.runAllChecks();

      expect(results.wpCli).toBeDefined();
      expect(results.php).toBeDefined();
      expect(results.mysql).toBeDefined();
      expect(results.herd).toBeDefined();
      expect(results.permissions).toBeDefined();
      expect(results.config).toBeDefined();
      expect(results.environment).toBeDefined();
      expect(results.issues).toBeDefined();
    });

    it('should collect all issues from failed checks', async () => {
      fsMocks = mockFilesystem({});

      execaMock.mockRejectedValue(new Error('Command not found'));
      detectMySQLMock.mockRejectedValue(new Error('Connection failed'));
      isHerdInstalledMock.mockResolvedValue(false);

      const results = await doctor.runAllChecks();

      expect(results.issues.length).toBeGreaterThan(0);
      expect(results.wpCli.ok).toBe(false);
      expect(results.php.ok).toBe(false);
      expect(results.mysql.ok).toBe(false);
    });
  });
});