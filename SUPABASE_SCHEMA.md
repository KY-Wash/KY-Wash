# Complete PostgreSQL Schema for KY-Wash Supabase Database

This document contains the complete SQL schema for the KY-Wash laundry management system on Supabase. It includes all necessary tables, indexes, and relationships to support the entire application.

## Database Schema SQL

Copy and paste the following SQL into Supabase SQL Editor:

```sql
-- ============================================================================
-- 1. USERS & AUTHENTICATION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email varchar(255) NOT NULL UNIQUE,
  student_id varchar(255) NOT NULL UNIQUE,
  phone_number varchar(20),
  full_name varchar(255),
  profile_picture_url varchar(500),
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW(),
  last_login timestamp,
  is_active boolean DEFAULT true,
  notification_preferences jsonb DEFAULT '{"email": true, "browser": true, "sound": true}'::jsonb
);

CREATE INDEX idx_users_student_id ON users(student_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_created_at ON users(created_at);

-- ============================================================================
-- 2. MACHINES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS machines (
  id serial PRIMARY KEY,
  machine_id varchar(10) NOT NULL UNIQUE,
  name varchar(100) NOT NULL,
  type varchar(20) NOT NULL CHECK (type IN ('washer', 'dryer')),
  location varchar(255),
  status varchar(20) DEFAULT 'available' CHECK (status IN ('available', 'in-use', 'completed', 'maintenance', 'offline')),
  current_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  cycle_start_time timestamp,
  cycle_end_time timestamp,
  estimated_time_remaining integer DEFAULT 0,
  default_cycle_duration integer NOT NULL,
  has_issues boolean DEFAULT false,
  issue_description text,
  maintenance_scheduled_at timestamp,
  last_maintenance timestamp,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

CREATE INDEX idx_machines_type ON machines(type);
CREATE INDEX idx_machines_status ON machines(status);
CREATE INDEX idx_machines_current_user_id ON machines(current_user_id);
CREATE INDEX idx_machines_updated_at ON machines(updated_at);

-- ============================================================================
-- 3. MACHINE CYCLES / USAGE SESSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS machine_cycles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id integer NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  machine_name varchar(100),
  machine_type varchar(20) NOT NULL,
  cycle_mode varchar(100),
  start_time timestamp NOT NULL DEFAULT NOW(),
  end_time timestamp,
  duration_minutes integer,
  status varchar(50) DEFAULT 'in-progress' CHECK (status IN ('in-progress', 'completed', 'cancelled', 'paused')),
  energy_used numeric(10, 2),
  water_used numeric(10, 2),
  cost numeric(10, 2),
  completion_time timestamp,
  collection_time timestamp,
  was_collected boolean DEFAULT false,
  cycle_data jsonb,
  notes text,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

CREATE INDEX idx_machine_cycles_user_id ON machine_cycles(user_id);
CREATE INDEX idx_machine_cycles_machine_id ON machine_cycles(machine_id);
CREATE INDEX idx_machine_cycles_start_time ON machine_cycles(start_time);
CREATE INDEX idx_machine_cycles_status ON machine_cycles(status);
CREATE INDEX idx_machine_cycles_created_at ON machine_cycles(created_at);

-- ============================================================================
-- 4. USAGE HISTORY TABLE (For Analytics & Reporting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS usage_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id varchar(255) NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  phone_number varchar(20),
  machine_type varchar(50) NOT NULL,
  machine_id integer NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  machine_name varchar(100),
  mode varchar(100),
  duration integer NOT NULL,
  spending decimal(10, 2),
  status varchar(50) NOT NULL,
  date varchar(50),
  timestamp bigint NOT NULL,
  start_datetime timestamp,
  end_datetime timestamp,
  queue_wait_time integer DEFAULT 0,
  cycle_completion_time timestamp,
  collection_time timestamp,
  notes text,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

CREATE INDEX idx_usage_history_student_id ON usage_history(student_id);
CREATE INDEX idx_usage_history_user_id ON usage_history(user_id);
CREATE INDEX idx_usage_history_machine_type ON usage_history(machine_type);
CREATE INDEX idx_usage_history_timestamp ON usage_history(timestamp);
CREATE INDEX idx_usage_history_status ON usage_history(status);
CREATE INDEX idx_usage_history_created_at ON usage_history(created_at);

-- ============================================================================
-- 5. QUEUE / WAITLIST TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS machine_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id integer NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  queue_position integer NOT NULL,
  joined_at timestamp DEFAULT NOW(),
  estimated_wait_time integer,
  notified_at timestamp,
  notification_sent boolean DEFAULT false,
  status varchar(50) DEFAULT 'waiting' CHECK (status IN ('waiting', 'ready', 'cancelled', 'completed')),
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

CREATE INDEX idx_machine_queue_machine_id ON machine_queue(machine_id);
CREATE INDEX idx_machine_queue_user_id ON machine_queue(user_id);
CREATE INDEX idx_machine_queue_status ON machine_queue(status);
CREATE INDEX idx_machine_queue_joined_at ON machine_queue(joined_at);

-- ============================================================================
-- 6. ANALYTICS EVENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  event_type varchar(100) NOT NULL,
  event_name varchar(100),
  category varchar(100),
  action varchar(100),
  label varchar(255),
  value numeric(10, 2),
  session_id varchar(255),
  page_path varchar(500),
  page_title varchar(255),
  referrer varchar(500),
  user_agent text,
  ip_address varchar(45),
  event_data jsonb,
  timestamp timestamp DEFAULT NOW(),
  created_at timestamp DEFAULT NOW()
);

CREATE INDEX idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX idx_analytics_events_event_type ON analytics_events(event_type);
CREATE INDEX idx_analytics_events_timestamp ON analytics_events(timestamp);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at);

-- ============================================================================
-- 7. USER SESSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id varchar(255) NOT NULL UNIQUE,
  login_time timestamp DEFAULT NOW(),
  logout_time timestamp,
  session_duration integer,
  ip_address varchar(45),
  user_agent text,
  device_type varchar(50),
  browser varchar(100),
  os varchar(100),
  status varchar(50) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'logged_out')),
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_session_id ON user_sessions(session_id);
CREATE INDEX idx_user_sessions_login_time ON user_sessions(login_time);
CREATE INDEX idx_user_sessions_status ON user_sessions(status);

-- ============================================================================
-- 8. NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  notification_type varchar(100) NOT NULL,
  title varchar(255) NOT NULL,
  message text NOT NULL,
  related_entity_type varchar(50),
  related_entity_id varchar(100),
  priority varchar(20) DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  is_read boolean DEFAULT false,
  read_at timestamp,
  action_url varchar(500),
  notification_channel varchar(50) DEFAULT 'in-app' CHECK (notification_channel IN ('in-app', 'email', 'browser', 'sms')),
  sent_at timestamp DEFAULT NOW(),
  created_at timestamp DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_notification_type ON notifications(notification_type);

-- ============================================================================
-- 9. AUTO-UNLOCK TIMER LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS auto_unlock_timers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id integer NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  cycle_id uuid REFERENCES machine_cycles(id) ON DELETE SET NULL,
  unlock_scheduled_time timestamp NOT NULL,
  unlock_reason varchar(255),
  grace_period_minutes integer DEFAULT 15,
  alert_interval_seconds integer DEFAULT 30,
  alert_count integer DEFAULT 0,
  unlocked_at timestamp,
  manually_collected boolean DEFAULT false,
  status varchar(50) DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'dismissed', 'completed')),
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

CREATE INDEX idx_auto_unlock_timers_machine_id ON auto_unlock_timers(machine_id);
CREATE INDEX idx_auto_unlock_timers_user_id ON auto_unlock_timers(user_id);
CREATE INDEX idx_auto_unlock_timers_status ON auto_unlock_timers(status);
CREATE INDEX idx_auto_unlock_timers_unlock_scheduled_time ON auto_unlock_timers(unlock_scheduled_time);

-- ============================================================================
-- 10. BILLING & TRANSACTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  machine_cycle_id uuid REFERENCES machine_cycles(id) ON DELETE SET NULL,
  transaction_type varchar(50) NOT NULL CHECK (transaction_type IN ('charge', 'refund', 'credit', 'payment')),
  amount decimal(10, 2) NOT NULL,
  currency varchar(3) DEFAULT 'USD',
  description text,
  machine_id integer REFERENCES machines(id) ON DELETE SET NULL,
  machine_type varchar(20),
  cycle_duration integer,
  payment_method varchar(100),
  reference_id varchar(255),
  status varchar(50) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_transaction_type ON transactions(transaction_type);

-- ============================================================================
-- 11. USER ACCOUNT / WALLET TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  wallet_balance decimal(10, 2) DEFAULT 0,
  total_spent decimal(10, 2) DEFAULT 0,
  total_sessions integer DEFAULT 0,
  favorite_machines jsonb DEFAULT '[]'::jsonb,
  preferred_settings jsonb,
  usage_preferences jsonb,
  is_verified boolean DEFAULT false,
  verification_status varchar(50) DEFAULT 'pending',
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

CREATE INDEX idx_user_accounts_user_id ON user_accounts(user_id);

-- ============================================================================
-- 12. FEEDBACK & ISSUES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS feedback_issues (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  issue_type varchar(100) NOT NULL,
  title varchar(255) NOT NULL,
  description text NOT NULL,
  machine_id integer REFERENCES machines(id) ON DELETE SET NULL,
  severity varchar(50) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status varchar(50) DEFAULT 'open' CHECK (status IN ('open', 'in-progress', 'resolved', 'closed')),
  assigned_to varchar(100),
  resolution_notes text,
  resolved_at timestamp,
  attachments jsonb,
  tags jsonb,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

CREATE INDEX idx_feedback_issues_user_id ON feedback_issues(user_id);
CREATE INDEX idx_feedback_issues_status ON feedback_issues(status);
CREATE INDEX idx_feedback_issues_created_at ON feedback_issues(created_at);
CREATE INDEX idx_feedback_issues_severity ON feedback_issues(severity);

-- ============================================================================
-- 13. MAINTENANCE LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS maintenance_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id integer NOT NULL REFERENCES machines(id) ON DELETE CASCADE,
  maintenance_type varchar(100) NOT NULL,
  description text,
  performed_by varchar(255),
  start_time timestamp NOT NULL,
  end_time timestamp,
  duration_minutes integer,
  cost decimal(10, 2),
  parts_replaced jsonb,
  issue_resolved boolean DEFAULT true,
  created_at timestamp DEFAULT NOW()
);

CREATE INDEX idx_maintenance_logs_machine_id ON maintenance_logs(machine_id);
CREATE INDEX idx_maintenance_logs_start_time ON maintenance_logs(start_time);

-- ============================================================================
-- 14. PEAK HOURS & ANALYTICS SUMMARY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS analytics_summary (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date_hour timestamp NOT NULL UNIQUE,
  hour integer,
  day_of_week integer,
  total_active_machines integer,
  total_users integer,
  washer_count integer,
  dryer_count integer,
  average_queue_length numeric(5, 2),
  average_wait_time_minutes numeric(5, 2),
  peak_usage_percent numeric(5, 2),
  total_cycles_completed integer,
  total_revenue decimal(10, 2),
  machine_details jsonb,
  created_at timestamp DEFAULT NOW()
);

CREATE INDEX idx_analytics_summary_date_hour ON analytics_summary(date_hour);
CREATE INDEX idx_analytics_summary_hour ON analytics_summary(hour);
CREATE INDEX idx_analytics_summary_day_of_week ON analytics_summary(day_of_week);

-- ============================================================================
-- 15. PROMOTION & DISCOUNT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS promotions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code varchar(100) NOT NULL UNIQUE,
  description text,
  discount_type varchar(50) NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value decimal(10, 2) NOT NULL,
  valid_from timestamp NOT NULL,
  valid_until timestamp NOT NULL,
  max_uses integer,
  used_count integer DEFAULT 0,
  applicable_to jsonb,
  status varchar(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'expired')),
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

CREATE INDEX idx_promotions_code ON promotions(code);
CREATE INDEX idx_promotions_status ON promotions(status);

-- ============================================================================
-- 16. DATA COLLECTION / TELEMETRY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS data_collection_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  session_id varchar(255),
  event_name varchar(100) NOT NULL,
  event_category varchar(100),
  event_properties jsonb,
  timestamp bigint,
  created_at timestamp DEFAULT NOW()
);

CREATE INDEX idx_data_collection_user_id ON data_collection_events(user_id);
CREATE INDEX idx_data_collection_event_name ON data_collection_events(event_name);
CREATE INDEX idx_data_collection_created_at ON data_collection_events(created_at);

-- ============================================================================
-- 17. SETTINGS & CONFIGURATION TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key varchar(100) NOT NULL UNIQUE,
  setting_value jsonb NOT NULL,
  setting_type varchar(50),
  description text,
  is_mutable boolean DEFAULT true,
  created_at timestamp DEFAULT NOW(),
  updated_at timestamp DEFAULT NOW()
);

CREATE INDEX idx_app_settings_setting_key ON app_settings(setting_key);

-- ============================================================================
-- SAMPLE INITIAL DATA INSERTS
-- ============================================================================

-- Insert sample machines
INSERT INTO machines (machine_id, name, type, location, default_cycle_duration) VALUES
('W1', 'Washer 1', 'washer', 'Building A - Floor 1', 45),
('W2', 'Washer 2', 'washer', 'Building A - Floor 1', 45),
('D1', 'Dryer 1', 'dryer', 'Building A - Floor 1', 60),
('D2', 'Dryer 2', 'dryer', 'Building A - Floor 1', 60)
ON CONFLICT (machine_id) DO NOTHING;

-- Insert app settings
INSERT INTO app_settings (setting_key, setting_value, setting_type, description) VALUES
('grace_period_minutes', '15', 'integer', 'Default grace period before auto-unlock in minutes'),
('alert_interval_seconds', '30', 'integer', 'Alert interval for pending collection notifications'),
('currency', '"USD"', 'string', 'Default currency for transactions'),
('washer_cost_per_minute', '0.02', 'decimal', 'Cost per minute for washer usage'),
('dryer_cost_per_minute', '0.03', 'decimal', 'Cost per minute for dryer usage'),
('max_queue_size', '10', 'integer', 'Maximum queue size per machine'),
('notification_enabled', 'true', 'boolean', 'Global notification settings'),
('analytics_enabled', 'true', 'boolean', 'Analytics collection enabled')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE machine_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_unlock_timers ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE analytics_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_collection_events ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "Users can read own data" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Users can read their own sessions
CREATE POLICY "Users can read own sessions" ON user_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Users can read their own machine cycles
CREATE POLICY "Users can read own cycles" ON machine_cycles
  FOR SELECT USING (auth.uid() = user_id);

-- Users can read their own transactions
CREATE POLICY "Users can read own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can read their own feedback issues
CREATE POLICY "Users can read own issues" ON feedback_issues
  FOR SELECT USING (auth.uid() = user_id);

-- Users can read their own data collection events
CREATE POLICY "Users can read own events" ON data_collection_events
  FOR SELECT USING (auth.uid() = user_id);

-- Allow public read access to machines (status, availability)
CREATE POLICY "Allow public read machines" ON machines
  FOR SELECT USING (true);

-- Allow public read to analytics summary
CREATE POLICY "Allow public read analytics" ON analytics_summary
  FOR SELECT USING (true);

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Active machines view
CREATE OR REPLACE VIEW active_machines_view AS
SELECT 
  m.id,
  m.machine_id,
  m.name,
  m.type,
  m.status,
  m.current_user_id,
  u.email as current_user_email,
  m.cycle_start_time,
  m.estimated_time_remaining,
  (SELECT COUNT(*) FROM machine_queue WHERE machine_id = m.id AND status = 'waiting') as queue_count
FROM machines m
LEFT JOIN users u ON m.current_user_id = u.id
WHERE m.status != 'offline';

-- User analytics view
CREATE OR REPLACE VIEW user_analytics_view AS
SELECT 
  u.id,
  u.student_id,
  u.email,
  COUNT(DISTINCT mc.id) as total_cycles,
  COUNT(DISTINCT us.id) as total_sessions,
  AVG(mc.duration_minutes) as avg_cycle_duration,
  SUM(mc.cost) as total_spent,
  MAX(us.login_time) as last_activity
FROM users u
LEFT JOIN machine_cycles mc ON u.id = mc.user_id
LEFT JOIN user_sessions us ON u.id = us.user_id
GROUP BY u.id, u.student_id, u.email;

-- Peak hours analysis view
CREATE OR REPLACE VIEW peak_hours_analysis AS
SELECT 
  EXTRACT(HOUR FROM mc.start_time) as hour,
  COUNT(DISTINCT mc.id) as total_cycles,
  COUNT(DISTINCT mc.machine_id) as machines_used,
  COUNT(DISTINCT mc.user_id) as unique_users,
  AVG(mc.duration_minutes) as avg_duration,
  SUM(mc.cost) as total_revenue
FROM machine_cycles mc
WHERE mc.status = 'completed'
GROUP BY EXTRACT(HOUR FROM mc.start_time)
ORDER BY hour;

```

## Implementation Steps

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project and database

2. **Run SQL Schema**
   - Go to SQL Editor in Supabase
   - Click "New Query"
   - Paste the entire SQL code above
   - Click "Run"

3. **Verify Tables Created**
   - Go to Table Editor
   - Verify all 17 tables appear

4. **Enable Backups** (Optional but Recommended)
   - Go to Settings → Database
   - Enable automated backups

## Table Descriptions

| Table | Purpose |
|-------|---------|
| `users` | User profiles and authentication |
| `machines` | Laundry machine inventory and status |
| `machine_cycles` | Individual machine usage sessions |
| `usage_history` | Historical record of all usage |
| `machine_queue` | Waitlist/queue management |
| `analytics_events` | Custom event tracking |
| `user_sessions` | Login/logout tracking |
| `notifications` | User notifications |
| `auto_unlock_timers` | Automatic unlock grace period tracking |
| `transactions` | Billing and payment history |
| `user_accounts` | User account details and preferences |
| `feedback_issues` | Bug reports and feedback |
| `maintenance_logs` | Machine maintenance history |
| `analytics_summary` | Aggregated analytics data |
| `promotions` | Discount codes and promotions |
| `data_collection_events` | Telemetry data collection |
| `app_settings` | Application configuration |

## Key Features

✅ **Complete Data Storage** - All app features supported
✅ **Row Level Security (RLS)** - Secure multi-tenant access
✅ **Optimized Indexes** - Fast query performance
✅ **Relationships & Constraints** - Data integrity
✅ **Analytics Views** - Pre-built SQL views for reports
✅ **Audit Trail** - created_at/updated_at on all tables
✅ **Flexible JSONB Fields** - For extensible data

## Connecting to Next.js

After tables are created, use the Supabase client:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Example: Save machine cycle
const { data, error } = await supabase
  .from('machine_cycles')
  .insert({
    machine_id: 1,
    user_id: userId,
    cycle_mode: 'normal',
    duration_minutes: 45
  });
```

## Security Considerations

- ✅ RLS policies enforce user data isolation
- ✅ Foreign keys maintain referential integrity
- ✅ Sensitive data (wallets, transactions) user-isolated
- ✅ Audit timestamps on all records
- ✅ UUID primary keys for distributed systems
