// tests/unit/herd-manager.test.js
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isHerdInstalled, herdLink, herdSecure } from '../../src/herd-manager.js';
import { createExecaResponse } from '../helpers/mock-execa.js';

// Mock execa module
vi.mock('execa', () => ({
  execa: vi.fn()
}));

describe('Herd Manager', () => {
  let execaMock;

  beforeEach(async () => {
    const { execa } = await import('execa');
    execaMock = execa;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('isHerdInstalled', () => {
    it('should return true when herd is installed', async () => {
      execaMock.mockResolvedValue(createExecaResponse('Laravel Herd 1.7.3'));

      const result = await isHerdInstalled();

      expect(result).toBe(true);
      expect(execaMock).toHaveBeenCalledWith('herd', ['--version']);
    });

    it('should return false when herd is not installed', async () => {
      execaMock.mockRejectedValue(new Error('Command not found: herd'));

      const result = await isHerdInstalled();

      expect(result).toBe(false);
      expect(execaMock).toHaveBeenCalledWith('herd', ['--version']);
    });

    it('should return false when herd command fails', async () => {
      execaMock.mockRejectedValue(new Error('Permission denied'));

      const result = await isHerdInstalled();

      expect(result).toBe(false);
    });
  });

  describe('herdLink', () => {
    it('should run herd link in specified directory', async () => {
      execaMock.mockResolvedValue(createExecaResponse('Link created'));

      await herdLink('/Users/test/Sites/my-site');

      expect(execaMock).toHaveBeenCalledWith('herd', ['link'], {
        cwd: '/Users/test/Sites/my-site'
      });
    });

    it('should throw error if herd link fails', async () => {
      const error = new Error('Herd link failed');
      execaMock.mockRejectedValue(error);

      await expect(herdLink('/Users/test/Sites/my-site')).rejects.toThrow('Herd link failed');
    });

    it('should work with different directory paths', async () => {
      execaMock.mockResolvedValue(createExecaResponse('Link created'));

      await herdLink('/path/to/wordpress');

      expect(execaMock).toHaveBeenCalledWith('herd', ['link'], {
        cwd: '/path/to/wordpress'
      });
    });
  });

  describe('herdSecure', () => {
    it('should run herd secure in specified directory', async () => {
      execaMock.mockResolvedValue(createExecaResponse('Secured'));

      await herdSecure('/Users/test/Sites/my-site');

      expect(execaMock).toHaveBeenCalledWith('herd', ['secure'], {
        cwd: '/Users/test/Sites/my-site'
      });
    });

    it('should throw error if herd secure fails', async () => {
      const error = new Error('Herd secure failed');
      execaMock.mockRejectedValue(error);

      await expect(herdSecure('/Users/test/Sites/my-site')).rejects.toThrow('Herd secure failed');
    });

    it('should work with different directory paths', async () => {
      execaMock.mockResolvedValue(createExecaResponse('Secured'));

      await herdSecure('/another/path');

      expect(execaMock).toHaveBeenCalledWith('herd', ['secure'], {
        cwd: '/another/path'
      });
    });
  });

  describe('integration scenarios', () => {
    it('should handle full herd workflow', async () => {
      // Check if Herd is installed
      execaMock.mockResolvedValueOnce(createExecaResponse('Laravel Herd 1.7.3'));
      const installed = await isHerdInstalled();
      expect(installed).toBe(true);

      // Link the site
      execaMock.mockResolvedValueOnce(createExecaResponse('Link created'));
      await herdLink('/Users/test/Sites/my-site');

      // Secure the site
      execaMock.mockResolvedValueOnce(createExecaResponse('Secured'));
      await herdSecure('/Users/test/Sites/my-site');

      expect(execaMock).toHaveBeenCalledTimes(3);
    });

    it('should gracefully handle when Herd is not available', async () => {
      execaMock.mockRejectedValue(new Error('Command not found: herd'));

      const installed = await isHerdInstalled();
      expect(installed).toBe(false);

      // Should not attempt link or secure if not installed
      // This would be handled by calling code
    });
  });
});