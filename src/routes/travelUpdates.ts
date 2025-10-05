import express from 'express';
import { travelUpdateService } from '../services/travelUpdateService';
import { ApiResponse } from '../types';

const router = express.Router();

/**
 * POST /api/travel-updates/monitor-flights
 * Manually trigger flight monitoring (for testing/admin)
 */
router.post('/monitor-flights', async (req, res) => {
  try {
    await travelUpdateService.monitorFlightChanges();

    const response: ApiResponse = {
      success: true,
      message: 'Flight monitoring completed successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Flight monitoring error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Monitoring failed',
      message: error instanceof Error ? error.message : 'Unable to monitor flights'
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/travel-updates/schedule-reminders
 * Manually trigger reminder scheduling (for testing/admin)
 */
router.post('/schedule-reminders', async (req, res) => {
  try {
    await travelUpdateService.scheduleTravelReminders();

    const response: ApiResponse = {
      success: true,
      message: 'Travel reminders scheduled successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Reminder scheduling error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Scheduling failed',
      message: error instanceof Error ? error.message : 'Unable to schedule reminders'
    };

    res.status(500).json(response);
  }
});

/**
 * POST /api/travel-updates/process-reminders
 * Manually trigger reminder processing (for testing/admin)
 */
router.post('/process-reminders', async (req, res) => {
  try {
    await travelUpdateService.processDueReminders();

    const response: ApiResponse = {
      success: true,
      message: 'Due reminders processed successfully'
    };

    res.json(response);
  } catch (error) {
    console.error('Reminder processing error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Processing failed',
      message: error instanceof Error ? error.message : 'Unable to process reminders'
    };

    res.status(500).json(response);
  }
});

/**
 * GET /api/travel-updates/status
 * Get travel update service status
 */
router.get('/status', async (req, res) => {
  try {
    // Get some basic statistics about the travel update service
    const response: ApiResponse = {
      success: true,
      data: {
        status: 'active',
        lastMonitoring: new Date().toISOString(),
        features: [
          'flight_change_monitoring',
          'travel_reminders',
          'rebooking_assistance',
          'notification_system'
        ]
      },
      message: 'Travel update service is active'
    };

    res.json(response);
  } catch (error) {
    console.error('Status check error:', error);
    
    const response: ApiResponse = {
      success: false,
      error: 'Status check failed',
      message: 'Unable to get service status'
    };

    res.status(500).json(response);
  }
});

export default router;