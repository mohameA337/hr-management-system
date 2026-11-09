-- Employee profiles and their login (EMP-1 … EMP-5, AUTH-1, AUTH-2).
CREATE TABLE employees (
    id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
    employee_code    VARCHAR(20)  NOT NULL,
    first_name       VARCHAR(50)  NOT NULL,
    last_name        VARCHAR(50)  NOT NULL,
    email            VARCHAR(150) NOT NULL,
    phone            VARCHAR(30)  NULL,
    job_title        VARCHAR(100) NOT NULL,
    department       VARCHAR(100) NOT NULL,
    hire_date        DATE         NOT NULL,
    status           ENUM('active', 'terminated') NOT NULL DEFAULT 'active',
    termination_date DATE         NULL,
    role             ENUM('hr', 'employee') NOT NULL DEFAULT 'employee',
    password_hash    VARCHAR(255) NOT NULL,
    last_login_at    DATETIME     NULL,
    created_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_employees_code (employee_code),
    UNIQUE KEY uq_employees_email (email),
    KEY idx_employees_status (status),
    -- A termination date exactly when terminated, and never before the hire date.
    CONSTRAINT chk_employees_termination CHECK (
        (status = 'active' AND termination_date IS NULL)
        OR (status = 'terminated' AND termination_date IS NOT NULL AND termination_date >= hire_date)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
