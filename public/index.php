<?php

declare(strict_types=1);

use App\Config\App;

require dirname(__DIR__) . '/vendor/autoload.php';

// Get request information
$method = $_SERVER['REQUEST_METHOD'];
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Set response type
header('Content-Type: application/json; charset=utf-8');

// Health check route
if ($method === 'GET' && $path === '/api/v1/health') {

    // TODO 1: Return HTTP status 200
    http_response_code(200);
    $response = [
        'data' => [
            'status' => 'ok',
        ],
    ];

    // TODO 2: Convert $response to JSON and echo it
    echo json_encode($response, JSON_PRETTY_PRINT);

} else {

    // TODO 3: Return HTTP status 404
http_response_code(404);
    $response = [
        'error' => [
            'code' => 'NOT_FOUND',
            'message' => 'Route not found',
            'details' => [],
        ],
    ];

    // TODO 4: Convert $response to JSON and echo it
    echo json_encode($response, JSON_PRETTY_PRINT);
}