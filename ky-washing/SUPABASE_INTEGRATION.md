# Supabase Integration Guide - Complete Setup

This guide explains how to fully integrate and use Supabase in the KY-Wash application.

## ✅ What's Now Connected

All data is **automatically synced** to Supabase when:
- ✅ Users log in/out (tracked in `user_sessions` table)
- ✅ Machine cycles start/complete (tracked in `machine_cycles` table)
- ✅ Analytics events occur (tracked in `analytics_events` table)
- ✅ Notifications are sent (tracked in `notifications` table)
- ✅ Machine status changes (updated in `machines` table)

## Step 1: Set Up Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Go to **Settings → API**
4. Copy your credentials:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon Public Key** → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## Step 2: Create Environment Variables

Edit or create `.env.local` in `/ky-washing` directory:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-public-key-here
```

## Step 3: Create Database Tables

1. In Supabase, go to **SQL Editor**
2. Click **New Query**
3. Copy the entire SQL schema from [SUPABASE_SCHEMA.md](../SUPABASE_SCHEMA.md)
4. Paste into the SQL editor
5. Click **Run**

## Step 4: Verify Connection

Start your dev server:
```bash
cd ky-washing
npm run dev
```

Check the browser console - you should see Supabase client initialization messages.

## Available Services

### 1. Machine Cycles Service
```typescript
import { machineCyclesService } from '@/lib/services/machineCycles';

// Start a cycle
const result = await machineCyclesService.startCycle({
  machine_id: 1,
  user_id: 'user-uuid',
  machine_name: 'Washer 1',
  machine_type: 'washer',
  cycle_mode: 'normal',
  duration_minutes: 45,
});

// Complete a cycle
await machineCyclesService.completeCycle(cycleId, {
  cost: 2.50,
  status: 'completed'
});

// Mark as collected
await machineCyclesService.markAsCollected(cycleId);

// Get user's cycles
const cycles = await machineCyclesService.getUserCycles(userId);

// Get active cycles
const active = await machineCyclesService.getActiveCycles();
```

### 2. Analytics Service
```typescript
import { analyticsService } from '@/lib/services/analytics';

// Track an event
await analyticsService.trackEvent({
  user_id: 'user-uuid',
  event_type: 'machine_action',
  event_name: 'machine_started',
  category: 'Machine',
  action: 'start',
  label: 'washer-1',
  value: 45,
});

// Track machine event
await analyticsService.trackMachineEvent('start', machineId, userId, {
  cycleMode: 'normal',
  duration: 45
});

// Get user analytics
const analytics = await analyticsService.getUserAnalytics(userId);

// Get analytics summary
const summary = await analyticsService.getAnalyticsSummary('2024-01-25');

// Get peak hours
const peaks = await analyticsService.getPeakHours(5);
```

### 3. User Sessions Service
```typescript
import { userSessionsService } from '@/lib/services/userSessions';

// Start session
const session = await userSessionsService.startSession({
  user_id: 'user-uuid',
  session_id: 'session-123',
  user_agent: navigator.userAgent,
  device_type: 'desktop',
});

// End session
await userSessionsService.endSession(sessionId);

// Get active sessions
const active = await userSessionsService.getUserActiveSessions(userId);

// Get session details
const session = await userSessionsService.getSession(sessionId);
```

### 4. Machines Service
```typescript
import { machinesService } from '@/lib/services/machines';

// Get all machines
const machines = await machinesService.getAllMachines();

// Get by type
const washers = await machinesService.getMachinesByType('washer');

// Get available machines
const available = await machinesService.getAvailableMachines();

// Get machine by ID
const machine = await machinesService.getMachineById(1);

// Update status
await machinesService.updateMachineStatus(1, 'in-use');

// Create new machine
await machinesService.createMachine({
  machine_id: 'W3',
  name: 'Washer 3',
  type: 'washer',
  location: 'Building A',
  default_cycle_duration: 45,
});
```

### 5. Notifications Service
```typescript
import { notificationsService } from '@/lib/services/notifications';

// Create notification
await notificationsService.createNotification({
  user_id: 'user-uuid',
  notification_type: 'cycle_complete',
  title: 'Cycle Complete',
  message: 'Your laundry is ready!',
  priority: 'high',
});

// Get unread notifications
const unread = await notificationsService.getUnreadNotifications(userId);

// Get all notifications
const all = await notificationsService.getUserNotifications(userId, 50);

// Mark as read
await notificationsService.markAsRead(notificationId);

// Delete notification
await notificationsService.deleteNotification(notificationId);
```

## Using Data Collection Hook in Components

The `useDataCollection` hook now syncs everything to Supabase:

```typescript
'use client';

import { useDataCollection } from '@/lib/dataCollection';

export function MyComponent() {
  const { trackEvent, completeCycle, markAsCollected, setUserId } = useDataCollection();

  // Set user ID when logging in
  useEffect(() => {
    setUserId(user.id);
  }, [user]);

  // Track machine start
  const handleStart = async () => {
    await trackEvent('machine_started', {
      userId: user.id,
      machineId: 1,
      machineType: 'washer',
      duration: 45,
    });
  };

  // Complete cycle
  const handleComplete = async () => {
    await completeCycle(cycleId, 2.50);
  };

  // Mark collected
  const handleCollect = async () => {
    await markAsCollected(cycleId);
  };

  return (
    <>
      <button onClick={handleStart}>Start</button>
      <button onClick={handleComplete}>Complete</button>
      <button onClick={handleCollect}>Collect</button>
    </>
  );
}
```

## Data Flow Diagram

```
User Action (App)
        ↓
useDataCollection Hook
        ↓
Service Layer (machineCycles, analytics, etc.)
        ↓
Supabase Client
        ↓
PostgreSQL Database
        ↓
Data Stored in Tables
```

## Real-Time Updates (Optional)

To subscribe to real-time updates from Supabase:

```typescript
const supabase = createClient();

// Subscribe to machine cycles
const subscription = supabase
  .from('machine_cycles')
  .on('*', (payload) => {
    console.log('Cycle updated:', payload);
  })
  .subscribe();

// Clean up
subscription.unsubscribe();
```

## Database Tables Reference

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `users` | User profiles | id, email, student_id, phone_number |
| `machines` | Equipment inventory | id, machine_id, type, status |
| `machine_cycles` | Usage sessions | id, user_id, machine_id, start_time, status |
| `analytics_events` | Event tracking | user_id, event_type, event_name, timestamp |
| `user_sessions` | Login/logout tracking | user_id, session_id, login_time, status |
| `notifications` | User notifications | user_id, notification_type, is_read |
| `auto_unlock_timers` | Unlock timers | machine_id, user_id, status |
| `machine_queue` | Waitlist | machine_id, user_id, queue_position |
| `transactions` | Billing | user_id, amount, transaction_type |

## Testing the Integration

1. **Open the app** - Check browser console for Supabase connection message
2. **Log in** - A session should be created in `user_sessions` table
3. **Start a machine** - Check `machine_cycles` table for new entry
4. **Check analytics** - Go to Supabase → Table Editor → `analytics_events`
5. **View data** - All events should appear in real-time

## Troubleshooting

### "Cannot find module '@/types/supabase'"
- Ensure `types/supabase.ts` exists
- Restart your dev server

### "Supabase client error"
- Verify `.env.local` has correct credentials
- Check Project URL and API key match your Supabase project

### Data not appearing in tables
- Check browser console for errors
- Verify RLS policies are set correctly
- Check network tab for failed requests

### RLS Policy Errors
- Go to Supabase → Authentication → Policies
- Ensure policies allow authenticated users to read/write their own data

## Next Steps

1. ✅ Created Supabase schema
2. ✅ Created service layer
3. ✅ Connected data collection
4. **Now**: Replace mock data in pages with actual Supabase queries
5. **Then**: Add real-time subscriptions for live updates

---

**All data is now being synced to Supabase automatically!**
