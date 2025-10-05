import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  CheckCircleIcon, 
  ClockIcon,
  UserIcon,
  EnvelopeIcon,
  CreditCardIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import { useBooking } from '../contexts/BookingContext';
import { PassengerInfo, ContactInfo, PaymentInfo } from '../types';
import toast from 'react-hot-toast';

export default function BookingPage() {
  const navigate = useNavigate();
  const { 
    state, 
    setPassengers, 
    setContactInfo, 
    setPaymentInfo, 
    validateBookingData, 
    submitBooking,
    getTotalPrice 
  } = useBooking();

  const [currentStep, setCurrentStep] = useState<'passenger' | 'contact' | 'payment' | 'review'>('passenger');
  const [passengers, setPassengersLocal] = useState<PassengerInfo[]>([]);
  const [contact, setContactLocal] = useState<ContactInfo>({
    email: '',
    phone: ''
  });
  const [payment, setPaymentLocal] = useState<PaymentInfo>({
    method: 'card'
  });

  // Initialize passengers array based on selected flight
  useEffect(() => {
    if (state.selectedFlight && passengers.length === 0) {
      // For demo, assume 1 passenger. In real app, this would come from search params
      setPassengersLocal([{
        firstName: '',
        lastName: '',
        dateOfBirth: new Date(),
        nationality: '',
        passportNumber: '',
        seatPreference: 'any'
      }]);
    }
  }, [state.selectedFlight, passengers.length]);

  // Redirect if no flight selected
  useEffect(() => {
    if (!state.selectedFlight) {
      toast.error('Please select a flight first');
      navigate('/search');
    }
  }, [state.selectedFlight, navigate]);

  const handlePassengerChange = (index: number, field: keyof PassengerInfo, value: any) => {
    const updatedPassengers = [...passengers];
    updatedPassengers[index] = { ...updatedPassengers[index], [field]: value };
    setPassengersLocal(updatedPassengers);
  };

  const handleNextStep = async () => {
    switch (currentStep) {
      case 'passenger':
        // Validate passenger info
        const hasEmptyFields = passengers.some(p => !p.firstName || !p.lastName || !p.nationality);
        if (hasEmptyFields) {
          toast.error('Please fill in all required passenger information');
          return;
        }
        setPassengers(passengers);
        setCurrentStep('contact');
        break;

      case 'contact':
        // Validate contact info
        if (!contact.email || !contact.phone) {
          toast.error('Please provide email and phone number');
          return;
        }
        if (!contact.email.includes('@')) {
          toast.error('Please provide a valid email address');
          return;
        }
        setContactInfo(contact);
        setCurrentStep('payment');
        break;

      case 'payment':
        // Validate payment info
        if (payment.method === 'card' && !payment.cardToken) {
          toast.error('Please provide payment information');
          return;
        }
        setPaymentInfo(payment);
        setCurrentStep('review');
        break;

      case 'review':
        // Submit booking
        const isValid = await validateBookingData();
        if (isValid) {
          const success = await submitBooking();
          if (success && state.completedBooking) {
            navigate(`/confirmation/${state.completedBooking.bookingReference}`);
          }
        }
        break;
    }
  };

  const handlePreviousStep = () => {
    switch (currentStep) {
      case 'contact':
        setCurrentStep('passenger');
        break;
      case 'payment':
        setCurrentStep('contact');
        break;
      case 'review':
        setCurrentStep('payment');
        break;
    }
  };

  const steps = [
    { id: 'passenger', name: 'Passenger Info', icon: UserIcon },
    { id: 'contact', name: 'Contact Info', icon: EnvelopeIcon },
    { id: 'payment', name: 'Payment', icon: CreditCardIcon },
    { id: 'review', name: 'Review', icon: CheckCircleIcon }
  ];

  const getCurrentStepIndex = () => {
    return steps.findIndex(step => step.id === currentStep);
  };

  if (!state.selectedFlight) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Booking</h1>
          <p className="text-gray-600">
            {state.selectedFlight.airline} {state.selectedFlight.flightNumber} • 
            {state.selectedFlight.origin.code} → {state.selectedFlight.destination.code}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-center">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isActive = index === getCurrentStepIndex();
              const isCompleted = index < getCurrentStepIndex();
              
              return (
                <div key={step.id} className="flex items-center">
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    isCompleted 
                      ? 'bg-green-500 border-green-500 text-white'
                      : isActive
                      ? 'bg-primary-600 border-primary-600 text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                  }`}>
                    {isCompleted ? (
                      <CheckCircleIcon className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    isActive ? 'text-primary-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {step.name}
                  </span>
                  {index < steps.length - 1 && (
                    <div className={`w-16 h-0.5 mx-4 ${
                      isCompleted ? 'bg-green-500' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {/* Passenger Information */}
              {currentStep === 'passenger' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Passenger Information</h2>
                  {passengers.map((passenger, index) => (
                    <div key={index} className="space-y-4 mb-6">
                      <h3 className="text-lg font-medium text-gray-900">
                        Passenger {index + 1}
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            First Name *
                          </label>
                          <input
                            type="text"
                            value={passenger.firstName}
                            onChange={(e) => handlePassengerChange(index, 'firstName', e.target.value)}
                            className="input-field"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Last Name *
                          </label>
                          <input
                            type="text"
                            value={passenger.lastName}
                            onChange={(e) => handlePassengerChange(index, 'lastName', e.target.value)}
                            className="input-field"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Date of Birth *
                          </label>
                          <input
                            type="date"
                            value={passenger.dateOfBirth.toISOString().split('T')[0]}
                            onChange={(e) => handlePassengerChange(index, 'dateOfBirth', new Date(e.target.value))}
                            className="input-field"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nationality *
                          </label>
                          <input
                            type="text"
                            value={passenger.nationality}
                            onChange={(e) => handlePassengerChange(index, 'nationality', e.target.value)}
                            className="input-field"
                            placeholder="e.g., US, UK, CA"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Passport Number
                          </label>
                          <input
                            type="text"
                            value={passenger.passportNumber || ''}
                            onChange={(e) => handlePassengerChange(index, 'passportNumber', e.target.value)}
                            className="input-field"
                            placeholder="Optional for domestic flights"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Seat Preference
                          </label>
                          <select
                            value={passenger.seatPreference || 'any'}
                            onChange={(e) => handlePassengerChange(index, 'seatPreference', e.target.value)}
                            className="input-field"
                          >
                            <option value="any">Any</option>
                            <option value="aisle">Aisle</option>
                            <option value="window">Window</option>
                            <option value="middle">Middle</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Contact Information */}
              {currentStep === 'contact' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Contact Information</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={contact.email}
                        onChange={(e) => setContactLocal({ ...contact, email: e.target.value })}
                        className="input-field"
                        placeholder="your@email.com"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone Number *
                      </label>
                      <input
                        type="tel"
                        value={contact.phone}
                        onChange={(e) => setContactLocal({ ...contact, phone: e.target.value })}
                        className="input-field"
                        placeholder="+1 (555) 123-4567"
                        required
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Payment Information */}
              {currentStep === 'payment' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Payment Information</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Payment Method
                      </label>
                      <div className="space-y-2">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="card"
                            checked={payment.method === 'card'}
                            onChange={(e) => setPaymentLocal({ ...payment, method: e.target.value as 'card' })}
                            className="mr-2"
                          />
                          Credit/Debit Card
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="paymentMethod"
                            value="paypal"
                            checked={payment.method === 'paypal'}
                            onChange={(e) => setPaymentLocal({ ...payment, method: e.target.value as 'paypal' })}
                            className="mr-2"
                          />
                          PayPal
                        </label>
                      </div>
                    </div>

                    {payment.method === 'card' && (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-start space-x-2">
                          <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-yellow-800">Demo Mode</h4>
                            <p className="text-yellow-700 text-sm mt-1">
                              This is a demo application. Use test card token: <code className="bg-yellow-100 px-1 rounded">tok_visa</code>
                            </p>
                          </div>
                        </div>
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Card Token
                          </label>
                          <input
                            type="text"
                            value={payment.cardToken || ''}
                            onChange={(e) => setPaymentLocal({ ...payment, cardToken: e.target.value })}
                            className="input-field"
                            placeholder="tok_visa"
                          />
                        </div>
                      </div>
                    )}

                    {payment.method === 'paypal' && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-start space-x-2">
                          <ExclamationTriangleIcon className="h-5 w-5 text-blue-600 mt-0.5" />
                          <div>
                            <h4 className="font-medium text-blue-800">Demo Mode</h4>
                            <p className="text-blue-700 text-sm mt-1">
                              This is a demo application. Use test PayPal ID: <code className="bg-blue-100 px-1 rounded">demo_paypal_123</code>
                            </p>
                          </div>
                        </div>
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            PayPal ID
                          </label>
                          <input
                            type="text"
                            value={payment.paypalId || ''}
                            onChange={(e) => setPaymentLocal({ ...payment, paypalId: e.target.value })}
                            className="input-field"
                            placeholder="demo_paypal_123"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Review */}
              {currentStep === 'review' && (
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-6">Review Your Booking</h2>
                  
                  {/* Flight Details */}
                  <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">Flight Details</h3>
                    <p className="text-gray-700">
                      {state.selectedFlight.airline} {state.selectedFlight.flightNumber}
                    </p>
                    <p className="text-gray-600 text-sm">
                      {state.selectedFlight.origin.city} ({state.selectedFlight.origin.code}) → 
                      {state.selectedFlight.destination.city} ({state.selectedFlight.destination.code})
                    </p>
                  </div>

                  {/* Passengers */}
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-900 mb-2">Passengers</h3>
                    {passengers.map((passenger, index) => (
                      <p key={index} className="text-gray-700">
                        {passenger.firstName} {passenger.lastName} ({passenger.nationality})
                      </p>
                    ))}
                  </div>

                  {/* Contact */}
                  <div className="mb-6">
                    <h3 className="font-medium text-gray-900 mb-2">Contact Information</h3>
                    <p className="text-gray-700">{contact.email}</p>
                    <p className="text-gray-700">{contact.phone}</p>
                  </div>

                  {/* Validation Errors */}
                  {state.validationErrors.length > 0 && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                      <h4 className="font-medium text-red-800 mb-2">Please fix the following issues:</h4>
                      <ul className="list-disc list-inside text-red-700 text-sm space-y-1">
                        {state.validationErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex justify-between pt-6 border-t border-gray-200">
                <button
                  onClick={handlePreviousStep}
                  disabled={currentStep === 'passenger'}
                  className="btn-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={handleNextStep}
                  disabled={state.isLoading}
                  className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {state.isLoading ? (
                    <div className="flex items-center space-x-2">
                      <ClockIcon className="h-4 w-4 animate-spin" />
                      <span>Processing...</span>
                    </div>
                  ) : currentStep === 'review' ? (
                    'Complete Booking'
                  ) : (
                    'Next'
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Summary</h3>
              
              {/* Flight Info */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      {state.selectedFlight.airline}
                    </p>
                    <p className="text-sm text-gray-600">
                      {state.selectedFlight.flightNumber}
                    </p>
                  </div>
                  <p className="text-lg font-bold text-primary-600">
                    ${state.selectedFlight.price}
                  </p>
                </div>
                <p className="text-sm text-gray-600">
                  {state.selectedFlight.origin.code} → {state.selectedFlight.destination.code}
                </p>
              </div>

              {/* Price Breakdown */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Flight ({passengers.length} passenger{passengers.length > 1 ? 's' : ''})</span>
                  <span className="text-gray-900">${getTotalPrice()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Taxes & Fees</span>
                  <span className="text-gray-900">Included</span>
                </div>
              </div>

              <div className="pt-4 border-t border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-gray-900">Total</span>
                  <span className="text-xl font-bold text-primary-600">${getTotalPrice()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}