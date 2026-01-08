// Analytics Dashboard Component for Machine Usage and User Behavior
'use client';

import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, Clock, Zap } from 'lucide-react';
import { dataCollectionService, AnalyticsMetrics } from '@/lib/dataCollection';

interface AnalyticsDashboardProps {
  darkMode: boolean;
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ darkMode }) => {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [usageByTime, setUsageByTime] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    const calculatedMetrics = dataCollectionService.calculateMetrics();
    setMetrics(calculatedMetrics);
    setUsageByTime(calculatedMetrics.machineUsageByTime);
  }, []);

  if (!metrics) {
    return (
      <div className={`p-6 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <p className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Loading analytics...</p>
      </div>
    );
  }

  const StatCard = ({ icon: Icon, label, value, unit = '' }: { icon: React.ReactNode; label: string; value: number | string; unit?: string }) => (
    <div className={`p-4 rounded-lg ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`p-2 rounded ${darkMode ? 'bg-blue-900' : 'bg-blue-100'}`}>{Icon}</div>
        <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{label}</p>
      </div>
      <p className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
        {typeof value === 'number' ? value.toFixed(1) : value}
        {unit && <span className="text-sm ml-2">{unit}</span>}
      </p>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-6 h-6" />
          <h2 className={`text-2xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Machine Analytics</h2>
        </div>
        <div className="flex gap-2">
          {(['today', 'week', 'month'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className={`px-4 py-2 rounded font-semibold transition-colors ${
                selectedPeriod === period
                  ? darkMode
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-500 text-white'
                  : darkMode
                    ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          icon={<Users className="w-5 h-5 text-blue-500" />}
          label="Total Users"
          value={metrics.totalUsers}
        />
        <StatCard
          icon={<Zap className="w-5 h-5 text-yellow-500" />}
          label="Total Sessions"
          value={metrics.totalSessions}
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-green-500" />}
          label="Avg Session Duration"
          value={Math.round(metrics.averageSessionDuration / 1000)}
          unit="sec"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-purple-500" />}
          label="Machine Utilization"
          value={metrics.machineUtilizationRate}
          unit="%"
        />
        <StatCard
          icon={<Clock className="w-5 h-5 text-orange-500" />}
          label="Avg Queue Time"
          value={Math.round(metrics.averageQueueTime / 60)}
          unit="min"
        />
        <StatCard
          icon={<Zap className="w-5 h-5 text-red-500" />}
          label="Avg Completion Time"
          value={Math.round(metrics.averageCompletionTime / 60000)}
          unit="min"
        />
      </div>

      {/* Peak Hours */}
      <div className={`p-6 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Peak Usage Hours</h3>
        <div className="space-y-2">
          {metrics.peakHours.map((hour, idx) => (
            <div key={idx} className="flex items-center gap-3">
              <span className={`w-16 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {hour.hour}:00-{hour.hour}:59
              </span>
              <div className="flex-1 bg-gray-300 rounded-full h-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{
                    width: `${(hour.count / Math.max(...metrics.peakHours.map((h) => h.count))) * 100}%`,
                  }}
                />
              </div>
              <span className={`w-8 text-right text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {hour.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Usage by Time of Day */}
      <div className={`p-6 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Usage Distribution by Time</h3>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {Object.entries(usageByTime)
            .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
            .map(([time, count]) => (
              <div key={time} className="flex items-center gap-3">
                <span className={`w-20 text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>{time}</span>
                <div className="flex-1 bg-gray-300 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{
                      width: `${(count / Math.max(...Object.values(usageByTime))) * 100}%`,
                    }}
                  />
                </div>
                <span className={`w-8 text-right text-sm font-semibold ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {count}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Quick Stats */}
      <div className={`p-6 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <h3 className={`text-lg font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>Quick Stats</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className={`p-4 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Busiest Hour</p>
            <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              {metrics.peakHours.length > 0 ? `${metrics.peakHours[0].hour}:00` : 'N/A'}
            </p>
          </div>
          <div className={`p-4 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>Most Usage at Busiest Hour</p>
            <p className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>
              {metrics.peakHours.length > 0 ? `${metrics.peakHours[0].count} uses` : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
