import fs from 'fs';
import path from 'path';
import { readFile, utils, writeFile } from 'xlsx';

export interface WasherCycleAnalyticsRecord {
  machineId: string;
  machineType: 'washer' | 'dryer';
  studentId: string;
  phoneNumber: string;
  mode: string;
  startedAt: number;
  completedAt: number;
  durationMinutes: number;
  status: 'Completed' | 'cancelled' | 'In Progress';
  exportedAt?: number;
}

const DEFAULT_EXPORT_PATH = path.join(process.cwd(), 'data', 'washer-cycles.xlsx');
const EXPORT_COLUMNS = [
  'machineId',
  'machineType',
  'studentId',
  'phoneNumber',
  'mode',
  'startedAt',
  'completedAt',
  'durationMinutes',
  'status',
  'exportedAt',
];

function ensureParentDirectory(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function createWorkbook(filePath: string) {
  ensureParentDirectory(filePath);
  const workbook = utils.book_new();
  const sheet = utils.aoa_to_sheet([EXPORT_COLUMNS]);
  utils.book_append_sheet(workbook, sheet, 'WasherCycles');
  writeFile(workbook, filePath);
  return workbook;
}

function readWorkbook(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return createWorkbook(filePath);
  }

  return readFile(filePath);
}

function appendWorkbookRow(filePath: string, record: WasherCycleAnalyticsRecord) {
  const workbook = readWorkbook(filePath);
  const sheetName = workbook.SheetNames[0] || 'WasherCycles';
  const worksheet = workbook.Sheets[sheetName];
  const rows = utils.sheet_to_json(worksheet, { defval: '' }) as Array<Record<string, unknown>>;

  const rowValues = EXPORT_COLUMNS.map((column) => (record as unknown as Record<string, unknown>)[column] ?? '');
  rows.push(Object.fromEntries(EXPORT_COLUMNS.map((column, index) => [column, rowValues[index]])));

  const updatedSheet = utils.json_to_sheet(rows);
  workbook.Sheets[sheetName] = updatedSheet;
  writeFile(workbook, filePath);
}

export function getWasherCycleExportPath() {
  return process.env.WASHER_CYCLE_EXPORT_PATH || DEFAULT_EXPORT_PATH;
}

export function appendWasherCycle(input: WasherCycleAnalyticsRecord & { exportPath?: string }) {
  const exportPath = input.exportPath || getWasherCycleExportPath();

  if (input.machineType !== 'washer') {
    return false;
  }

  if (input.status !== 'Completed') {
    return false;
  }

  const normalizedRecord: WasherCycleAnalyticsRecord = {
    ...input,
    exportedAt: Date.now(),
  };

  appendWorkbookRow(exportPath, normalizedRecord);
  return true;
}

export function purgeOldWasherCycles(filePath = getWasherCycleExportPath(), daysToKeep = 30) {
  if (!fs.existsSync(filePath)) {
    return 0;
  }

  const workbook = readWorkbook(filePath);
  const sheetName = workbook.SheetNames[0] || 'WasherCycles';
  const worksheet = workbook.Sheets[sheetName];
  const rows = utils.sheet_to_json(worksheet, { defval: '' }) as Array<Record<string, unknown>>;

  if (rows.length === 0) {
    return 0;
  }

  const now = Date.now();
  const cutoff = now - (daysToKeep * 24 * 60 * 60 * 1000);
  const kept = rows.filter((row) => {
    const completedAt = Number(row.completedAt ?? row.exportedAt ?? 0);
    return !Number.isFinite(completedAt) || completedAt >= cutoff;
  });

  const removed = rows.length - kept.length;
  const updatedSheet = utils.json_to_sheet(kept);
  workbook.Sheets[sheetName] = updatedSheet;
  writeFile(workbook, filePath);
  return removed;
}
