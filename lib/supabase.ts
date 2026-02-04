import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Initialize Supabase client only if credentials are available
let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Support both common environment variable names used in various setups
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

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
  studentid: string;
  phone_number: string;
  type: 'washer' | 'dryer';
  machine_id: number;
  mode: string;
  duration: number;
  spending: number;
  status?: 'In Progress' | 'Completed' | 'cancelled';
  date: string;
  day: string;
  time: string;
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
        studentid: record.studentid,
        phone_number: record.phone_number,
        type: record.type,
        machine_id: record.machine_id,
        mode: record.mode,
        duration: record.duration,
        spending: record.spending,
        status: record.status,
        date: record.date,
        day: record.day,
        time: record.time,
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
      .eq('studentid', studentId)
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

// --- Service role client (server-side) ---
export const getServiceSupabaseClient = (): SupabaseClient | null => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) return null;
  return createClient(supabaseUrl, supabaseServiceKey);
};

export const insertChatMessageToDB = async (msg: { id?: string; studentId?: string; message: string; timestamp?: number }) => {
  try {
    const client = getServiceSupabaseClient();
    if (!client) {
      console.warn('Supabase service role not configured. Skipping chat persistence.');
      return null;
    }
    const payload = {
      student_id: msg.studentId || null,
      message: msg.message,
      created_at: new Date(msg.timestamp || Date.now()).toISOString(),
    };
    const { data, error } = await client.from('community_chat').insert([payload]);
    if (error) {
      console.error('Error inserting chat message:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Exception inserting chat message:', error);
    return null;
  }
};

export const deleteChatMessageFromDB = async (messageId: string) => {
  try {
    const client = getServiceSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.from('community_chat').delete().eq('id', messageId);
    if (error) {
      console.error('Error deleting chat message:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Exception deleting chat message:', error);
    return null;
  }
};

export const insertFeedbackToDB = async (fb: { studentId?: string; studentName?: string; message: string; rating?: number }) => {
  try {
    const client = getServiceSupabaseClient();
    if (!client) {
      console.warn('Supabase service role not configured. Skipping feedback persistence.');
      return null;
    }
    const payload = {
      user_id: null,
      student_id: fb.studentId || null,
      student_name: fb.studentName || null,
      message: fb.message,
      rating: fb.rating || null,
      status: 'open',
      created_at: new Date().toISOString(),
    };
    const { data, error } = await client.from('feedback_issues').insert([payload]);
    if (error) {
      console.error('Error inserting feedback:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Exception inserting feedback:', error);
    return null;
  }
};

export const markFeedbackDoneInDB = async (feedbackId: string) => {
  try {
    const client = getServiceSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.from('feedback_issues').update({ status: 'closed', resolved_at: new Date().toISOString() }).eq('id', feedbackId);
    if (error) {
      console.error('Error marking feedback done:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Exception marking feedback done:', error);
    return null;
  }
};

export const reportFeedbackInDB = async (feedbackId: string) => {
  try {
    const client = getServiceSupabaseClient();
    if (!client) return null;
    // Use select + update to increment the report_count safely (no DB function required)
    const sel = await client.from('feedback_issues').select('report_count, warnings').eq('id', feedbackId).maybeSingle();
    if (sel.error) {
      console.error('Error selecting feedback for report:', sel.error);
      return null;
    }

    const current = sel.data || { report_count: 0, warnings: 0 };
    const newCount = (current.report_count || 0) + 1;
    const newWarnings = (current.warnings || 0) === 0 && newCount >= 3 ? 1 : current.warnings || 0;
    const upd = await client.from('feedback_issues').update({ report_count: newCount, warnings: newWarnings }).eq('id', feedbackId);
    if (upd.error) {
      console.error('Error updating feedback report count:', upd.error);
      return null;
    }
    return upd;
  } catch (error) {
    console.error('Exception reporting feedback:', error);
    return null;
  }
};

export const deleteFeedbackFromDB = async (feedbackId: string) => {
  try {
    const client = getServiceSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.from('feedback_issues').delete().eq('id', feedbackId);
    if (error) {
      console.error('Error deleting feedback:', error);
      return null;
    }
    return data;
  } catch (error) {
    console.error('Exception deleting feedback:', error);
    return null;
  }
};