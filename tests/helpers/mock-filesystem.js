// tests/helpers/mock-filesystem.js
import { vi } from 'vitest';
import fs from 'fs';

/**
 * Mock filesystem with in-memory file storage
 * @param {Object} files - Initial files as { '/path/to/file': 'content' }
 * @returns {Object} Mocked fs functions and storage
 */
export function mockFilesystem(files = {}) {
  const storage = { ...files };

  const mocks = {
    existsSync: vi.spyOn(fs, 'existsSync').mockImplementation((filePath) => {
      return storage[filePath] !== undefined;
    }),

    readFileSync: vi.spyOn(fs, 'readFileSync').mockImplementation((filePath, encoding) => {
      if (storage[filePath] === undefined) {
        const error = new Error(`ENOENT: no such file or directory, open '${filePath}'`);
        error.code = 'ENOENT';
        throw error;
      }
      return storage[filePath];
    }),

    writeFileSync: vi.spyOn(fs, 'writeFileSync').mockImplementation((filePath, content) => {
      storage[filePath] = content;
    }),

    mkdirSync: vi.spyOn(fs, 'mkdirSync').mockImplementation((dirPath, options) => {
      storage[dirPath] = '__DIR__';
    }),

    rmSync: vi.spyOn(fs, 'rmSync').mockImplementation((filePath) => {
      delete storage[filePath];
    }),

    readdirSync: vi.spyOn(fs, 'readdirSync').mockImplementation((dirPath) => {
      const prefix = dirPath.endsWith('/') ? dirPath : dirPath + '/';
      return Object.keys(storage)
        .filter(path => path.startsWith(prefix))
        .map(path => path.substring(prefix.length).split('/')[0])
        .filter((name, index, arr) => arr.indexOf(name) === index);
    }),

    // Expose storage for assertions
    _storage: storage
  };

  return mocks;
}

/**
 * Restore all filesystem mocks
 */
export function restoreFilesystem() {
  vi.restoreAllMocks();
}