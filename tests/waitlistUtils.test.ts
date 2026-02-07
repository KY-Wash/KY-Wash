import { describe, it, expect } from 'vitest';
import { dedupeWaitlistEntries } from '../lib/waitlistUtils';

describe('dedupeWaitlistEntries', () => {
  it('keeps only latest entry per student+machine_type', () => {
    const rows = [
      { student_id: 'S1', phone: '011', machine_type: 'washer', created_at: '2024-01-01T10:00:00Z' },
      { student_id: 'S1', phone: '012', machine_type: 'washer', created_at: '2024-01-01T10:05:00Z' },
      { student_id: 'S2', phone: '013', machine_type: 'dryer', created_at: '2024-01-01T09:00:00Z' },
      { student_id: 'S1', phone: '014', machine_type: 'dryer', created_at: '2024-01-01T11:00:00Z' },
    ];

    const deduped = dedupeWaitlistEntries(rows as any);
    expect(deduped.washers.length).toBe(1);
    expect(deduped.washers[0].studentId).toBe('S1');
    expect(deduped.washers[0].phone).toBe('012');

    expect(deduped.dryers.length).toBe(2);
    const dS2 = deduped.dryers.find(d => d.studentId === 'S2');
    expect(dS2).toBeDefined();
  });
});