<?php

declare(strict_types=1);

namespace App\Models;

use App\Config\Database;

final class LeaveRequest
{
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
