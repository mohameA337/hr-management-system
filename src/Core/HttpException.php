<?php

declare(strict_types=1);

namespace App\Core;

use RuntimeException;


final class HttpException extends RuntimeException
{
    /**
     * @param int    $status    HTTP status code: 400, 401, 403, 404, 409, 422 ...
     * @param string $errorCode Text code for the frontend: 'NOT_FOUND', 'VALIDATION_ERROR' ...
     *                          (named $errorCode, not $code: Exception already has an int $code)
     * @param string $message   Human-readable message shown to the user
     * @param array<string, string[]> $details Field errors, only for VALIDATION_ERROR,
     *                          e.g. ['email' => ['The email field is required.']]
     */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly array $details = [],
    ) {
        parent::__construct($message); // Exception stores the message; read it with getMessage()
    }

    // Shortcuts for errors we throw often, so we don't repeat status + code every time.

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
