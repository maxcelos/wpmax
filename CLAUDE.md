# CLAUDE.md

## Project Overview

`wpmax` is a Go CLI tool for creating and managing Docker-based WordPress development sites. The only host dependency is Docker.

**Stack:** Go + Cobra + Docker Compose + Nginx reverse proxy + mkcert
**Domains:** `<name>.wpmax.localhost` (auto-resolves, no /etc/hosts)
**HTTPS:** mkcert wildcard cert for `*.wpmax.localhost`

## Architecture

- **CLI Layer** (`cmd/`): Cobra commands handle user interaction.
- **Internal Packages** (`internal/`): Business logic separated by concern.
- **Templates** (`templates/`): Embedded via `//go:embed` for Docker Compose and Nginx configs.

### Key Packages

- `internal/config` — `~/.config/wpmax/config.json` CRUD
- `internal/registry` — `~/.config/wpmax/sites.json` site registration
- `internal/docker` — Docker/Compose command helpers via `os/exec`
- `internal/proxy` — Shared Nginx proxy lifecycle + per-site vhost configs
- `internal/compose` — Per-site docker-compose.yml template rendering
- `internal/certs` — mkcert installation and certificate generation
- `internal/plugins` — Local ZIP scanning + interactive multi-select
- `internal/wpcli` — WP-CLI execution via `docker compose run --rm cli`

## Development

```bash
# Build
make build

# Install to GOPATH
make install

# Run locally
go run . <command>

# Test
make test

# Lint
make lint
```

## Commands

- `wpmax init` — Set up mkcert, Docker network, and Nginx proxy
- `wpmax create <name>` — Create a new WordPress site
- `wpmax list` / `ls` — List all sites with status
- `wpmax start <name>` — Start a stopped site
- `wpmax stop <name>` — Stop a running site
- `wpmax delete <name>` / `rm` — Delete a site and its data
- `wpmax info [name]` — Show detailed site info
- `wpmax wp <site> <args>` — Run WP-CLI commands
- `wpmax shell <site>` — Open bash in WordPress container
- `wpmax user add|password <site>` — Manage WordPress users
- `wpmax config` — Manage configuration
- `wpmax doctor` — Check system requirements

## Design Decisions

- WP-CLI runs via `wordpress:cli` sidecar with `profiles: ["cli"]`
- Named volume `wp_data` for WP core, bind mount `./wp-content` for editable files
- Plugin/theme ZIPs mounted as `/mnt/plugins:ro` and `/mnt/themes:ro`
- Container naming: `<name>-wordpress`, `<name>-db`, `<name>-cli`
- Rollback on create failure unwinds in reverse order
