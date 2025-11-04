/**
 * Slack Relay Bot - Main Application Entry Point
 * 
 * This is the heart of our application that orchestrates all components:
 * 1. Express.js web server for health checks and OAuth endpoints
 * 2. Slack Bot integration for real-time messaging
 * 3. Relay Middleware for connecting to Microsoft Copilot Studio
 * 4. OAuth 2.0 with PKCE flow for secure user authentication
 * 
 * Application Architecture:
 * ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐    ┌──────────────────┐
 * │ Slack Users │ ←→ │  Slack Bot   │ ←→ │ Relay Middleware │ ←→ │ Copilot Studio   │
 * └─────────────┘    └──────────────┘    └─────────────────┘    └──────────────────┘
 *       ↓                    ↓                      ↓                       ↑
 * ┌─────────────┐    ┌──────────────┐    ┌─────────────────┐                │
 * │ Web Browser │ ←→ │ Express App  │ ←→ │ OAuth Flow      │ ←──────────────┘
 * └─────────────┘    └──────────────┘    └─────────────────┘
 * 
 * Key Technologies:
 * - Express.js: Web server for health endpoints and OAuth callback
 * - Slack Bolt SDK: Real-time Slack integration via Socket Mode
 * - Microsoft Agents SDK: Official client for Copilot Studio
 * - OAuth 2.0 + PKCE: Secure authentication with Microsoft Entra ID
 * - MSAL Node: Microsoft Authentication Library for token management
 * 
 * SECURITY CONSIDERATIONS:
 * ⚠️  CURRENT SECURITY LIMITATIONS (development/testing suitable):
 * - PKCE code verifiers stored in memory (not persistent)
 * - No session management or timeout handling
 * - Error messages may leak sensitive information
 * - No rate limiting on authentication endpoints
 * - Base URL constructed from environment (potential header injection)
 * - No CSRF protection on OAuth initiation
 * - Tokens stored in memory without encryption
 * 
 * 🔒 PRODUCTION SECURITY REQUIREMENTS:
 * - Implement persistent session storage with encryption
 * - Add comprehensive input validation and sanitization
 * - Implement rate limiting and abuse detection
 * - Add audit logging for all authentication events
 * - Use secure headers (HSTS, CSP, etc.)
 * - Implement proper CSRF protection
 * - Add request signing validation
 * - Consider implementing JWT for stateless sessions
 * - Add monitoring and alerting for security events
 * - Implement graceful error handling without information leakage
 */

import express from 'express';
import config, { logConfig } from './config/index.js';
import RelayMiddleware from './middleware/relay-middleware.js';
import SlackBot from './integrations/slack-bot.js';
import crypto from 'crypto';

class SlackRelayBotApp {
    /**
     * Constructor: Initialize the main application
     * 
     * Sets up the core components but doesn't start them yet.
     * Think of this as preparing all the pieces before assembly.
     * 
     * Components initialized:
     * - Express.js web server for HTTP endpoints
     * - Relay Middleware for AI communication
     * - Slack Bot for real-time messaging
     * - PKCE code verifier storage for OAuth security
     * 
     * SECURITY NOTE: PKCE code verifiers are stored in memory.
     * In production, consider using Redis or secure session storage.
     */
    constructor() {
        this.app = express();                    // Express web server
        this.relayMiddleware = null;             // Bridge to Copilot Studio
        this.slackBot = null;                    // Slack integration
        this.server = null;                      // HTTP server instance
        
        // Store PKCE code verifiers temporarily for OAuth flow
        // PKCE (Proof Key for Code Exchange) prevents authorization code interception
        // Each user gets a unique code verifier that's verified during token exchange
        this.codeVerifiers = new Map();  // slackUserId -> codeVerifier
    }

    /**
     * Initialize the application
     * 
     * This method sets up all components in the correct order:
     * 1. Log configuration for debugging
     * 2. Set up Express middleware and routes
     * 3. Initialize Relay Middleware (AI connection)
     * 4. Initialize Slack Bot (if tokens are configured)
     * 
     * The initialization is designed to be resilient:
     * - If Slack tokens are missing, the app still starts (useful for testing)
     * - Configuration is logged for debugging
     * - Each step is logged for visibility
     * 
     * SECURITY CONSIDERATION: Configuration logging may expose sensitive
     * information. Review logConfig() implementation for production use.
     */
    async initialize() {
        try {
            console.log('🚀 Starting Slack Relay Bot...');
            
            // Log configuration for debugging (sensitive values are masked)
            logConfig();

            // Set up Express middleware and routes
            this.setupExpress();

            // Initialize relay middleware for AI communication
            console.log('🔧 Initializing Relay Middleware...');
            this.relayMiddleware = new RelayMiddleware(config);

            // Initialize Slack bot only if tokens are available
            // This allows the app to start even without Slack configuration
            if (config.slack.botToken && config.slack.signingSecret && config.slack.appToken) {
                console.log('💬 Initializing Slack Bot...');
                this.slackBot = new SlackBot(config, this.relayMiddleware);
            } else {
                console.log('⚠️ Slack tokens not configured - Slack integration disabled');
                console.log('ℹ️ Configure SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, and SLACK_APP_TOKEN to enable Slack integration');
                this.slackBot = null;
            }

            console.log('✅ Application initialized successfully');

        } catch (error) {
            console.error('❌ Failed to initialize application:', error);
            throw error;
        }
    }

    /**
     * Set up Express middleware and routes
     * 
     * Configures the Express.js web server with:
     * 1. Standard middleware for parsing requests
     * 2. Health check endpoint for monitoring
     * 3. Status endpoint for detailed application state
     * 4. OAuth endpoints for user authentication
     * 5. Error handling for graceful failures
     * 
     * Route Structure:
     * - GET /health: Simple health check (for load balancers)
     * - GET /status: Detailed application status (for monitoring)
     * - GET /auth/login/:slackUserId: Initiate OAuth flow
     * - GET /auth/callback: Handle OAuth return from Microsoft
     * 
     * SECURITY CONSIDERATIONS:
     * - No rate limiting implemented
     * - Error messages may leak sensitive information
     * - No input validation on route parameters
     * - No CSRF protection on authentication endpoints
     * - Status endpoint exposes internal application state
     */
    setupExpress() {
        // Standard Express middleware for parsing requests
        this.app.use(express.json());                    // Parse JSON request bodies
        this.app.use(express.urlencoded({ extended: true }));  // Parse form data

        // Health check endpoint for load balancers and monitoring systems
        // This is a lightweight endpoint that just confirms the app is running
        this.app.get('/health', (req, res) => {
            const stats = this.relayMiddleware ? this.relayMiddleware.getStats() : null;
            
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),                           // How long the process has been running
                version: process.env.npm_package_version || '1.0.0',  // App version from package.json
                stats: stats || 'Not initialized'                  // Relay middleware statistics
            });
        });

        // Detailed status endpoint for monitoring and debugging
        // Provides comprehensive information about application state
        // SECURITY WARNING: Exposes internal metrics that could be sensitive
        this.app.get('/status', (req, res) => {
            if (!this.relayMiddleware) {
                return res.status(503).json({ error: 'Relay middleware not initialized' });
            }

            const stats = this.relayMiddleware.getStats();
            
            res.json({
                relay: {
                    activeConnections: stats.activeConnections,     // Number of active AI connections
                    messageQueues: stats.messageQueues,            // Pending messages
                    connections: stats.connections                 // Connection details
                },
                slack: {
                    connected: !!this.slackBot                     // Whether Slack bot is running
                },
                saml: {
                    enabled: config.saml.enabled,                  // SAML SSO integration status
                    identityProvider: config.saml.identityProvider,
                    trustSamlAssertions: config.saml.trustSlackSamlAssertions,
                    requireExplicitOAuth: config.saml.requireExplicitOAuth,
                    enterpriseGridTokenConfigured: !!config.saml.enterpriseGridToken,
                    implementationStatus: 'placeholder',            // Current implementation status
                    fallbackBehavior: 'oauth_required'             // Always falls back to OAuth
                },
                server: {
                    port: config.server.port,
                    environment: config.server.nodeEnv,
                    uptime: process.uptime(),
                    memory: process.memoryUsage()                  // Memory usage statistics
                }
            });
        });

        // OAuth Authentication Endpoints
        // These endpoints handle the secure authentication flow with Microsoft Entra ID
        
        /**
         * OAuth Login Initiation Endpoint
         * 
         * This endpoint starts the OAuth 2.0 + PKCE authentication flow.
         * When a Slack user clicks the authentication button, they're directed here.
         * 
         * Flow:
         * 1. User clicks auth button in Slack
         * 2. Browser hits this endpoint: /auth/login/{slackUserId}
         * 3. We generate PKCE parameters for security
         * 4. Redirect to Microsoft OAuth with parameters
         * 
         * SECURITY FEATURES:
         * - PKCE (Proof Key for Code Exchange) prevents authorization code interception
         * - State parameter contains Slack user ID for correlation
         * - Tenant-specific OAuth URL instead of /common endpoint
         * 
         * SECURITY CONCERNS:
         * - Slack user ID in URL path (could be logged by proxies)
         * - No input validation on slackUserId parameter
         * - No rate limiting (could be abused for DoS)
         * - No CSRF protection beyond PKCE
         */
        this.app.get('/auth/login/:slackUserId', (req, res) => {
            const { slackUserId } = req.params;
            
            // TODO: Add input validation for slackUserId
            // Should validate format and sanitize to prevent injection
            
            // Generate OAuth URL with PKCE security
            const authUrl = this.generateEntraIDAuthUrl(slackUserId);
            
            res.redirect(authUrl);
        });

        /**
         * OAuth Callback Endpoint
         * 
         * Microsoft redirects users here after they complete authentication.
         * This endpoint handles the authorization code exchange for access tokens.
         * 
         * Flow:
         * 1. User completes auth on Microsoft's site
         * 2. Microsoft redirects here with authorization code
         * 3. We exchange code + PKCE verifier for access token
         * 4. Store token and notify user in Slack
         * 
         * SECURITY FEATURES:
         * - PKCE code verifier validation prevents code interception attacks
         * - State parameter validation ensures request correlation
         * - Access token stored securely (though currently in memory)
         * 
         * SECURITY CONCERNS:
         * - Authorization code and tokens logged to console
         * - No expiration time validation on received tokens
         * - Error messages might leak sensitive information
         * - No audit logging of authentication events
         * - Window auto-close could be abused for clickjacking
         */
        this.app.get('/auth/callback', async (req, res) => {
            const { code, state } = req.query;
            
            // Log callback for debugging (be careful with sensitive data)
            console.log('🔄 OAuth callback received:', { 
                code: code ? 'present' : 'missing',
                state: state ? state : 'missing',
                allParams: Object.keys(req.query),  // Log parameter names only
                url: req.url
            });
            
            // Validate required OAuth parameters
            if (!code || !state) {
                return res.status(400).send('❌ Missing authorization code or state');
            }

            try {
                // Extract Slack user ID from state parameter
                // The state parameter is how we correlate this auth with the original request
                const slackUserId = state;
                
                // Exchange authorization code for access token using PKCE
                const tokenResponse = await this.exchangeCodeForToken(code, slackUserId);
                
                // Store the access token for this user
                // The slack_ prefix ensures consistent user ID formatting
                if (this.relayMiddleware) {
                    await this.relayMiddleware.storeUserToken(`slack_${slackUserId}`, tokenResponse.access_token);
                }

                // Send success page with auto-close functionality
                // This provides user feedback and closes the OAuth popup window
                res.send(`
                    <h2>✅ Authentication Successful!</h2>
                    <p>You can now return to Slack and start chatting with the bot.</p>
                    <p>This window can be closed.</p>
                    <script>
                        // Auto-close window after configured delay
                        setTimeout(() => window.close(), ${config.app.authPopupCloseDelay});
                    </script>
                `);

                // Notify the user in Slack that authentication succeeded
                if (this.slackBot) {
                    await this.slackBot.notifyAuthSuccess(slackUserId);
                }

            } catch (error) {
                console.error('❌ OAuth callback error:', error);
                // Send user-friendly error page
                // TODO: Improve error handling to prevent information leakage
                res.status(500).send(`
                    <h2>❌ Authentication Failed</h2>
                    <p>Error: ${error.message}</p>
                    <p>Please try again from Slack.</p>
                `);
            }
        });

        // Global 404 handler for undefined routes
        // This catches any requests to endpoints that don't exist
        this.app.use('*', (req, res) => {
            res.status(404).json({
                error: 'Not Found',
                message: 'The requested endpoint does not exist'
            });
        });

        // Global error handler for Express
        // This catches any unhandled errors in route handlers
        // SECURITY NOTE: Error messages are filtered based on environment
        this.app.use((error, req, res, next) => {
            console.error('❌ Express error:', error);
            res.status(500).json({
                error: 'Internal Server Error',
                // Only show detailed error messages in development
                message: config.server.nodeEnv === 'development' ? error.message : 'Something went wrong'
            });
        });
    }

    /**
     * Generate PKCE parameters for OAuth security
     * 
     * PKCE (Proof Key for Code Exchange) is a security extension to OAuth 2.0
     * that prevents authorization code interception attacks. It works by:
     * 
     * 1. Client generates a random code verifier
     * 2. Client creates a code challenge (SHA256 hash of verifier)
     * 3. Client sends challenge with authorization request
     * 4. Authorization server stores the challenge
     * 5. Client sends verifier with token exchange request
     * 6. Server verifies that verifier matches stored challenge
     * 
     * This prevents attackers from using intercepted authorization codes
     * because they don't have the original code verifier.
     * 
     * @returns {Object} Object containing codeVerifier and codeChallenge
     * 
     * SECURITY FEATURES:
     * - Uses cryptographically secure random generation
     * - SHA256 hashing for challenge generation
     * - Base64URL encoding for URL safety
     */
    generatePKCE() {
        // Generate cryptographically random code verifier (43-128 characters)
        const codeVerifier = crypto.randomBytes(32).toString('base64url');
        
        // Create code challenge by hashing the verifier
        const codeChallenge = crypto
            .createHash('sha256')
            .update(codeVerifier)
            .digest('base64url');
        
        return { codeVerifier, codeChallenge };
    }

    /**
     * Generate Microsoft Entra ID OAuth URL for user authentication
     * 
     * Creates a complete OAuth 2.0 authorization URL with PKCE security.
     * This URL will redirect users to Microsoft's login page where they
     * can authenticate and grant permissions to our application.
     * 
     * OAuth Parameters Included:
     * - client_id: Our registered application ID
     * - response_type: 'code' (authorization code flow)
     * - redirect_uri: Where Microsoft sends users after auth
     * - scope: What permissions we're requesting
     * - state: Slack user ID for correlation
     * - prompt: 'consent' to ensure user sees permission screen
     * - code_challenge: PKCE challenge for security
     * - code_challenge_method: 'S256' (SHA256 hashing)
     * 
     * @param {string} slackUserId - Slack user ID for state correlation
     * @returns {string} Complete OAuth authorization URL
     * 
     * SECURITY FEATURES:
     * - Tenant-specific endpoint (not /common) for better security
     * - PKCE challenge to prevent code interception
     * - State parameter for request correlation
     * - Forced consent prompt to ensure user awareness
     * 
     * SECURITY CONCERNS:
     * - Code verifier stored in memory (not persistent)
     * - No expiration time for stored code verifiers
     * - State parameter contains user ID (could be logged)
     * - Base URL construction from config (validate in production)
     */
    generateEntraIDAuthUrl(slackUserId) {
        const clientId = config.copilotStudio.appClientId;
        const tenantId = config.copilotStudio.tenantId;
        const redirectUri = `${config.server.baseUrl}/auth/callback`;
        const scope = config.oauth.scope;
        
        // Generate PKCE parameters for this authentication request
        const { codeVerifier, codeChallenge } = this.generatePKCE();
        
        // Store code verifier temporarily for token exchange validation
        // TODO: Implement expiration for code verifiers to prevent memory leaks
        this.codeVerifiers.set(slackUserId, codeVerifier);
        
        // Construct tenant-specific OAuth URL (more secure than /common)
        // Using tenant-specific endpoint prevents account takeover attacks
        const authUrl = new URL(`${config.oauth.authority}/${tenantId}/oauth2/v2.0/authorize`);
        
        // Set OAuth 2.0 parameters
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('response_type', 'code');           // Authorization code flow
        authUrl.searchParams.set('redirect_uri', redirectUri);       // Where to return after auth
        authUrl.searchParams.set('scope', scope);                    // Requested permissions
        authUrl.searchParams.set('state', slackUserId);             // For correlation (contains user ID)
        // authUrl.searchParams.set('prompt', 'consent');              // Force permission screen
        authUrl.searchParams.set('code_challenge', codeChallenge);  // PKCE challenge
        authUrl.searchParams.set('code_challenge_method', 'S256');  // SHA256 hashing
        
        return authUrl.toString();
    }

    /**
     * Exchange authorization code for access token
     * 
     * This is the second half of the OAuth flow where we trade the authorization
     * code (received from Microsoft) for an actual access token that we can use
     * to make API calls on behalf of the user.
     * 
     * OAuth Token Exchange Flow:
     * 1. Retrieve stored PKCE code verifier for validation
     * 2. Build token request with code, verifier, and client credentials
     * 3. POST request to Microsoft's token endpoint
     * 4. Validate response and extract access token
     * 5. Return token data for storage
     * 
     * @param {string} code - Authorization code from Microsoft
     * @param {string} slackUserId - Slack user ID for verifier lookup
     * @returns {Object} Token response containing access_token, refresh_token, etc.
     * 
     * SECURITY FEATURES:
     * - PKCE code verifier validation prevents code interception attacks
     * - Client secret included for additional authentication
     * - Tenant-specific token endpoint
     * - Code verifier automatically cleaned up after use
     * 
     * SECURITY CONCERNS:
     * - Client secret sent in request body (use mTLS in production)
     * - Error responses might contain sensitive information
     * - No token expiration validation
     * - Access token returned in plain text
     * - No audit logging of token exchanges
     */
    async exchangeCodeForToken(code, slackUserId) {
        const tenantId = config.copilotStudio.tenantId;
        const tokenEndpoint = `${config.oauth.authority}/${tenantId}/oauth2/v2.0/token`;
        const redirectUri = `${config.server.baseUrl}/auth/callback`;
        
        // Retrieve and validate the stored PKCE code verifier
        const codeVerifier = this.codeVerifiers.get(slackUserId);
        if (!codeVerifier) {
            throw new Error('Code verifier not found for user - possible replay attack or expired session');
        }
        
        // Clean up the stored code verifier immediately (single use only)
        this.codeVerifiers.delete(slackUserId);
        
        // Build token exchange request body
        // Using URLSearchParams for proper form encoding
        const body = new URLSearchParams({
            client_id: config.copilotStudio.appClientId,       // Our app registration ID
            client_secret: config.copilotStudio.clientSecret,  // App secret for authentication
            code: code,                                         // Authorization code from Microsoft
            grant_type: 'authorization_code',                   // OAuth grant type
            redirect_uri: redirectUri,                          // Must match auth request
            scope: config.oauth.scope,                          // Requested permissions
            code_verifier: codeVerifier                         // PKCE verifier for validation
        });

        // Make token exchange request to Microsoft
        const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Token exchange failed: ${error}`);
        }

        // Parse and return token response
        // Contains access_token, refresh_token, expires_in, etc.
        return await response.json();
    }

    /**
     * Start the application
     * 
     * Starts all application components in the correct order:
     * 1. Slack Bot (if configured) - establishes Socket Mode connection
     * 2. Express HTTP server - starts listening for OAuth callbacks and health checks
     * 3. Graceful shutdown handlers - ensures clean shutdown on signals
     * 
     * The startup process is designed to be resilient:
     * - Application can start without Slack configuration (useful for testing)
     * - Each component startup is logged for visibility
     * - Server provides immediate feedback with endpoint URLs
     * 
     * SECURITY CONSIDERATIONS:
     * - Server binds to all interfaces (0.0.0.0) if not configured otherwise
     * - No startup authentication or authorization checks
     * - Health endpoints immediately available (could leak information)
     */
    async start() {
        try {
            // Start Slack bot component if tokens are configured
            if (this.slackBot) {
                console.log('⚡️ Starting Slack Bot...');
                try {
                    await this.slackBot.start();
                } catch (slackError) {
                    console.error('❌ Failed to start Slack Bot:', slackError.message);
                    console.log('⚠️ Slack Bot connection failed - continuing without Slack integration');
                    console.log('ℹ️ The application will still run, but Slack functionality will be unavailable');
                    console.log('🔄 Check your Slack tokens and network connection, then restart the application');
                    
                    // Continue running without Slack instead of crashing the entire app
                    this.slackBot = null;
                }
            } else {
                console.log('⏭️ Skipping Slack Bot (not configured)');
            }

            // Start Express HTTP server for OAuth callbacks and health checks
            console.log('🌐 Starting HTTP server...');
            this.server = this.app.listen(config.server.port, () => {
                console.log(`✅ Server running on port ${config.server.port}`);
                console.log(`📊 Health check: http://localhost:${config.server.port}/health`);
                console.log(`📈 Status endpoint: http://localhost:${config.server.port}/status`);
                
                // Provide helpful feedback if Slack integration is disabled
                if (!this.slackBot) {
                    console.log('');
                    console.log('ℹ️ Slack integration disabled - configure Slack tokens to enable bot functionality');
                }
            });

            // Set up signal handlers for graceful shutdown
            this.setupGracefulShutdown();

            console.log('🎉 Slack Relay Bot is running!');

        } catch (error) {
            console.error('❌ Failed to start application:', error);
            throw error;
        }
    }

    /**
     * Set up graceful shutdown handlers
     * 
     * Configures signal handlers to ensure clean application shutdown.
     * This is critical for:
     * - Closing open connections to prevent data loss
     * - Cleaning up resources to prevent memory leaks
     * - Providing feedback about shutdown progress
     * - Preventing abrupt termination that could corrupt state
     * 
     * Shutdown sequence:
     * 1. Stop Slack bot (closes Socket Mode connection)
     * 2. Close HTTP server (stops accepting new requests)
     * 3. Clean up relay middleware (closes AI connections)
     * 4. Exit process with appropriate code
     * 
     * Handles multiple shutdown scenarios:
     * - SIGTERM: Graceful shutdown request (Docker, systemd)
     * - SIGINT: Interrupt signal (Ctrl+C)
     * - Uncaught exceptions: Unexpected errors
     * - Unhandled promise rejections: Async errors
     * 
     * SECURITY CONSIDERATIONS:
     * - No sensitive data cleanup (tokens remain in memory)
     * - No audit logging of shutdown events
     * - Could be abused for DoS if shutdown is slow
     */
    setupGracefulShutdown() {
        const shutdown = async (signal) => {
            console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

            try {
                // Stop Slack bot and close Socket Mode connection
                if (this.slackBot) {
                    console.log('💬 Stopping Slack bot...');
                    await this.slackBot.stop();
                }

                // Close HTTP server (stops accepting new connections)
                if (this.server) {
                    console.log('🌐 Closing HTTP server...');
                    await new Promise((resolve) => {
                        this.server.close(resolve);
                    });
                }

                // Cleanup relay middleware connections and resources
                if (this.relayMiddleware) {
                    console.log('🔧 Cleaning up relay middleware...');
                    this.relayMiddleware.cleanup();
                }

                // TODO: Clear sensitive data from memory
                // this.codeVerifiers.clear();

                console.log('✅ Graceful shutdown completed');
                process.exit(0);

            } catch (error) {
                console.error('❌ Error during shutdown:', error);
                process.exit(1);
            }
        };

        // Handle standard shutdown signals
        process.on('SIGTERM', () => shutdown('SIGTERM'));  // Docker/systemd graceful shutdown
        process.on('SIGINT', () => shutdown('SIGINT'));    // Ctrl+C in terminal

        // Handle unexpected errors to prevent silent failures
        process.on('uncaughtException', (error) => {
            console.error('❌ Uncaught Exception:', error);
            shutdown('uncaughtException');
        });

        // Handle unhandled promise rejections (async errors)
        process.on('unhandledRejection', (reason, promise) => {
            console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
            
            // Check if this is a recoverable Slack Socket Mode error
            const errorMessage = reason?.message || reason?.toString() || '';
            const isSlackSocketModeError = errorMessage.includes('server explicit disconnect') || 
                                         errorMessage.includes('SocketModeClient') ||
                                         errorMessage.includes('WebSocket');
            
            if (isSlackSocketModeError) {
                console.log('⚠️ Slack Socket Mode connection error detected - attempting to continue running');
                console.log('ℹ️ The Slack bot will attempt to reconnect automatically');
                // Don't shutdown for recoverable Slack connection errors
                return;
            }
            
            // For other unhandled rejections, still shutdown as they might be critical
            console.log('💥 Critical unhandled rejection detected - shutting down for safety');
            shutdown('unhandledRejection');
        });
    }
}

/**
 * Main Application Entry Point
 * 
 * This function creates and starts the Slack Relay Bot application.
 * It's the single entry point that orchestrates the entire startup process.
 * 
 * Startup sequence:
 * 1. Create SlackRelayBotApp instance
 * 2. Initialize all components (Express, Slack Bot, Relay Middleware)
 * 3. Start all services (Slack connection, HTTP server)
 * 
 * Error handling:
 * - Any startup errors cause the process to exit with code 1
 * - This ensures the application fails fast if configuration is wrong
 * - Container orchestrators can detect and restart failed instances
 */
async function main() {
    try {
        const app = new SlackRelayBotApp();
        await app.initialize();
        await app.start();
    } catch (error) {
        console.error('❌ Fatal error starting application:', error);
        process.exit(1);
    }
}

// Start the application
main();
