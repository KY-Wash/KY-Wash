alter table public.machines
  add column if not exists started_at timestamptz,
  add column if not exists target_end_time timestamptz;