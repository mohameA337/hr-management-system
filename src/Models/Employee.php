<?php

declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

final class Employee
{
    public static function paginate(string $status, string $search, int $page, int $perPage): array
    {
        $conditions = [];
        $values = [];

        if ($status !== 'all') {
            $conditions[] = 'status = :status';
            $values['status'] = $status;
        }

        if ($search !== '') {
            $conditions[] = "(CONCAT(first_name, ' ', last_name) LIKE :name
                              OR email LIKE :email OR employee_code LIKE :code)";
            $pattern = '%' . $search . '%';
            $values['name'] = $pattern;
            $values['email'] = $pattern;
            $values['code'] = $pattern;
        }

        $where = $conditions === [] ? '' : ' WHERE ' . implode(' AND ', $conditions);
        $pdo = Database::connection();
        $count = $pdo->prepare('SELECT COUNT(*) FROM employees' . $where);
        $count->execute($values);

        $statement = $pdo->prepare(
            'SELECT * FROM employees' . $where . ' ORDER BY last_name, first_name, id LIMIT :limit OFFSET :offset'
        );
        foreach ($values as $key => $value) {
            $statement->bindValue(':' . $key, $value);
        }
        $statement->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $statement->bindValue(':offset', ($page - 1) * $perPage, PDO::PARAM_INT);
        $statement->execute();

        return ['rows' => $statement->fetchAll(), 'total' => (int) $count->fetchColumn()];
    }

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
