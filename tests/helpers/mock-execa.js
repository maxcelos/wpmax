// tests/helpers/mock-execa.js
import { vi } from 'vitest';

/**
 * Mock execa command execution
 * @param {Object} responses - Command responses as { 'command arg': { stdout, stderr, exitCode } }
 * @returns {Function} Mocked execa function
 */
export function mockExeca(responses = {}) {
  const execaMock = vi.fn(async (command, args = [], options = {}) => {
    const key = `${command} ${Array.isArray(args) ? args.join(' ') : ''}`.trim();
    const wildcardKey = command;

    // Look for exact match first, then wildcard
    const response = responses[key] || responses[wildcardKey] || responses['*'];

    if (!response) {
      const error = new Error(`Command not mocked: ${key}`);
      error.command = command;
      error.args = args;
      throw error;
    }

    // Handle error responses
    if (response.exitCode && response.exitCode !== 0) {
      const error = new Error(response.stderr || `Command failed with exit code ${response.exitCode}`);
      error.exitCode = response.exitCode;
      error.stdout = response.stdout || '';
      error.stderr = response.stderr || '';
      error.command = command;
      throw error;
    }

    // Return successful response
    return {
      stdout: response.stdout || '',
      stderr: response.stderr || '',
      exitCode: response.exitCode || 0,
      command,
      escapedCommand: `${command} ${Array.isArray(args) ? args.join(' ') : ''}`,
      failed: false,
      timedOut: false,
      isCanceled: false,
      killed: false
    };
  });

  return execaMock;
}

/**
 * Create a mock execa response object
 */
export function createExecaResponse(stdout = '', stderr = '', exitCode = 0) {
  return { stdout, stderr, exitCode };
}

/**
 * Create a mock execa error
 */
export function createExecaError(message, exitCode = 1, stderr = '') {
  return {
    exitCode,
    stdout: '',
    stderr: stderr || message
  };
}