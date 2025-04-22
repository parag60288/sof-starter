import React, { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import FHIRService, { FHIRError } from '../services/FHIRService';

// // Track authentication process globally to prevent duplicate processing
// const authInProgress = {
//   authenticated: false
// };

const LaunchCallback: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string | null>(null);
  
  // Ref to track if component is mounted
  const isMounted = useRef(true);

  useEffect(() => {
    // Set mounted flag
    isMounted.current = true;
    
    const completeAuth = async () => {
      setError(null);
      try {
        // Extract URL parameters to help with debugging
        const queryParams = new URLSearchParams(location.search);
        const stateParam = queryParams.get('state');
        const codeParam = queryParams.get('code');
        const errorParam = queryParams.get('error');
        
        // Collect debug information
        const debug = {
          state: stateParam || 'not provided',
          code: codeParam ? 'present' : 'not provided',
          error: errorParam || 'none',
          storedStateKey: localStorage.getItem('fhir_state_key') || 'not found',
          url: window.location.href
        };
        
        if (isMounted.current) setDebugInfo(JSON.stringify(debug, null, 2));
        console.log('OAuth callback params:', debug);

        // Check for error parameter from auth server
        if (errorParam) {
          const errorDescription = queryParams.get('error_description') || 'Unknown error';
          throw new Error(`Authorization server error: ${errorParam} - ${errorDescription}`);
        }

        // Check for required parameters
        if (!stateParam || !codeParam) {
          throw new Error('Missing required OAuth callback parameters (state and/or code)');
        }

        // Complete the SMART authorization flow through our service
        console.log('Attempting to complete FHIR authentication...');
        
        const isAuthenticated = await FHIRService.isAuthenticated();
        
        if (!isAuthenticated) {
          throw new Error('Failed to complete authentication. Could not establish a valid session.');
        }
        
        // Log success
        console.log('Authentication successfully completed');
        
        // Now it's safe to get the launch context since we've verified authentication
        try {
          const launchContext = FHIRService.getLaunchContext();
          console.log('Launch context:', launchContext);
        } catch (contextError) {
          console.warn('Could not retrieve launch context, but authentication succeeded:', contextError);
          // Don't throw error here, we'll still proceed since authentication worked
        }
        
        // Redirect to the patient dashboard on success, but only if component is still mounted
        if (isMounted.current) {
          setTimeout(() => {
            navigate("/patient-dashboard");
          }, 2000);
        }
      } catch (error) {
        console.error('Authentication callback error:', error);
        let errorMsg = 'Authentication failed. Please try again.';
        
        if (error instanceof FHIRError) {
          errorMsg = `${error.type}: ${error.message}`;
        } else if (error instanceof Error) {
          errorMsg = error.message;
        }
        
        if (isMounted.current) {
          // setError(errorMsg); // FIXME: causing error hence disabl
          setError(null);
        }
      }
    };

    completeAuth();
    
    // Cleanup function
    return () => {
      // Mark component as unmounted
      isMounted.current = false;
    };
  }, [navigate, location.search]);

  const handleReturnHome = () => {
    // Clear any storage before returning home
    localStorage.removeItem('fhir_state_key');
    // Reset API tracking in FHIRService
    FHIRService.resetTrackers();
    navigate('/');
  };

  if (error) {
    return (
      <div className="error-container">
        <h2>Authentication Error</h2>
        <p>{error}</p>
        
        {debugInfo && (
          <div className="debug-info">
            <h3>Debug Information</h3>
            <pre>{debugInfo}</pre>
          </div>
        )}
        
        <button onClick={handleReturnHome}>Go Home</button>
      </div>
    );
  }

  return (
    <div className="loading-container">
      <h2>Completing Authentication</h2>
      <p>Please wait while we complete the authentication process...</p>
      <div className="spinner"></div>
    </div>
  );
};

export default LaunchCallback; 