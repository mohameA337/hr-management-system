<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Employee;

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
}
