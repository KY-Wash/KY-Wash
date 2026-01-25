// User Data Collection and Analytics Module
// Collects detailed information about user behavior, machine usage, and timing
// Syncs with Supabase for persistent storage

'use client';

import { machineCyclesService } from './services/machineCycles';
import { analyticsService } from './services/analytics';
import { userSessionsService } from './services/userSessions';
import { notificationsService } from './services/notifications';
import { createClient } from './supabase/client';

export interface UsageHistory {
  studentId: string;
  machineId: number;
  machineType: 'washer' | 'dryer';
  startTime: number;
  duration: number;
  cycleMode: string;
}

export interface UserBehavior {
  studentId: string;
  phoneNumber: string;
  loginTime: number;
  logoutTime?: number;
  sessionDuration?: number;
  sessionsTotal?: number;
  lastActiveTime?: number;
}

export interface MachineUsageData extends UsageHistory {
  completedAt?: number;
  queueWaitTime?: number;
  notificationTime?: number;
  collectionTime?: number;
  cycleId?: string;
}

export interface AnalyticsMetrics {
  totalUsers: number;
  totalSessions: number;
  averageSessionDuration: number;
  peakHours: { hour: number; count: number }[];
  machineUtilizationRate: number;
  averageQueueTime: number;
  averageCompletionTime: number;
  machineUsageByTime: { [key: string]: number };
}

class DataCollectionService {
  private userBehaviors: Map<string, UserBehavior> = new Map();
  private machineUsageData: MachineUsageData[] = [];
  private sessionId: string;
  private supabase = createClient();
  private userId?: string;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.loadFromStorage();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Set user ID for tracking
  setUserId(userId: string) {
    this.userId = userId;
  }

  // Record user login - Syncs to Supabase
  async recordUserLogin(studentId: string, phoneNumber: string, userId?: string): Promise<void> {
    if (userId) this.userId = userId;

    const existing = this.userBehaviors.get(studentId) || {
      studentId,
      phoneNumber,
      sessionsTotal: 0,
    };

    const updatedBehavior: UserBehavior = {
      ...existing,
      loginTime: Date.now(),
      sessionsTotal: (existing.sessionsTotal || 0) + 1,
    };

    this.userBehaviors.set(studentId, updatedBehavior);
    this.saveToStorage();

    // Sync to Supabase
    if (userId) {
      await userSessionsService.startSession({
        user_id: userId,
        session_id: this.sessionId,
        user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        device_type: this.getDeviceType(),
      });
    }

    // Track analytics event
    await analyticsService.trackEvent({
      user_id: userId,
      event_type: 'user_login',
      event_name: 'login',
      category: 'Auth',
      action: 'login',
      session_id: this.sessionId,
    });
  }

  // Record user logout - Syncs to Supabase
  async recordUserLogout(studentId: string): Promise<void> {
    const behavior = this.userBehaviors.get(studentId);
    if (behavior) {
      const updatedBehavior: UserBehavior = {
        ...behavior,
        logoutTime: Date.now(),
        sessionDuration: Date.now() - behavior.loginTime,
        lastActiveTime: Date.now(),
      };
      this.userBehaviors.set(studentId, updatedBehavior);
      this.saveToStorage();
    }

    // Sync to Supabase
    await userSessionsService.endSession(this.sessionId);

    // Track analytics event
    await analyticsService.trackEvent({
      user_id: this.userId,
      event_type: 'user_logout',
      event_name: 'logout',
      category: 'Auth',
      action: 'logout',
      session_id: this.sessionId,
    });
  }

  // Record machine usage - Syncs to Supabase
  async recordMachineUsage(usage: UsageHistory & { queueWaitTime?: number; notificationTime?: number; userId?: string }): Promise<void> {
    const machineData: MachineUsageData = {
      ...usage,
      completedAt: Date.now(),
    };
    this.machineUsageData.push(machineData);
    this.saveToStorage();

    // Sync to Supabase - Create machine cycle
    const userId = usage.userId || this.userId;
    if (userId) {
      const result = await machineCyclesService.startCycle({
        machine_id: usage.machineId,
        user_id: userId,
        machine_name: `Machine ${usage.machineId}`,
        machine_type: usage.machineType,
        cycle_mode: usage.cycleMode,
        duration_minutes: Math.ceil(usage.duration / 60),
      });

      if (result.success && result.data?.id) {
        machineData.cycleId = result.data.id;
      }

      // Track analytics event
      await analyticsService.trackMachineEvent(
        'start',
        usage.machineId,
        userId,
        {
          cycleMode: usage.cycleMode,
          duration: usage.duration,
          queueWaitTime: usage.queueWaitTime,
        }
      );
    }
  }

  // Complete a machine cycle - Syncs to Supabase
  async completeMachineUsage(cycleId: string, cost?: number): Promise<void> {
    const machineData = this.machineUsageData.find(m => m.cycleId === cycleId);
    if (machineData) {
      machineData.completedAt = Date.now();
      this.saveToStorage();

      // Sync to Supabase
      await machineCyclesService.completeCycle(cycleId, {
        cost: cost,
      });

      // Notify user
      if (this.userId) {
        await notificationsService.createNotification({
          user_id: this.userId,
          notification_type: 'cycle_complete',
          title: 'Cycle Complete',
          message: 'Your laundry cycle has completed. Please collect your clothes.',
          priority: 'high',
        });
      }
    }
  }

  // Mark clothes as collected - Syncs to Supabase
  async markCycleAsCollected(cycleId: string): Promise<void> {
    const machineData = this.machineUsageData.find(m => m.cycleId === cycleId);
    if (machineData) {
      machineData.collectionTime = Date.now();
      this.saveToStorage();

      // Sync to Supabase
      await machineCyclesService.markAsCollected(cycleId);

      // Track analytics event
      if (this.userId) {
        await analyticsService.trackEvent({
          user_id: this.userId,
          event_type: 'clothes_collected',
          event_name: 'clothes_collected',
          category: 'Machine',
          action: 'collection',
        });
      }
    }
  }

  // Get user behavior
  getUserBehavior(studentId: string): UserBehavior | undefined {
    return this.userBehaviors.get(studentId);
  }

  // Get all user behaviors
  getAllUserBehaviors(): UserBehavior[] {
    return Array.from(this.userBehaviors.values());
  }

  // Get machine usage data
  getMachineUsageData(): MachineUsageData[] {
    return this.machineUsageData;
  }

  // Helper to get device type
  private getDeviceType(): string {
    if (typeof navigator === 'undefined') return 'unknown';
    
    if (/mobile|android|iphone/i.test(navigator.userAgent)) return 'mobile';
    if (/tablet|ipad/i.test(navigator.userAgent)) return 'tablet';
    return 'desktop';
  }

  // Calculate analytics metrics
  calculateMetrics(): AnalyticsMetrics {
    const users = Array.from(this.userBehaviors.values());
    const totalUsers = users.length;
    const totalSessions = users.reduce((sum, u) => sum + (u.sessionsTotal || 0), 0);
    const averageSessionDuration =
      users.reduce((sum, u) => sum + (u.sessionDuration || 0), 0) / Math.max(totalSessions, 1);

    // Calculate peak hours
    const hourCounts: { [key: number]: number } = {};
    this.machineUsageData.forEach((usage) => {
      const hour = new Date(usage.startTime).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });

    const peakHours = Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Calculate machine utilization
    const totalMachineTime = this.machineUsageData.reduce((sum, u) => sum + u.duration, 0);
    const maxPossibleTime = 12 * 24 * 60; // 12 machines * 24 hours * 60 minutes
    const machineUtilizationRate = (totalMachineTime / maxPossibleTime) * 100;

    // Calculate average queue time
    const queueTimes = this.machineUsageData
      .filter((u) => u.queueWaitTime)
      .map((u) => u.queueWaitTime || 0);
    const averageQueueTime = queueTimes.length > 0 ? queueTimes.reduce((a, b) => a + b) / queueTimes.length : 0;

    // Calculate average completion time
    const completionTimes = this.machineUsageData
      .filter((u) => u.completedAt)
      .map((u) => (u.completedAt || 0) - u.startTime);
    const averageCompletionTime =
      completionTimes.length > 0 ? completionTimes.reduce((a, b) => a + b) / completionTimes.length : 0;

    // Machine usage by time of day
    const machineUsageByTime: { [key: string]: number } = {};
    this.machineUsageData.forEach((usage) => {
      const date = new Date(usage.startTime);
      const timeSlot = `${date.getHours()}:00-${date.getHours()}:59`;
      machineUsageByTime[timeSlot] = (machineUsageByTime[timeSlot] || 0) + 1;
    });

    return {
      totalUsers,
      totalSessions,
      averageSessionDuration,
      peakHours,
      machineUtilizationRate,
      averageQueueTime,
      averageCompletionTime,
      machineUsageByTime,
    };
  }

  // Get usage statistics for a specific period
  getUsageStatsByPeriod(startTime: number, endTime: number) {
    const data = this.machineUsageData.filter((u) => u.startTime >= startTime && u.startTime <= endTime);

    return {
      totalUsages: data.length,
      byType: {
        washer: data.filter((u) => u.machineType === 'washer').length,
        dryer: data.filter((u) => u.machineType === 'dryer').length,
      },
      byMode: data.reduce(
        (acc, u) => {
          acc[u.cycleMode] = (acc[u.cycleMode] || 0) + 1;
          return acc;
        },
        {} as { [key: string]: number }
      ),
      totalDuration: data.reduce((sum, u) => sum + u.duration, 0),
      totalSpending: data.reduce((sum, u) => sum + 0, 0),
    };
  }

  // Export data for analytics
  exportAnalyticsData() {
    return {
      users: this.getAllUserBehaviors(),
      machineUsage: this.getMachineUsageData(),
      metrics: this.calculateMetrics(),
      sessionId: this.sessionId,
      exportTime: Date.now(),
    };
  }

  // Save to localStorage
  private saveToStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(
          'kyWash_userBehaviors',
          JSON.stringify(Array.from(this.userBehaviors.entries()))
        );
        localStorage.setItem('kyWash_machineUsageData', JSON.stringify(this.machineUsageData));
      } catch (error) {
        console.error('Failed to save data to storage:', error);
      }
    }
  }

  // Load from localStorage
  private loadFromStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        const userBehaviorsData = localStorage.getItem('kyWash_userBehaviors');
        if (userBehaviorsData) {
          this.userBehaviors = new Map(JSON.parse(userBehaviorsData));
        }

        const machineUsageData = localStorage.getItem('kyWash_machineUsageData');
        if (machineUsageData) {
          this.machineUsageData = JSON.parse(machineUsageData);
        }
      } catch (error) {
        console.error('Failed to load data from storage:', error);
      }
    }
  }

  // Clear all data
  clearAllData(): void {
    this.userBehaviors.clear();
    this.machineUsageData = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kyWash_userBehaviors');
      localStorage.removeItem('kyWash_machineUsageData');
    }
  }
}

// Export singleton instance
export const dataCollectionService = new DataCollectionService();

// Export React hook for using in components
export const useDataCollection = () => {
  const service = dataCollectionService;

  return {
    setUserId: (userId: string) => {
      service.setUserId(userId);
    },
    trackEvent: async (eventName: string, data?: any) => {
      await service.recordMachineUsage({
        studentId: data?.userId || 'anonymous',
        machineId: data?.machineId || 0,
        machineType: data?.machineType || 'washer',
        startTime: Date.now(),
        duration: data?.duration || 0,
        cycleMode: eventName,
        userId: data?.userId,
        queueWaitTime: data?.queueWaitTime,
      });
    },
    completeCycle: async (cycleId: string, cost?: number) => {
      await service.completeMachineUsage(cycleId, cost);
    },
    markAsCollected: async (cycleId: string) => {
      await service.markCycleAsCollected(cycleId);
    },
    getAnalytics: () => {
      return {
        events: service.calculateMetrics(),
        totalEvents: service.getMachineUsageData().length,
        eventsByType: {},
        recentEvents: service.getMachineUsageData().slice(-10),
      };
    },
    recordLogin: async (studentId: string, phoneNumber: string, userId?: string) => {
      await service.recordUserLogin(studentId, phoneNumber, userId);
    },
    recordLogout: async (studentId: string) => {
      await service.recordUserLogout(studentId);
    },
  };
};
