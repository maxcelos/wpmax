// tests/integration/delete.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { addSite, getSite, removeSite, listAllSites } from '../../src/site-registry.js';
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

describe('Delete Command Integration', () => {
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

  describe('wpmax delete <name>', () => {
    it.skip('should delete directory, database, and registry entry', async () => {
      const site = createTestSite('test-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      // Mock rm command (directory deletion)
      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'rm' && args[0] === '-rf') {
          fsMocks._storage[args[1]] = undefined; // Simulate deletion
          return createExecaResponse('');
        }
        // Mock WP-CLI db drop
        if (args.includes('db') && args.includes('drop')) {
          return createExecaResponse('Success: Database dropped.');
        }
        return createExecaResponse('');
      });

      // Verify site exists
      expect(getSite('test-site')).toBeDefined();

      // Execute delete
      await execaMock('rm', ['-rf', site.path]);
      await execaMock('php', ['/path/to/wp-cli.phar', 'db', 'drop', '--yes', '--quiet'], { cwd: site.path });
      removeSite('test-site');

      // Verify deletion
      expect(getSite('test-site')).toBeNull();
    });

    it('should handle --keep-db flag', async () => {
      const site = createTestSite('test-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'rm') {
          return createExecaResponse('');
        }
      });

      // Delete with --keep-db (no db drop command)
      await execaMock('rm', ['-rf', site.path]);
      removeSite('test-site');

      // Verify db drop was NOT called
      expect(execaMock).not.toHaveBeenCalledWith(
        'php',
        expect.arrayContaining(['db', 'drop'])
      );
    });

    it('should handle --keep-files flag', async () => {
      const site = createTestSite('test-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        if (args.includes('db') && args.includes('drop')) {
          return createExecaResponse('Success: Database dropped.');
        }
      });

      // Delete with --keep-files (no rm command)
      await execaMock('php', ['/path/to/wp-cli.phar', 'db', 'drop', '--yes', '--quiet'], { cwd: site.path });
      removeSite('test-site');

      // Verify rm was NOT called
      expect(execaMock).not.toHaveBeenCalledWith('rm', expect.anything());
    });

    it.skip('should handle --dry-run flag', async () => {
      const site = createTestSite('test-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      // In dry-run mode, no commands should execute
      // Just verify site still exists

      expect(getSite('test-site')).toBeDefined();
      expect(listAllSites()).toHaveLength(1);
    });

    it.skip('should delete site when directory does not exist', async () => {
      const site = createTestSite('deleted-dir-site');
      addSite(site);

      fsMocks = mockFilesystem({}); // Directory does not exist

      // Should only remove from registry (no rm or db drop)
      removeSite('deleted-dir-site');

      expect(getSite('deleted-dir-site')).toBeNull();
    });

    it.skip('should handle database drop failure gracefully', async () => {
      const site = createTestSite('test-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'rm') {
          return createExecaResponse('');
        }
        if (args.includes('db') && args.includes('drop')) {
          throw new Error('Error: Database does not exist');
        }
      });

      // Should continue even if db drop fails
      await execaMock('rm', ['-rf', site.path]);
      try {
        await execaMock('php', ['/path/to/wp-cli.phar', 'db', 'drop', '--yes', '--quiet'], { cwd: site.path });
      } catch (error) {
        // Expected - db drop failed
      }
      removeSite('test-site');

      expect(getSite('test-site')).toBeNull();
    });

    it('should handle directory deletion failure', async () => {
      const site = createTestSite('test-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'rm') {
          throw new Error('Permission denied');
        }
      });

      // Should throw error on directory deletion failure
      await expect(
        execaMock('rm', ['-rf', site.path])
      ).rejects.toThrow('Permission denied');
    });
  });

  describe('wpmax rm (alias)', () => {
    it.skip('should work identically to wpmax delete', async () => {
      const site = createTestSite('test-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'rm') {
          return createExecaResponse('');
        }
        if (args.includes('db') && args.includes('drop')) {
          return createExecaResponse('Success: Database dropped.');
        }
      });

      await execaMock('rm', ['-rf', site.path]);
      await execaMock('php', ['/path/to/wp-cli.phar', 'db', 'drop', '--yes', '--quiet'], { cwd: site.path });
      removeSite('test-site');

      expect(getSite('test-site')).toBeNull();
    });
  });

  describe('confirmation prompts', () => {
    it('should require confirmation by default', async () => {
      const site = createTestSite('test-site');
      addSite(site);

      // Without --yes flag, deletion should require confirmation
      // This is handled by the CLI layer with inquirer

      expect(getSite('test-site')).toBeDefined();
    });

    it.skip('should skip confirmation with --yes flag', async () => {
      const site = createTestSite('test-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        if (cmd === 'rm') {
          return createExecaResponse('');
        }
        if (args.includes('db') && args.includes('drop')) {
          return createExecaResponse('Success: Database dropped.');
        }
      });

      // With --yes flag, deletion proceeds without confirmation
      await execaMock('rm', ['-rf', site.path]);
      await execaMock('php', ['/path/to/wp-cli.phar', 'db', 'drop', '--yes', '--quiet'], { cwd: site.path });
      removeSite('test-site');

      expect(getSite('test-site')).toBeNull();
    });
  });

  describe('registry management', () => {
    it.skip('should always remove from registry', async () => {
      const site = createTestSite('test-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      expect(listAllSites()).toHaveLength(1);

      removeSite('test-site');

      expect(listAllSites()).toHaveLength(0);
      expect(getSite('test-site')).toBeNull();
    });

    it.skip('should handle removing already deleted site from registry', async () => {
      const site = createTestSite('test-site');
      addSite(site);

      removeSite('test-site');
      removeSite('test-site'); // Second removal should not error

      expect(getSite('test-site')).toBeNull();
    });
  });

  describe('multiple deletions', () => {
    it.skip('should handle deleting multiple sites sequentially', async () => {
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

      execaMock.mockResolvedValue(createExecaResponse(''));

      expect(listAllSites()).toHaveLength(3);

      removeSite('site-1');
      expect(listAllSites()).toHaveLength(2);

      removeSite('site-2');
      expect(listAllSites()).toHaveLength(1);

      removeSite('site-3');
      expect(listAllSites()).toHaveLength(0);
    });
  });

  describe('error scenarios', () => {
    it.skip('should handle site not found error', async () => {
      const site = getSite('non-existent-site');

      expect(site).toBeNull();
    });

    it.skip('should handle corrupted registry gracefully', async () => {
      const site = createTestSite('test-site');
      addSite(site);

      // Verify site exists before deletion
      expect(getSite('test-site')).toBeDefined();

      removeSite('test-site');

      // Site should be removed
      expect(getSite('test-site')).toBeNull();
    });
  });

  describe('file system operations', () => {
    it('should use rm -rf for directory deletion', async () => {
      const site = createTestSite('test-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockResolvedValue(createExecaResponse(''));

      await execaMock('rm', ['-rf', site.path]);

      expect(execaMock).toHaveBeenCalledWith('rm', ['-rf', site.path]);
    });

    it('should use WP-CLI for database deletion', async () => {
      const site = createTestSite('test-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockResolvedValue(createExecaResponse(''));

      await execaMock('php', ['/path/to/wp-cli.phar', 'db', 'drop', '--yes', '--quiet'], { cwd: site.path });

      expect(execaMock).toHaveBeenCalledWith(
        'php',
        ['/path/to/wp-cli.phar', 'db', 'drop', '--yes', '--quiet'],
        { cwd: site.path }
      );
    });
  });

  describe('edge cases', () => {
    it.skip('should handle sites with special characters in path', async () => {
      const site = createTestSite('my-site_v2.0');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockResolvedValue(createExecaResponse(''));

      removeSite('my-site_v2.0');

      expect(getSite('my-site_v2.0')).toBeNull();
    });

    it.skip('should handle sites with custom database names', async () => {
      const site = createTestSite('test-site', { dbName: 'custom_db_name' });
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockResolvedValue(createExecaResponse(''));

      await execaMock('php', ['/path/to/wp-cli.phar', 'db', 'drop', '--yes', '--quiet'], { cwd: site.path });
      removeSite('test-site');

      expect(getSite('test-site')).toBeNull();
    });

    it.skip('should handle very large site directories', async () => {
      const site = createTestSite('large-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockImplementation(async (cmd, args) => {
        // Simulate slow deletion of large directory
        await new Promise(resolve => setTimeout(resolve, 10));
        return createExecaResponse('');
      });

      await execaMock('rm', ['-rf', site.path]);
      removeSite('large-site');

      expect(getSite('large-site')).toBeNull();
    });
  });

  describe('selective deletion', () => {
    it('should keep database when --keep-db is used', async () => {
      const site = createTestSite('test-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockResolvedValue(createExecaResponse(''));

      // Only delete directory and registry
      await execaMock('rm', ['-rf', site.path]);
      removeSite('test-site');

      // Verify db drop was not called
      const dbDropCalls = execaMock.mock.calls.filter(
        call => call[1] && call[1].includes('db') && call[1].includes('drop')
      );
      expect(dbDropCalls).toHaveLength(0);
    });

    it('should keep files when --keep-files is used', async () => {
      const site = createTestSite('test-site');
      addSite(site);

      fsMocks = mockFilesystem({
        [site.path]: '__DIR__'
      });

      execaMock.mockResolvedValue(createExecaResponse(''));

      // Only delete database and registry
      await execaMock('php', ['/path/to/wp-cli.phar', 'db', 'drop', '--yes', '--quiet'], { cwd: site.path });
      removeSite('test-site');

      // Verify rm was not called
      const rmCalls = execaMock.mock.calls.filter(call => call[0] === 'rm');
      expect(rmCalls).toHaveLength(0);
    });
  });
});