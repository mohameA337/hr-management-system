<?php

declare(strict_types=1);

namespace App\Config;

use PDO;

/** One shared PDO connection with safe settings. */
final class Database
{
    private static ?PDO $pdo = null;

    public static function connection(): PDO
    {
        if (self::$pdo === null) {
            $dsn = sprintf(
                'mysql:host=%s;port=%s;dbname=%s;charset=%s',
                Env::get('DB_HOST', '127.0.0.1'),
                Env::get('DB_PORT', '3306'),
                Env::get('DB_DATABASE'),
                Env::get('DB_CHARSET', 'utf8mb4'),
            );
            self::$pdo = new PDO($dsn, Env::get('DB_USERNAME'), Env::get('DB_PASSWORD'), [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,       // SQL errors throw exceptions
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,  // rows as ['column' => value]
                PDO::ATTR_EMULATE_PREPARES => false,               // real prepared statements; ints come back as ints
            ]);
        }
        return self::$pdo;
    }
}
