<?php

declare(strict_types=1);

// Runs every database/migrations/*.sql file that has not run yet, in filename order.
// Usage: php bin/migrate.php

use App\Config\Database;

require __DIR__ . '/bootstrap.php';

$pdo = Database::connection();
$pdo->exec(
    'CREATE TABLE IF NOT EXISTS migrations (
        filename VARCHAR(255) NOT NULL PRIMARY KEY,
        ran_at   DATETIME     NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
);

$done = $pdo->query('SELECT filename FROM migrations')->fetchAll(PDO::FETCH_COLUMN);
$files = glob($root . '/database/migrations/*.sql');
sort($files);

$ran = 0;
foreach ($files as $file) {
    $name = basename($file);
    if (in_array($name, $done, true)) {
        continue;
    }
    // MySQL commits table changes immediately, so a failed file stops here and is not recorded.
    $pdo->exec(file_get_contents($file));
    $pdo->prepare('INSERT INTO migrations (filename, ran_at) VALUES (?, ?)')->execute([$name, date('Y-m-d H:i:s')]);
    echo "Migrated: {$name}\n";
    $ran++;
}

echo $ran === 0 ? "Nothing to migrate.\n" : "Done: {$ran} migration(s).\n";
