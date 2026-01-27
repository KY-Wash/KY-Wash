'use client';

import { createClient } from '@/lib/supabase/client';
import { Database } from '@/types/supabase';

export interface MachineCycleInput {
  machine_id: number;
  user_id: string;
  machine_name: string;
  machine_type: 'washer' | 'dryer';
  cycle_mode?: string;
  duration_minutes?: number;
  status?: 'in-progress' | 'completed' | 'cancelled' | 'paused';
  cost?: number;
}

export interface MachineCycleUpdate {
  status?: 'in-progress' | 'completed' | 'cancelled' | 'paused';
  end_time?: string;
  duration_minutes?: number;
  cost?: number;
  was_collected?: boolean;
  collection_time?: string;
}

/**
 * Machine Cycles Service
 * Handles all machine cycle/usage session operations
 */
export class MachineCyclesService {
  private supabase = createClient();

  /**
   * Start a new machine cycle
   */
  async startCycle(data: MachineCycleInput) {
    try {
      const { data: cycle, error } = await this.supabase
        .from('machine_cycles')
        .insert({
          machine_id: data.machine_id,
          user_id: data.user_id,
          machine_name: data.machine_name,
          machine_type: data.machine_type,
          cycle_mode: data.cycle_mode || 'normal',
          duration_minutes: data.duration_minutes || 0,
          status: 'in-progress',
          start_time: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Update machine status
      await this.supabase
        .from('machines')
        .update({
          status: 'in-use',
          current_user_id: data.user_id,
          cycle_start_time: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', data.machine_id);

      return { success: true, data: cycle };
    } catch (error) {
      console.error('Error starting cycle:', error);
      return { success: false, error };
    }
  }

  /**
   * Complete a machine cycle
   */
  async completeCycle(cycleId: string, updates: MachineCycleUpdate) {
    try {
      const { data: cycle, error } = await this.supabase
        .from('machine_cycles')
        .update({
          ...updates,
          status: 'completed',
          end_time: new Date().toISOString(),
          completion_time: new Date().toISOString(),
        })
        .eq('id', cycleId)
        .select()
        .single();

      if (error) throw error;

      // Update machine status
      if (cycle) {
        await this.supabase
          .from('machines')
          .update({
            status: 'completed',
            cycle_end_time: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', cycle.machine_id);
      }

      return { success: true, data: cycle };
    } catch (error) {
      console.error('Error completing cycle:', error);
      return { success: false, error };
    }
  }

  /**
   * Cancel a machine cycle
   */
  async cancelCycle(cycleId: string) {
    try {
      const { data: cycle, error } = await this.supabase
        .from('machine_cycles')
        .update({
          status: 'cancelled',
          end_time: new Date().toISOString(),
        })
        .eq('id', cycleId)
        .select()
        .single();

      if (error) throw error;

      // Update machine status back to available
      if (cycle) {
        await this.supabase
          .from('machines')
          .update({
            status: 'available',
            current_user_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', cycle.machine_id);
      }

      return { success: true, data: cycle };
    } catch (error) {
      console.error('Error cancelling cycle:', error);
      return { success: false, error };
    }
  }

  /**
   * Mark clothes as collected
   */
  async markAsCollected(cycleId: string) {
    try {
      const { data: cycle, error } = await this.supabase
        .from('machine_cycles')
        .update({
          was_collected: true,
          collection_time: new Date().toISOString(),
        })
        .eq('id', cycleId)
        .select()
        .single();

      if (error) throw error;

      // Update machine status back to available
      if (cycle) {
        await this.supabase
          .from('machines')
          .update({
            status: 'available',
            current_user_id: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', cycle.machine_id);
      }

      return { success: true, data: cycle };
    } catch (error) {
      console.error('Error marking as collected:', error);
      return { success: false, error };
    }
  }

  /**
   * Get user's machine cycles
   */
  async getUserCycles(userId: string) {
    try {
      const { data: cycles, error } = await this.supabase
        .from('machine_cycles')
        .select('*')
        .eq('user_id', userId)
        .order('start_time', { ascending: false });

      if (error) throw error;
      return { success: true, data: cycles };
    } catch (error) {
      console.error('Error fetching user cycles:', error);
      return { success: false, error };
    }
  }

  /**
   * Get active cycles (for dashboard)
   */
  async getActiveCycles() {
    try {
      const { data: cycles, error } = await this.supabase
        .from('machine_cycles')
        .select('*')
        .eq('status', 'in-progress')
        .order('start_time', { ascending: false });

      if (error) throw error;
      return { success: true, data: cycles };
    } catch (error) {
      console.error('Error fetching active cycles:', error);
      return { success: false, error };
    }
  }

  /**
   * Get cycle by ID
   */
  async getCycleById(cycleId: string) {
    try {
      const { data: cycle, error } = await this.supabase
        .from('machine_cycles')
        .select('*')
        .eq('id', cycleId)
        .single();

      if (error) throw error;
      return { success: true, data: cycle };
    } catch (error) {
      console.error('Error fetching cycle:', error);
      return { success: false, error };
    }
  }
}

export const machineCyclesService = new MachineCyclesService();
