import { describe, it, expect } from 'vitest';
import { getCollectionActionState, buildMachineCollectionKey } from '../lib/machineCollectionFlow';

describe('machineCollectionFlow', () => {
  it('shows collection controls only for the user who started the completed machine', () => {
    const state = getCollectionActionState({
      status: 'pending-collection',
      userStudentId: 'student-1',
      collectionStatus: null,
    } as any, 'student-1');

    expect(state.showOnTheWay).toBe(true);
    expect(state.showClothesCollected).toBe(true);
    expect(state.showPendingNotice).toBe(false);
  });

  it('keeps collection controls available for other users when someone is on the way', () => {
    const state = getCollectionActionState({
      status: 'pending-collection',
      userStudentId: 'student-1',
      collectionStatus: { status: 'coming', user: 'student-2' },
    } as any, 'student-3');

    expect(state.showOnTheWay).toBe(true);
    expect(state.showClothesCollected).toBe(true);
    expect(state.showPendingNotice).toBe(true);
    expect(state.pendingNotice).toContain('student-2');
  });

  it('builds a stable key for machine collection state', () => {
    expect(buildMachineCollectionKey('washer', 2)).toBe('washer-2');
  });
});
