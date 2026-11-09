<?php

declare(strict_types=1);

// Creates an HR login, e.g. the very first one. The password is typed here, never stored in a file.
// Usage: php bin/create-hr-user.php

use App\Config\Database;

require __DIR__ . '/bootstrap.php';

function ask(string $question): string
{
    $answer = readline($question . ': ');
    return trim($answer === false ? '' : $answer);
}

function askHidden(string $question): string
{
    echo $question . ': ';
    shell_exec('stty -echo');
    $answer = trim((string) fgets(STDIN));
    shell_exec('stty echo');
    echo "\n";
    return $answer;
}

$firstName = ask('First name');
$lastName = ask('Last name');
$email = strtolower(ask('Email'));
$password = askHidden('Password (at least 8 characters)');

$errors = [];
if ($firstName === '' || $lastName === '') {
    $errors[] = 'First and last name are required.';
}
if (filter_var($email, FILTER_VALIDATE_EMAIL) === false) {
    $errors[] = 'Enter a valid email address.';
}
if (strlen($password) < 8) {
    $errors[] = 'The password must be at least 8 characters.';
}
if ($errors !== []) {
    exit(implode("\n", $errors) . "\n");
}

$pdo = Database::connection();

$exists = $pdo->prepare('SELECT COUNT(*) FROM employees WHERE email = ?');
$exists->execute([$email]);
if ((int) $exists->fetchColumn() > 0) {
    exit("An employee with this email already exists.\n");
}

$nextId = (int) $pdo->query('SELECT COALESCE(MAX(id), 0) + 1 FROM employees')->fetchColumn();
$code = sprintf('EMP-%04d', $nextId);

$pdo->prepare(
    "INSERT INTO employees
        (employee_code, first_name, last_name, email, job_title, department, hire_date, role, password_hash)
     VALUES (?, ?, ?, ?, 'HR Manager', 'Human Resources', ?, 'hr', ?)"
)->execute([$code, $firstName, $lastName, $email, date('Y-m-d'), password_hash($password, PASSWORD_DEFAULT)]);

echo "Created HR user {$firstName} {$lastName} ({$email}), employee code {$code}.\n";
