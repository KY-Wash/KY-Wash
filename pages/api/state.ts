import type { NextApiRequest, NextApiResponse } from 'next';
import { getAppState, updateAppState, loadPersistedState } from '@/lib/sharedState';
import { insertChatMessageToDB, deleteChatMessageFromDB, insertFeedbackToDB, markFeedbackDoneInDB, reportFeedbackInDB, deleteFeedbackFromDB, getServiceSupabaseClient } from '@/lib/supabase';

// Track machine start times for accurate timer calculation based on system clock
const machineStartTimes: Map<string, number> = new Map();
// Global server timer that runs continuously
let globalServerTimer: NodeJS.Timeout | null = null;
// Flag to ensure state is loaded only once
let stateLoaded = false;

function initializeGlobalTimer() {
  if (globalServerTimer) {
    return; // Already initialized
  }
  
  // Run a global timer every 1 second to decrement all running machines based on system time
  globalServerTimer = setInterval(() => {
    const state = getAppState();
    const now = Date.now();
    let stateChanged = false;
    
    state.machines.forEach((machine) => {
      const key = `${machine.type}-${machine.id}`;
      
      if (machine.status === 'running') {
        const startTime = machineStartTimes.get(key);
        if (startTime !== undefined) {
          // Calculate time elapsed in seconds based on system clock
          const elapsedSeconds = Math.floor((now - startTime) / 1000);
          const totalDurationSeconds = machine.originalDuration ? machine.originalDuration * 60 : machine.timeLeft;
          
          // Calculate remaining time based on system clock
          const newTimeLeft = Math.max(0, totalDurationSeconds - elapsedSeconds);
          
          if (newTimeLeft !== machine.timeLeft) {
            machine.timeLeft = newTimeLeft;
            stateChanged = true;
          }
          
          // If timer reached 0, transition to pending-collection
          if (machine.timeLeft === 0 && machine.status === 'running') {
            machine.status = 'pending-collection';
            stateChanged = true;

            // Update usage history to 'Completed'
            const historyRecord = state.usageHistory.find(h => 
              h.studentId === machine.userStudentId && 
              h.machineType === machine.type && 
              h.machineId === machine.id &&
              h.status === 'In Progress'
            );
            if (historyRecord) {
              historyRecord.status = 'Completed';
              // Sync completion status to Supabase
              updateSupabaseRecordStatus(machine.userStudentId, machine.type, machine.id, 'Completed');
            }
          }
        }
      }
    });
    
    if (stateChanged) {
      updateAppState(state);
    }
  }, 1000);
}

function startServerTimer(machineId: string, machineType: string, initialDuration: number) {
  const key = `${machineType}-${machineId}`;
  // Record the exact time when machine starts (system clock based)
  machineStartTimes.set(key, Date.now());
  
  // Initialize global timer if not already done
  initializeGlobalTimer();
}

function stopServerTimer(machineId: string, machineType: string) {
  const key = `${machineType}-${machineId}`;
  machineStartTimes.delete(key);
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
        userStudentID: record.studentId,
        phone_number: record.phoneNumber || '',
        type: record.machineType,
        machine_id: record.machineId,
        mode: record.mode,
        duration: record.duration,
        spending: record.spending,
        status: record.status,
        date: record.date,
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
      `${supabaseUrl}/rest/v1/usage_history?userStudentID=eq.${studentId}&type=eq.${machineType}&machine_id=eq.${machineId}&status=eq.In%20Progress`,
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

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Load persisted state on first request
  if (!stateLoaded) {
    loadPersistedState();
    stateLoaded = true;

    // Try to fetch persisted chat & feedback from Supabase to seed server state
    (async () => {
      try {
        const svc = getServiceSupabaseClient();
        if (!svc) return;

        const { data: chatData, error: chatErr } = await svc.from('community_chat').select('*').order('created_at', { ascending: true }).limit(100);
        if (!chatErr && chatData) {
          const state = getAppState();
          state.communityChat = (chatData as any[]).map(c => ({
            id: c.id,
            studentId: c.student_id || '',
            message: c.message,
            timestamp: new Date(c.created_at).getTime(),
            date: new Date(c.created_at).toLocaleDateString(),
            time: new Date(c.created_at).toLocaleTimeString(),
          }));
        }

        const { data: fbData, error: fbErr } = await svc.from('feedback_issues').select('*').order('created_at', { ascending: true }).limit(200);
        if (!fbErr && fbData) {
          const state = getAppState();
          state.feedback = (fbData as any[]).map(f => ({
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

        // Persist back to state file
        updateAppState(getAppState());
      } catch (err) {
        console.error('Failed to seed state from Supabase:', err);
      }
    })();
  }

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
      // GET - Return current state
      res.status(200).json(state);
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
            machine.status = 'running';
            machine.mode = data.mode;
            machine.timeLeft = durationInSeconds;
            machine.originalDuration = data.duration; // Store original duration for accurate timer
            machine.userStudentId = data.studentId;
            machine.userPhone = data.phoneNumber;
            
            // Calculate spending (both washers and dryers charge same: Normal=5, Extra=6)
            const spending = data.mode === 'Normal' ? 5 : data.mode.includes('Extra') ? 6 : 0;
            
            // Record in usage history immediately when machine starts
            const now = new Date();
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
            };
            state.usageHistory.push(usageRecord);
            
            // Sync to Supabase
            syncUsageRecordToSupabase(usageRecord);
            
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
          }
          break;
        }

        case 'waitlist-leave': {
          const waitlistKey = data.machineType === 'washer' ? 'washers' : 'dryers';
          state.waitlists[waitlistKey] = state.waitlists[waitlistKey].filter(
            (entry) => entry.studentId !== data.studentId
          );
          break;
        }

        case 'issue-report': {
          const now = new Date();
          state.reportedIssues.push({
            id: `${Date.now()}-${Math.random()}`,
            machineType: data.machineType,
            machineId: data.machineId,
            reportedBy: data.reportedBy,
            phone: data.phone,
            description: data.description,
            timestamp: now.getTime(),
            date: now.toLocaleDateString(),
            resolved: false,
          });
          break;
        }

        case 'issue-resolve': {
          const issue = state.reportedIssues.find((i) => i.id === data.issueId);
          if (issue) {
            issue.resolved = data.resolved;
          }
          break;
        }

        case 'issue-delete': {
          state.reportedIssues = state.reportedIssues.filter((i) => i.id !== data.issueId);
          break;
        }

        case 'usage-history-delete': {
          state.usageHistory = state.usageHistory.filter((record) => record.id !== data.recordId);
          break;
        }

        case 'machine-lock': {
          const machine = state.machines.find(
            (m) => m.id === data.machineId && m.type === data.machineType
          );
          if (machine) {
            machine.locked = data.locked;
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

        case 'clothes-collected': {
          // Backward compatible handler: mark machine as available if the original user confirms
          const machine = state.machines.find(
            (m) => m.id === data.machineId && m.type === data.machineType
          );
          if (machine && machine.userStudentId === data.studentId) {
            state.stats.totalWashes += 1;

            // Stop server timer
            stopServerTimer(data.machineId, data.machineType);
            
            // Free up the machine
            machine.status = 'available';
            machine.timeLeft = 0;
            machine.mode = '';
            machine.userStudentId = '';
            machine.userPhone = '';

            // Clear any pending collection status for this machine
            if (!state.machineCollectionStatus) state.machineCollectionStatus = {};
            delete state.machineCollectionStatus[`${data.machineType}-${data.machineId}`];
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
            }
          }
          break;
        }

        case 'user-register': {
          if (!state.users.some(u => u.studentId === data.studentId)) {
            state.users.push({
              studentId: data.studentId,
              phoneNumber: data.phone,
              password: data.password,
            });
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
            date: now.toLocaleDateString(),
            time: now.toLocaleTimeString(),
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
          // status: 'coming' | 'collected'
          const { machineId, machineType, status, studentId } = data;
          const machine = state.machines.find(
            (m) => m.id === machineId && m.type === machineType
          );
          const key = `${machineType}-${machineId}`;
          if (!state.machineCollectionStatus) state.machineCollectionStatus = {};

          if (status === 'coming') {
            state.machineCollectionStatus[key] = { status: 'coming', user: studentId };
          } else if (status === 'collected') {
            // Accept collected reports from anyone - mark usage completed and free machine
            // Find in-progress usage record and mark Completed
            const historyRecord = state.usageHistory.find(h => h.machineType === machineType && h.machineId === machineId && h.status === 'In Progress');
            if (historyRecord) historyRecord.status = 'Completed';

            // Update stats
            state.stats.totalWashes += 1;

            // Stop server-side timer
            stopServerTimer(machineId, machineType);

            if (machine) {
              machine.status = 'available';
              machine.timeLeft = 0;
              machine.mode = '';
              machine.userStudentId = '';
              machine.userPhone = '';
            }

            delete state.machineCollectionStatus[key];
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

      updateAppState(state);
      res.status(200).json({ success: true, state });
    } else {
      res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
