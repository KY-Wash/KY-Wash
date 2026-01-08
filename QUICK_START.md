# Quick Start Setup

## Files Created

### 1. Analytics & Data Collection
- **`lib/analytics.ts`** - Google Analytics integration
- **`lib/dataCollection.ts`** - User behavior and machine usage tracking
- **`lib/machineAutoUnlock.ts`** - Auto-unlock timer service
- **`lib/enhancedNotifications.ts`** - Enhanced notification system

### 2. UI Components
- **`components/analytics-dashboard.tsx`** - Analytics dashboard component

## Installation Steps

### Step 1: Install Dependencies
```bash
cd ky-washing
npm install react-ga4
# or
yarn add react-ga4
```

### Step 2: Create Environment Variable
Create/update `.env.local` in `ky-washing` directory:
```
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

Get your Measurement ID from [Google Analytics](https://analytics.google.com/)

### Step 3: Update Main Component

In your `app/page.tsx`, add at the top:
```tsx
import { initializeGA, trackLogin, trackLogout, trackMachineStart, trackMachineCancel, trackClothesCollection } from '@/lib/analytics';
import { dataCollectionService } from '@/lib/dataCollection';
import { machineAutoUnlockService } from '@/lib/machineAutoUnlock';
import { notificationService } from '@/lib/enhancedNotifications';
```

Add this in your main component's `useEffect`:
```tsx
useEffect(() => {
  // Initialize Google Analytics
  initializeGA();
  
  // Initialize Notification Service
  if ('Notification' in window) {
    Notification.requestPermission();
  }

  // Handle machine unlock events
  machineAutoUnlockService.onMachineUnlock((machine) => {
    console.log(`✓ Machine auto-unlocked: ${machine.machineType}-${machine.machineId}`);
  });

  // Handle notification acknowledgment
  notificationService.onAcknowledge((notification) => {
    console.log(`✓ Notification acknowledged: ${notification.id}`);
  });

  return () => {
    machineAutoUnlockService.destroy();
    notificationService.destroy();
  };
}, []);
```

### Step 4: Track User Login
```tsx
const handleLogin = (studentId: string, phoneNumber: string) => {
  // Track with analytics
  trackLogin(studentId);
  
  // Record in data collection
  dataCollectionService.recordUserLogin(studentId, phoneNumber);
  
  // ... rest of login logic
};
```

### Step 5: Track Logout
```tsx
const handleLogout = (studentId: string) => {
  dataCollectionService.recordUserLogout(studentId);
  trackLogout(studentId);
  
  // ... rest of logout logic
};
```

### Step 6: Track Machine Usage

Replace your existing machine start function:
```tsx
const startMachine = (machineId: number, machineType: 'washer' | 'dryer', mode: Mode): void => {
  if (!user) return;

  // Track with analytics
  trackMachineStart(machineType, machineId, mode.name, mode.duration, user.studentId);
  
  // ... rest of existing start logic
};
```

Track collection:
```tsx
const clothesCollected = (machineId: number, machineType: 'washer' | 'dryer'): void => {
  if (!user) return;

  // Track collection
  trackClothesCollection(machineType, machineId, user.studentId, originalDuration);
  
  // Stop notification
  notificationService.stopAll();
  
  // ... rest of existing logic
};
```

Track cancellation:
```tsx
const cancelMachine = (machineId: number, machineType: 'washer' | 'dryer'): void => {
  if (!user) return;

  const machine = machines.find(m => m.id === machineId && m.type === machineType);
  const timeRemaining = machine?.timeLeft || 0;

  // Track cancellation
  trackMachineCancel(machineType, machineId, user.studentId, timeRemaining);
  
  // ... rest of existing cancel logic
};
```

### Step 7: Use Enhanced Notifications

Replace your existing completion notification logic:
```tsx
// When machine completes (in useEffect monitoring machines)
if (machine.status === 'pending-collection' && !notifiedMachinesRef.current.has(machineKey)) {
  if (machine.userStudentId === user?.studentId) {
    notifiedMachinesRef.current.add(machineKey);
    
    // Use enhanced notification
    const notificationId = notificationService.triggerNotification(
      machine.id,
      machine.type,
      `${machine.type.charAt(0).toUpperCase() + machine.type.slice(1)} ${machine.id} is complete! Please collect your clothes.`,
      'completion',
      machine.userStudentId
    );

    // Show modal to user
    setActiveNotification({ machineId: machine.id, machineType: machine.type });
    setShowNotificationModal(true);
  }
}
```

### Step 8: Add Analytics Dashboard

In your admin view:
```tsx
import { AnalyticsDashboard } from '@/components/analytics-dashboard';

// In your admin section:
{currentView === 'admin' && (
  <div className="space-y-6">
    {/* ... other admin sections ... */}
    
    <AnalyticsDashboard darkMode={darkMode} />
  </div>
)}
```

### Step 9: Use Auto-Unlock Timer

In your machine lock function:
```tsx
const toggleMachineLock = (machineId: number, machineType: 'washer' | 'dryer'): void => {
  const machine = machines.find((m) => m.id === machineId && m.type === machineType);
  if (!machine) return;

  const newLockedState = !machine.locked;

  if (newLockedState) {
    // Lock the machine with auto-unlock after 24 hours
    machineAutoUnlockService.lockMachine(
      machineId,
      machineType,
      24 * 60 * 60 * 1000, // 24 hours
      'Admin maintenance lock'
    );
  } else {
    // Unlock the machine
    machineAutoUnlockService.unlockMachine(machineId, machineType);
  }

  // ... rest of existing lock logic
};
```

## Testing

### Test Google Analytics
1. Open DevTools Console
2. Should see: "✅ Google Analytics initialized"
3. Perform actions (login, start machine, etc.)
4. Check GA4 dashboard for real-time events

### Test Notifications
1. Complete a machine cycle
2. Should hear a bell ring (initial notification)
3. Should hear beeps every 3 seconds (continuous ring)
4. Click "Clothes Collected" button to acknowledge
5. Ringing should stop

### Test Auto-Unlock
1. Lock a machine from admin panel
2. Wait 24 hours or change duration for testing:
   ```tsx
   machineAutoUnlockService.setAutoUnlockDuration(60 * 1000); // 1 minute for testing
   ```
3. Check console for: "⏰ Machine auto-unlocked"

### Test Data Collection
1. Open DevTools → Application → Local Storage
2. Look for keys:
   - `kyWash_userBehaviors`
   - `kyWash_machineUsageData`
   - `kyWash_lockedMachines`

## Viewing Data

### User Behavior Data
```tsx
const behaviors = dataCollectionService.getAllUserBehaviors();
console.log(behaviors);
```

### Machine Usage Data
```tsx
const usage = dataCollectionService.getMachineUsageData();
console.log(usage);
```

### Calculate Metrics
```tsx
const metrics = dataCollectionService.calculateMetrics();
console.log(metrics);
```

### Export All Data
```tsx
const exported = dataCollectionService.exportAnalyticsData();
// Download as JSON or send to backend
```

## Configuration

### Change Auto-Unlock Duration
```tsx
machineAutoUnlockService.setAutoUnlockDuration(12 * 60 * 60 * 1000); // 12 hours
```

### Change Notification Settings
```tsx
notificationService.updateConfig({
  initialRingDuration: 3000, // 3 seconds initial
  continuousRingGap: 2000, // Ring every 2 seconds
  maxContinuousRingDuration: 10 * 60 * 1000 // Max 10 minutes
});
```

## Debugging

### Check Google Analytics
```tsx
// In console
ReactGA.event({
  category: 'Test',
  action: 'test_event',
  label: 'test',
});
```

### Check Notifications
```tsx
// In console
notificationService.triggerNotification(1, 'washer', 'Test notification');
```

### Check Auto-Unlock
```tsx
// In console
machineAutoUnlockService.getLockedMachines();
machineAutoUnlockService.getTimeRemaining(1, 'washer');
```

### Check Data Collection
```tsx
// In console
dataCollectionService.calculateMetrics();
dataCollectionService.getUsageStatsByPeriod(Date.now() - 86400000, Date.now());
```

## Next: Environment Variable

After setting up the code, go to Google Analytics and create your Measurement ID:
1. Visit https://analytics.google.com/
2. Create new property "KY Wash System"
3. Create Web data stream
4. Copy Measurement ID (G-XXXXXXXXXX)
5. Add to `.env.local`: `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX`
6. Restart dev server

Done! 🎉
