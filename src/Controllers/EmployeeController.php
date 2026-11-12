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
use App\Models\LeaveRequest;
use PDOException;
use Throwable;

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

    public function update(Request $request): Response
    {
        $id = $request->param('id');
        $pdo = Database::connection();
        $pdo->beginTransaction();

        try {
            // Keep the employee stable while checking and applying the update.
            $employee = Employee::find($id, true);
            if ($employee === null) {
                throw HttpException::notFound('Employee');
            }

            $validator = new Validator($request);
            $changes = $this->employeeFields($request, $validator, true);
            $terminating = $request->input('status') === 'terminated';
            if ($request->has('status') && !$terminating) {
                $validator->add('status', 'The status can only be changed to terminated.');
            }

            $hireDate = $changes['hire_date'] ?? $employee['hire_date'];
            if ($terminating) {
                $date = $validator->requiredString('termination_date', 'termination date', 10);
                if ($date !== null && (!Validator::isDate($date) || $date < $hireDate)) {
                    $validator->add('termination_date', 'Enter a valid date on or after the hire date.');
                }
                $changes['status'] = 'terminated';
                $changes['termination_date'] = $date;
            } elseif ($request->has('termination_date')) {
                $validator->add('termination_date', 'Send a termination date when changing status to terminated.');
            } elseif ($employee['termination_date'] !== null && $hireDate > $employee['termination_date']) {
                $validator->add('hire_date', 'The hire date must be on or before the termination date.');
            }
            $validator->throwIfFailed();

            $isOwnAccount = $id === (int) $request->user()['id'];
            if ($isOwnAccount && isset($changes['role']) && $changes['role'] !== $employee['role']) {
                throw HttpException::conflict('You cannot change your own role.');
            }
            if ($terminating && ($isOwnAccount || $employee['status'] === 'terminated')) {
                throw HttpException::conflict('You cannot terminate yourself or an already terminated employee.');
            }
            if (isset($changes['password'])) {
                $changes['password_hash'] = password_hash($changes['password'], PASSWORD_DEFAULT);
                unset($changes['password']);
            }

            Employee::update($id, $changes);
            if ($terminating) {
                AuthToken::deleteForEmployee($id);
                LeaveRequest::cancelForTermination($id, $changes['termination_date']);
            }

            $updated = Employee::find($id);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            if ($error instanceof PDOException && (int) ($error->errorInfo[1] ?? 0) === 1062) {
                throw HttpException::conflict('The email is already in use.');
            }
            throw $error;
        }

        return Response::data(Employee::present($updated));
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

        if (isset($fields['hire_date']) && !Validator::isDate($fields['hire_date'])) {
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
}
