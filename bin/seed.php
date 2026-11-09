<?php

declare(strict_types=1);

// Runs every database/seeds/*.sql file. Seeds are written so they can safely run again.
// Usage: php bin/seed.php

use App\Config\Database;

require __DIR__ . '/bootstrap.php';

$pdo = Database::connection();
$files = glob($root . '/database/seeds/*.sql');
sort($files);

foreach ($files as $file) {
    $pdo->exec(file_get_contents($file));
    echo 'Seeded: ' . basename($file) . "\n";
}
