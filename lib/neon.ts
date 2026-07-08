import { neon } from '@neondatabase/serverless';

export interface MachineSessionPayload {
  machineType: 'washer' | 'dryer';
  machineId: number | string;
  studentId: string;
  phoneNumber?: string;
  mode?: string;
  durationMinutes?: number;
  startTime?: number;
  status: 'running' | 'completed' | 'cancelled';
}

export interface MachineSessionRecord {
  machine_type: 'washer' | 'dryer';
  machine_id: number;
  student_id: string;
  phone_number: string;
  mode: string;
  duration_minutes: number;
  start_time: string;
  washing_status: 'running' | 'completed' | 'cancelled';
}

function getNeonSql() {
  const connectionString = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  if (!connectionString) {
    return null;
  }

  return neon(connectionString);
}

export function buildMachineSessionRecord(payload: MachineSessionPayload): MachineSessionRecord {
  const startTime = payload.startTime ?? Date.now();
  const machineId = Number(payload.machineId);

  return {
    machine_type: payload.machineType,
    machine_id: Number.isFinite(machineId) ? machineId : 0,
    student_id: payload.studentId,
    phone_number: payload.phoneNumber || '',
    mode: payload.mode || '',
    duration_minutes: payload.durationMinutes || 0,
    start_time: new Date(startTime).toISOString(),
    washing_status: payload.status,
  };
}

export async function syncMachineSessionToNeon(payload: MachineSessionPayload) {
  const sql = getNeonSql();
  if (!sql) {
    console.warn('Neon connection string not configured. Skipping machine session sync.');
    return null;
  }

  const record = buildMachineSessionRecord(payload);

  await sql`
    CREATE TABLE IF NOT EXISTS machine_sessions (
      id BIGSERIAL PRIMARY KEY,
      machine_type TEXT NOT NULL,
      machine_id INTEGER NOT NULL,
      student_id TEXT NOT NULL,
      phone_number TEXT,
      mode TEXT,
      duration_minutes INTEGER,
      start_time TIMESTAMPTZ NOT NULL,
      washing_status TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  if (payload.status === 'running') {
    await sql`
      INSERT INTO machine_sessions (
        machine_type,
        machine_id,
        student_id,
        phone_number,
        mode,
        duration_minutes,
        start_time,
        washing_status
      ) VALUES (
        ${record.machine_type},
        ${record.machine_id},
        ${record.student_id},
        ${record.phone_number},
        ${record.mode},
        ${record.duration_minutes},
        ${record.start_time},
        ${record.washing_status}
      )
    `;
    return record;
  }

  await sql`
    UPDATE machine_sessions
    SET washing_status = ${record.washing_status},
        updated_at = NOW(),
        phone_number = COALESCE(${record.phone_number}, phone_number),
        mode = COALESCE(${record.mode}, mode),
        duration_minutes = COALESCE(${record.duration_minutes}, duration_minutes)
    WHERE id = (
      SELECT id FROM machine_sessions
      WHERE machine_type = ${record.machine_type}
        AND machine_id = ${record.machine_id}
        AND student_id = ${record.student_id}
        AND washing_status = 'running'
      ORDER BY start_time DESC, created_at DESC
      LIMIT 1
    )
  `;

  return record;
}
