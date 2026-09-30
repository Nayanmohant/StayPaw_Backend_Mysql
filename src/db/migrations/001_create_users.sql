-- Migration 001: Create users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NULL,
  password_hash VARCHAR(255) NULL,
  phone_number VARCHAR(30) UNIQUE NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'customer',
  avatar_url TEXT NULL,
  is_admin_approved BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_users_role CHECK (role IN ('customer', 'shelter_admin', 'super_admin'))
);
