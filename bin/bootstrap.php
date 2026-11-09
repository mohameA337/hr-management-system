<?php

declare(strict_types=1);

// Shared setup for the command-line scripts in bin/.

use App\Config\Env;

if (PHP_SAPI !== 'cli') {
    exit("Run this script from the command line.\n");
}

$root = dirname(__DIR__);
require $root . '/vendor/autoload.php';

Env::load($root . '/.env');
date_default_timezone_set(Env::get('APP_TIMEZONE', 'UTC'));
