<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\LeaveRequest;

final class LeaveController
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $isHr = $user['role'] === 'hr';
        $employeeId = $isHr ? $request->query('employee_id') : (string) $user['id'];
        $status = $request->query('status');
        $from = $request->query('from');
        $to = $request->query('to');
        $validator = new Validator($request);

        if ($status !== null && !in_array($status, ['pending', 'approved', 'rejected', 'cancelled'], true)) {
            $validator->add('status', 'Choose pending, approved, rejected, or cancelled.');
        }
        if ($employeeId !== null && (!ctype_digit($employeeId) || (int) $employeeId < 1 || (int) $employeeId > 4294967295)) {
            $validator->add('employee_id', 'Enter a valid employee ID.');
        }
        foreach (['from' => $from, 'to' => $to] as $field => $date) {
            if ($date !== null && !Validator::isDate($date)) {
                $validator->add($field, 'Enter a valid date in YYYY-MM-DD format.');
            }
        }
        $validator->throwIfFailed();

        $page = max(1, min(2147483647, (int) $request->query('page', '1')));
        $perPage = max(1, min(100, (int) $request->query('per_page', '20')));
        $result = LeaveRequest::paginate($employeeId, $status, $from, $to, $isHr && $status === 'pending', $page, $perPage);

        return Response::paginated($result['rows'], [
            'page' => $page,
            'per_page' => $perPage,
            'total' => $result['total'],
            'total_pages' => (int) ceil($result['total'] / $perPage),
        ]);
    }
}
