-- Migration 004: Create shelters table
CREATE TABLE IF NOT EXISTS shelters (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  admin_id VARCHAR(36) NULL REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(120) NOT NULL,
  image_url TEXT NULL,
  address TEXT NULL,
  rating NUMERIC(2,1) NOT NULL DEFAULT 0,
  distance NUMERIC(5,2) NULL,
  price_per_night NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_live BOOLEAN NOT NULL DEFAULT false,
  approval_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  description TEXT NULL,
  reviews_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_shelters_rating CHECK (rating >= 0 AND rating <= 5),
  CONSTRAINT chk_shelters_approval_status CHECK (approval_status IN ('pending', 'approved', 'rejected'))
);
