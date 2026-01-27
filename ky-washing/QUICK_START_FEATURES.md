# Quick Start: New Features 🚀

## 1️⃣ Report No One Feature

### For Users
When you see a machine running but nobody is using it:

```
1. Find the running machine card
2. Click the yellow "⚠️ Report No One (X/2)" button
3. First report: See "One Report Logged" message
4. If another user reports the same machine → MACHINE AUTO-UNLOCKS! ✨
5. Machine resets to "available" for next user
```

### How It Works Behind the Scenes
```
User 1 clicks "Report No One"     → Machine Reports: 1/2
User 2 clicks "Report No One"     → Machine Reports: 2/2 ✅
Timer stops immediately           → Status: AVAILABLE
All data cleared                  → Next user can start
```

---

## 2️⃣ Machine is Ready Feature

### For Users
When a machine cycle is done but owner forgot to collect clothes:

```
1. See machine in "completed" status
2. Machine owner sees: "✅ Collect Your Clothes" button
3. Other users see: "📦 Machine is Ready (Help Reset)" button

IF YOU'RE NOT THE OWNER:
4. Click "Machine is Ready (Help Reset)"
5. Modal asks for confirmation
6. Click "✅ Yes, Reset It"
7. Machine goes back to "available"
8. Next user can start immediately ✨
```

### How It Works
```
Machine cycle completes
    ↓
Status: COMPLETED, Timer: 0
    ↓
Owner can collect clothes OR
Other user can confirm "Machine is Ready"
    ↓
Machine resets to AVAILABLE
Next user can start
```

---

## 3️⃣ Timer Management

### Timer States

| Status | Timer | Action |
|--------|-------|--------|
| Available | N/A | Start button visible |
| In-Use | Counting down | Report No One button visible |
| Timer reaches 0 | STOPS | Changes to "Completed" |
| After 2 reports | STOPS | Resets to "Available" |
| Clothes collected | RESET | Back to "Available" |

### Important: No Timer Drift
- Timer is always server-synchronized
- Updates from Supabase every 10 seconds
- Local timer counts down every second
- Automatically corrects if out of sync

---

## Setup Checklist ✅

### Required Database Table
```sql
-- Run this in Supabase SQL Editor
CREATE TABLE IF NOT EXISTS public.machine_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id INTEGER NOT NULL,
  machine_type TEXT NOT NULL CHECK (machine_type IN ('washer', 'dryer')),
  report_type TEXT NOT NULL CHECK (report_type IN ('no_one', 'ready')),
  reported_by TEXT NOT NULL,
  reported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'active'
);
```

Or use the migration file:
```bash
# In Supabase SQL Editor, paste contents of:
# /migrations/add_machine_reports_table.sql
```

### Enable RLS (Row Level Security)
```sql
ALTER TABLE public.machine_reports ENABLE ROW LEVEL SECURITY;

-- Anyone can view
CREATE POLICY "view_reports" ON public.machine_reports
  FOR SELECT USING (true);

-- Anyone can create reports
CREATE POLICY "create_reports" ON public.machine_reports
  FOR INSERT WITH CHECK (true);
```

---

## Code Integration

### For Developers: Using the Reports Service

```typescript
import { machineReportsService } from '@/lib/services/machineReports';

// Record a "No One" report
const result = await machineReportsService.addNoOneReport(
  machineId,        // 1
  'washer',        // 'washer' | 'dryer'
  userId           // user reporting
);
// Returns: { success: true, count: 2 }

// Check report count
const { count } = await machineReportsService.getNoOneReportCount(
  machineId,
  'washer'
);

// Resolve reports when machine is unlocked
await machineReportsService.resolveNoOneReports(machineId, 'washer');

// Record "Machine is Ready"
await machineReportsService.addMachineReadyReport(
  machineId,
  machineType,
  userId
);
```

---

## Notifications

### What Users See

**Report No One - First Report:**
```
⚠️ One "No One" report logged. 
One more report will unlock this machine.
```

**Report No One - Second Report:**
```
✅ Machine Washer #1 has been automatically 
   unlocked after 2 "No One" reports.
```

**Machine is Ready:**
```
✅ Machine Reset
Washer #1 is now available for the next user.
```

---

## Button Visibility Matrix

### When Buttons Appear

| Scenario | Owner | Other Users |
|----------|-------|-------------|
| Machine Available | Start | Start |
| Machine In-Use (them) | Report No One | Report No One |
| Machine In-Use (other) | Report No One | Report No One |
| Machine Completed (them) | Collect Clothes | Machine is Ready |
| Machine Completed (other) | Collect Clothes | Machine is Ready |
| Maintenance | Disabled | Disabled |
| Offline | Disabled | Disabled |

---

## Data Being Stored 📊

### What Gets Logged (Essential Only)

✅ Machine Reports
- Machine ID & Type
- Report type ('no_one' or 'ready')
- Who reported it
- When reported
- Status (active/resolved)

✅ User Sessions
- User ID
- Session ID
- Device type
- Login/logout times
- Session duration

✅ Machine Cycles
- Which machine & type
- User who used it
- Start & end times
- Duration
- Status (in-progress/completed/collected)

❌ NOT Stored (Too Much Data)
- Detailed user agent strings
- Browser capabilities
- Queue wait times
- Notification metadata
- Redundant timestamps

---

## Common Issues & Solutions

### "Report button doesn't work"
✅ Check:
- Are you logged in?
- Is the machine actually in-use?
- Is `machine_reports` table created?
- Check browser console for errors

### "Machine not resetting to available"
✅ Check:
- Did you click "Yes, Reset It" on confirmation?
- Is the status showing 'completed'?
- Refresh the page to re-sync from Supabase

### "Timer still counting after report"
✅ Check:
- Did both reports get submitted (check Supabase)?
- Refresh page - UI should show 'available'
- Check browser console for errors

### "User data not saving to Supabase"
✅ Check:
- Is user logged in with valid user_id?
- Are you using optimized data fields?
- Check Supabase database size
- Review data types match schema

---

## Key Files

| File | Purpose |
|------|---------|
| `/app/machines/page.tsx` | Main UI component |
| `/lib/services/machineReports.ts` | Reporting service |
| `/migrations/add_machine_reports_table.sql` | Database schema |
| `/lib/DATA_OPTIMIZATION_GUIDE.md` | Storage optimization |
| `/IMPLEMENTATION_GUIDE.md` | Full documentation |

---

## Next Steps

1. ✅ Create `machine_reports` table in Supabase
2. ✅ Verify new files are in place
3. ✅ Test Report No One feature
4. ✅ Test Machine is Ready feature
5. ✅ Monitor Supabase data storage
6. ✅ Optimize data collection if needed

---

## Questions?

Review the full **IMPLEMENTATION_GUIDE.md** for detailed documentation including:
- Complete feature explanations
- Timer management details
- Data optimization strategies
- Troubleshooting guide
- Future enhancements
- Testing checklist

Good luck! 🎉
