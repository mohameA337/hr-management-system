<?php

declare(strict_types=1);

use App\Config\App;

require dirname(__DIR__) . '/vendor/autoload.php';

// Front controller: every request that does not match a real file in public/
// is routed here by Apache (FallbackResource). Routing will be added later.

header('Content-Type: application/json; charset=utf-8');

echo json_encode([
    'app'     => App::NAME,
    'version' => App::VERSION,
    'method'  => $_SERVER['REQUEST_METHOD'],
    'path'    => parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH),
], JSON_UNESCAPED_SLASHES);
