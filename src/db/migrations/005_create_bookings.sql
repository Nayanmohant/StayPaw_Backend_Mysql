-- Migration 005: Create bookings table
CREATE TABLE IF NOT EXISTS bookings (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  shelter_id VARCHAR(36) NOT NULL REFERENCES shelters(id) ON DELETE RESTRICT,
  shelter_name VARCHAR(120) NULL,
  shelter_image TEXT NULL,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax NUMERIC(10,2) NOT NULL DEFAULT 0,
  service_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  add_ons TEXT[] NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_bookings_status CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT chk_bookings_date_range CHECK (end_date > start_date)
);
