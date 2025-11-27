// tests/unit/installer.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WordPressInstaller } from '../../src/installer.js';
import { mockFilesystem } from '../helpers/mock-filesystem.js';
import { createExecaResponse } from '../helpers/mock-execa.js';

// Mock modules
vi.mock('execa', () => ({
  execa: vi.fn()
}));

vi.mock('../../src/wp-cli-manager.js', () => ({
  getWpCliCommand: vi.fn(() => ['php', '/path/to/wp-cli.phar'])
}));

vi.mock('../../src/mysql-detector.js', () => ({
  getMySQLConnection: vi.fn(() => Promise.resolve('127.0.0.1'))
}));

vi.mock('../../src/herd-manager.js', () => ({
  herdLink: vi.fn(),
  herdSecure: vi.fn()
}));

vi.mock('../../src/site-registry.js', () => ({
  addSite: vi.fn()
}));

describe('WordPressInstaller', () => {
  let execaMock;
  let getMySQLConnectionMock;
  let herdLinkMock;
  let herdSecureMock;
  let addSiteMock;
  let fsMocks;
  let installer;
  let testConfig;

  beforeEach(async () => {
    const { execa } = await import('execa');
    const { getMySQLConnection } = await import('../../src/mysql-detector.js');
    const { herdLink, herdSecure } = await import('../../src/herd-manager.js');
    const { addSite } = await import('../../src/site-registry.js');

    execaMock = execa;
    getMySQLConnectionMock = getMySQLConnection;
    herdLinkMock = herdLink;
    herdSecureMock = herdSecure;
    addSiteMock = addSite;

    vi.clearAllMocks();

    testConfig = {
      slug: 'test-site',
      title: 'Test Site',
      url: 'test-site.test',
      dbName: 'test_site',
      dbUser: 'root',
      dbPass: '',
      dbPrefix: 'wp_',
      adminUser: 'admin',
      adminPass: 'admin',
      adminEmail: 'admin@test.com',
      withContent: false,
      wpVersion: 'latest',
      useDocker: false,
      noDb: false,
      selectedPublicPlugins: [],
      selectedLocalPlugins: []
    };

    // Mock process.cwd()
    vi.spyOn(process, 'cwd').mockReturnValue('/Users/test/Sites');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with config', () => {
      installer = new WordPressInstaller(testConfig);

      expect(installer.config).toEqual(testConfig);
      expect(installer.cwd).toBe('/Users/test/Sites/test-site');
      expect(installer.wpCliCmd).toEqual(['php', '/path/to/wp-cli.phar']);
      expect(installer.dbHost).toBeNull();
    });

    it('should set cwd based on current directory and slug', () => {
      process.cwd.mockReturnValue('/custom/path');
      installer = new WordPressInstaller(testConfig);

      expect(installer.cwd).toBe('/custom/path/test-site');
    });
  });

  describe('createDirectory', () => {
    it('should create directory when it does not exist', async () => {
      fsMocks = mockFilesystem({});
      execaMock.mockResolvedValue(createExecaResponse(''));

      installer = new WordPressInstaller(testConfig);
      await installer.createDirectory();

      expect(execaMock).toHaveBeenCalledWith('mkdir', ['test-site']);
    });

    it('should throw error when directory already exists', async () => {
      fsMocks = mockFilesystem({
        '/Users/test/Sites/test-site': '__DIR__'
      });

      installer = new WordPressInstaller(testConfig);

      await expect(installer.createDirectory()).rejects.toThrow(
        'Directory test-site already exists'
      );
      expect(execaMock).not.toHaveBeenCalled();
    });
  });

  describe('downloadCore', () => {
    beforeEach(() => {
      installer = new WordPressInstaller(testConfig);
      execaMock.mockResolvedValue(createExecaResponse(''));
    });

    it('should download WordPress core with skip-content by default', async () => {
      await installer.downloadCore();

      expect(execaMock).toHaveBeenCalledWith(
        'php',
        ['/path/to/wp-cli.phar', 'core', 'download', '--skip-content', '--quiet'],
        { cwd: '/Users/test/Sites/test-site' }
      );
    });

    it('should include content when withContent is true', async () => {
      installer.config.withContent = true;

      await installer.downloadCore();

      expect(execaMock).toHaveBeenCalledWith(
        'php',
        expect.not.arrayContaining(['--skip-content']),
        expect.any(Object)
      );
      expect(execaMock).toHaveBeenCalledWith(
        'php',
        ['/path/to/wp-cli.phar', 'core', 'download', '--quiet'],
        { cwd: '/Users/test/Sites/test-site' }
      );
    });

    it('should specify WordPress version when provided and not latest', async () => {
      installer.config.wpVersion = '6.4.2';

      await installer.downloadCore();

      expect(execaMock).toHaveBeenCalledWith(
        'php',
        expect.arrayContaining(['--version=6.4.2']),
        expect.any(Object)
      );
    });

    it('should not add version flag when version is latest', async () => {
      installer.config.wpVersion = 'latest';

      await installer.downloadCore();

      expect(execaMock).toHaveBeenCalledWith(
        'php',
        expect.not.arrayContaining([expect.stringContaining('--version')]),
        expect.any(Object)
      );
    });

    it('should use correct working directory', async () => {
      await installer.downloadCore();

      expect(execaMock).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        { cwd: '/Users/test/Sites/test-site' }
      );
    });
  });

  describe('configureDatabase', () => {
    beforeEach(() => {
      installer = new WordPressInstaller(testConfig);
      execaMock.mockResolvedValue(createExecaResponse(''));
      getMySQLConnectionMock.mockResolvedValue('127.0.0.1');
    });

    it('should create database config with auto-detected MySQL connection', async () => {
      await installer.configureDatabase();

      expect(getMySQLConnectionMock).toHaveBeenCalledWith('root');
      expect(execaMock).toHaveBeenCalledWith(
        'php',
        [
          '/path/to/wp-cli.phar',
          'config', 'create',
          '--dbname=test_site',
          '--dbuser=root',
          '--dbhost=127.0.0.1',
          '--prompt=',
          '--dbprefix=wp_',
          '--quiet'
        ],
        { cwd: '/Users/test/Sites/test-site' }
      );
    });

    it('should use provided dbHost instead of auto-detection', async () => {
      installer.config.dbHost = 'localhost:/tmp/mysql.sock';

      await installer.configureDatabase();

      expect(getMySQLConnectionMock).not.toHaveBeenCalled();
      expect(execaMock).toHaveBeenCalledWith(
        'php',
        expect.arrayContaining(['--dbhost=localhost:/tmp/mysql.sock']),
        expect.any(Object)
      );
    });

    it('should include password when provided', async () => {
      installer.config.dbPass = 'secret123';

      await installer.configureDatabase();

      expect(execaMock).toHaveBeenCalledWith(
        'php',
        expect.arrayContaining(['--dbpass=secret123']),
        expect.any(Object)
      );
      expect(execaMock).toHaveBeenCalledWith(
        'php',
        expect.not.arrayContaining(['--prompt=']),
        expect.any(Object)
      );
    });

    it('should create database after config', async () => {
      await installer.configureDatabase();

      const calls = execaMock.mock.calls;
      expect(calls[0][1]).toEqual(expect.arrayContaining(['config', 'create']));
      expect(calls[1][1]).toEqual(['/path/to/wp-cli.phar', 'db', 'create', '--quiet']);
    });

    it('should reset database if it already exists', async () => {
      execaMock.mockImplementation(async (cmd, args) => {
        // Only throw on "db create", not "config create"
        if (args.length === 4 && args[1] === 'db' && args[2] === 'create') {
          const error = new Error('ERROR 1007: database exists');
          throw error;
        }
        return createExecaResponse('');
      });

      await installer.configureDatabase();

      expect(execaMock).toHaveBeenCalledWith(
        'php',
        ['/path/to/wp-cli.phar', 'db', 'reset', '--yes', '--quiet'],
        { cwd: '/Users/test/Sites/test-site' }
      );
    });

    it('should skip database creation when noDb is true', async () => {
      installer.config.noDb = true;

      await installer.configureDatabase();

      expect(execaMock).toHaveBeenCalledWith(
        'php',
        expect.arrayContaining(['config', 'create']),
        expect.any(Object)
      );
      expect(execaMock).not.toHaveBeenCalledWith(
        'php',
        expect.arrayContaining(['db', 'create']),
        expect.any(Object)
      );
    });

    it('should store dbHost for later use', async () => {
      getMySQLConnectionMock.mockResolvedValue('localhost:/tmp/mysql.sock');

      await installer.configureDatabase();

      expect(installer.dbHost).toBe('localhost:/tmp/mysql.sock');
    });

    it('should rethrow non-database-exists errors', async () => {
      execaMock.mockImplementation(async (cmd, args) => {
        // Only throw on "db create", not "config create"
        if (args.length === 4 && args[1] === 'db' && args[2] === 'create') {
          throw new Error('Connection refused');
        }
        return createExecaResponse('');
      });

      await expect(installer.configureDatabase()).rejects.toThrow('Connection refused');
    });
  });

  describe('installWordPress', () => {
    beforeEach(() => {
      installer = new WordPressInstaller(testConfig);
      execaMock.mockResolvedValue(createExecaResponse(''));
    });

    it('should install WordPress with correct parameters', async () => {
      await installer.installWordPress();

      expect(execaMock).toHaveBeenCalledWith(
        'php',
        [
          '/path/to/wp-cli.phar',
          'core', 'install',
          '--url=test-site.test',
          '--title=Test Site',
          '--admin_user=admin',
          '--admin_password=admin',
          '--admin_email=admin@test.com',
          '--quiet'
        ],
        { cwd: '/Users/test/Sites/test-site' }
      );
    });

    it('should use custom admin credentials', async () => {
      installer.config.adminUser = 'superadmin';
      installer.config.adminPass = 'strongpass';
      installer.config.adminEmail = 'super@example.com';

      await installer.installWordPress();

      expect(execaMock).toHaveBeenCalledWith(
        'php',
        expect.arrayContaining([
          '--admin_user=superadmin',
          '--admin_password=strongpass',
          '--admin_email=super@example.com'
        ]),
        expect.any(Object)
      );
    });
  });

  describe('installPlugins', () => {
    beforeEach(() => {
      installer = new WordPressInstaller(testConfig);
      execaMock.mockResolvedValue(createExecaResponse(''));
    });

    it('should install public plugins from WordPress.org', async () => {
      installer.config.selectedPublicPlugins = ['woocommerce', 'yoast-seo'];

      await installer.installPlugins();

      expect(execaMock).toHaveBeenCalledWith(
        'php',
        ['/path/to/wp-cli.phar', 'plugin', 'install', 'woocommerce', '--activate', '--quiet'],
        { cwd: '/Users/test/Sites/test-site' }
      );
      expect(execaMock).toHaveBeenCalledWith(
        'php',
        ['/path/to/wp-cli.phar', 'plugin', 'install', 'yoast-seo', '--activate', '--quiet'],
        { cwd: '/Users/test/Sites/test-site' }
      );
    });

    it('should install local plugins from ZIP files', async () => {
      const pluginPath = '/Users/test/plugins/premium-plugin.zip';
      fsMocks = mockFilesystem({
        [pluginPath]: '__ZIP_FILE__'
      });

      installer.config.selectedLocalPlugins = [pluginPath];

      await installer.installPlugins();

      expect(execaMock).toHaveBeenCalledWith(
        'php',
        ['/path/to/wp-cli.phar', 'plugin', 'install', pluginPath, '--activate', '--quiet'],
        { cwd: '/Users/test/Sites/test-site' }
      );
    });

    it('should skip local plugins that do not exist', async () => {
      fsMocks = mockFilesystem({});

      installer.config.selectedLocalPlugins = ['/nonexistent/plugin.zip'];

      await installer.installPlugins();

      expect(execaMock).not.toHaveBeenCalledWith(
        'php',
        expect.arrayContaining(['/nonexistent/plugin.zip']),
        expect.any(Object)
      );
    });

    it('should install both public and local plugins', async () => {
      const pluginPath = '/Users/test/plugins/custom.zip';
      fsMocks = mockFilesystem({
        [pluginPath]: '__ZIP_FILE__'
      });

      installer.config.selectedPublicPlugins = ['akismet'];
      installer.config.selectedLocalPlugins = [pluginPath];

      await installer.installPlugins();

      expect(execaMock).toHaveBeenCalledWith(
        'php',
        expect.arrayContaining(['akismet']),
        expect.any(Object)
      );
      expect(execaMock).toHaveBeenCalledWith(
        'php',
        expect.arrayContaining([pluginPath]),
        expect.any(Object)
      );
    });

    it('should not install anything when no plugins selected', async () => {
      installer.config.selectedPublicPlugins = [];
      installer.config.selectedLocalPlugins = [];

      await installer.installPlugins();

      expect(execaMock).not.toHaveBeenCalled();
    });
  });

  describe('setupHerd', () => {
    beforeEach(() => {
      installer = new WordPressInstaller(testConfig);
      herdLinkMock.mockResolvedValue();
      herdSecureMock.mockResolvedValue();
    });

    it('should run herd link and herd secure', async () => {
      await installer.setupHerd();

      expect(herdLinkMock).toHaveBeenCalledWith('/Users/test/Sites/test-site');
      expect(herdSecureMock).toHaveBeenCalledWith('/Users/test/Sites/test-site');
    });

    it('should run commands in correct order', async () => {
      const callOrder = [];
      herdLinkMock.mockImplementation(async () => {
        callOrder.push('link');
      });
      herdSecureMock.mockImplementation(async () => {
        callOrder.push('secure');
      });

      await installer.setupHerd();

      expect(callOrder).toEqual(['link', 'secure']);
    });
  });

  describe('registerSite', () => {
    beforeEach(() => {
      installer = new WordPressInstaller(testConfig);
      addSiteMock.mockImplementation(() => {});
    });

    it('should register site with correct data', () => {
      installer.dbHost = '127.0.0.1';

      installer.registerSite();

      expect(addSiteMock).toHaveBeenCalledWith({
        name: 'test-site',
        path: '/Users/test/Sites/test-site',
        url: 'test-site.test',
        created_at: expect.any(String),
        dbName: 'test_site',
        dbUser: 'root',
        dbHost: '127.0.0.1',
        adminUser: 'admin',
        adminEmail: 'admin@test.com'
      });
    });

    it('should use dbHost from config if not set during installation', () => {
      installer.config.dbHost = 'localhost:/tmp/mysql.sock';
      installer.dbHost = null;

      installer.registerSite();

      expect(addSiteMock).toHaveBeenCalledWith(
        expect.objectContaining({
          dbHost: 'localhost:/tmp/mysql.sock'
        })
      );
    });

    it('should fallback to localhost if no dbHost available', () => {
      installer.dbHost = null;
      installer.config.dbHost = null;

      installer.registerSite();

      expect(addSiteMock).toHaveBeenCalledWith(
        expect.objectContaining({
          dbHost: 'localhost'
        })
      );
    });

    it('should include ISO timestamp for created_at', () => {
      installer.registerSite();

      const callArgs = addSiteMock.mock.calls[0][0];
      expect(callArgs.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('full installation workflow', () => {
    it('should handle complete installation process', async () => {
      fsMocks = mockFilesystem({});
      execaMock.mockResolvedValue(createExecaResponse(''));
      getMySQLConnectionMock.mockResolvedValue('127.0.0.1');
      herdLinkMock.mockResolvedValue();
      herdSecureMock.mockResolvedValue();

      installer = new WordPressInstaller(testConfig);

      await installer.createDirectory();
      await installer.downloadCore();
      await installer.configureDatabase();
      await installer.installWordPress();
      await installer.installPlugins();
      installer.registerSite();

      expect(execaMock).toHaveBeenCalledWith('mkdir', ['test-site']);
      expect(execaMock).toHaveBeenCalledWith(
        'php',
        expect.arrayContaining(['core', 'download']),
        expect.any(Object)
      );
      expect(execaMock).toHaveBeenCalledWith(
        'php',
        expect.arrayContaining(['config', 'create']),
        expect.any(Object)
      );
      expect(execaMock).toHaveBeenCalledWith(
        'php',
        expect.arrayContaining(['core', 'install']),
        expect.any(Object)
      );
      expect(addSiteMock).toHaveBeenCalled();
    });
  });
});