# Backend Build Guide

Step-by-step plan for the PHP backend in `REQUIREMENTS.md`, `DATABASE.md` and `API.md` (v3.0:
**4 tables, 9 endpoints**). Work in order; **don't start a step until the previous step's test passes**,
and commit after each one.

- **Phase 0 shows the full code** (it's infrastructure). After that the guide says *what* to write and
  *which rules* apply — you write it.
- **Reference implementation:** `frontend/src/api/mock/handlers/` implements all 9 endpoints with the same
  rules in TypeScript. When a rule is unclear, read it there.
- **Stuck?** Show me your code and the error.

## Already done (the database layer)

| Done | File |
|---|---|
| ✅ Database tables | `database/migrations/001`–`004` |
| ✅ Public holidays 2026–2027 | `database/seeds/001_public_holidays.sql` |
| ✅ Settings reader | `src/Config/Env.php` |
| ✅ PDO connection | `src/Config/Database.php` |
| ✅ Scripts | `bin/migrate.php`, `bin/seed.php`, `bin/create-hr-user.php` |

**Set it up once** (after `sudo mysql < …create-db.sql` created the database and the `hr_app` user):

```bash
php bin/migrate.php          # creates the 4 tables
php bin/seed.php             # loads the public holidays
php bin/create-hr-user.php   # asks for your name, email and password → your first HR login
```

## Final folder structure

```
public/index.php                 every request starts here
src/routes.php                   the 9 routes
src/Config/Env.php               ✅
src/Config/Database.php          ✅
src/Config/LeavePolicy.php       the two leave types and their rules
src/Core/Request.php             method, path, query, JSON body, token, {id}, current user
src/Core/Response.php            JSON responses
src/Core/Router.php              URL + method → controller method (+ middleware)
src/Core/HttpException.php       "stop and return this error"
src/Core/Validator.php           collects field errors → 422
src/Middleware/AuthMiddleware.php  valid token? → sets the current user (401)
src/Middleware/HrMiddleware.php    role must be "hr" (403)
src/Models/Employee.php          SQL for employees (+ presenting an employee as JSON)
src/Models/AuthToken.php         SQL for tokens
src/Models/LeaveRequest.php      SQL for leave requests (+ presenting one as JSON)
src/Models/Holiday.php           SQL for holidays
src/Services/WorkingDays.php     counts working days (weekends + holidays skipped)
src/Services/LeaveBalance.php    remaining days per type
src/Controllers/AuthController.php       #1 login, #2 me
src/Controllers/EmployeeController.php   #3 list, #4 create, #5 update
src/Controllers/LeaveController.php      #6 list, #7 create, #8 update
src/Controllers/HolidayController.php    #9 list
```

| Layer | Does | Never does |
|---|---|---|
| Router / routes | URL → controller method | Business logic |
| Middleware | Checks token and role | Anything else |
| Controller | Reads input, validates, applies rules, returns `Response` | Writes SQL |
| Model | Prepared SQL, returns arrays | Reads `$_GET`, echoes |
| Service | Calculations used in several places | Knows about HTTP |

---

## Phase 0 — Foundation

Goal: any unknown URL returns a JSON 404, and broken JSON returns 400.

### 0.1 `src/Core/HttpException.php`

```php
<?php

declare(strict_types=1);

namespace App\Core;

use RuntimeException;

final class HttpException extends RuntimeException
{
    /** @param array<string, string[]> $details field => messages (only for VALIDATION_ERROR) */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,   // not $code: Exception already has an int $code
        string $message,
        public readonly array $details = [],
    ) {
        parent::__construct($message);
    }

    public static function notFound(string $what = 'Record'): self
    {
        return new self(404, 'NOT_FOUND', "{$what} not found.");
    }

    public static function conflict(string $message): self
    {
        return new self(409, 'CONFLICT', $message);
    }

    public static function forbidden(string $message = 'You do not have permission to do this.'): self
    {
        return new self(403, 'FORBIDDEN', $message);
    }
}
```

### 0.2 `src/Core/Response.php`

```php
<?php

declare(strict_types=1);

namespace App\Core;

final class Response
{
    private function __construct(private int $status, private array $body)
    {
    }

    public static function data(mixed $data, int $status = 200): self
    {
        return new self($status, ['data' => $data]);
    }

    public static function paginated(array $items, array $meta): self
    {
        return new self(200, ['data' => $items, 'meta' => $meta]);
    }

    public static function error(HttpException $e): self
    {
        $error = ['code' => $e->errorCode, 'message' => $e->getMessage()];
        if ($e->details !== []) {
            $error['details'] = $e->details;
        }
        return new self($e->status, ['error' => $error]);
    }

    public function send(): void
    {
        http_response_code($this->status);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($this->body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
}
```

### 0.3 `src/Core/Request.php` — write it yourself (~70 lines)

| Method | Returns |
|---|---|
| `static fromGlobals(): self` | Built from `$_SERVER['REQUEST_METHOD']`, `parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH)`, `$_GET`, the JSON body, `getallheaders()` (keys lower-cased) |
| `method()`, `path()` | `'GET'`, `'/api/v1/employees/3'` |
| `query(string $key, ?string $default = null)` | One query parameter |
| `input(string $key, mixed $default = null)` / `has(string $key)` | One body field / was it sent? (PATCH) |
| `bearerToken(): ?string` | Token from `Authorization: Bearer …` |
| `setParams(array)` / `param(string): int` | Route `{id}` |
| `setUser(array)` / `user(): array` | The logged-in employee row |

The body part:

```php
$raw = file_get_contents('php://input');
$body = [];
if ($raw !== false && trim($raw) !== '') {
    $body = json_decode($raw, true);
    if (!is_array($body)) {
        throw new HttpException(400, 'BAD_REQUEST', 'The request body must be valid JSON.');
    }
}
```

### 0.4 `src/Core/Router.php`

```php
<?php

declare(strict_types=1);

namespace App\Core;

final class Router
{
    private array $routes = [];

    public function add(string $method, string $path, array $handler, array $middleware = []): void
    {
        $this->routes[] = compact('method', 'path', 'handler', 'middleware');
    }

    public function dispatch(Request $request): Response
    {
        foreach ($this->routes as $route) {
            // '/api/v1/employees/{id}' → '#^/api/v1/employees/(?P<id>\d+)$#'
            $pattern = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>\d+)', $route['path']) . '$#';
            if ($route['method'] !== $request->method() || !preg_match($pattern, $request->path(), $matches)) {
                continue;
            }
            $request->setParams(array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY));
            foreach ($route['middleware'] as $middleware) {
                (new $middleware())->handle($request);   // throws 401 / 403 to stop
            }
            [$controller, $method] = $route['handler'];
            return (new $controller())->$method($request);
        }
        throw HttpException::notFound('Endpoint');
    }
}
```

### 0.5 `src/routes.php` (empty for now) and `public/index.php`

```php
<?php
// src/routes.php

declare(strict_types=1);

use App\Core\Router;

return function (Router $router): void {
    // Routes are added phase by phase.
};
```

```php
<?php
// public/index.php

declare(strict_types=1);

use App\Config\Env;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Router;

require dirname(__DIR__) . '/vendor/autoload.php';

Env::load(dirname(__DIR__) . '/.env');
date_default_timezone_set(Env::get('APP_TIMEZONE', 'UTC'));

$router = new Router();
(require dirname(__DIR__) . '/src/routes.php')($router);

try {
    $response = $router->dispatch(Request::fromGlobals());
} catch (HttpException $e) {
    $response = Response::error($e);
} catch (Throwable $e) {
    error_log((string) $e);   // details go to /var/log/apache2/hr.localhost-error.log, never to the user
    $response = Response::error(new HttpException(500, 'SERVER_ERROR', 'Something went wrong. Please try again.'));
}

$response->send();
```

### ✅ Test

```bash
curl -i http://hr.localhost/api/v1/anything                         # 404 NOT_FOUND (JSON)
curl -i -X POST http://hr.localhost/api/v1/anything -d '{bad'       # 400 BAD_REQUEST
```

---

## Phase 1 — Login (#1, #2)

### 1.1 `src/Core/Validator.php`

Collects errors per field; `throwIfFailed()` throws one 422 with all of them:

```php
$v = new Validator($request);
$email = $v->requiredString('email', 'email');        // "The email field is required."
$password = $v->requiredString('password', 'password');
$v->throwIfFailed();
```

Methods needed over the whole project: `requiredString(field, label, maxLength = 255)`,
`optionalString(field, maxLength)`, `requiredDate(field, label)` (valid `Y-m-d`), `email(field)`,
`in(field, array $allowed, message)`, `add(field, message)`, `throwIfFailed()`.

### 1.2 Models

**`Employee`**: `findByEmail(string): ?array`, `find(int): ?array`, `touchLastLogin(int)`, and a static
`present(array $row): array` that builds the API's Employee object — **without** `password_hash`.

**`AuthToken`**: `create(int $employeeId, string $hash, string $expiresAt)` and
`findEmployeeId(string $hash, string $now): ?int` (`WHERE token_hash = ? AND expires_at > ?` — pass `$now`
from PHP, `date('Y-m-d H:i:s')`, so PHP and MySQL timezones can't disagree).

### 1.3 `AuthController::login` (#1)

1. Validate `email` and `password` → 422.
2. Find the employee by email.
3. Not found, **or** `status !== 'active'`, **or** `!password_verify($password, $row['password_hash'])` →
   `401 UNAUTHENTICATED` "Invalid email or password." — the same message for all three.
4. Token:
   ```php
   $token = bin2hex(random_bytes(32));          // given to the client once
   $hash = hash('sha256', $token);              // only this is stored
   $expiresAt = date('Y-m-d H:i:s', time() + 8 * 3600);
   ```
5. Save the token, update `last_login_at`, return `{ token, expires_at, user }`.

### 1.4 Middleware

- **`AuthMiddleware::handle(Request)`**: no bearer token → 401; `findEmployeeId(hash('sha256', $token), now)`
  null → 401 "Your session has expired. Please log in again."; employee not active → 401;
  `$request->setUser($employee)`.
- **`HrMiddleware::handle(Request)`**: `$request->user()['role'] !== 'hr'` → 403.

### 1.5 `src/Config/LeavePolicy.php` and `AuthController::me` (#2)

```php
final class LeavePolicy
{
    public const TYPES = [
        'annual' => ['name' => 'Annual', 'days_per_year' => 21, 'min_notice_days' => 3, 'max_backdate_days' => 0],
        'sick'   => ['name' => 'Sick',   'days_per_year' => 10, 'min_notice_days' => 0, 'max_backdate_days' => 7],
    ];
}
```

**`Services/LeaveBalance::forEmployee(int $employeeId, int $year): array`** — for each type in `TYPES`, run the
"used days" query from `DATABASE.md` §4 and return the Leave balance object from `API.md` §3.

`me` returns `{ user: Employee::present($request->user()), leave_balances: LeaveBalance::forEmployee(…, current year) }`.

### 1.6 Routes

```php
$auth = [AuthMiddleware::class];
$hr = [AuthMiddleware::class, HrMiddleware::class];

$router->add('POST', '/api/v1/auth/login', [AuthController::class, 'login']);
$router->add('GET', '/api/v1/me', [AuthController::class, 'me'], $auth);
```

### ✅ Test

```bash
curl -s -X POST http://hr.localhost/api/v1/auth/login -H 'Content-Type: application/json' \
     -d '{"email":"you@company.test","password":"…"}'                       # 200 with a token
TOKEN=…
curl -i -H "Authorization: Bearer $TOKEN" http://hr.localhost/api/v1/me     # user + 2 balances, no password_hash
curl -i http://hr.localhost/api/v1/me                                       # 401
```

**Now switch the frontend to your backend** (last section) — login works from here on.

---

## Phase 2 — Employees (#3, #4, #5) — all `$hr`

**#3 `index`** — `search` matches `CONCAT(first_name, ' ', last_name)`, `email` or `employee_code` with `LIKE`;
`status` filter (`active` default, `all` = none); `ORDER BY last_name, first_name`; paginated
(`COUNT(*)` + `LIMIT :limit OFFSET :offset` bound with `PDO::PARAM_INT`). Build `WHERE` from a list:

```php
$conditions = [];
$params = [];
if ($status !== 'all') { $conditions[] = 'status = :status'; $params['status'] = $status; }
if ($search !== '') { $conditions[] = '(CONCAT(first_name, " ", last_name) LIKE :search OR email LIKE :search OR employee_code LIKE :search)'; $params['search'] = "%{$search}%"; }
$where = $conditions ? 'WHERE ' . implode(' AND ', $conditions) : '';
```

**#4 `store`** — validate all fields (`role` in `hr`/`employee`, `password` ≥ 8, valid email and date) → 422;
code or email taken → 409. Save `strtoupper(code)`, `strtolower(email)`, `password_hash($password, PASSWORD_DEFAULT)`. 201.

**#5 `update`** — 404 if unknown. Only validate fields that were sent (`$request->has()`); `employee_code` is
ignored; `password` resets when sent. Rules: email taken by someone else → 409; changing your own `role` → 409;
`status` other than `terminated` → 422; terminating yourself or an already terminated employee → 409;
`termination_date` required and ≥ hire date → 422.

Terminating touches three tables — your **transaction**:

```php
$pdo = Database::connection();
$pdo->beginTransaction();
try {
    // UPDATE employees SET status = 'terminated', termination_date = ? WHERE id = ?
    // DELETE FROM auth_tokens WHERE employee_id = ?
    // UPDATE leave_requests SET status = 'cancelled',
    //        review_comment = 'Cancelled automatically: employee terminated.'
    //  WHERE employee_id = ? AND (status = 'pending' OR (status = 'approved' AND start_date > ?))
    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    throw $e;
}
```

### ✅ Test

Add an employee (201), same email again (409), empty body (422 with several fields), search, edit a job title,
log in as the new employee and call `GET /employees` (403), terminate them (200), log in again (401).

---

## Phase 3 — Holidays (#9)

`Holiday` model: `forYear(int)`, `datesBetween(string $from, string $to): list<string>`.
`HolidayController::index` (`$auth`): `?year` defaults to the current year, sorted by date, not paginated.

Test: `GET /holidays?year=2026` lists the 6 seeded holidays.

---

## Phase 4 — Leave (#6, #7, #8) — all `$auth`

### 4.1 `src/Services/WorkingDays.php`

Pure functions — no SQL, no HTTP; pass the holiday dates in.

```php
final class WorkingDays
{
    /** Mon–Fri days from $start to $end (inclusive) that are not holidays. */
    public static function count(string $start, string $end, array $holidays): int { /* loop with DateTimeImmutable */ }

    /** The date $days working days after $from. */
    public static function add(string $from, int $days, array $holidays): string { /* … */ }
}
```

Check it alone: `php -r 'require "vendor/autoload.php"; var_dump(App\Services\WorkingDays::count("2026-11-23", "2026-11-27", ["2026-11-26"]));'` → `int(4)`.

### 4.2 `LeaveRequest` model

`find`, `create`, `update`, `hasOverlap(employeeId, start, end)` (`status IN ('pending','approved') AND
start_date <= :end AND end_date >= :start`), `paginate(filters)` (join `employees` for the summary and again,
as `LEFT JOIN`, for the reviewer), static `present(array $row)`.

### 4.3 #6 `index`

`$user['role'] === 'employee'` → force `employee_id = $user['id']` (ignore the query). HR may pass `employee_id`.
Filters `status`, `from`/`to` (`end_date >= :from AND start_date <= :to`). HR with `status=pending`: oldest
first; otherwise newest first. Paginated.

### 4.4 #7 `store` — check in this exact order

1. `type` in `LeavePolicy::TYPES`, valid `start_date`/`end_date` → 422.
2. Load holidays (`datesBetween(start − 7 days, end + 10 days)` covers both rules).
3. **Planned:** `min_notice_days > 0` and `start < WorkingDays::add(today, min_notice_days, holidays)` → 422 on
   `start_date` ("Annual leave must be requested at least 3 working days ahead (from 2026-11-12).").
4. **Unplanned / past:** `start < today − max_backdate_days` → 422 on `start_date`.
5. `end < start`, different years, or `WorkingDays::count() === 0` → 422 on `end_date`.
6. `hasOverlap` → `422 OVERLAPPING_REQUEST`.
7. `days > remaining` (from `LeaveBalance`) → `422 INSUFFICIENT_BALANCE`.
8. Insert `pending` with the calculated `days` → 201.

### 4.5 #8 `update`

1. Find it. Not found, **or** an employee touching someone else's request → 404.
2. `status` must be `approved`, `rejected` or `cancelled` (422); `rejected` needs `comment` (422).
3. **`cancelled`:** only the owner (403). Allowed if `pending`, or `approved` with `start_date > today`;
   otherwise 409.
4. **`approved` / `rejected`:** only HR (403), never their own request (403), only from `pending` (409).
   Approving re-checks the balance (422 `INSUFFICIENT_BALANCE`). Set `reviewed_by`, `reviewed_at`, `review_comment`.
5. Return 200 with the request.

### 4.6 Routes

```php
$router->add('GET', '/api/v1/leave-requests', [LeaveController::class, 'index'], $auth);
$router->add('POST', '/api/v1/leave-requests', [LeaveController::class, 'store'], $auth);
$router->add('PATCH', '/api/v1/leave-requests/{id}', [LeaveController::class, 'update'], $auth);
```

### ✅ Test

As an employee: annual leave for tomorrow (422), the Thanksgiving week (`days` 4), sick leave 3 days ago (201),
10 days ago (422), overlapping dates (422), too many days (422). As HR: approve (200), approve again (409),
reject without comment (422), approve your own (403). As the employee: cancel approved future leave (200),
then `GET /me` shows the days back.

---

## Connecting the frontend

1. `frontend/.env.development.local` → `VITE_USE_MOCKS=false`.
2. Restart `npm run dev`.
3. Log in with the HR user you created.

Pages whose endpoints don't exist yet show an error until you build them. Compare your JSON with `API.md` in
the browser's DevTools → Network tab.

## Checklist

- [ ] Every SQL value uses a placeholder; only fixed fragments (like `$where`) are put into SQL strings.
- [ ] `password_hash` never appears in a response; only token hashes are stored.
- [ ] `/auth/login` is the only route without `AuthMiddleware`; HR routes also have `HrMiddleware`.
- [ ] Responses match `API.md` exactly (ints are ints, `null` not `""`); errors never show PHP or SQL.
- [ ] Terminating runs in a transaction.
- [ ] Every rule in `REQUIREMENTS.md` was tried with `curl`, failures included.

## Common mistakes

| Symptom | Cause |
|---|---|
| Empty 500 page | PHP error before the `try` — see `/var/log/apache2/hr.localhost-error.log` |
| `Class "App\…" not found` | Namespace ≠ folder, or file name ≠ class name (case matters on Linux) |
| SQL error near `LIMIT` | LIMIT/OFFSET bound as strings — use `PDO::PARAM_INT` |
| Token always "expired" | Compared with MySQL `NOW()` in another timezone — pass PHP's time |
| `bearerToken()` is null | Apache dropped the header — tell me and we'll adjust the vhost |
| `CHECK constraint … is violated` | PHP validation missed a rule the database also enforces — add it to PHP |
