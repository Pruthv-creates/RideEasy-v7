-- ==============================================
-- 🚀 UPDATE PROFILES SCHEMA
-- ==============================================

-- 1. Add new columns to profiles if they don't exist
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS vehicle_number TEXT;

-- 2. Update RLS (Ensure users can update their own profile)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'profiles' AND policyname = 'Users can update their own profile'
    ) THEN
        CREATE POLICY "Users can update their own profile" 
        ON profiles FOR UPDATE 
        USING (auth.uid() = id);
    END IF;
END $$;
