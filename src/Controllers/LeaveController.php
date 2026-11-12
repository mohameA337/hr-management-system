<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Config\Database;
use App\Config\LeavePolicy;
use App\Core\HttpException;
use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Employee;
use App\Models\Holiday;
use App\Models\LeaveRequest;
use App\Services\WorkingDays;
use DateTimeImmutable;
use Throwable;

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

    public function store(Request $request): Response
    {
        $validator = new Validator($request);
        $type = $request->input('type');
        $start = $request->input('start_date');
        $end = $request->input('end_date');
        $reason = $request->input('reason');

        if (!is_string($type) || !isset(LeavePolicy::TYPES[$type])) {
            $validator->add('type', 'Choose annual or sick leave.');
        }
        foreach (['start_date' => $start, 'end_date' => $end] as $field => $date) {
            if (!is_string($date) || !Validator::isDate($date)) {
                $validator->add($field, 'Enter a valid date in YYYY-MM-DD format.');
            }
        }
        if ($reason !== null && (!is_string($reason) || strlen($reason) > 255)) {
            $validator->add('reason', 'Enter a reason of at most 255 bytes.');
        }
        $validator->throwIfFailed();

        $policy = LeavePolicy::TYPES[$type];
        $today = new DateTimeImmutable('today');
        $todayDate = $today->format('Y-m-d');
        $notice = $policy['min_notice_days'];
        if ($notice > 0) {
            $upcomingHolidays = Holiday::datesBetween($todayDate, '9999-12-31');
            $earliest = WorkingDays::add($todayDate, $notice, $upcomingHolidays);
            if ($start < $earliest) {
                $validator->add('start_date', "Annual leave must be requested at least $notice working days ahead (from $earliest).");
                $validator->throwIfFailed();
            }
        }
        $backdate = $policy['max_backdate_days'];
        if ($start < $today->modify("-$backdate days")->format('Y-m-d')) {
            $validator->add('start_date', "Sick leave can start at most $backdate days in the past.");
            $validator->throwIfFailed();
        }

        $year = (int) substr($start, 0, 4);
        if ($end < $start || $year !== (int) substr($end, 0, 4)) {
            $validator->add('end_date', 'The end date must be on or after the start date and in the same year.');
            $validator->throwIfFailed();
        }
        $days = WorkingDays::count($start, $end, Holiday::datesBetween($start, $end));
        if ($days === 0) {
            $validator->add('end_date', 'The request must include at least one working day.');
            $validator->throwIfFailed();
        }

        $employeeId = (int) $request->user()['id'];
        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            // Requests for the same employee use this lock before checking overlap and balance.
            $employee = Employee::find($employeeId, true);
            if ($employee === null || $employee['status'] !== 'active') {
                throw new HttpException(401, 'UNAUTHENTICATED', 'Please log in.');
            }
            if (LeaveRequest::hasOverlap($employeeId, $start, $end)) {
                throw new HttpException(422, 'OVERLAPPING_REQUEST', 'This request overlaps an existing leave request.');
            }
            $used = LeaveRequest::approvedDays($employeeId, $type, $year);
            if ($days > $policy['days_per_year'] - $used) {
                throw new HttpException(422, 'INSUFFICIENT_BALANCE', 'You do not have enough leave days remaining.');
            }

            $id = LeaveRequest::create($employeeId, $type, $start, $end, $days, $reason);
            $leave = LeaveRequest::find($id);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        }

        return Response::data($leave, 201);
    }

    public function update(Request $request): Response
    {
        $id = $request->param('id');
        $user = $request->user();
        $isHr = $user['role'] === 'hr';
        $userId = (int) $user['id'];
        $leave = LeaveRequest::find($id);
        if ($leave === null || (!$isHr && $leave['employee']['id'] !== $userId)) {
            throw HttpException::notFound('Leave request');
        }

        $validator = new Validator($request);
        $status = $request->input('status');
        $comment = $request->input('comment');
        if (!in_array($status, ['approved', 'rejected', 'cancelled'], true)) {
            $validator->add('status', 'Choose approved, rejected, or cancelled.');
        }
        if ($comment !== null && (!is_string($comment) || strlen($comment) > 255)) {
            $validator->add('comment', 'Enter a comment of at most 255 bytes.');
        } elseif ($status === 'rejected' && ($comment === null || trim($comment) === '')) {
            $validator->add('comment', 'The comment field is required.');
        }
        $validator->throwIfFailed();
        $comment = $comment === null || trim($comment) === '' ? null : trim($comment);

        $employeeId = $leave['employee']['id'];
        $isOwner = $employeeId === $userId;
        $pdo = Database::connection();
        $pdo->beginTransaction();
        try {
            // Use the same employee lock as submission and termination.
            Employee::find($employeeId, true);
            $leave = LeaveRequest::find($id);
            if ($leave === null) {
                throw HttpException::notFound('Leave request');
            }

            if ($status === 'cancelled') {
                if (!$isOwner) {
                    throw HttpException::forbidden('Only the employee can cancel their own leave.');
                }
                $upcoming = $leave['status'] === 'approved' && $leave['start_date'] > date('Y-m-d');
                if ($leave['status'] !== 'pending' && !$upcoming) {
                    throw HttpException::conflict('This leave request cannot be cancelled.');
                }
                LeaveRequest::cancel($id);
            } else {
                if (!$isHr || $isOwner) {
                    throw HttpException::forbidden('Only HR can review another employee’s leave.');
                }
                if ($leave['status'] !== 'pending') {
                    throw HttpException::conflict('Only pending leave requests can be reviewed.');
                }
                if ($status === 'approved') {
                    $type = $leave['type'];
                    $year = (int) substr($leave['start_date'], 0, 4);
                    $used = LeaveRequest::approvedDays($employeeId, $type, $year);
                    if ($leave['days'] > LeavePolicy::TYPES[$type]['days_per_year'] - $used) {
                        throw new HttpException(422, 'INSUFFICIENT_BALANCE', 'You do not have enough leave days remaining.');
                    }
                }
                LeaveRequest::review($id, $status, $userId, $comment, date('Y-m-d H:i:s'));
            }

            $updated = LeaveRequest::find($id);
            $pdo->commit();
        } catch (Throwable $error) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            throw $error;
        }

        return Response::data($updated);
    }
}
