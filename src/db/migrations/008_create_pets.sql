-- Migration 008: Create pets table
CREATE TABLE IF NOT EXISTS pets (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  owner_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(80) NOT NULL,
  breed VARCHAR(80) NULL,
  age INT NULL,
  weight NUMERIC(5,2) NULL,
  photo_url TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_pets_age CHECK (age IS NULL OR age >= 0),
  CONSTRAINT chk_pets_weight CHECK (weight IS NULL OR weight >= 0)
);
