<?php

declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

final class LeaveRequest
{
    private const SELECT_WITH_PEOPLE = "SELECT l.*, e.employee_code,
               CONCAT(e.first_name, ' ', e.last_name) AS employee_name,
               r.employee_code AS reviewer_code,
               CONCAT(r.first_name, ' ', r.last_name) AS reviewer_name
        FROM leave_requests l
        JOIN employees e ON e.id = l.employee_id
        LEFT JOIN employees r ON r.id = l.reviewed_by";

    public static function paginate(
        ?string $employeeId,
        ?string $status,
        ?string $from,
        ?string $to,
        bool $oldestFirst,
        int $page,
        int $perPage,
    ): array {
        $conditions = [];
        $values = [];
        foreach ([
            'l.employee_id = :employee' => ['employee', $employeeId],
            'l.status = :status' => ['status', $status],
            'l.end_date >= :from_date' => ['from_date', $from],
            'l.start_date <= :to_date' => ['to_date', $to],
        ] as $condition => [$key, $value]) {
            if ($value !== null) {
                $conditions[] = $condition;
                $values[$key] = $value;
            }
        }

        $where = $conditions === [] ? '' : ' WHERE ' . implode(' AND ', $conditions);
        $pdo = Database::connection();
        $count = $pdo->prepare('SELECT COUNT(*) FROM leave_requests l' . $where);
        $count->execute($values);

        $order = $oldestFirst ? ' ORDER BY l.created_at, l.id' : ' ORDER BY l.created_at DESC, l.id DESC';
        $statement = $pdo->prepare(self::SELECT_WITH_PEOPLE . $where . $order . ' LIMIT :limit OFFSET :offset');
        foreach ($values as $key => $value) {
            $statement->bindValue(':' . $key, $value);
        }
        $statement->bindValue(':limit', $perPage, PDO::PARAM_INT);
        $statement->bindValue(':offset', ($page - 1) * $perPage, PDO::PARAM_INT);
        $statement->execute();

        $rows = [];
        foreach ($statement->fetchAll() as $row) {
            $rows[] = self::present($row);
        }

        return ['rows' => $rows, 'total' => (int) $count->fetchColumn()];
    }

    public static function find(int $id): ?array
    {
        $statement = Database::connection()->prepare(self::SELECT_WITH_PEOPLE . ' WHERE l.id = ?');
        $statement->execute([$id]);
        $row = $statement->fetch();

        return $row === false ? null : self::present($row);
    }

    public static function hasOverlap(int $employeeId, string $start, string $end): bool
    {
        $statement = Database::connection()->prepare(
            "SELECT id FROM leave_requests
             WHERE employee_id = ? AND status IN ('pending', 'approved')
               AND start_date <= ? AND end_date >= ? LIMIT 1"
        );
        $statement->execute([$employeeId, $end, $start]);

        return $statement->fetchColumn() !== false;
    }

    public static function create(int $employeeId, string $type, string $start, string $end, int $days, ?string $reason): int
    {
        $pdo = Database::connection();
        $statement = $pdo->prepare(
            'INSERT INTO leave_requests (employee_id, type, start_date, end_date, days, reason)
             VALUES (?, ?, ?, ?, ?, ?)'
        );
        $statement->execute([$employeeId, $type, $start, $end, $days, $reason]);

        return (int) $pdo->lastInsertId();
    }

    public static function cancel(int $id): void
    {
        $statement = Database::connection()->prepare("UPDATE leave_requests SET status = 'cancelled' WHERE id = ?");
        $statement->execute([$id]);
    }

    public static function review(int $id, string $status, int $reviewerId, ?string $comment, string $reviewedAt): void
    {
        $statement = Database::connection()->prepare(
            'UPDATE leave_requests SET status = ?, reviewed_by = ?, review_comment = ?, reviewed_at = ? WHERE id = ?'
        );
        $statement->execute([$status, $reviewerId, $comment, $reviewedAt, $id]);
    }

    private static function present(array $row): array
    {
        $reviewer = null;
        if ($row['reviewed_by'] !== null) {
            $reviewer = [
                'id' => (int) $row['reviewed_by'],
                'employee_code' => $row['reviewer_code'],
                'full_name' => $row['reviewer_name'],
            ];
        }

        return [
            'id' => (int) $row['id'],
            'employee' => [
                'id' => (int) $row['employee_id'],
                'employee_code' => $row['employee_code'],
                'full_name' => $row['employee_name'],
            ],
            'type' => $row['type'],
            'start_date' => $row['start_date'],
            'end_date' => $row['end_date'],
            'days' => (int) $row['days'],
            'reason' => $row['reason'],
            'status' => $row['status'],
            'reviewer' => $reviewer,
            'review_comment' => $row['review_comment'],
            'reviewed_at' => $row['reviewed_at'],
            'created_at' => $row['created_at'],
        ];
    }

    public static function cancelForTermination(int $employeeId, string $terminationDate): void
    {
        $statement = Database::connection()->prepare(
            "UPDATE leave_requests
             SET status = 'cancelled', review_comment = 'Cancelled automatically: employee terminated.'
             WHERE employee_id = ? AND (status = 'pending' OR (status = 'approved' AND start_date > ?))"
        );
        $statement->execute([$employeeId, $terminationDate]);
    }

    public static function approvedDays(int $employeeId, string $type, int $year): int
    {
        $statement = Database::connection()->prepare(
            "SELECT COALESCE(SUM(days), 0)
             FROM leave_requests
             WHERE employee_id = ? AND type = ? AND status = 'approved' AND YEAR(start_date) = ?"
        );
        $statement->execute([$employeeId, $type, $year]);

        return (int) $statement->fetchColumn();
    }
}
