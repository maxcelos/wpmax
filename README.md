# WPMax

> Lightning-fast WordPress site scaffolding CLI tool

WPMax is a powerful command-line tool that automates WordPress site creation, making it incredibly fast and easy to spin up new WordPress installations with your preferred configuration.

## Features

- **⚡ Lightning Fast** - Create a complete WordPress site in seconds
- **🔧 Fully Configurable** - Override any setting via CLI flags or config file
- **🎯 Smart Defaults** - Sensible defaults that work out of the box
- **🔌 Plugin Management** - Install plugins from WordPress.org or local ZIPs
- **🗄️ Auto-Detection** - Automatically detects MySQL connection (TCP or socket)
- **📦 Self-Contained** - Bundles WP-CLI (downloads on first run)
- **🔐 Laravel Herd Integration** - Automatic HTTPS setup with Herd
- **⚙️ Config System** - Save common settings for reuse
- **📊 Site Management** - List, view info, and delete sites with ease
- **🏥 Health Checks** - Diagnose system issues before creating sites
- **🔄 Auto-Updates** - Stay up-to-date with automatic update checks

## Installation

```bash
npm install -g wpmax
```

## Requirements

- **PHP** 7.4+ (required by WordPress and WP-CLI)
- **MySQL** or MariaDB
- **Node.js** 16+

## Quick Start

```bash
# Create a new WordPress site
wpmax my-site

# Or use the 'new' alias
wpmax new my-site

# That's it! Your site is ready at http://my-site.test
```

## Usage

### Basic Usage

```bash
# Interactive mode (prompts for site name)
wpmax

# Specify site name
wpmax my-site

# Custom WordPress version
wpmax my-site --wp-version 6.4.2

# Include default WP themes and plugins
wpmax my-site --with-content
```
> By "site name" we mean the directory name where the site files will be created. It can contain letters, numbers, dashes, and underscores. Example: "my-site
> It will also be used as the database name and domain.

### Database Options

```bash
# Custom database settings
wpmax my-site \
  --dbname custom_db \
  --dbuser myuser \
  --dbpass secret \
  --dbhost 192.168.1.100 \
  --dbprefix custom_

# Skip database creation (only create wp-config.php)
wpmax my-site --no-db
```

### Admin Options

```bash
# Custom admin credentials
wpmax my-site \
  --admin-user john \
  --admin-pass SecurePass123 \
  --admin-email john@example.com
```

### Site Options

```bash
# Custom URL and title
wpmax my-site \
  --url mysite.local \
  --title "My Awesome Site"
```

## Commands

WPMax provides several commands for managing your WordPress sites:

### Doctor Command

Check your system requirements and diagnose issues before creating sites:

```bash
wpmax doctor
```

This command verifies:
- WP-CLI installation and version
- PHP version and required extensions
- MySQL/MariaDB connectivity
- Laravel Herd status (if installed)
- File permissions
- Configuration file

**Example Output:**
```
🔍 Running diagnostics...

✓ WP-CLI: 2.9.0
✓ PHP: 8.2.0
✓ MySQL: Connected via 127.0.0.1
✓ Herd: Installed (Herd 1.24.1)
✓ Permissions: OK
✓ Config: Found with settings

Environment:
  OS: darwin 25.1.0
  Node: v20.10.0
  Arch: arm64
  Shell: /bin/zsh
  Config: ~/.config/wpmax

✅ All checks passed! You're ready to create WordPress sites.
```

### List Sites

View all WordPress sites created with WPMax:

```bash
wpmax list
```

Shows site name, URL, creation date, and disk usage:

```
My Sites (3 total):

  • my-site              my-site.test                 2 days ago      145 MB
  • demo-shop            demo-shop.test               1 week ago      289 MB
  • client-site          client-site.test             3 weeks ago     102 MB
```

### Site Info

Display detailed information about a specific site:

```bash
wpmax info [name]
```

If no name is provided, you'll see an interactive list to choose from.

**Example Output:**
```
Site: my-site
──────────────────────────────────────────────────
  Path:         /Users/user/Sites/my-site
  URL:          my-site.test
  Created:      2 days ago
  Size:         145 MB

  WordPress:    6.4.2
  PHP:          8.2.0
  Database:     my_site (12 tables, 2.3 MB)

  Admin:        admin
  Email:        admin@test.com

  Plugins:      3 active
    • woocommerce
    • yoast-seo
    • query-monitor

  Theme:        Twenty Twenty-Four
```

### Delete Site

Completely remove a WordPress site including directory, database, and registry entry:

```bash
wpmax delete [name]
```

Without a name, you'll see an interactive list to select from.

**Options:**
- `--yes` - Skip confirmation prompt
- `--keep-db` - Keep the database
- `--keep-files` - Keep the directory
- `--dry-run` - Preview what would be deleted

**Examples:**
```bash
# Interactive deletion with confirmation
wpmax delete my-site

# Skip confirmation
wpmax delete my-site --yes

# Only remove files, keep database
wpmax delete my-site --keep-db

# Preview what would be deleted
wpmax delete my-site --dry-run
```

### Update Command

Check for and install the latest version of WPMax:

```bash
# Check and install updates
wpmax update

# Only check without installing
wpmax update --check

# Skip confirmation
wpmax update --yes
```

The tool also automatically checks for updates once per day and shows a gentle reminder if one is available.

## Configuration

WPMax stores configuration in `~/.config/wpmax/config.json` and site registry in `~/.config/wpmax/sites.json` for tracking created sites.

### View Configuration

```bash
wpmax config --list
```

### Set Configuration

```bash
# Database defaults
wpmax config --set dbuser maxcelos
wpmax config --set dbhost 127.0.0.1
wpmax config --set dbprefix wp_

# Admin defaults
wpmax config --set admin-user john
wpmax config --set admin-email john@example.com

# Site defaults
wpmax config --set tld ".local"

# Plugin path
wpmax config --set default-plugins-path "/path/to/plugins"
```

### Public Plugins

Configure plugins to install from WordPress.org automatically:

```bash
# Set list of plugins
wpmax config --set public-plugins "woocommerce,contact-form-7,yoast-seo"

# Add plugins to list
wpmax config --add public-plugins "woocommerce"
wpmax config --add public-plugins "contact-form-7"

# Remove plugins from list
wpmax config --remove public-plugins "woocommerce"
```

### Available Config Keys

**Paths:**
- `default-plugins-path` - Directory containing local plugin ZIPs
- `default-themes-path` - Directory containing local theme ZIPs

**Database:**
- `dbuser` - Default database username (default: `root`)
- `dbhost` - Default database host (default: auto-detected)
- `dbprefix` - Default table prefix (default: `wp_`)

**Admin:**
- `admin-user` - Default admin username (default: `admin`)
- `admin-email` - Default admin email (default: `admin@test.com`)

**Site:**
- `tld` - Default TLD for sites (default: `.test`)

**Plugins:**
- `public-plugins` - Array of plugin slugs from WordPress.org

## Plugin Installation

WPMax supports two types of plugins:

### 1. Public Plugins (WordPress.org)

Configure in config file, select during installation:

```bash
wpmax config --add public-plugins "woocommerce,yoast-seo"
wpmax my-site
# You'll see a checkbox list with both local and public plugins
```

### 2. Local ZIP Files

Place ZIP files in a directory and configure the path:

```bash
wpmax config --set default-plugins-path "/Users/me/plugins"
wpmax my-site
# Plugins from directory will appear in selection list
```

### Plugin Selection

During installation, you'll see an interactive checkbox list:

```
? Select plugins to install:
  ◉ acf-pro.zip (local)
  ◉ woocommerce (WordPress.org)
  ◉ yoast-seo (WordPress.org)
```

Use space to toggle, enter to confirm.

## Configuration Precedence

Settings are applied in this order (highest priority first):

```
CLI flags → Config file → Built-in defaults
```

**Example:**
```bash
# Config file has: dbuser=maxcelos
wpmax my-site --dbuser=root
# Result: Uses dbuser=root (CLI flag wins)
```

## All CLI Options

```bash
wpmax [name] [options]

Options:
  --help                       Show help
  --version                    Show version

WordPress Options:
  --with-content               Include default WordPress themes and plugins
  --wp-version <version>       WordPress version (default: latest)

Database Options:
  --dbname <name>              Database name (default: slug with underscores)
  --dbuser <user>              Database username (default: root)
  --dbpass <password>          Database password (default: empty)
  --dbhost <host>              Database host (default: auto-detected)
  --dbprefix <prefix>          Table prefix (default: wp_)
  --no-db                      Skip database creation

Admin Options:
  --admin-user <username>      Admin username (default: admin)
  --admin-pass <password>      Admin password (default: admin)
  --admin-email <email>        Admin email (default: admin@test.com)

Site Options:
  --url <url>                  Site URL (default: {slug}.test)
  --title <title>              Site title (default: auto-generated)

Debug Options:
  --verbose, --debug           Show detailed configuration output

Advanced:
  -d, --docker                 Use Docker (coming soon)
```

### Verbose Mode

Show detailed configuration information during site creation:

```bash
wpmax my-site --verbose

# Example output:
🚀  Scaffolding WordPress in my-site...

[DEBUG] Configuration:
  slug: my-site
  dbName: my_site
  dbUser: root
  dbHost: auto-detect
  dbPrefix: wp_
  url: my-site.test
  title: My Site
  adminUser: admin
  adminEmail: admin@test.com
  wpVersion: latest
  withContent: false
```

Use `--verbose` or `--debug` (alias) for troubleshooting or to verify your configuration before installation.

### Command Aliases

WPMax supports convenient aliases for common commands:

```bash
# Creating sites
wpmax my-site        # Standard command
wpmax new my-site    # Alias for create

# Listing sites
wpmax list           # Standard command
wpmax ls             # Alias for list

# Deleting sites
wpmax delete my-site # Standard command
wpmax rm my-site     # Alias for delete
```

All aliases support the same options as their standard counterparts:

```bash
# These are equivalent:
wpmax rm my-site --yes
wpmax delete my-site --yes
```

## Examples

### Development Site

```bash
wpmax dev-site
```

### Production-Ready Site

```bash
wpmax production-site \
  --admin-user admin_secure \
  --admin-pass "$(openssl rand -base64 32)" \
  --admin-email admin@company.com \
  --dbprefix prod_
```

### E-Commerce Site

```bash
# First, configure WooCommerce
wpmax config --add public-plugins "woocommerce"

# Then create site
wpmax my-store
```

### Multisite Setup (Manual)

```bash
# Create site without DB
wpmax my-network --no-db

# Manually configure multisite in wp-config.php
# Then run wp core multisite-install
```

### Specific WordPress Version

```bash
# Install WordPress 6.3
wpmax legacy-site --wp-version 6.3

# Install latest
wpmax new-site --wp-version latest
```

## Laravel Herd Integration

If Laravel Herd is detected, WPMax will offer to:
1. Run `herd link` to create the `.test` domain
2. Run `herd secure` to add HTTPS certificate

```bash
wpmax my-site
# ...installation proceeds...
? Laravel Herd detected. Run "herd link" and "herd secure"? (Y/n)
```

Result: Site available at `https://my-site.test` 🔒

## MySQL Connection

WPMax automatically detects your MySQL connection by trying:

1. **TCP/IP** (recommended)
   - `127.0.0.1`
   - `localhost`

2. **Unix Sockets** (fallback)
   - `/tmp/mysql_3306.sock` (Laravel Herd)
   - `/tmp/mysql.sock` (Homebrew)
   - `/var/run/mysqld/mysqld.sock` (Linux)
   - Other common locations

Override with `--dbhost` if needed:

```bash
wpmax my-site --dbhost 192.168.1.100
```

## Troubleshooting

### MySQL Connection Failed

**Error:** `Could not detect MySQL connection`

**Solutions:**
1. Ensure MySQL is running: `mysql --version`
2. Test connection: `mysql -u root -e "SELECT 1"`
3. Specify host manually: `wpmax my-site --dbhost 127.0.0.1`
4. Check MySQL is listening on TCP: `netstat -an | grep 3306`

### PHP Not Found

**Error:** `PHP is not installed or not in PATH`

**Solution:**
- Install PHP: `brew install php` (macOS) or `apt install php` (Linux) or [Laravel Herd](https://herd.laravel.com) (Windows and macOS—Recommended)
- Verify: `php --version`

### Permission Denied

**Error:** `Permission denied` when creating directory

**Solution:**
- Run from a directory where you have write permissions
- Don't use `sudo` with wpmax

### Database Already Exists

**Behavior:** WPMax automatically resets existing databases

If you want to keep an existing database, use a different site name.

### WP-CLI Download Failed

**Error:** `Failed to download WP-CLI`

**Solutions:**
1. Check internet connection
2. Check firewall isn't blocking GitHub
3. Download manually and place in `bin/wp-cli.phar`

## After Installation

After successful site creation, you'll see your access information:

```
✅  Done! Your WordPress site is ready.

Site URL:
  http://my-site.test
  ⚠️  Frontend is blank (no theme installed)
     Install a theme via wp-admin or use --with-content flag

Admin Dashboard:
  http://my-site.test/wp-admin

Login Credentials:
  Username: admin
  Password: admin
```

**Note:** By default, WPMax installs WordPress without themes (`--skip-content` flag). This keeps the installation lean and fast, perfect for developers who want to start fresh. The frontend will appear blank until you install a theme.

**To include default WordPress themes and plugins:**
```bash
wpmax my-site --with-content
```

Click the wp-admin link to access your dashboard, install a theme, and start building!

## How It Works

WPMax automates these steps:

1. **Downloads WP-CLI** (first run only)
2. **Creates project directory**
3. **Downloads WordPress core** via WP-CLI
4. **Detects MySQL connection** (TCP or socket)
5. **Creates wp-config.php** with your settings
6. **Creates database** (or resets if exists)
7. **Installs WordPress** with admin user
8. **Installs plugins** (public + local)
9. **Optional: Laravel Herd setup** (link + secure)

## Development

```bash
# Clone repository
git clone https://github.com/maxcelos/wpmax.git
cd wpmax

# Install dependencies
pnpm install

# Link for local testing
npm link

# Test the CLI
wpmax test-site

# Unlink when done
npm unlink wpmax
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Roadmap

Completed features:
- [x] Site registry and management (`list`, `info`, `delete`)
- [x] Health checks and diagnostics (`doctor`)
- [x] Auto-update checking and installation (`update`)

Upcoming features:
- [ ] Docker Compose support
- [ ] Theme installation
- [ ] WordPress multisite
- [ ] Site templates/presets
- [ ] Batch site creation
- [ ] Backup & restore
- [ ] Site cloning

> PRs welcome!

## License

MIT

## Support

- **Issues:** [GitHub Issues](https://github.com/maxcelos/wpmax/issues)
- **Discussions:** [GitHub Discussions](https://github.com/maxcelos/wpmax/discussions)

---