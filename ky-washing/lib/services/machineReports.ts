'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Machine Reports Service
 * Handles 'Report No One' and 'Machine is Ready' features
 */

export interface MachineReport {
  id: string;
  machine_id: number;
  machine_type: 'washer' | 'dryer';
  report_type: 'no_one' | 'ready';
  reported_by: string;
  reported_at: string;
  status: 'active' | 'resolved';
}

export interface MachineReportCount {
  machine_id: number;
  machine_type: 'washer' | 'dryer';
  no_one_count: number;
  ready_count: number;
  last_updated: string;
}

export class MachineReportsService {
  private supabase = createClient();

  /**
   * Add a 'No One' report for a machine
   * Increments counter and returns current count
   */
  async addNoOneReport(machineId: number, machineType: 'washer' | 'dryer', reportedBy: string) {
    try {
      // Create report record
      const { data: report, error: reportError } = await this.supabase
        .from('machine_reports')
        .insert({
          machine_id: machineId,
          machine_type: machineType,
          report_type: 'no_one',
          reported_by: reportedBy,
          reported_at: new Date().toISOString(),
          status: 'active',
        })
        .select()
        .single();

      if (reportError) throw reportError;

      // Get current count
      const count = await this.getNoOneReportCount(machineId, machineType);
      
      return { success: true, data: report, count };
    } catch (error) {
      console.error('Error adding no-one report:', error);
      return { success: false, error };
    }
  }

  /**
   * Get the number of active 'No One' reports for a machine
   */
  async getNoOneReportCount(machineId: number, machineType: 'washer' | 'dryer') {
    try {
      const { data, error } = await this.supabase
        .from('machine_reports')
        .select('id')
        .eq('machine_id', machineId)
        .eq('machine_type', machineType)
        .eq('report_type', 'no_one')
        .eq('status', 'active');

      if (error) throw error;
      
      return { success: true, count: data?.length || 0 };
    } catch (error) {
      console.error('Error getting no-one report count:', error);
      return { success: false, error, count: 0 };
    }
  }

  /**
   * Resolve all 'No One' reports for a machine
   * Called when machine is reset after 2 reports threshold
   */
  async resolveNoOneReports(machineId: number, machineType: 'washer' | 'dryer') {
    try {
      const { data, error } = await this.supabase
        .from('machine_reports')
        .update({ status: 'resolved' })
        .eq('machine_id', machineId)
        .eq('machine_type', machineType)
        .eq('report_type', 'no_one')
        .select();

      if (error) throw error;
      
      return { success: true, data };
    } catch (error) {
      console.error('Error resolving no-one reports:', error);
      return { success: false, error };
    }
  }

  /**
   * Add a 'Machine is Ready' report
   * Used when other users confirm machine is ready for collection/use
   */
  async addMachineReadyReport(machineId: number, machineType: 'washer' | 'dryer', reportedBy: string) {
    try {
      const { data: report, error } = await this.supabase
        .from('machine_reports')
        .insert({
          machine_id: machineId,
          machine_type: machineType,
          report_type: 'ready',
          reported_by: reportedBy,
          reported_at: new Date().toISOString(),
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, data: report };
    } catch (error) {
      console.error('Error adding machine-ready report:', error);
      return { success: false, error };
    }
  }

  /**
   * Get machine ready reports
   */
  async getMachineReadyReports(machineId: number, machineType: 'washer' | 'dryer') {
    try {
      const { data, error } = await this.supabase
        .from('machine_reports')
        .select('*')
        .eq('machine_id', machineId)
        .eq('machine_type', machineType)
        .eq('report_type', 'ready')
        .eq('status', 'active')
        .order('reported_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      return { success: true, data: data?.[0] || null };
    } catch (error) {
      console.error('Error getting machine-ready reports:', error);
      return { success: false, error };
    }
  }

  /**
   * Resolve a machine ready report
   */
  async resolveMachineReadyReport(reportId: string) {
    try {
      const { data, error } = await this.supabase
        .from('machine_reports')
        .update({ status: 'resolved' })
        .eq('id', reportId)
        .select()
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error resolving machine-ready report:', error);
      return { success: false, error };
    }
  }

  /**
   * Clear all reports for a machine
   */
  async clearMachineReports(machineId: number, machineType: 'washer' | 'dryer') {
    try {
      const { data, error } = await this.supabase
        .from('machine_reports')
        .update({ status: 'resolved' })
        .eq('machine_id', machineId)
        .eq('machine_type', machineType)
        .eq('status', 'active')
        .select();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error('Error clearing machine reports:', error);
      return { success: false, error };
    }
  }
}

export const machineReportsService = new MachineReportsService();
