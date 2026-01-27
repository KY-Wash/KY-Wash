-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Machine Reports Table
-- Tracks 'No One' reports and 'Machine is Ready' confirmations
CREATE TABLE IF NOT EXISTS public.machine_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id INTEGER NOT NULL,
  machine_type TEXT NOT NULL CHECK (machine_type IN ('washer', 'dryer')),
  report_type TEXT NOT NULL CHECK (report_type IN ('no_one', 'ready')),
  reported_by TEXT NOT NULL,
  reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS machine_reports_machine_idx 
  ON public.machine_reports(machine_id, machine_type);

CREATE INDEX IF NOT EXISTS machine_reports_type_idx 
  ON public.machine_reports(report_type, status);

CREATE INDEX IF NOT EXISTS machine_reports_created_idx 
  ON public.machine_reports(created_at DESC);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_machine_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_machine_reports_timestamp ON public.machine_reports;
CREATE TRIGGER update_machine_reports_timestamp
BEFORE UPDATE ON public.machine_reports
FOR EACH ROW
EXECUTE FUNCTION update_machine_reports_updated_at();

-- RLS Policies
ALTER TABLE public.machine_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can view reports
CREATE POLICY "Enable read access for all users" ON public.machine_reports
  FOR SELECT USING (true);

-- Anyone can create reports
CREATE POLICY "Enable insert for all users" ON public.machine_reports
  FOR INSERT WITH CHECK (true);

-- Only admins can update/delete (future enhancement)
CREATE POLICY "Enable update for service role" ON public.machine_reports
  FOR UPDATE USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY "Enable delete for service role" ON public.machine_reports
  FOR DELETE USING (auth.role() = 'service_role' OR auth.role() = 'authenticated');
