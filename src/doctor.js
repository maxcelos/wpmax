// src/doctor.js
import { execa } from 'execa';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { getWpCliCommand } from './wp-cli-manager.js';
import { detectMySQLConnection } from './mysql-detector.js';
import { isHerdInstalled } from './herd-manager.js';
import { getConfig } from './config.js';

export class DoctorCheck {
    constructor() {
        this.checks = [];
        this.issues = [];
    }

    /**
     * Check if WP-CLI is available and get its version
     */
    async checkWpCli() {
        try {
            const [phpCmd, wpCliPath] = getWpCliCommand();

            // Check if the file exists
            if (!fs.existsSync(wpCliPath)) {
                this.issues.push({
                    description: 'WP-CLI not found',
                    fix: 'Will be auto-downloaded on first site creation'
                });
                return { ok: false, error: 'Not found' };
            }

            const { stdout } = await execa(phpCmd, [wpCliPath, '--version']);
            const version = stdout.match(/WP-CLI (\d+\.\d+\.\d+)/)?.[1] || 'unknown';
            return { ok: true, version };
        } catch (error) {
            this.issues.push({
                description: 'WP-CLI not accessible',
                fix: 'Ensure PHP is installed and WP-CLI phar is executable'
            });
            return { ok: false, error: 'Not accessible' };
        }
    }

    /**
     * Check PHP version and required extensions
     */
    async checkPhp() {
        try {
            // Check PHP version
            const { stdout } = await execa('php', ['--version']);
            const versionMatch = stdout.match(/PHP (\d+\.\d+\.\d+)/);
            const version = versionMatch?.[1];

            if (!version) {
                throw new Error('Could not parse PHP version');
            }

            // Parse version to check minimum requirement (7.4+)
            const [major, minor] = version.split('.').map(Number);
            if (major < 7 || (major === 7 && minor < 4)) {
                this.issues.push({
                    description: `PHP ${version} is outdated (minimum: 7.4)`,
                    fix: 'Update PHP: brew upgrade php (macOS) or apt upgrade php (Linux)'
                });
            }

            // Check required extensions
            const { stdout: extensions } = await execa('php', ['-m']);
            const required = ['mysqli', 'curl', 'json', 'mbstring'];
            const missing = required.filter(ext => !extensions.toLowerCase().includes(ext.toLowerCase()));

            if (missing.length > 0) {
                this.issues.push({
                    description: `Missing PHP extensions: ${missing.join(', ')}`,
                    fix: 'Install missing extensions via your PHP package manager'
                });
            }

            return { ok: true, version, missingExtensions: missing };
        } catch (error) {
            this.issues.push({
                description: 'PHP not found',
                fix: 'Install PHP: brew install php (macOS) or apt install php (Linux)'
            });
            return { ok: false, error: 'Not installed' };
        }
    }

    /**
     * Check MySQL/MariaDB connectivity
     */
    async checkMySQL() {
        try {
            // First check if mysql client is available
            await execa('mysql', ['--version']);
        } catch (error) {
            this.issues.push({
                description: 'MySQL client not found',
                fix: 'Install MySQL: brew install mysql (macOS) or install Laravel Herd'
            });
            return { ok: false, error: 'MySQL client not installed' };
        }

        try {
            const connection = await detectMySQLConnection('root');
            return { ok: true, connection };
        } catch (error) {
            this.issues.push({
                description: 'MySQL not accessible',
                fix: 'Start MySQL: brew services start mysql, or install/start Laravel Herd'
            });
            return { ok: false, error: 'Not accessible' };
        }
    }

    /**
     * Check if Laravel Herd is installed
     */
    async checkHerd() {
        try {
            const installed = await isHerdInstalled();
            if (installed) {
                const { stdout } = await execa('herd', ['--version']);
                const version = stdout.trim();
                return { ok: true, installed: true, version };
            }
            return { ok: true, installed: false };
        } catch (error) {
            return { ok: true, installed: false };
        }
    }

    /**
     * Check write permissions in common directories
     */
    async checkPermissions() {
        const testDirs = [process.cwd()];

        // Add ~/Sites if it exists
        const sitesDir = path.join(os.homedir(), 'Sites');
        if (fs.existsSync(sitesDir)) {
            testDirs.push(sitesDir);
        }

        const failedDirs = [];

        for (const dir of testDirs) {
            try {
                const testFile = path.join(dir, '.wpmax-test');
                fs.writeFileSync(testFile, 'test');
                fs.unlinkSync(testFile);
            } catch (error) {
                failedDirs.push(dir);
                this.issues.push({
                    description: `No write permission: ${dir}`,
                    fix: `chmod 755 ${dir}`
                });
            }
        }

        if (failedDirs.length > 0) {
            return { ok: false, failedDirs };
        }

        return { ok: true };
    }

    /**
     * Check configuration file
     */
    async checkConfig() {
        try {
            const config = getConfig();
            const configPath = path.join(os.homedir(), '.config', 'wpmax', 'config.json');
            const exists = fs.existsSync(configPath);

            return {
                ok: true,
                exists,
                path: configPath,
                hasSettings: Object.keys(config).length > 0
            };
        } catch (error) {
            this.issues.push({
                description: 'Config file error',
                fix: 'Run any wpmax command to regenerate config'
            });
            return { ok: false, error: error.message };
        }
    }

    /**
     * Get environment information
     */
    getEnvironmentInfo() {
        return {
            os: process.platform,
            osVersion: os.release(),
            node: process.version,
            arch: process.arch,
            shell: process.env.SHELL || 'unknown',
            configPath: path.join(os.homedir(), '.config', 'wpmax')
        };
    }

    /**
     * Run all diagnostic checks
     */
    async runAllChecks() {
        const results = {
            wpCli: await this.checkWpCli(),
            php: await this.checkPhp(),
            mysql: await this.checkMySQL(),
            herd: await this.checkHerd(),
            permissions: await this.checkPermissions(),
            config: await this.checkConfig(),
            environment: this.getEnvironmentInfo(),
            issues: this.issues
        };

        return results;
    }
}