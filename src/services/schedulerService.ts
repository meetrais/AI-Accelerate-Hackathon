import { travelUpdateService } from './travelUpdateService';

export class SchedulerService {
  private intervals: NodeJS.Timeout[] = [];

  /**
   * Start all scheduled jobs
   */
  start(): void {
    console.log('🕐 Starting scheduler service...');

    // Monitor flights every 15 minutes
    const flightMonitoringInterval = setInterval(async () => {
      try {
        console.log('🔍 Running scheduled flight monitoring...');
        await travelUpdateService.monitorFlightChanges();
      } catch (error) {
        console.error('Scheduled flight monitoring error:', error);
      }
    }, 15 * 60 * 1000); // 15 minutes

    this.intervals.push(flightMonitoringInterval);

    // Schedule travel reminders every hour
    const reminderSchedulingInterval = setInterval(async () => {
      try {
        console.log('📅 Running scheduled reminder scheduling...');
        await travelUpdateService.scheduleTravelReminders();
      } catch (error) {
        console.error('Scheduled reminder scheduling error:', error);
      }
    }, 60 * 60 * 1000); // 1 hour

    this.intervals.push(reminderSchedulingInterval);

    // Process due reminders every 5 minutes
    const reminderProcessingInterval = setInterval(async () => {
      try {
        console.log('⏰ Processing due reminders...');
        await travelUpdateService.processDueReminders();
      } catch (error) {
        console.error('Scheduled reminder processing error:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    this.intervals.push(reminderProcessingInterval);

    console.log('✅ Scheduler service started with 3 background jobs');
  }

  /**
   * Stop all scheduled jobs
   */
  stop(): void {
    console.log('🛑 Stopping scheduler service...');
    
    this.intervals.forEach(interval => {
      clearInterval(interval);
    });
    
    this.intervals = [];
    console.log('✅ Scheduler service stopped');
  }

  /**
   * Get scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    activeJobs: number;
    jobs: Array<{
      name: string;
      interval: string;
      description: string;
    }>;
  } {
    return {
      isRunning: this.intervals.length > 0,
      activeJobs: this.intervals.length,
      jobs: [
        {
          name: 'flight_monitoring',
          interval: '15 minutes',
          description: 'Monitor flights for changes and notify passengers'
        },
        {
          name: 'reminder_scheduling',
          interval: '1 hour',
          description: 'Schedule travel reminders for upcoming bookings'
        },
        {
          name: 'reminder_processing',
          interval: '5 minutes',
          description: 'Process and send due travel reminders'
        }
      ]
    };
  }
}

// Export singleton instance
export const schedulerService = new SchedulerService();