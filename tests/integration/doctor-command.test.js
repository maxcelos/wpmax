// tests/integration/doctor-command.test.js
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
  getConfig: vi.fn(() => ({}))
}));

describe('Doctor Command Integration', () => {
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

  describe('healthy system - all checks pass', () => {
    it('should pass all checks on a healthy system', async () => {
      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__',
        [path.join(os.homedir(), '.config', 'wpmax', 'config.json')]: JSON.stringify({
          defaultPluginsPath: '/test/plugins'
        })
      });

      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'php') {
          if (args[0] === '--version') return createExecaResponse('PHP 8.2.15 (cli)');
          if (args[0] === '-m') return createExecaResponse('mysqli\ncurl\njson\nmbstring\nxml');
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

      // Mock fs operations for permission check
      const fs = await import('fs');
      const writeFileSyncSpy = vi.spyOn(fs.default, 'writeFileSync').mockImplementation(() => {});
      const unlinkSyncSpy = vi.spyOn(fs.default, 'unlinkSync').mockImplementation(() => {});

      const results = await doctor.runAllChecks();

      expect(results.wpCli.ok).toBe(true);
      expect(results.php.ok).toBe(true);
      expect(results.mysql.ok).toBe(true);
      expect(results.herd.ok).toBe(true);
      expect(results.permissions.ok).toBe(true);
      expect(results.config.ok).toBe(true);
      expect(results.issues).toHaveLength(0);

      writeFileSyncSpy.mockRestore();
      unlinkSyncSpy.mockRestore();
    });
  });

  describe('partial failures - some issues found', () => {
    it('should detect PHP version warnings', async () => {
      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__',
        [path.join(os.homedir(), '.config', 'wpmax', 'config.json')]: '{}'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'php') {
          if (args[0] === '--version') return createExecaResponse('PHP 7.3.0 (cli)');
          if (args[0] === '-m') return createExecaResponse('mysqli\ncurl\njson');
          return createExecaResponse('WP-CLI 2.9.0');
        }
        if (cmd === 'mysql') {
          return createExecaResponse('mysql Ver 8.0.33');
        }
      });

      detectMySQLMock.mockResolvedValue('127.0.0.1');
      isHerdInstalledMock.mockResolvedValue(false);

      const fs = await import('fs');
      const writeFileSyncSpy = vi.spyOn(fs.default, 'writeFileSync').mockImplementation(() => {});
      const unlinkSyncSpy = vi.spyOn(fs.default, 'unlinkSync').mockImplementation(() => {});

      const results = await doctor.runAllChecks();

      expect(results.php.ok).toBe(true);
      expect(results.php.version).toBe('7.3.0');
      expect(results.issues.length).toBeGreaterThan(0);
      expect(results.issues.some(i => i.description.includes('outdated'))).toBe(true);

      writeFileSyncSpy.mockRestore();
      unlinkSyncSpy.mockRestore();
    });

    it('should detect missing PHP extensions', async () => {
      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__',
        [path.join(os.homedir(), '.config', 'wpmax', 'config.json')]: '{}'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'php') {
          if (args[0] === '--version') return createExecaResponse('PHP 8.2.15 (cli)');
          if (args[0] === '-m') return createExecaResponse('curl\njson'); // Missing mysqli, mbstring
          return createExecaResponse('WP-CLI 2.9.0');
        }
        if (cmd === 'mysql') {
          return createExecaResponse('mysql Ver 8.0.33');
        }
      });

      detectMySQLMock.mockResolvedValue('127.0.0.1');
      isHerdInstalledMock.mockResolvedValue(false);

      const fs = await import('fs');
      const writeFileSyncSpy = vi.spyOn(fs.default, 'writeFileSync').mockImplementation(() => {});
      const unlinkSyncSpy = vi.spyOn(fs.default, 'unlinkSync').mockImplementation(() => {});

      const results = await doctor.runAllChecks();

      expect(results.php.ok).toBe(true);
      expect(results.php.missingExtensions).toContain('mysqli');
      expect(results.php.missingExtensions).toContain('mbstring');
      expect(results.issues.some(i => i.description.includes('Missing PHP extensions'))).toBe(true);

      writeFileSyncSpy.mockRestore();
      unlinkSyncSpy.mockRestore();
    });

    it('should handle permission issues', async () => {
      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__',
        [path.join(os.homedir(), '.config', 'wpmax', 'config.json')]: '{}'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'php') {
          if (args[0] === '--version') return createExecaResponse('PHP 8.2.15 (cli)');
          if (args[0] === '-m') return createExecaResponse('mysqli\ncurl\njson\nmbstring');
          return createExecaResponse('WP-CLI 2.9.0');
        }
        if (cmd === 'mysql') {
          return createExecaResponse('mysql Ver 8.0.33');
        }
      });

      detectMySQLMock.mockResolvedValue('127.0.0.1');
      isHerdInstalledMock.mockResolvedValue(false);

      const fs = await import('fs');
      const writeFileSyncSpy = vi.spyOn(fs.default, 'writeFileSync').mockImplementation(() => {
        const error = new Error('EACCES: permission denied');
        error.code = 'EACCES';
        throw error;
      });
      const unlinkSyncSpy = vi.spyOn(fs.default, 'unlinkSync').mockImplementation(() => {});

      const results = await doctor.runAllChecks();

      expect(results.permissions.ok).toBe(false);
      expect(results.issues.some(i => i.description.includes('No write permission'))).toBe(true);

      writeFileSyncSpy.mockRestore();
      unlinkSyncSpy.mockRestore();
    });
  });

  describe('critical failures - system not ready', () => {
    it('should fail when WP-CLI is not found', async () => {
      fsMocks = mockFilesystem({});

      execaMock.mockRejectedValue(new Error('Command not found'));
      detectMySQLMock.mockResolvedValue('127.0.0.1');
      isHerdInstalledMock.mockResolvedValue(false);

      const fs = await import('fs');
      const writeFileSyncSpy = vi.spyOn(fs.default, 'writeFileSync').mockImplementation(() => {});
      const unlinkSyncSpy = vi.spyOn(fs.default, 'unlinkSync').mockImplementation(() => {});

      const results = await doctor.runAllChecks();

      expect(results.wpCli.ok).toBe(false);
      expect(results.wpCli.error).toBe('Not found');
      expect(results.issues.some(i => i.description === 'WP-CLI not found')).toBe(true);

      writeFileSyncSpy.mockRestore();
      unlinkSyncSpy.mockRestore();
    });

    it('should fail when PHP is not installed', async () => {
      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__'
      });

      execaMock.mockRejectedValue(new Error('Command not found: php'));
      detectMySQLMock.mockResolvedValue('127.0.0.1');
      isHerdInstalledMock.mockResolvedValue(false);

      const fs = await import('fs');
      const writeFileSyncSpy = vi.spyOn(fs.default, 'writeFileSync').mockImplementation(() => {});
      const unlinkSyncSpy = vi.spyOn(fs.default, 'unlinkSync').mockImplementation(() => {});

      const results = await doctor.runAllChecks();

      expect(results.php.ok).toBe(false);
      expect(results.php.error).toBe('Not installed');
      expect(results.issues.some(i => i.description === 'PHP not found')).toBe(true);

      writeFileSyncSpy.mockRestore();
      unlinkSyncSpy.mockRestore();
    });

    it('should fail when MySQL is not accessible', async () => {
      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'php') {
          if (args[0] === '--version') return createExecaResponse('PHP 8.2.15 (cli)');
          if (args[0] === '-m') return createExecaResponse('mysqli\ncurl\njson\nmbstring');
          return createExecaResponse('WP-CLI 2.9.0');
        }
        if (cmd === 'mysql') {
          throw new Error('Command not found: mysql');
        }
      });

      detectMySQLMock.mockRejectedValue(new Error('Connection refused'));
      isHerdInstalledMock.mockResolvedValue(false);

      const fs = await import('fs');
      const writeFileSyncSpy = vi.spyOn(fs.default, 'writeFileSync').mockImplementation(() => {});
      const unlinkSyncSpy = vi.spyOn(fs.default, 'unlinkSync').mockImplementation(() => {});

      const results = await doctor.runAllChecks();

      expect(results.mysql.ok).toBe(false);
      expect(results.issues.some(i => i.description === 'MySQL client not found')).toBe(true);

      writeFileSyncSpy.mockRestore();
      unlinkSyncSpy.mockRestore();
    });

    it('should handle all critical failures at once', async () => {
      fsMocks = mockFilesystem({});

      execaMock.mockRejectedValue(new Error('Command not found'));
      detectMySQLMock.mockRejectedValue(new Error('Connection failed'));
      isHerdInstalledMock.mockResolvedValue(false);

      const fs = await import('fs');
      const writeFileSyncSpy = vi.spyOn(fs.default, 'writeFileSync').mockImplementation(() => {
        const error = new Error('EACCES');
        error.code = 'EACCES';
        throw error;
      });
      const unlinkSyncSpy = vi.spyOn(fs.default, 'unlinkSync').mockImplementation(() => {});

      const results = await doctor.runAllChecks();

      expect(results.wpCli.ok).toBe(false);
      expect(results.php.ok).toBe(false);
      expect(results.mysql.ok).toBe(false);
      expect(results.permissions.ok).toBe(false);
      expect(results.issues.length).toBeGreaterThan(3);

      writeFileSyncSpy.mockRestore();
      unlinkSyncSpy.mockRestore();
    });
  });

  describe('optional components', () => {
    it('should handle Herd not installed gracefully', async () => {
      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__',
        [path.join(os.homedir(), '.config', 'wpmax', 'config.json')]: '{}'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'php') {
          if (args[0] === '--version') return createExecaResponse('PHP 8.2.15 (cli)');
          if (args[0] === '-m') return createExecaResponse('mysqli\ncurl\njson\nmbstring');
          return createExecaResponse('WP-CLI 2.9.0');
        }
        if (cmd === 'mysql') {
          return createExecaResponse('mysql Ver 8.0.33');
        }
      });

      detectMySQLMock.mockResolvedValue('127.0.0.1');
      isHerdInstalledMock.mockResolvedValue(false);

      const fs = await import('fs');
      const writeFileSyncSpy = vi.spyOn(fs.default, 'writeFileSync').mockImplementation(() => {});
      const unlinkSyncSpy = vi.spyOn(fs.default, 'unlinkSync').mockImplementation(() => {});

      const results = await doctor.runAllChecks();

      expect(results.herd.ok).toBe(true);
      expect(results.herd.installed).toBe(false);
      // Herd is optional, so no issues should be added
      expect(results.issues.every(i => !i.description.includes('Herd'))).toBe(true);

      writeFileSyncSpy.mockRestore();
      unlinkSyncSpy.mockRestore();
    });

    it('should detect Herd when installed', async () => {
      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__',
        [path.join(os.homedir(), '.config', 'wpmax', 'config.json')]: '{}'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'php') {
          if (args[0] === '--version') return createExecaResponse('PHP 8.2.15 (cli)');
          if (args[0] === '-m') return createExecaResponse('mysqli\ncurl\njson\nmbstring');
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

      const fs = await import('fs');
      const writeFileSyncSpy = vi.spyOn(fs.default, 'writeFileSync').mockImplementation(() => {});
      const unlinkSyncSpy = vi.spyOn(fs.default, 'unlinkSync').mockImplementation(() => {});

      const results = await doctor.runAllChecks();

      expect(results.herd.ok).toBe(true);
      expect(results.herd.installed).toBe(true);
      expect(results.herd.version).toBe('Laravel Herd 1.7.3');

      writeFileSyncSpy.mockRestore();
      unlinkSyncSpy.mockRestore();
    });
  });

  describe('environment information', () => {
    it('should collect environment information', () => {
      const env = doctor.getEnvironmentInfo();

      expect(env.os).toBeDefined();
      expect(env.osVersion).toBeDefined();
      expect(env.node).toBeDefined();
      expect(env.arch).toBeDefined();
      expect(env.shell).toBeDefined();
      expect(env.configPath).toContain('.config/wpmax');
    });
  });

  describe('MySQL connection types', () => {
    it('should handle TCP connection', async () => {
      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__'
      });

      execaMock.mockImplementation(async (cmd) => {
        if (cmd === 'php') return createExecaResponse('WP-CLI 2.9.0');
        if (cmd === 'mysql') return createExecaResponse('mysql Ver 8.0.33');
      });

      detectMySQLMock.mockResolvedValue('127.0.0.1');
      isHerdInstalledMock.mockResolvedValue(false);

      const fs = await import('fs');
      const writeFileSyncSpy = vi.spyOn(fs.default, 'writeFileSync').mockImplementation(() => {});
      const unlinkSyncSpy = vi.spyOn(fs.default, 'unlinkSync').mockImplementation(() => {});

      const results = await doctor.runAllChecks();

      expect(results.mysql.ok).toBe(true);
      expect(results.mysql.connection).toBe('127.0.0.1');

      writeFileSyncSpy.mockRestore();
      unlinkSyncSpy.mockRestore();
    });

    it('should handle socket connection', async () => {
      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__'
      });

      execaMock.mockImplementation(async (cmd) => {
        if (cmd === 'php') return createExecaResponse('WP-CLI 2.9.0');
        if (cmd === 'mysql') return createExecaResponse('mysql Ver 8.0.33');
      });

      detectMySQLMock.mockResolvedValue('localhost:/tmp/mysql_3306.sock');
      isHerdInstalledMock.mockResolvedValue(false);

      const fs = await import('fs');
      const writeFileSyncSpy = vi.spyOn(fs.default, 'writeFileSync').mockImplementation(() => {});
      const unlinkSyncSpy = vi.spyOn(fs.default, 'unlinkSync').mockImplementation(() => {});

      const results = await doctor.runAllChecks();

      expect(results.mysql.ok).toBe(true);
      expect(results.mysql.connection).toBe('localhost:/tmp/mysql_3306.sock');

      writeFileSyncSpy.mockRestore();
      unlinkSyncSpy.mockRestore();
    });
  });
});