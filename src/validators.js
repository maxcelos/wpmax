// src/validators.js

/**
 * Validates email format
 * @param {string} email - Email address to validate
 * @returns {boolean}
 */
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Normalizes and validates URL
 * Accepts URLs with or without .test suffix
 * @param {string} url - URL to validate
 * @returns {string} - Normalized URL (without protocol)
 * @throws {Error} - If URL format is invalid
 */
export function normalizeUrl(url) {
    // Remove protocol if present
    let normalized = url.replace(/^https?:\/\//, '');

    // Remove trailing slashes
    normalized = normalized.replace(/\/+$/, '');

    // If URL doesn't end with .test, add it
    if (!normalized.endsWith('.test')) {
        normalized = `${normalized}.test`;
    }

    // Validate format: should be alphanumeric with hyphens, dots allowed
    const urlRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;
    if (!urlRegex.test(normalized)) {
        throw new Error(`Invalid URL format: ${url}`);
    }

    return normalized;
}

/**
 * Validates database prefix format
 * Must be alphanumeric + underscores, ending with underscore
 * @param {string} prefix - Database prefix to validate
 * @returns {string} - Normalized prefix (with trailing underscore)
 * @throws {Error} - If prefix format is invalid
 */
export function normalizeDbPrefix(prefix) {
    // Remove any existing trailing underscore for validation
    let normalized = prefix.replace(/_+$/, '');

    // Validate: only alphanumeric and underscores
    const prefixRegex = /^[a-zA-Z0-9_]+$/;
    if (!prefixRegex.test(normalized)) {
        throw new Error(`Invalid database prefix format: ${prefix}. Only alphanumeric and underscores allowed.`);
    }

    // Add trailing underscore if not present
    if (!normalized.endsWith('_')) {
        normalized = `${normalized}_`;
    }

    return normalized;
}

/**
 * Validates database name format
 * @param {string} dbName - Database name to validate
 * @returns {boolean}
 */
export function isValidDbName(dbName) {
    // MySQL database name rules: alphanumeric, underscores, max 64 chars
    const dbNameRegex = /^[a-zA-Z0-9_]{1,64}$/;
    return dbNameRegex.test(dbName);
}