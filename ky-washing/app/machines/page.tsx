'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { alertNotification, ringNotification } from '@/lib/enhancedNotifications';
import { MachineAutoUnlock } from '@/lib/machineAutoUnlock';
import { useDataCollection } from '@/lib/dataCollection';

interface Machine {
  id: string;
  name: string;
  type: 'washer' | 'dryer';
  status: 'available' | 'in-use' | 'completed';
  timeRemaining: number;
  queueCount: number;
  unlockTime?: number;
}

export default function MachinesPage() {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const { trackEvent } = useDataCollection();
  const autoUnlock = new MachineAutoUnlock();

  // Mock data - replace with actual API calls
  useEffect(() => {
    const mockMachines: Machine[] = [
      {
        id: 'W1',
        name: 'Washer 1',
        type: 'washer',
        status: 'available',
        timeRemaining: 0,
        queueCount: 2,
      },
      {
        id: 'W2',
        name: 'Washer 2',
        type: 'washer',
        status: 'in-use',
        timeRemaining: 25,
        queueCount: 1,
        unlockTime: Date.now() + 25 * 60 * 1000,
      },
      {
        id: 'D1',
        name: 'Dryer 1',
        type: 'dryer',
        status: 'completed',
        timeRemaining: 0,
        queueCount: 0,
      },
      {
        id: 'D2',
        name: 'Dryer 2',
        type: 'dryer',
        status: 'in-use',
        timeRemaining: 35,
        queueCount: 0,
        unlockTime: Date.now() + 35 * 60 * 1000,
      },
    ];
    setMachines(mockMachines);
    setLoading(false);
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
                machineId: machine.id,
                machineType: machine.type,
              });

              // Set auto unlock timer
              if (machine.unlockTime) {
                autoUnlock.lockMachine(
                  parseInt(machine.id.replace(/\D/g, '')) || 1,
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
  }, [trackEvent, autoUnlock]);

  const handleStartMachine = (machineId: string) => {
    setMachines((prev) =>
      prev.map((m) =>
        m.id === machineId
          ? {
              ...m,
              status: 'in-use',
              timeRemaining: m.type === 'washer' ? 45 : 60,
              unlockTime: Date.now() + (m.type === 'washer' ? 45 : 60) * 60 * 1000,
            }
          : m
      )
    );
    trackEvent('machine_started', { machineId });
  };

  const handleCollectClothes = (machineId: string) => {
    setMachines((prev) =>
      prev.map((m) =>
        m.id === machineId
          ? { ...m, status: 'available', timeRemaining: 0, unlockTime: undefined }
          : m
      )
    );
    autoUnlock.unlockMachine(parseInt(machineId.replace(/\D/g, '')) || 1, 'washer');
    trackEvent('clothes_collected', { machineId });
  };

  const getStatusColor = (status: Machine['status']) => {
    switch (status) {
      case 'available':
        return 'bg-green-500';
      case 'in-use':
        return 'bg-blue-500';
      case 'completed':
        return 'bg-orange-500';
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
        <p className="text-gray-600">Monitor and control washing machines and dryers</p>
      </div>

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
                    onClick={() => handleStartMachine(machine.id)}
                  >
                    Start Machine
                  </Button>
                )}
                {machine.status === 'completed' && (
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => handleCollectClothes(machine.id)}
                  >
                    Collect Clothes
                  </Button>
                )}
                {machine.status === 'in-use' && (
                  <Button variant="outline" disabled className="flex-1">
                    In Use
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
