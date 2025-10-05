import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessage, ChatSession, FlightResult } from '../types';
import { sendChatMessage, quickSearch } from '../services/api';
import toast from 'react-hot-toast';

interface ChatState {
  sessions: { [sessionId: string]: ChatSession };
  currentSessionId: string | null;
  isLoading: boolean;
}

type ChatAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'CREATE_SESSION'; payload: string }
  | { type: 'SET_CURRENT_SESSION'; payload: string }
  | { type: 'ADD_MESSAGE'; payload: { sessionId: string; message: ChatMessage } }
  | { type: 'UPDATE_LAST_MESSAGE'; payload: { sessionId: string; updates: Partial<ChatMessage> } }
  | { type: 'CLEAR_SESSION'; payload: string };

const initialState: ChatState = {
  sessions: {},
  currentSessionId: null,
  isLoading: false,
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };

    case 'CREATE_SESSION':
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [action.payload]: {
            sessionId: action.payload,
            messages: [],
            isLoading: false,
          },
        },
        currentSessionId: action.payload,
      };

    case 'SET_CURRENT_SESSION':
      return { ...state, currentSessionId: action.payload };

    case 'ADD_MESSAGE':
      const { sessionId, message } = action.payload;
      return {
        ...state,
        sessions: {
          ...state.sessions,
          [sessionId]: {
            ...state.sessions[sessionId],
            messages: [...(state.sessions[sessionId]?.messages || []), message],
          },
        },
      };

    case 'UPDATE_LAST_MESSAGE':
      const { sessionId: updateSessionId, updates } = action.payload;
      const session = state.sessions[updateSessionId];
      if (!session || session.messages.length === 0) return state;

      const updatedMessages = [...session.messages];
      const lastIndex = updatedMessages.length - 1;
      updatedMessages[lastIndex] = { ...updatedMessages[lastIndex], ...updates };

      return {
        ...state,
        sessions: {
          ...state.sessions,
          [updateSessionId]: {
            ...session,
            messages: updatedMessages,
          },
        },
      };

    case 'CLEAR_SESSION':
      const { [action.payload]: removed, ...remainingSessions } = state.sessions;
      return {
        ...state,
        sessions: remainingSessions,
        currentSessionId: state.currentSessionId === action.payload ? null : state.currentSessionId,
      };

    default:
      return state;
  }
}

interface ChatContextType {
  state: ChatState;
  currentSession: ChatSession | null;
  createSession: () => string;
  setCurrentSession: (sessionId: string) => void;
  sendMessage: (message: string, sessionId?: string) => Promise<void>;
  quickSearchFlights: (query: string, sessionId?: string) => Promise<void>;
  clearSession: (sessionId: string) => void;
  addFlightOptionsToLastMessage: (sessionId: string, flights: FlightResult[]) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  const currentSession = state.currentSessionId ? state.sessions[state.currentSessionId] : null;

  const createSession = useCallback((): string => {
    const sessionId = uuidv4();
    dispatch({ type: 'CREATE_SESSION', payload: sessionId });
    return sessionId;
  }, []);

  const setCurrentSession = useCallback((sessionId: string) => {
    dispatch({ type: 'SET_CURRENT_SESSION', payload: sessionId });
  }, []);

  const addMessage = useCallback((sessionId: string, message: ChatMessage) => {
    dispatch({ type: 'ADD_MESSAGE', payload: { sessionId, message } });
  }, []);

  const sendMessage = useCallback(async (message: string, sessionId?: string) => {
    const targetSessionId = sessionId || state.currentSessionId;
    if (!targetSessionId) {
      toast.error('No active chat session');
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    addMessage(targetSessionId, userMessage);

    // Add loading message
    const loadingMessage: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: 'Thinking...',
      timestamp: new Date(),
    };
    addMessage(targetSessionId, loadingMessage);

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const response = await sendChatMessage(message, targetSessionId);
      
      if (response.success && response.data) {
        // Update the loading message with the actual response
        dispatch({
          type: 'UPDATE_LAST_MESSAGE',
          payload: {
            sessionId: targetSessionId,
            updates: {
              content: response.data.response,
              flightOptions: response.data.flightOptions,
              suggestedActions: response.data.suggestedActions,
              bookingStep: response.data.bookingStep,
            },
          },
        });
      } else {
        dispatch({
          type: 'UPDATE_LAST_MESSAGE',
          payload: {
            sessionId: targetSessionId,
            updates: {
              content: response.message || 'Sorry, I encountered an error. Please try again.',
            },
          },
        });
        toast.error(response.message || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      dispatch({
        type: 'UPDATE_LAST_MESSAGE',
        payload: {
          sessionId: targetSessionId,
          updates: {
            content: 'Sorry, I encountered an error. Please try again.',
          },
        },
      });
      toast.error('Failed to send message');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.currentSessionId, addMessage]);

  const quickSearchFlights = useCallback(async (query: string, sessionId?: string) => {
    const targetSessionId = sessionId || state.currentSessionId;
    if (!targetSessionId) {
      toast.error('No active chat session');
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content: query,
      timestamp: new Date(),
    };
    addMessage(targetSessionId, userMessage);

    // Add loading message
    const loadingMessage: ChatMessage = {
      id: uuidv4(),
      role: 'assistant',
      content: 'Searching for flights...',
      timestamp: new Date(),
    };
    addMessage(targetSessionId, loadingMessage);

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const response = await quickSearch(query, targetSessionId);
      
      if (response.success && response.data) {
        // Update the loading message with the actual response
        dispatch({
          type: 'UPDATE_LAST_MESSAGE',
          payload: {
            sessionId: targetSessionId,
            updates: {
              content: response.data.response,
              flightOptions: response.data.flightOptions,
              suggestedActions: response.data.suggestedActions,
            },
          },
        });
      } else {
        dispatch({
          type: 'UPDATE_LAST_MESSAGE',
          payload: {
            sessionId: targetSessionId,
            updates: {
              content: response.message || 'Sorry, I couldn\'t find any flights. Please try a different search.',
            },
          },
        });
        toast.error(response.message || 'Flight search failed');
      }
    } catch (error) {
      console.error('Error searching flights:', error);
      dispatch({
        type: 'UPDATE_LAST_MESSAGE',
        payload: {
          sessionId: targetSessionId,
          updates: {
            content: 'Sorry, I encountered an error while searching. Please try again.',
          },
        },
      });
      toast.error('Flight search failed');
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [state.currentSessionId, addMessage]);

  const clearSession = useCallback((sessionId: string) => {
    dispatch({ type: 'CLEAR_SESSION', payload: sessionId });
  }, []);

  const addFlightOptionsToLastMessage = useCallback((sessionId: string, flights: FlightResult[]) => {
    dispatch({
      type: 'UPDATE_LAST_MESSAGE',
      payload: {
        sessionId,
        updates: {
          flightOptions: flights,
        },
      },
    });
  }, []);

  const value: ChatContextType = {
    state,
    currentSession,
    createSession,
    setCurrentSession,
    sendMessage,
    quickSearchFlights,
    clearSession,
    addFlightOptionsToLastMessage,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}