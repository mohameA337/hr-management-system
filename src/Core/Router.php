<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Matches the request (method + path) to one route and runs it:
 *   1. its middleware (each one may throw 401/403 to stop the request)
 *   2. its controller method, which returns a Response
 */
final class Router
{
    /** @var list<array{method: string, path: string, handler: array{0: class-string, 1: string}, middleware: list<class-string>}> */
    private array $routes = [];

    /**
     * @param array{0: class-string, 1: string} $handler    [ControllerClass::class, 'methodName']
     * @param list<class-string>                $middleware e.g. [AuthMiddleware::class]
     */
    public function add(string $method, string $path, array $handler, array $middleware = []): void
    {
        $this->routes[] = [
            'method' => $method,
            'path' => $path,
            'handler' => $handler,
            'middleware' => $middleware,
        ];
    }

    public function dispatch(Request $request): Response
    {
        foreach ($this->routes as $route) {
            if ($route['method'] !== $request->method()) {
                continue;
            }

            $pattern = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>\d+)', $route['path']) . '$#';
            if (preg_match($pattern, $request->path(), $matches) !== 1) {
                continue;
            }

            // $matches has both numbered and named keys; keep only the named ones: ['id' => '5'].
            $request->setParams(array_filter($matches, 'is_string', ARRAY_FILTER_USE_KEY));

            foreach ($route['middleware'] as $middlewareClass) {
                (new $middlewareClass())->handle($request);
            }

            [$controllerClass, $method] = $route['handler'];

            return (new $controllerClass())->$method($request);
        }

        throw HttpException::notFound('Endpoint');
    }
}
