# Usage Examples - All Features

Complete code examples for implementing all four features in your app.

---

## 1. Google Analytics - Complete Example

### Basic Page Component

```typescript
'use client';

import { useEffect } from 'react';
import { useDataCollection } from '@/lib/dataCollection';

export default function MyPage() {
  const { trackEvent } = useDataCollection();

  // Track page load
  useEffect(() => {
    trackEvent('page_viewed', {
      pageName: 'machines',
      timestamp: new Date().toISOString(),
    });
  }, [trackEvent]);

  const handleAction = () => {
    trackEvent('user_action', {
      action: 'button_clicked',
      buttonName: 'start_machine',
    });
  };

  return (
    <div>
      <h1>My Page</h1>
      <button onClick={handleAction}>Do Something</button>
    </div>
  );
}
```

### Track Machine Events

```typescript
const { trackEvent } = useDataCollection();

// When user starts a machine
trackEvent('machine_started', {
  machineId: 'W1',
  machineType: 'washer',
  cycleTime: 45,
  userId: 'user123',
});

// When cycle completes
trackEvent('machine_cycle_complete', {
  machineId: 'W1',
  actualTime: 45,
  completionTime: new Date().toISOString(),
});

// When user collects clothes
trackEvent('clothes_collected', {
  machineId: 'W1',
  delayTime: 5, // minutes after completion
});

// When user joins queue
trackEvent('queue_join', {
  machineType: 'washer',
  queuePosition: 2,
  estimatedWait: 15,
});
```

### View Analytics Data

```typescript
const { getAnalytics } = useDataCollection();

const analyticsData = getAnalytics();
console.log('Total events:', analyticsData.totalEvents);
console.log('Events by type:', analyticsData.eventsByType);
console.log('Recent events:', analyticsData.recentEvents);
```

---

## 2. Notifications - Complete Example

### Ring Notification (Single Ring)

```typescript
import { ringNotification } from '@/lib/enhancedNotifications';

// When machine cycle completes
if (machine.status === 'completed') {
  ringNotification(`${machine.name} cycle is done!`);
  // Plays once, auto-closes after 5 seconds
}
```

### Alert Notification (Continuous)

```typescript
import { alertNotification } from '@/lib/enhancedNotifications';

// When grace period is ending
if (timeRemaining === 0) {
  alertNotification(`Hurry! Collect clothes from ${machine.name}!`);
  // Rings every 30 seconds until user clicks it
}
```

### Full Machine Cycle with Notifications

```typescript
import { ringNotification, alertNotification } from '@/lib/enhancedNotifications';

useEffect(() => {
  if (machine.timeRemaining === 0 && machine.status === 'in-use') {
    // Step 1: Ring once when cycle completes
    ringNotification(`${machine.name} cycle complete!`);
    
    // Step 2: Set status to waiting for collection
    setMachineStatus(machine.id, 'completed');
    
    // Step 3: Start grace period
    startGracePeriod(machine.id, 15 * 60 * 1000);
    
    // Step 4: Ring continuously during grace period
    setTimeout(() => {
      alertNotification(`Please collect clothes from ${machine.name}!`);
    }, 14 * 60 * 1000); // Start ringing at 1 minute remaining
  }
}, [machine.timeRemaining, machine.status]);
```

---

## 3. Auto-Unlock Timer - Complete Example

### Lock Machine After Cycle

```typescript
import { MachineAutoUnlock } from '@/lib/machineAutoUnlock';

const autoUnlock = new MachineAutoUnlock();

// When cycle completes
autoUnlock.lockMachine(
  1,                          // Machine ID
  'washer',                   // Machine type
  15 * 60 * 1000,            // 15 minutes
  'Cycle completed'          // Reason (optional)
);
```

### Check Machine Status

```typescript
// Check if machine is locked
const isLocked = autoUnlock.isMachineLocked(1, 'washer');

// Get time remaining
const timeLeft = autoUnlock.getTimeRemaining(1, 'washer');
console.log(`Time until unlock: ${timeLeft}ms`);

// Get all locked machines
const lockedMachines = autoUnlock.getLockedMachines();
```

### Unlock Machine Manually

```typescript
// When user collects clothes
autoUnlock.unlockMachine(1, 'washer');
setMachineStatus('available');
```

### Register Callback for Auto-Unlock Events

```typescript
// Set callback for when machine auto-unlocks
autoUnlock.onUnlock((machine) => {
  console.log(`Machine ${machine.machineId} auto-unlocked!`);
  alertNotification('Machine is now locked!');
});
```

### Full Machine Lifecycle

```typescript
'use client';

import { useEffect, useState } from 'react';
import { MachineAutoUnlock } from '@/lib/machineAutoUnlock';
import { ringNotification, alertNotification } from '@/lib/enhancedNotifications';
import { useDataCollection } from '@/lib/dataCollection';

export function MachineCard({ machine, onStatusChange }) {
  const autoUnlock = new MachineAutoUnlock();
  const { trackEvent } = useDataCollection();
  const [status, setStatus] = useState(machine.status);
  const [timeLeft, setTimeLeft] = useState(machine.timeRemaining);

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = Math.max(0, prev - 1);
        
        // When cycle completes
        if (newTime === 0 && prev > 0) {
          // 1. Ring once
          ringNotification(`${machine.name} cycle complete!`);
          
          // 2. Track event
          trackEvent('machine_cycle_complete', { machineId: machine.id });
          
          // 3. Lock machine (grace period = 15 min)
          autoUnlock.lockMachine(
            machine.machineId,
            machine.type,
            15 * 60 * 1000,
            'Cycle completed'
          );
          
          // 4. Update status
          setStatus('waiting_collection');
          onStatusChange('waiting_collection');
          
          // 5. Continuous alert at 1 minute remaining
          setTimeout(() => {
            alertNotification(`Please collect clothes from ${machine.name}!`);
          }, 14 * 60 * 1000);
        }
        
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleStart = () => {
    setStatus('running');
    setTimeLeft(45); // 45 minutes for washer
    trackEvent('machine_started', { machineId: machine.id });
  };

  const handleCollect = () => {
    setStatus('available');
    setTimeLeft(0);
    autoUnlock.unlockMachine(machine.machineId, machine.type);
    trackEvent('clothes_collected', { machineId: machine.id });
    onStatusChange('available');
  };

  return (
    <div>
      <h2>{machine.name}</h2>
      <p>Status: {status}</p>
      <p>Time: {timeLeft} min</p>
      
      {status === 'available' && (
        <button onClick={handleStart}>Start</button>
      )}
      {status === 'waiting_collection' && (
        <button onClick={handleCollect}>Collect</button>
      )}
      {status === 'running' && (
        <p>{timeLeft} minutes remaining</p>
      )}
    </div>
  );
}
```

---

## 4. Complete Integration Example

### Full Dashboard Component

```typescript
'use client';

import { useEffect, useState } from 'react';
import { ringNotification, alertNotification } from '@/lib/enhancedNotifications';
import { MachineAutoUnlock } from '@/lib/machineAutoUnlock';
import { useDataCollection } from '@/lib/dataCollection';

interface Machine {
  id: string;
  name: string;
  type: 'washer' | 'dryer';
  status: 'available' | 'running' | 'waiting_collection';
  timeRemaining: number;
}

export default function MachinesDashboard() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const { trackEvent } = useDataCollection();
  const autoUnlock = new MachineAutoUnlock();

  // Initialize machines
  useEffect(() => {
    const initialMachines: Machine[] = [
      {
        id: 'W1',
        name: 'Washer 1',
        type: 'washer',
        status: 'available',
        timeRemaining: 0,
      },
      {
        id: 'W2',
        name: 'Washer 2',
        type: 'washer',
        status: 'available',
        timeRemaining: 0,
      },
      {
        id: 'D1',
        name: 'Dryer 1',
        type: 'dryer',
        status: 'available',
        timeRemaining: 0,
      },
      {
        id: 'D2',
        name: 'Dryer 2',
        type: 'dryer',
        status: 'available',
        timeRemaining: 0,
      },
    ];
    setMachines(initialMachines);
  }, []);

  // Timer loop
  useEffect(() => {
    const interval = setInterval(() => {
      setMachines((prev) =>
        prev.map((machine) => {
          if (machine.timeRemaining > 0) {
            const newTime = Math.max(0, machine.timeRemaining - 1);

            // Cycle completed
            if (newTime === 0 && machine.timeRemaining > 0) {
              // 1. Ring notification
              ringNotification(`${machine.name} cycle complete!`);

              // 2. Track event
              trackEvent('machine_cycle_complete', {
                machineId: machine.id,
                machineType: machine.type,
                cycleTime: machine.type === 'washer' ? 45 : 60,
              });

              // 3. Lock machine (15 min grace period)
              const machineNum = parseInt(machine.id.replace(/\D/g, '')) || 1;
              autoUnlock.lockMachine(
                machineNum,
                machine.type,
                15 * 60 * 1000,
                `Cycle completed for ${machine.name}`
              );

              // 4. Start continuous alert in 14 minutes
              setTimeout(() => {
                alertNotification(
                  `Collect clothes from ${machine.name} soon!`
                );
              }, 14 * 60 * 1000);

              // Change to waiting collection status
              return {
                ...machine,
                timeRemaining: newTime,
                status: 'waiting_collection',
              };
            }

            return { ...machine, timeRemaining: newTime };
          }
          return machine;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [trackEvent]);

  const handleStartMachine = (machineId: string, machineType: 'washer' | 'dryer') => {
    const cycleTime = machineType === 'washer' ? 45 : 60;

    setMachines((prev) =>
      prev.map((m) =>
        m.id === machineId
          ? {
              ...m,
              status: 'running',
              timeRemaining: cycleTime,
            }
          : m
      )
    );

    trackEvent('machine_started', {
      machineId,
      machineType,
      cycleTime,
    });
  };

  const handleCollectClothes = (machineId: string, machineType: 'washer' | 'dryer') => {
    setMachines((prev) =>
      prev.map((m) =>
        m.id === machineId
          ? { ...m, status: 'available', timeRemaining: 0 }
          : m
      )
    );

    const machineNum = parseInt(machineId.replace(/\D/g, '')) || 1;
    autoUnlock.unlockMachine(machineNum, machineType);

    trackEvent('clothes_collected', { machineId, machineType });
  };

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold mb-6">Machines</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {machines.map((machine) => (
          <div key={machine.id} className="border rounded-lg p-4">
            <h2 className="text-xl font-bold mb-2">{machine.name}</h2>

            <div className="space-y-2 mb-4">
              <p>
                <strong>Status:</strong> {machine.status}
              </p>
              {machine.timeRemaining > 0 && (
                <>
                  <p>
                    <strong>Time Remaining:</strong> {machine.timeRemaining}{' '}
                    min
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{
                        width: `${
                          (machine.timeRemaining /
                            (machine.type === 'washer' ? 45 : 60)) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2">
              {machine.status === 'available' && (
                <button
                  onClick={() => handleStartMachine(machine.id, machine.type)}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded"
                >
                  Start Machine
                </button>
              )}
              {machine.status === 'waiting_collection' && (
                <button
                  onClick={() =>
                    handleCollectClothes(machine.id, machine.type)
                  }
                  className="flex-1 bg-green-600 text-white px-4 py-2 rounded"
                >
                  Collect Clothes
                </button>
              )}
              {machine.status === 'running' && (
                <button disabled className="flex-1 bg-gray-400 text-white px-4 py-2 rounded">
                  Running...
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## Environment Setup

Create `.env.local` in the `ky-washing` directory:

```bash
# Google Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Add other environment variables as needed
DATABASE_URL=
API_KEY=
```

---

## Testing All Features

### Test 1: Google Analytics
1. Open DevTools Network tab
2. Start your app
3. Look for requests to `googletagmanager.com`
4. Verify `window.gtag` is defined

### Test 2: Notifications
1. Browser will ask for notification permission
2. Click "Allow"
3. You should hear a sound when cycle completes
4. Notification should appear in system tray

### Test 3: Auto-Unlock Timer
1. Start a machine
2. Wait for timer to complete
3. Check that machine is locked
4. Click "Collect Clothes" to unlock

### Test 4: Analytics
1. Perform actions on machines
2. Go to `/analytics` page
3. See events tracked in local storage
4. Check Google Analytics dashboard

---

**Ready to integrate?** Start with one feature at a time and test thoroughly!
