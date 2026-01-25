'use client';

import { createClient } from '../supabase/client';

export interface MachineInput {
  machine_id: string;
  name: string;
  type: 'washer' | 'dryer';
  location?: string;
  default_cycle_duration: number;
}

/**
 * Machines Service
 * Handles machine inventory and status management
 */
export class MachinesService {
  private supabase = createClient();

  /**
   * Get all machines
   */
  async getAllMachines() {
    try {
      const { data: machines, error } = await this.supabase
        .from('machines')
        .select('*')
        .order('machine_id', { ascending: true });

      if (error) throw error;
      return { success: true, data: machines };
    } catch (error) {
      console.error('Error fetching machines:', error);
      return { success: false, error };
    }
  }

  /**
   * Get machines by type
   */
  async getMachinesByType(type: 'washer' | 'dryer') {
    try {
      const { data: machines, error } = await this.supabase
        .from('machines')
        .select('*')
        .eq('type', type)
        .order('machine_id', { ascending: true });

      if (error) throw error;
      return { success: true, data: machines };
    } catch (error) {
      console.error('Error fetching machines by type:', error);
      return { success: false, error };
    }
  }

  /**
   * Get machine by ID
   */
  async getMachineById(machineId: number) {
    try {
      const { data: machine, error } = await this.supabase
        .from('machines')
        .select('*')
        .eq('id', machineId)
        .single();

      if (error) throw error;
      return { success: true, data: machine };
    } catch (error) {
      console.error('Error fetching machine:', error);
      return { success: false, error };
    }
  }

  /**
   * Get available machines
   */
  async getAvailableMachines() {
    try {
      const { data: machines, error } = await this.supabase
        .from('machines')
        .select('*')
        .eq('status', 'available')
        .order('machine_id', { ascending: true });

      if (error) throw error;
      return { success: true, data: machines };
    } catch (error) {
      console.error('Error fetching available machines:', error);
      return { success: false, error };
    }
  }

  /**
   * Update machine status
   */
  async updateMachineStatus(machineId: number, status: string) {
    try {
      const { data: machine, error } = await this.supabase
        .from('machines')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', machineId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: machine };
    } catch (error) {
      console.error('Error updating machine status:', error);
      return { success: false, error };
    }
  }

  /**
   * Create new machine
   */
  async createMachine(data: MachineInput) {
    try {
      const { data: machine, error } = await this.supabase
        .from('machines')
        .insert({
          machine_id: data.machine_id,
          name: data.name,
          type: data.type,
          location: data.location,
          default_cycle_duration: data.default_cycle_duration,
          status: 'available',
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: machine };
    } catch (error) {
      console.error('Error creating machine:', error);
      return { success: false, error };
    }
  }
}

export const machinesService = new MachinesService();
