# KY-Wash: Two New Features Implementation Guide

## Overview
Two powerful features have been added to improve machine usage and user experience:
1. **Report No One** - Automatic machine unlock after 2 reports
2. **Machine is Ready** - Allow other users to reset completed machines

---

## Feature 1: Report No One 🚨

### What It Does
If 2 users report that a machine is running but appears empty, the machine automatically:
- Stops the timer immediately
- Resets to "available" status
- Clears all user data
- Allows the next user to start immediately

### When to Use
- You see a washer or dryer running but nobody is using it
- The machine has been running for way too long
- There are no clothes visible in the machine

### User Flow

#### First Report
1. Machine is running (in-use status)
2. User clicks "⚠️ Report No One" button
3. Report submitted to Supabase
4. User sees: "⚠️ One Report Logged. One more will unlock this machine."
5. Counter shows: `⚠️ Report No One (1/2)`

#### Second Report (From Any User)
1. Different user clicks "⚠️ Report No One" on the same machine
2. Report submitted to Supabase
3. **Immediate Actions**:
   - Timer stops instantly
   - Machine status → `available`
   - All reports marked as resolved
   - User data cleared
   - Counter resets
4. Users see: "✅ Machine Unlocked"
5. Next user can now start the machine

### Technical Details

#### Database Table: `machine_reports`
```sql
CREATE TABLE machine_reports (
  id UUID PRIMARY KEY,
  machine_id INTEGER,
  machine_type TEXT ('washer' | 'dryer'),
  report_type TEXT ('no_one' | 'ready'),
  reported_by TEXT (user_id),
  reported_at TIMESTAMP,
  status TEXT ('active' | 'resolved'),
  created_at TIMESTAMP
);
```

#### React State Management
- **`noOneReportCounts`**: Map tracking reports per machine
  ```typescript
  Map<string, number> // Key: "washer-1", Value: 2
  ```
- **`machineTimerRef`**: useRef storing timer intervals
  - Instantly cleared when 2 reports reached
  - No countdown after threshold

#### Key Functions
```typescript
handleReportNoOne(machine: Machine) 
  - Adds report to Supabase
  - Increments counter
  - Checks if >= 2
  - Auto-resets machine on 2nd report

machineReportsService.addNoOneReport()
  - Saves report to database
  - Returns current count

machineReportsService.getNoOneReportCount()
  - Fetches active reports
  - Returns count
```

### Implementation in Code

**Location**: `/app/machines/page.tsx`

**State Variables**:
```typescript
const [noOneReportCounts, setNoOneReportCounts] = useState<Map<string, number>>(new Map());
const machineTimersRef = useRef<Map<string, MachineTimer>>(new Map());
```

**Handler**:
```typescript
const handleReportNoOne = async (machine: Machine) => {
  // 1. Get current count
  // 2. Add report to Supabase
  // 3. Update local state
  // 4. If count >= 2: RESET MACHINE
  //    - Stop timer
  //    - Set status to 'available'
  //    - Clear reports
  //    - Notify users
}
```

**UI Elements**:
- Shows `⚠️ Report No One (X/2)` button when machine in-use
- Button color changes based on report count
- Disabled for own machines

---

## Feature 2: Machine is Ready 📦

### What It Does
When a machine finishes its cycle but the owner doesn't collect clothes:
- Other users can confirm the machine is ready
- Machine status resets to "available"
- Next user can immediately start using it
- Original owner gets notified

### When to Use
- Machine cycle completed and is sitting idle
- Owner hasn't collected their clothes
- You see the machine is empty and ready
- **Never use if clothes are still inside!**

### User Flow

#### Machine Completes
1. Machine timer reaches 0
2. Status changes to `completed`
3. Owner sees: "✅ Collect Your Clothes" button
4. Other users see: "📦 Machine is Ready (Help Reset)" button

#### Owner Collects
1. Owner clicks "✅ Collect Your Clothes"
2. Cycle marked as collected
3. Machine resets to `available`
4. All reports cleared

#### Other User Helps Reset
1. Other user clicks "📦 Machine is Ready (Help Reset)"
2. Confirmation modal appears:
   ```
   "This will reset washer #1 to available so the next user 
    can start. Only confirm if the machine is truly empty."
   ```
3. User confirms: "✅ Yes, Reset It"
4. **Machine resets**:
   - Status → `available`
   - Timer → 0
   - Current user → cleared
   - All reports → cleared
5. Modal closes
6. Machine now shows "Start Machine" button for all users

### Technical Details

#### Report Type: 'ready'
```typescript
interface MachineReport {
  id: string;
  machine_id: number;
  machine_type: 'washer' | 'dryer';
  report_type: 'ready' | 'no_one'; // 'ready' for this feature
  reported_by: string; // user_id
  reported_at: timestamp;
  status: 'active' | 'resolved';
}
```

#### Key Functions
```typescript
handleMachineReady(machineId, machineType)
  - Shows confirmation modal
  - Resets machine on confirmation
  - Clears all reports
  - Notifies users

machineReportsService.addMachineReadyReport()
  - Saves ready report
  - Creates audit trail

machineReportsService.getMachineReadyReports()
  - Checks if machine was marked ready
```

### Implementation in Code

**Location**: `/app/machines/page.tsx`

**State**:
```typescript
const [showMachineReadyConfirm, setShowMachineReadyConfirm] = 
  useState<{ machineId: number; machineType: 'washer' | 'dryer' } | null>(null);
```

**Handler**:
```typescript
const handleMachineReady = async (machineId, machineType) => {
  // 1. Add 'ready' report to database
  // 2. Reset machine to 'available'
  // 3. Clear all reports
  // 4. Reset timer
  // 5. Clear current user
  // 6. Notify all users
}
```

**UI Modal**:
```tsx
{showMachineReadyConfirm && (
  <div className="fixed inset-0 bg-black bg-opacity-50 ...">
    <Card>
      <h2>Confirm Machine is Ready</h2>
      <p>This will reset {type} #{id} to available...</p>
      <Button>✅ Yes, Reset It</Button>
      <Button>Cancel</Button>
    </Card>
  </div>
)}
```

---

## Timer Management 🕐

### How It Works

#### Timer Updates Every Second
```typescript
useEffect(() => {
  const interval = setInterval(() => {
    setMachines((prev) =>
      prev.map((machine) => {
        if (machine.timeRemaining > 0) {
          const newTime = Math.max(0, machine.timeRemaining - 1);
          
          // When timer reaches 0
          if (newTime === 0 && machine.timeRemaining > 0) {
            ringNotification(`${machine.name} cycle completed!`);
            // Update status to 'completed'
            return { ...machine, timeRemaining: newTime, status: 'completed' };
          }
          
          return { ...machine, timeRemaining: newTime };
        }
        return machine;
      })
    );
  }, 1000);

  return () => clearInterval(interval);
}, [trackEvent, userId]);
```

#### Timer Stops on Report #2
When 2 "No One" reports are reached:
```typescript
if (newCount >= 2) {
  // Stop timer immediately
  setMachines((prev) =>
    prev.map((m) =>
      m.id === machine.id && m.type === machine.type
        ? {
            ...m,
            status: 'available',
            timeRemaining: 0,        // Timer: 0
            currentUserId: undefined, // Clear user
            noOneReportCount: newCount
          }
        : m
    )
  );

  // Clear from database
  await machineReportsService.resolveNoOneReports(machine.id, machine.type);
}
```

#### Timer Resets on Collection
When owner collects clothes:
```typescript
const handleCollectClothes = async (machine) => {
  setMachines((prev) =>
    prev.map((m) =>
      m.id === machine.id
        ? {
            ...m,
            status: 'available',
            timeRemaining: 0,         // Reset to 0
            unlockTime: undefined,
            currentUserId: undefined,
            noOneReportCount: 0,      // Clear reports
            readyReport: false
          }
        : m
    )
  );

  await machineReportsService.clearMachineReports(machine.id, machine.type);
};
```

---

## Data Storage Optimization 💾

### The Problem
If user data isn't logging to Supabase, it could be:
- **Too many unnecessary variables** being stored
- Storage quota exceeded
- Network issues
- Missing user ID validation

### The Solution

#### Only Store Essential Data
✅ **DO STORE**:
- User ID (tracking who used system)
- Machine ID & type (which machine)
- Start/end times (when used)
- Cycle duration (how long)
- Device type (mobile/tablet/desktop)

❌ **DON'T STORE**:
- User agent strings (use device type instead)
- Browser capabilities
- Queue wait times (calculate on-demand)
- Detailed notification metadata
- Duplicate timestamps
- Redundant session data

#### Example Optimization
**Before** (250 bytes per record):
```typescript
{
  studentId: "user123",
  phoneNumber: "555-1234",
  loginTime: 1234567890,
  logoutTime: 1234567900,
  sessionDuration: 10,
  sessionsTotal: 5,
  lastActiveTime: 1234567890,
  userAgent: "Mozilla/5.0...",    // ❌ Unnecessary
  capabilities: {...},             // ❌ Unnecessary
  location: {...},                 // ❌ Unnecessary
}
```

**After** (80 bytes per record):
```typescript
{
  user_id: "user123",
  session_id: "session_123456",
  login_time: "2026-01-27T10:30:00Z",
  logout_time: "2026-01-27T10:30:10Z",
  session_duration: 10,
  device_type: "mobile"
}
```

**Savings**: 68% storage reduction! ✨

#### Implementation
Use the optimized service:
```typescript
import { optimizedDataCollectionService } from '@/lib/services/optimizedDataCollection';

// Record login - only essential data
await optimizedDataCollectionService.recordUserLogin(userId, deviceType);

// Record machine usage - only essential data
const cycleId = await optimizedDataCollectionService.recordMachineUsage(
  machineId,
  'washer',
  45 // duration minutes
);

// Complete usage
await optimizedDataCollectionService.completeMachineUsage(cycleId);

// Logout
await optimizedDataCollectionService.recordUserLogout(userId, sessionId);
```

### Database Indexes for Performance
```sql
CREATE INDEX machine_reports_machine_idx 
  ON machine_reports(machine_id, machine_type);

CREATE INDEX machine_reports_type_idx 
  ON machine_reports(report_type, status);

CREATE INDEX user_sessions_user_id_idx 
  ON user_sessions(user_id);

CREATE INDEX machine_cycles_user_id_idx 
  ON machine_cycles(user_id);
```

---

## Supabase Setup 🗄️

### SQL Migration
Run this migration in Supabase SQL Editor:

```sql
-- Create machine_reports table
CREATE TABLE IF NOT EXISTS public.machine_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  machine_id INTEGER NOT NULL,
  machine_type TEXT NOT NULL CHECK (machine_type IN ('washer', 'dryer')),
  report_type TEXT NOT NULL CHECK (report_type IN ('no_one', 'ready')),
  reported_by TEXT NOT NULL,
  reported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX machine_reports_machine_idx ON machine_reports(machine_id, machine_type);
CREATE INDEX machine_reports_type_idx ON machine_reports(report_type, status);

-- RLS
ALTER TABLE public.machine_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for all" ON public.machine_reports
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for all" ON public.machine_reports
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for all" ON public.machine_reports
  FOR UPDATE USING (true);
```

---

## File Locations

### New Files Created
- **Service**: `/lib/services/machineReports.ts` - Core reporting service
- **Migration**: `/migrations/add_machine_reports_table.sql` - Database schema
- **Guide**: `/lib/DATA_OPTIMIZATION_GUIDE.md` - Storage optimization
- **This file**: `/IMPLEMENTATION_GUIDE.md` - Feature documentation

### Modified Files
- **Main Component**: `/app/machines/page.tsx`
  - Added report state management
  - Added handlers for both features
  - Added confirmation modal
  - Added report count display

---

## Testing Checklist ✅

### Report No One Feature
- [ ] Machine is running (in-use status)
- [ ] Click "⚠️ Report No One" button
- [ ] See notification "One Report Logged"
- [ ] Counter shows (1/2)
- [ ] Different user clicks button on same machine
- [ ] Machine status changes to "available" immediately
- [ ] Timer stops at 0
- [ ] Counter resets
- [ ] All users see updated state

### Machine is Ready Feature
- [ ] Machine cycle completes
- [ ] Owner sees "✅ Collect Your Clothes" button
- [ ] Other users see "📦 Machine is Ready (Help Reset)" button
- [ ] Click "Machine is Ready" button
- [ ] Confirmation modal appears
- [ ] Click "✅ Yes, Reset It"
- [ ] Machine status → "available"
- [ ] Timer → 0
- [ ] All users see "Start Machine" button

### Timer Management
- [ ] Timer counts down properly (every second)
- [ ] Timer stops at 0
- [ ] Status changes to "completed" when timer reaches 0
- [ ] Report #2 stops timer immediately (no countdown)
- [ ] Collecting clothes resets timer
- [ ] Timer properly displays remaining time

### Data Storage
- [ ] Machine reports saved to Supabase
- [ ] User sessions logged to Supabase
- [ ] Machine cycles created in Supabase
- [ ] No excessive/unnecessary data stored
- [ ] Queries run efficiently with indexes

---

## Troubleshooting 🔧

### Issue: Reports not saving
**Check**:
1. Is `machine_reports` table created in Supabase?
2. Is user logged in (userId available)?
3. Check browser console for errors
4. Verify Supabase URL and keys in `.env`

### Issue: Timer not stopping on report #2
**Check**:
1. Verify timer interval is cleared
2. Check if `newCount >= 2` condition works
3. Ensure state update happens synchronously
4. Check for memory leaks from multiple intervals

### Issue: Machine not resetting to "available"
**Check**:
1. Verify status value is exactly 'available'
2. Ensure currentUserId is undefined
3. Check timeRemaining is set to 0
4. Verify reports are cleared from DB

### Issue: User data not logging
**Check**:
1. Is user ID present and valid?
2. Are you sending only essential fields?
3. Check storage usage in Supabase
4. Review data types match schema
5. Look for foreign key constraint errors

---

## Future Enhancements 🚀

1. **Automatic Escalation**
   - After 3 "No One" reports → maintenance mode
   - Alert admin
   - Prevent machine from running

2. **Machine History**
   - Timeline of all reports per machine
   - Admin dashboard for statistics
   - Identify problematic machines

3. **Smart Notifications**
   - Real-time updates via Socket.io
   - Push notifications to users
   - SMS alerts for critical issues

4. **Report Analytics**
   - Track which machines have most reports
   - Identify patterns (time of day, etc.)
   - Predict maintenance needs

5. **User Reputation**
   - Track helpful "Machine is Ready" confirmations
   - Badge for helpful users
   - Gamification elements

---

## Support

For issues or questions:
1. Check this guide first
2. Review the implementation files
3. Check browser console for errors
4. Review Supabase logs
5. Test with a fresh browser session

Good luck! 🎉
