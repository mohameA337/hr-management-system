<?php

declare(strict_types=1);

namespace App\Models;

use App\Config\Database;

final class Employee
{
    public static function findByEmail(string $email): ?array
    {
        $statement = Database::connection()->prepare('SELECT * FROM employees WHERE email = ?');
        $statement->execute([$email]);
        $employee = $statement->fetch();

        return $employee === false ? null : $employee;
    }

    public static function find(int $id): ?array
    {
        $statement = Database::connection()->prepare('SELECT * FROM employees WHERE id = ?');
        $statement->execute([$id]);
        $employee = $statement->fetch();

        return $employee === false ? null : $employee;
    }

    public static function touchLastLogin(int $id, string $loggedInAt): void
    {
        $statement = Database::connection()->prepare('UPDATE employees SET last_login_at = ? WHERE id = ?');
        $statement->execute([$loggedInAt, $id]);
    }

    public static function present(array $employee): array
    {
        return [
            'id' => (int) $employee['id'],
            'employee_code' => $employee['employee_code'],
            'first_name' => $employee['first_name'],
            'last_name' => $employee['last_name'],
            'full_name' => $employee['first_name'] . ' ' . $employee['last_name'],
            'email' => $employee['email'],
            'phone' => $employee['phone'],
            'job_title' => $employee['job_title'],
            'department' => $employee['department'],
            'hire_date' => $employee['hire_date'],
            'status' => $employee['status'],
            'termination_date' => $employee['termination_date'],
            'role' => $employee['role'],
            'last_login_at' => $employee['last_login_at'],
        ];
    }
}
