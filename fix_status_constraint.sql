-- Fix status constraint to include 'arrived'
ALTER TABLE rides DROP CONSTRAINT IF EXISTS rides_status_check;
ALTER TABLE rides ADD CONSTRAINT rides_status_check CHECK (status IN ('requested', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled'));
