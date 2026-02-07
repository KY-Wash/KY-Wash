import type { NextApiRequest, NextApiResponse } from 'next';
import { getServiceSupabaseClient } from '@/lib/supabase';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const studentId = typeof req.query.studentId === 'string' ? req.query.studentId : (req.query.studentId?.[0] as string | undefined);
  if (!studentId) return res.status(400).json({ error: 'studentId is required' });

  try {
    const svc = getServiceSupabaseClient();
    if (!svc) return res.status(503).json({ phone: '' });

    // 1) Try users table
    const { data: userRow, error: userErr } = await svc.from('users').select('phone_number').eq('student_id', studentId).maybeSingle();
    if (!userErr && userRow && userRow.phone_number) {
      return res.status(200).json({ phone: userRow.phone_number });
    }

    // 2) Try waitlist_entries (most recent)
    const { data: wlRows, error: wlErr } = await svc.from('waitlist_entries').select('phone').eq('student_id', studentId).order('created_at', { ascending: false }).limit(1);
    if (!wlErr && wlRows && wlRows.length > 0 && wlRows[0].phone) {
      return res.status(200).json({ phone: wlRows[0].phone });
    }

    // 3) Try usage_history (most recent)
    const { data: uhRows, error: uhErr } = await svc.from('usage_history').select('phone_number').eq('userStudentID', studentId).order('timestamp', { ascending: false }).limit(1);
    if (!uhErr && uhRows && uhRows.length > 0 && uhRows[0].phone_number) {
      return res.status(200).json({ phone: uhRows[0].phone_number });
    }

    // Not found
    return res.status(200).json({ phone: '' });
  } catch (err) {
    console.error('lookup-phone error:', err);
    return res.status(500).json({ phone: '' });
  }
}
