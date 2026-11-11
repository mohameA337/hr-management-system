<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Everything about the incoming HTTP request, read once from PHP's globals
 * ($_SERVER, $_GET, the raw body), so the rest of the code never touches them.
 */
final class Request
{
    /** Route parameters, e.g. ['id' => '5'] for /api/v1/employees/5 (set by the Router). */
    private array $params = [];

    /** The logged-in employee row (set by AuthMiddleware). */
    private ?array $user = null;

    /**
     * @param array<string, mixed>  $query   the ?key=value part
     * @param array<string, mixed>  $body    the decoded JSON body
     * @param array<string, string> $headers header names in lower case
     */
    private function __construct(
        private readonly string $method,
        private readonly string $path,
        private readonly array $query,
        private readonly array $body,
        private readonly array $headers,
    ) {
    }

    /** Builds the Request from the real HTTP request. Called once in index.php. */
    public static function fromGlobals(): self
    {
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';

        // JSON body: empty is fine (GET requests), but broken JSON is a 400.
        $body = [];
        $raw = file_get_contents('php://input');
        if ($raw !== false && trim($raw) !== '') {
            $body = json_decode($raw, true);
            if (!is_array($body)) {
                throw new HttpException(400, 'BAD_REQUEST', 'The request body must be valid JSON.');
            }
        }

        // Header names are case-insensitive in HTTP, so store them in lower case.
        $headers = array_change_key_case(getallheaders(), CASE_LOWER);

        return new self($method, $path, $_GET, $body, $headers);
    }

    public function method(): string
    {
        return $this->method;
    }

    public function path(): string
    {
        return $this->path;
    }

    /** One query parameter: ?status=active → query('status') === 'active'. */
    public function query(string $key, ?string $default = null): ?string
    {
        $value = $this->query[$key] ?? null;

        return is_string($value) ? $value : $default;
    }

    /** One field from the JSON body. */
    public function input(string $key, mixed $default = null): mixed
    {
        return $this->body[$key] ?? $default;
    }

    /** Was this field sent at all? Needed for PATCH: only change the fields that were sent. */
    public function has(string $key): bool
    {
        return array_key_exists($key, $this->body);
    }

    /** The whole JSON body (used by the Validator). */
    public function all(): array
    {
        return $this->body;
    }

    /** The token from "Authorization: Bearer <token>", or null if there is none. */
    public function bearerToken(): ?string
    {
        $header = $this->headers['authorization'] ?? '';
        if (preg_match('/^Bearer\s+(\S+)$/i', $header, $m) === 1) {
            return $m[1];
        }

        return null;
    }

    public function setParams(array $params): void
    {
        $this->params = $params;
    }

    /** A route parameter as int: /employees/{id} → param('id') === 5. */
    public function param(string $key): int
    {
        return (int) ($this->params[$key] ?? 0);
    }

    public function setUser(array $user): void
    {
        $this->user = $user;
    }

    /** The logged-in employee. Only call it on routes protected by AuthMiddleware. */
    public function user(): array
    {
        if ($this->user === null) {
            throw new \LogicException('No user: is AuthMiddleware on this route?');
        }

        return $this->user;
    }
}
