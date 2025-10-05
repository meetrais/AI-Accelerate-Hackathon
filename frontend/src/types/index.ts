// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Flight types
export interface Airport {
  code: string;
  name: string;
  city: string;
  country: string;
  timezone: string;
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
    start: string;
    end: string;
  };
  class?: 'economy' | 'business' | 'first';
}

// Chat types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  flightOptions?: FlightResult[];
  suggestedActions?: string[];
  bookingStep?: string;
}

export interface ChatSession {
  sessionId: string;
  messages: ChatMessage[];
  isLoading: boolean;
}

// Booking types
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
}

export interface PaymentInfo {
  method: 'card' | 'paypal';
  cardToken?: string;
  paypalId?: string;
}

export interface BookingRequest {
  flightId: string;
  passengers: PassengerInfo[];
  contactInfo: ContactInfo;
  paymentInfo: PaymentInfo;
  sessionId?: string;
}

export interface Booking {
  id: string;
  bookingReference: string;
  userId: string;
  status: 'confirmed' | 'cancelled' | 'completed';
  flights: FlightResult[];
  passengers: PassengerInfo[];
  contactInfo: ContactInfo;
  totalPrice: number;
  paymentStatus: 'paid' | 'pending' | 'refunded';
  createdAt: Date;
  travelDate: Date;
}

export interface BookingStep {
  step: 'flight_selection' | 'passenger_info' | 'contact_info' | 'payment' | 'confirmation';
  completed: boolean;
  data?: any;
  errors?: string[];
}

// Search types
export interface SearchSuggestion {
  type: 'date' | 'airport' | 'price' | 'airline';
  suggestion: string;
  reason: string;
}

export interface SearchMetadata {
  searchTime: number;
  totalResults: number;
  searchType: string;
  appliedFilters: string[];
}

// Recommendation types
export interface FlightRecommendation {
  flight: FlightResult;
  score: number;
  reasons: string[];
  category: 'best-value' | 'fastest' | 'cheapest' | 'most-convenient';
}

export interface UserPreferences {
  budgetRange?: 'budget' | 'mid-range' | 'premium';
  timePreference?: 'morning' | 'afternoon' | 'evening' | 'flexible';
  stopPreference?: 'direct' | 'one-stop' | 'flexible';
  airlinePreferences?: string[];
  priorityFactors?: Array<'price' | 'duration' | 'convenience' | 'airline'>;
}