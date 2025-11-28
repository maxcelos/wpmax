// tests/setup.js
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Global test setup
beforeAll(() => {
  // Setup runs once before all tests
});

afterAll(() => {
  // Cleanup runs once after all tests
});

// Per-test setup
beforeEach(() => {
  // Runs before each test
});

afterEach(() => {
  // Runs after each test
});

// Helper to create temporary test directory
export function createTempDir() {
  const tmpDir = path.join(os.tmpdir(), `wpmax-test-${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
}

// Helper to cleanup temporary directory
export function cleanupTempDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
