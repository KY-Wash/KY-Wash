export type WaitlistRow = { student_id: string; phone?: string | null; machine_type: 'washer' | 'dryer'; created_at?: string };

export function dedupeWaitlistEntries(rows: WaitlistRow[]) {
  // Keep the latest entry per student_id per machine_type
  const map: Record<string, { studentId: string; phone: string }[]> = { washers: [], dryers: [] };
  const latestMap: Record<string, WaitlistRow> = {};

  rows.forEach((r) => {
    const key = `${r.machine_type}-${r.student_id}`;
    if (!latestMap[key]) {
      latestMap[key] = r;
    } else {
      // Compare created_at if present, otherwise keep existing
      const prev = latestMap[key];
      if (r.created_at && prev.created_at) {
        if (new Date(r.created_at).getTime() > new Date(prev.created_at).getTime()) {
          latestMap[key] = r;
        }
      } else if (r.created_at && !prev.created_at) {
        latestMap[key] = r;
      }
    }
  });

  Object.values(latestMap).forEach((r) => {
    const target = r.machine_type === 'washer' ? 'washers' : 'dryers';
    map[target].push({ studentId: r.student_id, phone: r.phone || '' });
  });

  return map;
}
