# Travel Updates & Booking Management

This document describes the travel updates and booking management features implemented in Task 9.

## Features Overview

### 1. Flight Change Monitoring
- **Automatic monitoring** of all confirmed bookings for flight changes
- **Real-time notifications** for delays, cancellations, gate changes, and aircraft changes
- **Rebooking assistance** with alternative flight options
- **Background processing** every 15 minutes

### 2. Travel Reminders
- **Check-in reminders** 24 hours before departure
- **Departure reminders** 2 hours before departure  
- **Travel tips** 3 days before departure
- **Document check reminders** 7 days before international flights
- **Automated scheduling** and delivery

### 3. Booking Management
- **Enhanced booking lookup** and modification
- **Booking history** and status tracking
- **Cancellation and refund** processing
- **Rebooking workflow** for cancelled flights

### 4. Notification System
- **Email notifications** for all flight changes
- **Personalized content** based on booking details
- **Template-based system** for consistent messaging
- **Delivery tracking** and status management

## API Endpoints

### Travel Updates
```
GET    /api/travel-updates/status           - Get service status
POST   /api/travel-updates/monitor-flights  - Trigger flight monitoring
POST   /api/travel-updates/schedule-reminders - Schedule travel reminders
POST   /api/travel-updates/process-reminders - Process due reminders
```

### Enhanced Booking Management
```
POST   /api/booking/:bookingId/rebook              - Rebook cancelled flight
GET    /api/booking/:bookingId/flight-changes      - Get flight change history
GET    /api/booking/:bookingId/travel-reminders    - Get travel reminders
```

## Background Services

### Scheduler Service
The scheduler service runs three background jobs:

1. **Flight Monitoring** (every 15 minutes)
   - Checks all active bookings for flight changes
   - Compares current flight data with booked flights
   - Triggers notifications for significant changes

2. **Reminder Scheduling** (every hour)
   - Identifies upcoming bookings within 7 days
   - Creates reminder records for check-in, departure, etc.
   - Schedules reminders based on flight departure times

3. **Reminder Processing** (every 5 minutes)
   - Finds due reminders that haven't been sent
   - Sends email notifications to passengers
   - Updates reminder status to prevent duplicates

### Travel Update Service
Core service that handles:

- **Flight change detection** and classification
- **Rebooking option discovery** using Elasticsearch
- **Notification content generation** and delivery
- **Reminder scheduling** based on flight details
- **International flight detection** for document reminders

## Data Models

### Flight Change Record
```typescript
interface FlightChange {
  bookingId: string;
  bookingReference: string;
  originalFlight: Flight;
  newFlight: Flight;
  changeType: 'delay' | 'cancellation' | 'gate_change' | 'aircraft_change';
  changeReason: string;
  notificationSent: boolean;
  rebookingOptions?: FlightResult[];
  createdAt: Date;
}
```

### Travel Reminder
```typescript
interface TravelReminder {
  bookingId: string;
  bookingReference: string;
  reminderType: 'check_in' | 'departure' | 'travel_tips' | 'document_check';
  scheduledFor: Date;
  sent: boolean;
  content: string;
  createdAt: Date;
}
```

## Notification Types

### Flight Delay Notification
- Sent when flight is delayed by 30+ minutes
- Includes new departure/arrival times
- Provides apology and guidance

### Flight Cancellation Notification  
- Sent when flight is cancelled by airline
- Includes rebooking options if available
- Explains refund process and next steps

### Gate Change Notification
- Sent when gate assignment changes
- Provides new gate information
- Reminds passengers to arrive early

### Aircraft Change Notification
- Sent when aircraft type changes
- Reassures about seat assignments
- Minimal impact notification

### Travel Reminders
- **Check-in reminder**: Encourages online check-in
- **Departure reminder**: Airport arrival guidance
- **Travel tips**: Destination-specific advice
- **Document check**: Passport/visa requirements

## Rebooking Process

1. **Flight Cancellation Detected**
   - System identifies cancelled flight
   - Searches for alternative flights on same route
   - Ranks options by departure time similarity

2. **Rebooking Options Presented**
   - Up to 5 alternative flights shown
   - Price differences calculated
   - Availability confirmed

3. **Rebooking Execution**
   - Creates new booking with selected flight
   - Cancels original booking
   - Processes payment difference (charge/refund)
   - Sends confirmation notification

## Error Handling

### Flight Monitoring Errors
- **API failures**: Graceful degradation, retry logic
- **Data inconsistencies**: Logging and manual review flags
- **Notification failures**: Retry with exponential backoff

### Reminder Processing Errors
- **Missing bookings**: Skip with warning log
- **Email delivery failures**: Mark for retry
- **Scheduling conflicts**: Prevent duplicate reminders

### Rebooking Errors
- **Insufficient seats**: Clear error message
- **Payment failures**: Rollback booking changes
- **Price changes**: Re-validate before processing

## Configuration

### Monitoring Intervals
```typescript
const FLIGHT_MONITORING_INTERVAL = 15 * 60 * 1000; // 15 minutes
const REMINDER_SCHEDULING_INTERVAL = 60 * 60 * 1000; // 1 hour  
const REMINDER_PROCESSING_INTERVAL = 5 * 60 * 1000; // 5 minutes
```

### Reminder Timing
```typescript
const CHECK_IN_HOURS_BEFORE = 24;
const DEPARTURE_HOURS_BEFORE = 2;
const TRAVEL_TIPS_DAYS_BEFORE = 3;
const DOCUMENT_CHECK_DAYS_BEFORE = 7;
```

### Change Detection Thresholds
```typescript
const SIGNIFICANT_DELAY_MINUTES = 30;
const CANCELLATION_HOURS_BEFORE = 2;
```

## Testing

The travel update service includes comprehensive tests for:

- **Flight change detection** and classification
- **Reminder scheduling** and processing
- **Rebooking workflow** with various scenarios
- **Notification delivery** and content generation
- **Error handling** and edge cases

Run tests with:
```bash
npm test -- travelUpdateService.test.ts
```

## Monitoring & Observability

### Logs
- Flight monitoring results and changes detected
- Reminder scheduling and delivery status
- Rebooking requests and outcomes
- Error conditions and recovery actions

### Metrics
- Number of flight changes detected per hour
- Reminder delivery success rates
- Rebooking completion rates
- Average notification delivery time

### Health Checks
- Background service status
- Database connectivity
- External API availability
- Email service functionality

## Future Enhancements

1. **SMS Notifications** - Add text message support
2. **Mobile Push Notifications** - Real-time mobile alerts
3. **Predictive Delays** - ML-based delay prediction
4. **Dynamic Pricing** - Real-time rebooking price optimization
5. **Multi-language Support** - Localized notifications
6. **Advanced Filters** - Passenger preference-based rebooking