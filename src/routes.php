<?php

declare(strict_types=1);

use App\Controllers\AuthController;
use App\Controllers\HealthController;
use App\Core\Router;
use App\Middleware\AuthMiddleware;

// All API routes. index.php calls this function with the Router.
// Each phase adds its routes here (see docs/BACKEND_GUIDE.md).
return function (Router $router): void {
    $router->add('GET', '/api/v1/health', [HealthController::class, 'show']);

    $router->add('POST', '/api/v1/auth/login', [AuthController::class, 'login']);
    $router->add('GET', '/api/v1/me', [AuthController::class, 'me'], [AuthMiddleware::class]);

    // Phase 2: employees
    // Phase 3: holidays
    // Phase 4: leave requests
};
