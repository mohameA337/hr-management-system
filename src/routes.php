<?php

declare(strict_types=1);

use App\Controllers\AuthController;
use App\Controllers\EmployeeController;
use App\Controllers\HealthController;
use App\Controllers\HolidayController;
use App\Controllers\LeaveController;
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
    $router->add('POST', '/api/v1/employees', [EmployeeController::class, 'store'], $hr);
    $router->add('PATCH', '/api/v1/employees/{id}', [EmployeeController::class, 'update'], $hr);

    $router->add('GET', '/api/v1/holidays', [HolidayController::class, 'index'], [AuthMiddleware::class]);
    $auth = [AuthMiddleware::class];
    $router->add('GET', '/api/v1/leave-requests', [LeaveController::class, 'index'], $auth);
    $router->add('POST', '/api/v1/leave-requests', [LeaveController::class, 'store'], $auth);
    $router->add('PATCH', '/api/v1/leave-requests/{id}', [LeaveController::class, 'update'], $auth);
};
