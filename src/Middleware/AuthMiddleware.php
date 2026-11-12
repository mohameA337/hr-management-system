<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\HttpException;
use App\Core\Request;
use App\Models\AuthToken;
use App\Models\Employee;

final class AuthMiddleware
{
    public function handle(Request $request): void
    {
        $token = $request->bearerToken();

        if ($token === null) {
            throw new HttpException(401, 'UNAUTHENTICATED', 'Please log in.');
        }

        $employeeId = AuthToken::findEmployeeId(hash('sha256', $token), date('Y-m-d H:i:s'));

        if ($employeeId === null) {
            throw new HttpException(401, 'UNAUTHENTICATED', 'Your session has expired. Please log in again.');
        }

        $employee = Employee::find($employeeId);

        if ($employee === null || $employee['status'] !== 'active') {
            throw new HttpException(401, 'UNAUTHENTICATED', 'Your session has expired. Please log in again.');
        }

        $request->setUser($employee);
    }
}
