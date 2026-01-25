export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          student_id: string;
          phone_number: string | null;
          full_name: string | null;
          profile_picture_url: string | null;
          created_at: string;
          updated_at: string;
          last_login: string | null;
          is_active: boolean;
          notification_preferences: Record<string, any> | null;
        };
        Insert: {
          id: string;
          email: string;
          student_id: string;
          phone_number?: string | null;
          full_name?: string | null;
          profile_picture_url?: string | null;
          created_at?: string;
          updated_at?: string;
          last_login?: string | null;
          is_active?: boolean;
          notification_preferences?: Record<string, any> | null;
        };
        Update: {
          email?: string;
          student_id?: string;
          phone_number?: string | null;
          full_name?: string | null;
          profile_picture_url?: string | null;
          updated_at?: string;
          last_login?: string | null;
          is_active?: boolean;
          notification_preferences?: Record<string, any> | null;
        };
      };
      machines: {
        Row: {
          id: number;
          machine_id: string;
          name: string;
          type: 'washer' | 'dryer';
          location: string | null;
          status: string;
          current_user_id: string | null;
          cycle_start_time: string | null;
          cycle_end_time: string | null;
          estimated_time_remaining: number;
          default_cycle_duration: number;
          has_issues: boolean;
          issue_description: string | null;
          maintenance_scheduled_at: string | null;
          last_maintenance: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          machine_id: string;
          name: string;
          type: 'washer' | 'dryer';
          location?: string | null;
          status?: string;
          current_user_id?: string | null;
          cycle_start_time?: string | null;
          cycle_end_time?: string | null;
          estimated_time_remaining?: number;
          default_cycle_duration: number;
          has_issues?: boolean;
          issue_description?: string | null;
          maintenance_scheduled_at?: string | null;
          last_maintenance?: string | null;
        };
        Update: {
          status?: string;
          current_user_id?: string | null;
          cycle_start_time?: string | null;
          cycle_end_time?: string | null;
          estimated_time_remaining?: number;
          has_issues?: boolean;
          issue_description?: string | null;
          updated_at?: string;
        };
      };
      machine_cycles: {
        Row: {
          id: string;
          machine_id: number;
          user_id: string;
          machine_name: string;
          machine_type: 'washer' | 'dryer';
          cycle_mode: string | null;
          start_time: string;
          end_time: string | null;
          duration_minutes: number | null;
          status: string;
          energy_used: number | null;
          water_used: number | null;
          cost: number | null;
          completion_time: string | null;
          collection_time: string | null;
          was_collected: boolean;
          cycle_data: Record<string, any> | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          machine_id: number;
          user_id: string;
          machine_name: string;
          machine_type: 'washer' | 'dryer';
          cycle_mode?: string | null;
          start_time?: string;
          end_time?: string | null;
          duration_minutes?: number | null;
          status?: string;
          energy_used?: number | null;
          water_used?: number | null;
          cost?: number | null;
          completion_time?: string | null;
          collection_time?: string | null;
          was_collected?: boolean;
          cycle_data?: Record<string, any> | null;
          notes?: string | null;
        };
        Update: {
          status?: string;
          end_time?: string | null;
          duration_minutes?: number | null;
          cost?: number | null;
          completion_time?: string | null;
          collection_time?: string | null;
          was_collected?: boolean;
          updated_at?: string;
        };
      };
      analytics_events: {
        Row: {
          id: string;
          user_id: string | null;
          event_type: string;
          event_name: string | null;
          category: string | null;
          action: string | null;
          label: string | null;
          value: number | null;
          session_id: string | null;
          page_path: string | null;
          page_title: string | null;
          referrer: string | null;
          user_agent: string | null;
          ip_address: string | null;
          event_data: Record<string, any> | null;
          timestamp: string;
          created_at: string;
        };
        Insert: {
          user_id?: string | null;
          event_type: string;
          event_name?: string | null;
          category?: string | null;
          action?: string | null;
          label?: string | null;
          value?: number | null;
          session_id?: string | null;
          page_path?: string | null;
          page_title?: string | null;
          referrer?: string | null;
          user_agent?: string | null;
          ip_address?: string | null;
          event_data?: Record<string, any> | null;
          timestamp?: string;
        };
        Update: {
          event_data?: Record<string, any> | null;
        };
      };
      user_sessions: {
        Row: {
          id: string;
          user_id: string;
          session_id: string;
          login_time: string;
          logout_time: string | null;
          session_duration: number | null;
          ip_address: string | null;
          user_agent: string | null;
          device_type: string | null;
          browser: string | null;
          os: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          session_id: string;
          login_time?: string;
          logout_time?: string | null;
          session_duration?: number | null;
          ip_address?: string | null;
          user_agent?: string | null;
          device_type?: string | null;
          browser?: string | null;
          os?: string | null;
          status?: string;
        };
        Update: {
          logout_time?: string | null;
          session_duration?: number | null;
          status?: string;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          notification_type: string;
          title: string;
          message: string;
          related_entity_type: string | null;
          related_entity_id: string | null;
          priority: string;
          is_read: boolean;
          read_at: string | null;
          action_url: string | null;
          notification_channel: string;
          sent_at: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          notification_type: string;
          title: string;
          message: string;
          related_entity_type?: string | null;
          related_entity_id?: string | null;
          priority?: string;
          is_read?: boolean;
          read_at?: string | null;
          action_url?: string | null;
          notification_channel?: string;
          sent_at?: string;
        };
        Update: {
          is_read?: boolean;
          read_at?: string | null;
        };
      };
      auto_unlock_timers: {
        Row: {
          id: string;
          machine_id: number;
          user_id: string;
          cycle_id: string | null;
          unlock_scheduled_time: string;
          unlock_reason: string | null;
          grace_period_minutes: number;
          alert_interval_seconds: number;
          alert_count: number;
          unlocked_at: string | null;
          manually_collected: boolean;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          machine_id: number;
          user_id: string;
          cycle_id?: string | null;
          unlock_scheduled_time: string;
          unlock_reason?: string | null;
          grace_period_minutes?: number;
          alert_interval_seconds?: number;
          alert_count?: number;
          unlocked_at?: string | null;
          manually_collected?: boolean;
          status?: string;
        };
        Update: {
          status?: string;
          unlocked_at?: string | null;
          manually_collected?: boolean;
          updated_at?: string;
        };
      };
      machine_queue: {
        Row: {
          id: string;
          machine_id: number;
          user_id: string;
          queue_position: number;
          joined_at: string;
          estimated_wait_time: number | null;
          notified_at: string | null;
          notification_sent: boolean;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          machine_id: number;
          user_id: string;
          queue_position: number;
          joined_at?: string;
          estimated_wait_time?: number | null;
          notified_at?: string | null;
          notification_sent?: boolean;
          status?: string;
        };
        Update: {
          queue_position?: number;
          status?: string;
          notification_sent?: boolean;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          machine_cycle_id: string | null;
          transaction_type: string;
          amount: number;
          currency: string;
          description: string | null;
          machine_id: number | null;
          machine_type: string | null;
          cycle_duration: number | null;
          payment_method: string | null;
          reference_id: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          machine_cycle_id?: string | null;
          transaction_type: string;
          amount: number;
          currency?: string;
          description?: string | null;
          machine_id?: number | null;
          machine_type?: string | null;
          cycle_duration?: number | null;
          payment_method?: string | null;
          reference_id?: string | null;
          status?: string;
        };
        Update: {
          status?: string;
          updated_at?: string;
        };
      };
      analytics_summary: {
        Row: {
          id: string;
          date_hour: string;
          hour: number | null;
          day_of_week: number | null;
          total_active_machines: number | null;
          total_users: number | null;
          washer_count: number | null;
          dryer_count: number | null;
          average_queue_length: number | null;
          average_wait_time_minutes: number | null;
          peak_usage_percent: number | null;
          total_cycles_completed: number | null;
          total_revenue: number | null;
          machine_details: Record<string, any> | null;
          created_at: string;
        };
        Insert: {
          date_hour: string;
          hour?: number | null;
          day_of_week?: number | null;
          total_active_machines?: number | null;
          total_users?: number | null;
          washer_count?: number | null;
          dryer_count?: number | null;
          average_queue_length?: number | null;
          average_wait_time_minutes?: number | null;
          peak_usage_percent?: number | null;
          total_cycles_completed?: number | null;
          total_revenue?: number | null;
          machine_details?: Record<string, any> | null;
        };
        Update: Record<string, never>;
      };
    };
    Views: Record<string, unknown>;
    Functions: Record<string, unknown>;
    Enums: Record<string, unknown>;
  };
};
