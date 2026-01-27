// Data Optimization Guide for Supabase
// This guide explains what data is essential and how to optimize storage

/*
 * CURRENT DATA COLLECTION ISSUES
 * ==============================
 * 
 * If user data is not being logged to Supabase, it could be due to:
 * 1. Too many unnecessary variables being tracked
 * 2. Storage quota exceeded
 * 3. Network issues or API rate limiting
 * 4. Missing or invalid user ID
 * 5. Incomplete records with too much metadata
 * 
 * SOLUTION: Only store ESSENTIAL data
 */

// ============================================================================
// ESSENTIAL DATA TO STORE
// ============================================================================

/*
 * 1. USER SESSIONS (Most Important)
 *    Why: Tracks who used the system and when
 *    Table: user_sessions
 *    Fields:
 *      - user_id (UUID) - PRIMARY KEY
 *      - session_id (string) - unique session identifier
 *      - login_time (timestamp)
 *      - logout_time (timestamp, nullable)
 *      - session_duration (integer, seconds)
 *      - device_type (string: 'mobile', 'tablet', 'desktop')
 */

/*
 * 2. MACHINE CYCLES (Most Important)
 *    Why: Core laundry machine usage data
 *    Table: machine_cycles
 *    Fields:
 *      - id (UUID) - PRIMARY KEY
 *      - machine_id (integer) - Which machine
 *      - machine_type (string: 'washer', 'dryer')
 *      - user_id (UUID) - Who used it
 *      - cycle_start_time (timestamp)
 *      - cycle_duration (integer, minutes)
 *      - cycle_end_time (timestamp, nullable)
 *      - status (string: 'in-progress', 'completed', 'collected')
 */

/*
 * 3. MACHINE REPORTS (Important)
 *    Why: Tracks "No One" reports and machine ready confirmations
 *    Table: machine_reports
 *    Fields:
 *      - id (UUID) - PRIMARY KEY
 *      - machine_id (integer)
 *      - machine_type (string)
 *      - report_type (string: 'no_one', 'ready')
 *      - reported_by (string) - user ID
 *      - reported_at (timestamp)
 *      - status (string: 'active', 'resolved')
 */

// ============================================================================
// NON-ESSENTIAL DATA TO SKIP
// ============================================================================

/*
 * AVOID storing (unless explicitly needed):
 * 
 * 1. User Agent String
 *    - Takes up storage space
 *    - Device type is sufficient
 * 
 * 2. Full browser capabilities
 *    - Device type covers this
 * 
 * 3. Queue wait times (calculate in analytics instead)
 *    - Expensive to store, easy to compute
 * 
 * 4. Detailed notification times
 *    - Only store if needed for audit
 * 
 * 5. Duplicate timestamp data
 *    - Database auto-timestamps
 *    - Don't store in application layer
 * 
 * 6. Redundant session data
 *    - Use query joins instead
 *    - Avoid denormalization
 */

// ============================================================================
// OPTIMIZED IMPLEMENTATION
// ============================================================================

import { createClient } from '../supabase/client';

export class OptimizedDataCollectionService {
  private supabase = createClient();
  private userId?: string;

  // OPTIMIZED: Only essential fields
  async recordUserLogin(userId: string, deviceType?: string): Promise<void> {
    try {
      this.userId = userId;

      await this.supabase.from('user_sessions').insert({
        user_id: userId,
        session_id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        login_time: new Date().toISOString(),
        device_type: deviceType || this.getDeviceType(),
        // Skip: user_agent, capabilities, etc.
      });
    } catch (error) {
      console.error('Error recording user login:', error);
    }
  }

  // OPTIMIZED: Only essential fields
  async recordMachineUsage(
    machineId: number,
    machineType: 'washer' | 'dryer',
    durationMinutes: number
  ): Promise<string | null> {
    try {
      if (!this.userId) return null;

      const { data, error } = await this.supabase
        .from('machine_cycles')
        .insert({
          machine_id: machineId,
          machine_type: machineType,
          user_id: this.userId,
          cycle_start_time: new Date().toISOString(),
          cycle_duration: durationMinutes,
          status: 'in-progress',
          // Skip: queue wait time, notification times, etc.
        })
        .select('id')
        .single();

      if (error) throw error;
      return data?.id || null;
    } catch (error) {
      console.error('Error recording machine usage:', error);
      return null;
    }
  }

  // OPTIMIZED: Only mark as completed, no extra data
  async completeMachineUsage(cycleId: string): Promise<void> {
    try {
      await this.supabase
        .from('machine_cycles')
        .update({
          status: 'completed',
          cycle_end_time: new Date().toISOString(),
        })
        .eq('id', cycleId);
    } catch (error) {
      console.error('Error completing machine usage:', error);
    }
  }

  // OPTIMIZED: Just mark as collected
  async markAsCollected(cycleId: string): Promise<void> {
    try {
      await this.supabase
        .from('machine_cycles')
        .update({ status: 'collected' })
        .eq('id', cycleId);
    } catch (error) {
      console.error('Error marking as collected:', error);
    }
  }

  // OPTIMIZED: Only essential fields
  async recordUserLogout(userId: string, sessionId: string): Promise<void> {
    try {
      const { data: session } = await this.supabase
        .from('user_sessions')
        .select('login_time')
        .eq('session_id', sessionId)
        .single();

      if (session) {
        const loginTime = new Date(session.login_time).getTime();
        const logoutTime = Date.now();
        const duration = Math.floor((logoutTime - loginTime) / 1000);

        await this.supabase
          .from('user_sessions')
          .update({
            logout_time: new Date().toISOString(),
            session_duration: duration,
          })
          .eq('session_id', sessionId);
      }
    } catch (error) {
      console.error('Error recording user logout:', error);
    }
  }

  private getDeviceType(): string {
    if (typeof navigator === 'undefined') return 'unknown';
    
    if (/mobile|android|iphone/i.test(navigator.userAgent)) return 'mobile';
    if (/tablet|ipad/i.test(navigator.userAgent)) return 'tablet';
    return 'desktop';
  }
}

export const optimizedDataCollectionService = new OptimizedDataCollectionService();

// ============================================================================
// MIGRATION GUIDE
// ============================================================================

/*
 * If you're currently storing too much data:
 * 
 * 1. Identify unnecessary columns in your Supabase tables
 * 2. Create a migration to add new minimal tables (if needed)
 * 3. Update all data collection calls to use only essential fields
 * 4. Archive old data if needed
 * 5. Delete unused columns after migration
 * 
 * Example query to find storage-heavy records:
 * 
 * SELECT 
 *   table_name,
 *   COUNT(*) as record_count,
 *   pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
 * FROM pg_tables
 * WHERE schemaname = 'public'
 * GROUP BY table_name, schemaname
 * ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
 */

// ============================================================================
// BEST PRACTICES
// ============================================================================

/*
 * 1. Store only calculated/derived data rarely
 *    Instead: Calculate on-demand using database queries
 * 
 * 2. Use appropriate data types
 *    - INTEGER not TEXT for numbers
 *    - TIMESTAMP not STRING for dates
 *    - BOOLEAN not STRING for true/false
 * 
 * 3. Normalize data
 *    - Don't repeat user info on every cycle record
 *    - Use foreign keys and joins
 * 
 * 4. Archive old data
 *    - Move data > 1 year old to archive tables
 *    - Speeds up queries on live data
 * 
 * 5. Index strategically
 *    - Index user_id (frequently queried)
 *    - Index machine_id (frequently filtered)
 *    - Index timestamps (range queries)
 * 
 * 6. Monitor storage usage
 *    - Set up alerts for quota
 *    - Regular cleanup of orphaned records
 * 
 * 7. Use RLS (Row Level Security)
 *    - Only let users see their own data
 *    - Reduces attack surface
 */
