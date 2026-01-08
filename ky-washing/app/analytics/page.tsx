'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDataCollection } from '@/lib/dataCollection';
import { AnalyticsService } from '@/lib/analytics';

interface MachineUsageData {
  machineId: string;
  machineName: string;
  type: 'washer' | 'dryer';
  totalCycles: number;
  averageWaitTime: number;
  peakHour: string;
  utilizationRate: number;
}

interface TimeSeriesData {
  time: string;
  washers: number;
  dryers: number;
  avgQueue: number;
}

export default function AnalyticsDashboard() {
  const [machineStats, setMachineStats] = useState<MachineUsageData[]>([]);
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month'>('today');
  const { getAnalytics } = useDataCollection();
  const analyticsService = new AnalyticsService();

  useEffect(() => {
    // Fetch analytics data
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const analytics = getAnalytics();
        
        // Mock machine stats - replace with real data
        const mockStats: MachineUsageData[] = [
          {
            machineId: 'W1',
            machineName: 'Washer 1',
            type: 'washer',
            totalCycles: 24,
            averageWaitTime: 8,
            peakHour: '14:00-15:00',
            utilizationRate: 85,
          },
          {
            machineId: 'W2',
            machineName: 'Washer 2',
            type: 'washer',
            totalCycles: 28,
            averageWaitTime: 5,
            peakHour: '14:00-15:00',
            utilizationRate: 92,
          },
          {
            machineId: 'D1',
            machineName: 'Dryer 1',
            type: 'dryer',
            totalCycles: 31,
            averageWaitTime: 12,
            peakHour: '15:00-16:00',
            utilizationRate: 88,
          },
          {
            machineId: 'D2',
            machineName: 'Dryer 2',
            type: 'dryer',
            totalCycles: 26,
            averageWaitTime: 10,
            peakHour: '15:00-16:00',
            utilizationRate: 78,
          },
        ];

        // Mock time series data
        const mockTimeSeries: TimeSeriesData[] = [
          { time: '08:00', washers: 1, dryers: 0, avgQueue: 0 },
          { time: '09:00', washers: 2, dryers: 1, avgQueue: 1 },
          { time: '10:00', washers: 2, dryers: 2, avgQueue: 2 },
          { time: '11:00', washers: 2, dryers: 2, avgQueue: 3 },
          { time: '12:00', washers: 1, dryers: 1, avgQueue: 2 },
          { time: '13:00', washers: 2, dryers: 2, avgQueue: 4 },
          { time: '14:00', washers: 2, dryers: 2, avgQueue: 5 },
          { time: '15:00', washers: 2, dryers: 2, avgQueue: 6 },
          { time: '16:00', washers: 2, dryers: 2, avgQueue: 5 },
          { time: '17:00', washers: 2, dryers: 2, avgQueue: 4 },
          { time: '18:00', washers: 2, dryers: 1, avgQueue: 3 },
          { time: '19:00', washers: 1, dryers: 0, avgQueue: 1 },
        ];

        setMachineStats(mockStats);
        setTimeSeriesData(mockTimeSeries);
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [dateRange, getAnalytics]);

  const getUtilizationColor = (rate: number) => {
    if (rate >= 85) return 'text-red-600';
    if (rate >= 70) return 'text-orange-600';
    return 'text-green-600';
  };

  const washersData = machineStats.filter((m) => m.type === 'washer');
  const dryersData = machineStats.filter((m) => m.type === 'dryer');

  const avgWasherWait =
    washersData.reduce((sum, m) => sum + m.averageWaitTime, 0) /
      (washersData.length || 1) || 0;
  const avgDryerWait =
    dryersData.reduce((sum, m) => sum + m.averageWaitTime, 0) /
      (dryersData.length || 1) || 0;

  const totalCycles = machineStats.reduce((sum, m) => sum + m.totalCycles, 0);
  const peakQueueTime =
    Math.max(...timeSeriesData.map((d) => d.avgQueue)) || 0;

  if (loading) {
    return <div className="p-4">Loading analytics...</div>;
  }

  return (
    <div className="w-full max-w-7xl mx-auto p-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Analytics Dashboard</h1>
        <p className="text-gray-600">
          Real-time insights into machine usage and queue times
        </p>
      </div>

      {/* Date Range Selector */}
      <div className="flex gap-2">
        {(['today', 'week', 'month'] as const).map((range) => (
          <button
            key={range}
            onClick={() => setDateRange(range)}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              dateRange === range
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            {range.charAt(0).toUpperCase() + range.slice(1)}
          </button>
        ))}
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Total Cycles
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{totalCycles}</div>
            <p className="text-xs text-gray-600 mt-1">cycles completed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Avg Washer Wait
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgWasherWait.toFixed(1)}m</div>
            <p className="text-xs text-gray-600 mt-1">average queue time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Avg Dryer Wait
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{avgDryerWait.toFixed(1)}m</div>
            <p className="text-xs text-gray-600 mt-1">average queue time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              Peak Queue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{Math.ceil(peakQueueTime)}</div>
            <p className="text-xs text-gray-600 mt-1">people waiting</p>
          </CardContent>
        </Card>
      </div>

      {/* Machine Usage by Hour */}
      <Card>
        <CardHeader>
          <CardTitle>Machine Usage by Hour</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {timeSeriesData.map((data) => (
              <div key={data.time} className="flex items-center gap-4">
                <span className="w-12 font-medium text-sm">{data.time}</span>
                <div className="flex-1 flex gap-2">
                  <div className="flex items-center gap-1 flex-1">
                    <div className="w-12 text-xs">
                      W: {data.washers}
                    </div>
                    <div className="flex-1 bg-blue-200 h-6 rounded flex items-center px-2">
                      <div
                        className="bg-blue-600 h-4 rounded"
                        style={{
                          width: `${(data.washers / 2) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-1">
                    <div className="w-12 text-xs">
                      D: {data.dryers}
                    </div>
                    <div className="flex-1 bg-orange-200 h-6 rounded flex items-center px-2">
                      <div
                        className="bg-orange-600 h-4 rounded"
                        style={{
                          width: `${(data.dryers / 2) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="w-16 text-right text-xs text-gray-600">
                  Queue: {data.avgQueue}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Machine Details */}
      <div className="space-y-6">
        {/* Washers */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Washers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {washersData.map((machine) => (
              <Card key={machine.machineId}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle>{machine.machineName}</CardTitle>
                    <Badge
                      variant="outline"
                      className={getUtilizationColor(
                        machine.utilizationRate
                      )}
                    >
                      {machine.utilizationRate}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-600">Total Cycles:</span>
                    <span className="font-semibold">{machine.totalCycles}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-600">Avg Wait Time:</span>
                    <span className="font-semibold">
                      {machine.averageWaitTime}m
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Peak Hour:</span>
                    <span className="font-semibold">{machine.peakHour}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Dryers */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Dryers</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {dryersData.map((machine) => (
              <Card key={machine.machineId}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle>{machine.machineName}</CardTitle>
                    <Badge
                      variant="outline"
                      className={getUtilizationColor(
                        machine.utilizationRate
                      )}
                    >
                      {machine.utilizationRate}%
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-600">Total Cycles:</span>
                    <span className="font-semibold">{machine.totalCycles}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-gray-600">Avg Wait Time:</span>
                    <span className="font-semibold">
                      {machine.averageWaitTime}m
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Peak Hour:</span>
                    <span className="font-semibold">{machine.peakHour}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
