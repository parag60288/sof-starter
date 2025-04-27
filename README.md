# SMART-on-FHIR Starter

A React application starter template for building SMART-on-FHIR applications using React, TypeScript, and Vite.

## Getting Started

### Prerequisites

- Node.js (version 16.x or later)
- npm (version 7.x or later)

### Installation

a. Clone this repository

```bash
git clone [repository URL]
cd sof-starter
```

b. Install dependencies

```bash
npm install
```

c. Configure environment variables

```bash
# Copy the example environment file
cp .env.example .env
```

You can edit the `.env` file to customize your application settings, including your SMART-on-FHIR client credentials.

### Development

Start the development server:

```bash
npm run dev
```

The application will be available at [https://localhost:5000](https://localhost:5000) with a secure self-signed SSL certificate.

> **Note:** When first accessing the application, your browser might warn about the self-signed certificate. This is expected behavior and you can proceed safely by accepting the certificate.

### Building for Production

Create a production build:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## SMART-on-FHIR Implementation

This project implements a SMART-on-FHIR client to connect to Epic's EHR system. The implementation includes:

- OAuth 2.0 authorization flow with Epic
- Support for EHR launch context with launch tokens
- Secure state management using UUID v4 tokens
- Patient data retrieval
- Error handling for common FHIR API issues
- Display of patient demographics, conditions, and medications

### Launch Flow

The application supports two launch scenarios:

1. **EHR Launch**: When launched from within an EHR system (like Epic), the app receives a launch token via the `/launch` endpoint. This allows the app to access context information about the current patient and user session.

   Example EHR launch URL:

   ```http
   https://localhost:5000/launch?iss=https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4&launch=xyz123
   ```

   The app captures the `launch` token and `iss` (FHIR server URL) parameters and passes them to the FHIR authorization process.

2. **Standalone Launch**: When launched directly from the app's home page, it initiates a standalone launch without context.

Both flows direct to the `/launch-callback` endpoint after successful authentication to process the FHIR authorization response.

### State Management

The application uses UUID v4 tokens to secure the OAuth 2.0 authorization flow:

1. A unique `stateKey` is generated for each authorization attempt using UUID v4
2. This state key is used to prevent CSRF attacks and to maintain session context
3. The state parameter is verified during the OAuth callback process

This implementation follows security best practices for SMART-on-FHIR applications.

### FHIR Endpoints

The application uses the following FHIR resources:

- Patient: To retrieve patient demographics
- Condition: To retrieve patient conditions/problems
- MedicationRequest: To retrieve patient medications

### Getting Epic API Access

To use this application with real Epic EHR data:

1. Register your application in the [Epic App Orchard](https://apporchard.epic.com/)
2. Obtain a client ID and other necessary credentials
3. Configure the `.env` file with your credentials
4. Update the redirect URI in your App Orchard registration to match your deployment URL

For testing, you can use Epic's sandbox environment.

## SSL Configuration

This project uses `vite-plugin-mkcert` to automatically generate and install self-signed SSL certificates for local development. This is important for SMART-on-FHIR applications which typically require HTTPS.

The certificates are generated automatically when you run the development server.

## Environment Variables

| Variable               | Description                                | Default                                                     |
| ---------------------- | ------------------------------------------ | ----------------------------------------------------------- |
| VITE_APP_TITLE         | Application title shown in the browser tab | SMART-on-FHIR Starter                                       |
| VITE_FHIR_CLIENT_ID    | Your Epic client ID                        | your-client-id                                              |
| VITE_FHIR_SCOPE        | OAuth scopes for Epic                      | launch/patient patient/\*.read                              |
| VITE_FHIR_REDIRECT_URI | OAuth redirect URI                         | <https://localhost:5000/launch-callback>                    |
| VITE_FHIR_ISS          | Epic FHIR server URL                       | <https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4> |

## Dependencies

Key dependencies for this project include:

- **React** and **React Router DOM**: For UI and routing
- **TypeScript**: For type-safe code
- **Vite**: For fast development and building
- **fhirclient**: For SMART-on-FHIR integration
- **uuid**: For generating unique state keys for OAuth security

## Project Structure

```sh
/
├── public/            # Static assets
├── src/
│   ├── assets/        # Images, fonts, etc.
│   ├── components/    # Reusable React components
│   │   ├── Home.tsx            # Home page component
│   │   ├── Launch.tsx          # EHR launch handler
│   │   ├── LaunchCallback.tsx  # OAuth callback handler
│   │   ├── PatientDashboard.tsx # Patient data display
│   │   └── Test.tsx            # Test route component
│   ├── services/
│   │   └── FHIRService.ts      # SMART-on-FHIR client service
│   ├── App.tsx        # Main application component with routing
│   ├── main.tsx       # Entry point
│   └── index.css      # Global styles
├── .env               # Environment variables (not in version control)
├── .env.example       # Example environment variables
└── vite.config.ts     # Vite configuration
```

## Error Handling

The application implements robust error handling for common FHIR client issues:

- Authentication failures
- Network connectivity issues
- Missing or malformed API responses
- Client initialization problems

Errors are presented to users with appropriate messages and recovery options.

## License

[MIT](LICENSE)
