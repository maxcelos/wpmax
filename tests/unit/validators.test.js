// tests/unit/validators.test.js
import { describe, it, expect } from 'vitest';
import {
  isValidEmail,
  normalizeUrl,
  normalizeDbPrefix,
  isValidDbName
} from '../../src/validators.js';

describe('validators', () => {
  describe('isValidEmail', () => {
    it('should validate correct email formats', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@example.com')).toBe(true);
      expect(isValidEmail('user+tag@example.co.uk')).toBe(true);
      expect(isValidEmail('admin@test.com')).toBe(true);
    });

    it('should reject invalid email formats', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('invalid@')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('user@')).toBe(false);
      expect(isValidEmail('user @example.com')).toBe(false);
      expect(isValidEmail('')).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(isValidEmail('a@b.c')).toBe(true); // Minimal valid email
      expect(isValidEmail('user@domain')).toBe(false); // Missing TLD
    });
  });

  describe('normalizeUrl', () => {
    it('should add .test suffix if missing', () => {
      expect(normalizeUrl('my-site')).toBe('my-site.test');
      expect(normalizeUrl('example')).toBe('example.test');
    });

    it('should keep .test suffix if present', () => {
      expect(normalizeUrl('my-site.test')).toBe('my-site.test');
    });

    it('should remove http:// protocol', () => {
      expect(normalizeUrl('http://my-site.test')).toBe('my-site.test');
      expect(normalizeUrl('http://example')).toBe('example.test');
    });

    it('should remove https:// protocol', () => {
      expect(normalizeUrl('https://my-site.test')).toBe('my-site.test');
      expect(normalizeUrl('https://example')).toBe('example.test');
    });

    it('should remove trailing slashes', () => {
      expect(normalizeUrl('my-site.test/')).toBe('my-site.test');
      expect(normalizeUrl('my-site.test///')).toBe('my-site.test');
      expect(normalizeUrl('https://my-site.test/')).toBe('my-site.test');
    });

    it('should handle subdomain formats', () => {
      expect(normalizeUrl('sub.domain')).toBe('sub.domain.test');
      expect(normalizeUrl('sub.domain.test')).toBe('sub.domain.test');
    });

    it('should accept alphanumeric and hyphens', () => {
      expect(normalizeUrl('my-site-123')).toBe('my-site-123.test');
      expect(normalizeUrl('site123')).toBe('site123.test');
    });

    it('should throw error for invalid URL formats', () => {
      expect(() => normalizeUrl('my_site')).toThrow('Invalid URL format');
      expect(() => normalizeUrl('my site')).toThrow('Invalid URL format');
      expect(() => normalizeUrl('-mysite')).toThrow('Invalid URL format');
      expect(() => normalizeUrl('mysite-')).toThrow('Invalid URL format');
      expect(() => normalizeUrl('my..site')).toThrow('Invalid URL format');
    });

    it('should throw error for empty URL', () => {
      expect(() => normalizeUrl('')).toThrow('Invalid URL format');
    });
  });

  describe('normalizeDbPrefix', () => {
    it('should add trailing underscore if missing', () => {
      expect(normalizeDbPrefix('wp')).toBe('wp_');
      expect(normalizeDbPrefix('custom')).toBe('custom_');
    });

    it('should keep trailing underscore if present', () => {
      expect(normalizeDbPrefix('wp_')).toBe('wp_');
      expect(normalizeDbPrefix('custom_')).toBe('custom_');
    });

    it('should remove multiple trailing underscores and add one', () => {
      expect(normalizeDbPrefix('wp___')).toBe('wp_');
    });

    it('should accept alphanumeric characters', () => {
      expect(normalizeDbPrefix('wp123')).toBe('wp123_');
      expect(normalizeDbPrefix('test')).toBe('test_');
    });

    it('should accept underscores in the middle', () => {
      expect(normalizeDbPrefix('my_custom_prefix')).toBe('my_custom_prefix_');
    });

    it('should throw error for invalid characters', () => {
      expect(() => normalizeDbPrefix('wp-')).toThrow('Invalid database prefix format');
      expect(() => normalizeDbPrefix('wp.')).toThrow('Invalid database prefix format');
      expect(() => normalizeDbPrefix('wp@')).toThrow('Invalid database prefix format');
      expect(() => normalizeDbPrefix('wp prefix')).toThrow('Invalid database prefix format');
    });

    it('should throw error for empty prefix', () => {
      expect(() => normalizeDbPrefix('')).toThrow('Invalid database prefix format');
    });
  });

  describe('isValidDbName', () => {
    it('should validate correct database names', () => {
      expect(isValidDbName('my_database')).toBe(true);
      expect(isValidDbName('db123')).toBe(true);
      expect(isValidDbName('test_db_name')).toBe(true);
      expect(isValidDbName('a')).toBe(true); // Single character
    });

    it('should reject invalid characters', () => {
      expect(isValidDbName('my-database')).toBe(false); // Hyphen not allowed
      expect(isValidDbName('my.database')).toBe(false); // Dot not allowed
      expect(isValidDbName('my database')).toBe(false); // Space not allowed
      expect(isValidDbName('my@database')).toBe(false); // Special char not allowed
    });

    it('should reject names over 64 characters', () => {
      const longName = 'a'.repeat(65);
      expect(isValidDbName(longName)).toBe(false);
    });

    it('should accept names exactly 64 characters', () => {
      const maxName = 'a'.repeat(64);
      expect(isValidDbName(maxName)).toBe(true);
    });

    it('should reject empty database name', () => {
      expect(isValidDbName('')).toBe(false);
    });
  });
});