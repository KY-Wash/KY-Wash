-- Supabase / PostgreSQL schema for KY-Wash
-- Run with psql or `supabase db push`
-- Requires extensions: pgcrypto (for gen_random_uuid)

-- Enable extension (run once per database)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
DO $$BEGIN
    CREATE TYPE machine_status AS ENUM ('available','running','maintenance','pending-collection');
EXCEPTION
    WHEN duplicate_object THEN null;
END$$;

-- Users table (link to Supabase Auth if desired)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id varchar(32) UNIQUE,
  phone_number varchar(16),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Community chat
CREATE TABLE IF NOT EXISTS community_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  student_id varchar(32),
  message text NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_community_chat_created_at ON community_chat(created_at DESC);

-- Feedback (issues / feedbacks)
CREATE TABLE IF NOT EXISTS feedback_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  student_id varchar(32),
  student_name varchar(128),
  message text NOT NULL,
  rating smallint,
  status varchar(32) DEFAULT 'open', -- open / in_progress / closed
  report_count int DEFAULT 0,
  warnings int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_feedback_issues_created_at ON feedback_issues(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_issues_status ON feedback_issues(status);

-- Usage history (washes/dryers)
CREATE TABLE IF NOT EXISTS usage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  student_id varchar(32),
  type varchar(16), -- washer | dryer
  machine_id int,
  mode varchar(64),
  duration int, -- minutes
  spending numeric(8,2),
  status varchar(32) DEFAULT 'In Progress', -- In Progress | Completed | cancelled
  date text,
  timestamp bigint,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_usage_history_student ON usage_history(student_id);
CREATE INDEX IF NOT EXISTS idx_usage_history_created_at ON usage_history(created_at DESC);

-- Machines (optional canonical table)
CREATE TABLE IF NOT EXISTS machines (
  id int NOT NULL,
  type varchar(16) NOT NULL, -- washer | dryer
  status machine_status DEFAULT 'available',
  time_left int DEFAULT 0,
  mode varchar(64),
  locked boolean DEFAULT false,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  original_duration int,
  finish_timestamp bigint, -- Unix timestamp in milliseconds when cycle will complete
  started_at timestamptz,
  target_end_time timestamptz,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (type, id)
);
CREATE INDEX IF NOT EXISTS idx_machines_status ON machines(status);

-- Reported issues (machine-level)
CREATE TABLE IF NOT EXISTS reported_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_type varchar(16),
  machine_id int,
  reported_by varchar(32),
  phone varchar(32),
  description text,
  timestamp bigint,
  date text,
  resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reported_issues_machine ON reported_issues(machine_type, machine_id);

-- Machine collection status (coming / collected)
CREATE TABLE IF NOT EXISTS machine_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  machine_type varchar(16),
  machine_id int,
  status varchar(32), -- waiting | coming | collected
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_machine_collections_machine ON machine_collections(machine_type, machine_id);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action varchar(64),
  machine_type varchar(16),
  machine_id int,
  initiated_by varchar(64),
  reason text,
  timestamp bigint,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- Founders (optional)
CREATE TABLE IF NOT EXISTS founders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(128),
  scholarship varchar(256),
  course varchar(128),
  profile_image varchar(1024),
  created_at timestamptz DEFAULT now()
);

-- Waitlist entries
CREATE TABLE IF NOT EXISTS waitlist_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id varchar(32),
  phone varchar(32),
  machine_type varchar(16), -- washer | dryer
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_waitlist_machine_type ON waitlist_entries(machine_type, created_at);

-- Simple RLS policy examples (change to suit your Auth setup)
-- NOTE: These policies are templates and must be adapted to your auth/user mapping!

-- Enable RLS for community_chat
ALTER TABLE community_chat ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to select all chat
CREATE POLICY "chat_select" ON community_chat
  FOR SELECT USING (true);

-- Allow authenticated users to insert chat (assumes auth is configured)
CREATE POLICY "chat_insert" ON community_chat
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Enable RLS for feedback
ALTER TABLE feedback_issues ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feedback_insert" ON feedback_issues
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "feedback_select" ON feedback_issues
  FOR SELECT USING (true);

-- You should add tighter policies for updates/deletes based on admin roles or ownership.

-- Helpful view: latest chat messages (example)
CREATE OR REPLACE VIEW latest_community_chat AS
  SELECT id, student_id, message, created_at
  FROM community_chat
  ORDER BY created_at DESC
  LIMIT 100;

-- End of schema

-- Usage instructions (brief):
-- 1) Use the Supabase SQL editor or `psql` to run this file against your project database.
-- 2) Configure RLS policies further to match your auth model. Replace auth.role() checks with auth.uid() ownership checks where applicable.
-- 3) Add indexes for performance as your usage grows.

-- Optional: seed initial founders
INSERT INTO founders (name, scholarship, course, profile_image)
SELECT 'Justin Low Chun Xian', 'Yayasan UEM Scholar', 'Data Science', '/founderjustin.jpeg'
WHERE NOT EXISTS (SELECT 1 FROM founders WHERE name = 'Justin Low Chun Xian');

INSERT INTO founders (name, scholarship, course, profile_image)
SELECT 'James Low', 'Khazanah Global Scholar', 'Computer Science', '/founderjames.jpeg'
WHERE NOT EXISTS (SELECT 1 FROM founders WHERE name = 'James Low');
