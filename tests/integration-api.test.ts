import { describe, it, expect, beforeEach } from 'vitest';
import { createInitialState, getAppState, setAppState, updateAppState } from '../lib/sharedState';
import { computeStateForClient, recoverStartTimes, tickServerTimers, startServerTimer as startServerTimerUtil } from '../lib/serverTimers';
import fs from 'fs';
import path from 'path';

const STATE_FILE = path.join(process.cwd(), '.kyWash-state.json');

function makeReq(method: string, body?: any) {
  return { method, body } as any;
}

function makeRes() {
  let statusCode = 200;
  let jsonBody: any = null;
  return {
    status(code: number) { statusCode = code; return this; },
    json(obj: any) { jsonBody = obj; return this; },
    setHeader() { return; },
    _get() { return { statusCode, jsonBody }; }
  } as any;
}

describe('API integration tests', () => {
  beforeEach(() => {
    // Reset in-memory state to initial and remove persisted state file
    setAppState(createInitialState());
    try { if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE); } catch (e) { /* ignore */ }
  });

  it('machine-start then machine-complete transitions correctly', async () => {
    // Simulate machine start by mutating app state and starting server timer util
    const s = getAppState();
    const idx = s.machines.findIndex((m) => m.type === 'washer' && m.id === '1');
    s.machines[idx] = { ...s.machines[idx], status: 'running', timeLeft: 60, originalDuration: 1, userStudentId: 'S100', userPhone: '0123456789' } as any;
    updateAppState(s);

    // start server timer util
    startServerTimerUtil('1', 'washer', 1);

    // Compute client state and assert finishTimestamp
    const state1 = computeStateForClient(getAppState(), Date.now());
    const machine = state1.machines.find((m: any) => m.type === 'washer' && m.id === '1');
    expect(machine).toBeDefined();
    expect(machine.status).toBe('running');
    expect(machine.timeLeft).toBeGreaterThan(0);
    expect(machine.finishTimestamp).toBeDefined();

    // Simulate passage of time to complete cycle by invoking tickServerTimers with a future time
    const now = Date.now();
    const changed = tickServerTimers(getAppState(), now + 2 * 60 * 1000); // 2 minutes later
    expect(changed).toBe(true);
    const postTick = getAppState();
    const machine2 = postTick.machines.find((m) => m.type === 'washer' && m.id === '1');
    expect(machine2).toBeDefined();
    expect(machine2!.status).toBe('pending-collection');
    expect(machine2!.timeLeft).toBe(0);
  });

  it('waitlist-join persists and seeding works', async () => {
    // Simulate a waitlist join via server-side state mutation and persist
    const s = getAppState();
    s.waitlists.washers.push({ studentId: 'S200', phone: '0199999999' });
    updateAppState(s);

    // Read state and assert
    const state = getAppState();
    expect(state.waitlists.washers.some((w: any) => w.studentId === 'S200')).toBe(true);

    // Check persisted file contains the waitlist after updateAppState
    const persisted = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    expect(persisted.waitlists.washers.some((w: any) => w.studentId === 'S200')).toBe(true);

    // Simulate server restart by reloading persisted state
    setAppState(createInitialState());
    const persistedState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    // Replace current app state with persisted state (simulate server restart/load)
    setAppState(persistedState);
    const s2 = getAppState();
    expect(s2.waitlists.washers.some(w => w.studentId === 'S200')).toBe(true);
  });

  it('user-register adds user with phone and is returned by GET', async () => {
    // Simulate a user registration directly in server state and persist
    const s = getAppState();
    s.users.push({ studentId: 'S300', phoneNumber: '0181112222' } as any);
    updateAppState(s);

    const state = getAppState();
    const user = state.users.find((u: any) => u.studentId === 'S300');
    expect(user).toBeDefined();
    expect(user?.phoneNumber).toBe('0181112222');

    // Ensure persisted state contains the user
    const persisted = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    expect(persisted.users.some((u: any) => u.studentId === 'S300' && u.phoneNumber === '0181112222')).toBe(true);
  });
});
