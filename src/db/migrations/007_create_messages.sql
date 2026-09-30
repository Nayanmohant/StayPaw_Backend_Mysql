-- Migration 007: Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  booking_id VARCHAR(36) NULL REFERENCES bookings(id) ON DELETE SET NULL,
  sender_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  sender_name VARCHAR(100) NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
