// Machine Auto-Unlock Timer Service
// Ensures machines automatically unlock after a set period for maintenance/reset

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

class MachineAutoUnlockService {
  private lockedMachines: Map<string, LockedMachine> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private config: MachineUnlockConfig;
  private unlockCallbacks: ((machine: LockedMachine) => void)[] = [];

  constructor(config: Partial<MachineUnlockConfig> = {}) {
    this.config = {
      autoUnlockAfter: config.autoUnlockAfter || 24 * 60 * 60 * 1000, // Default 24 hours
      checkInterval: config.checkInterval || 60 * 1000, // Check every minute
    };
    this.loadFromStorage();
    this.startAutoUnlockCheck();
  }

  // Lock a machine
  lockMachine(
    machineId: number,
    machineType: 'washer' | 'dryer',
    lockDuration?: number,
    reason?: string
  ): void {
    const key = `${machineType}-${machineId}`;
    const machine: LockedMachine = {
      machineId,
      machineType,
      lockedAt: Date.now(),
      lockDuration: lockDuration || this.config.autoUnlockAfter,
      reason,
    };

    this.lockedMachines.set(key, machine);
    this.saveToStorage();

    console.log(`🔒 Machine locked: ${key}. Auto-unlock in ${Math.round(machine.lockDuration / 1000 / 60)} minutes`);
  }

  // Unlock a machine manually
  unlockMachine(machineId: number, machineType: 'washer' | 'dryer'): void {
    const key = `${machineType}-${machineId}`;
    this.lockedMachines.delete(key);
    this.saveToStorage();

    console.log(`🔓 Machine unlocked: ${key}`);
  }

  // Check if a machine is locked
  isMachineLocked(machineId: number, machineType: 'washer' | 'dryer'): boolean {
    const key = `${machineType}-${machineId}`;
    return this.lockedMachines.has(key);
  }

  // Get all locked machines
  getLockedMachines(): LockedMachine[] {
    return Array.from(this.lockedMachines.values());
  }

  // Get time remaining for a locked machine
  getTimeRemaining(machineId: number, machineType: 'washer' | 'dryer'): number | null {
    const key = `${machineType}-${machineId}`;
    const machine = this.lockedMachines.get(key);

    if (!machine) return null;

    const elapsedTime = Date.now() - machine.lockedAt;
    const timeRemaining = machine.lockDuration - elapsedTime;

    return Math.max(0, timeRemaining);
  }

  // Register callback for unlock events
  onMachineUnlock(callback: (machine: LockedMachine) => void): void {
    this.unlockCallbacks.push(callback);
  }

  // Auto-unlock check (runs periodically)
  private startAutoUnlockCheck(): void {
    if (this.checkInterval) clearInterval(this.checkInterval);

    this.checkInterval = setInterval(() => {
      this.checkAndUnlockMachines();
    }, this.config.checkInterval);
  }

  private checkAndUnlockMachines(): void {
    const now = Date.now();
    const machineKeys = Array.from(this.lockedMachines.keys());

    machineKeys.forEach((key) => {
      const machine = this.lockedMachines.get(key);
      if (machine) {
        const elapsedTime = now - machine.lockedAt;

        // Check if lock duration has expired
        if (elapsedTime >= machine.lockDuration) {
          // Auto-unlock the machine
          this.lockedMachines.delete(key);

          // Call all registered callbacks
          this.unlockCallbacks.forEach((callback) => {
            try {
              callback(machine);
            } catch (error) {
              console.error('Error in unlock callback:', error);
            }
          });

          console.log(`⏰ Machine auto-unlocked: ${key}. Lock duration: ${Math.round(elapsedTime / 1000 / 60)} minutes`);

          // Save state
          this.saveToStorage();
        }
      }
    });
  }

  // Set custom auto-unlock duration
  setAutoUnlockDuration(durationMs: number): void {
    this.config.autoUnlockAfter = durationMs;
    console.log(`⚙️ Auto-unlock duration set to ${Math.round(durationMs / 1000 / 60)} minutes`);
  }

  // Get current config
  getConfig(): MachineUnlockConfig {
    return { ...this.config };
  }

  // Save to localStorage
  private saveToStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        const data = {
          lockedMachines: Array.from(this.lockedMachines.entries()),
          timestamp: Date.now(),
        };
        localStorage.setItem('kyWash_lockedMachines', JSON.stringify(data));
      } catch (error) {
        console.error('Failed to save locked machines to storage:', error);
      }
    }
  }

  // Load from localStorage
  private loadFromStorage(): void {
    if (typeof window !== 'undefined') {
      try {
        const data = localStorage.getItem('kyWash_lockedMachines');
        if (data) {
          const parsed = JSON.parse(data);
          this.lockedMachines = new Map(parsed.lockedMachines || []);

          // Re-check machines that may have expired while offline
          this.checkAndUnlockMachines();
        }
      } catch (error) {
        console.error('Failed to load locked machines from storage:', error);
      }
    }
  }

  // Clear all locks
  clearAllLocks(): void {
    this.lockedMachines.clear();
    this.saveToStorage();
    console.log('🔓 All machine locks cleared');
  }

  // Destroy service
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }
    this.unlockCallbacks = [];
    console.log('Machine unlock service destroyed');
  }
}

// Export singleton instance with default 24-hour auto-unlock
export const machineAutoUnlockService = new MachineAutoUnlockService({
  autoUnlockAfter: 24 * 60 * 60 * 1000, // 24 hours
  checkInterval: 60 * 1000, // Check every minute
});

// Export class for direct instantiation
export const MachineAutoUnlock = MachineAutoUnlockService;

export default MachineAutoUnlockService;
