# KY-Wash Feature Implementation Guide

## Overview

This guide covers the implementation of four major features for the KY-Wash laundry management system:

1. **Google Analytics Integration** - Track user behavior and events
2. **Machine Usage Analytics** - Monitor machine status, queue times, and peak hours
3. **Auto-Unlock Timer** - Automatically unlock machines after set time period
4. **Enhanced Notifications** - Smart notification system with single ring + continuous alerts

---

## 1. Google Analytics Integration

### What It Does

- Tracks page views automatically
- Records custom events (machine starts, cycles complete, etc.)
- Provides user behavior insights
- Shows traffic patterns and peak usage times

### How It Works

**Architecture:**
```
User Action → trackEvent() → Google Analytics Tag Manager → Google Analytics Dashboard
                          ↓
                    Local Event Storage (DataCollection)
```

### Implementation Details

#### a) Environment Setup

1. **Get Measurement ID from Google Analytics:**
   - Go to [Google Analytics](https://analytics.google.com/)
   - Create a new property for your domain
   - Copy your Measurement ID (format: `G-XXXXXXXXXX`)

2. **Add to `.env.local`:**
   ```bash
   NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
   ```

3. **Verify in App:**
   - The `GoogleAnalyticsScript` component in `layout.tsx` automatically loads Google Analytics
   - No additional setup needed in components

#### b) Tracking Events

Use the `useDataCollection` hook to track events:

```typescript
'use client';

import { useDataCollection } from '@/lib/dataCollection';

export function MyComponent() {
  const { trackEvent } = useDataCollection();

  const handleAction = () => {
    trackEvent('machine_started', {
      machineId: 'W1',
      machineType: 'washer',
      userId: 'user123',
      timestamp: new Date().toISOString(),
    });
  };

  return <button onClick={handleAction}>Start Machine</button>;
}
```

#### c) Retrieving Analytics Data

```typescript
import { useDataCollection } from '@/lib/dataCollection';

export function AnalyticsComponent() {
  const { getAnalytics } = useDataCollection();

  const analyticsData = getAnalytics();
  // Returns: {
  //   events: [...],
  //   totalEvents: number,
  //   eventsByType: {...},
  //   recentEvents: [...]
  // }
}
```

### Google Analytics Dashboard

Once configured, you can:
1. **Real-time View** - See live users and events
2. **User Journey** - Track how users navigate your app
3. **Event Analysis** - See which actions users take most
4. **Conversion Tracking** - Set up goals for key actions

### Example Events to Track

```typescript
// When machine starts
trackEvent('machine_started', {
  machineId: 'W1',
  machineType: 'washer',
  cycleTime: 45,
});

// When cycle completes
trackEvent('machine_cycle_complete', {
  machineId: 'W1',
  cycleTime: 45,
  completionTime: new Date().toISOString(),
});

// When user collects clothes
trackEvent('clothes_collected', {
  machineId: 'W1',
  collectionTime: new Date().toISOString(),
});

// When user waits in queue
trackEvent('queue_join', {
  machineType: 'washer',
  queuePosition: 2,
  estimatedWaitTime: 15,
});
```

---

## 2. Machine Usage Analytics Dashboard

### What It Does

- **Real-time Monitoring** - See which machines are in use
- **Queue Analysis** - Track wait times and queue lengths
- **Usage Patterns** - Identify peak hours
- **Machine Performance** - View utilization rates
- **Historical Data** - Compare trends over time

### Components

#### a) Machine Management Page (`/machines`)

Displays all machines with:
- Current status (available, in-use, completed)
- Time remaining on current cycle
- Queue count
- Control buttons (Start, Collect, etc.)

**Key Features:**
- Real-time timer countdown
- Progress bar showing cycle progress
- Queue visualization
- One-click machine control

**Code Location:** [app/machines/page.tsx](app/machines/page.tsx)

#### b) Analytics Dashboard Page (`/analytics`)

Comprehensive analytics view with:
- Key metrics (total cycles, average wait times)
- Hourly usage chart
- Machine-specific statistics
- Peak hour identification
- Utilization rates

**Key Features:**
- Date range filters (Today, Week, Month)
- Separate washer/dryer analytics
- Color-coded utilization (green/orange/red)
- Queue time trends

**Code Location:** [app/analytics/page.tsx](app/analytics/page.tsx)

### How to Use

#### Accessing the Dashboard

1. **Machines Page:**
   - Navigate to `/machines` to see real-time machine status
   - Click "Start Machine" to begin a cycle
   - Watch the timer count down
   - Click "Collect Clothes" when cycle completes

2. **Analytics Page:**
   - Navigate to `/analytics` to view detailed statistics
   - Select date range (Today, Week, Month)
   - View hourly usage patterns
   - See which machines are busiest

### Connecting to Real Data

Currently, the dashboard uses mock data. To connect to real data:

```typescript
// In app/machines/page.tsx
const fetchMachines = async () => {
  const response = await fetch('/api/machines');
  const machinesData = await response.json();
  setMachines(machinesData);
};

// In app/analytics/page.tsx
const fetchAnalytics = async () => {
  const response = await fetch('/api/analytics/machines');
  const analyticsData = await response.json();
  setMachineStats(analyticsData);
};
```

### Analytics Service

The `AnalyticsService` class processes raw event data into insights:

```typescript
import { AnalyticsService } from '@/lib/analytics';

const service = new AnalyticsService();

// Analyze a machine's usage
const machineAnalytics = service.analyzeMachineUsage('W1', events);
// Returns: {
//   totalCycles: number,
//   averageWaitTime: number,
//   peakHours: string[],
//   utilizationRate: number,
//   downtime: number
// }

// Get busy periods
const peakTimes = service.identifyPeakTimes(events);
// Returns: [{ hour: '14:00', usageCount: 12, avgQueue: 3 }, ...]

// Forecast demand
const forecast = service.forecastDemand(events, hoursAhead);
// Returns: [{ hour: '15:00', predictedQueue: 5 }, ...]
```

---

## 3. Auto-Unlock Timer System

### What It Does

- **Automatic Unlock** - Unlocks machines after cycle completes + grace period
- **Configurable Timing** - Customize unlock delays
- **Single Ring Alert** - Rings once when cycle completes
- **Continuous Alert** - Rings periodically until user acknowledges

### How It Works

**Timeline:**
```
Cycle Start (0 min)
    ↓
Cycle Running (e.g., 45 min for washer)
    ↓
Cycle Complete → 🔔 Ring once
    ↓
Grace Period (15 min) → Notify user periodically
    ↓
Auto Unlock → Machine locked, must collect clothes
```

### Configuration

Edit the timing in [lib/machineAutoUnlock.ts](lib/machineAutoUnlock.ts):

```typescript
const UNLOCK_DELAY_MS = 15 * 60 * 1000;  // 15 minutes after cycle completes
const ALERT_INTERVAL_MS = 30 * 1000;     // Alert every 30 seconds
const MAX_ALERTS = 30;                   // Maximum number of alerts
```

### Implementation

```typescript
import { MachineAutoUnlock } from '@/lib/machineAutoUnlock';
import { alertNotification } from '@/lib/enhancedNotifications';

const autoUnlock = new MachineAutoUnlock();

// Set unlock timer
autoUnlock.setUnlockTimer(
  'W1',                          // Machine ID
  15 * 60 * 1000,               // 15 minutes
  () => {
    // Callback when timer expires
    alertNotification('Machine W1 is now locked!');
  }
);

// Clear timer if user collects clothes early
autoUnlock.clearUnlockTimer('W1');

// Check if machine is locked
const isLocked = autoUnlock.isMachineLocked('W1');

// Get remaining unlock time
const timeLeft = autoUnlock.getTimeRemaining('W1');
```

### How the Timer Works

1. **Cycle Complete** - When timer reaches 0
2. **Immediate Ring** - Single notification sound
3. **Grace Period Starts** - User has 15 minutes to collect clothes
4. **Periodic Alerts** - Rings every 30 seconds during grace period
5. **Auto-Lock** - After 15 minutes, machine automatically locks
6. **User Must Acknowledge** - User must click "Collected" to unlock

### Testing the Timer

```typescript
// In your component
useEffect(() => {
  if (machine.status === 'completed') {
    // Ring once
    ringNotification(`${machine.name} cycle completed!`);

    // Set auto-unlock timer
    autoUnlock.setUnlockTimer(
      machine.id,
      15 * 60 * 1000,
      () => {
        alertNotification(`${machine.name} unlocked - time's up!`);
      }
    );
  }
}, [machine.status]);
```

---

## 4. Enhanced Notifications System

### What It Does

- **Browser Notifications** - Uses Web Notification API
- **Smart Alerts** - Different notification types for different situations
- **Persistent Alerts** - Continuous notifications until acknowledged
- **Sound Support** - Plays notification sounds

### Notification Types

#### a) Ring Notification (Single)

Plays once when an event happens:

```typescript
import { ringNotification } from '@/lib/enhancedNotifications';

ringNotification('Wash cycle complete!');
// Plays once, then closes automatically
```

**When to Use:**
- Cycle complete
- System status changes
- One-time events

#### b) Alert Notification (Continuous)

Repeats until user acknowledges:

```typescript
import { alertNotification } from '@/lib/enhancedNotifications';

alertNotification('Please collect your clothes!');
// Rings every 30 seconds until user clicks it
```

**When to Use:**
- Grace period ending
- Machines being locked
- Important deadlines

### Browser Permissions

The notification system requires user permission. This happens automatically:

```typescript
// First notification request triggers permission dialog
ringNotification('Hello!'); // User grants or denies permission

// After permission granted, all future notifications work
```

### Implementation Details

**Notification Service:**
```typescript
// lib/enhancedNotifications.ts

export async function ringNotification(message: string) {
  // Checks for permission
  // Creates and displays notification
  // Plays sound once
  // Auto-closes after 5 seconds
}

export async function alertNotification(message: string) {
  // Checks for permission
  // Creates persistent notification
  // Plays sound every 30 seconds
  // Requires user click to close
}
```

### Customization

Edit notification behavior in [lib/enhancedNotifications.ts](lib/enhancedNotifications.ts):

```typescript
const NOTIFICATION_DURATION = 5000;     // Auto-close after 5 seconds
const ALERT_INTERVAL = 30 * 1000;      // Ring every 30 seconds
const NOTIFICATION_ICON = '/notification.png';
const NOTIFICATION_BADGE = '/badge.png';
```

### Example: Complete Machine Cycle Flow

```typescript
'use client';

import { useEffect, useState } from 'react';
import { ringNotification, alertNotification } from '@/lib/enhancedNotifications';
import { MachineAutoUnlock } from '@/lib/machineAutoUnlock';
import { useDataCollection } from '@/lib/dataCollection';

export function MachineCard({ machine, machineId }) {
  const { trackEvent } = useDataCollection();
  const autoUnlock = new MachineAutoUnlock();

  useEffect(() => {
    // When cycle completes
    if (machine.timeRemaining === 0 && machine.status === 'in-use') {
      // 1. Ring once
      ringNotification(`${machine.name} cycle complete!`);
      
      // 2. Track event
      trackEvent('machine_cycle_complete', { machineId });
      
      // 3. Set auto-unlock with grace period
      autoUnlock.setUnlockTimer(machineId, 15 * 60 * 1000, () => {
        // 4. After grace period, ring continuously
        alertNotification(`${machine.name} being locked!`);
      });
      
      // 5. Update status
      updateMachineStatus(machineId, 'completed');
    }
  }, [machine.timeRemaining, machine.status]);

  const handleCollectClothes = () => {
    // Clear timer
    autoUnlock.clearUnlockTimer(machineId);
    
    // Track event
    trackEvent('clothes_collected', { machineId });
    
    // Reset machine
    updateMachineStatus(machineId, 'available');
  };

  return (
    // Your component JSX
  );
}
```

---

## Integration Checklist

- [ ] Add Google Analytics Measurement ID to `.env.local`
- [ ] Verify Google Analytics is loading (check Network tab)
- [ ] Test tracking events with `trackEvent()`
- [ ] Review analytics data in Google Analytics dashboard
- [ ] Test machine management page (`/machines`)
- [ ] Test analytics dashboard page (`/analytics`)
- [ ] Verify timer counts down correctly
- [ ] Grant notification permission in browser
- [ ] Test ring notification (should ring once)
- [ ] Test alert notification (should ring continuously)
- [ ] Connect to real machine API data
- [ ] Set up Supabase for persistent storage
- [ ] Deploy to production

---

## Files Created/Modified

### New Files
- [lib/analytics.ts](lib/analytics.ts) - Analytics service
- [lib/dataCollection.ts](lib/dataCollection.ts) - Data collection & tracking
- [lib/enhancedNotifications.ts](lib/enhancedNotifications.ts) - Notification system
- [lib/machineAutoUnlock.ts](lib/machineAutoUnlock.ts) - Auto-unlock timer
- [components/google-analytics.tsx](components/google-analytics.tsx) - GA script loader
- [app/machines/page.tsx](app/machines/page.tsx) - Machine management
- [app/analytics/page.tsx](app/analytics/page.tsx) - Analytics dashboard

### Modified Files
- [app/layout.tsx](app/layout.tsx) - Added GA script
- [app/protected/page.tsx](app/protected/page.tsx) - Added dashboard links
- [package.json](package.json) - Added react-ga4 dependency

---

## Troubleshooting

### Google Analytics Not Tracking
1. Verify Measurement ID is correct
2. Check `.env.local` has `NEXT_PUBLIC_` prefix
3. Restart dev server
4. Check browser console for errors
5. Look for gtag requests in Network tab

### Notifications Not Working
1. Check browser notification permission
2. Ensure using HTTPS or localhost
3. Verify notification API support in browser
4. Check browser console for permission errors

### Timer Not Counting Down
1. Verify `useEffect` is updating state every second
2. Check component is re-rendering
3. Verify time calculations use milliseconds
4. Check browser console for errors

### Analytics Not Showing Data
1. Wait 24-48 hours for initial data
2. Verify events are being tracked
3. Check Google Analytics Real-time view
4. Confirm tracking code is installed

---

## Next Steps

1. **Connect Real Data**
   - Replace mock data with API calls
   - Implement Supabase integration
   - Set up realtime subscriptions

2. **Enhance Analytics**
   - Add more detailed reports
   - Implement custom dashboards
   - Add export functionality

3. **Improve Notifications**
   - Add email notifications
   - Implement SMS alerts
   - Create notification preferences

4. **Production Deployment**
   - Set up proper environment variables
   - Configure Google Analytics goals
   - Test all features on production
   - Monitor performance

---

## Questions?

Refer to the [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed setup instructions.
