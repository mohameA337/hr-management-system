<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\HttpException;
use App\Core\Request;

final class HrMiddleware
{
    public function handle(Request $request): void
    {
        if ($request->user()['role'] !== 'hr') {
            throw HttpException::forbidden();
        }
    }
}
