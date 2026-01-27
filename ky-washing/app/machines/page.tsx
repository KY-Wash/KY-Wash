'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { alertNotification, ringNotification } from '@/lib/enhancedNotifications';
import { MachineAutoUnlock } from '@/lib/machineAutoUnlock';
import { useDataCollection } from '@/lib/dataCollection';
import { machinesService } from '@/lib/services/machines';
import { machineCyclesService } from '@/lib/services/machineCycles';
import { notificationsService } from '@/lib/services/notifications';
import { machineReportsService } from '@/lib/services/machineReports';

interface Machine {
  id: number;
  machine_id: string;
  name: string;
  type: 'washer' | 'dryer';
  status: 'available' | 'in-use' | 'completed' | 'maintenance' | 'offline';
  timeRemaining: number;
  queueCount: number;
  unlockTime?: number;
  currentUserId?: string;
  noOneReportCount?: number;
  readyReport?: boolean;
}

interface MachineTimer {
  machineId: number;
  machineType: 'washer' | 'dryer';
  intervalId: NodeJS.Timeout | null;
}

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [noOneReportCounts, setNoOneReportCounts] = useState<Map<string, number>>(new Map());
  const [showMachineReadyConfirm, setShowMachineReadyConfirm] = useState<{ machineId: number; machineType: 'washer' | 'dryer' } | null>(null);
  const { trackEvent, setUserId: setDataCollectionUserId } = useDataCollection();
  const autoUnlock = new MachineAutoUnlock();
  const machineTimersRef = useRef<Map<string, MachineTimer>>(new Map());

  // Load machines from Supabase and report counts
  useEffect(() => {
    const loadMachines = async () => {
      try {
        setLoading(true);
        const result = await machinesService.getAllMachines();
        
        if (result.success && result.data) {
          const machinesData = result.data.map((m: any) => ({
            id: m.id,
            machine_id: m.machine_id,
            name: m.name,
            type: m.type,
            status: m.status || 'available',
            timeRemaining: m.estimated_time_remaining || 0,
            queueCount: 0,
            unlockTime: m.cycle_end_time ? new Date(m.cycle_end_time).getTime() : undefined,
            currentUserId: m.current_user_id,
            noOneReportCount: 0,
            readyReport: false,
          }));
          
          // Load report counts for each machine
          for (const machine of machinesData) {
            const countResult = await machineReportsService.getNoOneReportCount(machine.id, machine.type);
            if (countResult.success) {
              const key = `${machine.type}-${machine.id}`;
              setNoOneReportCounts((prev) => {
                const updated = new Map(prev);
                updated.set(key, countResult.count);
                return updated;
              });
              machine.noOneReportCount = countResult.count;
            }

            // Check for machine ready reports
            const readyResult = await machineReportsService.getMachineReadyReports(machine.id, machine.type);
            if (readyResult.success && readyResult.data) {
              machine.readyReport = true;
            }
          }
          
          setMachines(machinesData);
        }
      } catch (err) {
        console.error('Error loading machines:', err);
        setError('Failed to load machines');
      } finally {
        setLoading(false);
      }
    };

    loadMachines();
    const interval = setInterval(loadMachines, 10000);
    return () => clearInterval(interval);
  }, []);

  // Timer countdown with proper cleanup and auto-unlock on 2 reports
  useEffect(() => {
    const interval = setInterval(() => {
      setMachines((prev) =>
        prev.map((machine) => {
          if (machine.timeRemaining > 0) {
            const newTime = Math.max(0, machine.timeRemaining - 1);
            
            // Check if cycle just completed
            if (newTime === 0 && machine.timeRemaining > 0) {
              ringNotification(`${machine.name} cycle completed!`);
              trackEvent('machine_cycle_complete', {
                machineId: machine.machine_id,
                machineType: machine.type,
                userId: userId,
              });

              // Update status to completed instead of in-use
              return {
                ...machine,
                timeRemaining: newTime,
                status: 'completed',
              };
            }
            return { ...machine, timeRemaining: newTime };
          }
          return machine;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [trackEvent, userId]);

  const handleStartMachine = async (machine: Machine) => {
    if (!userId) {
      setError('Please log in first');
      return;
    }

    try {
      const duration = machine.type === 'washer' ? 45 : 60;
      
      // Create cycle in Supabase
      const result = await machineCyclesService.startCycle({
        machine_id: machine.id,
        user_id: userId,
        machine_name: machine.name,
        machine_type: machine.type,
        cycle_mode: 'normal',
        duration_minutes: duration,
      });

      if (result.success) {
        // Update local state
        setMachines((prev) =>
          prev.map((m) =>
            m.id === machine.id
              ? {
                  ...m,
                  status: 'in-use',
                  timeRemaining: duration,
                  unlockTime: Date.now() + duration * 60 * 1000,
                  currentUserId: userId,
                }
              : m
          )
        );

        // Track event
        await trackEvent('machine_started', {
          machineId: machine.machine_id,
          machineType: machine.type,
          userId: userId,
          duration: duration,
        });
      }
    } catch (err) {
      console.error('Error starting machine:', err);
      setError('Failed to start machine');
    }
  };

  const handleCollectClothes = async (machine: Machine) => {
    if (!userId) {
      setError('Please log in first');
      return;
    }

    try {
      // Find the active cycle for this machine
      const result = await machineCyclesService.getActiveCycles();
      
      if (result.success && result.data) {
        const activeCycle = result.data.find(
          (c: any) => c.machine_id === machine.id && c.user_id === userId && c.status === 'completed'
        );

        if (activeCycle) {
          await machineCyclesService.markAsCollected(activeCycle.id);
        }
      }

      // Reset machine state back to available
      setMachines((prev) =>
        prev.map((m) =>
          m.id === machine.id
            ? { 
                ...m, 
                status: 'available', 
                timeRemaining: 0, 
                unlockTime: undefined, 
                currentUserId: undefined,
                noOneReportCount: 0,
                readyReport: false,
              }
            : m
        )
      );

      // Clear any reports for this machine
      await machineReportsService.clearMachineReports(machine.id, machine.type);

      // Reset report counts
      const key = `${machine.type}-${machine.id}`;
      setNoOneReportCounts((prev) => {
        const updated = new Map(prev);
        updated.delete(key);
        return updated;
      });

      autoUnlock.unlockMachine(machine.id, machine.type);
      
      await trackEvent('clothes_collected', {
        machineId: machine.machine_id,
        userId: userId,
      });

      // Send success notification
      await notificationsService.createNotification({
        user_id: userId,
        notification_type: 'collection_confirmed',
        title: 'Clothes Collected',
        message: `Your clothes from ${machine.name} have been collected.`,
        priority: 'normal',
      });
    } catch (err) {
      console.error('Error collecting clothes:', err);
      setError('Failed to collect clothes');
    }
  };

  const handleReportNoOne = async (machine: Machine) => {
    if (!userId) {
      setError('Please log in first');
      return;
    }

    try {
      const key = `${machine.type}-${machine.id}`;
      const currentCount = noOneReportCounts.get(key) || 0;
      const newCount = currentCount + 1;

      // Add report to Supabase
      const reportResult = await machineReportsService.addNoOneReport(machine.id, machine.type, userId);
      
      if (!reportResult.success) {
        setError('Failed to submit report');
        return;
      }

      // Update local state
      setNoOneReportCounts((prev) => {
        const updated = new Map(prev);
        updated.set(key, newCount);
        return updated;
      });

      // Track event
      await trackEvent('no_one_report', {
        machineId: machine.machine_id,
        machineType: machine.type,
        userId: userId,
        reportCount: newCount,
      });

      if (newCount === 1) {
        // First report notification
        await notificationsService.createNotification({
          user_id: userId,
          notification_type: 'no_one_report',
          title: '⚠️ One Report Logged',
          message: `One "No One" report for ${machine.name}. One more report will unlock the machine.`,
          priority: 'high',
        });
        alertNotification(`One "No One" report logged. One more will unlock this machine.`);
      } else if (newCount >= 2) {
        // Second report - AUTO UNLOCK
        // Stop the timer immediately
        setMachines((prev) =>
          prev.map((m) =>
            m.id === machine.id && m.type === machine.type
              ? {
                  ...m,
                  status: 'available',
                  timeRemaining: 0,
                  currentUserId: undefined,
                  noOneReportCount: newCount,
                }
              : m
          )
        );

        // Clear all reports for this machine
        await machineReportsService.resolveNoOneReports(machine.id, machine.type);

        // Notify all users
        await notificationsService.createNotification({
          user_id: userId,
          notification_type: 'machine_unlocked',
          title: '✅ Machine Unlocked',
          message: `${machine.name} has been automatically unlocked after 2 "No One" reports.`,
          priority: 'high',
        });
        
        ringNotification(`${machine.name} has been unlocked!`);
      }
    } catch (err) {
      console.error('Error reporting no one:', err);
      setError('Failed to submit report');
    }
  };

  const handleMachineReady = async (machineId: number, machineType: 'washer' | 'dryer') => {
    if (!userId) {
      setError('Please log in first');
      return;
    }

    try {
      // Add machine ready report
      const reportResult = await machineReportsService.addMachineReadyReport(machineId, machineType, userId);
      
      if (!reportResult.success) {
        setError('Failed to confirm machine is ready');
        return;
      }

      // Reset the machine to available
      setMachines((prev) =>
        prev.map((m) =>
          m.id === machineId && m.type === machineType
            ? {
                ...m,
                status: 'available',
                timeRemaining: 0,
                currentUserId: undefined,
                noOneReportCount: 0,
                readyReport: false,
              }
            : m
        )
      );

      // Clear all reports
      const key = `${machineType}-${machineId}`;
      setNoOneReportCounts((prev) => {
        const updated = new Map(prev);
        updated.delete(key);
        return updated;
      });

      // Track event
      await trackEvent('machine_ready_confirmed', {
        machineId,
        machineType,
        userId,
      });

      // Notify that machine is now available
      await notificationsService.createNotification({
        user_id: userId,
        notification_type: 'machine_ready',
        title: '✅ Machine Reset',
        message: `${machineType.charAt(0).toUpperCase() + machineType.slice(1)} #${machineId} is now available for the next user.`,
        priority: 'normal',
      });

      setShowMachineReadyConfirm(null);
    } catch (err) {
      console.error('Error confirming machine ready:', err);
      setError('Failed to confirm machine is ready');
    }
  };

  const getStatusColor = (status: Machine['status']) => {
    switch (status) {
      case 'available':
        return 'bg-green-500';
      case 'in-use':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-orange-500';
      case 'maintenance':
        return 'bg-yellow-500';
      case 'offline':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const formatTime = (minutes: number) => {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  };

  if (loading) {
    return <div className="p-4">Loading machines...</div>;
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Machine Management</h1>
        <p className="text-gray-600">Monitor and control washing machines and dryers (Live data from Supabase)</p>
        {error && <div className="text-red-600 mt-2">{error}</div>}
      </div>

      {machines.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-500">No machines available</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {machines.map((machine) => (
            <Card key={machine.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <CardTitle className="flex items-center gap-2">
                      {machine.name}
                      <Badge className={getStatusColor(machine.status)}>
                        {machine.status}
                      </Badge>
                    </CardTitle>
                    <p className="text-xs text-gray-500 mt-1">{machine.machine_id}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Time Remaining:</span>
                    <span className="font-semibold">
                      {machine.timeRemaining > 0
                        ? formatTime(machine.timeRemaining)
                        : 'N/A'}
                    </span>
                  </div>
                  {machine.timeRemaining > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{
                          width: `${(machine.timeRemaining / (machine.type === 'washer' ? 45 : 60)) * 100}%`,
                        }}
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-between text-sm border-t pt-3">
                  <span className="text-gray-600">Queue:</span>
                  <Badge variant="outline">{machine.queueCount} waiting</Badge>
                </div>

                <div className="flex gap-2 mt-4 flex-col space-y-2">
                  {machine.status === 'available' && (
                    <Button
                      className="w-full"
                      onClick={() => handleStartMachine(machine)}
                    >
                      Start Machine
                    </Button>
                  )}
                  {machine.status === 'in-use' && (
                    <>
                      <Button variant="outline" disabled className="w-full">
                        ⏱️ In Use - {formatTime(machine.timeRemaining)}
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full bg-yellow-50 hover:bg-yellow-100 border-yellow-300"
                        onClick={() => handleReportNoOne(machine)}
                      >
                        ⚠️ Report No One ({(noOneReportCounts.get(`${machine.type}-${machine.id}`) || 0)}/2)
                      </Button>
                    </>
                  )}
                  {machine.status === 'completed' && machine.currentUserId === userId && (
                    <Button
                      className="w-full bg-green-600 hover:bg-green-700"
                      onClick={() => handleCollectClothes(machine)}
                    >
                      ✅ Collect Your Clothes
                    </Button>
                  )}
                  {machine.status === 'completed' && machine.currentUserId !== userId && (
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      onClick={() => setShowMachineReadyConfirm({ machineId: machine.id, machineType: machine.type })}
                    >
                      📦 Machine is Ready (Help Reset)
                    </Button>
                  )}
                  {(machine.status === 'maintenance' || machine.status === 'offline') && (
                    <Button variant="outline" disabled className="w-full">
                      {machine.status === 'maintenance' ? '🔧 Under Maintenance' : '❌ Offline'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Machine Ready Confirmation Modal */}
      {showMachineReadyConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-lg">Confirm Machine is Ready</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-600">
                This will reset {showMachineReadyConfirm.machineType} #{showMachineReadyConfirm.machineId} to available so the next user can start. 
                Only confirm if the machine is truly empty.
              </p>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => handleMachineReady(showMachineReadyConfirm.machineId, showMachineReadyConfirm.machineType)}
                >
                  ✅ Yes, Reset It
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowMachineReadyConfirm(null)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
