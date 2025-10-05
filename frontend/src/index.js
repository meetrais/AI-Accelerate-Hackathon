import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import GenAIShowcase from './GenAIShowcase';

function App() {
  const [viewMode, setViewMode] = useState('showcase'); // 'booking' or 'showcase'
  const [query, setQuery] = useState('');
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [bookingStep, setBookingStep] = useState('search'); // search, passenger-details, payment, confirmation
  const [passengerDetails, setPassengerDetails] = useState([]);
  const [contactInfo, setContactInfo] = useState({ email: '', phone: '' });
  const [bookingReference, setBookingReference] = useState('');

  if (viewMode === 'showcase') {
    return (
      <div>
        <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 1000 }}>
          <button
            onClick={() => setViewMode('booking')}
            style={{
              backgroundColor: '#2563eb',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)'
            }}
          >
            ✈️ Book a Flight
          </button>
        </div>
        <GenAIShowcase />
      </div>
    );
  }

  const searchFlights = async () => {
    if (!query.trim()) return;
    
    setLoading(true);
    try {
      // Send natural language query to backend
      const response = await fetch('http://localhost:3000/api/chat/message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: query,
          sessionId: 'demo-session'
        })
      });
      
      const data = await response.json();
      
      console.log('Backend response:', data); // Debug log
      
      // Extract flights from response (could be in data.flights or data.data.flights)
      const flightData = data.flights || data.data?.flights || [];
      
      // Add user message
      setChatMessages(prev => [...prev, {
        type: 'user',
        content: query,
        timestamp: new Date()
      }]);
      
      // Add AI response
      setChatMessages(prev => [...prev, {
        type: 'assistant',
        content: data.response || data.data?.response || 'I found some flights for you!',
        timestamp: new Date(),
        flights: flightData
      }]);
      
      if (flightData && flightData.length > 0) {
        setFlights(flightData);
        console.log('Flights set:', flightData); // Debug log
      } else {
        console.log('No flights in response'); // Debug log
      }
      
      setQuery('');
    } catch (error) {
      console.error('Search error:', error);
      setChatMessages(prev => [...prev, {
        type: 'error',
        content: 'Sorry, I had trouble connecting to the flight search service. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const selectFlight = (flight) => {
    setSelectedFlight(flight);
    setBookingStep('passenger-details');
    
    // Initialize passenger details based on query or default to 1
    const passengerCount = extractPassengerCount(query) || 1;
    const initialPassengers = Array.from({ length: passengerCount }, (_, i) => ({
      id: i + 1,
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      passportNumber: '',
      nationality: ''
    }));
    setPassengerDetails(initialPassengers);
  };

  const extractPassengerCount = (query) => {
    const matches = query.match(/(\d+)\s*(passenger|people|person|adult)/i);
    return matches ? parseInt(matches[1]) : 1;
  };

  const proceedToPayment = () => {
    if (validatePassengerDetails()) {
      setBookingStep('payment');
    }
  };

  const validatePassengerDetails = () => {
    const isContactValid = contactInfo.email && contactInfo.phone;
    const arePassengersValid = passengerDetails.every(p => 
      p.firstName && p.lastName && p.dateOfBirth
    );
    
    if (!isContactValid) {
      alert('Please fill in contact information');
      return false;
    }
    
    if (!arePassengersValid) {
      alert('Please fill in all passenger details');
      return false;
    }
    
    return true;
  };

  const processPayment = async () => {
    setLoading(true);
    try {
      const bookingData = {
        flightId: selectedFlight.id,
        passengers: passengerDetails,
        contactInfo: contactInfo,
        paymentInfo: {
          method: 'card',
          amount: selectedFlight.price * passengerDetails.length
        }
      };

      const response = await fetch('http://localhost:3000/api/booking/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bookingData)
      });

      const result = await response.json();
      
      if (result.success) {
        setBookingReference(result.data.bookingReference);
        setBookingStep('confirmation');
        
        setChatMessages(prev => [...prev, {
          type: 'success',
          content: `🎉 Booking confirmed! Reference: ${result.data.bookingReference}`,
          timestamp: new Date()
        }]);
      } else {
        throw new Error(result.error || 'Booking failed');
      }
    } catch (error) {
      console.error('Booking error:', error);
      alert(`Booking failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const startNewSearch = () => {
    setBookingStep('search');
    setSelectedFlight(null);
    setPassengerDetails([]);
    setContactInfo({ email: '', phone: '' });
    setBookingReference('');
    setFlights([]);
    setQuery('');
  };

  const testBackend = async () => {
    try {
      const pingResponse = await fetch('http://localhost:3000/ping');
      
      if (pingResponse.ok) {
        const pingData = await pingResponse.json();
        
        try {
          const healthResponse = await fetch('http://localhost:3000/health');
          if (healthResponse.ok) {
            const healthData = await healthResponse.json();
            const services = Object.keys(healthData.data?.services || {});
            alert(`✅ Backend Status: ${healthData.data?.status || 'ok'}\n🔧 Services: ${services.join(', ')}\n⏱️ Server Time: ${pingData.timestamp}`);
          } else {
            alert(`✅ Backend is running!\n⏱️ Server Time: ${pingData.timestamp}\n⚠️ Full health check failed (${healthResponse.status})`);
          }
        } catch (healthError) {
          alert(`✅ Backend is running!\n⏱️ Server Time: ${pingData.timestamp}\n⚠️ Full health check unavailable`);
        }
      } else {
        throw new Error(`Ping failed: ${pingResponse.status}`);
      }
    } catch (error) {
      console.error('Backend test error:', error);
      alert(`❌ Backend connection failed!\nError: ${error.message}\n\nMake sure the backend is running on port 3000`);
    }
  };

  const renderBookingSteps = () => {
    const steps = ['search', 'passenger-details', 'payment', 'confirmation'];
    const stepNames = ['Search', 'Passenger Details', 'Payment', 'Confirmation'];
    
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
        {steps.map((step, index) => (
          <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: steps.indexOf(bookingStep) >= index ? '#2563eb' : '#e5e7eb',
              color: steps.indexOf(bookingStep) >= index ? 'white' : '#9ca3af',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: '600'
            }}>
              {index + 1}
            </div>
            <span style={{ 
              marginLeft: '8px', 
              marginRight: '20px',
              color: steps.indexOf(bookingStep) >= index ? '#1f2937' : '#9ca3af',
              fontWeight: steps.indexOf(bookingStep) === index ? '600' : '400'
            }}>
              {stepNames[index]}
            </span>
            {index < steps.length - 1 && (
              <div style={{ 
                width: '40px', 
                height: '2px', 
                backgroundColor: steps.indexOf(bookingStep) > index ? '#2563eb' : '#e5e7eb',
                marginRight: '20px'
              }} />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
        
        {/* Header */}
        <header style={{ textAlign: 'center', marginBottom: '40px', position: 'relative' }}>
          <button
            onClick={() => setViewMode('showcase')}
            style={{
              position: 'absolute',
              top: '0',
              right: '0',
              backgroundColor: '#7c3aed',
              color: 'white',
              padding: '10px 20px',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}
          >
            🏠 Back to Home
          </button>
          <h1 style={{ fontSize: '2.5rem', color: '#1e40af', marginBottom: '10px' }}>
            ✈️ AI-Powered Flight Booking Assistant
          </h1>
          <p style={{ color: '#64748b', fontSize: '1.1rem' }}>
            {bookingStep === 'search' && 'Search for flights using natural language - just describe what you need!'}
            {bookingStep === 'passenger-details' && 'Enter passenger and contact information'}
            {bookingStep === 'payment' && 'Review and confirm your booking'}
            {bookingStep === 'confirmation' && 'Booking confirmed! Check your email for details'}
          </p>
        </header>

        {/* Booking Steps */}
        {renderBookingSteps()}

        {/* Search Interface */}
        {bookingStep === 'search' && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '30px', marginBottom: '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
                Describe your travel needs
              </label>
              <textarea
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '16px',
                  resize: 'vertical',
                  minHeight: '80px'
                }}
                placeholder="e.g., I need a flight from New York to London next Friday for 2 passengers"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), searchFlights())}
              />
            </div>
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={searchFlights}
                disabled={loading || !query.trim()}
                style={{
                  backgroundColor: loading ? '#9ca3af' : '#2563eb',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '16px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  flex: 1
                }}
              >
                {loading ? '🔍 Searching...' : '🔍 Search Flights'}
              </button>
              
              <button
                onClick={testBackend}
                style={{
                  backgroundColor: '#10b981',
                  color: 'white',
                  padding: '12px 20px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                Test Backend
              </button>
            </div>
          </div>
        )}

        {/* Chat Messages */}
        {chatMessages.length > 0 && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', marginBottom: '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginBottom: '20px', color: '#374151' }}>💬 Conversation</h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {chatMessages.map((msg, idx) => (
                <div key={idx} style={{ 
                  marginBottom: '15px', 
                  padding: '12px',
                  backgroundColor: msg.type === 'user' ? '#eff6ff' : msg.type === 'error' ? '#fef2f2' : '#f0fdf4',
                  borderRadius: '8px',
                  borderLeft: `4px solid ${msg.type === 'user' ? '#3b82f6' : msg.type === 'error' ? '#ef4444' : '#10b981'}`
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '5px', color: '#374151' }}>
                    {msg.type === 'user' ? '👤 You' : msg.type === 'error' ? '❌ Error' : '🤖 AI Assistant'}
                  </div>
                  <div style={{ color: '#4b5563' }}>{msg.content}</div>
                  {msg.flights && msg.flights.length > 0 && (
                    <div style={{ marginTop: '10px', fontSize: '14px', color: '#059669' }}>
                      Found {msg.flights.length} flight options
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Flight Results */}
        {flights.length > 0 && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', marginBottom: '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginBottom: '20px', color: '#374151' }}>✈️ Flight Options</h3>
            <div style={{ display: 'grid', gap: '15px' }}>
              {flights.map((flight, idx) => (
                <div key={idx} style={{
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  padding: '20px',
                  backgroundColor: '#fafafa'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <div style={{ fontWeight: '600', fontSize: '18px', color: '#1f2937' }}>
                      {flight.airline} {flight.flightNumber}
                    </div>
                    <div style={{ fontSize: '20px', fontWeight: '700', color: '#059669' }}>
                      ${flight.price}
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '20px', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '600' }}>{flight.origin?.city || flight.origin}</div>
                      <div style={{ color: '#6b7280' }}>{flight.departureTime}</div>
                    </div>
                    <div style={{ textAlign: 'center', color: '#6b7280' }}>
                      ✈️ {flight.duration || 'Direct'}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: '600' }}>{flight.destination?.city || flight.destination}</div>
                      <div style={{ color: '#6b7280' }}>{flight.arrivalTime}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => selectFlight(flight)}
                    style={{
                      marginTop: '15px',
                      backgroundColor: '#2563eb',
                      color: 'white',
                      padding: '8px 16px',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Select Flight
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Passenger Details Step */}
        {bookingStep === 'passenger-details' && selectedFlight && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '30px', marginBottom: '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginBottom: '20px', color: '#374151' }}>👥 Passenger Information</h3>
            
            {/* Selected Flight Summary */}
            <div style={{ backgroundColor: '#f0fdf4', padding: '15px', borderRadius: '8px', marginBottom: '25px', border: '1px solid #bbf7d0' }}>
              <h4 style={{ margin: '0 0 10px 0', color: '#059669' }}>Selected Flight</h4>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{selectedFlight.airline} {selectedFlight.flightNumber}</strong><br/>
                  {selectedFlight.origin?.city || selectedFlight.origin} → {selectedFlight.destination?.city || selectedFlight.destination}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '18px', fontWeight: '700', color: '#059669' }}>
                    ${selectedFlight.price} × {passengerDetails.length} = ${selectedFlight.price * passengerDetails.length}
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div style={{ marginBottom: '25px' }}>
              <h4 style={{ marginBottom: '15px', color: '#374151' }}>📧 Contact Information</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Email *</label>
                  <input
                    type="email"
                    value={contactInfo.email}
                    onChange={(e) => setContactInfo({...contactInfo, email: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    placeholder="your.email@example.com"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Phone *</label>
                  <input
                    type="tel"
                    value={contactInfo.phone}
                    onChange={(e) => setContactInfo({...contactInfo, phone: e.target.value})}
                    style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    placeholder="+1 (555) 123-4567"
                  />
                </div>
              </div>
            </div>

            {/* Passenger Details */}
            <div style={{ marginBottom: '25px' }}>
              <h4 style={{ marginBottom: '15px', color: '#374151' }}>✈️ Passenger Details</h4>
              {passengerDetails.map((passenger, index) => (
                <div key={passenger.id} style={{ 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '8px', 
                  padding: '20px', 
                  marginBottom: '15px',
                  backgroundColor: '#fafafa'
                }}>
                  <h5 style={{ marginBottom: '15px', color: '#1f2937' }}>Passenger {index + 1}</h5>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>First Name *</label>
                      <input
                        type="text"
                        value={passenger.firstName}
                        onChange={(e) => {
                          const updated = [...passengerDetails];
                          updated[index].firstName = e.target.value;
                          setPassengerDetails(updated);
                        }}
                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Last Name *</label>
                      <input
                        type="text"
                        value={passenger.lastName}
                        onChange={(e) => {
                          const updated = [...passengerDetails];
                          updated[index].lastName = e.target.value;
                          setPassengerDetails(updated);
                        }}
                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Date of Birth *</label>
                      <input
                        type="date"
                        value={passenger.dateOfBirth}
                        onChange={(e) => {
                          const updated = [...passengerDetails];
                          updated[index].dateOfBirth = e.target.value;
                          setPassengerDetails(updated);
                        }}
                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Passport Number</label>
                      <input
                        type="text"
                        value={passenger.passportNumber}
                        onChange={(e) => {
                          const updated = [...passengerDetails];
                          updated[index].passportNumber = e.target.value;
                          setPassengerDetails(updated);
                        }}
                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                        placeholder="Optional"
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Nationality</label>
                      <input
                        type="text"
                        value={passenger.nationality}
                        onChange={(e) => {
                          const updated = [...passengerDetails];
                          updated[index].nationality = e.target.value;
                          setPassengerDetails(updated);
                        }}
                        style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setBookingStep('search')}
                style={{
                  backgroundColor: '#6b7280',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                ← Back to Search
              </button>
              <button
                onClick={proceedToPayment}
                style={{
                  backgroundColor: '#2563eb',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  flex: 1
                }}
              >
                Continue to Payment →
              </button>
            </div>
          </div>
        )}

        {/* Payment Step */}
        {bookingStep === 'payment' && selectedFlight && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '30px', marginBottom: '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <h3 style={{ marginBottom: '20px', color: '#374151' }}>💳 Payment & Confirmation</h3>
            
            {/* Booking Summary */}
            <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '8px', marginBottom: '25px', border: '1px solid #e2e8f0' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#1f2937' }}>Booking Summary</h4>
              
              <div style={{ marginBottom: '15px' }}>
                <strong>Flight:</strong> {selectedFlight.airline} {selectedFlight.flightNumber}<br/>
                <strong>Route:</strong> {selectedFlight.origin?.city || selectedFlight.origin} → {selectedFlight.destination?.city || selectedFlight.destination}<br/>
                <strong>Date:</strong> {selectedFlight.departureTime}<br/>
                <strong>Passengers:</strong> {passengerDetails.length}
              </div>
              
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span>Flight price per person:</span>
                  <span>${selectedFlight.price}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                  <span>Number of passengers:</span>
                  <span>{passengerDetails.length}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span>Taxes & fees:</span>
                  <span>$45</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: '700', borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                  <span>Total:</span>
                  <span>${(selectedFlight.price * passengerDetails.length) + 45}</span>
                </div>
              </div>
            </div>

            {/* Mock Payment Form */}
            <div style={{ marginBottom: '25px' }}>
              <h4 style={{ marginBottom: '15px', color: '#374151' }}>Payment Information</h4>
              <div style={{ backgroundColor: '#fef3c7', padding: '15px', borderRadius: '8px', marginBottom: '15px', border: '1px solid #fbbf24' }}>
                <p style={{ margin: 0, color: '#92400e' }}>
                  🎭 <strong>Demo Mode:</strong> This is a mock payment. No real charges will be made.
                </p>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Card Number</label>
                  <input
                    type="text"
                    defaultValue="4242 4242 4242 4242"
                    style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    disabled
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '5px', fontWeight: '500' }}>Expiry</label>
                  <input
                    type="text"
                    defaultValue="12/25"
                    style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px' }}
                    disabled
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setBookingStep('passenger-details')}
                style={{
                  backgroundColor: '#6b7280',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                ← Back
              </button>
              <button
                onClick={processPayment}
                disabled={loading}
                style={{
                  backgroundColor: loading ? '#9ca3af' : '#059669',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  flex: 1,
                  fontSize: '16px',
                  fontWeight: '600'
                }}
              >
                {loading ? '⏳ Processing...' : `💳 Pay $${(selectedFlight.price * passengerDetails.length) + 45}`}
              </button>
            </div>
          </div>
        )}

        {/* Confirmation Step */}
        {bookingStep === 'confirmation' && bookingReference && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '30px', marginBottom: '30px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <div style={{ fontSize: '4rem', marginBottom: '15px' }}>🎉</div>
              <h3 style={{ color: '#059669', marginBottom: '10px' }}>Booking Confirmed!</h3>
              <p style={{ color: '#6b7280', fontSize: '18px' }}>Your flight has been successfully booked</p>
            </div>

            <div style={{ backgroundColor: '#f0fdf4', padding: '20px', borderRadius: '8px', marginBottom: '25px', border: '1px solid #bbf7d0' }}>
              <h4 style={{ margin: '0 0 15px 0', color: '#059669' }}>Booking Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <strong>Booking Reference:</strong><br/>
                  <span style={{ fontSize: '20px', fontWeight: '700', color: '#059669' }}>{bookingReference}</span>
                </div>
                <div>
                  <strong>Total Paid:</strong><br/>
                  <span style={{ fontSize: '20px', fontWeight: '700', color: '#059669' }}>
                    ${(selectedFlight.price * passengerDetails.length) + 45}
                  </span>
                </div>
              </div>
            </div>

            <div style={{ backgroundColor: '#eff6ff', padding: '15px', borderRadius: '8px', marginBottom: '25px', border: '1px solid #bfdbfe' }}>
              <h5 style={{ margin: '0 0 10px 0', color: '#1e40af' }}>What's Next?</h5>
              <ul style={{ margin: 0, paddingLeft: '20px', color: '#1f2937' }}>
                <li>Check your email for booking confirmation and e-tickets</li>
                <li>Arrive at the airport 2-3 hours before departure</li>
                <li>Bring valid ID and any required travel documents</li>
                <li>Check-in online 24 hours before your flight</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                onClick={startNewSearch}
                style={{
                  backgroundColor: '#2563eb',
                  color: 'white',
                  padding: '12px 24px',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Book Another Flight
              </button>
            </div>
          </div>
        )}

        {/* System Status */}
        <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <h3 style={{ marginBottom: '15px', color: '#374151' }}>🔧 System Status</h3>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '50%' }}></span>
              <span>Backend API: Running on port 3000</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '50%' }}></span>
              <span>Frontend: Running on port 3001</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ width: '12px', height: '12px', backgroundColor: '#f59e0b', borderRadius: '50%' }}></span>
              <span>Payment Service: Mock mode</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);