<?php

declare(strict_types=1);

use App\Controllers\AuthController;
use App\Controllers\EmployeeController;
use App\Controllers\HealthController;
use App\Core\Router;
use App\Middleware\AuthMiddleware;
use App\Middleware\HrMiddleware;

// All API routes. index.php calls this function with the Router.
// Each phase adds its routes here (see docs/BACKEND_GUIDE.md).
return function (Router $router): void {
    $router->add('GET', '/api/v1/health', [HealthController::class, 'show']);

    $router->add('POST', '/api/v1/auth/login', [AuthController::class, 'login']);
    $router->add('GET', '/api/v1/me', [AuthController::class, 'me'], [AuthMiddleware::class]);

    $hr = [AuthMiddleware::class, HrMiddleware::class];
    $router->add('GET', '/api/v1/employees', [EmployeeController::class, 'index'], $hr);

    // Phase 3: holidays
    // Phase 4: leave requests
};
