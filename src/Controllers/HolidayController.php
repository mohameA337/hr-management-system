<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Request;
use App\Core\Response;
use App\Core\Validator;
use App\Models\Holiday;

final class HolidayController
{
    public function index(Request $request): Response
    {
        $year = $request->query('year', date('Y'));
        if (!preg_match('/^[1-9][0-9]{3}$/D', $year)) {
            $validator = new Validator($request);
            $validator->add('year', 'Enter a four-digit year.');
            $validator->throwIfFailed();
        }

        return Response::data(Holiday::forYear((int) $year));
    }
}
