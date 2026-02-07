import { describe, it, expect, beforeEach } from 'vitest';
import { machineStartTimes, tickServerTimers, recoverStartTimes, computeStateForClient, startServerTimer, stopServerTimer } from '../lib/serverTimers';

describe('serverTimers', () => {
  beforeEach(() => {
    machineStartTimes.clear();
  });

  it('computes finishTimestamp from start time + originalDuration', () => {
    const now = 1_700_000_000_000; // frozen time
    const state: any = {
      machines: [
        { id: 1, type: 'washer', status: 'running', originalDuration: 2 /* min */, userStudentId: 'u1' }
      ],
    };

    // set a start time so finishTimestamp should be start + 2*60*1000
    machineStartTimes.set('washer-1', now);

    const clientState = computeStateForClient(state, now);
    expect(clientState.machines[0].finishTimestamp).toBe(now + 2 * 60 * 1000);
  });

  it('computes finishTimestamp when only timeLeft is provided', () => {
    const now = 2_000_000_000_000;
    const state: any = {
      machines: [
        { id: 2, type: 'dryer', status: 'running', timeLeft: 30 }
      ]
    };

    const clientState = computeStateForClient(state, now);
    expect(clientState.machines[0].finishTimestamp).toBe(now + 30 * 1000);
  });

  it('tickServerTimers decrements and transitions to pending-collection', () => {
    const now = Date.now();
    const state: any = {
      machines: [
        { id: 3, type: 'washer', status: 'running', originalDuration: 1, timeLeft: 60, userStudentId: 'x' }
      ],
      usageHistory: [
        { id: 'h1', studentId: 'x', machineType: 'washer', machineId: 3, status: 'In Progress' }
      ]
    };

    // set start time to more than 1 minute ago so it completes
    const key = 'washer-3';
    machineStartTimes.set(key, now - 70 * 1000);

    const changed = tickServerTimers(state, now);
    expect(changed).toBe(true);
    expect(state.machines[0].status).toBe('pending-collection');
    expect(state.machines[0].timeLeft).toBe(0);
    expect(state.usageHistory[0].status).toBe('Completed');
  });

  it('recoverStartTimes reconstructs start time from originalDuration and timeLeft', () => {
    const now = Date.now();
    const state: any = {
      machines: [
        { id: 4, type: 'dryer', status: 'running', originalDuration: 10, timeLeft: 300 }
      ]
    };

    recoverStartTimes(state, now);
    const key = 'dryer-4';
    expect(machineStartTimes.has(key)).toBe(true);

    const start = machineStartTimes.get(key)!;
    // start should be now - (totalMs - timeLeftMs)
    const totalMs = 10 * 60 * 1000;
    const elapsedMs = Math.max(0, totalMs - 300 * 1000);
    expect(start).toBeGreaterThanOrEqual(now - elapsedMs - 5); // allow small delta
    expect(start).toBeLessThanOrEqual(now - elapsedMs + 5);
  });
});