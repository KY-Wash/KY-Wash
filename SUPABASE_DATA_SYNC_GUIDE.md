# Supabase Data Sync Guide for KY-Wash System

## ✅ What's Been Completed

### Supabase Integration Setup
- ✅ Supabase client libraries installed (@supabase/ssr, @supabase/supabase-js)
- ✅ Environment variables configured:
  - `NEXT_PUBLIC_SUPABASE_URL`: https://yphqprwticiakwaqlocn.supabase.co
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: (set in .env.local)
- ✅ Three utility files created and configured:
  - `utils/supabase/client.ts` - Browser-side Supabase client
  - `utils/supabase/server.ts` - Server-side Supabase client with cookies
  - `utils/supabase/middleware.ts` - Authentication middleware
- ✅ Dark mode toggle added to admin panel
- ✅ Build succeeds - code is production-ready
- ✅ Code pushed to Git

## 🚀 Next Steps to Enable Data Sync

### Step 1: Create Supabase Table for Usage History

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project: **KY-Wash**
3. Navigate to **SQL Editor**
4. Create a new query and run this SQL:

```sql
CREATE TABLE IF NOT EXISTS usage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  studentId TEXT NOT NULL,
  phone_number TEXT,
  type TEXT NOT NULL,
  machine_id INTEGER,
  mode TEXT,
  duration INTEGER,
  spending NUMERIC,
  status TEXT DEFAULT 'active',
  date TEXT,
  timestamp BIGINT,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_usage_studentid ON usage_history(studentId);
CREATE INDEX IF NOT EXISTS idx_usage_timestamp ON usage_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_date ON usage_history(date);
```

### Step 2: Enable Row Level Security (RLS) - Optional but Recommended

1. In Supabase Dashboard, go to **Authentication > Policies**
2. Click on the `usage_history` table
3. Enable RLS and add this policy for insert (if you want):

```sql
-- Allow authenticated users to insert their own records
CREATE POLICY "Users can insert their own records"
ON usage_history FOR INSERT
WITH CHECK (
  auth.uid()::text = studentId OR true -- Allow until auth is fully set up
);
```

### Step 3: Verify Data Sync Code

The KY-Wash system already has code to sync data. Check these files:

**[lib/supabase.ts](lib/supabase.ts)** - Contains two key functions:
- `insertUsageRecord()` - Inserts new usage records when machines are started
- `updateUsageRecordStatus()` - Updates status when machines complete

These functions are called automatically in `app/page.tsx` when:
1. User starts a machine → `insertUsageRecord()` creates new record
2. Machine finishes or is stopped → `updateUsageRecordStatus()` updates the record

### Step 4: Test the Connection

1. **Local Testing:**
   ```bash
   npm run dev
   ```
   - Open admin panel
   - Start a machine
   - Check Supabase Dashboard > Database > Tables > `usage_history`
   - You should see the new record appear within a few seconds

2. **Monitor in Real-time:**
   - In Supabase Dashboard, go to `usage_history` table
   - Click "Realtime" button to see live updates
   - Each machine start should appear as a new row

### Step 5: Deploy to Vercel

1. **Push code (already done):**
   ```bash
   git push origin main
   ```

2. **Vercel will auto-deploy**, or manually deploy:
   ```bash
   vercel deploy
   ```

3. **Set environment variables in Vercel:**
   - Go to [Vercel Dashboard](https://vercel.com)
   - Select your project
   - Settings > Environment Variables
   - Add:
     - `NEXT_PUBLIC_SUPABASE_URL`: https://yphqprwticiakwaqlocn.supabase.co
     - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: (your anon key from Supabase)

### Step 6: Verify Production Deployment

1. Visit your Vercel deployed URL
2. Use the admin panel to start/stop machines
3. Go to Supabase Dashboard to verify records are syncing

## 📊 Data Structure Explanation

Each usage record contains:

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique record identifier |
| `studentId` | TEXT | Student/User ID |
| `phone_number` | TEXT | User's contact number |
| `type` | TEXT | Machine type ('washer' or 'dryer') |
| `machine_id` | INTEGER | Which machine number |
| `mode` | TEXT | Wash/dry mode selected |
| `duration` | INTEGER | Time in seconds |
| `spending` | NUMERIC | Cost in currency |
| `status` | TEXT | 'active', 'completed', 'stopped' |
| `date` | TEXT | Date string (YYYY-MM-DD format) |
| `timestamp` | BIGINT | Unix timestamp |
| `created_at` | TIMESTAMP | Record creation time |
| `updated_at` | TIMESTAMP | Last update time |

## 🔍 Troubleshooting

### Data Not Appearing in Supabase

1. **Check environment variables:**
   ```bash
   cat .env.local | grep SUPABASE
   ```
   Should show NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

2. **Check browser console for errors:**
   - Open DevTools (F12) > Console
   - Start a machine and look for any errors
   - Should see successful insert if working

3. **Verify Supabase credentials:**
   - In Supabase Dashboard > Settings > API
   - Copy the correct ANON_KEY (not SERVICE_ROLE_KEY)
   - Update .env.local

4. **Check RLS Policies:**
   - If records can't insert, RLS policies may be blocking
   - Temporarily disable RLS to test: Dashboard > Tables > `usage_history` > RLS toggle

### Build Errors

If you see build errors after changes:
```bash
npm run build
```

Should show: `✓ Compiled successfully`

## 💾 Backup Existing Data

Before making changes, backup your Supabase data:

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Settings > Backups
3. Create a manual backup

## 📈 Next Advanced Features

Once data sync is working, you can add:

1. **Export to CSV** - Already partially implemented, use Supabase data
2. **Real-time Dashboard** - Use Supabase Realtime subscriptions
3. **Analytics** - Supabase can generate usage reports
4. **Scheduled Tasks** - Clean old records automatically
5. **Data Analysis** - Query spending trends, machine usage patterns

## 🎯 Quick Reference

**Key Files:**
- Config: `utils/supabase/` (client, server, middleware)
- Database functions: `lib/supabase.ts`
- Main UI: `app/page.tsx`
- API route: `pages/api/state.ts`

**Useful Links:**
- [Supabase Dashboard](https://app.supabase.com)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js + Supabase Guide](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Vercel Dashboard](https://vercel.com)

## ❓ Need Help?

If you encounter issues:
1. Check Supabase Dashboard for table creation status
2. Verify environment variables are set correctly
3. Check browser console (F12 > Console) for JavaScript errors
4. Review `.env.local` file has correct credentials
5. Ensure `npm run build` completes successfully

---

**Status:** ✅ Ready for Supabase data sync setup
**Last Updated:** 2024
**Next Step:** Create `usage_history` table in Supabase
