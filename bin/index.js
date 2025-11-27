#!/usr/bin/env node
import { Command } from 'commander';
import inquirer from 'inquirer';
import ora from 'ora'; // The loading spinner
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { WordPressInstaller } from '../src/installer.js';
import { getConfig, setConfig, getConfigValue, addToConfig, removeFromConfig, ensureDefaultConfig } from '../src/config.js';
import { ensureWpCli } from '../src/wp-cli-manager.js';
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
    .action(async (name, options) => {

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
                // Plugins
                selectedLocalPlugins: selectedLocalPlugins,
                selectedPublicPlugins: selectedPublicPlugins
            };
        } catch (error) {
            console.error(chalk.red(`Configuration error: ${error.message}`));
            process.exit(1);
        }

        console.log(`\n🚀  Scaffolding WordPress in ${chalk.bold(config.slug)}...\n`);

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

program.parse();