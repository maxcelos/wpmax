// tests/helpers/test-data.js

/**
 * Create a test site object
 */
export function createTestSite(name = 'test-site', overrides = {}) {
  return {
    name,
    path: `/Users/test/Sites/${name}`,
    url: `${name}.test`,
    created_at: new Date('2024-01-01T00:00:00Z').toISOString(),
    dbName: name.replace(/-/g, '_'),
    dbUser: 'root',
    dbHost: '127.0.0.1',
    adminUser: 'admin',
    adminEmail: 'admin@test.com',
    ...overrides
  };
}

/**
 * Create multiple test sites
 */
export function createTestSites(count = 3) {
  return Array.from({ length: count }, (_, i) =>
    createTestSite(`test-site-${i + 1}`, {
      created_at: new Date(Date.now() - i * 86400000).toISOString() // i days ago
    })
  );
}

/**
 * Create a test config object
 */
export function createTestConfig(overrides = {}) {
  return {
    defaultPluginsPath: '/Users/test/plugins',
    publicPlugins: ['woocommerce', 'yoast-seo'],
    dbuser: 'root',
    dbhost: '127.0.0.1',
    dbprefix: 'wp_',
    adminUser: 'admin',
    adminEmail: 'admin@test.com',
    tld: '.test',
    ...overrides
  };
}