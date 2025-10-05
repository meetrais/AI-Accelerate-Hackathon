import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MagnifyingGlassIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { useChat } from '../contexts/ChatContext';
import { useBooking } from '../contexts/BookingContext';
import ChatInterface from '../components/Chat/ChatInterface';
import FlightOptions from '../components/Chat/FlightOptions';
import { FlightResult } from '../types';
import toast from 'react-hot-toast';

export default function SearchPage() {
  const navigate = useNavigate();
  const { createSession, currentSession } = useChat();
  const { selectFlight, setSessionId } = useBooking();
  const [searchResults, setSearchResults] = useState<FlightResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Create session if none exists
    if (!currentSession) {
      const sessionId = createSession();
      setSessionId(sessionId);
    } else {
      setSessionId(currentSession.sessionId);
    }
  }, [currentSession, createSession, setSessionId]);

  // Extract flight results from chat messages
  useEffect(() => {
    if (currentSession?.messages) {
      const latestFlights: FlightResult[] = [];
      
      // Get flights from the most recent assistant message
      for (let i = currentSession.messages.length - 1; i >= 0; i--) {
        const message = currentSession.messages[i];
        if (message.role === 'assistant' && message.flightOptions && message.flightOptions.length > 0) {
          latestFlights.push(...message.flightOptions);
          break;
        }
      }
      
      setSearchResults(latestFlights);
    }
  }, [currentSession?.messages]);

  const handleFlightSelect = (flight: FlightResult) => {
    selectFlight(flight);
    toast.success(`Selected ${flight.airline} ${flight.flightNumber}`);
    navigate('/booking');
  };

  const searchExamples = [
    "Find flights from New York to Los Angeles next Friday",
    "I need a cheap flight to Paris in December",
    "Show me direct flights to Tokyo for 2 passengers",
    "Business class flights from SF to London under $3000",
    "Weekend trip to Miami departing Saturday morning"
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Search Flights with AI
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Tell me where you want to go in natural language, and I'll find the best flights for you.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            {/* Search Examples */}
            {searchResults.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Try asking me something like:
                </h2>
                <div className="space-y-3">
                  {searchExamples.map((example, index) => (
                    <div
                      key={index}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <p className="text-gray-700 italic">"{example}"</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-start space-x-3">
                    <MagnifyingGlassIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="font-medium text-blue-900 mb-1">Pro Tip</h3>
                      <p className="text-blue-800 text-sm">
                        The more specific you are, the better results I can provide. 
                        Include your departure city, destination, travel dates, and any preferences!
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-gray-900">
                    Flight Results ({searchResults.length})
                  </h2>
                  <button className="btn-outline inline-flex items-center space-x-2">
                    <AdjustmentsHorizontalIcon className="h-4 w-4" />
                    <span>Filters</span>
                  </button>
                </div>

                <FlightOptions 
                  flights={searchResults} 
                  onSelect={handleFlightSelect}
                />

                {searchResults.length === 0 && !isLoading && (
                  <div className="text-center py-12">
                    <MagnifyingGlassIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">
                      No flights found
                    </h3>
                    <p className="text-gray-600">
                      Try adjusting your search criteria or ask me for suggestions.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="animate-pulse">
                  <div className="flex items-center justify-between mb-6">
                    <div className="h-6 bg-gray-200 rounded w-48"></div>
                    <div className="h-10 bg-gray-200 rounded w-24"></div>
                  </div>
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="h-4 bg-gray-200 rounded w-32"></div>
                          <div className="h-6 bg-gray-200 rounded w-20"></div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-8">
                            <div className="text-center">
                              <div className="h-4 bg-gray-200 rounded w-12 mb-1"></div>
                              <div className="h-3 bg-gray-200 rounded w-16"></div>
                            </div>
                            <div className="h-3 bg-gray-200 rounded w-24"></div>
                            <div className="text-center">
                              <div className="h-4 bg-gray-200 rounded w-12 mb-1"></div>
                              <div className="h-3 bg-gray-200 rounded w-16"></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Search Tips
              </h3>
              <div className="space-y-4 text-sm text-gray-600">
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Be Specific</h4>
                  <p>Include departure city, destination, and travel dates for best results.</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Flexible Dates</h4>
                  <p>Say "flexible dates" or "around [date]" to see more options.</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Budget Conscious</h4>
                  <p>Mention your budget: "under $500" or "cheapest option".</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 mb-1">Preferences</h4>
                  <p>Tell me about stops, airlines, or time preferences.</p>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2">Need Help?</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Ask me anything about flights, and I'll help you find the perfect option.
                </p>
                <button className="w-full btn-outline text-sm">
                  Ask a Question
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Interface */}
      <ChatInterface 
        onFlightSelect={handleFlightSelect}
        showWelcome={false}
      />
    </div>
  );
}