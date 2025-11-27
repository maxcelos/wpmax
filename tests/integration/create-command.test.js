// tests/integration/create-command.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WordPressInstaller } from '../../src/installer.js';
import { addSite, getSite } from '../../src/site-registry.js';
import { ensureWpCli } from '../../src/wp-cli-manager.js';
import { isHerdInstalled } from '../../src/herd-manager.js';
import { mockFilesystem } from '../helpers/mock-filesystem.js';
import { createExecaResponse } from '../helpers/mock-execa.js';
import path from 'path';
import os from 'os';

// Mock modules
vi.mock('execa', () => ({
  execa: vi.fn()
}));

vi.mock('../../src/wp-cli-manager.js', () => ({
  ensureWpCli: vi.fn(),
  getWpCliCommand: vi.fn(() => ['php', '/path/to/wp-cli.phar'])
}));

vi.mock('../../src/mysql-detector.js', () => ({
  getMySQLConnection: vi.fn(() => Promise.resolve('127.0.0.1'))
}));

vi.mock('../../src/herd-manager.js', () => ({
  isHerdInstalled: vi.fn(),
  herdLink: vi.fn(),
  herdSecure: vi.fn()
}));

vi.mock('https', () => ({
  default: {
    get: vi.fn()
  }
}));

describe('Create Command Integration', () => {
  let execaMock;
  let ensureWpCliMock;
  let isHerdInstalledMock;
  let fsMocks;
  const sitesFile = path.join(os.homedir(), '.config', 'wpmax', 'sites.json');

  beforeEach(async () => {
    const { execa } = await import('execa');
    const { ensureWpCli } = await import('../../src/wp-cli-manager.js');
    const { isHerdInstalled } = await import('../../src/herd-manager.js');

    execaMock = execa;
    ensureWpCliMock = ensureWpCli;
    isHerdInstalledMock = isHerdInstalled;

    vi.clearAllMocks();

    // Reset registry file for each test
    fsMocks = mockFilesystem({
      [sitesFile]: JSON.stringify({ sites: [] })
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('wpmax <name> (basic creation)', () => {
    it('should create a new WordPress site with default options', async () => {
      const config = {
        slug: 'my-site',
        dbName: 'my_site',
        dbUser: 'root',
        dbPass: '',
        dbHost: null,
        dbPrefix: 'wp_',
        url: 'my-site.test',
        title: 'My Site',
        adminUser: 'admin',
        adminPass: 'admin',
        adminEmail: 'admin@test.com',
        withContent: false,
        wpVersion: 'latest',
        useDocker: false,
        noDb: false,
        verbose: false,
        selectedLocalPlugins: [],
        selectedPublicPlugins: []
      };

      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__'
      });

      ensureWpCliMock.mockResolvedValue(['php', '/path/to/wp-cli.phar']);

      execaMock.mockImplementation(async (cmd, args) => {
        // Mock all WP-CLI commands
        if (args.includes('core') && args.includes('download')) {
          fsMocks._storage[path.join('/Users/test/Sites/my-site', 'wp-config-sample.php')] = '__FILE__';
          return createExecaResponse('Success');
        }
        if (args.includes('config') && args.includes('create')) {
          return createExecaResponse('Success');
        }
        if (args.includes('db') && args.includes('create')) {
          return createExecaResponse('Success');
        }
        if (args.includes('core') && args.includes('install')) {
          return createExecaResponse('Success');
        }
        return createExecaResponse('');
      });

      // Mock fs.mkdirSync
      const fs = await import('fs');
      const mkdirSyncSpy = vi.spyOn(fs.default, 'mkdirSync').mockImplementation(() => {});

      const installer = new WordPressInstaller(config);

      await installer.createDirectory();
      await installer.downloadCore();
      await installer.configureDatabase();
      await installer.installWordPress();
      installer.registerSite();

      const site = getSite('my-site');

      expect(site).toBeDefined();
      expect(site.name).toBe('my-site');
      expect(site.url).toBe('my-site.test');
      expect(site.dbName).toBe('my_site');

      mkdirSyncSpy.mockRestore();
    });

    it('should handle --with-content flag', async () => {
      const config = {
        slug: 'content-site',
        dbName: 'content_site',
        dbUser: 'root',
        dbPass: '',
        dbHost: null,
        dbPrefix: 'wp_',
        url: 'content-site.test',
        title: 'Content Site',
        adminUser: 'admin',
        adminPass: 'admin',
        adminEmail: 'admin@test.com',
        withContent: true, // Keep default content
        wpVersion: 'latest',
        useDocker: false,
        noDb: false,
        verbose: false,
        selectedLocalPlugins: [],
        selectedPublicPlugins: []
      };

      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__'
      });

      ensureWpCliMock.mockResolvedValue(['php', '/path/to/wp-cli.phar']);

      execaMock.mockImplementation(async (cmd, args) => {
        if (args.includes('core') && args.includes('download')) {
          // Should NOT include --skip-content flag
          expect(args).not.toContain('--skip-content');
          return createExecaResponse('Success');
        }
        return createExecaResponse('Success');
      });

      const fs = await import('fs');
      const mkdirSyncSpy = vi.spyOn(fs.default, 'mkdirSync').mockImplementation(() => {});

      const installer = new WordPressInstaller(config);
      await installer.downloadCore();

      mkdirSyncSpy.mockRestore();
    });

    it('should skip default content by default', async () => {
      const config = {
        slug: 'minimal-site',
        dbName: 'minimal_site',
        dbUser: 'root',
        dbPass: '',
        dbHost: null,
        dbPrefix: 'wp_',
        url: 'minimal-site.test',
        title: 'Minimal Site',
        adminUser: 'admin',
        adminPass: 'admin',
        adminEmail: 'admin@test.com',
        withContent: false,
        wpVersion: 'latest',
        useDocker: false,
        noDb: false,
        verbose: false,
        selectedLocalPlugins: [],
        selectedPublicPlugins: []
      };

      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__'
      });

      ensureWpCliMock.mockResolvedValue(['php', '/path/to/wp-cli.phar']);

      execaMock.mockImplementation(async (cmd, args) => {
        if (args.includes('core') && args.includes('download')) {
          expect(args).toContain('--skip-content');
          return createExecaResponse('Success');
        }
        return createExecaResponse('Success');
      });

      const fs = await import('fs');
      const mkdirSyncSpy = vi.spyOn(fs.default, 'mkdirSync').mockImplementation(() => {});

      const installer = new WordPressInstaller(config);
      await installer.downloadCore();

      mkdirSyncSpy.mockRestore();
    });
  });

  describe('custom options', () => {
    it('should handle --wp-version flag', async () => {
      const config = {
        slug: 'versioned-site',
        dbName: 'versioned_site',
        dbUser: 'root',
        dbPass: '',
        dbHost: null,
        dbPrefix: 'wp_',
        url: 'versioned-site.test',
        title: 'Versioned Site',
        adminUser: 'admin',
        adminPass: 'admin',
        adminEmail: 'admin@test.com',
        withContent: false,
        wpVersion: '6.4.2',
        useDocker: false,
        noDb: false,
        verbose: false,
        selectedLocalPlugins: [],
        selectedPublicPlugins: []
      };

      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__'
      });

      ensureWpCliMock.mockResolvedValue(['php', '/path/to/wp-cli.phar']);

      execaMock.mockImplementation(async (cmd, args) => {
        if (args.includes('core') && args.includes('download')) {
          expect(args).toContain('--version=6.4.2');
          return createExecaResponse('Success');
        }
        return createExecaResponse('Success');
      });

      const fs = await import('fs');
      const mkdirSyncSpy = vi.spyOn(fs.default, 'mkdirSync').mockImplementation(() => {});

      const installer = new WordPressInstaller(config);
      await installer.downloadCore();

      mkdirSyncSpy.mockRestore();
    });

    it('should handle custom admin credentials', async () => {
      const config = {
        slug: 'custom-admin-site',
        dbName: 'custom_admin_site',
        dbUser: 'root',
        dbPass: '',
        dbHost: null,
        dbPrefix: 'wp_',
        url: 'custom-admin-site.test',
        title: 'Custom Admin Site',
        adminUser: 'superadmin',
        adminPass: 'SecurePass123!',
        adminEmail: 'admin@example.com',
        withContent: false,
        wpVersion: 'latest',
        useDocker: false,
        noDb: false,
        verbose: false,
        selectedLocalPlugins: [],
        selectedPublicPlugins: []
      };

      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__'
      });

      ensureWpCliMock.mockResolvedValue(['php', '/path/to/wp-cli.phar']);

      execaMock.mockImplementation(async (cmd, args) => {
        if (args.includes('core') && args.includes('install')) {
          expect(args).toContain('--admin_user=superadmin');
          expect(args).toContain('--admin_password=SecurePass123!');
          expect(args).toContain('--admin_email=admin@example.com');
          return createExecaResponse('Success');
        }
        return createExecaResponse('Success');
      });

      const fs = await import('fs');
      const mkdirSyncSpy = vi.spyOn(fs.default, 'mkdirSync').mockImplementation(() => {});

      const installer = new WordPressInstaller(config);
      await installer.installWordPress();

      mkdirSyncSpy.mockRestore();
    });

    it('should handle custom database settings', async () => {
      const config = {
        slug: 'custom-db-site',
        dbName: 'custom_database_name',
        dbUser: 'dbadmin',
        dbPass: 'dbpass123',
        dbHost: 'localhost:3306',
        dbPrefix: 'custom_',
        url: 'custom-db-site.test',
        title: 'Custom DB Site',
        adminUser: 'admin',
        adminPass: 'admin',
        adminEmail: 'admin@test.com',
        withContent: false,
        wpVersion: 'latest',
        useDocker: false,
        noDb: false,
        verbose: false,
        selectedLocalPlugins: [],
        selectedPublicPlugins: []
      };

      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__'
      });

      ensureWpCliMock.mockResolvedValue(['php', '/path/to/wp-cli.phar']);

      execaMock.mockImplementation(async (cmd, args) => {
        if (args.includes('config') && args.includes('create')) {
          expect(args).toContain('--dbname=custom_database_name');
          expect(args).toContain('--dbuser=dbadmin');
          expect(args).toContain('--dbpass=dbpass123');
          expect(args).toContain('--dbhost=localhost:3306');
          expect(args).toContain('--dbprefix=custom_');
          return createExecaResponse('Success');
        }
        return createExecaResponse('Success');
      });

      const fs = await import('fs');
      const mkdirSyncSpy = vi.spyOn(fs.default, 'mkdirSync').mockImplementation(() => {});

      const installer = new WordPressInstaller(config);
      await installer.configureDatabase();

      mkdirSyncSpy.mockRestore();
    });

    it('should handle custom URL', async () => {
      const config = {
        slug: 'custom-url-site',
        dbName: 'custom_url_site',
        dbUser: 'root',
        dbPass: '',
        dbHost: null,
        dbPrefix: 'wp_',
        url: 'myawesome.local',
        title: 'Custom URL Site',
        adminUser: 'admin',
        adminPass: 'admin',
        adminEmail: 'admin@test.com',
        withContent: false,
        wpVersion: 'latest',
        useDocker: false,
        noDb: false,
        verbose: false,
        selectedLocalPlugins: [],
        selectedPublicPlugins: []
      };

      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__'
      });

      ensureWpCliMock.mockResolvedValue(['php', '/path/to/wp-cli.phar']);

      execaMock.mockImplementation(async (cmd, args) => {
        if (args.includes('core') && args.includes('install')) {
          expect(args).toContain('--url=myawesome.local');
          return createExecaResponse('Success');
        }
        return createExecaResponse('Success');
      });

      const fs = await import('fs');
      const mkdirSyncSpy = vi.spyOn(fs.default, 'mkdirSync').mockImplementation(() => {});

      const installer = new WordPressInstaller(config);
      await installer.installWordPress();

      mkdirSyncSpy.mockRestore();
    });
  });

  describe('plugin installation', () => {
    it('should install local plugins from ZIP files', async () => {
      const config = {
        slug: 'plugin-site',
        dbName: 'plugin_site',
        dbUser: 'root',
        dbPass: '',
        dbHost: null,
        dbPrefix: 'wp_',
        url: 'plugin-site.test',
        title: 'Plugin Site',
        adminUser: 'admin',
        adminPass: 'admin',
        adminEmail: 'admin@test.com',
        withContent: false,
        wpVersion: 'latest',
        useDocker: false,
        noDb: false,
        verbose: false,
        selectedLocalPlugins: ['/Users/test/plugins/premium-plugin.zip'],
        selectedPublicPlugins: []
      };

      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__',
        '/Users/test/plugins/premium-plugin.zip': '__ZIP_FILE__'
      });

      ensureWpCliMock.mockResolvedValue(['php', '/path/to/wp-cli.phar']);

      execaMock.mockImplementation(async (cmd, args) => {
        if (args.includes('plugin') && args.includes('install')) {
          expect(args).toContain('/Users/test/plugins/premium-plugin.zip');
          expect(args).toContain('--activate');
          return createExecaResponse('Success');
        }
        return createExecaResponse('Success');
      });

      const fs = await import('fs');
      const mkdirSyncSpy = vi.spyOn(fs.default, 'mkdirSync').mockImplementation(() => {});

      const installer = new WordPressInstaller(config);
      await installer.installPlugins();

      mkdirSyncSpy.mockRestore();
    });

    it('should install public plugins from WordPress.org', async () => {
      const config = {
        slug: 'public-plugin-site',
        dbName: 'public_plugin_site',
        dbUser: 'root',
        dbPass: '',
        dbHost: null,
        dbPrefix: 'wp_',
        url: 'public-plugin-site.test',
        title: 'Public Plugin Site',
        adminUser: 'admin',
        adminPass: 'admin',
        adminEmail: 'admin@test.com',
        withContent: false,
        wpVersion: 'latest',
        useDocker: false,
        noDb: false,
        verbose: false,
        selectedLocalPlugins: [],
        selectedPublicPlugins: ['woocommerce', 'yoast-seo']
      };

      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__'
      });

      ensureWpCliMock.mockResolvedValue(['php', '/path/to/wp-cli.phar']);

      execaMock.mockImplementation(async (cmd, args) => {
        if (args.includes('plugin') && args.includes('install')) {
          if (args.includes('woocommerce')) {
            expect(args).toContain('woocommerce');
            expect(args).toContain('--activate');
            return createExecaResponse('Success');
          }
          if (args.includes('yoast-seo')) {
            expect(args).toContain('yoast-seo');
            expect(args).toContain('--activate');
            return createExecaResponse('Success');
          }
        }
        return createExecaResponse('Success');
      });

      const fs = await import('fs');
      const mkdirSyncSpy = vi.spyOn(fs.default, 'mkdirSync').mockImplementation(() => {});

      const installer = new WordPressInstaller(config);
      await installer.installPlugins();

      expect(execaMock).toHaveBeenCalledWith(
        'php',
        expect.arrayContaining(['plugin', 'install', 'woocommerce']),
        expect.any(Object)
      );
      expect(execaMock).toHaveBeenCalledWith(
        'php',
        expect.arrayContaining(['plugin', 'install', 'yoast-seo']),
        expect.any(Object)
      );

      mkdirSyncSpy.mockRestore();
    });
  });

  describe('Herd integration', () => {
    it('should setup Herd when installed and accepted', async () => {
      const config = {
        slug: 'herd-site',
        dbName: 'herd_site',
        dbUser: 'root',
        dbPass: '',
        dbHost: null,
        dbPrefix: 'wp_',
        url: 'herd-site.test',
        title: 'Herd Site',
        adminUser: 'admin',
        adminPass: 'admin',
        adminEmail: 'admin@test.com',
        withContent: false,
        wpVersion: 'latest',
        useDocker: false,
        noDb: false,
        verbose: false,
        selectedLocalPlugins: [],
        selectedPublicPlugins: []
      };

      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__'
      });

      ensureWpCliMock.mockResolvedValue(['php', '/path/to/wp-cli.phar']);
      isHerdInstalledMock.mockResolvedValue(true);

      const { herdLink, herdSecure } = await import('../../src/herd-manager.js');

      const fs = await import('fs');
      const mkdirSyncSpy = vi.spyOn(fs.default, 'mkdirSync').mockImplementation(() => {});

      const installer = new WordPressInstaller(config);
      await installer.setupHerd();

      expect(herdLink).toHaveBeenCalled();
      expect(herdSecure).toHaveBeenCalled();

      mkdirSyncSpy.mockRestore();
    });

    it('should skip Herd setup when not installed', async () => {
      isHerdInstalledMock.mockResolvedValue(false);

      const herdAvailable = await isHerdInstalled();

      expect(herdAvailable).toBe(false);
    });
  });

  describe('--no-db flag', () => {
    it('should create wp-config without creating database', async () => {
      const config = {
        slug: 'no-db-site',
        dbName: 'no_db_site',
        dbUser: 'root',
        dbPass: '',
        dbHost: null,
        dbPrefix: 'wp_',
        url: 'no-db-site.test',
        title: 'No DB Site',
        adminUser: 'admin',
        adminPass: 'admin',
        adminEmail: 'admin@test.com',
        withContent: false,
        wpVersion: 'latest',
        useDocker: false,
        noDb: true,
        verbose: false,
        selectedLocalPlugins: [],
        selectedPublicPlugins: []
      };

      fsMocks = mockFilesystem({
        '/path/to/wp-cli.phar': '__PHAR_FILE__'
      });

      ensureWpCliMock.mockResolvedValue(['php', '/path/to/wp-cli.phar']);

      execaMock.mockImplementation(async (cmd, args) => {
        if (args.includes('config') && args.includes('create')) {
          return createExecaResponse('Success');
        }
        if (args.includes('db') && args.includes('create')) {
          throw new Error('Should not create database with --no-db');
        }
        return createExecaResponse('Success');
      });

      const fs = await import('fs');
      const mkdirSyncSpy = vi.spyOn(fs.default, 'mkdirSync').mockImplementation(() => {});

      const installer = new WordPressInstaller(config);
      await installer.configureDatabase();

      mkdirSyncSpy.mockRestore();
    });
  });

  describe('error handling', () => {
    it('should fail when directory already exists', async () => {
      const config = {
        slug: 'existing-site',
        dbName: 'existing_site',
        dbUser: 'root',
        dbPass: '',
        dbHost: null,
        dbPrefix: 'wp_',
        url: 'existing-site.test',
        title: 'Existing Site',
        adminUser: 'admin',
        adminPass: 'admin',
        adminEmail: 'admin@test.com',
        withContent: false,
        wpVersion: 'latest',
        useDocker: false,
        noDb: false,
        verbose: false,
        selectedLocalPlugins: [],
        selectedPublicPlugins: []
      };

      const fs = await import('fs');
      const existsSyncSpy = vi.spyOn(fs.default, 'existsSync').mockReturnValue(true);

      const installer = new WordPressInstaller(config);

      await expect(installer.createDirectory()).rejects.toThrow('already exists');

      existsSyncSpy.mockRestore();
    });

    it('should handle WP-CLI download failure', async () => {
      ensureWpCliMock.mockRejectedValue(new Error('PHP not found'));

      await expect(ensureWpCli()).rejects.toThrow('PHP not found');
    });
  });
});