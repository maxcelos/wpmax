# WPMax

> Docker-based WordPress site manager with HTTPS

WPMax creates and manages local WordPress development sites using Docker containers. Each site gets its own isolated database, HTTPS via mkcert, and a clean `.wpmax.localhost` domain — no PHP, MySQL, or hosts file needed on your machine.

## Features

- **Docker-only** — No PHP, MySQL, or WP-CLI required on the host
- **HTTPS out of the box** — Wildcard cert via mkcert for `*.wpmax.localhost`
- **Site isolation** — Each site has its own database and network
- **Plugin/theme management** — Install from local ZIPs or WordPress.org
- **Clean installs** — Default bloat (Hello Dolly, Akismet, unused themes) removed automatically
- **Simple lifecycle** — Create, start, stop, delete with one command
- **WP-CLI passthrough** — Full WP-CLI access inside containers
- **Cross-platform** — macOS, Linux, and Windows

## Requirements

- [Docker](https://www.docker.com/products/docker-desktop/) (or [OrbStack](https://orbstack.dev/) on macOS)

## Installation

### From source

```bash
git clone https://github.com/maxcelos/wpmax.git
cd wpmax
make build
# Binary at ./bin/wpmax — move it to your PATH
```

### Go install

```bash
go install github.com/maxcelos/wpmax@latest
```

## Quick Start

```bash
# One-time setup (certs, network, proxy)
wpmax init

# Create a site
wpmax create my-site

# That's it! Visit https://my-site.wpmax.localhost
# Admin: https://my-site.wpmax.localhost/wp-admin (admin/admin)
```

## Commands

### Setup

```bash
wpmax init                  # Set up mkcert, Docker network, and Nginx proxy
wpmax doctor                # Check system requirements and status
```

### Site Lifecycle

```bash
wpmax create <name>         # Create a new WordPress site
wpmax list                  # List all sites with status
wpmax start <name>          # Start a stopped site
wpmax stop <name>           # Stop a running site (preserves data)
wpmax delete <name>         # Delete a site and all its data
wpmax info [name]           # Show detailed site info
```

Use `--all` with start/stop to manage everything at once:

```bash
wpmax stop --all            # Stop all sites and the proxy
wpmax start --all           # Start the proxy and all sites
```

### Create Options

```bash
wpmax create my-site                         # Interactive (prompts for plugins/themes)
wpmax create my-site --skip-plugins          # Skip plugin selection
wpmax create my-site --skip-themes           # Skip theme selection
wpmax create my-site --plugins woo,acf       # Non-interactive plugin list
wpmax create my-site --themes astra          # Non-interactive theme list
```

### Delete Options

```bash
wpmax delete my-site                         # Confirm by typing site name
wpmax delete my-site --yes                   # Skip confirmation
wpmax delete my-site --dry-run               # Preview what would be deleted
wpmax delete my-site --keep-data             # Keep Docker volumes (database)
```

Aliases: `wpmax ls` for list, `wpmax rm` for delete.

### Power User

```bash
wpmax wp <site> <args...>   # Run any WP-CLI command
wpmax shell <site>          # Open bash in the WordPress container
wpmax user add <site>       # Create a WordPress user
wpmax user password <site>  # Change a user's password
```

**WP-CLI examples:**

```bash
wpmax wp my-site option get siteurl
wpmax wp my-site plugin list
wpmax wp my-site db export - > backup.sql
```

**User management:**

```bash
wpmax user add my-site --username=editor --role=editor --password=secret
wpmax user password my-site --username=admin --password=newpass
```

## Configuration

Config is stored in your OS config directory (e.g. `~/Library/Application Support/wpmax/` on macOS).

### View / Set Config

```bash
wpmax config --list
wpmax config --set admin-email me@example.com
wpmax config --set default-plugins-path /path/to/plugin-zips
wpmax config --set default-themes-path /path/to/theme-zips
```

### Plugin & Theme Sources

**Public (WordPress.org):**

```bash
wpmax config --add public-plugins woocommerce
wpmax config --add public-plugins advanced-custom-fields
wpmax config --add public-themes astra
```

**Local ZIPs:**

```bash
wpmax config --set default-plugins-path ~/plugins
# Place .zip files in ~/plugins — they'll appear in the selection prompt
```

During `wpmax create`, you'll see an interactive checklist with all available plugins and themes to pick from.

### Available Config Keys

| Key | Default | Description |
|-----|---------|-------------|
| `default-plugins-path` | — | Directory containing local plugin ZIPs |
| `default-themes-path` | — | Directory containing local theme ZIPs |
| `public-plugins` | — | List of WordPress.org plugin slugs |
| `public-themes` | — | List of WordPress.org theme slugs |
| `db-user` | `wordpress` | Database username |
| `db-password` | `wordpress` | Database password |
| `admin-user` | `admin` | WordPress admin username |
| `admin-email` | `admin@test.com` | WordPress admin email |
| `admin-password` | `admin` | WordPress admin password |

## How It Works

1. `wpmax init` installs a local CA via mkcert, generates a wildcard cert for `*.wpmax.localhost`, creates a shared Docker network, and starts an Nginx reverse proxy
2. `wpmax create` spins up a WordPress + MariaDB stack per site, each with its own private network for DB isolation and a connection to the shared proxy network for HTTPS access
3. The Nginx proxy terminates SSL and routes `<name>.wpmax.localhost` to the correct WordPress container
4. WP-CLI runs via a sidecar container (`wordpress:cli`) that shares volumes with WordPress

### Architecture

```
Browser → https://my-site.wpmax.localhost
       → Nginx proxy (ports 80/443, wildcard cert)
       → my-site-wordpress container (port 80)
       → my-site-db container (MariaDB)
```

Each site is a separate Docker Compose project (`wpmax-<name>`) with isolated networking.

## Doctor

Run diagnostics to verify your setup:

```bash
wpmax doctor
```

```
System checks:

  [PASS] Docker installed
  [PASS] Docker running
  [PASS] Docker Compose v2
  [PASS] mkcert installed
  [PASS] Wildcard certs exist
  [PASS] wpmax network exists
  [PASS] Proxy running
  [PASS] Port 80 available
  [PASS] Port 443 available

All checks passed!
```

## Development

```bash
git clone https://github.com/maxcelos/wpmax.git
cd wpmax

make build        # Build binary to ./bin/wpmax
make install      # Install to GOPATH
make test         # Run tests
make lint         # Run go vet
```

## License

MIT

## Support

- **Issues:** [GitHub Issues](https://github.com/maxcelos/wpmax/issues)