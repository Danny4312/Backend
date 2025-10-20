-- Create traveler_stories table
CREATE TABLE IF NOT EXISTS traveler_stories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  story TEXT NOT NULL,
  location VARCHAR(255) NOT NULL,
  duration VARCHAR(100),
  highlights JSONB DEFAULT '[]',
  media JSONB DEFAULT '[]',
  is_approved BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create story_likes table
CREATE TABLE IF NOT EXISTS story_likes (
  id SERIAL PRIMARY KEY,
  story_id INTEGER REFERENCES traveler_stories(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(story_id, user_id)
);

-- Create story_comments table
CREATE TABLE IF NOT EXISTS story_comments (
  id SERIAL PRIMARY KEY,
  story_id INTEGER REFERENCES traveler_stories(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  comment TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create service_promotions table (for tracking promotion payments)
CREATE TABLE IF NOT EXISTS service_promotions (
  id SERIAL PRIMARY KEY,
  service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
  duration_days INTEGER NOT NULL,
  cost DECIMAL(10,2) NOT NULL,
  payment_method VARCHAR(50),
  payment_reference VARCHAR(100),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_traveler_stories_user_id ON traveler_stories(user_id);
CREATE INDEX IF NOT EXISTS idx_traveler_stories_approved ON traveler_stories(is_approved, is_active);
CREATE INDEX IF NOT EXISTS idx_story_likes_story_id ON story_likes(story_id);
CREATE INDEX IF NOT EXISTS idx_story_comments_story_id ON story_comments(story_id);
CREATE INDEX IF NOT EXISTS idx_service_promotions_service_id ON service_promotions(service_id);
CREATE INDEX IF NOT EXISTS idx_service_promotions_expires_at ON service_promotions(expires_at);

-- Add featured fields to services table if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='services' AND column_name='is_featured') THEN
    ALTER TABLE services ADD COLUMN is_featured BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='services' AND column_name='featured_until') THEN
    ALTER TABLE services ADD COLUMN featured_until TIMESTAMP;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='services' AND column_name='featured_priority') THEN
    ALTER TABLE services ADD COLUMN featured_priority INTEGER DEFAULT 0;
  END IF;
END $$;

-- Create uploads directory structure (run this manually on server)
-- mkdir -p uploads/stories
-- chmod 755 uploads/stories
