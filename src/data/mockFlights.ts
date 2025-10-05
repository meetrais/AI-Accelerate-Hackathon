import { Flight, Airport } from '../types';

// Mock airports data
export const airports: Airport[] = [
  { code: 'JFK', name: 'John F. Kennedy International Airport', city: 'New York', country: 'USA', timezone: 'America/New_York' },
  { code: 'LAX', name: 'Los Angeles International Airport', city: 'Los Angeles', country: 'USA', timezone: 'America/Los_Angeles' },
  { code: 'LHR', name: 'London Heathrow Airport', city: 'London', country: 'UK', timezone: 'Europe/London' },
  { code: 'CDG', name: 'Charles de Gaulle Airport', city: 'Paris', country: 'France', timezone: 'Europe/Paris' },
  { code: 'NRT', name: 'Narita International Airport', city: 'Tokyo', country: 'Japan', timezone: 'Asia/Tokyo' },
  { code: 'SFO', name: 'San Francisco International Airport', city: 'San Francisco', country: 'USA', timezone: 'America/Los_Angeles' },
  { code: 'ORD', name: "O'Hare International Airport", city: 'Chicago', country: 'USA', timezone: 'America/Chicago' },
  { code: 'DXB', name: 'Dubai International Airport', city: 'Dubai', country: 'UAE', timezone: 'Asia/Dubai' },
  { code: 'SIN', name: 'Singapore Changi Airport', city: 'Singapore', country: 'Singapore', timezone: 'Asia/Singapore' },
  { code: 'FRA', name: 'Frankfurt Airport', city: 'Frankfurt', country: 'Germany', timezone: 'Europe/Berlin' }
];

// Helper function to get airport by code
export const getAirportByCode = (code: string): Airport | undefined => {
  return airports.find(airport => airport.code === code);
};

// Generate mock flight data
export const generateMockFlights = (): Flight[] => {
  const airlines = [
    'American Airlines', 'Delta Air Lines', 'United Airlines', 'British Airways',
    'Air France', 'Lufthansa', 'Emirates', 'Singapore Airlines', 'Japan Airlines', 'Qatar Airways'
  ];

  const aircraftTypes = [
    'Boeing 737-800', 'Boeing 777-300ER', 'Airbus A320', 'Airbus A350-900',
    'Boeing 787-9', 'Airbus A380-800', 'Boeing 747-8', 'Embraer E175'
  ];

  const flights: Flight[] = [];
  let flightIdCounter = 1000;

  // Generate flights between major airport pairs
  const routes = [
    ['JFK', 'LAX'], ['JFK', 'LHR'], ['JFK', 'CDG'], ['JFK', 'NRT'],
    ['LAX', 'NRT'], ['LAX', 'SIN'], ['LAX', 'SFO'], ['LAX', 'ORD'],
    ['LHR', 'CDG'], ['LHR', 'FRA'], ['LHR', 'DXB'], ['LHR', 'SIN'],
    ['SFO', 'NRT'], ['SFO', 'ORD'], ['ORD', 'FRA'], ['DXB', 'SIN']
  ];

  routes.forEach(([originCode, destCode]) => {
    const origin = getAirportByCode(originCode)!;
    const destination = getAirportByCode(destCode)!;

    // Generate multiple flights per route with different times and airlines
    for (let i = 0; i < 3; i++) {
      const airline = airlines[Math.floor(Math.random() * airlines.length)];
      const aircraft = aircraftTypes[Math.floor(Math.random() * aircraftTypes.length)];
      
      // Generate departure times throughout the day
      const baseDate = new Date();
      baseDate.setDate(baseDate.getDate() + Math.floor(Math.random() * 30)); // Next 30 days
      const departureHour = 6 + (i * 6) + Math.floor(Math.random() * 4); // Spread throughout day
      baseDate.setHours(departureHour, Math.floor(Math.random() * 60), 0, 0);

      // Calculate flight duration based on distance (rough estimate)
      const duration = calculateFlightDuration(originCode, destCode);
      const arrivalTime = new Date(baseDate.getTime() + duration * 60000);

      // Determine if flight has stops
      const hasStops = Math.random() < 0.3; // 30% chance of stops
      const stops = hasStops ? [airports[Math.floor(Math.random() * airports.length)]] : [];

      // Generate pricing
      const basePrice = calculateBasePrice(originCode, destCode);
      const priceVariation = 0.8 + Math.random() * 0.4; // ±20% variation
      const finalPrice = Math.round(basePrice * priceVariation);

      const flight: Flight = {
        id: `FL${flightIdCounter++}`,
        airline,
        flightNumber: `${getAirlineCode(airline)}${Math.floor(Math.random() * 9000) + 1000}`,
        aircraft,
        origin,
        destination,
        departureTime: baseDate,
        arrivalTime,
        duration,
        stops,
        price: {
          amount: finalPrice,
          currency: 'USD',
          taxes: Math.round(finalPrice * 0.15),
          fees: Math.round(finalPrice * 0.05)
        },
        availability: {
          economy: Math.floor(Math.random() * 150) + 50,
          business: Math.floor(Math.random() * 30) + 10,
          first: Math.floor(Math.random() * 10) + 2
        },
        policies: {
          baggage: {
            carry_on: '1 carry-on bag (22x14x9 inches)',
            checked: '1 checked bag up to 50 lbs included'
          },
          cancellation: 'Free cancellation within 24 hours of booking',
          changes: 'Changes allowed with fee starting from $200'
        }
      };

      flights.push(flight);
    }
  });

  return flights;
};

// Helper functions
function calculateFlightDuration(origin: string, destination: string): number {
  // Rough flight durations in minutes based on typical routes
  const durations: { [key: string]: number } = {
    'JFK-LAX': 360, 'LAX-JFK': 300,
    'JFK-LHR': 420, 'LHR-JFK': 480,
    'JFK-CDG': 450, 'CDG-JFK': 510,
    'JFK-NRT': 840, 'NRT-JFK': 780,
    'LAX-NRT': 660, 'NRT-LAX': 600,
    'LAX-SIN': 1020, 'SIN-LAX': 960,
    'LAX-SFO': 90, 'SFO-LAX': 90,
    'LAX-ORD': 240, 'ORD-LAX': 270,
    'LHR-CDG': 90, 'CDG-LHR': 90,
    'LHR-FRA': 120, 'FRA-LHR': 120,
    'LHR-DXB': 420, 'DXB-LHR': 450,
    'LHR-SIN': 780, 'SIN-LHR': 840,
    'SFO-NRT': 600, 'NRT-SFO': 540,
    'SFO-ORD': 240, 'ORD-SFO': 270,
    'ORD-FRA': 480, 'FRA-ORD': 540,
    'DXB-SIN': 420, 'SIN-DXB': 420
  };

  const key = `${origin}-${destination}`;
  const reverseKey = `${destination}-${origin}`;
  
  return durations[key] || durations[reverseKey] || 300; // Default 5 hours
}

function calculateBasePrice(origin: string, destination: string): number {
  // Base prices in USD based on typical route costs
  const basePrices: { [key: string]: number } = {
    'JFK-LAX': 350, 'JFK-LHR': 650, 'JFK-CDG': 700, 'JFK-NRT': 1200,
    'LAX-NRT': 800, 'LAX-SIN': 1100, 'LAX-SFO': 150, 'LAX-ORD': 300,
    'LHR-CDG': 200, 'LHR-FRA': 180, 'LHR-DXB': 500, 'LHR-SIN': 900,
    'SFO-NRT': 750, 'SFO-ORD': 280, 'ORD-FRA': 600, 'DXB-SIN': 400
  };

  const key = `${origin}-${destination}`;
  const reverseKey = `${destination}-${origin}`;
  
  return basePrices[key] || basePrices[reverseKey] || 400; // Default $400
}

function getAirlineCode(airline: string): string {
  const codes: { [key: string]: string } = {
    'American Airlines': 'AA',
    'Delta Air Lines': 'DL',
    'United Airlines': 'UA',
    'British Airways': 'BA',
    'Air France': 'AF',
    'Lufthansa': 'LH',
    'Emirates': 'EK',
    'Singapore Airlines': 'SQ',
    'Japan Airlines': 'JL',
    'Qatar Airways': 'QR'
  };

  return codes[airline] || 'XX';
}

// Export the generated flights for fallback service
export const mockFlights = generateMockFlights();