-- Leave requests and their approval (LEAVE-1 … LEAVE-7).
-- The rules per type (days per year, notice, backdating) are fixed in the PHP code.
CREATE TABLE leave_requests (
    id             INT UNSIGNED      NOT NULL AUTO_INCREMENT,
    employee_id    INT UNSIGNED      NOT NULL,
    type           ENUM('annual', 'sick') NOT NULL,
    start_date     DATE              NOT NULL,
    end_date       DATE              NOT NULL,
    days           SMALLINT UNSIGNED NOT NULL, -- working days, calculated by PHP at submit
    reason         VARCHAR(255)      NULL,
    status         ENUM('pending', 'approved', 'rejected', 'cancelled') NOT NULL DEFAULT 'pending',
    reviewed_by    INT UNSIGNED      NULL,
    review_comment VARCHAR(255)      NULL,
    reviewed_at    DATETIME          NULL,
    created_at     TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_leave_requests_employee_status (employee_id, status),
    KEY idx_leave_requests_status (status),
    CONSTRAINT fk_leave_requests_employee
        FOREIGN KEY (employee_id) REFERENCES employees (id) ON DELETE RESTRICT,
    CONSTRAINT fk_leave_requests_reviewer
        FOREIGN KEY (reviewed_by) REFERENCES employees (id) ON DELETE RESTRICT,
    CONSTRAINT chk_leave_requests_dates CHECK (end_date >= start_date AND YEAR(start_date) = YEAR(end_date)),
    CONSTRAINT chk_leave_requests_days CHECK (days > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
