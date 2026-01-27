# Laundry Machine State Management - Bug Analysis & Fix

## Critical Issues Identified

### 1. **Report No One Button Freezes Timer** ❌
**Root Cause:** 
- Frontend emits 'no-one-report' event
- Backend **has no handler** for 'no-one-report' event
- Backend doesn't reset the machine state
- Frontend state is updated but then overwritten by polling at 5000ms
- Backend polling returns stale state → UI reverts

### 2. **Machine Done Button Briefly Shows Available, Then Reverts** ❌
**Root Cause:**
- Frontend emits 'machine-ready' event
- Backend **has no handler** for 'machine-ready' event
- Frontend updates state: `setMachines()` → Machine shows 'available'
- After 5 seconds, polling hits `/api/state` → Gets stale server state
- Server never processed the event, returns running machine → UI reverts to running state
- This creates a race condition where the 5-second polling loop wins

### 3. **Race Condition Architecture** ❌
**Current Flow (Broken):**
```
User clicks "Machine Done"
  ↓
Frontend: setMachines() to 'available' (optimistic update)
  ↓
Frontend: socketRef.emit('machine-ready', ...) → POST /api/state
  ↓
Meanwhile: polling timer fires every 5 seconds
  ↓
GET /api/state returns old server state (machine still 'running')
  ↓
Frontend: setMachines() from API response (overwrites optimistic update)
  ↓
UI reverts back to 'running' state ❌
```

### 4. **Polling Interval Problem**
- Frontend polls every 5 seconds
- When button clicked, state changes happen immediately
- But polling might fire right after and override changes
- No coordination between event emission and polling

## Root Cause Summary

| Issue | Frontend | Backend |
|-------|----------|---------|
| Report No One | ✓ Emits event | ❌ No handler for 'no-one-report' |
| Machine Done | ✓ Emits event | ❌ No handler for 'machine-ready' |
| Machine Force Stop | ✓ Emits event | ❌ No handler for 'machine-force-stop' |
| Race Condition | Updates state optimistically | Doesn't process events, polling wins |

## Solution Architecture

### State Transition Diagram

```
MACHINE LIFECYCLE - Report No One Button
=========================================

running (timer counting down)
  ↓ [User clicks "Report No One"]
  ↓ Frontend: emit('no-one-report')
  ↓ Backend: MUST process event immediately
  ↓ Backend: Stop timer, reset all fields
  ↓ Backend: updateAppState(machine to available)
  ↓ Frontend: receives updated state from POST response
  ↓ Frontend: setMachines() with {status: 'available', timeLeft: 0, ...}
  ↓
available (idle, ready for next user)


MACHINE LIFECYCLE - Machine Done Button
========================================

pending-collection (waiting for user to confirm)
  ↓ [User clicks "Machine Done" → "Yes, it's empty"]
  ↓ Frontend: emit('machine-ready')
  ↓ Backend: MUST process event immediately
  ↓ Backend: Reset machine state to available
  ↓ Backend: updateAppState()
  ↓ Frontend: receives updated state from POST response
  ↓ Frontend: setMachines() with {status: 'available', timeLeft: 0, ...}
  ↓
available (idle, ready for next user)


POLLING - Should NOT Override Event Responses
==============================================

Event Response (has priority):
  POST /api/state (event) → 200 OK with NEW state
  ↓
  Frontend receives state from event response
  ↓
  updateAppState() with response.state

Polling (only fills gaps):
  GET /api/state → OLD state
  ↓
  Only update if machine status is different than expected
  ↓
  If machine is 'available' locally, don't override
```

## Expected Final Machine State

After either "Report No One" or "Machine Done":

```javascript
{
  id: 1,
  type: 'washer',           // or 'dryer'
  status: 'available',      // ✅ MUST be 'available'
  timeLeft: 0,              // ✅ MUST be 0
  mode: null,               // ✅ MUST be null
  locked: false,            // ✅ MUST be false
  userStudentId: null,      // ✅ MUST be null
  userPhone: null,          // ✅ MUST be null
  originalDuration: undefined, // ✅ MUST be undefined
  cancellable: false        // ✅ MUST be false
}
```

## Implementation Plan

### Step 1: Add Backend Event Handlers (pages/api/state.ts)

Add these cases to the switch statement in POST handler:

```typescript
case 'no-one-report': {
  // Reset machine immediately - no countdown needed
  const machine = state.machines.find(
    (m) => m.id === data.machineId && m.type === data.machineType
  );
  if (machine && machine.status === 'running') {
    stopServerTimer(data.machineId, data.machineType);
    
    // Mark usage history as Completed
    state.usageHistory = state.usageHistory.map((h) => {
      if (h.studentId === machine.userStudentId &&
          h.machineType === data.machineType &&
          h.machineId === data.machineId &&
          h.status === 'In Progress') {
        updateSupabaseRecordStatus(machine.userStudentId, data.machineType, data.machineId, 'Completed');
        return { ...h, status: 'Completed' };
      }
      return h;
    });
    
    // Reset machine to available
    machine.status = 'available';
    machine.timeLeft = 0;
    machine.mode = '';
    machine.userStudentId = '';
    machine.userPhone = '';
    machine.locked = false;
  }
  break;
}

case 'machine-force-stop': {
  // Identical to 'no-one-report' - both reset machine to available
  const machine = state.machines.find(
    (m) => m.id === data.machineId && m.type === data.machineType
  );
  if (machine && machine.status === 'running') {
    stopServerTimer(data.machineId, data.machineType);
    
    state.usageHistory = state.usageHistory.map((h) => {
      if (h.studentId === machine.userStudentId &&
          h.machineType === data.machineType &&
          h.machineId === data.machineId &&
          h.status === 'In Progress') {
        updateSupabaseRecordStatus(machine.userStudentId, data.machineType, data.machineId, 'Completed');
        return { ...h, status: 'Completed' };
      }
      return h;
    });
    
    machine.status = 'available';
    machine.timeLeft = 0;
    machine.mode = '';
    machine.userStudentId = '';
    machine.userPhone = '';
    machine.locked = false;
  }
  break;
}

case 'machine-ready': {
  // Machine Done button - identical reset logic
  const machine = state.machines.find(
    (m) => m.id === data.machineId && m.type === data.machineType
  );
  if (machine) {
    stopServerTimer(data.machineId, data.machineType);
    
    state.usageHistory = state.usageHistory.map((h) => {
      if (h.studentId === machine.userStudentId &&
          h.machineType === data.machineType &&
          h.machineId === data.machineId &&
          h.status === 'In Progress') {
        updateSupabaseRecordStatus(machine.userStudentId, data.machineType, data.machineId, 'Completed');
        return { ...h, status: 'Completed' };
      }
      return h;
    });
    
    machine.status = 'available';
    machine.timeLeft = 0;
    machine.mode = '';
    machine.userStudentId = '';
    machine.userPhone = '';
    machine.locked = false;
  }
  break;
}
```

### Step 2: Fix Frontend Polling Race Condition (app/page.tsx)

**Problem:** Polling overwrites optimistic updates after 5 seconds
**Solution:** Don't override recent state changes in polling

Modify the `fetchState` function to be smarter:

```typescript
const fetchState = async () => {
  try {
    const response = await fetch('/api/state');
    if (response.ok) {
      const newState = await response.json();

      setMachines((prevMachines) => {
        return newState.machines.map((m: any) => {
          const prevMachine = prevMachines.find((pm) => pm.id === parseInt(m.id) && pm.type === m.type);
          
          // IMPORTANT: Don't override machine state if it just changed
          // If previous state is 'available', keep it (don't revert to 'running')
          if (prevMachine?.status === 'available' && m.status === 'running') {
            console.warn(`[POLLING] Blocking state revert: ${m.type}-${m.id} trying to go back to running`);
            return prevMachine; // Keep local state
          }
          
          // Only update if status is the same or expected transition
          return {
            id: parseInt(m.id),
            type: m.type,
            status: m.status,
            timeLeft: prevMachine?.status === 'running' ? prevMachine.timeLeft : m.timeLeft,
            mode: m.mode || null,
            locked: m.locked,
            userStudentId: m.userStudentId || null,
            userPhone: m.userPhone || null,
            originalDuration: m.originalDuration || undefined,
          };
        });
      });

      // Update other states...
    }
  } catch (error) {
    console.error('Failed to fetch state:', error);
  }
};
```

### Step 3: Add Defensive Checks in Frontend

Add a flag to track recent state changes:

```typescript
const lastStateChangeRef = useRef<Map<string, number>>(new Map());

const updateMachineState = (machineId: number, machineType: string, newStatus: string) => {
  const key = `${machineType}-${machineId}`;
  lastStateChangeRef.current.set(key, Date.now()); // Record when we last changed this
  // ... update state
};
```

Then in polling, check if machine was recently changed:

```typescript
// In fetchState polling function
if (prevMachine) {
  const key = `${prevMachine.type}-${prevMachine.id}`;
  const lastChange = lastStateChangeRef.current.get(key) || 0;
  const timeSinceChange = Date.now() - lastChange;
  
  // Don't override if changed less than 3 seconds ago
  if (timeSinceChange < 3000) {
    console.log(`[POLLING] Skipping update for recently changed machine: ${key}`);
    return prevMachine;
  }
}
```

## Why It Was Breaking

1. **Missing Handlers**: Backend never saw 'no-one-report', 'machine-ready', or 'machine-force-stop' events
2. **State Not Persisted**: Even if event processed, `updateAppState()` wasn't called
3. **Polling Wins**: Frontend made optimistic update (available), but polling fetched stale state (running)
4. **Race Condition**: Frontend couldn't guarantee state would stick

## Testing Checklist

After implementation:

- [ ] Click "Report No One" → Machine changes to available immediately
- [ ] 5-second poll completes → Machine stays available (doesn't revert)
- [ ] Click "Machine Done" → Shows available state
- [ ] 5-second poll completes → Machine still shows available
- [ ] Another user can click "Start" and begin new cycle
- [ ] Refresh page → Machine state persists correctly
- [ ] Timer doesn't freeze - counts down properly
- [ ] No console errors

---

**Status**: Ready for implementation
**Severity**: Critical (prevents basic functionality)
**Affected Users**: Anyone using Report No One or Machine Done buttons
