import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FHIRService, { FHIRError, FHIRErrorType } from '../services/FHIRService';

interface PatientData {
  name: string;
  gender?: string;
  birthDate?: string;
  id: string;
}

interface ErrorState {
  message: string;
  type: FHIRErrorType;
}

const PatientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [patient, setPatient] = useState<PatientData | null>(null);
  const [conditions, setConditions] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<ErrorState | null>(null);
  const [launchContext, setLaunchContext] = useState<any>(null);

  // Ref to track if the component is mounted
  const isMounted = useRef(true);

  useEffect(() => {
    setError(null);
    // Set mounted flag
    isMounted.current = true;

    const loadPatientData = async () => {
      try {
        console.log('Loading patient dashboard data...');

        // Check if authenticated
        const isAuth = await FHIRService.isAuthenticated();
        if (!isAuth) {
          console.error('Not authenticated, redirecting to home');
          if (isMounted.current) navigate('/');
          return;
        }

        console.log('Successfully authenticated, retrieving launch context');

        // Try to get launch context
        try {
          const context = FHIRService.getLaunchContext();
          if (isMounted.current) setLaunchContext(context);
          console.log('Launch context retrieved:', context);
        } catch (e) {
          console.warn('Could not retrieve launch context:', e);
        }

        // Get patient data
        try {
          const patientData = await FHIRService.getPatient();

          // Extract patient info safely
          const givenName = patientData.name?.[0]?.given?.join(' ') || '';
          const familyName = patientData.name?.[0]?.family || '';
          const patientName = givenName + (givenName && familyName ? ' ' : '') + familyName;

          if (isMounted.current) {
            setPatient({
              name: patientName || 'Unknown Patient',
              gender: patientData.gender,
              birthDate: patientData.birthDate,
              id: patientData.id
            });
          }
          console.log('Patient data loaded:', patientData.id);
        } catch (e) {
          console.error('Failed to load patient data:', e);
          if (isMounted.current) {
            setPatient({
              name: 'Unknown Patient',
              id: 'unknown'
            });
          }
        }

        // Get conditions
        try {
          const conditionsData = await FHIRService.getConditions();
          if (isMounted.current) setConditions(conditionsData.entry || []);
          console.log('Conditions loaded:', conditionsData.entry?.length || 0, 'conditions');
        } catch (e) {
          console.error('Failed to load conditions:', e);
          if (isMounted.current) setConditions([]);
        }

        // Get medications
        try {
          const medicationsData = await FHIRService.getMedications();
          if (isMounted.current) setMedications(medicationsData.entry || []);
          console.log('Medications loaded:', medicationsData.entry?.length || 0, 'medications');
        } catch (e) {
          console.error('Failed to load medications:', e);
          if (isMounted.current) setMedications([]);
        }

      } catch (error) {
        console.error('Error loading patient data:', error);

        if (error instanceof FHIRError) {
          if (isMounted.current) {
            setError({
              message: error.message,
              type: error.type
            });
          }
        } else {
          if (isMounted.current) {
            setError({
              message: 'An unexpected error occurred',
              type: FHIRErrorType.UNKNOWN_ERROR
            });
          }
        }
      } finally {
        if (isMounted.current) setLoading(false);
      }
    };

    loadPatientData();

    // Cleanup function
    return () => {
      // Mark component as unmounted
      isMounted.current = false;
    };
  }, [navigate]);

  const handleLogout = () => {
    try {
      console.log('Initiating logout process...');
      // Call the FHIRService logout method
      FHIRService.logout();
      console.log('Logout successful, redirecting to home');
      // Redirect to home page
      navigate('/');
    } catch (error) {
      console.error('Error during logout:', error);
      // If there's an error, we still want to redirect to home
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <h2>Loading patient data...</h2>
        <div className="spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error: {error.type}</h2>
        <p>{error.message}</p>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="logo-row">
        <img src="/images/logo-left.png" alt="Left Logo" className="logo-left" />
        <img src="/images/logo-right.png" alt="Right Logo" className="logo-right" />
      </div>
      <div className="dashboard-header">
        <h1 style={{ fontSize: '2rem' }}>Patient Dashboard</h1>
        <p style={{ textAlign: 'left' }}>
          {launchContext.smart.epicUserId && <><span>&#128100; {launchContext.smart.epicUserId}</span><br /></>}
          <span style={{fontSize: '0.95rem'}} title="Request initiated at:">&#9200; {new Date(Date.now() - 10000).toLocaleString()}</span>
        </p>
        {/* <button className="logout-button" onClick={handleLogout}>Logout</button> */}
      </div>

      { /** * launchContext && (
        <div className="launch-context">
          <h3>Launch Context</h3>
          <div className="context-details">
            {launchContext.patient && <p>Patient ID: {launchContext.patient}</p>}
            {launchContext.encounter && <p>Encounter ID: {launchContext.encounter}</p>}
            {launchContext.user && <p>User ID: {launchContext.user}</p>}
            {launchContext.smart && (
              <details>
                <summary>SMART Context</summary>
                <pre className="text-light">{JSON.stringify(launchContext.smart, null, 2)}</pre>
              </details>
            )}
          </div>
        </div>
      ) /** */ }

      {patient && (
        <div className="patient-info">
          <h2>{patient.name}</h2>
          <p>Gender: {patient.gender || 'Not specified'}</p>
          <p>Birth Date: {patient.birthDate || 'Not specified'}</p>
          <p>Patient ID: {patient.id}</p>
        </div>
      )}

      <div className="patient-data">
        <div className="data-section">
          <h3>Conditions ({conditions.length})</h3>
          {conditions.length === 0 ? (
            <p>No conditions found</p>
          ) : (
            <ul className="text-light">
              {conditions.map((condition, index) => (
                <li key={index}>
                  {condition.resource?.code?.coding?.[0]?.display || 'Unknown Condition'}
                  {condition.resource?.clinicalStatus?.coding?.[0]?.code === 'active' &&
                    <span className="active-status"> (Active)</span>
                  }
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="data-section">
          <h3>Medications ({medications.length})</h3>
          {medications.length === 0 ? (
            <p>No medications found</p>
          ) : (
            <ul className="text-light">
              {medications.map((medication, index) => (
                <li key={index}>
                  {medication.resource?.medicationCodeableConcept?.coding?.[0]?.display ||
                    medication.resource?.medicationReference?.display ||
                    'Unknown Medication'}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default PatientDashboard; 