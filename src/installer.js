// src/installer.js
import { execa } from 'execa'; // Better than child_process
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { getWpCliCommand } from './wp-cli-manager.js';
import { getMySQLConnection } from './mysql-detector.js';
import { herdLink, herdSecure } from './herd-manager.js';

export class WordPressInstaller {
    constructor(config) {
        this.config = config;
        this.cwd = path.join(process.cwd(), config.slug);
        this.wpCliCmd = getWpCliCommand();
    }

    async createDirectory() {
        if (fs.existsSync(this.cwd)) {
            throw new Error(`Directory ${this.config.slug} already exists.`);
        }
        await execa('mkdir', [this.config.slug]);
    }

    async downloadCore() {
        // We run wp commands inside the new directory using { cwd: this.cwd }
        const [phpCmd, wpCliPath] = this.wpCliCmd;
        const args = [wpCliPath, 'core', 'download', '--quiet'];

        // Skip content by default unless --with-content flag is provided
        if (!this.config.withContent) {
            args.splice(3, 0, '--skip-content');
        }

        // Add WordPress version if specified and not 'latest'
        if (this.config.wpVersion && this.config.wpVersion !== 'latest') {
            args.push(`--version=${this.config.wpVersion}`);
        }

        await execa(phpCmd, args, { cwd: this.cwd });
    }

    /**
     * FUTURE PROOFING:
     * This is where you will add logic later to switch between
     * Local MySQL (current) and Docker Compose.
     */
    async configureDatabase() {
        const [phpCmd, wpCliPath] = this.wpCliCmd;

        if (this.config.useDocker) {
            // TODO: Implement Docker Compose generation here later
            // await this.setupDockerCompose();
        } else {
            // Auto-detect MySQL connection if not provided
            const mysqlHost = this.config.dbHost || await getMySQLConnection(this.config.dbUser);

            const configArgs = [
                wpCliPath,
                'config', 'create',
                `--dbname=${this.config.dbName}`,
                `--dbuser=${this.config.dbUser}`,
                `--dbhost=${mysqlHost}`,
                `--dbprefix=${this.config.dbPrefix}`,
                '--quiet'
            ];

            // Add password if provided, otherwise use --prompt= for no password
            if (this.config.dbPass) {
                configArgs.splice(6, 0, `--dbpass=${this.config.dbPass}`);
            } else {
                configArgs.splice(6, 0, '--prompt=');
            }

            await execa(phpCmd, configArgs, { cwd: this.cwd });

            // Skip database creation if --no-db flag is set
            if (!this.config.noDb) {
                try {
                    await execa(phpCmd, [wpCliPath, 'db', 'create', '--quiet'], { cwd: this.cwd });
                } catch (error) {
                    // Check if error is "database exists"
                    if (error.message.includes('database exists') || error.message.includes('ERROR 1007')) {
                        // Database exists - drop and recreate it
                        await execa(phpCmd, [wpCliPath, 'db', 'reset', '--yes', '--quiet'], { cwd: this.cwd });
                    } else {
                        // Some other error - re-throw it
                        throw error;
                    }
                }
            }
        }
    }

    async installWordPress() {
        const [phpCmd, wpCliPath] = this.wpCliCmd;
        await execa(phpCmd, [
            wpCliPath,
            'core', 'install',
            `--url=${this.config.url}`,
            `--title=${this.config.title}`,
            `--admin_user=${this.config.adminUser}`,
            `--admin_password=${this.config.adminPass}`,
            `--admin_email=${this.config.adminEmail}`,
            '--quiet'
        ], { cwd: this.cwd });
    }

    async installPlugins() {
        const [phpCmd, wpCliPath] = this.wpCliCmd;

        // 1. Install public plugins from WordPress.org
        if (this.config.selectedPublicPlugins && this.config.selectedPublicPlugins.length > 0) {
            for (const slug of this.config.selectedPublicPlugins) {
                await execa(phpCmd, [wpCliPath, 'plugin', 'install', slug, '--activate', '--quiet'], { cwd: this.cwd });
            }
        }

        // 2. Install local ZIP plugins
        if (this.config.selectedLocalPlugins && this.config.selectedLocalPlugins.length > 0) {
            for (const pluginPath of this.config.selectedLocalPlugins) {
                if (fs.existsSync(pluginPath)) {
                    await execa(phpCmd, [wpCliPath, 'plugin', 'install', pluginPath, '--activate', '--quiet'], { cwd: this.cwd });
                }
            }
        }
    }

    async setupHerd() {
        // Run herd link
        await herdLink(this.cwd);

        // Run herd secure
        await herdSecure(this.cwd);
    }
}