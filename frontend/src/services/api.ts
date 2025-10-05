import axios from 'axios';
import { 
  ApiResponse, 
  FlightSearchRequest, 
  FlightResult, 
  ChatMessage,
  BookingRequest,
  Booking,
  BookingStep
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging
api.interceptors.request.use(
  (config) => {
    console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    console.error('API Response Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Health check
export const healthCheck = async (): Promise<ApiResponse> => {
  const response = await api.get('/health');
  return response.data;
};

// Flight search
export const searchFlights = async (searchRequest: FlightSearchRequest): Promise<ApiResponse<{
  flights: FlightResult[];
  suggestions: any[];
  metadata: any;
}>> => {
  const response = await api.post('/search/flights', searchRequest);
  return response.data;
};

export const getFlightById = async (flightId: string): Promise<ApiResponse<FlightResult>> => {
  const response = await api.get(`/search/flights/${flightId}`);
  return response.data;
};

export const getAirportSuggestions = async (query: string): Promise<ApiResponse<any[]>> => {
  const response = await api.get(`/search/airports?q=${encodeURIComponent(query)}`);
  return response.data;
};

export const getFlightRecommendations = async (
  flights: FlightResult[],
  searchParams: any,
  userPreferences?: any
): Promise<ApiResponse<any>> => {
  const response = await api.post('/search/recommendations', {
    flights,
    searchParams,
    userPreferences
  });
  return response.data;
};

// Chat API
export const sendChatMessage = async (
  message: string,
  sessionId?: string,
  userId?: string
): Promise<ApiResponse<{
  sessionId: string;
  response: string;
  flightOptions?: FlightResult[];
  suggestedActions?: string[];
  bookingStep?: string;
  timestamp: string;
}>> => {
  const response = await api.post('/chat/message', {
    message,
    sessionId,
    userId
  });
  return response.data;
};

export const quickSearch = async (
  query: string,
  sessionId?: string,
  preferences?: any
): Promise<ApiResponse<{
  sessionId: string;
  query: string;
  response: string;
  flightOptions?: FlightResult[];
  suggestedActions?: string[];
  searchType: string;
}>> => {
  const response = await api.post('/chat/quick-search', {
    query,
    sessionId,
    preferences
  });
  return response.data;
};

export const getChatRecommendations = async (
  sessionId: string,
  preferences?: any,
  context?: string
): Promise<ApiResponse<{
  sessionId: string;
  recommendations: any;
  conversationalResponse: string;
  flightOptions: FlightResult[];
  suggestedActions: string[];
}>> => {
  const response = await api.post('/chat/get-recommendations', {
    sessionId,
    preferences,
    context
  });
  return response.data;
};

export const getConversationHistory = async (
  sessionId: string,
  limit?: number
): Promise<ApiResponse<{
  sessionId: string;
  history: ChatMessage[];
  totalMessages: number;
  currentQuery?: any;
  selectedFlight?: FlightResult;
  lastActivity: string;
}>> => {
  const response = await api.get(`/chat/conversation-history/${sessionId}?limit=${limit || 20}`);
  return response.data;
};

// Booking API
export const createBooking = async (bookingRequest: BookingRequest): Promise<ApiResponse<{
  bookingReference: string;
  status: string;
  totalPrice: number;
  flights: FlightResult[];
  passengers: any[];
}>> => {
  const response = await api.post('/booking/create', bookingRequest);
  return response.data;
};

export const validateBooking = async (bookingRequest: BookingRequest): Promise<ApiResponse<{
  isValid: boolean;
  errors: string[];
  warnings: string[];
}>> => {
  const response = await api.post('/booking/validate', bookingRequest);
  return response.data;
};

export const getBookingByReference = async (bookingReference: string): Promise<ApiResponse<Booking>> => {
  const response = await api.get(`/booking/${bookingReference}`);
  return response.data;
};

export const getUserBookings = async (
  userId: string,
  limit?: number,
  status?: string
): Promise<ApiResponse<{
  bookings: Booking[];
  total: number;
}>> => {
  const params = new URLSearchParams();
  if (limit) params.append('limit', limit.toString());
  if (status) params.append('status', status);
  
  const response = await api.get(`/booking/user/${userId}?${params.toString()}`);
  return response.data;
};

export const cancelBooking = async (
  bookingId: string,
  reason?: string
): Promise<ApiResponse<{ cancelled: boolean }>> => {
  const response = await api.put(`/booking/${bookingId}/cancel`, { reason });
  return response.data;
};

export const getBookingSteps = async (sessionId: string): Promise<ApiResponse<{
  sessionId: string;
  steps: BookingStep[];
  currentStep: string;
  completedSteps: number;
  totalSteps: number;
}>> => {
  const response = await api.get(`/booking/session/${sessionId}/steps`);
  return response.data;
};

export const updateBookingStep = async (
  sessionId: string,
  step: string,
  data: any
): Promise<ApiResponse<{ step: string; updated: boolean }>> => {
  const response = await api.post(`/booking/session/${sessionId}/step`, {
    step,
    data
  });
  return response.data;
};

// Payment API
export const createPaymentIntent = async (
  amount: number,
  currency: string,
  bookingReference: string,
  customerEmail?: string
): Promise<ApiResponse<{
  id: string;
  clientSecret: string;
  amount: number;
  currency: string;
  status: string;
}>> => {
  const response = await api.post('/payment/create-intent', {
    amount,
    currency,
    bookingReference,
    customerEmail
  });
  return response.data;
};

export const validatePaymentMethod = async (paymentInfo: any): Promise<ApiResponse<{
  valid: boolean;
  errors: string[];
}>> => {
  const response = await api.post('/payment/validate-method', paymentInfo);
  return response.data;
};

export const getPaymentStatus = async (paymentId: string): Promise<ApiResponse<{
  status: string;
  amount: number;
  currency: string;
  created: string;
}>> => {
  const response = await api.get(`/payment/status/${paymentId}`);
  return response.data;
};

// NLP API
export const processNaturalLanguageQuery = async (
  userMessage: string,
  sessionId?: string,
  userId?: string
): Promise<ApiResponse<{
  sessionId: string;
  extractedParams: any;
  flightResults: FlightResult[];
  response: string;
  resultCount: number;
}>> => {
  const response = await api.post('/nlp/query', {
    userMessage,
    sessionId,
    userId
  });
  return response.data;
};

export const handleNLPConversation = async (
  message: string,
  sessionId: string,
  userId?: string
): Promise<ApiResponse<{
  sessionId: string;
  response: string;
  flightOptions?: FlightResult[];
  suggestedActions?: string[];
  bookingStep?: string;
}>> => {
  const response = await api.post('/nlp/chat', {
    message,
    sessionId,
    userId
  });
  return response.data;
};

// Travel Updates API
export const rebookFlight = async (
  bookingId: string,
  newFlightId: string,
  reason?: string
): Promise<ApiResponse<{
  success: boolean;
  newBooking?: any;
  priceDifference?: number;
}>> => {
  const response = await api.post(`/booking/${bookingId}/rebook`, {
    newFlightId,
    reason
  });
  return response.data;
};

export const getFlightChangeHistory = async (bookingId: string): Promise<ApiResponse<{
  flightChanges: any[];
}>> => {
  const response = await api.get(`/booking/${bookingId}/flight-changes`);
  return response.data;
};

export const getTravelReminders = async (bookingId: string): Promise<ApiResponse<{
  reminders: any[];
}>> => {
  const response = await api.get(`/booking/${bookingId}/travel-reminders`);
  return response.data;
};

export const getTravelUpdateStatus = async (): Promise<ApiResponse<{
  status: string;
  lastMonitoring: string;
  features: string[];
}>> => {
  const response = await api.get('/travel-updates/status');
  return response.data;
};

export const triggerFlightMonitoring = async (): Promise<ApiResponse> => {
  const response = await api.post('/travel-updates/monitor-flights');
  return response.data;
};

export const scheduleReminders = async (): Promise<ApiResponse> => {
  const response = await api.post('/travel-updates/schedule-reminders');
  return response.data;
};

export const processReminders = async (): Promise<ApiResponse> => {
  const response = await api.post('/travel-updates/process-reminders');
  return response.data;
};

export default api;