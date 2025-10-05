import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

function App() {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h1>🚀 AI-Powered Flight Booking Assistant</h1>
      <p>Backend running on port 3000</p>
      <p>Frontend running on port 3001</p>
      <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
        <h2>System Status</h2>
        <p>✅ Backend API: Running</p>
        <p>✅ Frontend: Running</p>
        <p>⚠️ Payment Service: Mock mode</p>
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);