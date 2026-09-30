-- Migration 010: Create indexes for performance optimization

-- phone_verifications
CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone_expires ON phone_verifications (phone_number, expires_at);

-- shelters
CREATE INDEX IF NOT EXISTS idx_shelters_approval_status ON shelters (approval_status);
CREATE INDEX IF NOT EXISTS idx_shelters_is_live ON shelters (is_live);

-- bookings
CREATE INDEX IF NOT EXISTS idx_bookings_user_start_date ON bookings (user_id, start_date);
CREATE INDEX IF NOT EXISTS idx_bookings_shelter_dates ON bookings (shelter_id, start_date, end_date);

-- activities
CREATE INDEX IF NOT EXISTS idx_activities_booking_date_desc ON activities (booking_id, date DESC);

-- messages
CREATE INDEX IF NOT EXISTS idx_messages_booking_created_at ON messages (booking_id, created_at);

-- pets
CREATE INDEX IF NOT EXISTS idx_pets_owner_id ON pets (owner_id);

-- reviews
CREATE INDEX IF NOT EXISTS idx_reviews_shelter_created_at_desc ON reviews (shelter_id, created_at DESC);
