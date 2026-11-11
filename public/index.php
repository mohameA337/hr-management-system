<?php

declare(strict_types=1);

// Front controller: Apache sends every request here (FallbackResource /index.php).

use App\Config\Env;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Router;

require dirname(__DIR__) . '/vendor/autoload.php';

// 1. Settings
Env::load(dirname(__DIR__) . '/.env');
date_default_timezone_set(Env::get('APP_TIMEZONE', 'UTC'));

// 2. Routes
$router = new Router();
(require dirname(__DIR__) . '/src/routes.php')($router);

// 3. Handle the request, and turn every error into a JSON error response.
try {
    $response = $router->dispatch(Request::fromGlobals());
} catch (HttpException $e) {
    // Errors we threw on purpose: 400, 401, 403, 404, 409, 422.
    $response = Response::error($e);
} catch (Throwable $e) {
    // Bugs and unexpected problems (e.g. database down). The details go to
    // /var/log/apache2/hr.localhost-error.log, never to the user.
    error_log((string) $e);
    $response = Response::error(new HttpException(500, 'SERVER_ERROR', 'Something went wrong. Please try again.'));
}

// 4. Send it
$response->send();
