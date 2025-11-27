# WPMax - Community Release Implementation Plan

> Making wp-setup generic and community-ready for npm publication

## Project Renaming

**Old Name:** `wp-setup`
**New Name:** `wpmax`
**Package Name:** `wpmax` (verify availability on npm)

---

## Phase 1: Core Improvements (Required for v1.0)

### 1.1 Remove Hardcoded Plugin ✅ HIGH PRIORITY
**Current Issue:** `all-in-one-wp-migration` is always installed with no way to disable

**Solution:**
- Remove hardcoded installation from `src/installer.js:100`
- Add `all-in-one-wp-migration` to default config on first run
- Users can remove it: `wpmax config --remove public-plugins "all-in-one-wp-migration"`

**Files to modify:**
- `src/installer.js` - Remove hardcoded plugin
- `src/config.js` - Add `ensureDefaultConfig()` function
- `bin/index.js` - Call `ensureDefaultConfig()` on first run

**Implementation:**
```javascript
// src/config.js
export function ensureDefaultConfig() {
    const config = getConfig();

    // Set defaults only if not already configured
    if (!config.publicPlugins) {
        config.publicPlugins = ['all-in-one-wp-migration'];
        // Save config
    }
}
```

---

### 1.2 Configurable TLD ✅ HIGH PRIORITY
**Current Issue:** `.test` is hardcoded as default

**Solution:**
- Add `tld` config key (default: `.test`)
- Support: `.test`, `.local`, `.dev`, custom domains

**Files to modify:**
- `src/config.js` - Add `tld` to valid keys
- `bin/index.js` - Use config TLD in URL generation
- `src/validators.js` - Update URL validation to support any TLD

**Config commands:**
```bash
wpmax config --set tld ".local"
wpmax config --set tld ".dev"
wpmax config --set tld ".test"
```

**Code change:**
```javascript
// bin/index.js
const tld = configDefaults.tld || '.test';
const url = normalizeUrl(options.url || `${siteName}${tld}`);
```

---

### 1.3 WordPress Content Flag ✅ MEDIUM PRIORITY
**Current Issue:** `--skip-content` is hardcoded, always skips default themes/plugins

**Solution:**
- Keep `--skip-content` as default behavior
- Add `--with-content` flag to include default WP themes/plugins

**Files to modify:**
- `bin/index.js` - Add `--with-content` option
- `src/installer.js` - Conditionally skip content based on flag

**Implementation:**
```javascript
// bin/index.js
.option('--with-content', 'Include default WordPress themes and plugins', false)

// src/installer.js
async downloadCore() {
    const args = [wpCliPath, 'core', 'download', '--quiet'];

    // Only skip content if --with-content is NOT provided
    if (!this.config.withContent) {
        args.splice(3, 0, '--skip-content');
    }

    await execa(phpCmd, args, { cwd: this.cwd });
}
```

---

### 1.4 WordPress Version Selection ✅ MEDIUM PRIORITY
**Current Issue:** Always downloads latest WordPress version

**Solution:**
- Add `--wp-version` option
- Default: latest
- Examples: `6.4.2`, `6.3`, `latest`

**Files to modify:**
- `bin/index.js` - Add `--wp-version` option
- `src/installer.js` - Pass version to download command

**Implementation:**
```javascript
// bin/index.js
.option('--wp-version <version>', 'WordPress version to install (default: latest)', 'latest')

// src/installer.js
async downloadCore() {
    const args = [wpCliPath, 'core', 'download', '--quiet'];

    if (!this.config.withContent) {
        args.splice(3, 0, '--skip-content');
    }

    // Add version if not latest
    if (this.config.wpVersion && this.config.wpVersion !== 'latest') {
        args.push(`--version=${this.config.wpVersion}`);
    }

    await execa(phpCmd, args, { cwd: this.cwd });
}
```

---

### 1.5 Rename Project to WPMax ✅ HIGH PRIORITY
**Files to modify:**
- `package.json` - Change name, bin command, description
- `bin/index.js` - Update program name and descriptions
- All user-facing text - Replace "wp-setup" with "wpmax"
- Config directory - Keep as `~/.config/wp-setup` for backwards compatibility (or migrate)

**package.json changes:**
```json
{
  "name": "wpmax",
  "version": "1.0.0",
  "description": "Lightning-fast WordPress site scaffolding CLI tool",
  "bin": {
    "wpmax": "./bin/index.js"
  },
  "keywords": [
    "wordpress",
    "wp-cli",
    "scaffold",
    "cli",
    "wordpress-cli",
    "wp-setup",
    "wordpress-setup"
  ],
  "author": "Your Name",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/wpmax.git"
  },
  "bugs": {
    "url": "https://github.com/yourusername/wpmax/issues"
  },
  "homepage": "https://github.com/yourusername/wpmax#readme"
}
```

---

### 1.6 Security Warnings ✅ LOW PRIORITY
**Current Issue:** Default `admin/admin` credentials are insecure

**Solution:**
- Add warning when using default credentials
- Suggest changing in production

**Files to modify:**
- `bin/index.js` - Add warning after successful installation

**Implementation:**
```javascript
// After successful WordPress installation
if (config.adminUser === 'admin' && config.adminPass === 'admin') {
    console.log(chalk.yellow('\n⚠️  Security Warning:'));
    console.log(chalk.yellow('   Using default credentials (admin/admin)'));
    console.log(chalk.yellow('   Change password immediately for production sites!\n'));
}
```

---

### 1.7 Comprehensive Documentation ✅ HIGH PRIORITY

**Create README.md with:**

1. **Project Overview**
   - What is WPMax?
   - Key features
   - Why use it?

2. **Installation**
   ```bash
   npm install -g wpmax
   ```

3. **Requirements**
   - PHP (7.4+)
   - MySQL/MariaDB
   - Node.js (16+)

4. **Quick Start**
   ```bash
   wpmax my-site
   ```

5. **Configuration Guide**
   - All config options explained
   - Examples for common setups

6. **CLI Options Reference**
   - All flags documented
   - Examples for each

7. **Troubleshooting**
   - Common issues
   - MySQL connection problems
   - Permission errors

8. **Examples**
   - Basic usage
   - Custom database
   - Production setup
   - Multiple sites

9. **Contributing**
   - How to report issues
   - Development setup

10. **License**

**Create CHANGELOG.md:**
- Version history
- Breaking changes
- New features

---

## Phase 2: Enhanced Features (Optional - Future)

### 2.1 Theme Installation Support
**Feature:** Install themes from WordPress.org or local ZIPs

**Config:**
```bash
wpmax config --set default-themes-path "/path/to/themes"
wpmax config --add public-themes "twentytwentyfour,astra"
```

**Implementation:**
- Similar to plugin installation
- Support public themes + local ZIPs
- Interactive selection during setup

---

### 2.2 Docker Compose Generation
**Feature:** Generate docker-compose.yml for containerized WordPress

**Flag:**
```bash
wpmax my-site --docker
```

**Generated files:**
- `docker-compose.yml`
- `.env` file
- `Dockerfile` (if needed)

**Services:**
- WordPress
- MySQL
- phpMyAdmin (optional)
- WP-CLI container

---

### 2.3 WordPress Multisite Support
**Feature:** Set up WordPress multisite (subdomain or subdirectory)

**Flags:**
```bash
wpmax my-network --multisite
wpmax my-network --multisite --subdomain
```

**Implementation:**
- Use `wp core multisite-install`
- Configure network settings
- Update wp-config.php

---

### 2.4 Site Templates/Presets
**Feature:** Save and reuse site configurations

**Commands:**
```bash
# Save current config as template
wpmax config --save-preset "ecommerce"

# Use preset
wpmax new-store --preset ecommerce
```

**Preset contains:**
- Plugins list
- Theme
- Database settings
- Admin settings
- WP version

---

### 2.5 Import/Export Configurations
**Feature:** Share configurations between machines

**Commands:**
```bash
# Export config
wpmax config --export > my-config.json

# Import config
wpmax config --import my-config.json
```

---

### 2.6 Plugin/Theme Search
**Feature:** Search WordPress.org before adding

**Commands:**
```bash
# Search plugins
wpmax search plugins "seo"
wpmax search themes "ecommerce"

# Add from search results
wpmax config --add public-plugins "wordpress-seo"
```

---

### 2.7 Batch Site Creation
**Feature:** Create multiple sites from config file

**Command:**
```bash
wpmax batch sites.json
```

**sites.json:**
```json
[
  {
    "name": "site1",
    "plugins": ["woocommerce"],
    "theme": "storefront"
  },
  {
    "name": "site2",
    "plugins": ["contact-form-7"],
    "theme": "astra"
  }
]
```

---

### 2.8 WP-CLI Integration
**Feature:** Run wp-cli commands in scaffolded sites

**Command:**
```bash
wpmax run my-site "plugin list"
wpmax run my-site "user create john john@example.com"
```

---

### 2.9 Health Check & Updates
**Feature:** Check WordPress/plugin/theme versions

**Commands:**
```bash
wpmax check my-site
wpmax update my-site --core
wpmax update my-site --plugins
wpmax update my-site --all
```

---

### 2.10 Backup & Restore
**Feature:** Quick backup/restore via WP-CLI

**Commands:**
```bash
wpmax backup my-site
wpmax restore my-site backup-2024-01-15.tar.gz
```

---

## Phase 3: Publishing Preparation

### 3.1 Testing
- [ ] Test on macOS
- [ ] Test on Linux
- [ ] Test on Windows (WSL)
- [ ] Test all MySQL configurations
- [ ] Test all CLI flags
- [ ] Test config operations

### 3.2 Code Quality
- [ ] Add JSDoc comments to all functions
- [ ] Consistent error handling
- [ ] Input validation everywhere
- [ ] Remove debug/console logs

### 3.3 npm Publishing
- [ ] Verify package name availability
- [ ] Set up npm account
- [ ] Add `.npmignore`
- [ ] Test `npm pack`
- [ ] Publish to npm
- [ ] Create GitHub releases

### 3.4 Marketing
- [ ] GitHub README with GIFs/screenshots
- [ ] Create demo video
- [ ] Write blog post announcement
- [ ] Share on Twitter/Reddit/Dev.to
- [ ] Submit to awesome-wordpress lists

---

## Implementation Timeline

**Week 1: Core Improvements (Phase 1)**
- Days 1-2: Hardcoded plugin removal + TLD config
- Days 3-4: Content flag + WP version option
- Days 5-6: Project rename + security warnings
- Day 7: Documentation

**Week 2: Testing & Polish**
- Days 1-3: Comprehensive testing
- Days 4-5: Bug fixes
- Days 6-7: Final documentation review

**Week 3: Publishing**
- Days 1-2: npm preparation
- Day 3: Publish v1.0.0
- Days 4-7: Community engagement

**Future: Phase 2 Features**
- Implement based on user feedback
- Prioritize most requested features

---

## Success Metrics

**v1.0 Goals:**
- ✅ 100% generic (works on any machine)
- ✅ Zero hardcoded preferences
- ✅ Complete documentation
- ✅ Published on npm
- 🎯 50+ downloads in first month
- 🎯 5+ GitHub stars
- 🎯 Zero critical bugs reported

**v2.0 Goals (Future):**
- 🎯 500+ downloads
- 🎯 Docker support
- 🎯 Theme installation
- 🎯 Community contributions

---

## Breaking Changes Log

**v0.x → v1.0:**
- Command renamed from `wp-setup` to `wpmax`
- `all-in-one-wp-migration` no longer auto-installed (in default config instead)
- Config directory remains `~/.config/wp-setup` (backwards compatible)

---

## Questions to Resolve Before Publishing

1. **License?** MIT / GPL / Apache 2.0?
2. **GitHub repo?** Personal or organization?
3. **Support model?** GitHub issues only? Discord?
4. **Versioning strategy?** Semantic versioning (recommended)
5. **Deprecation policy?** How long to support old versions?

---

## Notes

- Keep backwards compatibility where possible
- Prioritize user experience over complexity
- Document everything
- Test on multiple environments
- Gather community feedback early