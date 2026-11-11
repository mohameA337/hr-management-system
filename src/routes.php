<?php

declare(strict_types=1);

use App\Controllers\HealthController;
use App\Core\Router;

// All API routes. index.php calls this function with the Router.
// Each phase adds its routes here (see docs/BACKEND_GUIDE.md).
return function (Router $router): void {
    $router->add('GET', '/api/v1/health', [HealthController::class, 'show']);

    // Phase 1: auth
    // Phase 2: employees
    // Phase 3: holidays
    // Phase 4: leave requests
};
