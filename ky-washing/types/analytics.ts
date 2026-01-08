// Type Definitions for KY Wash Analytics System
// Import these types to ensure type safety across your application

// ============================================
// ANALYTICS TYPES
// ============================================

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

export interface UserData {
  studentId: string;
  phoneNumber: string;
  loginTime: number;
  sessionId: string;
}

// ============================================
// DATA COLLECTION TYPES
// ============================================

export interface UserBehavior {
  studentId: string;
  phoneNumber: string;
  loginTime: number;
  logoutTime?: number;
  sessionDuration?: number;
  sessionsTotal?: number;
  lastActiveTime?: number;
}

export interface MachineUsageData {
  id: string;
  type: 'washer' | 'dryer';
  machine_id: number;
  mode: string;
  duration: number;
  date: string;
  day: string;
  time: string;
  studentId: string;
  timestamp: number;
  spending?: number;
  status?: 'In Progress' | 'Completed' | 'cancelled';
  completedAt?: number;
  queueWaitTime?: number;
  notificationTime?: number;
  collectionTime?: number;
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

// ============================================
// AUTO-UNLOCK TYPES
// ============================================

export interface MachineUnlockConfig {
  autoUnlockAfter: number; // milliseconds
  checkInterval: number; // milliseconds
}

export interface LockedMachine {
  machineId: number;
  machineType: 'washer' | 'dryer';
  lockedAt: number;
  lockDuration: number; // milliseconds
  reason?: string;
}

// ============================================
// NOTIFICATION TYPES
// ============================================

export type NotificationType = 'completion' | 'reminder' | 'waitlist' | 'issue';

export interface NotificationConfig {
  initialRingDuration: number; // milliseconds for initial ring
  continuousRingGap: number; // gap between continuous rings
  maxContinuousRingDuration: number; // max duration for continuous ring
}

export interface ActiveNotification {
  id: string;
  machineId: number;
  machineType: 'washer' | 'dryer';
  type: NotificationType;
  message: string;
  timestamp: number;
  studentId?: string;
}

// ============================================
// MACHINE TYPES
// ============================================

export interface Machine {
  id: number;
  type: 'washer' | 'dryer';
  status: 'available' | 'running' | 'maintenance' | 'pending-collection';
  timeLeft: number;
  mode: string | null;
  locked: boolean;
  userStudentId: string | null;
  userPhone: string | null;
  originalDuration?: number;
  cancellable?: boolean;
}

export interface Mode {
  name: string;
  duration: number;
}

// ============================================
// USER TYPES
// ============================================

export interface User {
  studentId: string;
  phoneNumber: string;
  password?: string;
}

export interface WaitlistEntry {
  studentId: string;
  phone: string;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}

export interface StateApiRequest {
  event: string;
  data: any;
}

export interface StateApiResponse {
  machines: Machine[];
  waitlists: {
    washers: WaitlistEntry[];
    dryers: WaitlistEntry[];
  };
  stats: {
    totalWashes: number;
    totalMinutes: number;
  };
  usageHistory: MachineUsageData[];
}

// ============================================
// EXPORTED TYPE UNION
// ============================================

export type MachineType = 'washer' | 'dryer';
export type MachineStatus = 'available' | 'running' | 'maintenance' | 'pending-collection';

// ============================================
// HELPER TYPES
// ============================================

export type Callback<T> = (data: T) => void;
export type EventHandler = (event: AnalyticsEvent) => void;
export type NotificationHandler = (notification: ActiveNotification) => void;
export type UnlockHandler = (machine: LockedMachine) => void;

// ============================================
// EXPORT ALL TYPES
// ============================================

export type {
  UserBehavior,
  MachineUsageData,
  AnalyticsMetrics,
  MachineUnlockConfig,
  LockedMachine,
  NotificationType,
  NotificationConfig,
  ActiveNotification,
  Machine,
  Mode,
  User,
  WaitlistEntry,
  ApiResponse,
  StateApiRequest,
  StateApiResponse,
};
