import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { appendWasherCycle, purgeOldWasherCycles, getWasherCycleExportPath } from '../lib/washerCycleAnalytics';

describe('washer cycle analytics', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ky-wash-analytics-'));

  beforeEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('records completed washer cycles and ignores cancelled ones', () => {
    const exportPath = path.join(tempDir, 'washer-cycles.xlsx');

    const started = appendWasherCycle({
      exportPath,
      machineId: '1',
      machineType: 'washer',
      studentId: 'A123',
      phoneNumber: '0123456789',
      mode: 'Normal',
      startedAt: new Date('2025-05-01T10:00:00.000Z').getTime(),
      completedAt: new Date('2025-05-01T10:40:00.000Z').getTime(),
      durationMinutes: 40,
      status: 'Completed',
    });

    expect(started).toBe(true);

    const cancelled = appendWasherCycle({
      exportPath,
      machineId: '1',
      machineType: 'washer',
      studentId: 'A123',
      phoneNumber: '0123456789',
      mode: 'Normal',
      startedAt: new Date('2026-07-01T11:00:00.000Z').getTime(),
      completedAt: new Date('2026-07-01T11:10:00.000Z').getTime(),
      durationMinutes: 10,
      status: 'cancelled',
    });

    expect(cancelled).toBe(false);

    const purged = purgeOldWasherCycles(exportPath, 30);
    expect(purged).toBe(1);
    expect(fs.existsSync(exportPath)).toBe(true);
  });

  it('uses the default export path in the project data folder', () => {
    const exportPath = getWasherCycleExportPath();
    expect(exportPath).toContain('washer-cycles.xlsx');
  });
});
