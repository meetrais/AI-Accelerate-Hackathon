import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  PaperAirplaneIcon, 
  ChatBubbleLeftRightIcon,
  MagnifyingGlassIcon,
  TicketIcon,
  UserIcon
} from '@heroicons/react/24/outline';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();

  const navigation = [
    { name: 'Home', href: '/', icon: PaperAirplaneIcon },
    { name: 'Search', href: '/search', icon: MagnifyingGlassIcon },
    { name: 'My Bookings', href: '/my-bookings', icon: TicketIcon },
  ];

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2">
              <PaperAirplaneIcon className="h-8 w-8 text-primary-600" />
              <span className="text-xl font-bold text-gray-900">
                Flight Assistant
              </span>
            </Link>

            {/* Navigation */}
            <nav className="hidden md:flex space-x-8">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                      isActive(item.href)
                        ? 'text-primary-600 bg-primary-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* User menu */}
            <div className="flex items-center space-x-4">
              <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors duration-200">
                <UserIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Mobile navigation */}
        <div className="md:hidden border-t border-gray-200">
          <div className="px-2 pt-2 pb-3 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 ${
                    isActive(item.href)
                      ? 'text-primary-600 bg-primary-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <PaperAirplaneIcon className="h-6 w-6 text-primary-600" />
              <span className="text-lg font-semibold text-gray-900">
                Flight Assistant
              </span>
            </div>
            
            <div className="flex items-center space-x-6 text-sm text-gray-600">
              <span>Powered by Vertex AI & Elasticsearch</span>
              <span>•</span>
              <span>Built for AI Accelerate Hackathon</span>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-gray-200 text-center text-sm text-gray-500">
            <p>
              © 2024 Flight Booking Assistant. This is a demo application showcasing 
              AI-powered conversational flight booking.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}