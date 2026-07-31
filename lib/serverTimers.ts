// Lightweight server-side timer utilities to enable deterministic testing

// NOTE: This module is pure (no DB side-effects). Callers (API handler) should
// perform any necessary side-effects after these helpers run.

export const machineStartTimes: Map<string, number> = new Map();

function getMachineKey(machine: any): string {
  return `${machine.type}-${machine.id}`;
}

function getActiveUsageByMachine(state: any): Map<string, any> {
  const activeUsageByMachine = new Map<string, any>();

  (state.usageHistory || []).forEach((record: any) => {
    if (record?.status === 'In Progress') {
      const machineType = record.machineType || record.type;
      const machineId = record.machineId || record.machine_id;
      activeUsageByMachine.set(`${machineType}-${machineId}`, record);
    }
  });

  return activeUsageByMachine;
}

function hasLiveValue(value: unknown): boolean {
  return value !== null && value !== undefined && value !== '';
}

// Restore running cycles from persisted machine metadata or active usage history.
// This is the source of truth used after reloads and on multi-device refreshes.
export function rehydrateActiveCycles(state: any, now = Date.now()): boolean {
  let stateChanged = false;
  const activeUsageByMachine = getActiveUsageByMachine(state);

  (state.machines || []).forEach((machine: any) => {
    const key = getMachineKey(machine);
    const activeRecord = activeUsageByMachine.get(key);

    let originalDuration = typeof machine.originalDuration === 'number' ? machine.originalDuration : undefined;
    let startedAt = typeof machine.startedAt === 'number' ? machine.startedAt : undefined;
    let finishTimestamp = typeof machine.finishTimestamp === 'number' ? machine.finishTimestamp : undefined;
    const cachedStartTime = machineStartTimes.get(key);

    if (activeRecord) {
      if (originalDuration === undefined && typeof activeRecord.duration === 'number') {
        originalDuration = activeRecord.duration;
      }

      if (startedAt === undefined && typeof activeRecord.timestamp === 'number') {
        startedAt = activeRecord.timestamp;
      }
    }

    if (finishTimestamp === undefined) {
      if (cachedStartTime !== undefined && originalDuration !== undefined) {
        finishTimestamp = cachedStartTime + originalDuration * 60 * 1000;
      } else if (startedAt !== undefined && originalDuration !== undefined) {
        finishTimestamp = startedAt + originalDuration * 60 * 1000;
      } else if (machine.status === 'running' && typeof machine.timeLeft === 'number' && machine.timeLeft > 0 && startedAt === undefined && cachedStartTime === undefined && originalDuration === undefined) {
        finishTimestamp = now + machine.timeLeft * 1000;
      }
    }

    const hasActiveCycle = Boolean(activeRecord) || finishTimestamp !== undefined || startedAt !== undefined;
    if (!hasActiveCycle) {
      if (machine.status === 'running') {
        const nextStatus = 'available';
        if (machine.status !== nextStatus) {
          machine.status = nextStatus;
          stateChanged = true;
        }
      }
      return;
    }

    if (originalDuration !== undefined && machine.originalDuration !== originalDuration) {
      machine.originalDuration = originalDuration;
      stateChanged = true;
    }

    if (startedAt !== undefined && machine.startedAt !== startedAt) {
      machine.startedAt = startedAt;
      stateChanged = true;
    }

    if (finishTimestamp !== undefined && machine.finishTimestamp !== finishTimestamp) {
      machine.finishTimestamp = finishTimestamp;
      stateChanged = true;
    }

    const remainingSeconds = finishTimestamp !== undefined
      ? Math.max(0, Math.ceil((finishTimestamp - now) / 1000))
      : Math.max(0, typeof machine.timeLeft === 'number' ? Math.floor(machine.timeLeft) : 0);

    const nextStatus = remainingSeconds > 0 ? 'running' : 'pending-collection';

    if (machine.status !== nextStatus) {
      machine.status = nextStatus;
      stateChanged = true;
    }

    if (machine.timeLeft !== (nextStatus === 'running' ? remainingSeconds : 0)) {
      machine.timeLeft = nextStatus === 'running' ? remainingSeconds : 0;
      stateChanged = true;
    }

    if (nextStatus === 'running') {
      machineStartTimes.set(key, startedAt ?? now);
    } else {
      machineStartTimes.delete(key);
    }

    if (activeRecord) {
      machine.userStudentId = hasLiveValue(machine.userStudentId) ? machine.userStudentId : (activeRecord.studentId || '');
      machine.userPhone = hasLiveValue(machine.userPhone) ? machine.userPhone : (activeRecord.phoneNumber || activeRecord.phone || '');
      machine.mode = hasLiveValue(machine.mode) ? machine.mode : (activeRecord.mode || '');
    }
  });

  return stateChanged;
}

export function startServerTimer(machineId: string, machineType: string, initialDuration: number) {
  const key = `${machineType}-${machineId}`;
  machineStartTimes.set(key, Date.now());
}

export function stopServerTimer(machineId: string, machineType: string) {
  const key = `${machineType}-${machineId}`;
  machineStartTimes.delete(key);
}

export function recoverStartTimes(state: any, now = Date.now()) {
  state.machines.forEach((machine: any) => {
    if (machine.status === 'running' && typeof machine.timeLeft === 'number' && machine.timeLeft > 0) {
      const key = getMachineKey(machine);
      // Prefer a persisted finish timestamp when available, otherwise reconstruct from duration/time left.
      if (typeof machine.finishTimestamp === 'number' && typeof machine.originalDuration === 'number') {
        const totalMs = machine.originalDuration * 60 * 1000;
        const startTime = machine.finishTimestamp - totalMs;
        machineStartTimes.set(key, startTime);
      } else if (typeof machine.originalDuration === 'number') {
        const totalMs = machine.originalDuration * 60 * 1000;
        const elapsedMs = Math.max(0, totalMs - machine.timeLeft * 1000);
        const startTime = now - elapsedMs;
        machineStartTimes.set(key, startTime);
      } else {
        // Fall back: record start as now so server will decrement relative to timeLeft
        machineStartTimes.set(key, now);
      }
    }
  });
}

export function computeStateForClient(state: any, now = Date.now()) {
  const activeUsageByMachine = getActiveUsageByMachine(state);
  const machines = (state.machines || []).map((m: any) => {
    const key = getMachineKey(m);
    const activeRecord = activeUsageByMachine.get(key);
    let finishTimestamp: number | undefined;
    if (m.status === 'running') {
      if (typeof m.finishTimestamp === 'number') {
        finishTimestamp = m.finishTimestamp;
      }
      const key = getMachineKey(m);
      const startTime = machineStartTimes.get(key);
      if (finishTimestamp === undefined && startTime !== undefined && typeof m.originalDuration === 'number') {
        finishTimestamp = startTime + m.originalDuration * 60 * 1000;
      } else if (finishTimestamp === undefined && typeof m.timeLeft === 'number' && m.timeLeft > 0) {
        finishTimestamp = now + m.timeLeft * 1000;
      }
    }
    return {
      ...m,
      userStudentId: hasLiveValue(m.userStudentId) ? m.userStudentId : (activeRecord?.studentId || m.userStudentId),
      userPhone: hasLiveValue(m.userPhone) ? m.userPhone : (activeRecord?.phoneNumber || activeRecord?.phone || m.userPhone),
      mode: hasLiveValue(m.mode) ? m.mode : (activeRecord?.mode || m.mode),
      finishTimestamp,
    };
  });
  return { ...state, machines };
}

// Pure function to perform one server tick; returns true if state changed
export function tickServerTimers(state: any, now = Date.now()): boolean {
  let stateChanged = false;

  state.machines.forEach((machine: any) => {
    const key = getMachineKey(machine);

    if (machine.status === 'running') {
      const startTime = machineStartTimes.get(key);
      let finishTimestamp = typeof machine.finishTimestamp === 'number' ? machine.finishTimestamp : undefined;

      if (finishTimestamp === undefined && startTime !== undefined && typeof machine.originalDuration === 'number') {
        finishTimestamp = startTime + machine.originalDuration * 60 * 1000;
      }

      if (finishTimestamp === undefined && typeof machine.timeLeft === 'number' && machine.timeLeft > 0) {
        finishTimestamp = now + machine.timeLeft * 1000;
      }

      if (finishTimestamp !== undefined) {
        const newTimeLeft = Math.max(0, Math.ceil((finishTimestamp - now) / 1000));

        if (newTimeLeft !== machine.timeLeft) {
          machine.timeLeft = newTimeLeft;
          stateChanged = true;
        }

        if (machine.timeLeft === 0 && machine.status === 'running') {
          machine.status = 'pending-collection';
          stateChanged = true;

          // Mark usage history to Completed where appropriate
          const historyRecord = state.usageHistory.find((h: any) =>
            h.studentId === machine.userStudentId &&
            h.machineType === machine.type &&
            h.machineId === machine.id &&
            h.status === 'In Progress'
          );
          if (historyRecord) {
            historyRecord.status = 'Completed';
            // Keep side-effects (DB updates) to the caller
          }
        }
      }
    }
  });

  return stateChanged;
}
