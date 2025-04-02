import React, { useState } from 'react';
import FHIRService, { FHIRError } from '../services/FHIRService';

const Home: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);

    try {
      // Start SMART-on-FHIR standalone authorization process (no launch token)
      await FHIRService.authorize();
      // The authorize method will redirect to Epic's login page
    } catch (err) {
      setLoading(false);
      let errorMsg = 'Failed to connect to FHIR server';
      
      if (err instanceof FHIRError) {
        errorMsg = err.message;
      } else if (err instanceof Error) {
        errorMsg = err.message;
      }
      
      setError(errorMsg);
      console.error('Authentication error:', err);
    }
  };

  return (
    <div className="app-container">
      <h1>SMART-on-FHIR App Running</h1>
      <p>Your SMART-on-FHIR application is set up and running successfully.</p>
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
        </div>
      )}
      
      <button 
        className="login-button" 
        onClick={handleLogin} 
        disabled={loading}
      >
        {loading ? 'Connecting...' : 'Connect to Epic EHR'}
      </button>
      
      <div className="app-info">
        <p>
          This application uses SMART-on-FHIR to securely connect to Epic's EHR system
          and access patient data with proper authorization.
        </p>
        <p>
          <strong>Launch Options:</strong>
        </p>
        <ul className="launch-options">
          <li>
            <strong>EHR Launch:</strong> Launch from within Epic with a launch context
          </li>
          <li>
            <strong>Standalone Launch:</strong> Connect directly using the button above
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Home; 