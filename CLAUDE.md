# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`wp-setup` is a CLI tool for quickly scaffolding WordPress sites. It automates the process of downloading WordPress core, configuring a database, installing WordPress, and setting up plugins via WP-CLI commands.

## Architecture

The project follows a simple two-layer architecture:

1. **CLI Layer** (`bin/index.js`): Uses Commander.js for argument parsing, Inquirer for interactive prompts, and Ora for loading spinners. Responsible for user interaction and orchestrating the installation flow.

2. **Installer Layer** (`src/installer.js`): The `WordPressInstaller` class executes WP-CLI commands via `execa`. All WP-CLI commands are run with `{ cwd: this.cwd }` to execute inside the newly created project directory.

### Configuration Flow

The CLI generates a configuration object from user input that includes:
- `slug`: Directory name and base for other values
- `title`: Auto-capitalized from slug
- `dbName`: Slug with underscores instead of hyphens
- `url`: Format `{slug}.test`
- `useDocker`: Future flag for Docker support (not yet implemented)
- `premiumPluginPath`: Hardcoded path to premium plugin ZIP

### Database Configuration

Currently uses **local MySQL via Unix socket** (`localhost:/tmp/mysql_3306.sock`). The `configureDatabase()` method in `src/installer.js:30-47` has a placeholder for future Docker Compose support via the `useDocker` flag, but Docker functionality is not yet implemented.

## Development

```bash
# Install dependencies
pnpm install

# Test the CLI locally (run from project root)
node bin/index.js [name] [options]

# Example usage
node bin/index.js my-site
node bin/index.js my-site --docker
```

## Requirements

- **WP-CLI** must be installed and available in PATH
- **Local MySQL** running with socket at `/tmp/mysql_3306.sock` (or modify line 41 in `src/installer.js`)
- For premium plugin installation: ZIP file must exist at the path specified in `bin/index.js:38`

## Key Implementation Details

- The tool uses `execa` instead of Node's built-in `child_process` for better process handling
- All WP-CLI commands use `--quiet` flag to suppress output (spinners handle user feedback)
- Default WordPress admin credentials: `admin/admin` with email `admin@test.com`
- Directory creation validation: Fails if directory already exists
- Premium plugin installation is optional (skips if file doesn't exist)