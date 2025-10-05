import { firestoreService } from './firestoreService';
import { Booking, Flight, FlightResult } from '../types';

export interface NotificationTemplate {
  type: 'booking_confirmation' | 'payment_confirmation' | 'booking_cancellation' | 'flight_reminder';
  subject: string;
  htmlContent: string;
  textContent: string;
}

export interface NotificationData {
  to: string;
  template: NotificationTemplate;
  data: any;
}

export class NotificationService {
  /**
   * Send booking confirmation notification
   */
  async sendBookingConfirmation(booking: Booking): Promise<boolean> {
    try {
      const template = this.getBookingConfirmationTemplate();
      
      const notificationData: NotificationData = {
        to: booking.contactInfo.email,
        template,
        data: {
          bookingReference: booking.bookingReference,
          passengerName: `${booking.passengers[0].firstName} ${booking.passengers[0].lastName}`,
          flight: booking.flights[0],
          totalPrice: booking.totalPrice,
          passengers: booking.passengers
        }
      };

      return await this.sendNotification(notificationData);

    } catch (error) {
      console.error('Error sending booking confirmation:', error);
      return false;
    }
  }

  /**
   * Send payment confirmation notification
   */
  async sendPaymentConfirmation(
    booking: Booking, 
    paymentId: string, 
    receiptUrl?: string
  ): Promise<boolean> {
    try {
      const template = this.getPaymentConfirmationTemplate();
      
      const notificationData: NotificationData = {
        to: booking.contactInfo.email,
        template,
        data: {
          bookingReference: booking.bookingReference,
          passengerName: `${booking.passengers[0].firstName} ${booking.passengers[0].lastName}`,
          paymentId,
          totalPrice: booking.totalPrice,
          receiptUrl
        }
      };

      return await this.sendNotification(notificationData);

    } catch (error) {
      console.error('Error sending payment confirmation:', error);
      return false;
    }
  }

  /**
   * Send booking cancellation notification
   */
  async sendBookingCancellation(
    booking: Booking, 
    refundAmount?: number
  ): Promise<boolean> {
    try {
      const template = this.getBookingCancellationTemplate();
      
      const notificationData: NotificationData = {
        to: booking.contactInfo.email,
        template,
        data: {
          bookingReference: booking.bookingReference,
          passengerName: `${booking.passengers[0].firstName} ${booking.passengers[0].lastName}`,
          flight: booking.flights[0],
          refundAmount: refundAmount || booking.totalPrice
        }
      };

      return await this.sendNotification(notificationData);

    } catch (error) {
      console.error('Error sending booking cancellation:', error);
      return false;
    }
  }

  /**
   * Send flight reminder notification
   */
  async sendFlightReminder(booking: Booking): Promise<boolean> {
    try {
      const template = this.getFlightReminderTemplate();
      const flight = booking.flights[0];
      
      const notificationData: NotificationData = {
        to: booking.contactInfo.email,
        template,
        data: {
          bookingReference: booking.bookingReference,
          passengerName: `${booking.passengers[0].firstName} ${booking.passengers[0].lastName}`,
          flight,
          departureTime: flight.departureTime.toLocaleString(),
          checkInUrl: `${process.env.FRONTEND_URL || 'http://localhost:3001'}/check-in/${booking.bookingReference}`
        }
      };

      return await this.sendNotification(notificationData);

    } catch (error) {
      console.error('Error sending flight reminder:', error);
      return false;
    }
  }

  /**
   * Send notification (mock implementation)
   */
  private async sendNotification(notificationData: NotificationData): Promise<boolean> {
    try {
      console.log(`🎭 MOCK EMAIL SERVICE - Sending ${notificationData.template.type} notification`);
      console.log(`📧 To: ${notificationData.to}`);
      console.log(`📋 Subject: ${this.processTemplate(notificationData.template.subject, notificationData.data)}`);
      console.log(`📄 Content Preview: ${this.processTemplate(notificationData.template.textContent, notificationData.data).substring(0, 200)}...`);
      
      // Store notification record
      await this.storeNotificationRecord(notificationData);
      
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Simulate 98% success rate for mock
      const success = Math.random() > 0.02;
      
      if (success) {
        console.log(`✅ Mock notification sent successfully to ${notificationData.to}`);
      } else {
        console.log(`❌ Mock notification failed to send to ${notificationData.to}`);
      }
      
      return success;

    } catch (error) {
      console.error('Mock notification sending error:', error);
      return false;
    }
  }

  /**
   * Process template with data (simple string replacement)
   */
  private processTemplate(template: string, data: any): string {
    let processed = template;
    
    // Simple template processing - replace {{key}} with data values
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processed = processed.replace(regex, data[key]?.toString() || '');
    });
    
    return processed;
  }

  /**
   * Send email (mock implementation)
   */
  private async sendEmail(to: string, subject: string, htmlContent: string): Promise<boolean> {
    try {
      console.log(`🎭 MOCK EMAIL - Sending to: ${to}`);
      console.log(`📋 Subject: ${subject}`);
      console.log(`📄 Content Preview: ${htmlContent.replace(/<[^>]*>/g, '').substring(0, 200)}...`);
      
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Store notification record
      const record = {
        to,
        subject,
        content: htmlContent,
        sentAt: new Date(),
        status: 'sent',
        type: 'email'
      };

      await firestoreService.saveNotification(record);
      
      console.log(`✅ Mock email sent successfully to ${to}`);
      return true;

    } catch (error) {
      console.error('Mock email sending error:', error);
      return false;
    }
  }

  /**
   * Store notification record in Firestore
   */
  private async storeNotificationRecord(notificationData: NotificationData): Promise<void> {
    try {
      const record = {
        to: notificationData.to,
        type: notificationData.template.type,
        subject: notificationData.template.subject,
        data: notificationData.data,
        sentAt: new Date(),
        status: 'sent'
      };

      await firestoreService.saveNotification(record);
      
    } catch (error) {
      console.error('Error storing notification record:', error);
    }
  }

  /**
   * Get booking confirmation email template
   */
  private getBookingConfirmationTemplate(): NotificationTemplate {
    return {
      type: 'booking_confirmation',
      subject: 'Flight Booking Confirmation - {{bookingReference}}',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Flight Booking Confirmed! ✈️</h2>
          
          <p>Dear {{passengerName}},</p>
          
          <p>Your flight booking has been confirmed. Here are your booking details:</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Booking Reference: <strong>{{bookingReference}}</strong></h3>
            
            <h4>Flight Details:</h4>
            <p>
              <strong>{{flight.airline}} {{flight.flightNumber}}</strong><br>
              From: {{flight.origin.city}} ({{flight.origin.code}})<br>
              To: {{flight.destination.city}} ({{flight.destination.code}})<br>
              Departure: {{flight.departureTime}}<br>
              Arrival: {{flight.arrivalTime}}
            </p>
            
            <h4>Total Price: $\{{totalPrice}}</h4>
          </div>
          
          <p><strong>Important:</strong></p>
          <ul>
            <li>Please arrive at the airport at least 2 hours before domestic flights and 3 hours before international flights</li>
            <li>Check-in online 24 hours before departure</li>
            <li>Ensure your ID/passport is valid and matches the name on your booking</li>
          </ul>
          
          <p>Have a great trip!</p>
          
          <p>Best regards,<br>Flight Booking Assistant Team</p>
        </div>
      `,
      textContent: `
        Flight Booking Confirmed!
        
        Dear {{passengerName}},
        
        Your flight booking has been confirmed.
        
        Booking Reference: {{bookingReference}}
        
        Flight Details:
        {{flight.airline}} {{flight.flightNumber}}
        From: {{flight.origin.city}} ({{flight.origin.code}})
        To: {{flight.destination.city}} ({{flight.destination.code}})
        Departure: {{flight.departureTime}}
        Arrival: {{flight.arrivalTime}}
        
        Total Price: $\{{totalPrice}}
        
        Important:
        - Arrive at airport 2-3 hours early
        - Check-in online 24 hours before departure
        - Ensure valid ID/passport
        
        Have a great trip!
        
        Best regards,
        Flight Booking Assistant Team
      `
    };
  }

  /**
   * Get payment confirmation email template
   */
  private getPaymentConfirmationTemplate(): NotificationTemplate {
    return {
      type: 'payment_confirmation',
      subject: 'Payment Confirmation - {{bookingReference}}',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #059669;">Payment Confirmed! 💳</h2>
          
          <p>Dear {{passengerName}},</p>
          
          <p>Your payment has been successfully processed for booking {{bookingReference}}.</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Payment Details:</h3>
            <p>
              Payment ID: {{paymentId}}<br>
              Amount: $\{{totalPrice}}<br>
              Status: Confirmed
            </p>
            
            {{#if receiptUrl}}
            <p><a href="{{receiptUrl}}" style="color: #2563eb;">Download Receipt</a></p>
            {{/if}}
          </div>
          
          <p>Your booking is now fully confirmed and you should receive your e-tickets shortly.</p>
          
          <p>Best regards,<br>Flight Booking Assistant Team</p>
        </div>
      `,
      textContent: `
        Payment Confirmed!
        
        Dear {{passengerName}},
        
        Your payment has been successfully processed for booking {{bookingReference}}.
        
        Payment Details:
        Payment ID: {{paymentId}}
        Amount: $\{{totalPrice}}
        Status: Confirmed
        
        Your booking is now fully confirmed.
        
        Best regards,
        Flight Booking Assistant Team
      `
    };
  }

  /**
   * Get booking cancellation email template
   */
  private getBookingCancellationTemplate(): NotificationTemplate {
    return {
      type: 'booking_cancellation',
      subject: 'Booking Cancellation Confirmation - {{bookingReference}}',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Booking Cancelled</h2>
          
          <p>Dear {{passengerName}},</p>
          
          <p>Your flight booking {{bookingReference}} has been successfully cancelled.</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Cancelled Flight:</h3>
            <p>
              {{flight.airline}} {{flight.flightNumber}}<br>
              From: {{flight.origin.city}} ({{flight.origin.code}})<br>
              To: {{flight.destination.city}} ({{flight.destination.code}})<br>
              Original departure: {{flight.departureTime}}
            </p>
            
            <h4>Refund Amount: $\{{refundAmount}}</h4>
            <p>Your refund will be processed within 5-7 business days to your original payment method.</p>
          </div>
          
          <p>We're sorry to see you cancel your trip. If you need to book a new flight, we're here to help!</p>
          
          <p>Best regards,<br>Flight Booking Assistant Team</p>
        </div>
      `,
      textContent: `
        Booking Cancelled
        
        Dear {{passengerName}},
        
        Your flight booking {{bookingReference}} has been successfully cancelled.
        
        Cancelled Flight:
        {{flight.airline}} {{flight.flightNumber}}
        From: {{flight.origin.city}} ({{flight.origin.code}})
        To: {{flight.destination.city}} ({{flight.destination.code}})
        Original departure: {{flight.departureTime}}
        
        Refund Amount: $\{{refundAmount}}
        Your refund will be processed within 5-7 business days.
        
        Best regards,
        Flight Booking Assistant Team
      `
    };
  }

  /**
   * Get flight reminder email template
   */
  private getFlightReminderTemplate(): NotificationTemplate {
    return {
      type: 'flight_reminder',
      subject: 'Flight Reminder - Departure Tomorrow! ✈️',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Flight Reminder - Departure Tomorrow! ✈️</h2>
          
          <p>Dear {{passengerName}},</p>
          
          <p>This is a friendly reminder that your flight departs tomorrow!</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Flight Details:</h3>
            <p>
              <strong>{{flight.airline}} {{flight.flightNumber}}</strong><br>
              From: {{flight.origin.city}} ({{flight.origin.code}})<br>
              To: {{flight.destination.city}} ({{flight.destination.code}})<br>
              Departure: {{departureTime}}
            </p>
            
            <p>Booking Reference: <strong>{{bookingReference}}</strong></p>
          </div>
          
          <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h4 style="margin-top: 0;">Pre-Flight Checklist:</h4>
            <ul style="margin-bottom: 0;">
              <li>✅ Check-in online (if not already done)</li>
              <li>✅ Print boarding passes or download to mobile</li>
              <li>✅ Check baggage restrictions</li>
              <li>✅ Arrive at airport 2-3 hours early</li>
              <li>✅ Ensure valid ID/passport</li>
            </ul>
          </div>
          
          <p style="text-align: center;">
            <a href="{{checkInUrl}}" style="background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Check-In Now</a>
          </p>
          
          <p>Have a safe and pleasant journey!</p>
          
          <p>Best regards,<br>Flight Booking Assistant Team</p>
        </div>
      `,
      textContent: `
        Flight Reminder - Departure Tomorrow!
        
        Dear {{passengerName}},
        
        This is a friendly reminder that your flight departs tomorrow!
        
        Flight Details:
        {{flight.airline}} {{flight.flightNumber}}
        From: {{flight.origin.city}} ({{flight.origin.code}})
        To: {{flight.destination.city}} ({{flight.destination.code}})
        Departure: {{departureTime}}
        
        Booking Reference: {{bookingReference}}
        
        Pre-Flight Checklist:
        - Check-in online (if not already done)
        - Print boarding passes or download to mobile
        - Check baggage restrictions
        - Arrive at airport 2-3 hours early
        - Ensure valid ID/passport
        
        Check-in: {{checkInUrl}}
        
        Have a safe and pleasant journey!
        
        Best regards,
        Flight Booking Assistant Team
      `
    };
  }

  /**
   * Get notification statistics
   */
  async getNotificationStatistics(): Promise<{
    totalNotifications: number;
    notificationsByType: { [key: string]: number };
    recentNotifications: any[];
  }> {
    try {
      const notifications = await firestoreService.getNotifications(100, 0);
      const notificationsByType: { [key: string]: number } = {};

      notifications.forEach(notification => {
        const type = notification.type;
        notificationsByType[type] = (notificationsByType[type] || 0) + 1;
      });

      return {
        totalNotifications: notifications.length,
        notificationsByType,
        recentNotifications: notifications.slice(0, 10)
      };

    } catch (error) {
      console.error('Error getting notification statistics:', error);
      return {
        totalNotifications: 0,
        notificationsByType: {},
        recentNotifications: []
      };
    }
  }

  /**
   * Send flight delay notification
   */
  async sendFlightDelayNotification(
    booking: Booking,
    newFlightInfo: Flight,
    delayMinutes: number
  ): Promise<void> {
    try {
      const subject = `Flight Delay Update - ${booking.bookingReference}`;
      const delayType = delayMinutes > 0 ? 'delayed' : 'moved earlier';
      const delayAmount = Math.abs(delayMinutes);

      const emailContent = `
        <h2>Flight Schedule Update</h2>
        <p>Dear ${booking.passengers[0].firstName},</p>
        
        <p>We have an important update regarding your flight ${newFlightInfo.airline} ${newFlightInfo.flightNumber}.</p>
        
        <div style="background: #fff3cd; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ffc107;">
          <h3>Schedule Change</h3>
          <p><strong>Your flight has been ${delayType} by ${delayAmount} minutes.</strong></p>
          <p><strong>New Departure Time:</strong> ${newFlightInfo.departureTime.toLocaleString()}</p>
          <p><strong>New Arrival Time:</strong> ${newFlightInfo.arrivalTime.toLocaleString()}</p>
        </div>

        <div style="background: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <h3>Flight Details</h3>
          <p><strong>Flight:</strong> ${newFlightInfo.airline} ${newFlightInfo.flightNumber}</p>
          <p><strong>Route:</strong> ${newFlightInfo.origin.city} (${newFlightInfo.origin.code}) → ${newFlightInfo.destination.city} (${newFlightInfo.destination.code})</p>
          <p><strong>Booking Reference:</strong> ${booking.bookingReference}</p>
        </div>

        <p>We apologize for any inconvenience this may cause. Please adjust your travel plans accordingly.</p>
        
        <p>Best regards,<br>Flight Booking Assistant Team</p>
      `;

      await this.sendEmail(booking.contactInfo.email, subject, emailContent);
      
      console.log(`✅ Sent flight delay notification for booking ${booking.bookingReference}`);
    } catch (error) {
      console.error('Error sending flight delay notification:', error);
      throw error;
    }
  }

  /**
   * Send flight cancellation notification
   */
  async sendFlightCancellationNotification(
    booking: Booking,
    reason: string,
    rebookingOptions: FlightResult[]
  ): Promise<void> {
    try {
      const subject = `Flight Cancellation - ${booking.bookingReference}`;
      const flight = booking.flights[0];

      let rebookingOptionsHtml = '';
      if (rebookingOptions.length > 0) {
        rebookingOptionsHtml = `
          <div style="background: #e8f5e8; padding: 20px; margin: 20px 0; border-radius: 8px;">
            <h3>Alternative Flight Options</h3>
            <p>We've found these alternative flights for you:</p>
            <ul>
              ${rebookingOptions.map(option => `
                <li>
                  <strong>${option.airline} ${option.flightNumber}</strong><br>
                  Departure: ${option.departureTime.toLocaleString()}<br>
                  Price: $${option.price}
                </li>
              `).join('')}
            </ul>
            <p>Please contact us to rebook on one of these flights.</p>
          </div>
        `;
      }

      const emailContent = `
        <h2>Flight Cancellation Notice</h2>
        <p>Dear ${booking.passengers[0].firstName},</p>
        
        <p>We regret to inform you that your flight has been cancelled.</p>
        
        <div style="background: #f8d7da; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #dc3545;">
          <h3>Cancelled Flight</h3>
          <p><strong>Flight:</strong> ${flight.airline} ${flight.flightNumber}</p>
          <p><strong>Original Departure:</strong> ${flight.departureTime.toLocaleString()}</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p><strong>Booking Reference:</strong> ${booking.bookingReference}</p>
        </div>

        ${rebookingOptionsHtml}

        <div style="background: #d1ecf1; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <h3>Next Steps</h3>
          <p>• We will process a full refund within 5-7 business days</p>
          <p>• You can rebook on an alternative flight at no extra cost</p>
          <p>• Contact our support team for assistance</p>
        </div>

        <p>We sincerely apologize for the inconvenience and will do everything possible to assist you.</p>
        
        <p>Best regards,<br>Flight Booking Assistant Team</p>
      `;

      await this.sendEmail(booking.contactInfo.email, subject, emailContent);
      
      console.log(`✅ Sent flight cancellation notification for booking ${booking.bookingReference}`);
    } catch (error) {
      console.error('Error sending flight cancellation notification:', error);
      throw error;
    }
  }

  /**
   * Send gate change notification
   */
  async sendGateChangeNotification(booking: Booking, newFlightInfo: Flight): Promise<void> {
    try {
      const subject = `Gate Change - ${booking.bookingReference}`;

      const emailContent = `
        <h2>Gate Change Notification</h2>
        <p>Dear ${booking.passengers[0].firstName},</p>
        
        <p>There has been a gate change for your flight.</p>
        
        <div style="background: #d4edda; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #28a745;">
          <h3>Gate Update</h3>
          <p><strong>Flight:</strong> ${newFlightInfo.airline} ${newFlightInfo.flightNumber}</p>
          <p><strong>New Gate:</strong> ${newFlightInfo.gate}</p>
          <p><strong>Departure Time:</strong> ${newFlightInfo.departureTime.toLocaleString()}</p>
          <p><strong>Booking Reference:</strong> ${booking.bookingReference}</p>
        </div>

        <p>Please proceed to the new gate at least 30 minutes before departure.</p>
        
        <p>Best regards,<br>Flight Booking Assistant Team</p>
      `;

      await this.sendEmail(booking.contactInfo.email, subject, emailContent);
      
      console.log(`✅ Sent gate change notification for booking ${booking.bookingReference}`);
    } catch (error) {
      console.error('Error sending gate change notification:', error);
      throw error;
    }
  }

  /**
   * Send aircraft change notification
   */
  async sendAircraftChangeNotification(booking: Booking, newFlightInfo: Flight): Promise<void> {
    try {
      const subject = `Aircraft Change - ${booking.bookingReference}`;

      const emailContent = `
        <h2>Aircraft Change Notification</h2>
        <p>Dear ${booking.passengers[0].firstName},</p>
        
        <p>There has been an aircraft change for your flight.</p>
        
        <div style="background: #d1ecf1; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #17a2b8;">
          <h3>Aircraft Update</h3>
          <p><strong>Flight:</strong> ${newFlightInfo.airline} ${newFlightInfo.flightNumber}</p>
          <p><strong>New Aircraft:</strong> ${newFlightInfo.aircraft}</p>
          <p><strong>Departure Time:</strong> ${newFlightInfo.departureTime.toLocaleString()}</p>
          <p><strong>Booking Reference:</strong> ${booking.bookingReference}</p>
        </div>

        <p>Your seat assignments remain the same. This change should not affect your travel experience.</p>
        
        <p>Best regards,<br>Flight Booking Assistant Team</p>
      `;

      await this.sendEmail(booking.contactInfo.email, subject, emailContent);
      
      console.log(`✅ Sent aircraft change notification for booking ${booking.bookingReference}`);
    } catch (error) {
      console.error('Error sending aircraft change notification:', error);
      throw error;
    }
  }

  /**
   * Send rebooking confirmation
   */
  async sendRebookingConfirmation(
    originalBooking: Booking,
    newBooking: Booking,
    priceDifference: number
  ): Promise<void> {
    try {
      const subject = `Rebooking Confirmation - ${newBooking.bookingReference}`;
      const newFlight = newBooking.flights[0];

      const priceDifferenceText = priceDifference > 0 
        ? `Additional payment of $${priceDifference} has been charged.`
        : priceDifference < 0 
        ? `Refund of $${Math.abs(priceDifference)} will be processed within 5-7 business days.`
        : 'No additional payment required.';

      const emailContent = `
        <h2>Rebooking Confirmed</h2>
        <p>Dear ${newBooking.passengers[0].firstName},</p>
        
        <p>Your flight has been successfully rebooked.</p>
        
        <div style="background: #d4edda; padding: 20px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #28a745;">
          <h3>New Flight Details</h3>
          <p><strong>Flight:</strong> ${newFlight.airline} ${newFlight.flightNumber}</p>
          <p><strong>Route:</strong> ${newFlight.origin.city} (${newFlight.origin.code}) → ${newFlight.destination.city} (${newFlight.destination.code})</p>
          <p><strong>Departure:</strong> ${newFlight.departureTime.toLocaleString()}</p>
          <p><strong>Arrival:</strong> ${newFlight.arrivalTime.toLocaleString()}</p>
          <p><strong>New Booking Reference:</strong> ${newBooking.bookingReference}</p>
        </div>

        <div style="background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <h3>Payment Information</h3>
          <p><strong>Total Price:</strong> $${newBooking.totalPrice}</p>
          <p>${priceDifferenceText}</p>
        </div>

        <p>Your original booking ${originalBooking.bookingReference} has been cancelled.</p>
        
        <p>Best regards,<br>Flight Booking Assistant Team</p>
      `;

      await this.sendEmail(newBooking.contactInfo.email, subject, emailContent);
      
      console.log(`✅ Sent rebooking confirmation for ${newBooking.bookingReference}`);
    } catch (error) {
      console.error('Error sending rebooking confirmation:', error);
      throw error;
    }
  }

  /**
   * Send travel reminder
   */
  async sendTravelReminder(booking: Booking, reminder: any): Promise<void> {
    try {
      const subject = `Travel Reminder - ${booking.bookingReference}`;
      const flight = booking.flights[0];

      const emailContent = `
        <h2>Travel Reminder</h2>
        <p>Dear ${booking.passengers[0].firstName},</p>
        
        <div style="background: #e3f2fd; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <h3>Upcoming Flight</h3>
          <p><strong>Flight:</strong> ${flight.airline} ${flight.flightNumber}</p>
          <p><strong>Departure:</strong> ${flight.departureTime.toLocaleString()}</p>
          <p><strong>Route:</strong> ${flight.origin.city} → ${flight.destination.city}</p>
        </div>

        <div style="background: #fff3cd; padding: 20px; margin: 20px 0; border-radius: 8px;">
          <h3>Reminder</h3>
          <p>${reminder.content}</p>
        </div>

        <p>Have a great trip!</p>
        
        <p>Best regards,<br>Flight Booking Assistant Team</p>
      `;

      await this.sendEmail(booking.contactInfo.email, subject, emailContent);
      
      console.log(`✅ Sent ${reminder.reminderType} reminder for booking ${booking.bookingReference}`);
    } catch (error) {
      console.error('Error sending travel reminder:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();