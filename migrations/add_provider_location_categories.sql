-- Migration: Add location and service categories to service_providers table
-- Date: 2025-10-12

-- Add new columns to service_providers table
ALTER TABLE service_providers 
ADD COLUMN IF NOT EXISTS business_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS service_categories JSONB,
ADD COLUMN IF NOT EXISTS location_data JSONB;

-- Add comments for documentation
COMMENT ON COLUMN service_providers.business_type IS 'Type of business (Hotel/Resort, Tour Operator, etc.)';
COMMENT ON COLUMN service_providers.location IS 'Full location string: Street, Ward, District, Region, Tanzania';
COMMENT ON COLUMN service_providers.service_categories IS 'Array of service categories offered';
COMMENT ON COLUMN service_providers.location_data IS 'Structured location data: {region, district, ward, street}';

-- Create index for faster location-based queries
CREATE INDEX IF NOT EXISTS idx_service_providers_location ON service_providers USING gin(location_data);
CREATE INDEX IF NOT EXISTS idx_service_providers_categories ON service_providers USING gin(service_categories);

-- Update existing records to have empty arrays if null
UPDATE service_providers 
SET service_categories = '[]'::jsonb 
WHERE service_categories IS NULL;

UPDATE service_providers 
SET location_data = '{}'::jsonb 
WHERE location_data IS NULL;
