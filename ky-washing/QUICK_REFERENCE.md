# Quick Reference Guide

## File Locations

```
ky-washing/
├── lib/
│   ├── analytics.ts                 ← Analytics Service
│   ├── dataCollection.ts            ← Event Tracking & Storage
│   ├── enhancedNotifications.ts      ← Notification System
│   └── machineAutoUnlock.ts          ← Auto-unlock Timer
├── components/
│   └── google-analytics.tsx          ← GA Script Loader
├── app/
│   ├── layout.tsx                   ← (Updated: Added GA)
│   ├── machines/
│   │   └── page.tsx                 ← Machine Management Dashboard
│   ├── analytics/
│   │   └── page.tsx                 ← Analytics Dashboard
│   └── protected/
│       └── page.tsx                 ← (Updated: Added links)
├── SETUP_GUIDE.md                   ← Setup Instructions
├── FEATURE_GUIDE.md                 ← Detailed Feature Documentation
└── QUICK_REFERENCE.md               ← This File
```

## Common Tasks

### Track a User Action

```typescript
import { useDataCollection } from '@/lib/dataCollection';

export function MyComponent() {
  const { trackEvent } = useDataCollection();

  const handleClick = () => {
    trackEvent('event_name', { key: 'value' });
  };

  return <button onClick={handleClick}>Click Me</button>;
}
```

### Show Ring Notification

```typescript
import { ringNotification } from '@/lib/enhancedNotifications';

ringNotification('Message here');
```

### Show Continuous Alert

```typescript
import { alertNotification } from '@/lib/enhancedNotifications';

alertNotification('Message here');
```

### Set Auto-Unlock Timer

```typescript
import { MachineAutoUnlock } from '@/lib/machineAutoUnlock';

const autoUnlock = new MachineAutoUnlock();

autoUnlock.setUnlockTimer('machine_id', 15 * 60 * 1000, () => {
  // Callback when timer expires
});
```

### Get Analytics Data

```typescript
import { useDataCollection } from '@/lib/dataCollection';

export function AnalyticsComponent() {
  const { getAnalytics } = useDataCollection();
  const data = getAnalytics();
  // Use data...
}
```

## Environment Variables

Required in `.env.local`:

```bash
# Google Analytics - Get from analytics.google.com
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

## Routes

| Route | Purpose |
|-------|---------|
| `/machines` | Machine management & real-time monitoring |
| `/analytics` | Usage statistics & insights |
| `/protected` | User dashboard (authenticated only) |

## Key Components

### 1. Analytics Service
**File:** [lib/analytics.ts](lib/analytics.ts)

Methods:
- `analyzeMachineUsage(machineId, events)` - Analyze single machine
- `identifyPeakTimes(events)` - Find busy periods
- `forecastDemand(events, hoursAhead)` - Predict future usage

### 2. Data Collection
**File:** [lib/dataCollection.ts](lib/dataCollection.ts)

Methods:
- `trackEvent(eventName, data)` - Track user action
- `getAnalytics()` - Get event history
- `clearAnalytics()` - Clear stored events

### 3. Notifications
**File:** [lib/enhancedNotifications.ts](lib/enhancedNotifications.ts)

Methods:
- `ringNotification(message)` - Single ring
- `alertNotification(message)` - Continuous alert

### 4. Auto-Unlock Timer
**File:** [lib/machineAutoUnlock.ts](lib/machineAutoUnlock.ts)

Methods:
- `setUnlockTimer(id, delay, callback)` - Start timer
- `clearUnlockTimer(id)` - Stop timer
- `isMachineLocked(id)` - Check if locked
- `getTimeRemaining(id)` - Time left in milliseconds

## Configuration

### Timer Settings
Edit [lib/machineAutoUnlock.ts](lib/machineAutoUnlock.ts):

```typescript
const UNLOCK_DELAY_MS = 15 * 60 * 1000;  // Change to customize
const ALERT_INTERVAL_MS = 30 * 1000;
```

### Notification Settings
Edit [lib/enhancedNotifications.ts](lib/enhancedNotifications.ts):

```typescript
const NOTIFICATION_DURATION = 5000;
const ALERT_INTERVAL = 30 * 1000;
```

## Testing

### Test Google Analytics
1. Open DevTools (F12)
2. Go to Network tab
3. Look for requests to `googletagmanager.com`
4. Go to Google Analytics → Real Time → Overview

### Test Notifications
```javascript
// In browser console
navigator.permissions.query({ name: 'notifications' });
// Should show "granted" or "prompt"
```

### Test Tracking
```javascript
// In browser console, after loading page
window.dataLayer;
// Should show array of tracking events
```

## Debugging

### Check if Google Analytics is loaded
```javascript
// In browser console
window.gtag
// Should be a function
```

### Check tracked events
```javascript
// In browser console
localStorage.getItem('ky_wash_analytics')
// Should show JSON of events
```

### Check notification permission
```javascript
// In browser console
Notification.permission
// Should be "granted", "denied", or "default"
```

## Performance Tips

1. **Batch Events** - Don't track every keystroke, batch important actions
2. **Lazy Load** - Load analytics components only when needed
3. **Cache Data** - Use localStorage for recent events
4. **Debounce** - Debounce frequent updates
5. **Optimize Queries** - Filter analytics data by date range

## Security Notes

1. Never put sensitive data in tracking events
2. Google Analytics doesn't require authentication
3. Measurement ID is public (prefixed with `NEXT_PUBLIC_`)
4. Events stored in localStorage can be viewed by users
5. For sensitive data, use server-side tracking

## Common Errors

| Error | Solution |
|-------|----------|
| `gtag is not defined` | Check if GA script loaded, verify Measurement ID |
| `Notifications not showing` | Grant browser permission, use HTTPS/localhost |
| `Timer not counting` | Check useEffect dependencies, verify setInterval |
| `Events not tracking` | Check trackEvent call, verify localStorage enabled |

## Next Steps

1. Read [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed setup
2. Read [FEATURE_GUIDE.md](FEATURE_GUIDE.md) for comprehensive documentation
3. Connect to real machine API
4. Deploy to production
5. Monitor analytics dashboard

## Support

For issues:
1. Check browser console for errors
2. Review setup guide for configuration
3. Verify environment variables are set
4. Check Network tab for API calls
5. Look at localStorage for stored events
