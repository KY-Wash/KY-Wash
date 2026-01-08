// Google Analytics Integration for KY Wash
// Initialize GA4 and track all user events and behaviors

import ReactGA from 'react-ga4';

const GA_MEASUREMENT_ID = process.env.GA_MEASUREMENT_ID || '';

export interface AnalyticsEvent {
  category: string;
  action: string;
  label?: string;
  value?: number;
  userId?: string;
}

export interface UserData {
  studentId: string;
  phoneNumber: string;
  loginTime: number;
  sessionId: string;
}

// Initialize Google Analytics
export const initializeGA = () => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.initialize(GA_MEASUREMENT_ID);
    console.log('✅ Google Analytics initialized');
  } else {
    console.warn('⚠️ GA_MEASUREMENT_ID not configured');
  }
};

// Set user ID for tracking
export const setUserId = (studentId: string) => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.set({ 'user_id': studentId });
  }
};

// Track page views
export const trackPageView = (pagePath: string, pageTitle: string) => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.event('page_view', {
      page_path: pagePath,
      page_title: pageTitle,
    });
  }
};

// Track custom events
export const trackEvent = (event: AnalyticsEvent) => {
  if (GA_MEASUREMENT_ID) {
    ReactGA.event(event.action, {
      category: event.category,
      label: event.label,
      value: event.value,
    });
  }
};

// Track machine start
export const trackMachineStart = (machineType: 'washer' | 'dryer', machineId: number, mode: string, duration: number, studentId: string) => {
  trackEvent({
    category: 'Machine',
    action: 'start',
    label: `${machineType}-${machineId}-${mode}`,
    value: duration,
    userId: studentId,
  });
};

// Track machine cancel
export const trackMachineCancel = (machineType: 'washer' | 'dryer', machineId: number, studentId: string, timeRemaining: number) => {
  trackEvent({
    category: 'Machine',
    action: 'cancel',
    label: `${machineType}-${machineId}`,
    value: timeRemaining,
    userId: studentId,
  });
};

// Track collection event
export const trackClothesCollection = (machineType: 'washer' | 'dryer', machineId: number, studentId: string, totalDuration: number) => {
  trackEvent({
    category: 'Machine',
    action: 'collection',
    label: `${machineType}-${machineId}`,
    value: totalDuration,
    userId: studentId,
  });
};

// Track waitlist join
export const trackWaitlistJoin = (machineType: 'washer' | 'dryer', studentId: string, position: number) => {
  trackEvent({
    category: 'Waitlist',
    action: 'join',
    label: machineType,
    value: position,
    userId: studentId,
  });
};

// Track waitlist leave
export const trackWaitlistLeave = (machineType: 'washer' | 'dryer', studentId: string) => {
  trackEvent({
    category: 'Waitlist',
    action: 'leave',
    label: machineType,
    userId: studentId,
  });
};

// Track notification received
export const trackNotificationReceived = (machineType: 'washer' | 'dryer', machineId: number, studentId: string, notificationType: string) => {
  trackEvent({
    category: 'Notification',
    action: 'received',
    label: `${machineType}-${machineId}-${notificationType}`,
    userId: studentId,
  });
};

// Track login
export const trackLogin = (studentId: string) => {
  trackEvent({
    category: 'User',
    action: 'login',
    label: studentId,
  });
  setUserId(studentId);
};

// Track logout
export const trackLogout = (studentId: string) => {
  trackEvent({
    category: 'User',
    action: 'logout',
    label: studentId,
  });
};

// Track issue report
export const trackIssueReport = (machineType: 'washer' | 'dryer', machineId: number, studentId: string) => {
  trackEvent({
    category: 'Maintenance',
    action: 'issue_reported',
    label: `${machineType}-${machineId}`,
    userId: studentId,
  });
};

// Get session data for analytics
export const getSessionData = () => {
  return {
    sessionId: sessionStorage.getItem('ga_session_id') || Math.random().toString(36).substr(2, 9),
    timestamp: Date.now(),
  };
};

// Analytics Service for processing machine data
export class AnalyticsService {
  analyzeMachineUsage(machineId: string, events: any[]) {
    const machineEvents = events.filter(e => e.machineId === machineId);
    const totalCycles = machineEvents.filter(e => e.type === 'cycle_complete').length;
    
    return {
      totalCycles,
      averageWaitTime: 0,
      peakHours: [],
      utilizationRate: 0,
      downtime: 0,
    };
  }

  identifyPeakTimes(events: any[]) {
    const hourCounts: Record<string, number> = {};
    events.forEach(e => {
      const hour = new Date(e.timestamp).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    return Object.entries(hourCounts).map(([hour, count]) => ({
      hour,
      usageCount: count,
      avgQueue: 0,
    }));
  }

  forecastDemand(events: any[], hoursAhead: number) {
    return Array.from({ length: hoursAhead }).map((_, i) => ({
      hour: new Date(Date.now() + i * 3600000).getHours(),
      predictedQueue: Math.random() * 5,
    }));
  }
}

export default {
  initializeGA,
  setUserId,
  trackPageView,
  trackEvent,
  trackMachineStart,
  trackMachineCancel,
  trackClothesCollection,
  trackWaitlistJoin,
  trackWaitlistLeave,
  trackNotificationReceived,
  trackLogin,
  trackLogout,
  trackIssueReport,
  getSessionData,
  AnalyticsService,
};
