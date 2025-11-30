#!/usr/bin/env node
import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora'; // The loading spinner
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { WordPressInstaller } from '../src/installer.js';
import { getConfig, setConfig, getConfigValue, addToConfig, removeFromConfig, ensureDefaultConfig } from '../src/config.js';
import { ensureWpCli, getWpCliCommand } from '../src/wp-cli-manager.js';
import { isHerdInstalled } from '../src/herd-manager.js';
import { isValidEmail, normalizeUrl, normalizeDbPrefix, isValidDbName } from '../src/validators.js';
import {
    getCurrentVersion,
    getPackageName,
    checkForUpdate,
    performUpdate,
    shouldAutoCheck,
    updateLastCheckTime,
    getTimeAgo
} from '../src/updater.js';
import { DoctorCheck } from '../src/doctor.js';
import { listAllSites, getSite, removeSite, getCurrentSite } from '../src/site-registry.js';
import { getFullSiteInfo, getBasicSiteInfo } from '../src/site-info.js';
import { userExists, createUser, updateUserPassword } from '../src/user-manager.js';
import { execa } from 'execa';

const program = new Command();
const currentVersion = getCurrentVersion();

// Set version for --version flag
program.version(currentVersion, '-v, --version', 'Display current version');

// Config command
program
    .command('config')
    .description('Manage wpmax configuration')
    .argument('[key]', 'Config key')
    .argument('[value]', 'Config value')
    .option('-l, --list', 'List all configuration values')
    .option('--set', 'Set a config value (default action)')
    .option('--add', 'Add to array config value (for public-plugins)')
    .option('--remove', 'Remove from array config value (for public-plugins)')
    .action(async (key, value, options) => {
        // List all config
        if (options.list) {
            const config = getConfig();
            if (Object.keys(config).length === 0) {
                console.log(chalk.yellow('No configuration set yet.'));
                console.log('\nAvailable keys:');
                console.log('  Paths:');
                console.log('    - default-plugins-path');
                console.log('    - default-themes-path');
                console.log('  Database:');
                console.log('    - dbuser, dbhost, dbprefix');
                console.log('  Admin:');
                console.log('    - admin-user, admin-email');
                console.log('  Plugins:');
                console.log('    - public-plugins (comma-separated list)');
                return;
            }
            console.log(chalk.bold('Current configuration:\n'));
            for (const [k, v] of Object.entries(config)) {
                const displayValue = Array.isArray(v) ? v.join(', ') : v;
                console.log(`  ${chalk.cyan(k)}: ${displayValue}`);
            }
            return;
        }

        if (!key || !value) {
            console.error(chalk.red('Error: Both key and value are required.'));
            console.log('\nUsage:');
            console.log('  wpmax config --list');
            console.log('  wpmax config --set <key> <value>');
            console.log('  wpmax config --add public-plugins "woocommerce,yoast-seo"');
            console.log('  wpmax config --remove public-plugins "woocommerce"');
            process.exit(1);
        }

        // Convert kebab-case to camelCase for storage
        const configKey = key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

        // Validate key
        const validKeys = [
            'defaultPluginsPath',
            'defaultThemesPath',
            'dbuser',
            'dbhost',
            'dbprefix',
            'adminUser',
            'adminEmail',
            'publicPlugins',
            'tld'
        ];

        if (!validKeys.includes(configKey)) {
            console.error(chalk.red(`Error: Invalid config key "${key}"`));
            console.log('\nValid keys:');
            console.log('  - default-plugins-path, default-themes-path');
            console.log('  - dbuser, dbhost, dbprefix');
            console.log('  - admin-user, admin-email');
            console.log('  - public-plugins');
            process.exit(1);
        }

        // Handle operations
        try {
            if (options.add) {
                // Add operation (for arrays)
                addToConfig(configKey, value);
                console.log(chalk.green(`✓ Added to ${chalk.cyan(key)}: ${value}`));
            } else if (options.remove) {
                // Remove operation (for arrays)
                removeFromConfig(configKey, value);
                console.log(chalk.green(`✓ Removed from ${chalk.cyan(key)}: ${value}`));
            } else {
                // Set operation (default)
                // Validate path for path keys
                const pathKeys = ['defaultPluginsPath', 'defaultThemesPath'];
                if (pathKeys.includes(configKey)) {
                    const absolutePath = path.resolve(value);
                    if (!fs.existsSync(absolutePath)) {
                        console.error(chalk.red(`Error: Path does not exist: ${absolutePath}`));
                        process.exit(1);
                    }
                    setConfig(configKey, absolutePath);
                    console.log(chalk.green(`✓ Set ${chalk.cyan(key)} to ${absolutePath}`));
                } else {
                    setConfig(configKey, value);
                    console.log(chalk.green(`✓ Set ${chalk.cyan(key)} to ${value}`));
                }
            }
        } catch (error) {
            console.error(chalk.red(`Error saving config: ${error.message}`));
            process.exit(1);
        }
    });

// Update command
program
    .command('update')
    .description('Check for updates and update wpmax to the latest version')
    .option('-c, --check', 'Only check for updates without installing')
    .option('-y, --yes', 'Skip confirmation and update immediately')
    .action(async (options) => {
        const spinner = ora();
        const packageName = getPackageName();

        try {
            spinner.start('Checking for updates...');
            const updateInfo = await checkForUpdate();
            spinner.stop();

            if (!updateInfo.updateAvailable) {
                console.log(chalk.green(`\n✓ You're running the latest version (${chalk.bold(updateInfo.currentVersion)})\n`));
                return;
            }

            // Show update available message
            console.log(chalk.yellow(`\nUpdate available: ${chalk.dim(updateInfo.currentVersion)} → ${chalk.bold.green(updateInfo.latestVersion)}`));
            console.log(chalk.dim(`Published ${getTimeAgo(updateInfo.publishedAt)}\n`));

            // If --check flag, just show info and exit
            if (options.check) {
                console.log(chalk.cyan('Run "wpmax update" to install the latest version\n'));
                return;
            }

            // Prompt for confirmation unless --yes flag
            let shouldUpdate = options.yes;
            if (!shouldUpdate) {
                const answers = await inquirer.prompt([
                    {
                        type: 'confirm',
                        name: 'update',
                        message: `Update to v${updateInfo.latestVersion}?`,
                        default: true
                    }
                ]);
                shouldUpdate = answers.update;
            }

            if (!shouldUpdate) {
                console.log(chalk.dim('Update cancelled\n'));
                return;
            }

            // Perform update
            spinner.start(`Installing ${packageName}@${updateInfo.latestVersion}...`);
            await performUpdate(packageName);
            spinner.stop();

            console.log(chalk.green(`\n✓ Successfully updated to v${updateInfo.latestVersion}!\n`));

        } catch (error) {
            spinner.stop();
            console.error(chalk.red(`\nUpdate failed: ${error.message}\n`));
            process.exit(1);
        }
    });

// Doctor command
program
    .command('doctor')
    .description('Check system requirements and diagnose issues')
    .action(async () => {
        const spinner = ora();

        console.log(chalk.bold('\n🔍 Running diagnostics...\n'));

        const doctor = new DoctorCheck();

        // 1. Check WP-CLI
        spinner.start('Checking WP-CLI...');
        const wpCliStatus = await doctor.checkWpCli();
        if (wpCliStatus.ok) {
            spinner.succeed(chalk.green(`WP-CLI: ${wpCliStatus.version}`));
        } else {
            spinner.warn(chalk.yellow(`WP-CLI: ${wpCliStatus.error}`));
        }

        // 2. Check PHP
        spinner.start('Checking PHP...');
        const phpStatus = await doctor.checkPhp();
        if (phpStatus.ok) {
            const hasIssues = phpStatus.missingExtensions && phpStatus.missingExtensions.length > 0;
            if (hasIssues) {
                spinner.warn(chalk.yellow(`PHP: ${phpStatus.version} (missing extensions)`));
            } else {
                spinner.succeed(chalk.green(`PHP: ${phpStatus.version}`));
            }
        } else {
            spinner.fail(chalk.red(`PHP: ${phpStatus.error}`));
        }

        // 3. Check MySQL
        spinner.start('Checking MySQL...');
        const mysqlStatus = await doctor.checkMySQL();
        if (mysqlStatus.ok) {
            spinner.succeed(chalk.green(`MySQL: Connected via ${mysqlStatus.connection}`));
        } else {
            spinner.fail(chalk.red(`MySQL: ${mysqlStatus.error}`));
        }

        // 4. Check Herd (optional)
        spinner.start('Checking Herd...');
        const herdStatus = await doctor.checkHerd();
        if (herdStatus.installed) {
            spinner.succeed(chalk.green(`Herd: Installed${herdStatus.version ? ` (${herdStatus.version})` : ''}`));
        } else {
            spinner.info(chalk.dim('Herd: Not installed (optional)'));
        }

        // 5. Check Permissions
        spinner.start('Checking permissions...');
        const permStatus = await doctor.checkPermissions();
        if (permStatus.ok) {
            spinner.succeed(chalk.green('Permissions: OK'));
        } else {
            spinner.fail(chalk.red(`Permissions: ${permStatus.failedDirs?.length || 0} director${permStatus.failedDirs?.length === 1 ? 'y' : 'ies'} not writable`));
        }

        // 6. Check Config
        spinner.start('Checking config...');
        const configStatus = await doctor.checkConfig();
        if (configStatus.ok) {
            if (configStatus.hasSettings) {
                spinner.succeed(chalk.green('Config: Found with settings'));
            } else {
                spinner.info(chalk.dim('Config: Using defaults'));
            }
        } else {
            spinner.warn(chalk.yellow(`Config: ${configStatus.error}`));
        }

        // Print Environment Info
        const env = doctor.getEnvironmentInfo();
        console.log(chalk.bold('\nEnvironment:'));
        console.log(`  OS: ${env.os} ${env.osVersion}`);
        console.log(`  Node: ${env.node}`);
        console.log(`  Arch: ${env.arch}`);
        console.log(`  Shell: ${env.shell}`);
        console.log(`  Config: ${env.configPath}`);

        // Print Summary
        const totalIssues = doctor.issues.length;
        if (totalIssues === 0) {
            console.log(chalk.green('\n✅ All checks passed! You\'re ready to create WordPress sites.\n'));
        } else {
            console.log(chalk.yellow(`\n⚠ ${totalIssues} issue${totalIssues === 1 ? '' : 's'} found:\n`));
            doctor.issues.forEach(issue => {
                console.log(chalk.yellow(`  • ${issue.description}`));
                if (issue.fix) {
                    console.log(chalk.dim(`    Fix: ${issue.fix}`));
                }
            });
            console.log('');
        }
    });

// List command
program
    .command('list')
    .description('List all WordPress sites created with wpmax')
    .action(async () => {
        const sites = listAllSites();

        if (sites.length === 0) {
            console.log(chalk.yellow('\nNo sites found. Create one with: wpmax <name>\n'));
            return;
        }

        console.log(chalk.bold(`\nMy Sites (${sites.length} total):\n`));

        // Get basic info for each site (with directory size)
        for (const site of sites) {
            const info = await getBasicSiteInfo(site.name);
            const exists = info.exists ? '' : chalk.red(' (deleted)');
            const created = new Date(site.created_at);
            const timeAgo = getTimeAgo(site.created_at);

            console.log(`  ${chalk.cyan('•')} ${chalk.bold(site.name).padEnd(20)} ${site.url.padEnd(30)} ${timeAgo.padEnd(15)} ${info.directorySize}${exists}`);
        }

        console.log('');
    });

// Info command
program
    .command('info')
    .description('Display detailed information about a WordPress site')
    .argument('[name]', 'Name of the site')
    .action(async (name) => {
        let siteName = name;

        // If no name provided, show interactive list
        if (!siteName) {
            const sites = listAllSites();
            if (sites.length === 0) {
                console.log(chalk.yellow('\nNo sites found. Create one with: wpmax <name>\n'));
                return;
            }

            const answers = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'site',
                    message: 'Select a site:',
                    choices: sites.map(s => ({ name: s.name, value: s.name }))
                }
            ]);
            siteName = answers.site;
        }

        // Get full site info
        const spinner = ora('Loading site information...').start();
        const info = await getFullSiteInfo(siteName);
        spinner.stop();

        if (!info) {
            console.log(chalk.red(`\nSite "${siteName}" not found.\n`));
            return;
        }

        if (!info.exists) {
            console.log(chalk.yellow(`\nSite "${siteName}" directory no longer exists.\n`));
            console.log(chalk.dim('Registry information:'));
            console.log(`  Path:    ${info.path} ${chalk.red('(deleted)')}`);
            console.log(`  URL:     ${info.url}`);
            console.log(`  Created: ${getTimeAgo(info.created_at)}\n`);
            return;
        }

        // Display comprehensive info
        console.log(chalk.bold(`\nSite: ${siteName}`));
        console.log('─'.repeat(50));
        console.log(`  Path:         ${info.path}`);
        console.log(`  URL:          ${chalk.cyan(info.url)}`);
        console.log(`  Created:      ${getTimeAgo(info.created_at)}`);
        console.log(`  Size:         ${info.directorySize}`);
        console.log('');
        console.log(`  WordPress:    ${info.wpVersion}`);
        console.log(`  PHP:          ${info.phpVersion}`);
        console.log(`  Database:     ${info.dbName} (${info.dbInfo.tableCount} tables, ${info.dbInfo.size})`);
        console.log('');
        console.log(`  Admin:        ${info.adminUser}`);
        console.log(`  Email:        ${info.adminEmail}`);
        console.log('');

        if (info.plugins && info.plugins.length > 0) {
            console.log(`  Plugins:      ${info.plugins.length} active`);
            info.plugins.forEach(plugin => {
                console.log(`    ${chalk.dim('•')} ${plugin}`);
            });
        } else {
            console.log(`  Plugins:      None active`);
        }

        console.log('');
        console.log(`  Theme:        ${info.theme}`);
        console.log('');
    });

// Delete command
program
    .command('delete')
    .description('Delete a WordPress site (directory, database, and registry)')
    .argument('[name]', 'Name of the site to delete')
    .option('--yes', 'Skip confirmation prompt')
    .option('--keep-db', 'Keep the database')
    .option('--keep-files', 'Keep the directory')
    .option('--dry-run', 'Show what would be deleted without actually deleting')
    .action(async (name, options) => {
        let siteName = name;

        // If no name provided, show interactive list
        if (!siteName) {
            const sites = listAllSites();
            if (sites.length === 0) {
                console.log(chalk.yellow('\nNo sites found.\n'));
                return;
            }

            const answers = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'site',
                    message: 'Select a site to delete:',
                    choices: sites.map(s => ({ name: s.name, value: s.name }))
                }
            ]);
            siteName = answers.site;
        }

        // Get site info
        const site = getSite(siteName);
        if (!site) {
            console.log(chalk.red(`\nSite "${siteName}" not found in registry.\n`));
            return;
        }

        // Check what exists
        const dirExists = fs.existsSync(site.path);
        const info = dirExists ? await getBasicSiteInfo(siteName) : null;

        // Show what will be deleted
        console.log(chalk.bold(`\nAbout to delete: ${siteName}\n`));
        console.log('The following will be removed:');

        if (dirExists && !options.keepFiles) {
            console.log(`  ${chalk.cyan('•')} Directory: ${site.path} (${info?.directorySize || 'Unknown'})`);
        } else if (dirExists && options.keepFiles) {
            console.log(`  ${chalk.dim('○')} Directory: ${site.path} ${chalk.dim('(keeping)')}`);
        } else {
            console.log(`  ${chalk.dim('○')} Directory: ${site.path} ${chalk.yellow('(not found)')}`);
        }

        if (!options.keepDb) {
            console.log(`  ${chalk.cyan('•')} Database: ${site.dbName}`);
        } else {
            console.log(`  ${chalk.dim('○')} Database: ${site.dbName} ${chalk.dim('(keeping)')}`);
        }

        console.log(`  ${chalk.cyan('•')} Registry entry`);
        console.log('');

        // Dry run mode
        if (options.dryRun) {
            console.log(chalk.dim('Dry run mode - nothing was deleted.\n'));
            return;
        }

        // Confirmation
        if (!options.yes) {
            const answers = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Are you sure?',
                    default: false
                }
            ]);

            if (!answers.confirm) {
                console.log(chalk.dim('Deletion cancelled.\n'));
                return;
            }
        }

        const spinner = ora();

        try {
            // Delete directory
            if (dirExists && !options.keepFiles) {
                spinner.start('Deleting directory...');
                await execa('rm', ['-rf', site.path]);
                spinner.succeed('Directory deleted');
            }

            // Delete database
            if (!options.keepDb && dirExists) {
                spinner.start('Dropping database...');
                try {
                    const [phpCmd, wpCliPath] = getWpCliCommand();
                    await execa(phpCmd, [wpCliPath, 'db', 'drop', '--yes', '--quiet'], { cwd: site.path });
                    spinner.succeed('Database dropped');
                } catch (error) {
                    spinner.warn('Database drop failed (may not exist)');
                }
            }

            // Remove from registry
            spinner.start('Removing from registry...');
            removeSite(siteName);
            spinner.succeed('Registry entry removed');

            console.log(chalk.green(`\n✅ Site "${siteName}" deleted successfully.\n`));

        } catch (error) {
            spinner.fail('Deletion failed');
            console.error(chalk.red(`\nError: ${error.message}\n`));
            process.exit(1);
        }
    });

// Main create command
program
    .name('wpmax')
    .description('Lightning-fast WordPress site scaffolding')
    .argument('[name]', 'Name of the site (slug)')
    .option('-d, --docker', 'Use Docker instead of local MySQL (Coming Soon)', false)
    .option('--no-db', 'Skip database creation (only create wp-config)')
    // WordPress options
    .option('--with-content', 'Include default WordPress themes and plugins', false)
    .option('--wp-version <version>', 'WordPress version to install (default: latest)', 'latest')
    // Database options
    .option('--dbname <name>', 'Database name (default: slug with underscores)')
    .option('--dbuser <user>', 'Database username', 'root')
    .option('--dbpass <password>', 'Database password (default: empty/no password)')
    .option('--dbhost <host>', 'Database host (default: auto-detected)')
    .option('--dbprefix <prefix>', 'Table prefix', 'wp_')
    // WordPress admin options
    .option('--admin-user <username>', 'WordPress admin username', 'admin')
    .option('--admin-pass <password>', 'WordPress admin password', 'admin')
    .option('--admin-email <email>', 'WordPress admin email', 'admin@test.com')
    // Site options
    .option('--url <url>', 'Site URL (default: {slug}.test)')
    .option('--title <title>', 'Site title (default: auto-generated from slug)')
    // Debug options
    .option('--verbose', 'Show detailed output and commands being executed', false)
    .option('--debug', 'Alias for --verbose', false)
    .action(async (name, options) => {
        // Set verbose mode
        const verbose = options.verbose || options.debug;

        // 1. Ensure default config is set
        ensureDefaultConfig();

        // 2. Auto-check for updates (once per day, non-blocking)
        if (shouldAutoCheck()) {
            try {
                const updateInfo = await checkForUpdate();
                updateLastCheckTime();

                if (updateInfo.updateAvailable) {
                    console.log(chalk.dim(`\n💡 Update available: ${updateInfo.currentVersion} → ${chalk.bold(updateInfo.latestVersion)} (run 'wpmax update')\n`));
                }
            } catch (error) {
                // Silently fail - don't interrupt the user's workflow
            }
        }

        // 2. Interactive Prompt if name is missing
        let siteName = name;
        if (!siteName) {
            const answers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'name',
                    message: 'What is the project name?',
                    validate: input => input ? true : 'Name cannot be empty'
                }
            ]);
            siteName = answers.name;
        }

        // 3. Plugin Selection (skip if --no-db is set)
        let selectedLocalPlugins = [];
        let selectedPublicPlugins = [];

        if (options.db !== false) {
            const pluginChoices = [];

            // A. Add local ZIP plugins
            const defaultPluginsPath = getConfigValue('defaultPluginsPath');
            if (defaultPluginsPath && fs.existsSync(defaultPluginsPath)) {
                const files = fs.readdirSync(defaultPluginsPath);
                const pluginFiles = files.filter(file => file.endsWith('.zip'));

                for (const file of pluginFiles) {
                    pluginChoices.push({
                        name: `${file} (local)`,
                        value: { type: 'local', path: path.join(defaultPluginsPath, file) },
                        checked: true
                    });
                }
            }

            // B. Add public plugins from config
            const publicPlugins = getConfigValue('publicPlugins') || [];
            for (const slug of publicPlugins) {
                pluginChoices.push({
                    name: `${slug} (WordPress.org)`,
                    value: { type: 'public', slug: slug },
                    checked: true
                });
            }

            // Show selection if there are any plugins
            if (pluginChoices.length > 0) {
                const pluginAnswers = await inquirer.prompt([
                    {
                        type: 'checkbox',
                        name: 'plugins',
                        message: 'Select plugins to install (use space to toggle):',
                        choices: pluginChoices
                    }
                ]);

                // Separate local and public plugins
                for (const plugin of pluginAnswers.plugins) {
                    if (plugin.type === 'local') {
                        selectedLocalPlugins.push(plugin.path);
                    } else if (plugin.type === 'public') {
                        selectedPublicPlugins.push(plugin.slug);
                    }
                }
            }
        }

        // 3. Configuration Setup - Merge CLI options with config file defaults
        try {
            // Load config file defaults
            const configDefaults = getConfig();

            // Database settings (CLI > config > built-in defaults)
            const dbName = options.dbname || siteName.replace(/-/g, '_');
            if (!isValidDbName(dbName)) {
                throw new Error(`Invalid database name: ${dbName}. Must be alphanumeric with underscores, max 64 chars.`);
            }

            const dbUser = options.dbuser || configDefaults.dbuser || 'root';
            const dbHost = options.dbhost || configDefaults.dbhost || null; // null = auto-detect
            const dbPrefix = normalizeDbPrefix(options.dbprefix || configDefaults.dbprefix || 'wp_');

            // Site settings (CLI > config > built-in defaults)
            const tld = configDefaults.tld || '.test';
            const url = normalizeUrl(options.url || `${siteName}${tld}`);
            const title = options.title || siteName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

            // Admin settings (CLI > config > built-in defaults)
            const adminUser = options.adminUser || configDefaults.adminUser || 'admin';
            const adminPass = options.adminPass || 'admin';
            const adminEmail = options.adminEmail || configDefaults.adminEmail || 'admin@test.com';

            if (!isValidEmail(adminEmail)) {
                throw new Error(`Invalid admin email: ${adminEmail}`);
            }

            var config = {
                slug: siteName,
                // Database settings
                dbName: dbName,
                dbUser: dbUser,
                dbPass: options.dbpass || '',
                dbHost: dbHost,
                dbPrefix: dbPrefix,
                // Site settings
                url: url,
                title: title,
                // Admin settings
                adminUser: adminUser,
                adminPass: adminPass,
                adminEmail: adminEmail,
                // WordPress settings
                withContent: options.withContent,
                wpVersion: options.wpVersion,
                // Flags
                useDocker: options.docker,
                noDb: options.db === false,
                verbose: verbose,
                // Plugins
                selectedLocalPlugins: selectedLocalPlugins,
                selectedPublicPlugins: selectedPublicPlugins
            };
        } catch (error) {
            console.error(chalk.red(`Configuration error: ${error.message}`));
            process.exit(1);
        }

        console.log(`\n🚀  Scaffolding WordPress in ${chalk.bold(config.slug)}...\n`);

        // Show configuration in verbose mode
        if (verbose) {
            console.log(chalk.dim('[DEBUG] Configuration:'));
            console.log(chalk.dim(`  slug: ${config.slug}`));
            console.log(chalk.dim(`  dbName: ${config.dbName}`));
            console.log(chalk.dim(`  dbUser: ${config.dbUser}`));
            console.log(chalk.dim(`  dbHost: ${config.dbHost || 'auto-detect'}`));
            console.log(chalk.dim(`  dbPrefix: ${config.dbPrefix}`));
            console.log(chalk.dim(`  url: ${config.url}`));
            console.log(chalk.dim(`  title: ${config.title}`));
            console.log(chalk.dim(`  adminUser: ${config.adminUser}`));
            console.log(chalk.dim(`  adminEmail: ${config.adminEmail}`));
            console.log(chalk.dim(`  wpVersion: ${config.wpVersion}`));
            console.log(chalk.dim(`  withContent: ${config.withContent}`));
            console.log('');
        }

        // 3. Ensure WP-CLI is available
        const spinner = ora();
        try {
            spinner.start('Checking WP-CLI availability...');
            await ensureWpCli();
            spinner.succeed();
        } catch (error) {
            spinner.fail('WP-CLI setup failed');
            console.error(chalk.red(error.message));
            process.exit(1);
        }

        // 4. Execution with Spinners
        const installer = new WordPressInstaller(config);

        try {
            spinner.start('Creating directory...');
            await installer.createDirectory();
            spinner.succeed();

            spinner.start('Downloading Core...');
            await installer.downloadCore();
            spinner.succeed();

            spinner.start('Configuring Database...');
            await installer.configureDatabase();
            spinner.succeed();

            if (!config.noDb) {
                spinner.start('Installing WordPress...');
                await installer.installWordPress();
                spinner.succeed();

                spinner.start('Installing Plugins...');
                await installer.installPlugins();
                spinner.succeed();

                // Check for Laravel Herd
                const herdAvailable = await isHerdInstalled();
                let siteUrl = `http://${config.url}`;

                if (herdAvailable) {
                    const herdAnswers = await inquirer.prompt([
                        {
                            type: 'confirm',
                            name: 'setupHerd',
                            message: 'Laravel Herd detected. Run "herd link" and "herd secure"?',
                            default: true
                        }
                    ]);

                    if (herdAnswers.setupHerd) {
                        spinner.start('Setting up Herd...');
                        await installer.setupHerd();
                        spinner.succeed();
                        siteUrl = `https://${config.slug}.test`;
                    }
                }

                // Register site in the registry
                installer.registerSite();

                // Show access information
                console.log(chalk.green('\n✅  Done! Your WordPress site is ready.\n'));
                console.log(chalk.bold('Site URL:'));
                console.log(`  ${chalk.cyan(siteUrl)}`);

                // Warn if content was skipped (no theme installed)
                if (!config.withContent) {
                    console.log(chalk.yellow('  ⚠️  Frontend is blank (no theme installed)'));
                    console.log(chalk.yellow('     Install a theme via wp-admin or use --with-content flag'));
                }
                console.log('');

                console.log(chalk.bold('Admin Dashboard:'));
                console.log(`  ${chalk.cyan(siteUrl + '/wp-admin')}\n`);
                console.log(chalk.bold('Login Credentials:'));
                console.log(`  Username: ${chalk.cyan(config.adminUser)}`);
                console.log(`  Password: ${chalk.cyan(config.adminPass)}\n`);
            } else {
                console.log(chalk.green('\n✅  Done! WordPress core downloaded and wp-config created.'));
                console.log(chalk.yellow('⚠  Database not created. Please create the database manually before accessing the site.'));
                console.log(`    Database name: ${chalk.cyan(config.dbName)}\n`);
            }

        } catch (error) {
            spinner.fail('Installation failed');
            console.error(chalk.red(error.message));
            process.exit(1);
        }
    });

// Command aliases
program
    .command('new')
    .description('Alias for main create command (same as wpmax <name>)')
    .argument('[name]', 'Name of the site (slug)')
    .allowUnknownOption()
    .action(async (name) => {
        // Re-parse with the main command
        const args = process.argv.slice(2);
        const index = args.indexOf('new');
        if (index !== -1) {
            args.splice(index, 1);
        }
        process.argv = [process.argv[0], process.argv[1], ...args];
        await program.parseAsync(process.argv);
    });

program
    .command('ls')
    .description('Alias for list command')
    .action(async () => {
        const sites = listAllSites();

        if (sites.length === 0) {
            console.log(chalk.yellow('\nNo sites found. Create one with: wpmax <name>\n'));
            return;
        }

        console.log(chalk.bold(`\nMy Sites (${sites.length} total):\n`));

        for (const site of sites) {
            const info = await getBasicSiteInfo(site.name);
            const exists = info.exists ? '' : chalk.red(' (deleted)');
            const created = new Date(site.created_at);
            const timeAgo = getTimeAgo(site.created_at);

            console.log(`  ${chalk.cyan('•')} ${chalk.bold(site.name).padEnd(20)} ${site.url.padEnd(30)} ${timeAgo.padEnd(15)} ${info.directorySize}${exists}`);
        }

        console.log('');
    });

program
    .command('rm')
    .description('Alias for delete command')
    .argument('[name]', 'Name of the site to delete')
    .option('--yes', 'Skip confirmation prompt')
    .option('--keep-db', 'Keep the database')
    .option('--keep-files', 'Keep the directory')
    .option('--dry-run', 'Show what would be deleted without actually deleting')
    .action(async (name, options) => {
        let siteName = name;

        if (!siteName) {
            const sites = listAllSites();
            if (sites.length === 0) {
                console.log(chalk.yellow('\nNo sites found.\n'));
                return;
            }

            const answers = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'site',
                    message: 'Select a site to delete:',
                    choices: sites.map(s => ({ name: s.name, value: s.name }))
                }
            ]);
            siteName = answers.site;
        }

        const site = getSite(siteName);
        if (!site) {
            console.log(chalk.red(`\nSite "${siteName}" not found in registry.\n`));
            return;
        }

        const dirExists = fs.existsSync(site.path);
        const info = dirExists ? await getBasicSiteInfo(siteName) : null;

        console.log(chalk.bold(`\nAbout to delete: ${siteName}\n`));
        console.log('The following will be removed:');

        if (dirExists && !options.keepFiles) {
            console.log(`  ${chalk.cyan('•')} Directory: ${site.path} (${info?.directorySize || 'Unknown'})`);
        } else if (dirExists && options.keepFiles) {
            console.log(`  ${chalk.dim('○')} Directory: ${site.path} ${chalk.dim('(keeping)')}`);
        } else {
            console.log(`  ${chalk.dim('○')} Directory: ${site.path} ${chalk.yellow('(not found)')}`);
        }

        if (!options.keepDb) {
            console.log(`  ${chalk.cyan('•')} Database: ${site.dbName}`);
        } else {
            console.log(`  ${chalk.dim('○')} Database: ${site.dbName} ${chalk.dim('(keeping)')}`);
        }

        console.log(`  ${chalk.cyan('•')} Registry entry`);
        console.log('');

        if (options.dryRun) {
            console.log(chalk.dim('Dry run mode - nothing was deleted.\n'));
            return;
        }

        if (!options.yes) {
            const answers = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'confirm',
                    message: 'Are you sure?',
                    default: false
                }
            ]);

            if (!answers.confirm) {
                console.log(chalk.dim('Deletion cancelled.\n'));
                return;
            }
        }

        const spinner = ora();

        try {
            if (dirExists && !options.keepFiles) {
                spinner.start('Deleting directory...');
                await execa('rm', ['-rf', site.path]);
                spinner.succeed('Directory deleted');
            }

            if (!options.keepDb && dirExists) {
                spinner.start('Dropping database...');
                try {
                    const [phpCmd, wpCliPath] = getWpCliCommand();
                    await execa(phpCmd, [wpCliPath, 'db', 'drop', '--yes', '--quiet'], { cwd: site.path });
                    spinner.succeed('Database dropped');
                } catch (error) {
                    spinner.warn('Database drop failed (may not exist)');
                }
            }

            spinner.start('Removing from registry...');
            removeSite(siteName);
            spinner.succeed('Registry entry removed');

            console.log(chalk.green(`\n✅ Site "${siteName}" deleted successfully.\n`));

        } catch (error) {
            spinner.fail('Deletion failed');
            console.error(chalk.red(`\nError: ${error.message}\n`));
            process.exit(1);
        }
    });

// User command with subcommands
const userCommand = program
    .command('user')
    .description('Manage WordPress users');

// User add subcommand
userCommand
    .command('add')
    .description('Create a new WordPress user (run from site directory)')
    .argument('<username>', 'Username for the new user')
    .option('-e, --email <email>', 'Email address (default: <username>@test.com)')
    .option('-p, --password <password>', 'Password (default: admin)')
    .option('-r, --role <role>', 'User role (default: administrator)', 'administrator')
    .action(async (username, options) => {
        const spinner = ora();

        try {
            // Get current site from directory
            const siteInfo = getCurrentSite();
            if (!siteInfo) {
                console.log(chalk.red(`\nNot in a WordPress site directory.\n`));
                console.log(chalk.dim('Please run this command from a site directory created with wpmax.\n'));
                process.exit(1);
            }

            if (!fs.existsSync(siteInfo.path)) {
                console.log(chalk.red(`\nSite directory does not exist: ${siteInfo.path}\n`));
                process.exit(1);
            }

            // Check if user already exists
            spinner.start('Checking if user exists...');
            const exists = await userExists(username, siteInfo.path);
            spinner.stop();

            if (exists) {
                console.log(chalk.yellow(`\nUser "${username}" already exists.\n`));
                return;
            }

            // Set defaults
            const email = options.email || `${username}@test.com`;
            const password = options.password || 'admin';
            const role = options.role;

            // Validate email
            if (!isValidEmail(email)) {
                console.log(chalk.red(`\nInvalid email address: ${email}\n`));
                process.exit(1);
            }

            // Create user
            spinner.start('Creating user...');
            await createUser(username, email, password, siteInfo.path, role);
            spinner.succeed();

            console.log(chalk.green(`\n✅ User created successfully!\n`));
            console.log(chalk.bold('User Details:'));
            console.log(`  Username: ${chalk.cyan(username)}`);
            console.log(`  Email:    ${chalk.cyan(email)}`);
            console.log(`  Password: ${chalk.cyan(password)}`);
            console.log(`  Role:     ${chalk.cyan(role)}\n`);

        } catch (error) {
            spinner.fail('User creation failed');
            console.error(chalk.red(`\nError: ${error.message}\n`));
            process.exit(1);
        }
    });

// User password subcommand
userCommand
    .command('password')
    .description('Change a WordPress user password (run from site directory)')
    .argument('<username>', 'Username to update')
    .argument('[password]', 'New password (default: admin)')
    .action(async (username, password) => {
        const spinner = ora();

        try {
            // Get current site from directory
            const siteInfo = getCurrentSite();
            if (!siteInfo) {
                console.log(chalk.red(`\nNot in a WordPress site directory.\n`));
                console.log(chalk.dim('Please run this command from a site directory created with wpmax.\n'));
                process.exit(1);
            }

            if (!fs.existsSync(siteInfo.path)) {
                console.log(chalk.red(`\nSite directory does not exist: ${siteInfo.path}\n`));
                process.exit(1);
            }

            // Check if user exists
            spinner.start('Checking if user exists...');
            const exists = await userExists(username, siteInfo.path);
            spinner.stop();

            if (!exists) {
                console.log(chalk.yellow(`\nUser "${username}" does not exist.\n`));
                return;
            }

            // Set default password if not provided
            const newPassword = password || 'admin';

            // Update password
            spinner.start('Updating password...');
            await updateUserPassword(username, newPassword, siteInfo.path);
            spinner.succeed();

            console.log(chalk.green(`\n✅ Password updated successfully!\n`));
            console.log(chalk.bold('User Details:'));
            console.log(`  Username: ${chalk.cyan(username)}`);
            console.log(`  Password: ${chalk.cyan(newPassword)}\n`);

        } catch (error) {
            spinner.fail('Password update failed');
            console.error(chalk.red(`\nError: ${error.message}\n`));
            process.exit(1);
        }
    });

program.parse();