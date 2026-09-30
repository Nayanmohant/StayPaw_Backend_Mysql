-- Migration 002: Create user_auth_providers table
CREATE TABLE IF NOT EXISTS user_auth_providers (
  id VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL,
  provider_user_id VARCHAR(255) NULL,
  provider_email VARCHAR(150) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_user_auth_providers_provider CHECK (provider IN ('email', 'google', 'apple', 'phone')),
  CONSTRAINT uq_user_auth_providers_provider_user UNIQUE (provider, provider_user_id)
);
