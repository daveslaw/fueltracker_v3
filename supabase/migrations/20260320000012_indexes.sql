-- Performance indexes on all hot query patterns.

-- shifts
CREATE INDEX IF NOT EXISTS idx_shifts_station_id       ON shifts (station_id);
CREATE INDEX IF NOT EXISTS idx_shifts_shift_date        ON shifts (shift_date);
CREATE INDEX IF NOT EXISTS idx_shifts_station_date      ON shifts (station_id, shift_date);

-- pump_readings
CREATE INDEX IF NOT EXISTS idx_pump_readings_shift_id          ON pump_readings (shift_id);
CREATE INDEX IF NOT EXISTS idx_pump_readings_shift_id_type     ON pump_readings (shift_id, type);

-- dip_readings
CREATE INDEX IF NOT EXISTS idx_dip_readings_shift_id           ON dip_readings (shift_id);
CREATE INDEX IF NOT EXISTS idx_dip_readings_shift_id_type      ON dip_readings (shift_id, type);

-- pos_submissions
CREATE INDEX IF NOT EXISTS idx_pos_submissions_shift_id        ON pos_submissions (shift_id);

-- deliveries
CREATE INDEX IF NOT EXISTS idx_deliveries_station_id           ON deliveries (station_id);
CREATE INDEX IF NOT EXISTS idx_deliveries_station_date         ON deliveries (station_id, delivered_at DESC);

-- reconciliation lines
CREATE INDEX IF NOT EXISTS idx_rec_tank_lines_rec_id           ON reconciliation_tank_lines (reconciliation_id);
CREATE INDEX IF NOT EXISTS idx_rec_grade_lines_rec_id          ON reconciliation_grade_lines (reconciliation_id);

-- user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id           ON user_profiles (user_id);

-- ocr_overrides
CREATE INDEX IF NOT EXISTS idx_ocr_overrides_shift_id          ON ocr_overrides (shift_id);
