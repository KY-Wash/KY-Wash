import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import { ensureWasherCycleExportFile, getWasherCycleExportPath } from '@/lib/washerCycleAnalytics';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }

  const exportPath = ensureWasherCycleExportFile(getWasherCycleExportPath());
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="washer-cycles.xlsx"');
  res.send(fs.readFileSync(exportPath));
}
