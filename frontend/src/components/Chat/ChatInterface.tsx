import React, { useState, useRef, useEffect } from 'react';
import { 
  PaperAirplaneIcon, 
  SparklesIcon,
  ChatBubbleLeftRightIcon 
} from '@heroicons/react/24/outline';
import { useChat } from '../../contexts/ChatContext';
import ChatMessage from './ChatMessage';
import SuggestedActions from './SuggestedActions';
import FlightOptions from './FlightOptions';

interface ChatInterfaceProps {
  className?: string;
  onFlightSelect?: (flight: any) => void;
  showWelcome?: boolean;
}

export default function ChatInterface({ 
  className = '', 
  onFlightSelect,
  showWelcome = true 
}: ChatInterfaceProps) {
  const { currentSession, createSession, sendMessage, quickSearchFlights, state } = useChat();
  const [inputMessage, setInputMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Create session if none exists
  useEffect(() => {
    if (!currentSession) {
      createSession();
    }
  }, [currentSession, createSession]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  // Focus input when expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !currentSession) return;

    const message = inputMessage.trim();
    setInputMessage('');

    // Determine if this looks like a flight search query
    const searchKeywords = ['fly', 'flight', 'book', 'travel', 'from', 'to', 'airport'];
    const isFlightSearch = searchKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );

    if (isFlightSearch) {
      await quickSearchFlights(message, currentSession.sessionId);
    } else {
      await sendMessage(message, currentSession.sessionId);
    }
  };

  const handleSuggestedAction = async (action: string) => {
    if (!currentSession) return;
    await sendMessage(action, currentSession.sessionId);
  };

  const handleQuickSearch = async (query: string) => {
    if (!currentSession) return;
    await quickSearchFlights(query, currentSession.sessionId);
  };

  const suggestedQueries = [
    "Find flights from NYC to LA next Friday",
    "I need a cheap flight to Paris",
    "Show me direct flights to Tokyo",
    "Book a flight for 2 passengers to Miami"
  ];

  if (!isExpanded) {
    return (
      <div className={`fixed bottom-6 right-6 z-50 ${className}`}>
        <button
          onClick={() => setIsExpanded(true)}
          className="bg-primary-600 hover:bg-primary-700 text-white p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-105"
        >
          <ChatBubbleLeftRightIcon className="h-6 w-6" />
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-lg shadow-xl border border-gray-200 flex flex-col z-50 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-primary-600 text-white rounded-t-lg">
        <div className="flex items-center space-x-2">
          <SparklesIcon className="h-5 w-5" />
          <h3 className="font-semibold">Flight Assistant</h3>
        </div>
        <button
          onClick={() => setIsExpanded(false)}
          className="text-white hover:text-gray-200 transition-colors duration-200"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {showWelcome && (!currentSession?.messages || currentSession.messages.length === 0) && (
          <div className="text-center py-8">
            <SparklesIcon className="h-12 w-12 text-primary-600 mx-auto mb-4" />
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              Welcome to Flight Assistant!
            </h4>
            <p className="text-gray-600 mb-6">
              I can help you search for flights, compare options, and book your perfect trip. 
              Just tell me where you'd like to go!
            </p>
            
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 mb-3">Try asking:</p>
              {suggestedQueries.map((query, index) => (
                <button
                  key={index}
                  onClick={() => handleQuickSearch(query)}
                  className="block w-full text-left p-3 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                >
                  "{query}"
                </button>
              ))}
            </div>
          </div>
        )}

        {currentSession?.messages.map((message) => (
          <div key={message.id}>
            <ChatMessage message={message} />
            
            {/* Flight options */}
            {message.flightOptions && message.flightOptions.length > 0 && (
              <div className="mt-3">
                <FlightOptions 
                  flights={message.flightOptions} 
                  onSelect={onFlightSelect}
                  compact
                />
              </div>
            )}
            
            {/* Suggested actions */}
            {message.suggestedActions && message.suggestedActions.length > 0 && (
              <div className="mt-3">
                <SuggestedActions 
                  actions={message.suggestedActions}
                  onActionClick={handleSuggestedAction}
                />
              </div>
            )}
          </div>
        ))}

        {state.isLoading && (
          <div className="flex justify-start">
            <div className="chat-message chat-message-assistant">
              <div className="loading-dots">
                <div className="loading-dot"></div>
                <div className="loading-dot"></div>
                <div className="loading-dot"></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask me about flights..."
            className="flex-1 input-field"
            disabled={state.isLoading}
          />
          <button
            type="submit"
            disabled={!inputMessage.trim() || state.isLoading}
            className="btn-primary p-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <PaperAirplaneIcon className="h-5 w-5" />
          </button>
        </form>
      </div>
    </div>
  );
}