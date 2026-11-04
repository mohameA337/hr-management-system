# HR Management System

REST API backend in plain PHP 8.3 (no framework), served by Apache with MySQL 8.0.

## Requirements

- PHP 8.3 with `pdo_mysql`
- Composer 2
- Apache 2.4 with `mod_php` (the vhost uses `mod_dir`'s `FallbackResource`, so `mod_rewrite` isn't needed)
- MySQL 8.0

## Setup

```bash
git clone <repo-url> hr-management-system
cd hr-management-system
composer install            # or: composer dump-autoload (no packages yet)
cp .env.example .env        # then fill in real DB credentials — never commit .env
```

### Apache virtual host

Create `/etc/apache2/sites-available/hr.localhost.conf`:

```apache
<VirtualHost *:80>
    ServerName hr.localhost
    DocumentRoot /path/to/hr-management-system/public

    <Directory /path/to/hr-management-system/public>
        Options -Indexes -FollowSymLinks
        AllowOverride None
        Require all granted
        DirectoryIndex index.php
        FallbackResource /index.php
    </Directory>

    ErrorLog ${APACHE_LOG_DIR}/hr.localhost-error.log
    CustomLog ${APACHE_LOG_DIR}/hr.localhost-access.log combined
</VirtualHost>
```

Enable it:

```bash
sudo a2ensite hr.localhost
sudo apache2ctl configtest
sudo systemctl reload apache2
```

`*.localhost` resolves to loopback on Ubuntu (systemd-resolved). If it doesn't on your machine,
add `127.0.0.1 hr.localhost` to `/etc/hosts`. If the project is under your home directory,
Apache (`www-data`) needs execute permission on each parent directory, for example
`setfacl -m u:www-data:x ~`.

### Verify

```bash
curl http://hr.localhost/
curl http://hr.localhost/api/employees   # any path is routed to public/index.php
```

## Project structure

```
public/            Web root — the only web-accessible directory (front controller: index.php)
src/               Application code, PSR-4 namespace App\
  Config/
  Controllers/
  Models/
  Middleware/
database/migrations/  SQL migrations
tests/
```

## Security notes

- Only `public/` is exposed. `src/`, `vendor/`, `.env` and `database/` are outside the DocumentRoot.
- Keep real credentials only in `.env`, which is git-ignored.
