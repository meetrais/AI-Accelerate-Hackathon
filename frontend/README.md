# Flight Booking Assistant - Frontend

A React-based frontend for the AI-Powered Flight Booking Assistant, featuring conversational AI interface powered by Vertex AI and Elasticsearch.

## Features

- **Conversational Interface**: Natural language flight search using AI
- **Real-time Chat**: Interactive chat interface with flight recommendations
- **Flight Search**: Advanced search with filters and sorting
- **Booking Management**: Complete booking flow from search to confirmation
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **TypeScript**: Full type safety throughout the application

## Tech Stack

- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **React Router** for navigation
- **Axios** for API communication
- **React Hot Toast** for notifications
- **Heroicons** for icons
- **Date-fns** for date formatting

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- Backend API server running on port 3000

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Update the `.env` file with your API URL if different from default.

### Development

Start the development server:
```bash
npm start
```

The app will open at [http://localhost:3001](http://localhost:3001).

### Building for Production

```bash
npm run build
```

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── Chat/           # Chat interface components
│   └── Layout/         # Layout components
├── contexts/           # React contexts for state management
├── pages/              # Page components
├── services/           # API service functions
├── types/              # TypeScript type definitions
├── App.tsx             # Main app component
└── index.tsx           # App entry point
```

## Key Components

### Chat Interface
- `ChatInterface`: Main chat component with expandable interface
- `ChatMessage`: Individual message display with markdown support
- `FlightOptions`: Flight results display with booking actions
- `SuggestedActions`: Quick action buttons for common queries

### Pages
- `HomePage`: Landing page with feature overview
- `SearchPage`: Flight search with chat integration
- `BookingPage`: Multi-step booking process
- `ConfirmationPage`: Booking confirmation and details
- `MyBookingsPage`: User booking management

### Contexts
- `ChatContext`: Manages chat sessions and messages
- `BookingContext`: Handles booking flow and state

## API Integration

The frontend communicates with the backend API for:
- Natural language query processing
- Flight search and recommendations
- Booking creation and management
- Payment processing
- User session management

## Styling

Uses Tailwind CSS with custom components defined in `src/index.css`:
- Button variants (`btn-primary`, `btn-secondary`, `btn-outline`)
- Form inputs (`input-field`)
- Chat message styles
- Loading animations

## Environment Variables

- `REACT_APP_API_URL`: Backend API base URL (default: http://localhost:3000/api)
- `REACT_APP_ENV`: Environment (development/production)

## Available Scripts

- `npm start`: Start development server
- `npm run build`: Build for production
- `npm test`: Run tests
- `npm run eject`: Eject from Create React App (not recommended)