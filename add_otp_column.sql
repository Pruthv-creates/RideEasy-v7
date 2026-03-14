-- Add OTP code column to rides table
ALTER TABLE rides ADD COLUMN IF NOT EXISTS otp_code text;

-- Update existing requested/accepted rides with a random OTP if they don't have one
-- This is just for existing test data
UPDATE rides 
SET otp_code = floor(random() * 9000 + 1000)::text 
WHERE otp_code IS NULL AND status IN ('requested', 'accepted', 'arrived');
