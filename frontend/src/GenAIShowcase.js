import React, { useState } from 'react';

function GenAIShowcase() {
  const [activeTab, setActiveTab] = useState('semantic-search');
  const [semanticQuery, setSemanticQuery] = useState('');
  const [semanticResults, setSemanticResults] = useState(null);
  const [pricePrediction, setPricePrediction] = useState(null);
  const [ragQuestion, setRagQuestion] = useState('');
  const [ragAnswer, setRagAnswer] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSemanticSearch = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/genai/semantic-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: semanticQuery, topK: 5, minScore: 0.5 })
      });
      const data = await response.json();
      setSemanticResults(data);
    } catch (error) {
      setSemanticResults({ success: false, error: error.message });
    }
    setLoading(false);
  };

  const handlePricePrediction = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/genai/predict-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: 'JFK',
          destination: 'LAX',
          departureDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          currentPrice: 450
        })
      });
      const data = await response.json();
      setPricePrediction(data);
    } catch (error) {
      setPricePrediction({ success: false, error: error.message });
    }
    setLoading(false);
  };

  const handleRAGQuery = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/api/genai/rag-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: ragQuestion })
      });
      const data = await response.json();
      setRagAnswer(data);
    } catch (error) {
      setRagAnswer({ success: false, error: error.message });
    }
    setLoading(false);
  };

  const styles = {
    container: { minHeight: '100vh', backgroundColor: '#0f172a', color: '#fff', fontFamily: 'system-ui' },
    header: { background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', padding: '40px 20px', textAlign: 'center' },
    title: { fontSize: '2.5rem', marginBottom: '10px', fontWeight: '700' },
    subtitle: { fontSize: '1.2rem', opacity: 0.9 },
    content: { maxWidth: '1400px', margin: '0 auto', padding: '40px 20px' },
    tabs: { display: 'flex', gap: '10px', marginBottom: '30px', flexWrap: 'wrap' },
    tab: (active) => ({
      padding: '12px 24px',
      backgroundColor: active ? '#667eea' : '#1e293b',
      border: 'none',
      borderRadius: '8px',
      color: '#fff',
      cursor: 'pointer',
      fontSize: '16px',
      fontWeight: active ? '600' : '400',
      transition: 'all 0.3s'
    }),
    card: { backgroundColor: '#1e293b', borderRadius: '12px', padding: '30px', marginBottom: '20px' },
    input: { width: '100%', padding: '12px', backgroundColor: '#0f172a', border: '2px solid #334155', borderRadius: '8px', color: '#fff', fontSize: '16px', marginBottom: '15px' },
    button: { padding: '12px 24px', backgroundColor: '#667eea', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '16px', fontWeight: '600' },
    result: { backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px', marginTop: '20px', border: '1px solid #334155' },
    badge: { display: 'inline-block', padding: '4px 12px', backgroundColor: '#10b981', borderRadius: '12px', fontSize: '14px', marginRight: '10px' }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>✈️ Your Smart Travel Assistant</h1>
        <p style={styles.subtitle}>Find flights, get answers, and travel smarter with AI</p>
      </div>

      <div style={styles.content}>

        <div style={styles.tabs}>
          <button style={styles.tab(activeTab === 'semantic-search')} onClick={() => setActiveTab('semantic-search')}>
            🔍 Smart Search
          </button>
          <button style={styles.tab(activeTab === 'price-prediction')} onClick={() => setActiveTab('price-prediction')}>
            📊 Price Forecast
          </button>
          <button style={styles.tab(activeTab === 'rag')} onClick={() => setActiveTab('rag')}>
            💬 Ask Questions
          </button>
          <button style={styles.tab(activeTab === 'recommendations')} onClick={() => setActiveTab('recommendations')}>
            ✨ Recommendations
          </button>
          <button style={styles.tab(activeTab === 'overview')} onClick={() => setActiveTab('overview')}>
            ℹ️ About
          </button>
        </div>

        {activeTab === 'semantic-search' && (
          <div style={styles.card}>
            <h2 style={{ marginBottom: '20px' }}>🔍 Smart Flight Search</h2>
            <p style={{ color: '#94a3b8', marginBottom: '20px' }}>
              Describe what you're looking for in your own words. Our AI understands what you mean, not just what you type.
            </p>
            <input
              style={styles.input}
              placeholder="Try: 'cheap flights to beach destinations' or 'business class to tech hubs'"
              value={semanticQuery}
              onChange={(e) => setSemanticQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSemanticSearch()}
            />
            <button style={styles.button} onClick={handleSemanticSearch} disabled={loading}>
              {loading ? '⏳ Searching...' : '🔍 Find Flights'}
            </button>

            {semanticResults && (
              <div style={styles.result}>
                {semanticResults.success ? (
                  <>
                    <h3 style={{ marginBottom: '15px' }}>Found {semanticResults.data?.results?.length || 0} flights</h3>
                    {semanticResults.data?.results?.map((flight, idx) => (
                      <div key={idx} style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <strong>{flight.airline} {flight.flightNumber}</strong>
                            <div style={{ color: '#94a3b8', fontSize: '14px' }}>
                              {flight.origin} → {flight.destination}
                            </div>
                          </div>
                          <div>
                            <div style={{ fontSize: '20px', fontWeight: '700', color: '#10b981' }}>${flight.price}</div>
                            <div style={{ fontSize: '12px', color: '#94a3b8' }}>Score: {(flight.score * 100).toFixed(1)}%</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  <div style={{ color: '#ef4444' }}>Error: {semanticResults.error}</div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'price-prediction' && (
          <div style={styles.card}>
            <h2 style={{ marginBottom: '20px' }}>📊 Price Forecast</h2>
            <p style={{ color: '#94a3b8', marginBottom: '20px' }}>
              See if prices are likely to go up or down. We analyze trends to help you decide when to book.
            </p>
            <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
              <div style={{ marginBottom: '10px' }}><strong>Route:</strong> JFK → LAX</div>
              <div style={{ marginBottom: '10px' }}><strong>Date:</strong> 30 days from now</div>
              <div><strong>Current Price:</strong> $450</div>
            </div>
            <button style={styles.button} onClick={handlePricePrediction} disabled={loading}>
              {loading ? '⏳ Analyzing...' : '📊 Check Price Trends'}
            </button>

            {pricePrediction && (
              <div style={styles.result}>
                {pricePrediction.success ? (
                  <>
                    <h3 style={{ marginBottom: '20px' }}>Prediction Results</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                      <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: '700', color: '#10b981' }}>
                          ${pricePrediction.data?.predictedPrice}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '14px' }}>Predicted Price</div>
                      </div>
                      <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: '700', color: '#f59e0b' }}>
                          {pricePrediction.data?.confidence}%
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '14px' }}>Confidence</div>
                      </div>
                      <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '24px', fontWeight: '700', color: pricePrediction.data?.trend === 'up' ? '#ef4444' : '#10b981' }}>
                          {pricePrediction.data?.trend === 'up' ? '↑' : '↓'}
                        </div>
                        <div style={{ color: '#94a3b8', fontSize: '14px' }}>Trend</div>
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#1e293b', padding: '15px', borderRadius: '8px' }}>
                      <strong>💡 Recommendation:</strong> {pricePrediction.data?.recommendation}
                    </div>
                  </>
                ) : (
                  <div style={{ color: '#ef4444' }}>Error: {pricePrediction.error}</div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'rag' && (
          <div style={styles.card}>
            <h2 style={{ marginBottom: '20px' }}>💬 Ask Questions</h2>
            <p style={{ color: '#94a3b8', marginBottom: '20px' }}>
              Have questions about baggage, cancellations, or travel policies? Ask away and get instant answers.
            </p>
            <input
              style={styles.input}
              placeholder="Try: 'What is the baggage allowance?' or 'Can I change my flight?'"
              value={ragQuestion}
              onChange={(e) => setRagQuestion(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleRAGQuery()}
            />
            <button style={styles.button} onClick={handleRAGQuery} disabled={loading}>
              {loading ? '⏳ Finding answer...' : '💬 Get Answer'}
            </button>

            {ragAnswer && (
              <div style={styles.result}>
                {ragAnswer.success ? (
                  <>
                    <h3 style={{ marginBottom: '15px' }}>Answer</h3>
                    <div style={{ backgroundColor: '#1e293b', padding: '20px', borderRadius: '8px', marginBottom: '20px', lineHeight: '1.6' }}>
                      {ragAnswer.data?.answer}
                    </div>
                    {ragAnswer.data?.sources && ragAnswer.data.sources.length > 0 && (
                      <>
                        <h4 style={{ marginBottom: '10px', color: '#94a3b8' }}>📄 Sources</h4>
                        {ragAnswer.data.sources.map((source, idx) => (
                          <div key={idx} style={{ backgroundColor: '#1e293b', padding: '10px', borderRadius: '8px', marginBottom: '8px', fontSize: '14px' }}>
                            {source.content?.substring(0, 150)}...
                          </div>
                        ))}
                      </>
                    )}
                  </>
                ) : (
                  <div style={{ color: '#ef4444' }}>Error: {ragAnswer.error}</div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div style={styles.card}>
            <h2 style={{ marginBottom: '20px' }}>✨ Personalized for You</h2>
            <p style={{ color: '#94a3b8', marginBottom: '20px' }}>
              Discover flights and destinations picked just for you based on your preferences and travel style.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '15px' }}>🎯 For You</h3>
                <div style={styles.badge}>Budget-friendly</div>
                <div style={styles.badge}>Direct flights</div>
                <div style={styles.badge}>Weekend trips</div>
                <p style={{ color: '#94a3b8', marginTop: '15px', fontSize: '14px' }}>
                  Based on your booking history and preferences
                </p>
              </div>
              <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '15px' }}>🔥 Trending</h3>
                <div style={styles.badge}>Paris</div>
                <div style={styles.badge}>Tokyo</div>
                <div style={styles.badge}>Dubai</div>
                <p style={{ color: '#94a3b8', marginTop: '15px', fontSize: '14px' }}>
                  Popular destinations this season
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'overview' && (
          <div style={styles.card}>
            <h2 style={{ marginBottom: '20px' }}>ℹ️ How It Works</h2>
            <div style={{ display: 'grid', gap: '20px' }}>
              <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '10px' }}>🧠 Powered by AI</h3>
                <ul style={{ color: '#94a3b8', lineHeight: '2' }}>
                  <li><strong>Smart Understanding:</strong> Understands what you mean, not just keywords</li>
                  <li><strong>Lightning Fast Search:</strong> Finds the best flights in seconds</li>
                  <li><strong>Instant Answers:</strong> Get answers from our knowledge base instantly</li>
                  <li><strong>Price Intelligence:</strong> Predicts if prices will rise or fall</li>
                </ul>
              </div>
              <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '10px' }}>✨ What Makes Us Different</h3>
                <ul style={{ color: '#94a3b8', lineHeight: '2' }}>
                  <li>Search using everyday language - no codes or complicated forms</li>
                  <li>Know when to book with smart price forecasts</li>
                  <li>Get instant answers to all your travel questions</li>
                  <li>Discover destinations tailored to your preferences</li>
                  <li>Upload documents and get information extracted automatically</li>
                  <li>Receive helpful tips and alerts throughout your journey</li>
                </ul>
              </div>
              <div style={{ backgroundColor: '#0f172a', padding: '20px', borderRadius: '8px' }}>
                <h3 style={{ marginBottom: '10px' }}>🌟 Your Travel Assistant</h3>
                <div style={{ fontSize: '14px', color: '#94a3b8', lineHeight: '2' }}>
                  <div>✓ Search flights naturally - just describe what you need</div>
                  <div>✓ Get price predictions to book at the right time</div>
                  <div>✓ Ask any travel question and get instant answers</div>
                  <div>✓ Receive personalized destination recommendations</div>
                  <div>✓ Upload travel documents for quick information extraction</div>
                  <div>✓ Get proactive help and travel tips along the way</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GenAIShowcase;
