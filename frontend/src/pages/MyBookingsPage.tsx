import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  TicketIcon, 
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  XCircleIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import { getUserBookings, cancelBooking } from '../services/api';
import { Booking } from '../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function MyBookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'confirmed' | 'cancelled'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // For demo purposes, using a mock user ID
  const userId = 'demo-user-123';

  useEffect(() => {
    fetchBookings();
  }, [filter]);

  const fetchBookings = async () => {
    setIsLoading(true);
    try {
      const response = await getUserBookings(
        userId,
        20,
        filter === 'all' ? undefined : filter
      );
      
      if (response.success && response.data) {
        setBookings(response.data.bookings);
      } else {
        toast.error('Failed to load bookings');
      }
    } catch (error) {
      console.error('Error fetching bookings:', error);
      toast.error('Failed to load bookings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelBooking = async (bookingId: string, bookingReference: string) => {
    if (!window.confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) {
      return;
    }

    try {
      const response = await cancelBooking(bookingId, 'Customer requested cancellation');
      
      if (response.success) {
        toast.success('Booking cancelled successfully');
        fetchBookings(); // Refresh the list
      } else {
        toast.error(response.message || 'Failed to cancel booking');
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
      toast.error('Failed to cancel booking');
    }
  };

  const filteredBookings = bookings.filter(booking => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        booking.bookingReference.toLowerCase().includes(query) ||
        booking.flights[0]?.airline.toLowerCase().includes(query) ||
        booking.flights[0]?.origin.city.toLowerCase().includes(query) ||
        booking.flights[0]?.destination.city.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'confirmed':
        return CheckCircleIcon;
      case 'cancelled':
        return XCircleIcon;
      case 'completed':
        return TicketIcon;
      default:
        return ClockIcon;
    }
  };

  const canCancelBooking = (booking: Booking) => {
    if (booking.status !== 'confirmed') return false;
    
    const flight = booking.flights[0];
    const hoursUntilDeparture = (new Date(flight.departureTime).getTime() - Date.now()) / (1000 * 60 * 60);
    
    return hoursUntilDeparture > 2; // Can cancel if more than 2 hours before departure
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">My Bookings</h1>
          <p className="text-gray-600">
            Manage your flight bookings and view travel details
          </p>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search bookings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 input-field w-full sm:w-64"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
              {[
                { key: 'all', label: 'All' },
                { key: 'confirmed', label: 'Confirmed' },
                { key: 'cancelled', label: 'Cancelled' }
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key as any)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                    filter === tab.key
                      ? 'bg-white text-primary-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bookings List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-6 bg-gray-200 rounded w-48"></div>
                  <div className="h-6 bg-gray-200 rounded w-24"></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="h-20 bg-gray-200 rounded"></div>
                  <div className="h-20 bg-gray-200 rounded"></div>
                  <div className="h-20 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <TicketIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? 'No matching bookings' : 'No bookings found'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery 
                ? 'Try adjusting your search terms'
                : "You haven't made any flight bookings yet"
              }
            </p>
            <Link to="/search" className="btn-primary">
              Search for Flights
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredBookings.map((booking) => {
              const flight = booking.flights[0];
              const StatusIcon = getStatusIcon(booking.status);
              
              return (
                <div key={booking.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {booking.bookingReference}
                      </h3>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(booking.status)}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-primary-600">${booking.totalPrice}</p>
                      <p className="text-sm text-gray-500">
                        {booking.passengers.length} passenger{booking.passengers.length > 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-center mb-2">
                        <MapPinIcon className="h-4 w-4 text-gray-400 mr-1" />
                        <span className="font-semibold text-gray-900">{flight.origin.code}</span>
                      </div>
                      <p className="text-sm text-gray-600">{flight.origin.city}</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {format(new Date(flight.departureTime), 'MMM dd, HH:mm')}
                      </p>
                    </div>

                    <div className="text-center p-3">
                      <div className="flex items-center justify-center mb-2">
                        <span className="text-sm font-medium text-gray-900">
                          {flight.airline} {flight.flightNumber}
                        </span>
                      </div>
                      <div className="flex items-center justify-center">
                        <div className="flex-1 border-t border-gray-300"></div>
                        <div className="px-2">
                          <ClockIcon className="h-4 w-4 text-gray-400" />
                        </div>
                        <div className="flex-1 border-t border-gray-300"></div>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {Math.floor(flight.duration / 60)}h {flight.duration % 60}m
                      </p>
                    </div>

                    <div className="text-center p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center justify-center mb-2">
                        <MapPinIcon className="h-4 w-4 text-gray-400 mr-1" />
                        <span className="font-semibold text-gray-900">{flight.destination.code}</span>
                      </div>
                      <p className="text-sm text-gray-600">{flight.destination.city}</p>
                      <p className="text-sm font-medium text-gray-900 mt-1">
                        {format(new Date(flight.arrivalTime), 'MMM dd, HH:mm')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                    <div className="flex items-center space-x-4 text-sm text-gray-600">
                      <span>Booked {format(new Date(booking.createdAt), 'MMM dd, yyyy')}</span>
                      <span>•</span>
                      <span>{booking.passengers[0].firstName} {booking.passengers[0].lastName}</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Link
                        to={`/confirmation/${booking.bookingReference}`}
                        className="btn-outline text-sm"
                      >
                        View Details
                      </Link>
                      
                      {canCancelBooking(booking) && (
                        <button
                          onClick={() => handleCancelBooking(booking.id, booking.bookingReference)}
                          className="text-sm text-red-600 hover:text-red-700 font-medium"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Empty State for New Users */}
        {!isLoading && bookings.length === 0 && !searchQuery && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <TicketIcon className="h-16 w-16 text-gray-400 mx-auto mb-6" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Welcome to Flight Assistant!
            </h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">
              You haven't made any bookings yet. Start by searching for flights 
              and I'll help you find the perfect trip.
            </p>
            <Link to="/search" className="btn-primary text-lg px-8 py-3">
              Search for Flights
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}