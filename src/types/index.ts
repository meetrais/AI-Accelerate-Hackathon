// Core data models and interfaces

export interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
}

export interface PriceInfo {
  amount: number;
  currency: string;
  taxes: number;
  fees: number;
}

export interface SeatAvailability {
  economy: number;
  business: number;
  first: number;
}

export interface FlightPolicies {
  baggage: {
    carry_on: string;
    checked: string;
  };
  cancellation: string;
  changes: string;
}

export interface Flight {
  id: string;
  airline: string;
  flightNumber: string;
  aircraft: string;
  origin: Airport;
  destination: Airport;
  departureTime: Date;
  arrivalTime: Date;
  duration: number; // in minutes
  stops: Airport[];
  price: PriceInfo;
  availability: SeatAvailability;
  policies: FlightPolicies;
  gate?: string;
  availableSeats?: number;
}

export interface PassengerInfo {
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  passportNumber?: string;
  nationality: string;
  seatPreference?: string;
}

export interface ContactInfo {
  email: string;
  phone: string;
  address?: {
    street: string;
    city: string;
    country: string;
    postalCode: string;
  };
  paymentInfo?: PaymentInfo;
}

export interface PaymentInfo {
  method: 'card' | 'paypal';
  cardToken?: string; // Stripe token
  paypalId?: string;
}

export interface Booking {
  id: string;
  bookingReference: string;
  userId: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  flights: Flight[];
  passengers: PassengerInfo[];
  contactInfo: ContactInfo;
  totalPrice: number;
  paymentStatus: 'paid' | 'pending' | 'refunded';
  createdAt: Date;
  travelDate: Date;
}

// Service interfaces

export interface TravelQuery {
  userMessage: string;
  sessionId: string;
  context?: ConversationContext;
}

export interface ExtractedTravelParams {
  origin?: string;
  destination?: string;
  departureDate?: Date;
  returnDate?: Date;
  passengers: number;
  class?: 'economy' | 'business' | 'first';
  flexibility?: 'exact' | 'flexible';
}

export interface FlightSearchRequest {
  origin: string;
  destination: string;
  departureDate: Date;
  returnDate?: Date;
  passengers: number;
  filters?: FlightFilters;
}

export interface FlightFilters {
  maxPrice?: number;
  airlines?: string[];
  maxStops?: number;
  departureTimeRange?: {
    start: string; // HH:MM format
    end: string;
  };
  class?: 'economy' | 'business' | 'first';
}

export interface FlightResult {
  id: string;
  airline: string;
  flightNumber: string;
  origin: Airport;
  destination: Airport;
  departureTime: Date;
  arrivalTime: Date;
  duration: number;
  stops: number;
  price: number;
  availableSeats: number;
}

export interface ConversationContext {
  previousQueries: ExtractedTravelParams[];
  searchResults?: FlightResult[];
  selectedFlight?: FlightResult;
  bookingStep?: BookingStep;
}

export interface ConversationMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: any;
}

export interface ConversationRequest {
  message: string;
  sessionId: string;
  userId?: string;
  flightResults?: FlightResult[];
}

export interface ConversationResponse {
  message: string;
  flightOptions?: FlightResult[];
  suggestedActions?: string[];
  bookingStep?: BookingStep;
}

export interface UserSession {
  sessionId: string;
  userId?: string;
  currentQuery?: ExtractedTravelParams;
  conversationHistory: ConversationMessage[];
  searchResults?: FlightResult[];
  selectedFlight?: FlightResult;
  bookingInProgress?: Partial<BookingRequest>;
  createdAt: Date;
  lastActivity: Date;
}

export interface BookingRequest {
  flightId: string;
  passengers: PassengerInfo[];
  contactInfo: ContactInfo;
  paymentInfo: PaymentInfo;
  bookingId?: string;
  bookingReference?: string;
  userPreferences?: UserPreferences;
}

export interface BookingConfirmation {
  bookingReference: string;
  status: 'confirmed' | 'pending' | 'failed';
  totalPrice: number;
  flights: Flight[];
  passengers: PassengerInfo[];
}

export type BookingStep = 
  | 'flight_selection'
  | 'passenger_info'
  | 'contact_info'
  | 'payment'
  | 'confirmation';

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    [serviceName: string]: boolean;
  };
  uptime?: number;
  details?: any[];
}

export interface UserPreferences {
  budgetRange?: 'budget' | 'mid-range' | 'premium';
  timePreference?: 'morning' | 'afternoon' | 'evening' | 'flexible';
  stopPreference?: 'direct' | 'one-stop' | 'flexible';
  airlinePreferences?: string[];
  priorityFactors?: Array<'price' | 'duration' | 'convenience' | 'airline'>;
}