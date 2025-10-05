import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  SparklesIcon, 
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  LightBulbIcon,
  GlobeAltIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { useChat } from '../contexts/ChatContext';
import ChatInterface from '../components/Chat/ChatInterface';

export default function HomePage() {
  const { createSession } = useChat();

  useEffect(() => {
    // Create a chat session when the home page loads
    createSession();
  }, [createSession]);

  const features = [
    {
      icon: ChatBubbleLeftRightIcon,
      title: 'Natural Language Search',
      description: 'Just tell me where you want to go: "I need a flight from NYC to LA next Friday"',
      color: 'text-blue-600 bg-blue-100'
    },
    {
      icon: SparklesIcon,
      title: 'AI-Powered Recommendations',
      description: 'Get personalized flight suggestions based on your preferences and budget',
      color: 'text-purple-600 bg-purple-100'
    },
    {
      icon: MagnifyingGlassIcon,
      title: 'Smart Search',
      description: 'Advanced search with filters for price, airlines, stops, and departure times',
      color: 'text-green-600 bg-green-100'
    },
    {
      icon: LightBulbIcon,
      title: 'Travel Insights',
      description: 'Get tips on best booking times, alternative airports, and money-saving strategies',
      color: 'text-yellow-600 bg-yellow-100'
    }
  ];

  const quickSearches = [
    "Find cheap flights to Europe",
    "Direct flights from San Francisco to Tokyo",
    "Weekend trip to Miami under $300",
    "Business class flights to London",
    "Last minute flights to Las Vegas",
    "Family vacation to Orlando for 4 people"
  ];

  const handleQuickSearch = (query: string) => {
    // The ChatInterface will handle the search
    console.log('Quick search:', query);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-blue-50">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-24">
          <div className="text-center">
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-primary-600 rounded-full blur-xl opacity-20 animate-pulse"></div>
                <div className="relative bg-primary-600 p-6 rounded-full">
                  <SparklesIcon className="h-12 w-12 text-white" />
                </div>
              </div>
            </div>

            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Your AI-Powered
              <span className="text-primary-600 block">Flight Assistant</span>
            </h1>

            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Search, compare, and book flights using natural language. 
              Just tell me where you want to go, and I'll find the perfect flight for you.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link
                to="/search"
                className="btn-primary text-lg px-8 py-3 inline-flex items-center space-x-2"
              >
                <MagnifyingGlassIcon className="h-5 w-5" />
                <span>Start Searching</span>
              </Link>
              
              <button
                onClick={() => handleQuickSearch("Find me a good flight deal")}
                className="btn-outline text-lg px-8 py-3 inline-flex items-center space-x-2"
              >
                <ChatBubbleLeftRightIcon className="h-5 w-5" />
                <span>Ask the Assistant</span>
              </button>
            </div>

            {/* Quick Search Examples */}
            <div className="max-w-4xl mx-auto">
              <p className="text-sm font-medium text-gray-700 mb-4">
                Try asking me something like:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {quickSearches.map((query, index) => (
                  <button
                    key={index}
                    onClick={() => handleQuickSearch(query)}
                    className="text-left p-3 bg-white rounded-lg border border-gray-200 hover:border-primary-300 hover:shadow-sm transition-all duration-200 text-sm text-gray-700 hover:text-primary-700"
                  >
                    "{query}"
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Background decoration */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-20 h-20 bg-primary-200 rounded-full opacity-20 animate-bounce-gentle"></div>
          <div className="absolute top-40 right-20 w-16 h-16 bg-blue-200 rounded-full opacity-20 animate-bounce-gentle" style={{ animationDelay: '1s' }}></div>
          <div className="absolute bottom-40 left-20 w-12 h-12 bg-purple-200 rounded-full opacity-20 animate-bounce-gentle" style={{ animationDelay: '2s' }}></div>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Why Choose Our AI Assistant?
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Experience the future of flight booking with our intelligent assistant 
              powered by Google Cloud Vertex AI and Elasticsearch.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="text-center p-6 rounded-lg hover:shadow-lg transition-shadow duration-200"
                >
                  <div className={`inline-flex p-3 rounded-full ${feature.color} mb-4`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 text-sm">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="flex items-center justify-center mb-4">
                <GlobeAltIcon className="h-8 w-8 text-primary-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">1000+</div>
              <div className="text-gray-600">Airlines & Routes</div>
            </div>
            <div>
              <div className="flex items-center justify-center mb-4">
                <ClockIcon className="h-8 w-8 text-primary-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">&lt;2s</div>
              <div className="text-gray-600">Average Search Time</div>
            </div>
            <div>
              <div className="flex items-center justify-center mb-4">
                <SparklesIcon className="h-8 w-8 text-primary-600" />
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-2">AI-Powered</div>
              <div className="text-gray-600">Smart Recommendations</div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-16 bg-primary-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Find Your Perfect Flight?
          </h2>
          <p className="text-xl text-primary-100 mb-8 max-w-2xl mx-auto">
            Start a conversation with our AI assistant and discover how easy flight booking can be.
          </p>
          <Link
            to="/search"
            className="inline-flex items-center space-x-2 bg-white text-primary-600 font-semibold px-8 py-3 rounded-lg hover:bg-gray-50 transition-colors duration-200"
          >
            <ChatBubbleLeftRightIcon className="h-5 w-5" />
            <span>Start Chatting Now</span>
          </Link>
        </div>
      </div>

      {/* Chat Interface */}
      <ChatInterface onFlightSelect={(flight) => console.log('Selected flight:', flight)} />
    </div>
  );
}