# HR Management System

An HR application for managing employees, leave requests, leave balances, and public holidays. The backend is a plain PHP 8.3 JSON API served by Apache with MySQL 8.0. The frontend uses React, TypeScript, and Vite.

The PHP backend currently supports login and the signed-in employee profile with leave balances. The health check is available for local testing. Employee management, leave requests, and public holiday endpoints are planned. The React app can demonstrate those screens using mock data.

## Project structure

| Path | What belongs here |
|---|---|
| [public/](public/) | Apache's web root. API requests enter through `index.php`. |
| [src/](src/) | PHP application code. Composer maps the `App\` namespace to this folder. |
| [bin/](bin/) | Command-line scripts for setting up the database and creating the first HR user. |
| [database/migrations/](database/migrations/) | SQL files that create the employees, tokens, leave requests, and holidays tables. |
| [database/seeds/](database/seeds/) | SQL files that load the sample public holidays. |
| [frontend/](frontend/) | React pages, components, and the API client. |
| [tests/](tests/) | Reserved for automated tests. The current smoke checks are listed below. |

[composer.json](composer.json) declares the PHP requirements and autoload mapping. For example, when PHP first needs `App\Core\Request`, Composer loads `src/Core/Request.php`. [.env.example](.env.example) lists the settings you copy into your local `.env`.

### Backend files

| File | What it does |
|---|---|
| [public/index.php](public/index.php) | Loads Composer and settings, builds the router, and sends the JSON response. It also converts exceptions into HTTP errors. |
| [src/routes.php](src/routes.php) | Connects HTTP methods and paths to controller methods. It lists which middleware runs for each route. |
| [src/Core/Request.php](src/Core/Request.php) | Reads the incoming method, path, query parameters, JSON body, and headers. It also holds route parameters and the signed-in employee. |
| [src/Core/Router.php](src/Core/Router.php) | Matches the method and path, runs middleware, and calls the controller. |
| [src/Core/Response.php](src/Core/Response.php) | Builds and sends JSON with the correct HTTP status and content type. |
| [src/Core/HttpException.php](src/Core/HttpException.php) | Carries the HTTP status, API error code, message, and any field errors. |
| [src/Core/Validator.php](src/Core/Validator.php) | Checks required text fields and collects their errors into one `422` response. |
| [src/Controllers/HealthController.php](src/Controllers/HealthController.php) | Returns a small JSON response to show that PHP and routing are working. |
| [src/Controllers/AuthController.php](src/Controllers/AuthController.php) | Coordinates login and builds the signed-in employee's profile and leave balance response. |
| [src/Middleware/AuthMiddleware.php](src/Middleware/AuthMiddleware.php) | Checks the Bearer token and attaches the active employee to the request. |
| [src/Middleware/HrMiddleware.php](src/Middleware/HrMiddleware.php) | Checks for the `hr` role. It is ready to use when HR-only routes are added. |
| [src/Models/Employee.php](src/Models/Employee.php) | Looks up employees, saves the last login time, and selects the public profile fields. |
| [src/Models/AuthToken.php](src/Models/AuthToken.php) | Saves token hashes and finds the employee ID for a valid, unexpired token. |
| [src/Models/LeaveRequest.php](src/Models/LeaveRequest.php) | Counts approved leave days for an employee, leave type, and year. |
| [src/Services/LeaveBalance.php](src/Services/LeaveBalance.php) | Subtracts approved days from the yearly allowance for each leave type. |
| [src/Config/LeavePolicy.php](src/Config/LeavePolicy.php) | Defines the annual and sick leave allowances, notice periods, and backdating rules. |
| [src/Config/Database.php](src/Config/Database.php) | Opens a PDO connection to MySQL. Models use PDO to prepare SQL and pass in values. |
| [src/Config/Env.php](src/Config/Env.php) | Reads settings from `.env`. |
| [src/Config/App.php](src/Config/App.php) | Holds the application name and version constants. |

### Follow a request

Try reading the files in this order for `GET /api/v1/me`:

1. Apache forwards the request to `public/index.php`. `Request.php` reads the URL and the `Authorization: Bearer …` header.
2. `Router.php` finds the route in `routes.php` and runs `AuthMiddleware.php`. The middleware uses `AuthToken.php` and `Employee.php` to find the active employee. If the token is missing or invalid, the request ends with `401`.
3. `AuthController::me()` reads the employee from the request and calls `LeaveBalance.php`. The service combines the allowances from `LeavePolicy.php` with the approved days from `LeaveRequest.php`.
4. The controller returns a `Response` object. `public/index.php` sends it to the browser as JSON.

For login, start at `AuthController::login()`. The controller uses `Validator.php` to check the fields, then calls `Employee::findByEmail()` to retrieve the employee. The controller verifies the password and issues an eight-hour token. MySQL stores the token's hash.

### Frontend files

| Path | What it does |
|---|---|
| [frontend/src/main.tsx](frontend/src/main.tsx) | Starts React and mounts the app. |
| [frontend/src/App.tsx](frontend/src/App.tsx) | Defines browser routes and connects them to pages. |
| [frontend/src/pages/](frontend/src/pages/) | Contains the login, dashboard, employee, leave, and holiday screens. |
| [frontend/src/components/](frontend/src/components/) | Contains reusable UI such as dialogs, tables, and balance displays. |
| [frontend/src/layout/](frontend/src/layout/) | Defines the signed-in layout and navigation. |
| [frontend/src/auth/](frontend/src/auth/) | Tracks the browser session and controls access to pages. |
| [frontend/src/api/client.ts](frontend/src/api/client.ts) | Sends API requests, adds the Bearer token, and handles API errors. |
| [frontend/src/api/types.ts](frontend/src/api/types.ts) | Describes request and response data in TypeScript. |
| [frontend/src/api/mock/](frontend/src/api/mock/) | Simulates the API in the browser with demo data. |
| [frontend/src/hooks/](frontend/src/hooks/) and [frontend/src/lib/](frontend/src/lib/) | Hold reusable data-loading, form, formatting, and date helpers. |
| [frontend/vite.config.ts](frontend/vite.config.ts) | Forwards local `/api` requests from Vite to Apache at `hr.localhost`. |

## Requirements

- PHP 8.3 with `pdo_mysql`
- Composer 2
- Apache 2.4 with `mod_php` (the vhost uses `mod_dir`'s `FallbackResource`, so `mod_rewrite` isn't needed)
- MySQL 8.0

## Setup

```bash
git clone https://github.com/mohameA337/hr-management-system.git
cd hr-management-system
composer install            # or: composer dump-autoload (no packages yet)
cp .env.example .env        # then fill in real DB credentials — never commit .env
```

Create the local MySQL database and user, then set their values in `.env`. Run these commands from the repository root.

```bash
/usr/bin/php bin/migrate.php
/usr/bin/php bin/seed.php
/usr/bin/php bin/create-hr-user.php
```

- [bin/bootstrap.php](bin/bootstrap.php) loads Composer and settings for the command-line scripts.
- [bin/migrate.php](bin/migrate.php) runs new migration files and records which ones have already run.
- [bin/seed.php](bin/seed.php) loads the holiday seed data.
- [bin/create-hr-user.php](bin/create-hr-user.php) asks for the first HR user's details and saves a hashed password.

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
curl -i http://hr.localhost/api/v1/health          # 200, data.status is "ok"
curl -i http://hr.localhost/api/v1/does-not-exist  # 404 NOT_FOUND
curl -i http://hr.localhost/api/v1/me              # 401 without a token
```

## Frontend (React + Vite)

Requires Node.js 20+.

```bash
cd frontend
npm install
cp .env.example .env.development.local   # VITE_USE_MOCKS=true runs without the backend
npm run dev                               # http://localhost:5173
```

- The dev server forwards `/api/*` to `http://hr.localhost`, so the backend needs no CORS setup.
- With `VITE_USE_MOCKS=true`, the app runs on a built-in mock API with demo data saved in the browser. Log in as
  `hr@hr.test` (HR) or `employee@hr.test` (employee) with password `password`; "Reset demo data" on the
  login page restores the original data.
- Set `VITE_USE_MOCKS=false` (and restart `npm run dev`) to use the real PHP backend. Production builds
  should also use the real backend. Pages that depend on planned endpoints need mock mode until those endpoints are implemented.
- `npm run build` type-checks and builds to `frontend/dist/`.

## Security notes

- Only `public/` is exposed. `src/`, `vendor/`, `.env` and `database/` are outside the DocumentRoot.
- Keep real credentials only in `.env`, which is git-ignored.
