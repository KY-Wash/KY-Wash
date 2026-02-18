// Lightweight server-side timer utilities to enable deterministic testing

// NOTE: This module is pure (no DB side-effects). Callers (API handler) should
// perform any necessary side-effects after these helpers run.

export const machineStartTimes: Map<string, number> = new Map();

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
      const key = `${machine.type}-${machine.id}`;
      // If both originalDuration and timeLeft present, reconstruct a start time
      if (typeof machine.originalDuration === 'number') {
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
  const machines = (state.machines || []).map((m: any) => {
    let finishTimestamp: number | undefined;
    if (m.status === 'running') {
      const key = `${m.type}-${m.id}`;
      const startTime = machineStartTimes.get(key);
      if (startTime !== undefined && typeof m.originalDuration === 'number') {
        finishTimestamp = startTime + m.originalDuration * 60 * 1000;
      } else if (typeof m.timeLeft === 'number' && m.timeLeft > 0) {
        finishTimestamp = now + m.timeLeft * 1000;
      }
    }
    return { ...m, finishTimestamp };
  });
  return { ...state, machines };
}

// Pure function to perform one server tick; returns true if state changed
export function tickServerTimers(state: any, now = Date.now()): boolean {
  let stateChanged = false;

  state.machines.forEach((machine: any) => {
    const key = `${machine.type}-${machine.id}`;

    if (machine.status === 'running') {
      const startTime = machineStartTimes.get(key);
      if (startTime !== undefined) {
        // Determine total duration seconds
        const totalDurationSeconds = machine.originalDuration ? machine.originalDuration * 60 : machine.timeLeft;
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const newTimeLeft = Math.max(0, totalDurationSeconds - elapsedSeconds);

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
