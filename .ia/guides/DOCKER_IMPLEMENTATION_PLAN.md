# Docker Implementation Plan

## Overview

Add Docker support to wp-setup with `--docker` flag. This will create a complete local development environment with NGINX, PHP-FPM, MySQL, Mailpit, and Traefik for HTTPS.

---

## Architecture Decisions

### Domain & SSL
- **Domain**: `https://{slug}.localhost`
- **SSL**: mkcert for trusted local certificates
- **Reverse Proxy**: Shared Traefik instance across all projects

### Stack
- **PHP**: php:8.4-fpm-alpine with WP-CLI
- **Web Server**: nginx:alpine
- **Database**: mysql:8.0
- **Email Testing**: axllent/mailpit
- **Reverse Proxy**: traefik:latest (shared)

### File Structure
```
my-site/
├── .docker/
│   ├── compose.yml              # Main Docker Compose file
│   ├── nginx/
│   │   └── default.conf         # Nginx configuration
│   ├── php/
│   │   └── entrypoint.sh        # PHP entrypoint (installs WP-CLI)
│   ├── mysql/                   # MySQL data volume (bind mount)
│   └── mailpit/                 # Mailpit data (if needed)
├── index.php                    # WordPress core files in root
├── wp-config.php
├── wp-content/
└── ...
```

### Shared Traefik Structure
```
~/.config/wp-setup/
├── config.json                  # Existing config
└── traefik/
    ├── compose.yml              # Traefik's own compose file
    ├── traefik.yml              # Traefik static config
    └── certs/                   # mkcert certificates (_wildcard.localhost+1.pem)
```

---

## Implementation Tasks

### 1. Create Traefik Manager (`src/traefik-manager.js`)

**Responsibilities:**
- Check if mkcert is installed (`mkcert --version`)
- If not installed, show installation instructions and exit
- Generate wildcard cert for `*.localhost`:
  ```bash
  cd ~/.config/wp-setup/traefik/certs
  mkcert "*.localhost"
  ```
- Check if Docker network `traefik-network` exists
- Check if Traefik container is running
- If not, create Traefik setup and start container

**Functions:**
- `ensureMkcertInstalled()` - Check and guide installation
- `generateCertificates()` - Create wildcard cert if doesn't exist
- `ensureTraefikNetwork()` - Create Docker network if needed
- `ensureTraefikRunning()` - Start Traefik container if not running
- `setupTraefik()` - Main orchestration function

**Traefik compose.yml:**
```yaml
services:
  traefik:
    image: traefik:latest
    container_name: traefik
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - ./traefik.yml:/traefik.yml:ro
      - ./certs:/certs:ro
    networks:
      - traefik-network

networks:
  traefik-network:
    name: traefik-network
    external: true
```

**Traefik traefik.yml:**
```yaml
entryPoints:
  web:
    address: ":80"
    http:
      redirections:
        entryPoint:
          to: websecure
          scheme: https
  websecure:
    address: ":443"

providers:
  docker:
    network: traefik-network
    exposedByDefault: false

tls:
  stores:
    default:
      defaultCertificate:
        certFile: /certs/_wildcard.localhost+1.pem
        keyFile: /certs/_wildcard.localhost+1-key.pem
```

---

### 2. Create Docker Manager (`src/docker-manager.js`)

**Responsibilities:**
- Generate all Docker-related files
- Start/stop containers
- Wait for service readiness
- Execute commands inside containers

**Functions:**
- `generateComposeFile(config)` - Create compose.yml
- `generateNginxConfig(config)` - Create nginx/default.conf
- `generatePhpEntrypoint()` - Create php/entrypoint.sh
- `startContainers(cwd)` - Run docker compose up -d
- `waitForMySQL(cwd)` - Poll until MySQL is ready
- `execInContainer(cwd, service, command)` - Run commands in containers
- `stopContainers(cwd)` - Stop containers
- `removeContainers(cwd)` - Remove containers and volumes

**compose.yml Template:**
```yaml
services:
  php:
    image: php:8.4-fpm-alpine
    container_name: ${COMPOSE_PROJECT_NAME}-php
    volumes:
      - ..:/var/www/html
      - ./php/entrypoint.sh:/usr/local/bin/docker-entrypoint.sh
    entrypoint: ["/usr/local/bin/docker-entrypoint.sh"]
    command: ["php-fpm"]
    environment:
      - WORDPRESS_DB_HOST=mysql
      - WORDPRESS_DB_NAME=${DB_NAME}
      - WORDPRESS_DB_USER=root
      - WORDPRESS_DB_PASSWORD=root
    networks:
      - default
    depends_on:
      mysql:
        condition: service_healthy

  nginx:
    image: nginx:alpine
    container_name: ${COMPOSE_PROJECT_NAME}-nginx
    volumes:
      - ..:/var/www/html:ro
      - ./nginx/default.conf:/etc/nginx/conf.d/default.conf:ro
    networks:
      - default
      - traefik
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=traefik-network"
      - "traefik.http.routers.${COMPOSE_PROJECT_NAME}.rule=Host(`${SITE_URL}`)"
      - "traefik.http.routers.${COMPOSE_PROJECT_NAME}.entrypoints=websecure"
      - "traefik.http.routers.${COMPOSE_PROJECT_NAME}.tls=true"
      - "traefik.http.services.${COMPOSE_PROJECT_NAME}.loadbalancer.server.port=80"
    depends_on:
      - php

  mysql:
    image: mysql:8.0
    container_name: ${COMPOSE_PROJECT_NAME}-mysql
    volumes:
      - ./mysql:/var/lib/mysql
    environment:
      MYSQL_ROOT_PASSWORD: root
      MYSQL_DATABASE: ${DB_NAME}
    networks:
      - default
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost", "-proot"]
      interval: 5s
      timeout: 3s
      retries: 10

  mailpit:
    image: axllent/mailpit
    container_name: ${COMPOSE_PROJECT_NAME}-mailpit
    networks:
      - default
      - traefik
    environment:
      MP_SMTP_AUTH_ACCEPT_ANY: 1
      MP_SMTP_AUTH_ALLOW_INSECURE: 1
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=traefik-network"
      - "traefik.http.routers.${COMPOSE_PROJECT_NAME}-mail.rule=Host(`mail.${SITE_URL}`)"
      - "traefik.http.routers.${COMPOSE_PROJECT_NAME}-mail.entrypoints=websecure"
      - "traefik.http.routers.${COMPOSE_PROJECT_NAME}-mail.tls=true"
      - "traefik.http.services.${COMPOSE_PROJECT_NAME}-mail.loadbalancer.server.port=8025"

networks:
  default:
    name: ${COMPOSE_PROJECT_NAME}-network
  traefik:
    external: true
    name: traefik-network
```

**.env Template:**
```env
COMPOSE_PROJECT_NAME={slug}
SITE_URL={slug}.localhost
DB_NAME={dbName}
```

**nginx/default.conf Template:**
```nginx
server {
    listen 80;
    server_name {slug}.localhost;
    root /var/www/html;
    index index.php index.html;

    client_max_body_size 64M;

    location / {
        try_files $uri $uri/ /index.php?$args;
    }

    location ~ \.php$ {
        fastcgi_split_path_info ^(.+\.php)(/.+)$;
        fastcgi_pass php:9000;
        fastcgi_index index.php;
        include fastcgi_params;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        fastcgi_param PATH_INFO $fastcgi_path_info;
        fastcgi_buffering off;
    }

    location ~ /\.ht {
        deny all;
    }
}
```

**php/entrypoint.sh Template:**
```bash
#!/bin/sh
set -e

# Install common PHP extensions for WordPress
apk add --no-cache \
    libpng-dev \
    libjpeg-turbo-dev \
    libwebp-dev \
    freetype-dev \
    libzip-dev \
    icu-dev \
    imagemagick-dev \
    imagemagick

# Configure and install PHP extensions
docker-php-ext-configure gd \
    --with-freetype \
    --with-jpeg \
    --with-webp

docker-php-ext-install -j$(nproc) \
    gd \
    mysqli \
    pdo_mysql \
    zip \
    opcache \
    exif \
    intl \
    bcmath

# Install imagick via PECL
apk add --no-cache --virtual .build-deps $PHPIZE_DEPS
pecl install imagick
docker-php-ext-enable imagick
apk del .build-deps

# Download and install WP-CLI
curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
chmod +x wp-cli.phar
mv wp-cli.phar /usr/local/bin/wp

# Execute the main container command
exec "$@"
```

---

### 3. Update Installer (`src/installer.js`)

**New Methods:**
- `async setupDocker()` - Orchestrate Docker setup
- `async execWPCLI(command)` - Execute WP-CLI in Docker container
- `async configureDatabaseDocker()` - Create wp-config via Docker
- `async installWordPressDocker()` - Install WP via Docker
- `async installPluginsDocker()` - Install plugins via Docker

**Modified Methods:**
- `configureDatabase()` - Add Docker branch
- `installWordPress()` - Add Docker branch
- `installPlugins()` - Add Docker branch

**Docker Flow:**
```javascript
async setupDocker() {
    // 1. Generate Docker files
    await this.dockerManager.generateComposeFile(this.config);
    await this.dockerManager.generateNginxConfig(this.config);
    await this.dockerManager.generatePhpEntrypoint();

    // 2. Start containers
    await this.dockerManager.startContainers(this.cwd);

    // 3. Wait for MySQL
    await this.dockerManager.waitForMySQL(this.cwd);
}

async execWPCLI(args) {
    return this.dockerManager.execInContainer(
        this.cwd,
        'php',
        ['wp', '--allow-root', ...args]
    );
}
```

**Database Configuration (Docker mode):**
```javascript
async configureDatabaseDocker() {
    await this.execWPCLI([
        'config', 'create',
        `--dbname=${this.config.dbName}`,
        '--dbuser=root',
        '--dbpass=root',
        '--dbhost=mysql',
        '--quiet'
    ]);

    // Configure Mailpit SMTP
    await this.execWPCLI([
        'config', 'set', 'SMTP_HOST', 'mailpit',
        '--type=constant'
    ]);

    await this.execWPCLI([
        'config', 'set', 'SMTP_PORT', '1025',
        '--type=constant'
    ]);
}
```

---

### 4. Update CLI (`bin/index.js`)

**Flag Priority:**
- If `--docker` is present, ignore `--no-db`
- Docker mode always creates database

**Modified Configuration:**
```javascript
const config = {
    slug: siteName,
    title: siteName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
    dbName: siteName.replace(/-/g, '_'),
    url: options.docker ? `https://${siteName}.localhost` : `${siteName}.test`,
    useDocker: options.docker,
    noDb: options.docker ? false : options.db === false,
    selectedPlugins: selectedPlugins
};
```

**Modified Execution Flow:**
```javascript
if (config.useDocker) {
    spinner.start('Setting up Traefik...');
    await ensureTraefik();
    spinner.succeed();

    spinner.start('Creating directory...');
    await installer.createDirectory();
    spinner.succeed();

    spinner.start('Downloading Core...');
    await installer.downloadCore();
    spinner.succeed();

    spinner.start('Starting Docker containers...');
    await installer.setupDocker();
    spinner.succeed();

    spinner.start('Configuring Database...');
    await installer.configureDatabaseDocker();
    spinner.succeed();

    spinner.start('Installing WordPress...');
    await installer.installWordPressDocker();
    spinner.succeed();

    spinner.start('Installing Plugins...');
    await installer.installPluginsDocker();
    spinner.succeed();

    console.log(chalk.green('\n✅  Done! Site is ready.'));
    console.log(`    ${chalk.cyan(config.url)}`);
    console.log(`    Mailpit: ${chalk.cyan(`https://mail.${siteName}.localhost`)}\n`);
} else {
    // Existing non-Docker flow
}
```

---

### 5. Add Cleanup Command

**New Command: `wp-setup remove <site-name>`**

**Responsibilities:**
- Detect if site uses Docker (check for `.docker/compose.yml`)
- If Docker:
  - Stop and remove containers
  - Remove Docker networks (if no other containers using it)
  - Remove project directory
- If non-Docker:
  - Drop database (if exists)
  - Remove project directory

**Implementation:**
```javascript
program
    .command('remove')
    .description('Remove a WordPress site and clean up resources')
    .argument('<name>', 'Name of the site to remove')
    .option('-f, --force', 'Skip confirmation prompt')
    .action(async (name, options) => {
        const sitePath = path.join(process.cwd(), name);

        // Check if site exists
        if (!fs.existsSync(sitePath)) {
            console.error(chalk.red(`Error: Site "${name}" not found.`));
            process.exit(1);
        }

        // Confirm deletion
        if (!options.force) {
            const { confirm } = await inquirer.prompt([{
                type: 'confirm',
                name: 'confirm',
                message: `Are you sure you want to remove "${name}"?`,
                default: false
            }]);

            if (!confirm) {
                console.log('Cancelled.');
                return;
            }
        }

        const spinner = ora();

        try {
            // Check if Docker site
            const dockerComposePath = path.join(sitePath, '.docker/compose.yml');

            if (fs.existsSync(dockerComposePath)) {
                spinner.start('Stopping Docker containers...');
                await execa('docker', ['compose', 'down', '-v'], {
                    cwd: path.join(sitePath, '.docker')
                });
                spinner.succeed();
            } else {
                // Drop database for non-Docker sites
                const dbName = name.replace(/-/g, '_');
                spinner.start('Dropping database...');
                try {
                    await execa('wp', ['db', 'drop', '--yes'], { cwd: sitePath });
                    spinner.succeed();
                } catch (error) {
                    spinner.warn('Database not found or already removed');
                }
            }

            spinner.start('Removing files...');
            fs.rmSync(sitePath, { recursive: true, force: true });
            spinner.succeed();

            console.log(chalk.green(`\n✅  Site "${name}" removed successfully.\n`));

        } catch (error) {
            spinner.fail('Removal failed');
            console.error(chalk.red(error.message));
            process.exit(1);
        }
    });
```

---

## Installation Flow (Docker Mode)

```bash
wp-setup my-site --docker
```

**Steps:**
1. ✓ Check if mkcert is installed (exit if not)
2. ✓ Setup/verify Traefik is running
3. ✓ Create project directory
4. ✓ Download WordPress core to project root (via WP-CLI locally)
5. ✓ Create `.docker/` directory structure
6. ✓ Generate `.docker/compose.yml`
7. ✓ Generate `.docker/.env`
8. ✓ Generate `.docker/nginx/default.conf`
9. ✓ Generate `.docker/php/entrypoint.sh`
10. ✓ Start containers: `docker compose up -d`
11. ✓ Wait for MySQL healthcheck to pass
12. ✓ Run `wp config create` inside php container
13. ✓ Configure Mailpit SMTP in wp-config
14. ✓ Run `wp core install` inside php container
15. ✓ Run `wp plugin install` for each selected plugin
16. ✓ Show success message with URLs

**Output:**
```
✔ Setting up Traefik...
✔ Creating directory...
✔ Downloading Core...
✔ Starting Docker containers...
✔ Configuring Database...
✔ Installing WordPress...
✔ Installing Plugins...

✅  Done! Site is ready.
    https://my-site.localhost
    Mailpit: https://mail.my-site.localhost
```

---

## Clarifications & Decisions

### 1. PHP Extensions
Install all common WordPress extensions:
- `mysqli` - MySQL database
- `gd` - Image manipulation
- `zip` - ZIP archive handling
- `opcache` - PHP opcode caching
- `exif` - Image metadata
- `intl` - Internationalization
- `bcmath` - Arbitrary precision math
- `imagick` - Advanced image processing (via PECL)

### 2. WP-CLI Installation
- Download WP-CLI at runtime via entrypoint script
- Installed to `/usr/local/bin/wp` in PHP container
- Available for all WP-CLI commands during setup

### 3. MySQL Configuration
- **Host**: `mysql` (Docker service name)
- **Root Password**: `root` (hardcoded for local dev simplicity)
- **Database**: Auto-created by MySQL container via env var

### 4. Mailpit Configuration
- **Automatically configure** WP to use Mailpit SMTP
- Add constants to wp-config.php:
  - `SMTP_HOST`: `mailpit`
  - `SMTP_PORT`: `1025`
- Web UI available at: `https://mail.{slug}.localhost`

### 5. Cleanup Command
- **Added**: `wp-setup remove <site-name>` command
- Stops containers, removes volumes, deletes project directory
- Works for both Docker and non-Docker sites

### 6. Container Auto-start
- **Yes**: Automatically start containers after generation
- Wait for MySQL healthcheck before proceeding
- Full installation completes without user intervention

---

## File Checklist

### New Files to Create
- [ ] `src/traefik-manager.js` - Traefik setup and management
- [ ] `src/docker-manager.js` - Docker Compose generation and container management
- [ ] Templates for Docker files (embedded in docker-manager.js)

### Files to Modify
- [ ] `src/installer.js` - Add Docker-specific installation methods
- [ ] `bin/index.js` - Add Docker flag handling, remove command, update flow

### Generated Files (per project)
- `.docker/compose.yml`
- `.docker/.env`
- `.docker/nginx/default.conf`
- `.docker/php/entrypoint.sh`

### Generated Files (shared Traefik)
- `~/.config/wp-setup/traefik/compose.yml`
- `~/.config/wp-setup/traefik/traefik.yml`
- `~/.config/wp-setup/traefik/certs/_wildcard.localhost+1.pem`
- `~/.config/wp-setup/traefik/certs/_wildcard.localhost+1-key.pem`

---

## Testing Checklist

### Before Implementation
- [ ] Verify mkcert installation: `mkcert --version`
- [ ] Verify Docker installation: `docker --version`
- [ ] Test mkcert cert generation: `mkcert "*.localhost"`

### After Implementation
- [ ] Test Docker site creation: `wp-setup test-site --docker`
- [ ] Verify all containers running: `docker ps`
- [ ] Test HTTPS access: `https://test-site.localhost`
- [ ] Test Mailpit UI: `https://mail.test-site.localhost`
- [ ] Test plugin installation
- [ ] Test site removal: `wp-setup remove test-site`
- [ ] Test multiple sites with shared Traefik
- [ ] Test non-Docker site creation still works
- [ ] Test flag priority: `--docker --no-db` (should ignore --no-db)

---

## Future Enhancements (Out of Scope)

- [ ] Add `wp-setup start <site-name>` command
- [ ] Add `wp-setup stop <site-name>` command
- [ ] Add Xdebug support (optional flag `--xdebug`)
- [ ] Add Redis support (optional flag `--redis`)
- [ ] Make PHP version configurable
- [ ] Add phpMyAdmin service (optional)
- [ ] Support for custom domains beyond `.localhost`