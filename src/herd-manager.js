// src/herd-manager.js
import { execa } from 'execa';

/**
 * Checks if Laravel Herd is installed on the system
 * @returns {Promise<boolean>}
 */
export async function isHerdInstalled() {
    try {
        await execa('herd', ['--version']);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Runs herd link in the specified directory
 * @param {string} cwd - Directory to run herd link in
 * @returns {Promise<void>}
 */
export async function herdLink(cwd) {
    await execa('herd', ['link'], { cwd });
}

/**
 * Runs herd secure in the specified directory
 * @param {string} cwd - Directory to run herd secure in
 * @returns {Promise<void>}
 */
export async function herdSecure(cwd) {
    await execa('herd', ['secure'], { cwd });
}