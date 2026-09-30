-- Migration 006: Create activities table
CREATE TABLE IF NOT EXISTS activities (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  booking_id VARCHAR(36) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL,
  type VARCHAR(30) NOT NULL,
  title VARCHAR(120) NOT NULL,
  description TEXT NULL,
  mood VARCHAR(30) NULL,
  photo_url TEXT NULL,
  time_label VARCHAR(30) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_activities_type CHECK (type IN ('food', 'play', 'nap', 'walk', 'general'))
);
