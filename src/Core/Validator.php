<?php

declare(strict_types=1);

namespace App\Core;

use DateTimeImmutable;

final class Validator
{
    private array $errors = [];

    public function __construct(private Request $request)
    {
    }

    public function requiredString(string $field, string $label, int $maxLength = 255): ?string
    {
        $value = $this->request->input($field);

        if ($value === null || (is_string($value) && trim($value) === '')) {
            $this->add($field, "The {$label} field is required.");
            return null;
        }

        if (!is_string($value)) {
            $this->add($field, "The {$label} field must be a string.");
            return null;
        }

        if (strlen($value) > $maxLength) {
            $this->add($field, "The {$label} field must be at most {$maxLength} bytes.");
            return null;
        }

        // Keep the original value because spaces can be part of a password.
        return $value;
    }

    public function add(string $field, string $message): void
    {
        $this->errors[$field][] = $message;
    }

    public function throwIfFailed(): void
    {
        if ($this->errors !== []) {
            throw new HttpException(422, 'VALIDATION_ERROR', 'The given data was invalid.', $this->errors);
        }
    }

    public static function isDate(string $value): bool
    {
        if (!preg_match('/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/D', $value)) {
            return false;
        }

        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);

        return $date !== false && $date->format('Y-m-d') === $value;
    }
}
