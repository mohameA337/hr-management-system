<?php

declare(strict_types=1);

namespace App\Services;

use App\Config\LeavePolicy;
use App\Models\LeaveRequest;

final class LeaveBalance
{
    public static function forEmployee(int $employeeId, int $year): array
    {
        $balances = [];

        foreach (LeavePolicy::TYPES as $type => $policy) {
            $usedDays = LeaveRequest::approvedDays($employeeId, $type, $year);

            $balances[] = [
                'type' => $type,
                'name' => $policy['name'],
                'year' => $year,
                'days_per_year' => $policy['days_per_year'],
                'used_days' => $usedDays,
                'remaining_days' => $policy['days_per_year'] - $usedDays,
                'min_notice_days' => $policy['min_notice_days'],
                'max_backdate_days' => $policy['max_backdate_days'],
            ];
        }

        return $balances;
    }
}
