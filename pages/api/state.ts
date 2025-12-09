import type { NextApiRequest, NextApiResponse } from 'next';
import { getAppState, updateAppState } from '@/lib/sharedState';

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
            // Don't record usage history yet - only when clothes are collected
          }
          break;
        }

        case 'machine-cancel': {
          const machine = state.machines.find(
            (m) => m.id === data.machineId && m.type === data.machineType
          );
          if (machine && machine.userStudentId === data.studentId) {
            // Don't record to history when user cancels - only when they complete
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
          const machine = state.machines.find(
            (m) => m.id === data.machineId && m.type === data.machineType
          );
          if (machine && machine.status === 'running') {
            machine.timeLeft = Math.max(0, data.timeLeft);
            
            // If timer reached 0, mark as pending-collection waiting for user to collect
            if (machine.timeLeft === 0) {
              machine.status = 'pending-collection';
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
              duration: 0, // Duration would be tracked elsewhere, defaulting to 0
              date: now.toLocaleDateString(),
              studentId: data.studentId,
              timestamp: now.getTime(),
            });

            state.stats.totalWashes += 1;

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
