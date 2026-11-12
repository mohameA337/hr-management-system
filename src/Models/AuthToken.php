<?php

declare(strict_types=1);

namespace App\Models;

use App\Config\Database;

final class AuthToken
{
    public static function deleteForEmployee(int $employeeId): void
    {
        $statement = Database::connection()->prepare('DELETE FROM auth_tokens WHERE employee_id = ?');
        $statement->execute([$employeeId]);
    }

    public static function create(int $employeeId, string $hash, string $expiresAt): void
    {
        $statement = Database::connection()->prepare(
            'INSERT INTO auth_tokens (employee_id, token_hash, expires_at) VALUES (?, ?, ?)'
        );
        $statement->execute([$employeeId, $hash, $expiresAt]);
    }

    public static function findEmployeeId(string $hash, string $now): ?int
    {
        $statement = Database::connection()->prepare(
            'SELECT employee_id FROM auth_tokens WHERE token_hash = ? AND expires_at > ?'
        );
        $statement->execute([$hash, $now]);
        $employeeId = $statement->fetchColumn();

        return $employeeId === false ? null : (int) $employeeId;
    }
}
