import { Firestore } from '@google-cloud/firestore';
import { config } from '../config';
import { Booking, PassengerInfo, ContactInfo } from '../types';

export class FirestoreService {
  private db: Firestore;

  constructor() {
    this.db = new Firestore({
      projectId: config.firestore.projectId,
      keyFilename: config.firestore.keyFilename
    });
  }

  /**
   * Check if Firestore is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to read from a test collection
      await this.db.collection('health-check').limit(1).get();
      return true;
    } catch (error) {
      console.error('Firestore health check failed:', error);
      return false;
    }
  }

  /**
   * Create a new booking
   */
  async createBooking(booking: Booking): Promise<string> {
    try {
      const docRef = await this.db.collection('bookings').add({
        ...booking,
        createdAt: new Date(),
        updatedAt: new Date()
      });

      console.log(`✅ Created booking with ID: ${docRef.id}`);
      return docRef.id;
    } catch (error) {
      console.error('Error creating booking:', error);
      throw new Error('Failed to create booking');
    }
  }

  /**
   * Get booking by ID
   */
  async getBooking(bookingId: string): Promise<Booking | null> {
    try {
      const doc = await this.db.collection('bookings').doc(bookingId).get();
      
      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data?.createdAt?.toDate() || new Date(),
        travelDate: data?.travelDate?.toDate() || new Date()
      } as Booking;
    } catch (error) {
      console.error('Error getting booking:', error);
      throw new Error('Failed to retrieve booking');
    }
  }

  /**
   * Get booking by reference number
   */
  async getBookingByReference(bookingReference: string): Promise<Booking | null> {
    try {
      const snapshot = await this.db
        .collection('bookings')
        .where('bookingReference', '==', bookingReference)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();
      
      return {
        id: doc.id,
        ...data,
        createdAt: data?.createdAt?.toDate() || new Date(),
        travelDate: data?.travelDate?.toDate() || new Date()
      } as Booking;
    } catch (error) {
      console.error('Error getting booking by reference:', error);
      throw new Error('Failed to retrieve booking');
    }
  }

  /**
   * Get bookings by user ID
   */
  async getBookingsByUser(userId: string): Promise<Booking[]> {
    try {
      const snapshot = await this.db
        .collection('bookings')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data?.createdAt?.toDate() || new Date(),
          travelDate: data?.travelDate?.toDate() || new Date()
        } as Booking;
      });
    } catch (error) {
      console.error('Error getting user bookings:', error);
      throw new Error('Failed to retrieve user bookings');
    }
  }

  /**
   * Update booking status
   */
  async updateBookingStatus(
    bookingId: string, 
    status: 'confirmed' | 'cancelled' | 'completed',
    paymentStatus?: 'paid' | 'pending' | 'refunded'
  ): Promise<void> {
    try {
      const updateData: any = {
        status,
        updatedAt: new Date()
      };

      if (paymentStatus) {
        updateData.paymentStatus = paymentStatus;
      }

      await this.db.collection('bookings').doc(bookingId).update(updateData);
      
      console.log(`✅ Updated booking ${bookingId} status to ${status}`);
    } catch (error) {
      console.error('Error updating booking status:', error);
      throw new Error('Failed to update booking status');
    }
  }

  /**
   * Update booking with additional information
   */
  async updateBooking(bookingId: string, updates: Partial<Booking>): Promise<void> {
    try {
      await this.db.collection('bookings').doc(bookingId).update({
        ...updates,
        updatedAt: new Date()
      });

      console.log(`✅ Updated booking ${bookingId}`);
    } catch (error) {
      console.error('Error updating booking:', error);
      throw new Error('Failed to update booking');
    }
  }

  /**
   * Delete booking
   */
  async deleteBooking(bookingId: string): Promise<void> {
    try {
      await this.db.collection('bookings').doc(bookingId).delete();
      console.log(`✅ Deleted booking ${bookingId}`);
    } catch (error) {
      console.error('Error deleting booking:', error);
      throw new Error('Failed to delete booking');
    }
  }

  /**
   * Store user session data
   */
  async storeSessionData(sessionId: string, data: any): Promise<void> {
    try {
      await this.db.collection('sessions').doc(sessionId).set({
        ...data,
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error storing session data:', error);
      throw new Error('Failed to store session data');
    }
  }

  /**
   * Get user session data
   */
  async getSessionData(sessionId: string): Promise<any | null> {
    try {
      const doc = await this.db.collection('sessions').doc(sessionId).get();
      
      if (!doc.exists) {
        return null;
      }

      return doc.data();
    } catch (error) {
      console.error('Error getting session data:', error);
      return null;
    }
  }

  /**
   * Store user preferences
   */
  async storeUserPreferences(userId: string, preferences: any): Promise<void> {
    try {
      await this.db.collection('user-preferences').doc(userId).set({
        ...preferences,
        updatedAt: new Date()
      }, { merge: true });
    } catch (error) {
      console.error('Error storing user preferences:', error);
      throw new Error('Failed to store user preferences');
    }
  }

  /**
   * Get user preferences
   */
  async getUserPreferences(userId: string): Promise<any | null> {
    try {
      const doc = await this.db.collection('user-preferences').doc(userId).get();
      
      if (!doc.exists) {
        return null;
      }

      return doc.data();
    } catch (error) {
      console.error('Error getting user preferences:', error);
      return null;
    }
  }

  /**
   * Get booking statistics
   */
  async getBookingStats(): Promise<{
    totalBookings: number;
    confirmedBookings: number;
    cancelledBookings: number;
    totalRevenue: number;
    averageBookingValue: number;
  }> {
    try {
      const snapshot = await this.db.collection('bookings').get();
      
      let totalBookings = 0;
      let confirmedBookings = 0;
      let cancelledBookings = 0;
      let totalRevenue = 0;

      snapshot.docs.forEach(doc => {
        const booking = doc.data() as Booking;
        totalBookings++;
        
        if (booking.status === 'confirmed') {
          confirmedBookings++;
          totalRevenue += booking.totalPrice;
        } else if (booking.status === 'cancelled') {
          cancelledBookings++;
        }
      });

      const averageBookingValue = confirmedBookings > 0 ? totalRevenue / confirmedBookings : 0;

      return {
        totalBookings,
        confirmedBookings,
        cancelledBookings,
        totalRevenue,
        averageBookingValue: Math.round(averageBookingValue)
      };
    } catch (error) {
      console.error('Error getting booking stats:', error);
      throw new Error('Failed to retrieve booking statistics');
    }
  }

  /**
   * Clean up old sessions
   */
  async cleanupOldSessions(olderThanHours: number = 24): Promise<number> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - olderThanHours);

      const snapshot = await this.db
        .collection('sessions')
        .where('updatedAt', '<', cutoffTime)
        .get();

      const batch = this.db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });

      await batch.commit();
      
      console.log(`🧹 Cleaned up ${snapshot.size} old sessions`);
      return snapshot.size;
    } catch (error) {
      console.error('Error cleaning up sessions:', error);
      return 0;
    }
  }

  /**
   * Get all bookings (for monitoring)
   */
  async getAllBookings(): Promise<Booking[]> {
    try {
      const snapshot = await this.db.collection('bookings').get();
      return snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data?.createdAt?.toDate() || new Date(),
          travelDate: data?.travelDate?.toDate() || new Date()
        } as Booking;
      });
    } catch (error) {
      console.error('Error getting all bookings:', error);
      throw error;
    }
  }

  /**
   * Create flight change record
   */
  async createFlightChange(flightChange: any): Promise<string> {
    try {
      const docRef = await this.db.collection('flight-changes').add({
        ...flightChange,
        createdAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating flight change:', error);
      throw error;
    }
  }

  /**
   * Update flight change notification status
   */
  async updateFlightChangeNotificationStatus(bookingId: string, sent: boolean): Promise<void> {
    try {
      const snapshot = await this.db
        .collection('flight-changes')
        .where('bookingId', '==', bookingId)
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!snapshot.empty) {
        await snapshot.docs[0].ref.update({ notificationSent: sent });
      }
    } catch (error) {
      console.error('Error updating flight change notification status:', error);
      throw error;
    }
  }

  /**
   * Get flight changes for a booking
   */
  async getFlightChanges(bookingId: string): Promise<any[]> {
    try {
      const snapshot = await this.db
        .collection('flight-changes')
        .where('bookingId', '==', bookingId)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting flight changes:', error);
      throw error;
    }
  }

  /**
   * Create travel reminder
   */
  async createTravelReminder(reminder: any): Promise<string> {
    try {
      const docRef = await this.db.collection('travel-reminders').add({
        ...reminder,
        createdAt: new Date()
      });
      return docRef.id;
    } catch (error) {
      console.error('Error creating travel reminder:', error);
      throw error;
    }
  }

  /**
   * Get due reminders
   */
  async getDueReminders(): Promise<any[]> {
    try {
      const now = new Date();
      const snapshot = await this.db
        .collection('travel-reminders')
        .where('sent', '==', false)
        .where('scheduledFor', '<=', now)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting due reminders:', error);
      throw error;
    }
  }

  /**
   * Update reminder status
   */
  async updateReminderStatus(bookingId: string, reminderType: string, sent: boolean): Promise<void> {
    try {
      const snapshot = await this.db
        .collection('travel-reminders')
        .where('bookingId', '==', bookingId)
        .where('reminderType', '==', reminderType)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        await snapshot.docs[0].ref.update({ sent });
      }
    } catch (error) {
      console.error('Error updating reminder status:', error);
      throw error;
    }
  }

  /**
   * Get travel reminders for a booking
   */
  async getTravelReminders(bookingId: string): Promise<any[]> {
    try {
      const snapshot = await this.db
        .collection('travel-reminders')
        .where('bookingId', '==', bookingId)
        .orderBy('scheduledFor', 'asc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting travel reminders:', error);
      throw error;
    }
  }

  /**
   * Save notification record
   */
  async saveNotification(record: any): Promise<string> {
    try {
      const docRef = await this.db.collection('notifications').add(record);
      return docRef.id;
    } catch (error) {
      console.error('Error saving notification:', error);
      throw error;
    }
  }

  /**
   * Get notifications with pagination
   */
  async getNotifications(limit: number = 50, offset: number = 0): Promise<any[]> {
    try {
      const snapshot = await this.db
        .collection('notifications')
        .orderBy('sentAt', 'desc')
        .limit(limit)
        .offset(offset)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting notifications:', error);
      throw error;
    }
  }

  /**
   * Get payment records by booking reference
   */
  async getPaymentRecords(bookingReference: string): Promise<any[]> {
    try {
      const snapshot = await this.db
        .collection('payment-records')
        .where('bookingReference', '==', bookingReference)
        .where('type', '==', 'payment')
        .where('success', '==', true)
        .limit(1)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting payment records:', error);
      throw error;
    }
  }

  /**
   * Save payment record
   */
  async savePaymentRecord(record: any): Promise<string> {
    try {
      const docRef = await this.db.collection('payment-records').add(record);
      return docRef.id;
    } catch (error) {
      console.error('Error saving payment record:', error);
      throw error;
    }
  }

  /**
   * Get payment statistics
   */
  async getPaymentStats(): Promise<any> {
    try {
      const snapshot = await this.db
        .collection('payment-records')
        .where('type', '==', 'payment')
        .where('success', '==', true)
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting payment stats:', error);
      throw error;
    }
  }

  /**
   * Get refund records
   */
  async getRefundRecords(): Promise<any[]> {
    try {
      const snapshot = await this.db
        .collection('payment-records')
        .where('type', '==', 'refund')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting refund records:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const firestoreService = new FirestoreService();