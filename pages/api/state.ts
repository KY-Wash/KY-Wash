import type { NextApiRequest, NextApiResponse } from 'next';
import { getAppState, updateAppState } from '@/lib/sharedState';

// Track timer intervals globally for each machine
const timerIntervals: Map<string, NodeJS.Timeout> = new Map();
// Global server timer that runs continuously
let globalServerTimer: NodeJS.Timeout | null = null;

function initializeGlobalTimer() {
  if (globalServerTimer) {
    return; // Already initialized
  }
  
  // Run a global timer every 1 second to decrement all running machines
  globalServerTimer = setInterval(() => {
    const state = getAppState();
    let stateChanged = false;
    
    state.machines.forEach((machine) => {
      if (machine.status === 'running' && machine.timeLeft > 0) {
        machine.timeLeft = Math.max(0, machine.timeLeft - 1);
        stateChanged = true;
        
        // If timer reached 0, transition to pending-collection
        if (machine.timeLeft === 0) {
          machine.status = 'pending-collection';
        }
      }
    });
    
    if (stateChanged) {
      updateAppState(state);
    }
  }, 1000);
}

function startServerTimer(machineId: string, machineType: string) {
  // Initialize global timer if not already done
  initializeGlobalTimer();
}

function stopServerTimer(machineId: string, machineType: string) {
  // Global timer continues running - it's not per-machine anymore
  const key = `${machineType}-${machineId}`;
  if (timerIntervals.has(key)) {
    clearInterval(timerIntervals.get(key));
    timerIntervals.delete(key);
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
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
            machine.status = 'running';
            machine.mode = data.mode;
            machine.timeLeft = data.duration * 60;
            machine.userStudentId = data.studentId;
            machine.userPhone = data.phoneNumber;
            
            // Automatically remove user from both waitlists when they start a machine
            state.waitlists.washers = state.waitlists.washers.filter(
              (entry) => entry.studentId !== data.studentId
            );
            state.waitlists.dryers = state.waitlists.dryers.filter(
              (entry) => entry.studentId !== data.studentId
            );
            
            // Start server-side timer
            startServerTimer(data.machineId, data.machineType);
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
          const machine = state.machines.find(
            (m) => m.id === data.machineId && m.type === data.machineType
          );
          if (machine && machine.userStudentId === data.studentId) {
            // Now record to usage history when clothes are actually collected
            const now = new Date();
            state.usageHistory.push({
              id: `${Date.now()}-${Math.random()}`,
              machineType: data.machineType,
              machineId: data.machineId,
              mode: machine.mode || '',
              duration: 0,
              date: now.toLocaleDateString(),
              studentId: data.studentId,
              timestamp: now.getTime(),
            });

            state.stats.totalWashes += 1;

            // Stop server timer
            stopServerTimer(data.machineId, data.machineType);
            
            // Free up the machine
            machine.status = 'available';
            machine.timeLeft = 0;
            machine.mode = '';
            machine.userStudentId = '';
            machine.userPhone = '';
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
