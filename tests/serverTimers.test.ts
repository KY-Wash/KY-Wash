import { describe, it, expect, beforeEach } from 'vitest';
import { machineStartTimes, tickServerTimers, recoverStartTimes, computeStateForClient, rehydrateActiveCycles, startServerTimer, stopServerTimer, mergeMachineRuntimeSnapshot } from '../lib/serverTimers';

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

  it('rehydrates a cycle from ISO timestamps', () => {
    const now = 2_050_000_000_000;
    const state: any = {
      machines: [{
        id: 12,
        type: 'washer',
        status: 'available',
        timeLeft: 0,
        startedAt: new Date(now - 30_000).toISOString(),
        targetEndTime: new Date(now + 30_000).toISOString(),
      }],
      usageHistory: [],
    };

    expect(rehydrateActiveCycles(state, now)).toBe(true);
    expect(state.machines[0].status).toBe('running');
    expect(state.machines[0].timeLeft).toBe(30);
    expect(state.machines[0].finishTimestamp).toBe(now + 30_000);
  });

  it('preserves live identity fields for active machines when the machine row is partial', () => {
    const now = 2_100_000_000_000;
    const state: any = {
      machines: [
        { id: 8, type: 'washer', status: 'running', timeLeft: 1200, mode: '', userStudentId: '', userPhone: '' }
      ],
      usageHistory: [
        {
          id: 'h8',
          studentId: 'S8',
          machineType: 'washer',
          machineId: 8,
          mode: 'Normal',
          phoneNumber: '0123456789',
          timestamp: now - 5 * 60 * 1000,
          status: 'In Progress'
        }
      ]
    };

    const clientState = computeStateForClient(state, now);
    const machine = clientState.machines[0];

    expect(machine.userStudentId).toBe('S8');
    expect(machine.userPhone).toBe('0123456789');
    expect(machine.mode).toBe('Normal');
  });

  it('preserves an explicit finishTimestamp so the countdown reaches zero without drifting', () => {
    const now = 3_000_000_000_000;
    const state: any = {
      machines: [
        { id: 99, type: 'washer', status: 'running', finishTimestamp: now + 5_000, timeLeft: 30 }
      ]
    };

    const clientState = computeStateForClient(state, now);
    expect(clientState.machines[0].finishTimestamp).toBe(now + 5_000);
    expect(clientState.machines[0].finishTimestamp! - now).toBe(5_000);
  });

  it('preserves a running countdown when a partial running snapshot arrives without a finish timestamp', () => {
    const now = Date.now();
    const prevMachine = {
      status: 'running',
      finishTimestamp: now + 45_000,
      timeLeft: 45,
      userStudentId: 'x',
    };
    const incomingMachine = {
      status: 'running',
      finishTimestamp: undefined,
      timeLeft: 0,
      userStudentId: '',
    };

    const merged = mergeMachineRuntimeSnapshot(prevMachine, incomingMachine, now);

    expect(merged.status).toBe('running');
    expect(merged.finishTimestamp).toBe(prevMachine.finishTimestamp);
    expect(merged.timeLeft).toBe(45);
  });

  it('preserves a running countdown when a stale server snapshot marks it available', () => {
    const now = Date.now();
    const prevMachine = {
      status: 'running',
      finishTimestamp: now + 45_000,
      timeLeft: 45,
      userStudentId: 'x',
    };
    const incomingMachine = {
      status: 'available',
      finishTimestamp: undefined,
      timeLeft: 0,
      userStudentId: '',
    };

    const merged = mergeMachineRuntimeSnapshot(prevMachine, incomingMachine, now);

    expect(merged.status).toBe('running');
    expect(merged.finishTimestamp).toBe(prevMachine.finishTimestamp);
    expect(merged.timeLeft).toBe(45);
  });

  it('accepts an available snapshot after the active cycle has expired', () => {
    const now = Date.now();
    const prevMachine = {
      status: 'running',
      finishTimestamp: now - 1_000,
      timeLeft: 0,
    };

    const merged = mergeMachineRuntimeSnapshot(prevMachine, { status: 'available' }, now);

    expect(merged.status).toBe('available');
    expect(merged.finishTimestamp).toBeUndefined();
    expect(merged.timeLeft).toBe(0);
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

  it('tickServerTimers uses finishTimestamp when the start map is empty', () => {
    const now = Date.now();
    const state: any = {
      machines: [
        { id: 7, type: 'dryer', status: 'running', finishTimestamp: now + 1_500, timeLeft: 99, userStudentId: 'y' }
      ],
      usageHistory: [
        { id: 'h7', studentId: 'y', machineType: 'dryer', machineId: 7, status: 'In Progress' }
      ]
    };

    const changed = tickServerTimers(state, now + 2_000);
    expect(changed).toBe(true);
    expect(state.machines[0].status).toBe('pending-collection');
    expect(state.machines[0].timeLeft).toBe(0);
    expect(state.usageHistory[0].status).toBe('Completed');
  });

  it('anchors a timeLeft-only cycle so later ticks cannot extend it', () => {
    const start = 2_200_000_000_000;
    const state: any = {
      machines: [
        { id: 10, type: 'dryer', status: 'running', timeLeft: 10, userStudentId: 'u10' }
      ],
      usageHistory: [
        { id: 'h10', studentId: 'u10', machineType: 'dryer', machineId: 10, status: 'In Progress' }
      ]
    };

    tickServerTimers(state, start);
    expect(state.machines[0].finishTimestamp).toBe(start + 10_000);

    tickServerTimers(state, start + 5_000);
    expect(state.machines[0].timeLeft).toBe(5);

    tickServerTimers(state, start + 11_000);
    expect(state.machines[0].status).toBe('pending-collection');
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

  it('rehydrateActiveCycles restores a cycle from usage history even if the machine looks available', () => {
    const now = 4_000_000_000_000;
    const state: any = {
      machines: [
        { id: 6, type: 'washer', status: 'available', timeLeft: 0, mode: '', userStudentId: '', userPhone: '' }
      ],
      usageHistory: [
        {
          id: 'h6',
          studentId: 'S6',
          machineType: 'washer',
          machineId: 6,
          duration: 30,
          mode: 'Normal',
          timestamp: now - 10 * 60 * 1000,
          status: 'In Progress'
        }
      ]
    };

    const changed = rehydrateActiveCycles(state, now);

    expect(changed).toBe(true);
    expect(state.machines[0].status).toBe('running');
    expect(state.machines[0].timeLeft).toBeGreaterThan(0);
    expect(state.machines[0].finishTimestamp).toBe(now + 20 * 60 * 1000);
    expect(machineStartTimes.get('washer-6')).toBe(now - 10 * 60 * 1000);
  });

  it('timer ticks down each second until completion', () => {
    // Use a short duration (0.1 minutes = 6 seconds) to simulate per-second ticks
    const now = Date.now();
    const state: any = {
      machines: [
        { id: 5, type: 'dryer', status: 'running', originalDuration: 0.1, timeLeft: 6, userStudentId: 't1' }
      ],
      usageHistory: [
        { id: 'h2', studentId: 't1', machineType: 'dryer', machineId: 5, status: 'In Progress' }
      ]
    };

    // register start time as now
    machineStartTimes.set('dryer-5', now);

    // Tick once per second and assert decreasing timeLeft
    for (let i = 0; i <= 7; i++) {
      const currentTime = now + i * 1000;
      const changed = tickServerTimers(state, currentTime);

      const expected = Math.max(0, 6 - Math.floor((currentTime - now) / 1000));
      expect(state.machines[0].timeLeft).toBe(expected);

      if (expected > 0) {
        expect(state.machines[0].status).toBe('running');
      } else {
        expect(state.machines[0].status).toBe('pending-collection');
        expect(state.usageHistory[0].status).toBe('Completed');
        break;
      }
    }
  });
});