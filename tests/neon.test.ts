import { describe, expect, it } from 'vitest';
import { buildMachineSessionRecord } from '../lib/neon';

describe('buildMachineSessionRecord', () => {
  it('maps washer start events into a Neon-ready session record', () => {
    const record = buildMachineSessionRecord({
      machineType: 'washer',
      machineId: 3,
      studentId: '20240001',
      phoneNumber: '0123456789',
      mode: 'Normal',
      durationMinutes: 45,
      startTime: 1710000000000,
      status: 'running',
    });

    expect(record).toMatchObject({
      machine_type: 'washer',
      machine_id: 3,
      student_id: '20240001',
      phone_number: '0123456789',
      mode: 'Normal',
      duration_minutes: 45,
      start_time: new Date(1710000000000).toISOString(),
      washing_status: 'running',
    });
  });
});
