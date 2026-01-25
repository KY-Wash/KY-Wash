'use client';

import { createClient } from '../supabase/client';

export interface UserSessionInput {
  user_id: string;
  session_id: string;
  ip_address?: string;
  user_agent?: string;
  device_type?: string;
}

/**
 * User Sessions Service
 * Handles session tracking and management
 */
export class UserSessionsService {
  private supabase = createClient();

  /**
   * Create a new user session
   */
  async startSession(data: UserSessionInput) {
    try {
      const { data: session, error } = await this.supabase
        .from('user_sessions')
        .insert({
          user_id: data.user_id,
          session_id: data.session_id,
          ip_address: data.ip_address,
          user_agent: data.user_agent,
          device_type: data.device_type,
          login_time: new Date().toISOString(),
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;

      // Update user last_login
      await this.supabase
        .from('users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.user_id);

      return { success: true, data: session };
    } catch (error) {
      console.error('Error starting session:', error);
      return { success: false, error };
    }
  }

  /**
   * End a user session
   */
  async endSession(sessionId: string) {
    try {
      const now = new Date().toISOString();
      
      const { data: session, error } = await this.supabase
        .from('user_sessions')
        .update({
          logout_time: now,
          status: 'logged_out',
        })
        .eq('session_id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data: session };
    } catch (error) {
      console.error('Error ending session:', error);
      return { success: false, error };
    }
  }

  /**
   * Get user's active sessions
   */
  async getUserActiveSessions(userId: string) {
    try {
      const { data: sessions, error } = await this.supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('login_time', { ascending: false });

      if (error) throw error;
      return { success: true, data: sessions };
    } catch (error) {
      console.error('Error fetching active sessions:', error);
      return { success: false, error };
    }
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string) {
    try {
      const { data: session, error } = await this.supabase
        .from('user_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error) throw error;
      return { success: true, data: session };
    } catch (error) {
      console.error('Error fetching session:', error);
      return { success: false, error };
    }
  }
}

export const userSessionsService = new UserSessionsService();
