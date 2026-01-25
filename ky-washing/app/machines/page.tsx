'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { alertNotification, ringNotification } from '@/lib/enhancedNotifications';
import { MachineAutoUnlock } from '@/lib/machineAutoUnlock';
import { useDataCollection } from '@/lib/dataCollection';
import { machinesService } from '@/lib/services/machines';
import { machineCyclesService } from '@/lib/services/machineCycles';
import { notificationsService } from '@/lib/services/notifications';

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
}

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');
  const { trackEvent, setUserId: setDataCollectionUserId } = useDataCollection();
  const autoUnlock = new MachineAutoUnlock();

  // Load machines from Supabase
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
            queueCount: 0, // We'll need to fetch queue separately
            unlockTime: m.cycle_end_time ? new Date(m.cycle_end_time).getTime() : undefined,
            currentUserId: m.current_user_id,
          }));
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
    // Refresh every 10 seconds
    const interval = setInterval(loadMachines, 10000);
    return () => clearInterval(interval);
  }, []);

  // Timer update
  useEffect(() => {
    const interval = setInterval(() => {
      setMachines((prev) =>
        prev.map((machine) => {
          if (machine.timeRemaining > 0) {
            const newTime = Math.max(0, machine.timeRemaining - 1);
            
            // Check if cycle just completed
            if (newTime === 0 && machine.timeRemaining > 0) {
              // Ring notification once
              ringNotification(`${machine.name} cycle completed!`);
              trackEvent('machine_cycle_complete', {
                machineId: machine.machine_id,
                machineType: machine.type,
                userId: userId,
              });

              // Set auto unlock timer
              if (machine.unlockTime) {
                autoUnlock.lockMachine(
                  machine.id,
                  machine.type,
                  15 * 60 * 1000, // 15 minutes
                  'Cycle completed'
                );
              }
            }
            return { ...machine, timeRemaining: newTime };
          }
          return machine;
        })
      );
    }, 1000);

    return () => clearInterval(interval);
  }, [trackEvent, userId, autoUnlock]);

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

      // Update local state
      setMachines((prev) =>
        prev.map((m) =>
          m.id === machine.id
            ? { ...m, status: 'available', timeRemaining: 0, unlockTime: undefined, currentUserId: undefined }
            : m
        )
      );

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

                <div className="flex gap-2 mt-4">
                  {machine.status === 'available' && (
                    <Button
                      className="flex-1"
                      onClick={() => handleStartMachine(machine)}
                    >
                      Start Machine
                    </Button>
                  )}
                  {machine.status === 'completed' && (
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => handleCollectClothes(machine)}
                    >
                      Collect Clothes
                    </Button>
                  )}
                  {machine.status === 'in-use' && (
                    <Button variant="outline" disabled className="flex-1">
                      In Use
                    </Button>
                  )}
                  {(machine.status === 'maintenance' || machine.status === 'offline') && (
                    <Button variant="outline" disabled className="flex-1">
                      {machine.status === 'maintenance' ? 'Under Maintenance' : 'Offline'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
