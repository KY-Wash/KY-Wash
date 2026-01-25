# 🚀 SUPABASE INTEGRATION - QUICK START

## ⚡ 5-Minute Setup

### 1. Create Supabase Project
```
supabase.com → New Project → "KY-Wash"
```

### 2. Get Credentials
```
Settings → API
Copy: Project URL & Anon Key
```

### 3. Add .env.local
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

### 4. Create Tables
```
Supabase → SQL Editor → New Query
Copy SQL from: SUPABASE_SCHEMA.md
Run!
```

### 5. Start App
```bash
npm run dev
```

**That's it! 🎉**

---

## 📍 Where Data Is Stored

| Action | Table | Status |
|--------|-------|--------|
| User logs in | `user_sessions` | ✅ Auto-saved |
| Start machine | `machine_cycles` | ✅ Auto-saved |
| Machine completes | `analytics_events` | ✅ Auto-saved |
| Collect clothes | `notifications` | ✅ Auto-saved |
| Any event | `machines` | ✅ Auto-updated |

---

## 🔧 Using Services

### Start a Machine
```typescript
import { machineCyclesService } from '@/lib/services/machineCycles';

await machineCyclesService.startCycle({
  machine_id: 1,
  user_id: 'user-123',
  machine_name: 'Washer 1',
  machine_type: 'washer',
  duration_minutes: 45,
});
```

### Track Event
```typescript
import { analyticsService } from '@/lib/services/analytics';

await analyticsService.trackEvent({
  user_id: 'user-123',
  event_type: 'machine_action',
  event_name: 'machine_started',
});
```

### Send Notification
```typescript
import { notificationsService } from '@/lib/services/notifications';

await notificationsService.createNotification({
  user_id: 'user-123',
  notification_type: 'cycle_complete',
  title: 'Done!',
  message: 'Your cycle is complete',
});
```

### Get Machines
```typescript
import { machinesService } from '@/lib/services/machines';

const machines = await machinesService.getAllMachines();
const available = await machinesService.getAvailableMachines();
```

---

## ✅ Verification

After setup, check Supabase:

1. **user_sessions** table → See login records
2. **machine_cycles** table → See machine starts
3. **analytics_events** table → See tracked events
4. **machines** table → See updated statuses

All data appearing? ✅ **You're connected!**

---

## 📚 Full Documentation

- [IMPLEMENTATION_COMPLETE.md](./IMPLEMENTATION_COMPLETE.md) - Complete overview
- [SUPABASE_INTEGRATION.md](./SUPABASE_INTEGRATION.md) - Full API docs
- [SETUP_CHECKLIST.md](./SETUP_CHECKLIST.md) - Detailed checklist
- [SUPABASE_SCHEMA.md](../SUPABASE_SCHEMA.md) - Database SQL

---

## ❌ Troubleshooting

### Data not appearing?
1. Check `.env.local` has correct credentials
2. Verify tables were created (17 total)
3. Check browser console for errors
4. Verify you're logged in (user_id set)

### "Cannot find module" error?
1. Restart dev server
2. Check file names match exactly

### RLS policy error?
1. Go to Supabase → Authentication → Policies
2. Verify policies allow your user

---

## 🎯 You're All Set!

Everything is connected. Data syncs automatically to Supabase.

Start building! 🚀
