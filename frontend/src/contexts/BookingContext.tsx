import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { 
  FlightResult, 
  PassengerInfo, 
  ContactInfo, 
  PaymentInfo, 
  BookingStep,
  Booking 
} from '../types';
import { 
  createBooking, 
  validateBooking, 
  getBookingSteps, 
  updateBookingStep 
} from '../services/api';
import toast from 'react-hot-toast';

interface BookingState {
  selectedFlight: FlightResult | null;
  passengers: PassengerInfo[];
  contactInfo: ContactInfo | null;
  paymentInfo: PaymentInfo | null;
  currentStep: string;
  steps: BookingStep[];
  isLoading: boolean;
  validationErrors: string[];
  sessionId: string | null;
  completedBooking: Booking | null;
}

type BookingAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_SESSION_ID'; payload: string }
  | { type: 'SET_SELECTED_FLIGHT'; payload: FlightResult }
  | { type: 'SET_PASSENGERS'; payload: PassengerInfo[] }
  | { type: 'SET_CONTACT_INFO'; payload: ContactInfo }
  | { type: 'SET_PAYMENT_INFO'; payload: PaymentInfo }
  | { type: 'SET_STEPS'; payload: BookingStep[] }
  | { type: 'SET_CURRENT_STEP'; payload: string }
  | { type: 'SET_VALIDATION_ERRORS'; payload: string[] }
  | { type: 'SET_COMPLETED_BOOKING'; payload: Booking }
  | { type: 'RESET_BOOKING' };

const initialState: BookingState = {
  selectedFlight: null,
  passengers: [],
  contactInfo: null,
  paymentInfo: null,
  currentStep: 'flight_selection',
  steps: [],
  isLoading: false,
  validationErrors: [],
  sessionId: null,
  completedBooking: null,
};

function bookingReducer(state: BookingState, action: BookingAction): BookingState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_SESSION_ID':
      return { ...state, sessionId: action.payload };

    case 'SET_SELECTED_FLIGHT':
      return { ...state, selectedFlight: action.payload };

    case 'SET_PASSENGERS':
      return { ...state, passengers: action.payload };

    case 'SET_CONTACT_INFO':
      return { ...state, contactInfo: action.payload };

    case 'SET_PAYMENT_INFO':
      return { ...state, paymentInfo: action.payload };

    case 'SET_STEPS':
      return { ...state, steps: action.payload };

    case 'SET_CURRENT_STEP':
      return { ...state, currentStep: action.payload };

    case 'SET_VALIDATION_ERRORS':
      return { ...state, validationErrors: action.payload };

    case 'SET_COMPLETED_BOOKING':
      return { ...state, completedBooking: action.payload };

    case 'RESET_BOOKING':
      return { ...initialState, sessionId: state.sessionId };

    default:
      return state;
  }
}

interface BookingContextType {
  state: BookingState;
  setSessionId: (sessionId: string) => void;
  selectFlight: (flight: FlightResult) => void;
  setPassengers: (passengers: PassengerInfo[]) => void;
  setContactInfo: (contactInfo: ContactInfo) => void;
  setPaymentInfo: (paymentInfo: PaymentInfo) => void;
  validateBookingData: () => Promise<boolean>;
  submitBooking: () => Promise<boolean>;
  loadBookingSteps: (sessionId: string) => Promise<void>;
  updateStep: (step: string, data: any) => Promise<void>;
  resetBooking: () => void;
  getTotalPrice: () => number;
  isStepCompleted: (step: string) => boolean;
  canProceedToStep: (step: string) => boolean;
}

const BookingContext = createContext<BookingContextType | undefined>(undefined);

export function BookingProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(bookingReducer, initialState);

  const setSessionId = useCallback((sessionId: string) => {
    dispatch({ type: 'SET_SESSION_ID', payload: sessionId });
  }, []);

  const selectFlight = useCallback((flight: FlightResult) => {
    dispatch({ type: 'SET_SELECTED_FLIGHT', payload: flight });
    dispatch({ type: 'SET_CURRENT_STEP', payload: 'passenger_info' });
  }, []);

  const setPassengers = useCallback((passengers: PassengerInfo[]) => {
    dispatch({ type: 'SET_PASSENGERS', payload: passengers });
  }, []);

  const setContactInfo = useCallback((contactInfo: ContactInfo) => {
    dispatch({ type: 'SET_CONTACT_INFO', payload: contactInfo });
  }, []);

  const setPaymentInfo = useCallback((paymentInfo: PaymentInfo) => {
    dispatch({ type: 'SET_PAYMENT_INFO', payload: paymentInfo });
  }, []);

  const validateBookingData = useCallback(async (): Promise<boolean> => {
    if (!state.selectedFlight || !state.contactInfo || state.passengers.length === 0) {
      dispatch({ type: 'SET_VALIDATION_ERRORS', payload: ['Missing required booking information'] });
      return false;
    }

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const bookingRequest = {
        flightId: state.selectedFlight.id,
        passengers: state.passengers,
        contactInfo: state.contactInfo,
        paymentInfo: state.paymentInfo || { method: 'card' as const },
        sessionId: state.sessionId || undefined,
      };

      const response = await validateBooking(bookingRequest);

      if (response.success && response.data) {
        dispatch({ type: 'SET_VALIDATION_ERRORS', payload: response.data.errors });
        
        if (response.data.warnings.length > 0) {
          response.data.warnings.forEach(warning => toast.error(warning));
        }

        return response.data.isValid;
      } else {
        dispatch({ type: 'SET_VALIDATION_ERRORS', payload: [response.message || 'Validation failed'] });
        return false;
      }
    } catch (error) {
      console.error('Booking validation error:', error);
      dispatch({ type: 'SET_VALIDATION_ERRORS', payload: ['Validation failed'] });
      toast.error('Failed to validate booking');
      return false;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.selectedFlight, state.contactInfo, state.passengers, state.paymentInfo, state.sessionId]);

  const submitBooking = useCallback(async (): Promise<boolean> => {
    if (!state.selectedFlight || !state.contactInfo || !state.paymentInfo || state.passengers.length === 0) {
      toast.error('Missing required booking information');
      return false;
    }

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const bookingRequest = {
        flightId: state.selectedFlight.id,
        passengers: state.passengers,
        contactInfo: state.contactInfo,
        paymentInfo: state.paymentInfo,
        sessionId: state.sessionId || undefined,
      };

      const response = await createBooking(bookingRequest);

      if (response.success && response.data) {
        // Create a booking object from the response
        const booking: Booking = {
          id: '', // Not provided in response
          bookingReference: response.data.bookingReference,
          userId: state.sessionId || '',
          status: response.data.status as any,
          flights: response.data.flights,
          passengers: response.data.passengers,
          contactInfo: state.contactInfo,
          totalPrice: response.data.totalPrice,
          paymentStatus: 'paid',
          createdAt: new Date(),
          travelDate: response.data.flights[0]?.departureTime || new Date(),
        };

        dispatch({ type: 'SET_COMPLETED_BOOKING', payload: booking });
        dispatch({ type: 'SET_CURRENT_STEP', payload: 'confirmation' });
        
        toast.success('Booking created successfully!');
        return true;
      } else {
        toast.error(response.message || 'Failed to create booking');
        return false;
      }
    } catch (error) {
      console.error('Booking submission error:', error);
      toast.error('Failed to create booking');
      return false;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.selectedFlight, state.contactInfo, state.paymentInfo, state.passengers, state.sessionId]);

  const loadBookingSteps = useCallback(async (sessionId: string) => {
    try {
      const response = await getBookingSteps(sessionId);
      
      if (response.success && response.data) {
        dispatch({ type: 'SET_STEPS', payload: response.data.steps });
        dispatch({ type: 'SET_CURRENT_STEP', payload: response.data.currentStep });
      }
    } catch (error) {
      console.error('Error loading booking steps:', error);
    }
  }, []);

  const updateStep = useCallback(async (step: string, data: any) => {
    if (!state.sessionId) return;

    try {
      const response = await updateBookingStep(state.sessionId, step, data);
      
      if (response.success) {
        // Reload steps to get updated status
        await loadBookingSteps(state.sessionId);
      } else {
        toast.error(response.message || 'Failed to update booking step');
      }
    } catch (error) {
      console.error('Error updating booking step:', error);
      toast.error('Failed to update booking step');
    }
  }, [state.sessionId, loadBookingSteps]);

  const resetBooking = useCallback(() => {
    dispatch({ type: 'RESET_BOOKING' });
  }, []);

  const getTotalPrice = useCallback((): number => {
    if (!state.selectedFlight) return 0;
    return state.selectedFlight.price * state.passengers.length;
  }, [state.selectedFlight, state.passengers.length]);

  const isStepCompleted = useCallback((step: string): boolean => {
    const stepData = state.steps.find(s => s.step === step);
    return stepData?.completed || false;
  }, [state.steps]);

  const canProceedToStep = useCallback((step: string): boolean => {
    const stepOrder = ['flight_selection', 'passenger_info', 'contact_info', 'payment', 'confirmation'];
    const currentIndex = stepOrder.indexOf(state.currentStep);
    const targetIndex = stepOrder.indexOf(step);
    
    // Can only proceed to next step or go back to previous completed steps
    return targetIndex <= currentIndex + 1;
  }, [state.currentStep]);

  const value: BookingContextType = {
    state,
    setSessionId,
    selectFlight,
    setPassengers,
    setContactInfo,
    setPaymentInfo,
    validateBookingData,
    submitBooking,
    loadBookingSteps,
    updateStep,
    resetBooking,
    getTotalPrice,
    isStepCompleted,
    canProceedToStep,
  };

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking() {
  const context = useContext(BookingContext);
  if (context === undefined) {
    throw new Error('useBooking must be used within a BookingProvider');
  }
  return context;
}