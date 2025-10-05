import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  CheckCircleIcon, 
  EnvelopeIcon,
  CalendarIcon,
  MapPinIcon,
  ClockIcon,
  PrinterIcon,
  ShareIcon
} from '@heroicons/react/24/outline';
import { getBookingByReference } from '../services/api';
import { Booking } from '../types';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function ConfirmationPage() {
  const { bookingReference } = useParams<{ bookingReference: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchBooking = async () => {
      if (!bookingReference) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await getBookingByReference(bookingReference);
        if (response.success && response.data) {
          setBooking(response.data);
        } else {
          toast.error('Booking not found');
        }
      } catch (error) {
        console.error('Error fetching booking:', error);
        toast.error('Failed to load booking details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchBooking();
  }, [bookingReference]);

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.share && bookingReference) {
      try {
        await navigator.share({
          title: 'Flight Booking Confirmation',
          text: `My flight booking confirmation: ${bookingReference}`,
          url: window.location.href,
        });
      } catch (error) {
        // Fallback to copying to clipboard
        navigator.clipboard.writeText(window.location.href);
        toast.success('Link copied to clipboard');
      }
    } else {
      // Fallback to copying to clipboard
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 max-w-md">
            <div className="text-red-500 mb-4">
              <svg className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Booking Not Found</h2>
            <p className="text-gray-600 mb-6">
              We couldn't find a booking with reference: {bookingReference}
            </p>
            <Link to="/search" className="btn-primary">
              Search for Flights
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const flight = booking.flights[0];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-green-100 rounded-full p-3">
              <CheckCircleIcon className="h-12 w-12 text-green-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Booking Confirmed!
          </h1>
          <p className="text-lg text-gray-600">
            Your flight has been successfully booked. Confirmation details have been sent to your email.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Booking Reference */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">
                  Booking Reference
                </h2>
                <div className="text-3xl font-bold text-primary-600 mb-4 font-mono">
                  {booking.bookingReference}
                </div>
                <p className="text-sm text-gray-600">
                  Keep this reference number for your records
                </p>
              </div>
            </div>

            {/* Flight Details */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Flight Details</h2>
              
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {flight.airline}
                    </h3>
                    <p className="text-gray-600">{flight.flightNumber}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">Status</p>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Confirmed
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <MapPinIcon className="h-5 w-5 text-gray-400 mr-1" />
                      <span className="font-semibold text-gray-900">{flight.origin.code}</span>
                    </div>
                    <p className="text-sm text-gray-600">{flight.origin.city}</p>
                    <p className="text-sm text-gray-600">{flight.origin.name}</p>
                    <div className="mt-2">
                      <p className="font-medium text-gray-900">
                        {format(new Date(flight.departureTime), 'HH:mm')}
                      </p>
                      <p className="text-sm text-gray-600">
                        {format(new Date(flight.departureTime), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <ClockIcon className="h-5 w-5 text-gray-400 mr-1" />
                      <span className="text-sm text-gray-600">
                        {Math.floor(flight.duration / 60)}h {flight.duration % 60}m
                      </span>
                    </div>
                    <div className="flex items-center justify-center">
                      <div className="flex-1 border-t border-gray-300"></div>
                      <div className="px-2">
                        {flight.stops === 0 ? (
                          <span className="text-xs text-green-600 font-medium">Direct</span>
                        ) : (
                          <span className="text-xs text-orange-600 font-medium">
                            {flight.stops} stop{flight.stops > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 border-t border-gray-300"></div>
                    </div>
                  </div>

                  <div className="text-center">
                    <div className="flex items-center justify-center mb-2">
                      <MapPinIcon className="h-5 w-5 text-gray-400 mr-1" />
                      <span className="font-semibold text-gray-900">{flight.destination.code}</span>
                    </div>
                    <p className="text-sm text-gray-600">{flight.destination.city}</p>
                    <p className="text-sm text-gray-600">{flight.destination.name}</p>
                    <div className="mt-2">
                      <p className="font-medium text-gray-900">
                        {format(new Date(flight.arrivalTime), 'HH:mm')}
                      </p>
                      <p className="text-sm text-gray-600">
                        {format(new Date(flight.arrivalTime), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Passenger Information */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Passenger Information</h2>
              <div className="space-y-3">
                {booking.passengers.map((passenger, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">
                        {passenger.firstName} {passenger.lastName}
                      </p>
                      <p className="text-sm text-gray-600">
                        {passenger.nationality} • 
                        {passenger.seatPreference && ` ${passenger.seatPreference} seat preference`}
                      </p>
                    </div>
                    <span className="text-sm text-gray-500">Passenger {index + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Important Information */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">Important Information</h3>
              <div className="space-y-3 text-blue-800">
                <div className="flex items-start space-x-2">
                  <CalendarIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Check-in opens 24 hours before departure</p>
                    <p className="text-sm">Online check-in is recommended to save time at the airport</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <ClockIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Arrive at the airport early</p>
                    <p className="text-sm">2 hours for domestic flights, 3 hours for international flights</p>
                  </div>
                </div>
                <div className="flex items-start space-x-2">
                  <EnvelopeIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium">Confirmation email sent</p>
                    <p className="text-sm">Check your email at {booking.contactInfo.email} for detailed information</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Summary</h3>
              
              <div className="space-y-3 mb-6">
                <div className="flex justify-between">
                  <span className="text-gray-600">Booking Reference</span>
                  <span className="font-mono text-sm">{booking.bookingReference}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Passengers</span>
                  <span>{booking.passengers.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Paid</span>
                  <span className="font-semibold">${booking.totalPrice}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Payment Status</span>
                  <span className="text-green-600 font-medium">Paid</span>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={handlePrint}
                  className="w-full btn-outline inline-flex items-center justify-center space-x-2"
                >
                  <PrinterIcon className="h-4 w-4" />
                  <span>Print Confirmation</span>
                </button>
                
                <button
                  onClick={handleShare}
                  className="w-full btn-secondary inline-flex items-center justify-center space-x-2"
                >
                  <ShareIcon className="h-4 w-4" />
                  <span>Share</span>
                </button>

                <Link
                  to="/my-bookings"
                  className="w-full btn-primary inline-flex items-center justify-center"
                >
                  View All Bookings
                </Link>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2">Need Help?</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Contact our support team if you have any questions about your booking.
                </p>
                <p className="text-sm text-gray-600">
                  Reference: <span className="font-mono">{booking.bookingReference}</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}