import React from 'react';
import { format } from 'date-fns';
import { 
  ClockIcon, 
  MapPinIcon,
  CurrencyDollarIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline';
import { FlightResult } from '../../types';

interface FlightOptionsProps {
  flights: FlightResult[];
  onSelect?: (flight: FlightResult) => void;
  compact?: boolean;
}

export default function FlightOptions({ flights, onSelect, compact = false }: FlightOptionsProps) {
  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatTime = (date: Date) => {
    return format(new Date(date), 'HH:mm');
  };

  const formatDate = (date: Date) => {
    return format(new Date(date), 'MMM dd');
  };

  if (flights.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-gray-700">Flight Options:</h4>
      
      <div className="space-y-2">
        {flights.slice(0, compact ? 3 : flights.length).map((flight, index) => (
          <div
            key={flight.id}
            className={`border border-gray-200 rounded-lg p-3 hover:border-primary-300 transition-colors duration-200 ${
              compact ? 'bg-gray-50' : 'bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold text-gray-900">
                  {flight.airline}
                </span>
                <span className="text-xs text-gray-500">
                  {flight.flightNumber}
                </span>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-primary-600">
                  ${flight.price}
                </div>
                {!compact && (
                  <div className="text-xs text-gray-500">per person</div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-4">
                <div className="text-center">
                  <div className="text-sm font-medium text-gray-900">
                    {flight.origin.code}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTime(flight.departureTime)}
                  </div>
                  {!compact && (
                    <div className="text-xs text-gray-400">
                      {formatDate(flight.departureTime)}
                    </div>
                  )}
                </div>

                <div className="flex-1 flex items-center justify-center">
                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                    <ClockIcon className="h-3 w-3" />
                    <span>{formatDuration(flight.duration)}</span>
                  </div>
                  <div className="flex-1 border-t border-gray-300 mx-2"></div>
                  {flight.stops > 0 && (
                    <div className="text-xs text-orange-600">
                      {flight.stops} stop{flight.stops > 1 ? 's' : ''}
                    </div>
                  )}
                  {flight.stops === 0 && (
                    <div className="text-xs text-green-600">Direct</div>
                  )}
                </div>

                <div className="text-center">
                  <div className="text-sm font-medium text-gray-900">
                    {flight.destination.code}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatTime(flight.arrivalTime)}
                  </div>
                  {!compact && (
                    <div className="text-xs text-gray-400">
                      {formatDate(flight.arrivalTime)}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {!compact && (
              <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-1">
                    <MapPinIcon className="h-3 w-3" />
                    <span>{flight.origin.city} → {flight.destination.city}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <UserGroupIcon className="h-3 w-3" />
                    <span>{flight.availableSeats} seats left</span>
                  </div>
                </div>
              </div>
            )}

            {onSelect && (
              <button
                onClick={() => onSelect(flight)}
                className="w-full btn-primary text-sm py-2"
              >
                Select Flight {index + 1}
              </button>
            )}
          </div>
        ))}
      </div>

      {compact && flights.length > 3 && (
        <div className="text-center">
          <span className="text-xs text-gray-500">
            +{flights.length - 3} more flights available
          </span>
        </div>
      )}
    </div>
  );
}