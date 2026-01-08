// Example Integration Code for KY Wash System
// This file shows how to integrate all 4 features

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { BarChart3, Lock, Bell } from 'lucide-react';

// Import all services
import { 
  initializeGA, 
  trackLogin, 
  trackLogout, 
  trackMachineStart,
  trackMachineCancel,
  trackClothesCollection 
} from '@/lib/analytics';
import { dataCollectionService } from '@/lib/dataCollection';
import { machineAutoUnlockService } from '@/lib/machineAutoUnlock';
import { notificationService } from '@/lib/enhancedNotifications';
import { AnalyticsDashboard } from '@/components/analytics-dashboard';

interface ExampleProps {
  darkMode: boolean;
}

export const KYWashIntegrationExample: React.FC<ExampleProps> = ({ darkMode }) => {
  const [user, setUser] = useState<{ studentId: string; phoneNumber: string } | null>(null);
  const [currentView, setCurrentView] = useState<'login' | 'main' | 'admin'>('login');
  const [studentId, setStudentId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [lockedMachines, setLockedMachines] = useState<Map<string, number>>(new Map());
  const [analyticsMetrics, setAnalyticsMetrics] = useState<any>(null);

  // ============================================
  // 1. INITIALIZATION - Run on component mount
  // ============================================
  useEffect(() => {
    // Initialize Google Analytics
    initializeGA();
    console.log('📊 Google Analytics initialized');

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        console.log('🔔 Notification permission:', permission);
      });
    }

    // Register callback for machine auto-unlock
    machineAutoUnlockService.onMachineUnlock((machine) => {
      console.log(`✅ Machine auto-unlocked: ${machine.machineType}-${machine.machineId}`);
      alert(`Machine ${machine.machineType}-${machine.machineId} has been auto-unlocked after 24 hours`);
    });

    // Register callback for notification acknowledgment
    notificationService.onAcknowledge((notification) => {
      console.log(`✅ User acknowledged notification:`, notification);
    });

    return () => {
      machineAutoUnlockService.destroy();
      notificationService.destroy();
    };
  }, []);

  // ============================================
  // 2. USER LOGIN - Track with analytics
  // ============================================
  const handleLogin = () => {
    if (!studentId || !phoneNumber) return;

    // Track login with Google Analytics
    trackLogin(studentId);

    // Record user login in data collection service
    dataCollectionService.recordUserLogin(studentId, phoneNumber);

    // Update UI
    setUser({ studentId, phoneNumber });
    setCurrentView('main');
    console.log(`✅ User logged in: ${studentId}`);
  };

  // ============================================
  // 3. USER LOGOUT - Track with analytics
  // ============================================
  const handleLogout = () => {
    if (!user) return;

    // Track logout with Google Analytics
    trackLogout(user.studentId);

    // Record logout in data collection service
    dataCollectionService.recordUserLogout(user.studentId);

    // Update UI
    setUser(null);
    setCurrentView('login');
    console.log(`✅ User logged out: ${user.studentId}`);
  };

  // ============================================
  // 4. START MACHINE - Track with analytics
  // ============================================
  const handleStartMachine = (machineId: number, machineType: 'washer' | 'dryer', duration: number) => {
    if (!user) return;

    // Track machine start with Google Analytics
    trackMachineStart(
      machineType,
      machineId,
      'Normal Mode', // mode name
      duration, // duration in minutes
      user.studentId
    );

    // Record in data collection (for analytics dashboard)
    dataCollectionService.recordMachineUsage({
      studentId: user.studentId,
      machineId: machineId,
      machineType: machineType,
      startTime: Date.now(),
      duration: duration,
      cycleMode: 'Normal Mode',
    });

    console.log(`🟢 Machine started: ${machineType}-${machineId} for ${duration} minutes`);
  };

  // ============================================
  // 5. CANCEL MACHINE - Track with analytics
  // ============================================
  const handleCancelMachine = (machineId: number, machineType: 'washer' | 'dryer', timeRemaining: number) => {
    if (!user) return;

    // Track machine cancel with Google Analytics
    trackMachineCancel(
      machineType,
      machineId,
      user.studentId,
      timeRemaining
    );

    console.log(`🔴 Machine cancelled: ${machineType}-${machineId}. Time remaining: ${timeRemaining} minutes`);
  };

  // ============================================
  // 6. COLLECTION - Trigger notification and track
  // ============================================
  const handleMachineCompletion = (machineId: number, machineType: 'washer' | 'dryer') => {
    if (!user) return;

    // Trigger the enhanced notification
    // - Initial bell ring (2 seconds)
    // - Continuous alarm every 3 seconds
    // - Until user acknowledges
    const notificationId = notificationService.triggerNotification(
      machineId,
      machineType,
      `Your ${machineType} ${machineId} is complete! Please collect your clothes.`,
      'completion',
      user.studentId
    );

    console.log(`🔔 Notification triggered: ${notificationId}`);
  };

  // ============================================
  // 7. CLOTHES COLLECTED - Track completion
  // ============================================
  const handleClothesCollected = (
    machineId: number,
    machineType: 'washer' | 'dryer',
    totalDuration: number
  ) => {
    if (!user) return;

    // Track clothes collection with Google Analytics
    trackClothesCollection(
      machineType,
      machineId,
      user.studentId,
      totalDuration
    );

    // Stop all notifications
    notificationService.stopAll();

    // Record final data
    dataCollectionService.recordMachineUsage({
      studentId: user.studentId,
      machineId: machineId,
      machineType: machineType,
      startTime: Date.now() - (totalDuration * 60000),
      duration: totalDuration,
      cycleMode: 'Normal Mode',
    });

    console.log(`✅ Clothes collected: ${machineType}-${machineId}`);
  };

  // ============================================
  // 8. LOCK MACHINE - Auto-unlock after 24h
  // ============================================
  const handleLockMachine = (machineId: number, machineType: 'washer' | 'dryer') => {
    // Lock the machine with auto-unlock after 24 hours
    machineAutoUnlockService.lockMachine(
      machineId,
      machineType,
      24 * 60 * 60 * 1000, // 24 hours
      'Admin maintenance lock'
    );

    // Update UI
    const key = `${machineType}-${machineId}`;
    setLockedMachines((prev) => {
      const updated = new Map(prev);
      updated.set(key, Date.now());
      return updated;
    });

    console.log(`🔒 Machine locked: ${machineType}-${machineId}. Will auto-unlock in 24 hours.`);
  };

  // ============================================
  // 9. UNLOCK MACHINE - Manual unlock
  // ============================================
  const handleUnlockMachine = (machineId: number, machineType: 'washer' | 'dryer') => {
    // Unlock the machine manually
    machineAutoUnlockService.unlockMachine(machineId, machineType);

    // Update UI
    const key = `${machineType}-${machineId}`;
    setLockedMachines((prev) => {
      const updated = new Map(prev);
      updated.delete(key);
      return updated;
    });

    console.log(`🔓 Machine unlocked: ${machineType}-${machineId}`);
  };

  // ============================================
  // 10. GET TIME REMAINING FOR LOCKED MACHINE
  // ============================================
  const getUnlockTimeRemaining = (machineId: number, machineType: 'washer' | 'dryer'): string => {
    const timeRemaining = machineAutoUnlockService.getTimeRemaining(machineId, machineType);
    if (!timeRemaining) return 'Not locked';

    const minutes = Math.round(timeRemaining / 1000 / 60);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    return `${hours}h ${mins}m remaining`;
  };

  // ============================================
  // 11. GET ANALYTICS METRICS
  // ============================================
  const handleViewAnalytics = () => {
    const metrics = dataCollectionService.calculateMetrics();
    setAnalyticsMetrics(metrics);
    console.log('📊 Analytics Metrics:', metrics);
  };

  // ============================================
  // 12. EXPORT ALL DATA
  // ============================================
  const handleExportData = () => {
    const exportedData = dataCollectionService.exportAnalyticsData();
    console.log('💾 Exported Data:', exportedData);

    // Download as JSON file
    const element = document.createElement('a');
    element.setAttribute(
      'href',
      'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportedData, null, 2))
    );
    element.setAttribute('download', `ky-wash-data-${Date.now()}.json`);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    alert('Data exported and downloaded as JSON file!');
  };

  // ============================================
  // LOGIN VIEW
  // ============================================
  if (currentView === 'login') {
    return (
      <div className={`min-h-screen flex items-center justify-center ${darkMode ? 'bg-gray-900' : 'bg-gray-50'}`}>
        <div className={`p-8 rounded-lg shadow-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} w-full max-w-md`}>
          <h1 className={`text-2xl font-bold mb-6 ${darkMode ? 'text-white' : 'text-gray-800'}`}>KY Wash Login</h1>

          <input
            type="text"
            placeholder="Student ID (6 digits)"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            className={`w-full p-2 mb-3 rounded border ${
              darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
            }`}
          />

          <input
            type="text"
            placeholder="Phone Number (10-11 digits)"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className={`w-full p-2 mb-6 rounded border ${
              darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
            }`}
          />

          <button
            onClick={handleLogin}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Login
          </button>
        </div>
      </div>
    );
  }

  // ============================================
  // MAIN VIEW
  // ============================================
  if (currentView === 'main') {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'} p-6`}>
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>KY Wash System</h1>
              <p className={`text-lg ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Logged in as: {user?.studentId}
              </p>
            </div>
            <div className="space-x-4">
              <button
                onClick={() => setCurrentView('admin')}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-semibold"
              >
                Admin Panel
              </button>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-semibold"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Example Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Start Machine Example */}
            <div className={`p-6 rounded-lg shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                Start Machine
              </h2>
              <button
                onClick={() => handleStartMachine(1, 'washer', 30)}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded mb-2"
              >
                Start Washer 1 (30 min)
              </button>
              <button
                onClick={() => handleStartMachine(1, 'dryer', 40)}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              >
                Start Dryer 1 (40 min)
              </button>
            </div>

            {/* Machine Complete Example */}
            <div className={`p-6 rounded-lg shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                Machine Complete
              </h2>
              <button
                onClick={() => handleMachineCompletion(1, 'washer')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-2"
              >
                🔔 Complete Washer 1 (test notification)
              </button>
              <button
                onClick={() => handleClothesCollected(1, 'washer', 30)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
              >
                ✅ Collect Clothes
              </button>
            </div>

            {/* Cancel Machine Example */}
            <div className={`p-6 rounded-lg shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                Cancel Machine
              </h2>
              <button
                onClick={() => handleCancelMachine(1, 'washer', 15)}
                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded"
              >
                Cancel Washer 1
              </button>
            </div>

            {/* View Analytics Example */}
            <div className={`p-6 rounded-lg shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                View Analytics
              </h2>
              <button
                onClick={handleViewAnalytics}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded"
              >
                📊 View Metrics
              </button>
            </div>
          </div>

          {/* Analytics Display */}
          {analyticsMetrics && (
            <div className={`mt-6 p-6 rounded-lg shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <h2 className={`text-xl font-bold mb-4 ${darkMode ? 'text-white' : 'text-gray-800'}`}>
                Analytics Summary
              </h2>
              <pre className={`p-4 rounded overflow-auto ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                {JSON.stringify(analyticsMetrics, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================
  // ADMIN VIEW
  // ============================================
  if (currentView === 'admin') {
    return (
      <div className={`min-h-screen ${darkMode ? 'bg-gray-900' : 'bg-gray-50'} p-6`}>
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <h1 className={`text-3xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Admin Panel</h1>
            <button
              onClick={() => setCurrentView('main')}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded font-semibold"
            >
              Back to Main
            </button>
          </div>

          {/* Admin Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Machine Lock Controls */}
            <div className={`p-6 rounded-lg shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="flex items-center gap-2 mb-4">
                <Lock className="w-6 h-6" />
                <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Lock Controls</h2>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => handleLockMachine(1, 'washer')}
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                >
                  🔒 Lock Washer 1 (24h auto-unlock)
                </button>
                <button
                  onClick={() => handleUnlockMachine(1, 'washer')}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                >
                  🔓 Unlock Washer 1
                </button>
              </div>

              <div className={`mt-4 p-3 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  Locked Machines: {lockedMachines.size}
                </p>
                {Array.from(lockedMachines.keys()).map((key) => (
                  <p key={key} className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-700'}`}>
                    • {key}: {getUnlockTimeRemaining(parseInt(key.split('-')[1]), key.split('-')[0] as any)}
                  </p>
                ))}
              </div>
            </div>

            {/* Export Data */}
            <div className={`p-6 rounded-lg shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="w-6 h-6" />
                <h2 className={`text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-800'}`}>Export Data</h2>
              </div>

              <button
                onClick={handleExportData}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded"
              >
                💾 Download Analytics Data (JSON)
              </button>

              <p className={`mt-4 text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                Exports all user behavior, machine usage, and metrics data for external analysis.
              </p>
            </div>
          </div>

          {/* Analytics Dashboard */}
          <div className={`p-6 rounded-lg shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
            <AnalyticsDashboard darkMode={darkMode} />
          </div>
        </div>
      </div>
    );
  }

  return null;
};
