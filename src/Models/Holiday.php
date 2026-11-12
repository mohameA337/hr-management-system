<?php

declare(strict_types=1);

namespace App\Models;

use App\Config\Database;
use PDO;

final class Holiday
{
    public static function forYear(int $year): array
    {
        $statement = Database::connection()->prepare(
            'SELECT id, holiday_date, name FROM public_holidays
             WHERE holiday_date BETWEEN ? AND ? ORDER BY holiday_date'
        );
        $statement->execute(["$year-01-01", "$year-12-31"]);

        return $statement->fetchAll();
    }

    public static function datesBetween(string $from, string $to): array
    {
        $statement = Database::connection()->prepare(
            'SELECT holiday_date FROM public_holidays WHERE holiday_date BETWEEN ? AND ?'
        );
        $statement->execute([$from, $to]);

        return $statement->fetchAll(PDO::FETCH_COLUMN);
    }
}
