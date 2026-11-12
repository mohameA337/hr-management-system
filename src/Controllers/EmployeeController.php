<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Employee;
use DateTimeImmutable;
use PDOException;

final class EmployeeController
{
    public function index(Request $request): Response
    {
        $status = $request->query('status', 'active');
        if (!in_array($status, ['active', 'terminated', 'all'], true)) {
            $validator = new Validator($request);
            $validator->add('status', 'Choose active, terminated, or all.');
            $validator->throwIfFailed();
        }

        $search = trim($request->query('search', ''));
        $page = max(1, min(2147483647, (int) $request->query('page', '1')));
        $perPage = max(1, min(100, (int) $request->query('per_page', '20')));

        $result = Employee::paginate($status, $search, $page, $perPage);
        $employees = [];
        foreach ($result['rows'] as $employee) {
            $employees[] = Employee::present($employee);
        }

        return Response::paginated($employees, [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $result['total'],
            'total_pages' => (int) ceil($result['total'] / $perPage),
        ]);
    }

    public function store(Request $request): Response
    {
        $validator = new Validator($request);
        $code = $validator->requiredString('employee_code', 'employee code', 20);
        $employee = $this->employeeFields($request, $validator, false);
        $validator->throwIfFailed();

        $employee['employee_code'] = strtoupper(trim($code));
        $employee['password_hash'] = password_hash($employee['password'], PASSWORD_DEFAULT);
        unset($employee['password']);

        try {
            $id = Employee::create($employee);
        } catch (PDOException $error) {
            if ((int) ($error->errorInfo[1] ?? 0) === 1062) {
                throw HttpException::conflict('The employee code or email is already in use.');
            }
            throw $error;
        }

        return Response::data(Employee::present(Employee::find($id)), 201);
    }

    private function employeeFields(Request $request, Validator $validator, bool $partial): array
    {
        $fields = [];
        $limits = [
            'first_name' => 50,
            'last_name' => 50,
            'email' => 150,
            'job_title' => 100,
            'department' => 100,
            'hire_date' => 10,
            'role' => 8,
            'password' => 72,
        ];

        foreach ($limits as $field => $limit) {
            if ($partial && !$request->has($field)) {
                continue;
            }

            $value = $validator->requiredString($field, str_replace('_', ' ', $field), $limit);
            if ($value !== null) {
                $fields[$field] = $field === 'password' ? $value : trim($value);
            }
        }

        if (isset($fields['email'])) {
            $fields['email'] = strtolower($fields['email']);
            if (filter_var($fields['email'], FILTER_VALIDATE_EMAIL) === false) {
                $validator->add('email', 'Enter a valid email address.');
            }
        }

        if (isset($fields['role']) && !in_array($fields['role'], ['hr', 'employee'], true)) {
            $validator->add('role', 'Choose hr or employee.');
        }

        if (isset($fields['hire_date']) && !$this->isDate($fields['hire_date'])) {
            $validator->add('hire_date', 'Enter a valid date in YYYY-MM-DD format.');
        }

        if (isset($fields['password']) && (strlen($fields['password']) < 8 || str_contains($fields['password'], "\0"))) {
            $validator->add('password', 'Use at least 8 bytes and no null bytes.');
        }

        if (!$partial || $request->has('phone')) {
            $phone = $request->input('phone');
            if ($phone === null || $phone === '') {
                $fields['phone'] = null;
            } elseif (is_string($phone) && strlen($phone) <= 30) {
                $phone = trim($phone);
                $fields['phone'] = $phone === '' ? null : $phone;
            } else {
                $validator->add('phone', 'Enter a phone number of at most 30 bytes.');
            }
        }

        return $fields;
    }

    private function isDate(string $value): bool
    {
        if (!preg_match('/^[1-9][0-9]{3}-[0-9]{2}-[0-9]{2}$/D', $value)) {
            return false;
        }

        $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);

        return $date !== false && $date->format('Y-m-d') === $value;
    }
}
