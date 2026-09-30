-- Migration 009: Create reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  shelter_id VARCHAR(36) NOT NULL REFERENCES shelters(id) ON DELETE CASCADE,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  rating NUMERIC(2,1) NOT NULL,
  comment TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_reviews_rating CHECK (rating >= 1 AND rating <= 5)
);
