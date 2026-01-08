# KY Wash System - Implementation Guide

## Overview
This guide covers the four major improvements made to the KY Wash system:
1. **Google Analytics Integration** - Track user behavior and machine usage
2. **User Data Collection Layer** - Detailed analytics for decision-making
3. **Machine Auto-Unlock Timer** - Automatic unlock after 24 hours
4. **Enhanced Notification System** - Single ring then continuous until acknowledged

---

## 1. Google Analytics Integration

### Setup Instructions

#### Step 1: Get Your Google Analytics Measurement ID
1. Go to [Google Analytics](https://analytics.google.com/)
2. Create a new property for "KY Wash System"
3. Set up a Web data stream
4. Copy your **Measurement ID** (format: `G-XXXXXXXXXX`)

#### Step 2: Add Environment Variable
Create `.env.local` in the `ky-washing` directory:
```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

#### Step 3: Install Dependencies
```bash
cd ky-washing
npm install react-ga4
```

#### Step 4: Initialize GA in Your App
Add this to your main `page.tsx` file (in a `useEffect` on component mount):

```tsx
import { initializeGA, trackLogin } from '@/lib/analytics';

useEffect(() => {
  // Initialize analytics once on mount
  initializeGA();
}, []);

// Track user login
const handleLogin = (studentId: string) => {
  trackLogin(studentId);
  // ... rest of login logic
};
```

### Tracked Events

#### User Events
- **Login** - `trackLogin(studentId)`
- **Logout** - `trackLogout(studentId)`

#### Machine Events
- **Machine Start** - `trackMachineStart(type, id, mode, duration, studentId)`
- **Machine Cancel** - `trackMachineCancel(type, id, studentId, timeRemaining)`
- **Clothes Collection** - `trackClothesCollection(type, id, studentId, totalDuration)`

#### Waitlist Events
- **Join Waitlist** - `trackWaitlistJoin(type, studentId, position)`
- **Leave Waitlist** - `trackWaitlistLeave(type, studentId)`

#### Maintenance Events
- **Issue Report** - `trackIssueReport(type, id, studentId)`

#### Notification Events
- **Notification Received** - `trackNotificationReceived(type, id, studentId, notificationType)`

### Viewing Analytics
1. Go to Google Analytics Dashboard
2. Navigate to **Reports** → **Real-time** to see live events
3. View **Engagement** → **Events** to see detailed event data
4. Create custom reports in **Explore** for specific insights

### Example Custom Report
Track peak usage times:
- **Dimension**: Event hour
- **Metric**: Event count
- **Filter**: Event name = "Machine:start"

---

## 2. User Data Collection Layer

### Overview
The `dataCollectionService` tracks all user behavior and machine usage patterns.

### How to Use

#### Record User Login
```tsx
import { dataCollectionService } from '@/lib/dataCollection';

dataCollectionService.recordUserLogin(studentId, phoneNumber);
```

#### Record User Logout
```tsx
dataCollectionService.recordUserLogout(studentId);
```

#### Record Machine Usage
```tsx
dataCollectionService.recordMachineUsage({
  id: 'usage-1',
  type: 'washer',
  machine_id: 1,
  mode: 'Normal',
  duration: 30,
  date: new Date().toISOString(),
  day: 'Monday',
  time: '14:30',
  studentId: 'S123456',
  timestamp: Date.now(),
  spending: 5.50,
  queueWaitTime: 300000, // in milliseconds
  notificationTime: 1800000 // time until notification
});
```

### Get Analytics Metrics
```tsx
const metrics = dataCollectionService.calculateMetrics();

// Returns:
// {
//   totalUsers: 150,
//   totalSessions: 450,
//   averageSessionDuration: 900000,
//   peakHours: [
//     { hour: 14, count: 45 },
//     { hour: 15, count: 38 }
//   ],
//   machineUtilizationRate: 72.5,
//   averageQueueTime: 600000,
//   averageCompletionTime: 1800000,
//   machineUsageByTime: {
//     "14:00-14:59": 45,
//     "15:00-15:59": 38
//   }
// }
```

### Get Usage Stats for Period
```tsx
const today = new Date();
today.setHours(0, 0, 0, 0);
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

const stats = dataCollectionService.getUsageStatsByPeriod(
  today.getTime(),
  tomorrow.getTime()
);

// Returns usage statistics for the day
```

### Export Analytics Data
```tsx
const exportedData = dataCollectionService.exportAnalyticsData();
// Download as JSON or send to backend for storage
```

### Data Storage
- Automatically saves to `localStorage` with keys:
  - `kyWash_userBehaviors`
  - `kyWash_machineUsageData`
- Persists across browser sessions
- Can be cleared with `dataCollectionService.clearAllData()`

---

## 3. Machine Auto-Unlock Timer

### Overview
Machines automatically unlock after 24 hours (configurable) to ensure they don't stay locked indefinitely due to admin error.

### Setup

```tsx
import { machineAutoUnlockService } from '@/lib/machineAutoUnlock';

// Initialize in your component's useEffect
useEffect(() => {
  // Set custom unlock duration (optional, defaults to 24 hours)
  machineAutoUnlockService.setAutoUnlockDuration(24 * 60 * 60 * 1000); // 24 hours

  // Register callback for when machine unlocks
  machineAutoUnlockService.onMachineUnlock((machine) => {
    console.log(`Machine ${machine.machineType}-${machine.machineId} auto-unlocked`);
    // Update your UI or state here
  });

  return () => {
    // Cleanup on unmount
    machineAutoUnlockService.destroy();
  };
}, []);
```

### Usage

#### Lock a Machine
```tsx
// Lock a machine for 4 hours with a reason
machineAutoUnlockService.lockMachine(
  1, // machineId
  'washer', // machineType
  4 * 60 * 60 * 1000, // lockDuration (4 hours)
  'Maintenance scheduled' // reason
);
```

#### Unlock a Machine Manually
```tsx
machineAutoUnlockService.unlockMachine(1, 'washer');
```

#### Check if Machine is Locked
```tsx
const isLocked = machineAutoUnlockService.isMachineLocked(1, 'washer');
```

#### Get Time Remaining
```tsx
const timeRemaining = machineAutoUnlockService.getTimeRemaining(1, 'washer');
// Returns milliseconds or null if not locked

if (timeRemaining) {
  console.log(`Machine unlocks in ${Math.round(timeRemaining / 1000 / 60)} minutes`);
}
```

#### Get All Locked Machines
```tsx
const lockedMachines = machineAutoUnlockService.getLockedMachines();
```

### Configuration Options

```tsx
// Create custom service with different settings
const customService = new MachineAutoUnlockService({
  autoUnlockAfter: 12 * 60 * 60 * 1000, // 12 hours instead of 24
  checkInterval: 5 * 60 * 1000 // Check every 5 minutes instead of 1
});
```

### Data Persistence
- Lock data persists in `localStorage` with key: `kyWash_lockedMachines`
- Automatically checks for expired locks when service loads
- Suitable for offline operation

---

## 4. Enhanced Notification System

### Overview
New notification behavior:
- **Single bell ring** when machine completes (2 seconds)
- **Continuous alarm** every 3 seconds until user acknowledges
- **Maximum 5 minutes** of continuous ringing
- Browser push notifications

### Setup

```tsx
import { notificationService } from '@/lib/enhancedNotifications';

useEffect(() => {
  // Request notification permission
  if ('Notification' in window) {
    Notification.requestPermission();
  }

  // Register callback for when user acknowledges
  notificationService.onAcknowledge((notification) => {
    console.log(`User acknowledged: ${notification.message}`);
    // Handle acknowledgment (update UI, stop other actions, etc.)
  });

  return () => {
    notificationService.destroy();
  };
}, []);
```

### Usage

#### Trigger a Completion Notification
```tsx
const notificationId = notificationService.triggerNotification(
  1, // machineId
  'washer', // machineType
  'Your washing is complete! Please collect your clothes.',
  'completion', // type
  'S123456' // studentId (optional)
);
```

#### Other Notification Types
```tsx
// Reminder notification
notificationService.triggerNotification(machineId, machineType, 'Your clothes will be ready in 5 minutes', 'reminder', studentId);

// Waitlist notification
notificationService.triggerNotification(machineId, machineType, 'A washer is now available', 'waitlist', studentId);

// Issue notification
notificationService.triggerNotification(machineId, machineType, 'Machine requires maintenance', 'issue', studentId);
```

#### Acknowledge a Notification
```tsx
notificationService.acknowledgeNotification(notificationId);
```

#### Get Active Notifications
```tsx
const activeNotifications = notificationService.getActiveNotifications();
```

#### Check for Active Notification
```tsx
const hasActive = notificationService.hasActiveNotification(1, 'washer');
```

### Configuration

```tsx
notificationService.updateConfig({
  initialRingDuration: 3000, // Change initial ring to 3 seconds
  continuousRingGap: 2000, // Ring every 2 seconds
  maxContinuousRingDuration: 10 * 60 * 1000 // Max 10 minutes
});
```

### Audio Pattern

1. **Initial Ring (2 seconds)** - Bell sound with frequency modulation
   - Frequencies: 800Hz → 600Hz and 1200Hz → 900Hz
   - Volume: 0.8 → 0.1 (fade out)

2. **Continuous Alarm (every 3 seconds)** - Urgent beep pattern
   - Frequency: 1000Hz square wave
   - Pattern: 0.15s beep, 0.05s silence, 0.15s beep, 0.05s silence
   - Repeats until acknowledged (max 5 minutes)

### Browser Notification
- Uses `requireInteraction: true` so users must dismiss it
- Shows app icon and badge
- Contains the message and timestamp

---

## 5. Analytics Dashboard Component

### Add Analytics Dashboard to Admin View

```tsx
import { AnalyticsDashboard } from '@/components/analytics-dashboard';

// In your admin/admin-page component:
<div>
  <AnalyticsDashboard darkMode={darkMode} />
</div>
```

### What It Shows
- **Total Users** - Number of unique users
- **Total Sessions** - Total login sessions
- **Avg Session Duration** - Average time spent in app
- **Machine Utilization** - Percentage of time machines are in use
- **Avg Queue Time** - Average wait time in queue
- **Avg Completion Time** - Average machine run duration
- **Peak Usage Hours** - Top 5 busiest hours with usage count
- **Usage Distribution** - Breakdown by time of day
- **Quick Stats** - Busiest hour and usage during that time

---

## Integration Checklist

### In Your Main Page Component:

```tsx
'use client';

import { initializeGA, trackLogin, trackMachineStart } from '@/lib/analytics';
import { dataCollectionService } from '@/lib/dataCollection';
import { machineAutoUnlockService } from '@/lib/machineAutoUnlock';
import { notificationService } from '@/lib/enhancedNotifications';

const KYWashSystem = () => {
  // Initialize on component mount
  useEffect(() => {
    initializeGA();
    
    machineAutoUnlockService.onMachineUnlock((machine) => {
      showNotification(`Machine ${machine.machineType}-${machine.machineId} auto-unlocked after 24 hours`);
    });

    notificationService.onAcknowledge((notification) => {
      // Handle acknowledgment
      setShowNotificationModal(false);
    });

    return () => {
      machineAutoUnlockService.destroy();
      notificationService.destroy();
    };
  }, []);

  // Track login
  const handleLogin = (studentId: string, phoneNumber: string) => {
    trackLogin(studentId);
    dataCollectionService.recordUserLogin(studentId, phoneNumber);
    // ... rest of login logic
  };

  // Track logout
  const handleLogout = (studentId: string) => {
    dataCollectionService.recordUserLogout(studentId);
    // ... rest of logout logic
  };

  // Track machine start
  const startMachine = (machineId: number, machineType: 'washer' | 'dryer', mode: Mode) => {
    trackMachineStart(machineType, machineId, mode.name, mode.duration, user!.studentId);
    // ... rest of start logic
  };

  // Trigger notification on completion
  const handleMachineComplete = (machine: Machine) => {
    const notificationId = notificationService.triggerNotification(
      machine.id,
      machine.type,
      `${machine.type.charAt(0).toUpperCase() + machine.type.slice(1)} ${machine.id} is complete!`,
      'completion',
      machine.userStudentId
    );
  };

  // ... rest of component
};
```

---

## Troubleshooting

### Google Analytics Not Recording Events
- Check that `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set in `.env.local`
- Open browser DevTools Console to see GA initialization messages
- Ensure React GA4 is properly imported: `import ReactGA from 'react-ga4'`

### Auto-Unlock Not Working
- Check browser DevTools → Application → Local Storage for `kyWash_lockedMachines`
- Ensure service is initialized with `useEffect` on component mount
- Verify lock duration is being set correctly

### Notifications Not Playing Sound
- Check browser audio permissions in DevTools
- Ensure browser's Web Audio API is not blocked
- Try triggering notification manually to test

### Analytics Data Not Persisting
- Check browser storage quota with `navigator.storage.estimate()`
- Clear old data if storage is full: `dataCollectionService.clearAllData()`
- Verify localStorage is not in Private/Incognito mode

---

## Best Practices

1. **Analytics Privacy** - Don't track sensitive user data beyond what's needed
2. **Notification Frequency** - Don't trigger too many notifications to avoid user fatigue
3. **Auto-Unlock Duration** - Set appropriate duration for your use case (24 hours is default)
4. **Error Handling** - Always wrap service calls in try-catch for audio operations
5. **Cleanup** - Call `.destroy()` on services when component unmounts

---

## Next Steps

1. Install dependencies: `npm install react-ga4`
2. Set environment variable: `NEXT_PUBLIC_GA_MEASUREMENT_ID`
3. Integrate tracking calls in your main component
4. Add analytics dashboard to admin view
5. Test notifications in browser
6. Monitor analytics dashboard for insights

---

## Additional Resources

- [Google Analytics 4 Documentation](https://support.google.com/analytics/answer/10089681)
- [Web Audio API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [Notifications API MDN](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [localStorage MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)

---

## Support

For issues or questions, check:
1. Browser console for errors
2. localStorage data in DevTools
3. GA4 real-time events dashboard
4. Notification permissions in browser settings
