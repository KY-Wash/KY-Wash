import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Initialize Supabase client only if credentials are available
let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    supabaseInstance = createClient(supabaseUrl, supabaseAnonKey);
    return supabaseInstance;
  }

  return null;
}

export const supabase = getSupabaseClient();

// Type definitions for database tables
export interface UsageRecord {
  id?: string;
  student_id: string;
  phone_number: string;
  machine_type: 'washer' | 'dryer';
  machine_id: number;
  mode: string;
  duration: number;
  spending: number;
  status: 'In Progress' | 'Completed' | 'cancelled';
  date: string;
  timestamp: number;
  created_at?: string;
  updated_at?: string;
}

// Insert or update usage history to Supabase
export const insertUsageRecord = async (record: UsageRecord) => {
  try {
    const client = getSupabaseClient();
    if (!client) {
      console.warn('Supabase credentials not configured. Skipping database sync.');
      return null;
    }

    const { data, error } = await client
      .from('usage_history')
      .insert([{
        student_id: record.student_id,
        phone_number: record.phone_number,
        machine_type: record.machine_type,
        machine_id: record.machine_id,
        mode: record.mode,
        duration: record.duration,
        spending: record.spending,
        status: record.status,
        date: record.date,
        timestamp: record.timestamp,
      }]);

    if (error) {
      console.error('Error inserting usage record:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception inserting usage record:', error);
    return null;
  }
};

// Update usage record status (e.g., from 'In Progress' to 'Completed')
export const updateUsageRecordStatus = async (recordId: string, status: 'Completed' | 'cancelled') => {
  try {
    const client = getSupabaseClient();
    if (!client) {
      console.warn('Supabase credentials not configured. Skipping database sync.');
      return null;
    }

    const { data, error } = await client
      .from('usage_history')
      .update({ status: status })
      .eq('id', recordId);

    if (error) {
      console.error('Error updating usage record:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception updating usage record:', error);
    return null;
  }
};

// Fetch usage history for a specific student
export const fetchUserUsageHistory = async (studentId: string) => {
  try {
    const client = getSupabaseClient();
    if (!client) {
      console.warn('Supabase credentials not configured. Skipping database fetch.');
      return [];
    }

    const { data, error } = await client
      .from('usage_history')
      .select('*')
      .eq('student_id', studentId)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching user usage history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching user usage history:', error);
    return [];
  }
};

// Fetch all usage history (for admin)
export const fetchAllUsageHistory = async () => {
  try {
    const client = getSupabaseClient();
    if (!client) {
      console.warn('Supabase credentials not configured. Skipping database fetch.');
      return [];
    }

    const { data, error } = await client
      .from('usage_history')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching all usage history:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching all usage history:', error);
    return [];
  }
};

// Delete usage record by ID
export const deleteUsageRecord = async (recordId: string) => {
  try {
    const client = getSupabaseClient();
    if (!client) {
      console.warn('Supabase credentials not configured. Skipping database delete.');
      return null;
    }

    const { data, error } = await client
      .from('usage_history')
      .delete()
      .eq('id', recordId);

    if (error) {
      console.error('Error deleting usage record:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Exception deleting usage record:', error);
    return null;
  }
};
