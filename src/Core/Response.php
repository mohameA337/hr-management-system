<?php

declare(strict_types=1);

namespace App\Core;

/**
 * One JSON response. Controllers return it, index.php sends it.
 *
 *     return Response::data($employee);              → 200 {"data": {...}}
 *     return Response::data($employee, 201);         → 201 {"data": {...}}
 *     return Response::paginated($items, $meta);     → 200 {"data": [...], "meta": {...}}
 *     Response::error($httpException)                → 4xx/5xx {"error": {...}}
 */
final class Response
{
    // private: a Response can only be made through the static methods below,
    // so every response has one of the shapes from docs/API.md.
    private function __construct(
        private readonly int $status,
        private readonly array $body,
    ) {
    }

    public static function data(mixed $data, int $status = 200): self
    {
        return new self($status, ['data' => $data]);
    }

    /** @param array{page: int, per_page: int, total: int, total_pages: int} $meta */
    public static function paginated(array $items, array $meta): self
    {
        return new self(200, ['data' => $items, 'meta' => $meta]);
    }

    public static function error(HttpException $e): self
    {
        $error = ['code' => $e->errorCode, 'message' => $e->getMessage()];

        // "details" only when there are field errors (VALIDATION_ERROR), as in docs/API.md.
        if ($e->details !== []) {
            $error['details'] = $e->details;
        }

        return new self($e->status, ['error' => $error]);
    }

    /** Writes the status code, the header and the JSON body. Called once, at the end of index.php. */
    public function send(): void
    {
        http_response_code($this->status);
        header('Content-Type: application/json; charset=utf-8');

        // UNESCAPED_SLASHES:  "a/b" instead of "a\/b"
        // UNESCAPED_UNICODE:  "é" instead of "é"
        // THROW_ON_ERROR:     throw instead of silently returning false
        echo json_encode($this->body, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
}
