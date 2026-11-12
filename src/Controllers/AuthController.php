<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Database;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\AuthToken;
use App\Models\Employee;
use App\Services\LeaveBalance;
use Throwable;

final class AuthController
{
    public function login(Request $request): Response
    {
        $validator = new Validator($request);
        $email = $validator->requiredString('email', 'email');
        $password = $validator->requiredString('password', 'password');

        if ($email !== null) {
            $email = strtolower(trim($email));
            if (strlen($email) > 150 || filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
                $validator->add('email', 'Enter a valid email address.');
            }
        }

        $validator->throwIfFailed();

        $employee = Employee::findByEmail($email);
        if ($employee === null || $employee['status'] !== 'active'
            || !password_verify($password, $employee['password_hash'])) {
            throw new HttpException(401, 'UNAUTHENTICATED', 'Invalid email or password.');
        }

        $employeeId = (int) $employee['id'];
        $token = bin2hex(random_bytes(32));
        $now = time();
        $loggedInAt = date('Y-m-d H:i:s', $now);
        $expiresAt = date('Y-m-d H:i:s', $now + 8 * 3600);

        // Save the login time and the token hash together.
        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            Employee::touchLastLogin($employeeId, $loggedInAt);
            AuthToken::create($employeeId, hash('sha256', $token), $expiresAt);
            $pdo->commit();
        } catch (Throwable $error) {
            $pdo->rollBack();
            throw $error;
        }

        $employee['last_login_at'] = $loggedInAt;

        return Response::data([
            'token' => $token,
            'expires_at' => $expiresAt,
            'user' => Employee::present($employee),
        ]);
    }

    public function me(Request $request): Response
    {
        $employee = $request->user();
        $year = (int) date('Y');

        return Response::data([
            'user' => Employee::present($employee),
            'leave_balances' => LeaveBalance::forEmployee((int) $employee['id'], $year),
        ]);
    }
}
