# Environment Setup Guide

## Google Analytics Setup

### 1. Create a Google Analytics Account

1. Go to [Google Analytics](https://analytics.google.com/)
2. Sign in with your Google account
3. Click "Create" to set up a new property
4. Choose "Web" as the platform
5. Enter your website details:
   - Website name: KY-Wash
   - Website URL: your-domain.com
   - Industry category: Laundry & Dry Cleaning
6. Accept the service agreement and create the property

### 2. Get Your Measurement ID

1. In Google Analytics, go to Admin (gear icon)
2. Under "Property", click "Data Streams"
3. Click on your web stream
4. Copy the "Measurement ID" (starts with G-)

### 3. Add to Environment Variables

Create or update your `.env.local` file in the `ky-washing` directory:

```bash
# Google Analytics
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

The `NEXT_PUBLIC_` prefix is important - it makes the variable available in the browser.

### 4. Verify Installation

1. Start your development server: `npm run dev`
2. Open your website
3. Open DevTools (F12) → Network tab
4. Look for requests to `googletagmanager.com`
5. Go to Google Analytics → Real Time → Overview
6. You should see your visit recorded

## Testing Tracking

The analytics system automatically tracks:
- Page views
- User engagement
- Custom events (machine usage, cycles, etc.)

You can trigger custom events in your code:

```typescript
import { trackEvent } from '@/lib/dataCollection';

trackEvent('event_name', {
  customParam: 'value',
  machineId: 'W1',
});
```

## Machine Auto-Unlock Setup

The timer system is configured with:
- **Default unlock time**: 15 minutes after cycle completion
- **Ring notification**: Once when cycle completes
- **Continuous alert**: Rings every 30 seconds until user acknowledges

To customize, edit [`lib/machineAutoUnlock.ts`](lib/machineAutoUnlock.ts):

```typescript
const UNLOCK_DELAY_MS = 15 * 60 * 1000; // 15 minutes
const ALERT_INTERVAL_MS = 30 * 1000; // Every 30 seconds
```

## Data Collection Architecture

### Event Tracking Flow

1. **User Action** → Machine started, clothes collected, etc.
2. **trackEvent()** → Logs event locally and to Google Analytics
3. **getAnalytics()** → Retrieves event history for dashboard
4. **AnalyticsService** → Processes raw events into insights

### Example Implementation

```typescript
import { useDataCollection } from '@/lib/dataCollection';

export function MyComponent() {
  const { trackEvent } = useDataCollection();

  const handleAction = () => {
    trackEvent('machine_started', {
      machineId: 'W1',
      machineType: 'washer',
      timestamp: new Date().toISOString(),
    });
  };

  return <button onClick={handleAction}>Start</button>;
}
```

## Notifications System

### Notification Types

1. **Ring Notification** (Single Ring)
   ```typescript
   import { ringNotification } from '@/lib/enhancedNotifications';
   ringNotification('Cycle completed!');
   ```

2. **Alert Notification** (Continuous)
   ```typescript
   import { alertNotification } from '@/lib/enhancedNotifications';
   alertNotification('Time to collect clothes!');
   ```

### Browser Permissions

Users need to grant notification permissions. The system handles this automatically on first use.

## Dashboard Navigation

Add these routes to your navigation:

- `/machines` - Machine management and real-time monitoring
- `/analytics` - Usage analytics and insights
- `/protected` - User profile and protected content

## Troubleshooting

### Google Analytics Not Showing Data

1. Check Measurement ID is correct in `.env.local`
2. Verify `NEXT_PUBLIC_` prefix is present
3. Restart dev server after env changes
4. Check browser console for errors
5. Wait 24-48 hours for historical data to appear in Google Analytics

### Notifications Not Working

1. Ensure browser notification permission is granted
2. Check browser console for permission errors
3. Verify notification API is supported (works on HTTPS or localhost)
4. Test with simple alert first: `alert('Test')`

### Timer Not Counting Down

1. Check machine status updates in real-time
2. Verify `useEffect` dependencies in component
3. Check browser console for errors
4. Ensure time calculations are correct (in milliseconds)

## Next Steps

1. Connect to real machine API
2. Replace mock data with actual database queries
3. Set up Supabase for persistent storage
4. Configure Supabase realtime for live updates
5. Deploy to production with proper environment variables
