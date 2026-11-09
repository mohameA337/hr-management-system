-- Public holidays: not working days, never counted as leave (HOL-1, HOL-2). Filled by the seed.
CREATE TABLE public_holidays (
    id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    holiday_date DATE         NOT NULL,
    name         VARCHAR(100) NOT NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_public_holidays_date (holiday_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
