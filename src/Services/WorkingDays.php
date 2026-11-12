<?php

declare(strict_types=1);

namespace App\Services;

use DateTimeImmutable;

final class WorkingDays
{
    public static function count(string $start, string $end, array $holidays): int
    {
        $days = 0;
        $last = new DateTimeImmutable($end);
        for ($day = new DateTimeImmutable($start); $day <= $last; $day = $day->modify('+1 day')) {
            if (self::isWorkingDay($day, $holidays)) {
                $days++;
            }
        }

        return $days;
    }

    public static function add(string $start, int $days, array $holidays): string
    {
        $day = new DateTimeImmutable($start);
        while ($days > 0) {
            $day = $day->modify('+1 day');
            if (self::isWorkingDay($day, $holidays)) {
                $days--;
            }
        }

        return $day->format('Y-m-d');
    }

    private static function isWorkingDay(DateTimeImmutable $day, array $holidays): bool
    {
        return (int) $day->format('N') <= 5 && !in_array($day->format('Y-m-d'), $holidays, true);
    }
}
