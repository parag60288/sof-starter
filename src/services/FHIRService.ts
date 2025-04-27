import FHIR from "fhirclient";
import Client from "fhirclient/lib/Client";
import { v4 as uuidv4 } from "uuid";
import ehrCredentials from "../configs/ehrCredentials.config.json";

// Define types for EHR credentials
interface EhrCredential {
  clientId: string;
  clientSecret: string;
  scope: string;
  redirectUri: string;
  iss: string;
}

// Define types for FHIR client state
interface FhirClientState {
  serverUrl: string;
  tokenResponse: {
    access_token: string;
    token_type: "bearer" | "Bearer";
    expires_in: number;
    scope: string;
    launch_response?: Record<string, unknown>;
  };
}

// Generate a unique state key for this session
const sessionStateKey = uuidv4();

// Track API call status to prevent duplicates in React's StrictMode
const apiCallTracker = {
  isAuthenticatedInProgress: false,
  isAuthenticatedTimestamp: 0,
  getPatientInProgress: false,
  getPatientTimestamp: 0,
  getConditionsInProgress: false,
  getConditionsTimestamp: 0,
  getMedicationsInProgress: false,
  getMedicationsTimestamp: 0,
  getInsuranceInProgress: false,
  getInsuranceTimestamp: 0,
  authProcessed: false,
};

// Debounce time in milliseconds to prevent duplicate calls
const DEBOUNCE_TIME = 300;

// Interface for error display
interface ErrorDisplay {
  showError: (message: string) => void;
}

// Get EHR credentials based on apptoken
const getEhrCredentials = (apptoken: string | null): EhrCredential => {
  if (!apptoken) {
    const error = new FHIRError(
      "Apptoken is required for EHR authentication",
      FHIRErrorType.AUTH_ERROR
    );
    // Display error on screen
    const fhirService = FHIRService.getInstance();
    fhirService.displayError(error.message);
    throw error;
  }

  const credentials = (ehrCredentials.credentials as Record<string, EhrCredential>)[apptoken];
  if (!credentials) {
    const error = new FHIRError(
      "Invalid apptoken provided",
      FHIRErrorType.AUTH_ERROR
    );
    // Display error on screen
    const fhirService = FHIRService.getInstance();
    fhirService.displayError(error.message);
    throw error;
  }

  return credentials;
};

// Base SMART on FHIR app configuration from environment variables
const getFhirBaseConfig = (apptoken: string | null): EhrCredential => {
  return getEhrCredentials(apptoken);
};

// Error types for better handling
export enum FHIRErrorType {
  AUTH_ERROR = "Authentication Error",
  CONNECTION_ERROR = "Connection Error",
  API_ERROR = "API Error",
  NOT_INITIALIZED = "Client Not Initialized",
  UNKNOWN_ERROR = "Unknown Error",
}

// Custom error class for FHIR-related errors
export class FHIRError extends Error {
  constructor(
    message: string,
    public type: FHIRErrorType,
    public originalError?: unknown
  ) {
    super(message);
    this.name = "FHIRError";
  }
}

// Interface for launch parameters
export interface LaunchParams {
  iss?: string;
  launch?: string;
}

// Interface for launch context
interface LaunchContext {
  smart: FhirClientState["tokenResponse"];
  patient?: string;
  encounter?: string;
  user?: string;
  launchResponse?: Record<string, unknown>;
}

// Interface for patient data
interface PatientData {
  id: string;
  name: string;
  gender?: string;
  birthDate?: string;
}

// Interface for error state
interface ErrorState {
  message: string;
  type: FHIRErrorType;
}

class FHIRService {
  private static instance: FHIRService | null = null;
  private client: Client | null = null;
  private currentStateKey: string = sessionStateKey;
  private currentAppToken: string | null = null;
  private errorDisplay: ErrorDisplay | null = null;

  private constructor() {}

  /**
   * Get the singleton instance of FHIRService
   */
  public static getInstance(): FHIRService {
    if (!FHIRService.instance) {
      FHIRService.instance = new FHIRService();
    }
    return FHIRService.instance;
  }

  /**
   * Set the error display handler
   * @param display The error display implementation
   */
  public setErrorDisplay(display: ErrorDisplay): void {
    this.errorDisplay = display;
  }

  /**
   * Display an error message
   * @param message The error message to display
   */
  public displayError(message: string): void {
    if (this.errorDisplay) {
      this.errorDisplay.showError(message);
    } else {
      console.error("Error display not configured:", message);
      // Fallback to alert if no error display is configured
      alert(message);
      // TODO: show error message on loading card
    }
  }

  /**
   * Initialize the FHIR client and begin authorization flow
   * @param launchParams Optional launch parameters from EHR
   */
  async authorize(launchParams?: LaunchParams): Promise<void> {
    try {
      // Prevent double execution in React StrictMode
      if (apiCallTracker.authProcessed) {
        console.log("Authorization already processed, skipping duplicate call");
        return;
      }

      apiCallTracker.authProcessed = true;

      // Store the state key for this session - we'll need it during the callback
      localStorage.setItem("fhir_state_key", this.currentStateKey);

      // Get apptoken from URL if present
      const urlParams = new URLSearchParams(window.location.search);
      this.currentAppToken = urlParams.get("apptoken");

      // Validate apptoken
      if (!this.currentAppToken) {
        throw new FHIRError(
          "Apptoken is required for EHR authentication",
          FHIRErrorType.AUTH_ERROR
        );
      }

      // Merge base config with any supplied launch parameters
      const clientConfig = {
        ...getFhirBaseConfig(this.currentAppToken),
        ...(launchParams || {}),
        stateKey: this.currentStateKey,
      };

      console.log(`Authorizing with state key: ${this.currentStateKey}`);
      console.log(`Using apptoken: ${this.currentAppToken}`);
      console.log(`Full config: ${JSON.stringify(clientConfig)}`);

      // Log the launch config for debugging
      if (launchParams?.launch) {
        console.log(`Authorizing with launch token: ${launchParams.launch}`);
        console.log(
          `Authorization server: ${
            launchParams.iss || getFhirBaseConfig(this.currentAppToken).iss
          }`
        );
      }

      const result = await FHIR.oauth2.authorize(clientConfig);
      // Type guard to ensure we have a valid client
      if (!result || typeof result === "string") {
        throw new FHIRError(
          "Invalid client received during authorization",
          FHIRErrorType.AUTH_ERROR
        );
      }
      this.client = result;
    } catch (error) {
      console.error("Authorization error:", error);
      throw error;
    }
  }

  /**
   * Get the launch context information
   * Available only after successful authentication with a launch token
   */
  getLaunchContext(): LaunchContext {
    if (!this.client) {
      throw new FHIRError(
        "FHIR client not initialized",
        FHIRErrorType.NOT_INITIALIZED
      );
    }

    try {
      // Basic context information
      const context: LaunchContext = {
        smart: {
          access_token: this.client.state.tokenResponse?.access_token || "",
          token_type:
            (this.client.state.tokenResponse?.token_type as
              | "bearer"
              | "Bearer") || "bearer",
          expires_in: this.client.state.tokenResponse?.expires_in || 0,
          scope: this.client.state.tokenResponse?.scope || "",
          launch_response: this.client.state.tokenResponse?.launch_response,
        },
      };

      // Try to get patient context if available
      try {
        if (this.client.patient?.id) {
          context.patient = this.client.patient.id;
        }
      } catch (error: unknown) {
        console.warn("Patient context not available:", error);
      }

      // Try to get encounter context if available
      try {
        if (this.client.encounter?.id) {
          context.encounter = this.client.encounter.id;
        }
      } catch (error: unknown) {
        console.warn("Encounter context not available:", error);
      }

      // Try to get user context if available
      try {
        if (this.client.user?.id) {
          context.user = this.client.user.id;
        }
      } catch (error: unknown) {
        console.warn("User context not available:", error);
      }

      // Access any custom context properties that might be available
      if (this.client.state.tokenResponse?.launch_response) {
        context.launchResponse =
          this.client.state.tokenResponse.launch_response;
      }

      return context;
    } catch (error: unknown) {
      console.error("Error getting launch context:", error);
      throw new FHIRError(
        "Failed to retrieve launch context",
        FHIRErrorType.API_ERROR,
        error
      );
    }
  }

  /**
   * Checks if user is already authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      console.log("Checking authentication status...");

      // Prevent duplicate calls using debounce
      const now = Date.now();
      if (
        apiCallTracker.isAuthenticatedInProgress ||
        now - apiCallTracker.isAuthenticatedTimestamp < DEBOUNCE_TIME
      ) {
        console.log(
          "Authentication check in progress or recently completed, using cached result"
        );
        return !!this.client;
      }

      apiCallTracker.isAuthenticatedInProgress = true;
      apiCallTracker.isAuthenticatedTimestamp = now;

      // If we already have a client instance, use it
      if (this.client) {
        console.log("Using existing client instance");
        apiCallTracker.isAuthenticatedInProgress = false;
        return true;
      }

      // Retrieve the state key that was used during authorization
      const savedStateKey =
        localStorage.getItem("fhir_state_key") || this.currentStateKey;
      console.log(`Using state key for authentication: ${savedStateKey}`);

      // Pass the state key as part of the options object
      const result = await FHIR.oauth2.ready(
        // Cast to any to bypass TypeScript type checking for the stateKey property
        { stateKey: savedStateKey } as any
      );

      // Type guard to ensure we have a valid client
      if (!result || typeof result === "string") {
        console.error("Authentication failed: Invalid client result", result);
        apiCallTracker.isAuthenticatedInProgress = false;
        return false;
      }

      console.log("FHIR client successfully initialized");
      this.client = result;

      // Check if we have a valid patient context (for EHR launches)
      try {
        const patientId = this.client.patient.id;
        console.log(
          `Authenticated with patient context. Patient ID: ${patientId}`
        );
      } catch (e) {
        console.warn(
          "No patient context available. This may be a standalone launch."
        );
      }

      apiCallTracker.isAuthenticatedInProgress = false;
      return true;
    } catch (error) {
      console.error("Authentication error:", error);
      apiCallTracker.isAuthenticatedInProgress = false;
      return false;
    }
  }

  /**
   * Get the current patient information
   */
  async getPatient(): Promise<any> {
    try {
      // Prevent duplicate calls using debounce
      const now = Date.now();
      if (
        apiCallTracker.getPatientInProgress ||
        now - apiCallTracker.getPatientTimestamp < DEBOUNCE_TIME
      ) {
        console.log(
          "getPatient call in progress or recently completed, using cached result"
        );
        return await this.getCachedPromise("getPatient");
      }

      apiCallTracker.getPatientInProgress = true;
      apiCallTracker.getPatientTimestamp = now;

      if (!this.client) {
        throw new FHIRError(
          "FHIR client not initialized",
          FHIRErrorType.NOT_INITIALIZED
        );
      }

      const result = await this.client.patient.read();
      this.cachePromiseResult("getPatient", result);

      apiCallTracker.getPatientInProgress = false;
      return result;
    } catch (error) {
      apiCallTracker.getPatientInProgress = false;
      if (error instanceof FHIRError) {
        throw error;
      }
      console.error("Failed to get patient data:", error);
      throw new FHIRError(
        "Failed to get patient data",
        FHIRErrorType.API_ERROR,
        error
      );
    }
  }

  /**
   * Get patient's conditions/problems
   */
  async getConditions(): Promise<any> {
    try {
      // Prevent duplicate calls using debounce
      const now = Date.now();
      if (
        apiCallTracker.getConditionsInProgress ||
        now - apiCallTracker.getConditionsTimestamp < DEBOUNCE_TIME
      ) {
        console.log(
          "getConditions call in progress or recently completed, using cached result"
        );
        return await this.getCachedPromise("getConditions");
      }

      apiCallTracker.getConditionsInProgress = true;
      apiCallTracker.getConditionsTimestamp = now;

      if (!this.client) {
        throw new FHIRError(
          "FHIR client not initialized",
          FHIRErrorType.NOT_INITIALIZED
        );
      }

      const result = await this.client.request(
        `Condition?patient=${this.client.patient.id}`
      );
      this.cachePromiseResult("getConditions", result);

      apiCallTracker.getConditionsInProgress = false;
      return result;
    } catch (error) {
      apiCallTracker.getConditionsInProgress = false;
      console.error("Failed to get conditions:", error);
      throw new FHIRError(
        "Failed to fetch patient conditions",
        FHIRErrorType.API_ERROR,
        error
      );
    }
  }

  /**
   * Get patient's medications
   */
  async getMedications(): Promise<any> {
    try {
      // Prevent duplicate calls using debounce
      const now = Date.now();
      if (
        apiCallTracker.getMedicationsInProgress ||
        now - apiCallTracker.getMedicationsTimestamp < DEBOUNCE_TIME
      ) {
        console.log(
          "getMedications call in progress or recently completed, using cached result"
        );
        return await this.getCachedPromise("getMedications");
      }

      apiCallTracker.getMedicationsInProgress = true;
      apiCallTracker.getMedicationsTimestamp = now;

      if (!this.client) {
        throw new FHIRError(
          "FHIR client not initialized",
          FHIRErrorType.NOT_INITIALIZED
        );
      }

      const result = await this.client.request(
        `MedicationRequest?patient=${this.client.patient.id}`
      );
      this.cachePromiseResult("getMedications", result);

      apiCallTracker.getMedicationsInProgress = false;
      return result;
    } catch (error) {
      apiCallTracker.getMedicationsInProgress = false;
      console.error("Failed to get medications:", error);
      throw new FHIRError(
        "Failed to fetch patient medications",
        FHIRErrorType.API_ERROR,
        error
      );
    }
  }

  /**
   * Get patient's insurance coverage information
   */
  async getInsurance(): Promise<any> {
    try {
      // Prevent duplicate calls using debounce
      const now = Date.now();
      if (
        apiCallTracker.getInsuranceInProgress ||
        now - apiCallTracker.getInsuranceTimestamp < DEBOUNCE_TIME
      ) {
        console.log(
          "getInsurance call in progress or recently completed, using cached result"
        );
        return await this.getCachedPromise("getInsurance");
      }

      apiCallTracker.getInsuranceInProgress = true;
      apiCallTracker.getInsuranceTimestamp = now;

      if (!this.client) {
        throw new FHIRError(
          "FHIR client not initialized",
          FHIRErrorType.NOT_INITIALIZED
        );
      }

      // Fetch Coverage resources for the patient
      const result = await this.client.request(
        `Coverage?patient=${this.client.patient.id}`
      );
      
      // Also fetch related data - payers (Organization resources)
      if (result.entry && result.entry.length > 0) {
        try {
          // Extract payer references from coverage entries
          const payerReferences = result.entry
            .map((entry: any) => entry.resource.payor)
            .flat()
            .filter((payor: any) => payor && payor.reference)
            .map((payor: any) => payor.reference);
          
          // Fetch unique payer organizations
          const uniqueReferences = [...new Set(payerReferences)] as string[];
          
          if (uniqueReferences.length > 0) {
            // Fetch each payer organization and add to result
            const payerPromises = uniqueReferences.map((reference: string) => 
              this.client?.request(reference)
            );
            
            if (payerPromises.length > 0) {
              const payers = await Promise.all(payerPromises as Promise<any>[]);
              result.payers = payers;
            }
          }
        } catch (error) {
          console.warn("Error fetching payer details:", error);
          // Continue with the basic coverage info even if payer details fail
        }
      }
      
      this.cachePromiseResult("getInsurance", result);

      apiCallTracker.getInsuranceInProgress = false;
      return result;
    } catch (error) {
      apiCallTracker.getInsuranceInProgress = false;
      console.error("Failed to get insurance information:", error);
      throw new FHIRError(
        "Failed to fetch patient insurance information",
        FHIRErrorType.API_ERROR,
        error
      );
    }
  }

  // Cache for storing promise results
  private promiseCache: Record<string, any> = {};

  // Store promise result in cache
  private cachePromiseResult(key: string, result: any): void {
    this.promiseCache[key] = result;
  }

  // Get cached promise result
  private getCachedPromise(key: string): Promise<any> {
    return Promise.resolve(this.promiseCache[key]);
  }

  /**
   * Reset API call trackers - useful for testing or error recovery
   */
  resetTrackers(): void {
    Object.keys(apiCallTracker).forEach((key) => {
      if (key.includes("InProgress")) {
        (apiCallTracker as any)[key] = false;
      } else if (key.includes("Timestamp")) {
        (apiCallTracker as any)[key] = 0;
      } else if (key === "authProcessed") {
        apiCallTracker.authProcessed = false;
      }
    });
    this.promiseCache = {};
  }

  /**
   * Logout - end the current session
   */
  logout(): void {
    try {
      console.log("Logging out...");

      // Clear the stored state key
      localStorage.removeItem("fhir_state_key");

      // Clear any session/token storage used by FHIR.js client
      if (this.client) {
        try {
          // Try to access token-related data to revoke or clear if possible
          const tokenResponse = (this.client as any).state?.tokenResponse;
          if (tokenResponse) {
            console.log("Clearing token data from client");
          }
        } catch (e) {
          console.warn("Could not access token data", e);
        }
      }

      // Clear the client reference
      this.client = null;

      // Reset all API trackers
      this.resetTrackers();

      // Some FHIR servers support revoking tokens, but this isn't universally implemented
      // For now, just clear local state and token storage

      // Clear session storage
      sessionStorage.clear();

      // Clear any FHIR-related cookies or storage
      // This is a simple approach - adjust based on what your application needs
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.startsWith("fhir") ||
            key.startsWith("smart") ||
            key.includes("token"))
        ) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach((key) => {
        console.log(`Removing storage key: ${key}`);
        localStorage.removeItem(key);
      });

      console.log("Logout complete");
    } catch (error) {
      console.error("Error during logout:", error);
      // Still clear the client even if there's an error
      this.client = null;
      // Make sure trackers are reset
      this.resetTrackers();
    }
  }
}

// Export as singleton
export default FHIRService.getInstance();
