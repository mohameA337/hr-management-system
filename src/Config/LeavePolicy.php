<?php

declare(strict_types=1);

namespace App\Config;

final class LeavePolicy
{
    public const TYPES = [
        'annual' => [
            'name' => 'Annual',
            'days_per_year' => 21,
            'min_notice_days' => 3,
            'max_backdate_days' => 0,
        ],
        'sick' => [
            'name' => 'Sick',
            'days_per_year' => 10,
            'min_notice_days' => 0,
            'max_backdate_days' => 7,
        ],
    ];
}
