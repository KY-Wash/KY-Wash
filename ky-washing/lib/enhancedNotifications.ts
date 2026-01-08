// Enhanced Notification System
// Improves notification behavior: single ring on completion, then continuous until acknowledged

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

class EnhancedNotificationService {
  private audioContext: AudioContext | null = null;
  private config: NotificationConfig;
  private activeNotifications: Map<string, ActiveNotification> = new Map();
  private continuousRingIntervals: Map<string, NodeJS.Timeout> = new Map();
  private onAcknowledgeCallbacks: ((notification: ActiveNotification) => void)[] = [];
  private ringStartedAt: Map<string, number> = new Map();

  constructor(config: Partial<NotificationConfig> = {}) {
    this.config = {
      initialRingDuration: config.initialRingDuration || 2000, // 2 seconds initial ring
      continuousRingGap: config.continuousRingGap || 3000, // 3 seconds between rings
      maxContinuousRingDuration: config.maxContinuousRingDuration || 5 * 60 * 1000, // 5 minutes max
    };
  }

  // Initialize audio context
  private initAudioContext(): void {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (error) {
        console.error('Failed to initialize audio context:', error);
      }
    }
  }

  // Play single bell ring (initial notification)
  private playBellRing(): void {
    try {
      this.initAudioContext();
      if (!this.audioContext) return;

      const ctx = this.audioContext;
      const now = ctx.currentTime;

      // Create oscillator for bell sound (higher frequency)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      // Bell frequencies
      osc1.frequency.setValueAtTime(800, now);
      osc2.frequency.setValueAtTime(1200, now);

      // Frequency modulation for bell effect
      osc1.frequency.exponentialRampToValueAtTime(600, now + 0.3);
      osc2.frequency.exponentialRampToValueAtTime(900, now + 0.3);

      // Volume envelope
      gain.gain.setValueAtTime(0.8, now);
      gain.gain.exponentialRampToValueAtTime(0.1, now + 0.5);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.5);
      osc2.stop(now + 0.5);
    } catch (error) {
      console.error('Failed to play bell ring:', error);
    }
  }

  // Play continuous alarm
  private playContinuousAlarm(): void {
    try {
      this.initAudioContext();
      if (!this.audioContext) return;

      const ctx = this.audioContext;
      const now = ctx.currentTime;

      // Create a more urgent continuous beep pattern
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.setValueAtTime(1000, now);
      osc.type = 'square';

      // Quick pulses
      gain.gain.setValueAtTime(0.7, now);
      gain.gain.setValueAtTime(0, now + 0.15);
      gain.gain.setValueAtTime(0.7, now + 0.2);
      gain.gain.setValueAtTime(0, now + 0.35);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch (error) {
      console.error('Failed to play continuous alarm:', error);
    }
  }

  // Trigger notification with single ring + continuous until acknowledged
  triggerNotification(
    machineId: number,
    machineType: 'washer' | 'dryer',
    message: string,
    type: NotificationType = 'completion',
    studentId?: string
  ): string {
    this.initAudioContext();

    const notificationId = `${machineType}-${machineId}-${Date.now()}`;
    const notification: ActiveNotification = {
      id: notificationId,
      machineId,
      machineType,
      type,
      message,
      timestamp: Date.now(),
      studentId,
    };

    this.activeNotifications.set(notificationId, notification);

    console.log(`🔔 Notification triggered: ${message}`);

    // Play initial single ring
    this.playBellRing();

    // Store ring start time
    this.ringStartedAt.set(notificationId, Date.now());

    // Start continuous ring after initial ring
    setTimeout(() => {
      this.startContinuousRing(notificationId);
    }, this.config.initialRingDuration);

    // Send browser notification
    this.sendBrowserNotification(message);

    return notificationId;
  }

  // Start continuous ringing (called after initial ring)
  private startContinuousRing(notificationId: string): void {
    // Clear any existing interval
    if (this.continuousRingIntervals.has(notificationId)) {
      clearInterval(this.continuousRingIntervals.get(notificationId)!);
    }

    const interval = setInterval(() => {
      const notification = this.activeNotifications.get(notificationId);
      if (!notification) {
        clearInterval(interval);
        this.continuousRingIntervals.delete(notificationId);
        return;
      }

      // Check if max duration exceeded
      const ringStartTime = this.ringStartedAt.get(notificationId) || Date.now();
      const ringDuration = Date.now() - ringStartTime;

      if (ringDuration > this.config.maxContinuousRingDuration) {
        clearInterval(interval);
        this.continuousRingIntervals.delete(notificationId);
        console.log(`⏱️ Continuous ring timeout for notification: ${notificationId}`);
        return;
      }

      // Play alarm
      this.playContinuousAlarm();
    }, this.config.continuousRingGap);

    this.continuousRingIntervals.set(notificationId, interval);
    console.log(`🔊 Continuous ring started for notification: ${notificationId}`);
  }

  // Acknowledge notification (stop continuous ring)
  acknowledgeNotification(notificationId: string): void {
    const notification = this.activeNotifications.get(notificationId);

    if (notification) {
      // Stop continuous ring
      if (this.continuousRingIntervals.has(notificationId)) {
        clearInterval(this.continuousRingIntervals.get(notificationId)!);
        this.continuousRingIntervals.delete(notificationId);
      }

      // Remove from active notifications
      this.activeNotifications.delete(notificationId);
      this.ringStartedAt.delete(notificationId);

      // Call callbacks
      this.onAcknowledgeCallbacks.forEach((callback) => {
        try {
          callback(notification);
        } catch (error) {
          console.error('Error in acknowledge callback:', error);
        }
      });

      console.log(`✓ Notification acknowledged: ${notificationId}`);
    }
  }

  // Get active notifications
  getActiveNotifications(): ActiveNotification[] {
    return Array.from(this.activeNotifications.values());
  }

  // Check if any notification is active for a machine
  hasActiveNotification(machineId: number, machineType: 'washer' | 'dryer'): boolean {
    return Array.from(this.activeNotifications.values()).some(
      (n) => n.machineId === machineId && n.machineType === machineType
    );
  }

  // Register acknowledge callback
  onAcknowledge(callback: (notification: ActiveNotification) => void): void {
    this.onAcknowledgeCallbacks.push(callback);
  }

  // Send browser push notification
  private sendBrowserNotification(message: string): void {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification('🔔 KY Wash', {
          body: message,
          icon: '/waves.svg',
          badge: '/waves.svg',
          tag: 'ky-wash-notification',
          requireInteraction: true, // Require user interaction to dismiss
        });
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          if (permission === 'granted') {
            new Notification('🔔 KY Wash', {
              body: message,
              icon: '/waves.svg',
              badge: '/waves.svg',
              tag: 'ky-wash-notification',
              requireInteraction: true,
            });
          }
        });
      }
    }
  }

  // Update config
  updateConfig(newConfig: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('📋 Notification config updated:', this.config);
  }

  // Get current config
  getConfig(): NotificationConfig {
    return { ...this.config };
  }

  // Stop all notifications
  stopAll(): void {
    this.activeNotifications.forEach((_, id) => {
      this.acknowledgeNotification(id);
    });
    console.log('🛑 All notifications stopped');
  }

  // Cleanup
  destroy(): void {
    this.stopAll();
    this.continuousRingIntervals.clear();
    this.ringStartedAt.clear();
    this.onAcknowledgeCallbacks = [];
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    console.log('Notification service destroyed');
  }
}

// Export singleton instance
export const notificationService = new EnhancedNotificationService({
  initialRingDuration: 2000, // 2 seconds of initial bell ring
  continuousRingGap: 3000, // Ring every 3 seconds after initial
  maxContinuousRingDuration: 5 * 60 * 1000, // Max 5 minutes of continuous ringing
});

// Export convenience functions
export const ringNotification = (message: string) => {
  const id = Math.random().toString(36).substr(2, 9);
  return notificationService.triggerNotification(
    0,
    'washer',
    message,
    'completion'
  );
};

export const alertNotification = (message: string) => {
  const id = Math.random().toString(36).substr(2, 9);
  return notificationService.triggerNotification(
    0,
    'washer',
    message,
    'reminder'
  );
};

export default EnhancedNotificationService;
