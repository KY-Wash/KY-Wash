import type { NextApiRequest, NextApiResponse } from 'next';
import { getAppState, updateAppState, loadPersistedState } from '@/lib/sharedState';
import { insertChatMessageToDB, deleteChatMessageFromDB, insertFeedbackToDB, markFeedbackDoneInDB, reportFeedbackInDB, deleteFeedbackFromDB, getServiceSupabaseClient } from '@/lib/supabase';
import { dedupeWaitlistEntries } from '@/lib/waitlistUtils';
import { appendWasherCycle, purgeOldWasherCycles } from '@/lib/washerCycleAnalytics';
import { syncMachineSessionToNeon } from '@/lib/neon';

// Timer utilities are provided in a testable module
import { machineStartTimes, tickServerTimers, recoverStartTimes, computeStateForClient, startServerTimer as startServerTimerUtil, stopServerTimer as stopServerTimerUtil } from '@/lib/serverTimers';

// Note: computeStateForClient is imported from the module and used when returning state to clients.

// Global server timer that runs continuously
let globalServerTimer: NodeJS.Timeout | null = null;
// Promise guard so the state seed only runs once and callers can await it.
let stateInitPromise: Promise<void> | null = null;
let stateInitialized = false;

function mapUsageHistoryRows(rows: any[]): any[] {
  return rows.map((record) => ({
    id: record.id,
    type: record.type || record.machineType,
    machineType: record.type || record.machineType,
    machine_id: parseInt(record.machine_id || record.machineId),
    machineId: parseInt(record.machine_id || record.machineId),
    mode: record.mode,
    duration: record.duration,
    date: record.date,
    day: record.day || '',
    time: record.time || '',
    studentId: record.studentId || record.student_id || '',
    timestamp: record.timestamp,
    spending: record.spending || 0,
    status: record.status || 'completed',
  }));
}

async function seedStateFromSupabase() {
  const svc = getServiceSupabaseClient();
  if (!svc) {
    return;
  }

  const [chatResult, feedbackResult, foundersResult, auditResult, waitlistResult, machinesResult, usageResult] = await Promise.all([
    svc.from('community_chat').select('*').order('created_at', { ascending: true }).limit(100),
    svc.from('feedback_issues').select('*').order('created_at', { ascending: true }).limit(200),
    svc.from('founders').select('*').order('created_at', { ascending: true }).limit(200),
    svc.from('audit_logs').select('*').order('created_at', { ascending: true }).limit(500),
    svc.from('waitlist_entries').select('student_id,phone,machine_type,created_at').order('created_at', { ascending: true }),
    svc.from('machines').select('id,type,status,time_left,mode,locked,original_duration,finish_timestamp,updated_at').order('updated_at', { ascending: true }),
    svc.from('usage_history').select('id,student_id,type,machine_id,mode,duration,spending,status,date,timestamp,created_at').order('timestamp', { ascending: true }),
  ]);

  const state = getAppState();

  if (!chatResult.error && chatResult.data && chatResult.data.length > 0) {
    state.communityChat = (chatResult.data as any[]).map(c => {
      const d = new Date(c.created_at);
      return {
        id: c.id,
        studentId: c.student_id || '',
        message: c.message,
        timestamp: d.getTime(),
        date: d.toLocaleDateString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' }),
        time: d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      };
    });
  }

  if (!feedbackResult.error && feedbackResult.data && feedbackResult.data.length > 0) {
    state.feedback = (feedbackResult.data as any[]).map(f => ({
      id: f.id,
      studentId: f.student_id || '',
      studentName: f.student_name || f.student_id || '',
      message: f.message,
      timestamp: new Date(f.created_at).getTime(),
      date: new Date(f.created_at).toLocaleDateString(),
      isDone: f.status === 'closed',
      reportCount: f.report_count || 0,
      warnings: f.warnings || 0,
      rating: f.rating || undefined,
    }));
  }

  if (!foundersResult.error && foundersResult.data && foundersResult.data.length > 0) {
    state.founders = (foundersResult.data as any[]).map(f => ({
      id: f.id,
      name: f.name,
      scholarship: f.scholarship,
      course: f.course,
      profileImage: f.profile_image || '',
    }));
  }

  if (!auditResult.error && auditResult.data && auditResult.data.length > 0) {
    state.auditLog = (auditResult.data as any[]).map(a => ({
      id: a.id,
      action: a.action,
      machineType: a.machine_type,
      machineId: a.machine_id,
      initiatedBy: a.initiated_by,
      reason: a.reason || null,
      timestamp: a.timestamp || Date.now(),
      date: new Date(a.created_at).toLocaleDateString(),
      time: new Date(a.created_at).toLocaleTimeString(),
    }));
  }

  if (!waitlistResult.error && waitlistResult.data && waitlistResult.data.length > 0) {
    const deduped = dedupeWaitlistEntries(waitlistResult.data as any[]);
    state.waitlists = { washers: deduped.washers, dryers: deduped.dryers };
  }

  if (!usageResult.error && usageResult.data && usageResult.data.length > 0) {
    state.usageHistory = mapUsageHistoryRows(usageResult.data as any[]) as any;
  }

  if (!machinesResult.error && machinesResult.data && machinesResult.data.length > 0) {
    const now = Date.now();
    const usageByMachine = new Map<string, any>();
    for (const record of state.usageHistory as any[]) {
      if (record.status === 'In Progress') {
        usageByMachine.set(`${record.machineType || record.type}-${record.machineId || record.machine_id}`, record);
      }
    }

    const machinesByKey = new Map<string, any>((state.machines || []).map((machine: any) => [`${machine.type}-${machine.id}`, machine]));

    state.machines = (machinesResult.data as any[]).map((row) => {
      const key = `${row.type}-${row.id}`;
      const existing = machinesByKey.get(key) || {
        id: String(row.id),
        type: row.type,
        status: 'available',
        timeLeft: 0,
        mode: '',
        locked: false,
        userStudentId: '',
        userPhone: '',
      };

      const finishTimestamp = typeof row.finish_timestamp === 'number' ? row.finish_timestamp : undefined;
      const runningRecord = usageByMachine.get(key);
      let status = row.status || existing.status;
      let timeLeft = typeof row.time_left === 'number' ? row.time_left : existing.timeLeft || 0;

      if (status === 'running' && finishTimestamp !== undefined) {
        timeLeft = Math.max(0, Math.ceil((finishTimestamp - now) / 1000));
        if (timeLeft === 0) {
          status = 'pending-collection';
        }
      }

      return {
        id: String(row.id),
        type: row.type,
        status,
        timeLeft: status === 'running' ? timeLeft : 0,
        mode: row.mode || null,
        locked: !!row.locked,
        userStudentId: runningRecord?.studentId || existing.userStudentId || null,
        userPhone: existing.userPhone || null,
        originalDuration: row.original_duration || undefined,
        finishTimestamp: status === 'running' && typeof row.finish_timestamp === 'number' ? row.finish_timestamp : undefined,
      };
    });
  }

  updateAppState(state);
}

async function ensureStateInitialized() {
  if (stateInitialized) {
    return;
  }

  if (!stateInitPromise) {
    stateInitPromise = (async () => {
      loadPersistedState();
      await seedStateFromSupabase();
      try {
        recoverStartTimes(getAppState());
      } catch (err) {
        console.warn('Failed to restore machine start times after state seed:', err);
      }
      initializeGlobalTimer();
      stateInitialized = true;
    })().catch((err) => {
      console.error('Failed to initialize server state:', err);
      stateInitialized = true;
    });
  }

  await stateInitPromise;
}

function initializeGlobalTimer() {
  if (globalServerTimer) {
    return; // Already initialized
  }
  
  // Run a global timer every 1 second to decrement all running machines based on system time
  globalServerTimer = setInterval(() => {
    const state = getAppState();
    const now = Date.now();

    const changed = tickServerTimers(state, now);

    if (changed) {
      // For any machine now in pending-collection, ensure usage history is marked Completed
      state.machines.forEach((machine: any) => {
        if (machine.status === 'pending-collection') {
          // Best-effort sync to Supabase (idempotent on server side)
          updateSupabaseRecordStatus(machine.userStudentId, machine.type, machine.id, 'Completed');
          recordCompletedWasherCycle(state, machine);
        }
      });

      updateAppState(state);
    }
  }, 1000);

  // Additionally, periodically refresh waitlist entries from Supabase to avoid accidental loss
  setInterval(async () => {
    try {
      const svc = getServiceSupabaseClient();
      if (!svc) return;
      const { data: wlData, error: wlErr } = await svc.from('waitlist_entries').select('student_id,phone,machine_type,created_at').order('created_at', { ascending: true });
      if (!wlErr && wlData) {
        const state = getAppState();
        // Deduplicate rows and keep the latest entry for each student+machine
        const deduped = dedupeWaitlistEntries(wlData as any[]);
        const newWaitlists = { washers: deduped.washers, dryers: deduped.dryers };

        // Update state only if different to avoid unnecessary writes
        const current = state.waitlists || { washers: [], dryers: [] };
        const different = JSON.stringify(current) !== JSON.stringify(newWaitlists);
        if (different) {
          state.waitlists = newWaitlists;
          updateAppState(state);
        }
      }
    } catch (err) {
      console.warn('Periodic waitlist sync failed:', err);
    }
  }, 60 * 1000); // every minute
}

function startServerTimer(machineId: string, machineType: string, initialDuration: number) {
  // delegate to testable util and ensure timer initialized
  startServerTimerUtil(machineId, machineType, initialDuration);
  initializeGlobalTimer();
}

function stopServerTimer(machineId: string, machineType: string) {
  stopServerTimerUtil(machineId, machineType);
}

function recordCompletedWasherCycle(state: any, machine: any) {
  if (machine?.type !== 'washer' || !machine?.userStudentId) {
    return;
  }

  const historyRecord = state.usageHistory.find((h: any) => 
    h.studentId === machine.userStudentId &&
    h.machineType === machine.type &&
    h.machineId === machine.id &&
    h.status === 'In Progress'
  );

  if (!historyRecord || historyRecord.analyticsLogged) {
    return;
  }

  historyRecord.analyticsLogged = true;
  appendWasherCycle({
    machineId: String(machine.id),
    machineType: machine.type,
    studentId: machine.userStudentId,
    phoneNumber: machine.userPhone || '',
    mode: machine.mode || '',
    startedAt: machine.finishTimestamp ? machine.finishTimestamp - ((machine.originalDuration || 0) * 60 * 1000) : Date.now(),
    completedAt: Date.now(),
    durationMinutes: machine.originalDuration || 0,
    status: 'Completed',
  });
  purgeOldWasherCycles();
}

// Helper function to sync usage record to Supabase
async function syncUsageRecordToSupabase(record: any) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.log('Supabase not configured, skipping sync');
      return;
    }

    const response = await fetch(`${supabaseUrl}/rest/v1/usage_history`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey,
      },
      body: JSON.stringify({
        studentid: record.studentId,
        phone_number: record.phoneNumber || '',
        type: record.machineType,
        machine_id: record.machineId,
        mode: record.mode,
        duration: record.duration,
        spending: record.spending,
        status: record.status,
        date: record.date,
        day: record.day,
        time: record.time,
        timestamp: record.timestamp,
      }),
    });

    if (!response.ok) {
      console.error('Failed to sync to Supabase:', response.statusText);
    }
  } catch (error) {
    console.error('Error syncing to Supabase:', error);
    // Don't throw - we want the app to work even if Supabase is down
  }
}

// Helper function to update usage record status in Supabase
async function updateSupabaseRecordStatus(studentId: string, machineType: string, machineId: string | number, newStatus: string) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return;
    }

    // Build query to find and update the record
    const response = await fetch(
      `${supabaseUrl}/rest/v1/usage_history?studentid=eq.${studentId}&type=eq.${machineType}&machine_id=eq.${machineId}&status=eq.In%20Progress`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({ status: newStatus }),
      }
    );

    if (!response.ok) {
      console.error('Failed to update Supabase record:', response.statusText);
    }
  } catch (error) {
    console.error('Error updating Supabase record:', error);
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  await ensureStateInitialized();

  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Forwarded-Host, X-API-KEY, X-CSRF-TOKEN, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    return res.status(200).end();
  }

  try {
    const state = getAppState();

    if (req.method === 'GET') {
      const changed = tickServerTimers(state, Date.now());
      if (changed) {
        updateAppState(state);
      }
      // GET - Return current state (include computed finishTimestamp for running machines)
      const stateForClient = computeStateForClient(state);
      res.status(200).json(stateForClient);
    } else if (req.method === 'POST') {
      // POST - Handle events (machine start, waitlist join, etc)
      const { event, data } = req.body;

      if (!event) {
        return res.status(400).json({ error: 'Missing event type' });
      }

      switch (event) {
        case 'machine-start': {
          const machine = state.machines.find(
            (m) => m.id === data.machineId && m.type === data.machineType
          );
          if (machine && machine.status === 'available') {
            const durationInSeconds = data.duration * 60;
            const now = new Date();
            machine.status = 'running';
            machine.mode = data.mode;
            machine.timeLeft = durationInSeconds;
            machine.originalDuration = data.duration; // Store original duration for accurate timer
            machine.finishTimestamp = now.getTime() + durationInSeconds * 1000;
            machine.userStudentId = data.studentId;
            machine.userPhone = data.phoneNumber;
            machine.startedAt = now.getTime();
            
            // Calculate spending (both washers and dryers charge same: Normal=5, Extra=6)
            const spending = data.mode === 'Normal' ? 5 : data.mode.includes('Extra') ? 6 : 0;
            
            // Record in usage history immediately when machine starts
            const usageRecord = {
              id: `${Date.now()}-${Math.random()}`,
              machineType: data.machineType,
              machineId: data.machineId,
              mode: data.mode,
              duration: data.duration,
              date: now.toLocaleDateString(),
              studentId: data.studentId,
              phoneNumber: data.phoneNumber,
              timestamp: now.getTime(),
              spending: spending,
              status: 'In Progress' as const,
              analyticsLogged: false,
            };
            state.usageHistory.push(usageRecord);
            
            // Sync to Supabase (REST helper)
            syncUsageRecordToSupabase(usageRecord);
            void syncMachineSessionToNeon({
              machineType: data.machineType,
              machineId: data.machineId,
              studentId: data.studentId,
              phoneNumber: data.phoneNumber,
              mode: data.mode,
              durationMinutes: data.duration,
              startTime: now.getTime(),
              status: 'running',
            });

            // Persist machine row and link user (if found) using service-role client
            (async () => {
              try {
                const svc = getServiceSupabaseClient();
                if (svc) {
                  // Try to resolve user id from users table
                  const userRes = await svc.from('users').select('id').eq('student_id', data.studentId).maybeSingle();
                  const userUuid = userRes.data?.id || null;

                  await svc.from('machines').upsert([
                    {
                      id: data.machineId,
                      type: data.machineType,
                      status: 'running',
                      time_left: durationInSeconds,
                      mode: data.mode,
                      locked: false,
                      user_id: userUuid,
                      original_duration: data.duration,
                      finish_timestamp: machine.finishTimestamp,
                    }
                  ], { onConflict: 'type,id' });
                }
              } catch (err) {
                console.error('Failed to persist machine start to Supabase:', err);
              }
            })();
            
            // Automatically remove user from both waitlists when they start a machine
            state.waitlists.washers = state.waitlists.washers.filter(
              (entry) => entry.studentId !== data.studentId
            );
            state.waitlists.dryers = state.waitlists.dryers.filter(
              (entry) => entry.studentId !== data.studentId
            );
            
            // Start server-side timer with duration info
            startServerTimer(String(data.machineId), data.machineType, data.duration);
          }
          break;
        }

        case 'machine-cancel': {
          const machine = state.machines.find(
            (m) => m.id === data.machineId && m.type === data.machineType
          );
          if (machine && machine.userStudentId === data.studentId) {
            // Stop server timer
            stopServerTimer(data.machineId, data.machineType);
            
            // Mark the usage history entry as cancelled and remove spending
            state.usageHistory = state.usageHistory.map((h) => {
              if (h.studentId === data.studentId && 
                  h.machineType === data.machineType && 
                  h.machineId === data.machineId &&
                  h.status === 'In Progress') {
                // Sync cancellation to Supabase
                updateSupabaseRecordStatus(data.studentId, data.machineType, data.machineId, 'cancelled');
                return {
                  ...h,
                  status: 'cancelled',
                  spending: 0
                };
              }
              return h;
            });
            
            machine.status = 'available';
            machine.timeLeft = 0;
            machine.mode = '';
            machine.userStudentId = '';
            machine.userPhone = '';
            machine.finishTimestamp = undefined;
            machine.startedAt = undefined;

            void syncMachineSessionToNeon({
              machineType: data.machineType,
              machineId: data.machineId,
              studentId: data.studentId,
              phoneNumber: data.phoneNumber,
              mode: machine.mode || '',
              durationMinutes: machine.originalDuration || data.duration,
              startTime: machine.startedAt || Date.now(),
              status: 'cancelled',
            });

            // Persist machine reset to Supabase
            (async () => {
              try {
                const svc = getServiceSupabaseClient();
                if (svc) {
                  await svc.from('machines').update({ status: 'available', time_left: 0, user_id: null, mode: null, finish_timestamp: null, original_duration: null }).match({ type: data.machineType, id: data.machineId });
                }
              } catch (err) {
                console.error('Failed to persist machine cancellation to Supabase:', err);
              }
            })();
          }
          break;
        }

        case 'waitlist-join': {
          const waitlistKey = data.machineType === 'washer' ? 'washers' : 'dryers';
          if (!state.waitlists[waitlistKey].some((entry) => entry.studentId === data.studentId)) {
            state.waitlists[waitlistKey].push({
              studentId: data.studentId,
              phone: data.phoneNumber,
            });

            // Persist to waitlist_entries table
            (async () => {
              try {
                const svc = getServiceSupabaseClient();
                if (svc) {
                  await svc.from('waitlist_entries').insert([{ student_id: data.studentId, phone: data.phoneNumber, machine_type: data.machineType }]);
                }
              } catch (err) {
                console.error('Failed to persist waitlist entry to Supabase:', err);
              }
            })();
          }
          break;
        }

        case 'waitlist-leave': {
          const waitlistKey = data.machineType === 'washer' ? 'washers' : 'dryers';
          state.waitlists[waitlistKey] = state.waitlists[waitlistKey].filter(
            (entry) => entry.studentId !== data.studentId
          );

          // Remove from waitlist_entries table
          (async () => {
            try {
              const svc = getServiceSupabaseClient();
              if (svc) {
                await svc.from('waitlist_entries').delete().eq('student_id', data.studentId).eq('machine_type', data.machineType);
              }
            } catch (err) {
              console.error('Failed to remove waitlist entry from Supabase:', err);
            }
          })();

          break;
        }

        case 'issue-report': {
          const now = new Date();
          const newIssue = {
            id: `${Date.now()}-${Math.random()}`,
            machineType: data.machineType,
            machineId: data.machineId,
            reportedBy: data.reportedBy,
            phone: data.phone,
            description: data.description,
            timestamp: now.getTime(),
            date: now.toLocaleDateString(),
            resolved: false,
          };

          state.reportedIssues.push(newIssue);

          // Persist reported issue to Supabase
          (async () => {
            try {
              const svc = getServiceSupabaseClient();
              if (svc) {
                await svc.from('reported_issues').insert([{
                  machine_type: data.machineType,
                  machine_id: data.machineId,
                  reported_by: data.reportedBy,
                  phone: data.phone,
                  description: data.description,
                  timestamp: now.getTime(),
                  date: now.toLocaleDateString(),
                }]);
              }
            } catch (err) {
              console.error('Failed to persist reported issue to Supabase:', err);
            }
          })();

          break;
        }

        case 'issue-resolve': {
          const issue = state.reportedIssues.find((i) => i.id === data.issueId);
          if (issue) {
            issue.resolved = data.resolved;

            // Persist resolve state to Supabase
            (async () => {
              try {
                const svc = getServiceSupabaseClient();
                if (svc) {
                  await svc.from('reported_issues').update({ resolved: data.resolved }).eq('id', data.issueId);
                }
              } catch (err) {
                console.error('Failed to update reported issue resolved state in Supabase:', err);
              }
            })();
          }
          break;
        }

        case 'issue-delete': {
          state.reportedIssues = state.reportedIssues.filter((i) => i.id !== data.issueId);

          // Persist deletion to Supabase
          (async () => {
            try {
              const svc = getServiceSupabaseClient();
              if (svc) {
                await svc.from('reported_issues').delete().eq('id', data.issueId);
              }
            } catch (err) {
              console.error('Failed to delete reported issue from Supabase:', err);
            }
          })();

          break;
        }

        case 'usage-history-delete': {
          state.usageHistory = state.usageHistory.filter((record) => record.id !== data.recordId);

          // Persist deletion to Supabase
          (async () => {
            try {
              const svc = getServiceSupabaseClient();
              if (svc) {
                await svc.from('usage_history').delete().eq('id', data.recordId);
              }
            } catch (err) {
              console.error('Failed to delete usage history from Supabase:', err);
            }
          })();

          break;
        }

        case 'machine-lock': {
          const machine = state.machines.find(
            (m) => m.id === data.machineId && m.type === data.machineType
          );
          if (machine) {
            machine.locked = data.locked;

            // Persist lock state to machines table
            (async () => {
              try {
                const svc = getServiceSupabaseClient();
                if (svc) {
                  await svc.from('machines').update({ locked: data.locked, status: data.locked ? 'maintenance' : 'available' }).match({ type: data.machineType, id: data.machineId });
                }
              } catch (err) {
                console.error('Failed to persist machine lock to Supabase:', err);
              }
            })();
          }
          break;
        }

        case 'timer-tick': {
          // Client-side timer tick - acknowledge but don't override server timer
          // Server timer is the source of truth
          const machine = state.machines.find(
            (m) => m.id === data.machineId && m.type === data.machineType
          );
          if (machine && machine.status === 'running') {
            // Only accept if it matches server state (within 1 second tolerance)
            if (Math.abs(machine.timeLeft - data.timeLeft) <= 1) {
              machine.timeLeft = Math.max(0, data.timeLeft);
            }
            
            // If timer reached 0, mark as pending-collection
            if (machine.timeLeft === 0) {
              machine.status = 'pending-collection';
              stopServerTimer(data.machineId, data.machineType);
            }
          }
          break;
        }

        case 'machine-complete': {
          const machine = state.machines.find(
            (m) => String(m.id) === String(data.machineId) && m.type === data.machineType
          );

          if (machine && machine.status === 'running') {
            machine.status = 'pending-collection';
            machine.timeLeft = 0;
            machine.finishTimestamp = machine.finishTimestamp || Date.now();
            stopServerTimer(String(data.machineId), data.machineType);

            const historyRecord = state.usageHistory.find((h: any) =>
              h.studentId === machine.userStudentId &&
              h.machineType === machine.type &&
              h.machineId === machine.id &&
              h.status === 'In Progress'
            );
            if (historyRecord) {
              historyRecord.status = 'Completed';
              updateSupabaseRecordStatus(machine.userStudentId, machine.type, machine.id, 'Completed');
            }

            void syncMachineSessionToNeon({
              machineType: data.machineType,
              machineId: String(data.machineId),
              studentId: machine.userStudentId || data.studentId,
              phoneNumber: machine.userPhone || '',
              mode: machine.mode || '',
              durationMinutes: machine.originalDuration || data.duration,
              startTime: machine.startedAt || Date.now(),
              status: 'completed',
            });

            recordCompletedWasherCycle(state, machine);

            (async () => {
              try {
                const svc = getServiceSupabaseClient();
                if (svc) {
                  await svc.from('machines').update({ status: 'pending-collection', time_left: 0, finish_timestamp: machine.finishTimestamp }).match({ type: data.machineType, id: data.machineId });
                  await svc.from('audit_logs').insert([{ action: 'machine-complete', machine_type: data.machineType, machine_id: data.machineId, timestamp: Date.now() }]);
                }
              } catch (err) {
                console.error('Failed to persist machine-complete to Supabase:', err);
              }
            })();
          }

          break;
        }

        case 'clothes-collected': {
          const machine = state.machines.find(
            (m) => String(m.id) === String(data.machineId) && m.type === data.machineType
          );
          if (machine && machine.status === 'pending-collection') {
            state.stats.totalWashes += 1;

            stopServerTimer(String(data.machineId), data.machineType);

            machine.status = 'available';
            machine.timeLeft = 0;
            machine.mode = '';
            machine.userStudentId = '';
            machine.userPhone = '';
            machine.finishTimestamp = undefined;

            if (!state.machineCollectionStatus) state.machineCollectionStatus = {};
            delete state.machineCollectionStatus[`${data.machineType}-${data.machineId}`];

            (async () => {
              try {
                updateSupabaseRecordStatus(data.studentId, data.machineType, data.machineId, 'Completed');

                const svc = getServiceSupabaseClient();
                if (svc) {
                  await svc.from('machines').update({ status: 'available', time_left: 0, user_id: null, mode: null, finish_timestamp: null, original_duration: null }).match({ type: data.machineType, id: data.machineId });
                  await svc.from('machine_collections').insert([{ machine_type: data.machineType, machine_id: data.machineId, status: 'collected' }]);
                  await svc.from('audit_logs').insert([{ action: 'clothes-collected', machine_type: data.machineType, machine_id: data.machineId, initiated_by: data.studentId, timestamp: Date.now() }]);
                }
              } catch (err) {
                console.error('Failed to persist clothes-collected actions to Supabase:', err);
              }
            })();
          }
          break;
        }

        case 'admin-update-machine': {
          const machine = state.machines.find(
            (m) => m.id === data.machineId && m.type === data.machineType
          );
          if (machine) {
            machine.status = data.status;
            machine.locked = data.status === 'maintenance';
            // Stop any running timer if admin changes status
            if (data.status !== 'running') {
              stopServerTimer(data.machineId, data.machineType);
              machine.timeLeft = 0;
              machine.finishTimestamp = undefined;
              machine.startedAt = undefined;
            }

            // Persist admin change to machines table
            (async () => {
              try {
                const svc = getServiceSupabaseClient();
                if (svc) {
                  await svc.from('machines').update({
                    status: data.status,
                    locked: data.status === 'maintenance',
                    finish_timestamp: data.status === 'running' ? undefined : null,
                    original_duration: data.status === 'running' ? undefined : null,
                  }).match({ type: data.machineType, id: data.machineId });
                }
              } catch (err) {
                console.error('Failed to persist admin machine update to Supabase:', err);
              }
            })();
          }
          break;
        }

        case 'user-register': {
          if (!state.users.some(u => u.studentId === data.studentId)) {
            // Store only non-sensitive info in state
            state.users.push({
              studentId: data.studentId,
              phoneNumber: data.phone,
            });

            // Persist user record to Supabase `users` table and create auth user via service role
            (async () => {
              try {
                const svc = getServiceSupabaseClient();
                if (svc) {
                  const email = `${data.studentId}@kywash.local`;

                  // Try to create an auth user server-side using the service role to avoid sending confirmation emails
                  try {
                    // Use any cast to avoid typing friction with different supabase-js versions
                    const adminCreate: any = (svc.auth as any)?.admin?.createUser
                      ? (svc.auth as any).admin.createUser
                      : null;

                    if (adminCreate) {
                      // Create user and mark as confirmed to avoid sending emails
                      const res: any = await (svc.auth as any).admin.createUser({
                        email,
                        password: data.password,
                        user_metadata: { student_id: data.studentId, phone_number: data.phone },
                        // Some Supabase versions accept email_confirm; include it where supported
                        email_confirm: true,
                      });

                      if (res?.error) {
                        console.warn('Admin createUser returned error, falling back to inserting into users table:', res.error);
                        await svc.from('users').insert([{ student_id: data.studentId, phone_number: data.phone }]);
                      } else {
                        const createdUserId = res?.user?.id || res?.data?.id || null;
                        if (createdUserId) {
                          await svc.from('users').insert([{ id: createdUserId, email, student_id: data.studentId, phone_number: data.phone }]);
                        } else {
                          // If we couldn't get created user id, insert minimally
                          await svc.from('users').insert([{ student_id: data.studentId, phone_number: data.phone }]);
                        }
                      }
                    } else {
                      // No admin.createUser support; fall back to inserting into users table
                      await svc.from('users').insert([{ student_id: data.studentId, phone_number: data.phone }]);
                    }
                  } catch (err) {
                    console.error('Failed to create auth user via admin API, inserting users table entry as fallback:', err);
                    await svc.from('users').insert([{ student_id: data.studentId, phone_number: data.phone }]);
                  }
                } else {
                  console.warn('Service Supabase client not configured; skipping user persistence.');
                }
              } catch (err) {
                console.error('Failed to persist new user to Supabase users table:', err);
              }
            })();
          }
          break;
        }

        case 'audit-log': {
          // Persist audit log entries to Supabase and keep in server state
          const auditEntry = data;
          if (!state.auditLog) state.auditLog = [];
          state.auditLog.push(auditEntry);

          (async () => {
            try {
              const svc = getServiceSupabaseClient();
              if (svc) {
                await svc.from('audit_logs').insert([{
                  action: auditEntry.action,
                  machine_type: auditEntry.machineType,
                  machine_id: auditEntry.machineId,
                  initiated_by: auditEntry.initiatedBy,
                  reason: auditEntry.reason || null,
                  timestamp: auditEntry.timestamp,
                }]);
              }
            } catch (err) {
              console.error('Failed to insert audit log into Supabase:', err);
            }
          })();

          break;
        }

        case 'founder-add': {
          try {
            const now = new Date();
            const founderPayload = {
              name: data.name,
              scholarship: data.scholarship,
              course: data.course,
              profile_image: data.profile_image || null,
              created_at: new Date().toISOString(),
            };

            if (!state.founders) state.founders = [];
            // Keep a local representation (id will come from DB)
            state.founders.push({ id: `founder-${Date.now()}-${Math.random()}`, name: data.name, scholarship: data.scholarship, course: data.course, profileImage: data.profile_image || '' });

            (async () => {
              try {
                const svc = getServiceSupabaseClient();
                if (svc) {
                  await svc.from('founders').insert([founderPayload]);
                }
              } catch (err) {
                console.error('Failed to persist founder to Supabase:', err);
              }
            })();
          } catch (err) {
            console.error('Error handling founder-add event:', err);
          }
          break;
        }

        case 'community-chat-send': {
          const now = new Date();
          const chatMessage = {
            id: `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            studentId: data.studentId,
            message: data.message,
            timestamp: Date.now(),
            date: now.toLocaleDateString('en-GB', { timeZone: 'Asia/Kuala_Lumpur' }),
            time: now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kuala_Lumpur', hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          };
          if (!state.communityChat) {
            state.communityChat = [];
          }
          // Limit chat history to last 100 messages to avoid excessive storage
          state.communityChat.push(chatMessage);
          if (state.communityChat.length > 100) {
            state.communityChat = state.communityChat.slice(-100);
          }

          // Persist message to Supabase (async)
          (async () => {
            try {
              await insertChatMessageToDB(chatMessage);
            } catch (err) {
              console.error('Failed to insert chat message to Supabase', err);
            }
          })();

          break;
        }

        case 'machine-collection-status': {
          const { machineId, machineType, status, studentId } = data;
          const machine = state.machines.find(
            (m) => String(m.id) === String(machineId) && m.type === machineType
          );
          const key = `${machineType}-${machineId}`;
          if (!state.machineCollectionStatus) state.machineCollectionStatus = {};

          if (status === 'coming') {
            if (machine && machine.status === 'pending-collection') {
              state.machineCollectionStatus[key] = { status: 'coming', user: studentId };
            }

            (async () => {
              try {
                const svc = getServiceSupabaseClient();
                if (svc) {
                  const userRes = await svc.from('users').select('id').eq('student_id', studentId).maybeSingle();
                  const userUuid = userRes.data?.id || null;
                  await svc.from('machine_collections').insert([{ machine_type: machineType, machine_id: machineId, status: 'coming', user_id: userUuid }]);
                }
              } catch (err) {
                console.error('Failed to persist machine collection (coming) to Supabase:', err);
              }
            })();

          } else if (status === 'collected') {
            if (machine && machine.status === 'pending-collection') {
              const historyRecord = state.usageHistory.find((h: any) => h.machineType === machineType && h.machineId === String(machineId) && h.status === 'In Progress');
              if (historyRecord) historyRecord.status = 'Completed';

              state.stats.totalWashes += 1;
              stopServerTimer(String(machineId), machineType);

              machine.status = 'available';
              machine.timeLeft = 0;
              machine.mode = '';
              machine.userStudentId = '';
              machine.userPhone = '';
              machine.finishTimestamp = undefined;
              machine.startedAt = undefined;
            }

            delete state.machineCollectionStatus[key];

            (async () => {
              try {
                const svc = getServiceSupabaseClient();
                if (svc) {
                  await svc.from('machine_collections').insert([{ machine_type: machineType, machine_id: machineId, status: 'collected' }]);

                  const historyRecord = state.usageHistory.find((h: any) => h.machineType === machineType && h.machineId === String(machineId) && h.status === 'In Progress');
                  if (historyRecord && historyRecord.studentId) {
                    updateSupabaseRecordStatus(historyRecord.studentId, machineType, machineId, 'Completed');
                  }

                  await svc.from('machines').update({ status: 'available', time_left: 0, user_id: null, mode: null, finish_timestamp: null, original_duration: null }).match({ type: machineType, id: machineId });
                }
              } catch (err) {
                console.error('Failed to persist machine collection (collected) to Supabase:', err);
              }
            })();
          }
          break;
        }

        case 'community-chat-delete': {
          if (state.communityChat) {
            state.communityChat = state.communityChat.filter(
              (msg) => msg.id !== data.messageId
            );
          }

          // Persist deletion to Supabase if configured (async)
          (async () => {
            try {
              await deleteChatMessageFromDB(data.messageId);
            } catch (err) {
              console.error('Failed to delete chat message from Supabase', err);
            }
          })();

          break;
        }

        case 'feedback-submit': {
          const now = new Date();
          const fb = {
            id: `fb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            studentId: data.studentId,
            studentName: data.studentName || data.studentId,
            message: data.message,
            timestamp: Date.now(),
            date: now.toLocaleDateString(),
            isDone: false,
            reportCount: 0,
            warnings: 0,
            rating: data.rating || null,
          };
          if (!state.feedback) state.feedback = [];
          state.feedback.push(fb);

          // Persist feedback to Supabase (async)
          (async () => {
            try {
              await insertFeedbackToDB({ studentId: fb.studentId, studentName: fb.studentName, message: fb.message, rating: fb.rating });
            } catch (err) {
              console.error('Failed to insert feedback to Supabase', err);
            }
          })();

          break;
        }

        case 'feedback-mark-done': {
          if (!state.feedback) state.feedback = [];
          const fb = state.feedback.find((f) => f.id === data.feedbackId);
          if (fb) fb.isDone = true;

          // Persist change to Supabase
          (async () => {
            try {
              await markFeedbackDoneInDB(data.feedbackId);
            } catch (err) {
              console.error('Failed to mark feedback as done in Supabase', err);
            }
          })();

          break;
        }

        case 'feedback-report': {
          if (!state.feedback) state.feedback = [];
          const fb = state.feedback.find((f) => f.id === data.feedbackId);
          if (fb) {
            fb.reportCount = (fb.reportCount || 0) + 1;
            if (fb.reportCount >= 3 && (fb.warnings || 0) === 0) {
              fb.warnings = 1;
            }
          }

          (async () => {
            try {
              await reportFeedbackInDB(data.feedbackId);
            } catch (err) {
              console.error('Failed to report feedback in Supabase', err);
            }
          })();

          break;
        }

        case 'feedback-delete': {
          if (!state.feedback) state.feedback = [];
          state.feedback = state.feedback.filter((f) => f.id !== data.feedbackId);

          (async () => {
            try {
              await deleteFeedbackFromDB(data.feedbackId);
            } catch (err) {
              console.error('Failed to delete feedback in Supabase', err);
            }
          })();

          break;
        }
      }

      tickServerTimers(state, Date.now());
      updateAppState(state);
      // Include computed finish timestamps in the returned state so clients can stay synchronized
      const stateForClient = computeStateForClient(state);
      res.status(200).json({ success: true, state: stateForClient });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
