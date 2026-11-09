<?php

declare(strict_types=1);

namespace App\Config;

use RuntimeException;

/** Reads KEY=value lines from the .env file. */
final class Env
{
    /** @var array<string, string> */
    private static array $values = [];

    public static function load(string $file): void
    {
        if (!is_file($file)) {
            throw new RuntimeException("Missing .env file: {$file}");
        }
        foreach (file($file, FILE_IGNORE_NEW_LINES) as $line) {
            $line = trim($line);
            if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
                continue;
            }
            [$key, $value] = explode('=', $line, 2);
            self::$values[trim($key)] = trim(trim($value), "\"'");
        }
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        return self::$values[$key] ?? $default;
    }
}
