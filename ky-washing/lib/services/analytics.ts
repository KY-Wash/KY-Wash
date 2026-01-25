'use client';

import { createClient } from '../supabase/client';

export interface AnalyticsEventInput {
  user_id?: string;
  event_type: string;
  event_name?: string;
  category?: string;
  action?: string;
  label?: string;
  value?: number;
  session_id?: string;
  page_path?: string;
  event_data?: Record<string, any>;
}

/**
 * Analytics Service
 * Handles all analytics event tracking and retrieval
 */
export class AnalyticsService {
  private supabase = createClient();

  /**
   * Track an analytics event
   */
  async trackEvent(data: AnalyticsEventInput) {
    try {
      const { error } = await this.supabase
        .from('analytics_events')
        .insert({
          user_id: data.user_id,
          event_type: data.event_type,
          event_name: data.event_name,
          category: data.category,
          action: data.action,
          label: data.label,
          value: data.value,
          session_id: data.session_id,
          page_path: data.page_path,
          event_data: data.event_data || {},
          timestamp: new Date().toISOString(),
        });

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error tracking analytics event:', error);
      return { success: false, error };
    }
  }

  /**
   * Track machine event
   */
  async trackMachineEvent(
    eventType: 'start' | 'complete' | 'cancel' | 'collect',
    machineId: number,
    userId: string,
    data?: Record<string, any>
  ) {
    return this.trackEvent({
      user_id: userId,
      event_type: 'machine_action',
      event_name: `machine_${eventType}`,
      category: 'Machine',
      action: eventType,
      label: `machine-${machineId}`,
      event_data: data,
    });
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(userId: string) {
    try {
      const { data: events, error } = await this.supabase
        .from('analytics_events')
        .select('*')
        .eq('user_id', userId)
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;

      // Process events to calculate metrics
      const eventsByType: Record<string, number> = {};
      events?.forEach((event) => {
        eventsByType[event.event_type] = (eventsByType[event.event_type] || 0) + 1;
      });

      return {
        success: true,
        data: {
          totalEvents: events?.length || 0,
          eventsByType,
          recentEvents: events,
        },
      };
    } catch (error) {
      console.error('Error fetching user analytics:', error);
      return { success: false, error };
    }
  }

  /**
   * Get analytics summary for a date
   */
  async getAnalyticsSummary(date?: string) {
    try {
      const startDate = date || new Date().toISOString().split('T')[0];

      const { data: summary, error } = await this.supabase
        .from('analytics_summary')
        .select('*')
        .like('date_hour', `${startDate}%`)
        .order('date_hour', { ascending: true });

      if (error) throw error;
      return { success: true, data: summary };
    } catch (error) {
      console.error('Error fetching analytics summary:', error);
      return { success: false, error };
    }
  }

  /**
   * Get peak hours
   */
  async getPeakHours(limit: number = 5) {
    try {
      const { data: summary, error } = await this.supabase
        .from('analytics_summary')
        .select('hour, total_cycles_completed, average_queue_length')
        .order('total_cycles_completed', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { success: true, data: summary };
    } catch (error) {
      console.error('Error fetching peak hours:', error);
      return { success: false, error };
    }
  }
}

export const analyticsService = new AnalyticsService();
