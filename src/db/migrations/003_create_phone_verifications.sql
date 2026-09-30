-- Migration 003: Create phone_verifications table
CREATE TABLE IF NOT EXISTS phone_verifications (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  phone_number VARCHAR(30) NOT NULL,
  otp_hash VARCHAR(255) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  max_attempts INT NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
