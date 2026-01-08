# KY Wash Implementation Checklist

## ✅ Setup Phase (Do First)

### Google Analytics Setup
- [ ] Visit https://analytics.google.com/
- [ ] Create new property: "KY Wash System"
- [ ] Select "Web" as platform
- [ ] Create web data stream
- [ ] Copy your Measurement ID (format: G-XXXXXXXXXX)
- [ ] Create `.env.local` in `ky-washing` directory
- [ ] Add: `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX`

### Dependencies Installation
- [ ] Run: `cd ky-washing`
- [ ] Run: `npm install react-ga4`
- [ ] Verify installation: `npm list react-ga4`

### Verify Files Exist
- [ ] `lib/analytics.ts` - Google Analytics integration
- [ ] `lib/dataCollection.ts` - Data collection service
- [ ] `lib/machineAutoUnlock.ts` - Auto-unlock service
- [ ] `lib/enhancedNotifications.ts` - Notification service
- [ ] `components/analytics-dashboard.tsx` - Dashboard component
- [ ] `types/analytics.ts` - Type definitions

## 📝 Integration Phase (Main Work)

### In Your Main Component (`app/page.tsx`):

#### Step 1: Add Imports
```tsx
import { initializeGA, trackLogin, trackLogout, trackMachineStart, trackMachineCancel, trackClothesCollection } from '@/lib/analytics';
import { dataCollectionService } from '@/lib/dataCollection';
import { machineAutoUnlockService } from '@/lib/machineAutoUnlock';
import { notificationService } from '@/lib/enhancedNotifications';
import { AnalyticsDashboard } from '@/components/analytics-dashboard';
```
- [ ] Imports added to top of file

#### Step 2: Initialize Services in useEffect
```tsx
useEffect(() => {
  // Initialize Google Analytics
  initializeGA();

  // Request notification permission
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Register callbacks
  machineAutoUnlockService.onMachineUnlock((machine) => {
    console.log(`✅ Machine auto-unlocked: ${machine.machineType}-${machine.machineId}`);
  });

  notificationService.onAcknowledge((notification) => {
    console.log(`✅ Notification acknowledged`);
  });

  return () => {
    machineAutoUnlockService.destroy();
    notificationService.destroy();
  };
}, []);
```
- [ ] useEffect with initialization code added

#### Step 3: Track Login
Find your existing `handleLogin` function and update:
```tsx
const handleLogin = (studentId: string, phoneNumber: string): void => {
  // Add these lines:
  trackLogin(studentId);
  dataCollectionService.recordUserLogin(studentId, phoneNumber);
  
  // ... rest of existing login logic
};
```
- [ ] `trackLogin()` call added
- [ ] `dataCollectionService.recordUserLogin()` call added

#### Step 4: Track Logout
Find your existing `handleLogout` function and update:
```tsx
const handleLogout = (studentId: string): void => {
  // Add these lines:
  dataCollectionService.recordUserLogout(studentId);
  trackLogout(studentId);
  
  // ... rest of existing logout logic
};
```
- [ ] `trackLogout()` call added
- [ ] `dataCollectionService.recordUserLogout()` call added

#### Step 5: Track Machine Start
Find your existing `startMachine` function and update:
```tsx
const startMachine = (machineId: number, machineType: 'washer' | 'dryer', mode: Mode): void => {
  if (!user) return;

  // Add these lines:
  trackMachineStart(machineType, machineId, mode.name, mode.duration, user.studentId);
  
  dataCollectionService.recordMachineUsage({
    id: `usage-${Date.now()}`,
    type: machineType,
    machine_id: machineId,
    mode: mode.name,
    duration: mode.duration,
    date: new Date().toISOString(),
    day: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
    time: new Date().toLocaleTimeString(),
    studentId: user.studentId,
    timestamp: Date.now(),
    spending: mode.duration * 0.5, // Adjust pricing as needed
    status: 'In Progress',
  });
  
  // ... rest of existing start logic
};
```
- [ ] `trackMachineStart()` call added
- [ ] `dataCollectionService.recordMachineUsage()` call added

#### Step 6: Track Machine Cancel
Find your existing `cancelMachine` function and update:
```tsx
const cancelMachine = (machineId: number, machineType: 'washer' | 'dryer'): void => {
  if (!user) return;

  const machine = machines.find(m => m.id === machineId && m.type === machineType);
  const timeRemaining = machine?.timeLeft || 0;

  // Add these lines:
  trackMachineCancel(machineType, machineId, user.studentId, timeRemaining);
  
  // ... rest of existing cancel logic
};
```
- [ ] `trackMachineCancel()` call added

#### Step 7: Enhanced Notifications on Completion
Find where you handle machine completion (in the useEffect that monitors machines) and replace the existing notification logic:

```tsx
// When machine.status === 'pending-collection'
if (machine.status === 'pending-collection' && !notifiedMachinesRef.current.has(machineKey)) {
  if (machine.userStudentId === user?.studentId) {
    notifiedMachinesRef.current.add(machineKey);
    
    // Replace old notification code with:
    const notificationId = notificationService.triggerNotification(
      machine.id,
      machine.type,
      `Your ${machine.type} ${machine.id} is complete! Please collect your clothes.`,
      'completion',
      machine.userStudentId
    );

    // Show modal
    setActiveNotification({ machineId: machine.id, machineType: machine.type });
    setShowNotificationModal(true);
  }
}
```
- [ ] Old notification code removed
- [ ] `notificationService.triggerNotification()` added
- [ ] Modal still shows to user

#### Step 8: Track Clothes Collection
Find your existing `clothesCollected` function and update:
```tsx
const clothesCollected = (machineId: number, machineType: 'washer' | 'dryer'): void => {
  if (!user) return;

  const machine = machines.find(m => m.id === machineId && m.type === machineType);
  const totalDuration = machine?.originalDuration || 0;

  // Add these lines:
  trackClothesCollection(machineType, machineId, user.studentId, totalDuration);
  
  // Stop notifications
  notificationService.stopAll();
  
  // ... rest of existing logic
};
```
- [ ] `trackClothesCollection()` call added
- [ ] `notificationService.stopAll()` call added

#### Step 9: Update Machine Lock Function
Find your existing `toggleMachineLock` function and update:
```tsx
const toggleMachineLock = (machineId: number, machineType: 'washer' | 'dryer'): void => {
  const machine = machines.find((m) => m.id === machineId && m.type === machineType);
  if (!machine) return;

  const newLockedState = !machine.locked;

  if (newLockedState) {
    // Add auto-unlock service:
    machineAutoUnlockService.lockMachine(
      machineId,
      machineType,
      24 * 60 * 60 * 1000, // 24 hours
      'Admin maintenance lock'
    );
  } else {
    // Unlock via service:
    machineAutoUnlockService.unlockMachine(machineId, machineType);
  }

  // ... rest of existing lock logic
};
```
- [ ] `machineAutoUnlockService.lockMachine()` call added for locking
- [ ] `machineAutoUnlockService.unlockMachine()` call added for unlocking

#### Step 10: Add Analytics Dashboard to Admin View
Find your admin section and add:
```tsx
{currentView === 'admin' && (
  <div className="space-y-6">
    {/* ... existing admin sections ... */}
    
    {/* Add new analytics section: */}
    <div className={`p-6 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
      <AnalyticsDashboard darkMode={darkMode} />
    </div>
  </div>
)}
```
- [ ] `<AnalyticsDashboard />` component added to admin view

## 🧪 Testing Phase (Verify Everything Works)

### Google Analytics Testing
- [ ] Open DevTools Console
- [ ] Check for message: "✅ Google Analytics initialized"
- [ ] Perform a login action
- [ ] Check GA4 dashboard Real-time events
- [ ] Verify "User:login" event appears in real-time

### Notification Testing
- [ ] Complete a machine cycle (simulate with `handleMachineCompletion()`)
- [ ] Hear bell ring sound (initial notification)
- [ ] Check that browser notification appears
- [ ] Hear continuous beeps every 3 seconds
- [ ] Click "Clothes Collected" button
- [ ] Verify ringing stops

### Auto-Unlock Testing
- [ ] Lock a machine from admin panel
- [ ] Check DevTools → Application → Local Storage
- [ ] Find `kyWash_lockedMachines` key
- [ ] See locked machine data
- [ ] Wait 24 hours OR test with shorter duration:
  ```tsx
  // In console:
  machineAutoUnlockService.setAutoUnlockDuration(60000); // 1 minute for testing
  ```
- [ ] After 1 minute, check console for auto-unlock message
- [ ] Check localStorage to verify lock is removed

### Data Collection Testing
- [ ] Open DevTools → Application → Local Storage
- [ ] Perform user actions (login, start machine, collect)
- [ ] Verify localStorage keys exist:
  - [ ] `kyWash_userBehaviors`
  - [ ] `kyWash_machineUsageData`
  - [ ] `kyWash_lockedMachines`
- [ ] Console test: `dataCollectionService.calculateMetrics()`
- [ ] Check that metrics object has all fields

### Analytics Dashboard Testing
- [ ] Navigate to admin panel
- [ ] Verify analytics dashboard loads
- [ ] Check that cards show data
- [ ] Verify charts render properly
- [ ] Test period filters (today, week, month)
- [ ] Check dark mode toggle

## 📊 Verification Commands

Run these in browser console to verify everything is working:

### Check Analytics
```tsx
// Should show all events tracked
ReactGA.event({ category: 'Test', action: 'console_test' });
```

### Check Data Collection
```tsx
// Should show metrics object
dataCollectionService.calculateMetrics();

// Should show user behaviors
dataCollectionService.getAllUserBehaviors();

// Should show machine usage
dataCollectionService.getMachineUsageData();

// Export all data
dataCollectionService.exportAnalyticsData();
```

### Check Auto-Unlock
```tsx
// Should show locked machines
machineAutoUnlockService.getLockedMachines();

// Should show time remaining
machineAutoUnlockService.getTimeRemaining(1, 'washer');

// Lock a machine
machineAutoUnlockService.lockMachine(1, 'washer', 60000);
```

### Check Notifications
```tsx
// Test notification
notificationService.triggerNotification(1, 'washer', 'Test message');

// Check active
notificationService.getActiveNotifications();

// Stop all
notificationService.stopAll();
```

## 🎯 Final Checklist

- [ ] All imports added to main component
- [ ] All services initialized in useEffect
- [ ] All tracking calls added to functions
- [ ] Analytics dashboard added to admin view
- [ ] Environment variable set correctly
- [ ] Dependencies installed (react-ga4)
- [ ] Google Analytics property created and ID set
- [ ] Notification permissions requested
- [ ] All testing completed successfully
- [ ] No console errors or warnings
- [ ] Data persisting in localStorage
- [ ] GA4 receiving real-time events
- [ ] Notifications playing audio correctly
- [ ] Auto-unlock checking regularly

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Environment variable `NEXT_PUBLIC_GA_MEASUREMENT_ID` set in production
- [ ] All local testing completed
- [ ] No sensitive data in tracking events
- [ ] Notification permissions requested (won't break app if denied)
- [ ] Auto-unlock duration appropriate for production
- [ ] Data collection privacy policy updated (if required)
- [ ] Users informed about analytics/tracking
- [ ] Analytics dashboard access controlled (admin only)
- [ ] Backup of production data set up
- [ ] Monitoring/alerting for service failures

## 💡 Pro Tips

1. **Testing Faster**: Set shorter durations for testing
   ```tsx
   machineAutoUnlockService.setAutoUnlockDuration(60000); // 1 minute
   notificationService.updateConfig({ maxContinuousRingDuration: 30000 }); // 30 seconds
   ```

2. **Monitor Services**: Check console logs
   ```tsx
   // All services log their actions
   ```

3. **Export Data Regularly**: Download analytics data for backup
   ```tsx
   dataCollectionService.exportAnalyticsData();
   ```

4. **Test Offline**: Services work offline and sync on reconnect

## 📞 Need Help?

1. **Read IMPLEMENTATION_GUIDE.md** - Most detailed reference
2. **Check QUICK_START.md** - Fast answers
3. **Review INTEGRATION_EXAMPLES.tsx** - Working code examples
4. **Check browser console** - Error messages are informative

✅ **You're all set! Start with the first item and work your way through the checklist.**
