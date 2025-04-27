import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import FHIRService, { FHIRError, FHIRErrorType } from "../services/FHIRService";

const Launch: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [launchInfo, setLaunchInfo] = useState<{
    launch?: string;
    iss?: string;
    apptoken?: string;
  }>({});

  useEffect(() => {
    // Clear any previous state key to ensure we're starting fresh
    localStorage.removeItem("fhir_state_key");

    const handleLaunch = async () => {
      setError(null);
      try {
        // Parse the URL parameters
        const queryParams = new URLSearchParams(location.search);
        const launchToken = queryParams.get("launch");
        const issServer = queryParams.get("iss");
        const appToken = queryParams.get("apptoken");

        // Check for required apptoken
        if (!appToken) {
          throw new FHIRError(
            "Missing required apptoken parameter",
            FHIRErrorType.AUTH_ERROR
          );
        }

        if (!launchToken || !issServer) {
          throw new FHIRError(
            "Missing required launch parameters (launch token and/or iss)",
            FHIRErrorType.AUTH_ERROR
          );
        }

        setLaunchInfo({
          launch: launchToken,
          iss: issServer,
          apptoken: appToken,
        });

        console.log(
          `Received launch token: ${launchToken} from server: ${issServer} with apptoken: ${appToken}`
        );

        setTimeout(async () => {
          // Pass the launch parameters to the FHIRService
          await FHIRService.authorize({
            launch: launchToken,
            iss: issServer,
          });
        }, 2000);

        // The authorize method will redirect to the EHR's auth server,
        // so any code below this line won't execute immediately
      } catch (err) {
        let errorMsg = "Failed to initiate SMART launch";

        if (err instanceof FHIRError) {
          errorMsg = `${err.type}: ${err.message}`;
        } else if (err instanceof Error) {
          errorMsg = err.message;
        }

        setError(errorMsg);
        console.error("Launch error:", err);
      }
    };

    handleLaunch();
  }, [location.search]);

  const handleReturnHome = () => {
    // Clear any storage before returning home
    localStorage.removeItem("fhir_state_key");
    navigate("/");
  };

  // This will only show if there's an error, otherwise the page redirects
  return (
    <div className="loading-container">
      {error ? (
        <div className="error-container">
          <h2>Launch Error</h2>
          <p>{error}</p>

          {launchInfo.launch && (
            <div className="debug-info">
              <h3>Launch Parameters</h3>
              <pre>{JSON.stringify(launchInfo, null, 2)}</pre>
            </div>
          )}

          <button onClick={handleReturnHome}>Go Home</button>
        </div>
      ) : (
        <>
          <h2>Launching SMART-on-FHIR App</h2>
          <p>Connecting to EHR system...</p>
          <div className="spinner"></div>
        </>
      )}
    </div>
  );
};

export default Launch;
