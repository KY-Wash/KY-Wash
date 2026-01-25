'use client';

import { createClient } from '../supabase/client';

export interface NotificationInput {
  user_id: string;
  notification_type: string;
  title: string;
  message: string;
  related_entity_type?: string;
  related_entity_id?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  action_url?: string;
}

/**
 * Notifications Service
 * Handles notification creation and management
 */
export class NotificationsService {
  private supabase = createClient();

  /**
   * Create a notification
   */
  async createNotification(data: NotificationInput) {
    try {
      const { data: notification, error } = await this.supabase
        .from('notifications')
        .insert({
          user_id: data.user_id,
          notification_type: data.notification_type,
          title: data.title,
          message: data.message,
          related_entity_type: data.related_entity_type,
          related_entity_id: data.related_entity_id,
          priority: data.priority || 'normal',
          action_url: data.action_url,
          sent_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: notification };
    } catch (error) {
      console.error('Error creating notification:', error);
      return { success: false, error };
    }
  }

  /**
   * Get user's unread notifications
   */
  async getUnreadNotifications(userId: string) {
    try {
      const { data: notifications, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('is_read', false)
        .order('sent_at', { ascending: false });

      if (error) throw error;
      return { success: true, data: notifications };
    } catch (error) {
      console.error('Error fetching unread notifications:', error);
      return { success: false, error };
    }
  }

  /**
   * Get all user notifications
   */
  async getUserNotifications(userId: string, limit: number = 50) {
    try {
      const { data: notifications, error } = await this.supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('sent_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return { success: true, data: notifications };
    } catch (error) {
      console.error('Error fetching notifications:', error);
      return { success: false, error };
    }
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string) {
    try {
      const { data: notification, error } = await this.supabase
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString(),
        })
        .eq('id', notificationId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: notification };
    } catch (error) {
      console.error('Error marking notification as read:', error);
      return { success: false, error };
    }
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId: string) {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting notification:', error);
      return { success: false, error };
    }
  }
}

export const notificationsService = new NotificationsService();
