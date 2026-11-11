# HR backend learning backlog

Check off each task after you can explain the code and reproduce its expected result. Work through one numbered task at a time. Open the [API contract](API.md) for response shapes, the [requirements](REQUIREMENTS.md) for business rules, the [database design](DATABASE.md) for columns and constraints, and the [backend guide](BACKEND_GUIDE.md) for existing examples. Paths below start at the repository root.

**Start with task 1A, `Validator::requiredString()`.** Phase 0 passed all three HTTP smoke tests through Apache at `hr.localhost`.

## 0. Foundation checkpoint

- [x] `public/index.php` loads settings, registers routes, dispatches, catches HTTP errors, and sends the response.
- [x] `src/Core/Request.php` reads method, path, query string, headers, and JSON body.
- [x] `src/Core/Router.php` matches method and path, attaches route parameters, and calls middleware and a controller.
- [x] `src/Core/HttpException.php` carries the HTTP status, API error code, and optional field errors.
- [x] `src/Core/Response.php` sends JSON, including success, pagination, and error envelopes.
- [x] `src/routes.php` registers the diagnostic route served by `src/Controllers/HealthController.php`.
- [x] Verify health, unknown route, and malformed JSON through Apache at `hr.localhost`.

Run these in Bash. `curl -i` shows both the HTTP headers and body. `-H` sets a request header, and `-d` sends a body and defaults to POST.

```bash
API=http://hr.localhost/api/v1
curl -i "$API/health"                                             # 200, data.status is "ok"
curl -i "$API/does-not-exist"                                     # 404 NOT_FOUND
curl -i -H 'Content-Type: application/json' -d '{bad' "$API/does-not-exist" # 400 BAD_REQUEST
```

For local PHP-only testing, run `/usr/bin/php -S 127.0.0.1:8080 -t public public/index.php` in a second terminal and set `API=http://127.0.0.1:8080/api/v1` in the curl terminal. This exercises the PHP request flow. Use Apache for the final Vite integration.

## 1. Login, permissions, and the current employee

### 1A. Create `src/Core/Validator.php`

A controller needs a consistent way to check inputs and return all field errors together. Start with one string rule and expand the class when later endpoints need more rules.

- [ ] Give the validator a `Request` and an initially empty field-error array.
- [ ] Implement `requiredString(string $field, string $label, int $maxLength = 255): ?string`. Read the field with `$request->input($field)`. Use `is_string()` before calling any string function. Use `trim($value) === ''` to detect blank input. For a missing or blank email, collect `['email' => ['The email field is required.']]`. Return `null` when invalid. Keep the original valid value so login passwords retain any intentional spaces. Normalize fields such as email separately.
- [ ] Check lengths for fields with a defined limit. `strlen()` measures bytes. Where a rule measures UTF-8 characters, `mb_strlen($value, 'UTF-8')` counts characters if the mbstring extension is installed. Keep the unit consistent with the field's rule.
- [ ] Implement `add($field, $message)` and `throwIfFailed()`. Appending to `$errors[$field][]` preserves multiple messages for one field. If errors exist, throw `HttpException(422, 'VALIDATION_ERROR', 'The given data was invalid.', ...)` with your error array as the fourth argument.
- [ ] Check email format for a valid required string. `filter_var($email, FILTER_VALIDATE_EMAIL)` returns the email on success and `false` on failure. Check for `=== false` and avoid adding a format error when the required check already failed.

**First practice:** Trace missing, numeric, blank, and valid email values by hand. Predict the return value and the error array for each. The first curl checkpoint comes in 1D, when a controller calls this file. Bring this one method back for review before moving on.

### 1B. Create `src/Models/Employee.php`

The model owns employee SQL. Login needs a database row with the password hash, while API responses need an explicit list of public employee fields.

- [ ] Add `findByEmail(string $email): ?array` and `find(int $id): ?array` using the existing `Database::connection()`. PDO's `prepare()` creates a statement with placeholders, `execute()` supplies their values, and `fetch()` reads one row. Translate `false` from `fetch()` into `null`.
- [ ] Add `touchLastLogin(int $id)` to update `last_login_at` using the application clock.
- [ ] Add `present(array $row): array`. Build the fields from [the Employee response object](API.md#3-objects), including `full_name` and nullable fields. Return IDs as integers. Leave the password hash out of the response.
- [ ] Try a known local employee and a missing email. Check for a row versus `null`. If you use the CLI to inspect results, print only the ID or whether a row was found.

### 1C. Create `src/Models/AuthToken.php`

The browser keeps the raw token. This model stores and looks up the hash, so an authentication check can identify the employee.

- [ ] Add `create($employeeId, $hash, $expiresAt)` to insert a token record.
- [ ] Add `findEmployeeId($hash, $now): ?int`. Match the hash and require `expires_at > $now`. The strict comparison means a token expires exactly at its deadline. Use a timestamp from PHP in the same timezone used to write the expiry.
- [ ] Keep a database failure visible to the caller as an exception. The HTTP error handler can turn it into a generic server error.

### 1D. Create `src/Controllers/AuthController.php` and register login in `src/routes.php`

The controller connects input validation, employee lookup, password verification, and token creation. This is your first application endpoint.

- [ ] In `login(Request $request): Response`, collect email and password errors, then call `throwIfFailed()` before any lookup.
- [ ] Read the employee by email. For an unknown email, an inactive employee, or a wrong password, return the same `401 UNAUTHENTICATED` with the contract message. `password_verify($password, $hash)` returns a boolean after checking the password against the stored hash.
- [ ] Generate a token with `bin2hex(random_bytes(32))`. The first function converts bytes to a printable 64-character hex string. The second supplies secure random bytes. Store `hash('sha256', $token)` with an expiry eight hours ahead.
- [ ] Update the last login and make sure the returned employee reflects it. Consider one PDO transaction for the token insert and login timestamp update, so both succeed or both roll back.
- [ ] Return the raw token, expiry, and public employee object with `Response::data()`. Register `POST /api/v1/auth/login` without authentication middleware.

```bash
curl -i -H 'Content-Type: application/json' -d '{}' "$API/auth/login"
curl -i -H 'Content-Type: application/json' \
  -d '{"email":"nobody@example.test","password":"test-only"}' "$API/auth/login"
```

Expect `422 VALIDATION_ERROR` with email and password in `error.details` for the first request, and `401 UNAUTHENTICATED` for the second. Repeat with your local test account to get `200`, a token, an expiry, and a user object. Keep real credentials and tokens out of Git and shared output. Commit login once it works.

### 1E. Create `src/Middleware/AuthMiddleware.php` and `src/Middleware/HrMiddleware.php`

Write these one at a time. The first establishes who is making the request. The second checks whether that employee has the HR role.

- [ ] In `AuthMiddleware::handle(Request $request)`, read `bearerToken()`. Reject a missing, unrecognized, or expired token with `401`. Hash a supplied token before looking it up. Load the associated employee and require active status before calling `setUser()`.
- [ ] In `HrMiddleware::handle(Request $request)`, read the established user and throw `HttpException::forbidden()` unless their role is `hr`.
- [ ] Register authentication before the HR check on HR-only routes. Test authentication in 1G and the HR check in 2A.

### 1F. Create `src/Config/LeavePolicy.php` and `src/Services/LeaveBalance.php`

The policy defines allowances and date rules in one place. The service uses those allowances and approved days to calculate what's left for a given year.

- [ ] In `LeavePolicy.php`, define the two types with the contract values. Annual has 21 days, 3 working days' notice and 0 backdating days. Sick has 10 days, 0 notice days and 7 backdating days.
- [ ] Start `src/Models/LeaveRequest.php` with one query method for approved days by employee, type, and year. Follow [the documented balance query](DATABASE.md#4-leave_requests). SQL's `SUM(days)` adds matching days and `COALESCE(..., 0)` produces zero when no rows match.
- [ ] In `LeaveBalance::forEmployee($id, $year)`, read that total per leave type, subtract it from the allowance, and return the fields in the contract. A pending request uses zero approved days. A cancelled request also drops out of the approved total.

### 1G. Add `AuthController::me()` and register the route

- [ ] Read the authenticated employee from `$request->user()`, format the public profile, and include both balances for the current application year. `date('Y')` gives the year as a string, so cast it to `int` for an integer parameter.
- [ ] Register `GET /api/v1/me` with authentication. Put the local test token in a shell variable named `TOKEN`.

```bash
curl -i "$API/me"                                      # 401
curl -i -H "Authorization: Bearer $TOKEN" "$API/me"     # 200
```

Check the employee object and both balance entries. A test employee with zero approvals has 21 annual days and 10 sick days. Repeat with a bogus token and an expired test token for `401`. If a valid token is invisible in PHP, check Apache's forwarding of the Authorization header. Commit after these checks.

## 2. Employee management

For the checks from here on, log in with a disposable HR account and an employee account. Put their returned tokens in `HR_TOKEN` and `EMP_TOKEN` in the curl terminal. If you only have HR initially, run the HR checks first, create the test employee in 2B, then come back to the employee permission check.

### 2A. Add employee listing to `Employee.php`, then create `src/Controllers/EmployeeController.php`

SQL finds the matching rows and counts them. The controller validates query parameters, calls the model, and builds the paginated HTTP response.

- [ ] In the model, write the basic list for active employees first. Add the `terminated` and `all` filters. Then search name, email, and employee code. With this project's native PDO prepares, use a distinct placeholder for each occurrence of the search value.
- [ ] Add matching `COUNT(*)` and page queries. Bind `LIMIT` and `OFFSET` with `PDO::PARAM_INT`, which tells PDO to send integer values. Offset is `(page - 1) * per_page`. Sort by last name, with a stable tie-breaker such as ID.
- [ ] In `index()`, read `page`, `per_page`, `search`, and `status`. Apply the contract's defaults and 100-row cap. Map every row through `Employee::present()` and use `Response::paginated()` with the documented metadata.
- [ ] Register `GET /api/v1/employees` with auth then HR middleware.

```bash
curl -i -H "Authorization: Bearer $HR_TOKEN" "$API/employees?status=all&search=sara&page=1&per_page=2"
curl -i -H "Authorization: Bearer $EMP_TOKEN" "$API/employees"
```

Expect `200` with matching rows and metadata for HR, `403` for a regular employee, and `401` without a token. Search for a value with no matches and check that `data` is an empty list.

### 2B. Add employee creation

- [ ] Extend `Validator.php` with only the rules needed here. Use `DateTimeImmutable::createFromFormat('!Y-m-d', $value)` to parse a date. Compare `format('Y-m-d')` with the original input because PHP can roll invalid calendar dates into the next month. Check allowed roles with `in_array($role, ['hr', 'employee'], true)`, where the third argument enforces strict comparison.
- [ ] Add an insert method to `Employee.php`. Use fixed columns and placeholders. Handle duplicate email and employee code as `409 CONFLICT`, including a duplicate reported by MySQL after a concurrent insert. Let unrelated database failures surface normally.
- [ ] Add `EmployeeController::store()`. Validate the documented fields, normalize the code and email, and hash the initial password with `password_hash($password, PASSWORD_DEFAULT)`. Return the saved public employee with `201`. Register HR-only `POST /api/v1/employees`.
- [ ] Send the create payload from API section 4.3 with `curl -i -H "Authorization: Bearer $HR_TOKEN" -H 'Content-Type: application/json' -d @employee.json "$API/employees"`. Use disposable local test data in `employee.json`. Expect `201`, then `409` for the same payload, and `422` with field errors for `{}`. Log in with the new account and verify its HR restriction. Commit listing and creation when verified.

### 2C. Add partial updates, then termination

- [ ] Add a model update method using a fixed list of permitted columns. Bind values via PDO. Reuse the create rules for fields that were sent. Use `$request->has('phone')` to distinguish an omitted phone from an explicit `null` that clears it. A payload containing only ignored fields should leave the employee unchanged.
- [ ] In `EmployeeController::update()`, read the numeric route ID and return `404` for an unknown employee. Apply the documented duplicate and self-role-change rules. Accept a password reset and hash the new password. Ignore employee code per the guide. Register HR-only `PATCH /api/v1/employees/{id}`.
- [ ] Add termination after ordinary PATCH works. Require the termination date to be on or after the effective hire date. Reject self-termination and repeated termination with `409`; reject unsupported status values with `422`.
- [ ] Use one PDO transaction and the same connection for the employee update, token deletion, and leave cancellation. Add the token delete to `AuthToken.php` and cancellation SQL to `LeaveRequest.php`. Cancel pending leave and approved leave starting strictly after the termination date. Save the documented automatic comment. `beginTransaction()` starts the group, `commit()` saves it, and `rollBack()` undoes its writes on failure.
- [ ] Start with the request below. Expect `200` and the updated title. Test clearing phone, changing your own role (`409`), a termination date before hire (`422`), then terminating a disposable account (`200`). Retry that employee's old token and credentials and expect `401`. Repeat the leave-cancellation checks in phase 4 when test leave records can be created through the API.

```bash
curl -i -X PATCH -H "Authorization: Bearer $HR_TOKEN" \
  -H 'Content-Type: application/json' -d '{"job_title":"Backend Developer"}' "$API/employees/$EMP_ID"
```

Here `-X PATCH` sets the method explicitly and `EMP_ID` is the ID returned by employee creation. Commit after verification.

## 3. Public holidays

- [ ] Create `src/Models/Holiday.php`. Implement `forYear(int $year)` for date-ordered rows, then `datesBetween($from, $to)` for the inclusive range of date strings used by leave calculations. Bind both range limits.
- [ ] Create `src/Controllers/HolidayController.php`. Read the year query string, default to the current application year when absent, and validate before converting it to an integer. Check how the API should handle an invalid year before choosing an error response, since the contract gives a default but no explicit invalid-year status. Format the ID, date, and name and return a plain list in `data`.
- [ ] Register authenticated `GET /api/v1/holidays`. Run `curl -i -H "Authorization: Bearer $TOKEN" "$API/holidays?year=2026"` and expect `200` with date-ordered seed rows. Try an unseeded year for an empty list and no token for `401`. Commit.

## 4. Leave requests

### 4A. Create `src/Services/WorkingDays.php`

This service takes dates and a holiday list. Keeping it independent of SQL makes it easy to check calendar rules in isolation.

- [ ] Write `count($start, $end, $holidays)` for an inclusive range. Walk one day at a time with `DateTimeImmutable`. Its `modify('+1 day')` returns a new date object. `format('N')` gives ISO weekday numbers 1 through 7. Count Monday through Friday when the date isn't in the holiday list.
- [ ] Write `add($from, $days, $holidays)` for advance notice. Start counting after `$from`. Reuse the working-day check so the two methods agree.
- [ ] Check a weekday range, a weekend, a weekday holiday, and adding three working days across a weekend. Run this example and expect `int(4)`.

```bash
/usr/bin/php -r 'require "vendor/autoload.php"; var_dump(App\Services\WorkingDays::count("2026-11-23", "2026-11-27", ["2026-11-26"]));'
```

### 4B. Extend `src/Models/LeaveRequest.php` and create `src/Controllers/LeaveController.php` for listing

- [ ] Add pagination and a presenter. Join the request owner, and use a `LEFT JOIN` for the reviewer so a pending request with no reviewer still appears. Map the row to the API's nested employee and reviewer objects.
- [ ] In `LeaveController::index()`, force the employee filter to the logged-in employee for regular employees. HR can request a specific employee or see everyone. Use matching count and list filters. Date ranges overlap when `end_date >= from` and `start_date <= to`. Sort HR's pending queue oldest first, and other lists newest first.
- [ ] Register authenticated `GET /api/v1/leave-requests`. Expect `200` with `data` and `meta`, including when the list is empty. Once records exist, request another employee's ID as a regular employee and verify you still receive only your own rows. Use two disposable accounts for this check. Verify that HR can filter by that ID.

```bash
curl -i -H "Authorization: Bearer $EMP_TOKEN" "$API/leave-requests?employee_id=$OTHER_EMP_ID"
curl -i -H "Authorization: Bearer $HR_TOKEN" "$API/leave-requests?employee_id=$OTHER_EMP_ID&status=pending"
```

### 4C. Add leave submission

- [ ] Add `hasOverlap($employeeId, $start, $end)` to the model. Compare the proposed dates against pending or approved requests. An overlap exists when the existing start is on or before the proposed end and the existing end is on or after the proposed start.
- [ ] Add `create()` to insert a pending request with the server-calculated day count. Read back the created request in its public response shape.
- [ ] Implement `LeaveController::store()`. Follow [the contract's exact validation order](API.md#7-post-leave-requests): validate type and dates, check annual notice, check backdating, check range and working days, check overlap, then check the balance for the requested year. Use the authenticated employee ID for the insert. Validate the optional reason against the schema's length.
- [ ] Keep checks that depend on existing rows and the insert in one transaction. For concurrent submissions, coordinate on the same employee row before checking overlap. MySQL's `SELECT ... FOR UPDATE` takes a row lock until that transaction ends. Use the same employee-first locking order when adding approval and termination.
- [ ] Register authenticated `POST /api/v1/leave-requests`. Save a test payload with `type`, `start_date`, and `end_date` in `leave.json`. Choose dates relative to your app's current date, with a working day and enough notice.

```bash
curl -i -H "Authorization: Bearer $EMP_TOKEN" -H 'Content-Type: application/json' \
  -d @leave.json "$API/leave-requests"
```

Expect `201` with `pending` and the calculated days. Repeat the payload and expect `422 OVERLAPPING_REQUEST`. Also try too little notice, sick leave more than seven days back, a weekend-only range, a cross-year range, and a range longer than the available balance. Check the code and field details against the contract. Confirm the pending request leaves `/me` balances unchanged.

### 4D. Add leave approval, rejection, and cancellation

- [ ] Add lookup and update methods to the model. Keep the expected prior status in the update condition and check whether the row changed. A request may have been updated since you read it.
- [ ] In `LeaveController::update()`, check visibility first. Return `404` for unknown IDs or when a regular employee accesses someone else's record. Validate the target status and require a nonblank comment on rejection.
- [ ] For cancellation, require ownership. Allow pending requests and approved requests with a start strictly after today. For approval or rejection, require HR, prohibit reviewing one's own request, and require pending status.
- [ ] When approving, lock and recheck the employee's balance in the same transaction as the status update. Write reviewer, review timestamp, and comment for approval or rejection. Read back the updated record and return `200`.
- [ ] Register authenticated `PATCH /api/v1/leave-requests/{id}`. With a test request ID in `LEAVE_ID`, verify the approval path first.

```bash
curl -i -X PATCH -H "Authorization: Bearer $HR_TOKEN" \
  -H 'Content-Type: application/json' -d '{"status":"approved"}' "$API/leave-requests/$LEAVE_ID"
```

Expect `200` on approval and `409` on a second approval. Check that approval reduces the balance, then cancel as the owner before the start and check that the days return. Use separate pending requests to test rejection without a comment (`422`), valid rejection (`200`), HR reviewing their own request (`403`), and an employee accessing another employee's request (`404`). Revisit the termination tests with both pending and approved leave on either side of the termination date. Commit after verification.

## 5. React integration and final pass

- [ ] In `frontend/.env.development.local`, set `VITE_USE_MOCKS=false` and restart the Vite dev server. Its proxy targets `http://hr.localhost`; confirm the Apache URL works first.
- [ ] Use the browser Network tab to check status, JSON, and Authorization headers. Log in as HR, create a disposable employee, log in as that employee, submit leave, and approve it as HR. Verify the updated balance in the employee view.
- [ ] Check that employees cannot use HR routes, terminated accounts cannot access protected routes, and API JSON keeps passwords, stored hashes, and SQL errors private. Verify logout clears the browser token.
- [ ] Compare the nine application routes in `src/routes.php` against the contract. Review `git diff` and `git status` for accidental test payloads, tokens, and credentials. Commit the verified integration changes.

## When a check fails

| Symptom | First thing to inspect |
|---|---|
| curl cannot connect | Check the URL and whether Apache or the local PHP server is listening. |
| HTML response instead of JSON | Check whether Apache sent the request to `public/index.php`; look at the server error log for startup or PHP errors. |
| JSON `404` on a new route | Compare HTTP method, full `/api/v1` path, and registration in `src/routes.php`. |
| `400 BAD_REQUEST` | Check your shell quoting or payload file. PHP parses the body before routing. |
| `422 VALIDATION_ERROR` | Read `error.details` and compare the exact field names and values with the contract. |
| `401` with a fresh token | Check the Bearer header, whether PHP sees it, the token hash lookup, expiry, and employee status. |
| `500 SERVER_ERROR` | Read the PHP/Apache error log, then reproduce with the smallest request. The client response deliberately keeps the internal error private. |

After each milestone, write down the endpoint tested, the expected status, and what actually happened. Review the diff before committing and keep the commit scoped to the working milestone.
