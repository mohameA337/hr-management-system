-- Public holidays (HOL-1). Edit this list and run `php bin/seed.php` again:
-- existing dates get their new name, new dates are added. Removing a line does not delete a holiday.
INSERT INTO public_holidays (holiday_date, name)
VALUES
    ('2026-01-01', 'New Year''s Day'),
    ('2026-05-25', 'Memorial Day'),
    ('2026-07-03', 'Independence Day (observed)'),
    ('2026-09-07', 'Labor Day'),
    ('2026-11-26', 'Thanksgiving Day'),
    ('2026-12-25', 'Christmas Day'),
    ('2027-01-01', 'New Year''s Day'),
    ('2027-05-31', 'Memorial Day'),
    ('2027-07-05', 'Independence Day (observed)'),
    ('2027-09-06', 'Labor Day'),
    ('2027-11-25', 'Thanksgiving Day'),
    ('2027-12-24', 'Christmas Day (observed)')
AS new
ON DUPLICATE KEY UPDATE name = new.name;
