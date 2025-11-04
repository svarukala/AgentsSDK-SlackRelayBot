/**
 * Configuration Management for Slack Relay Bot
 * 
 * This file is responsible for:
 * 1. Loading environment variables from .env file
 * 2. Validating that all required configuration is present
 * 3. Providing a centralized configuration object for the entire application
 * 4. Logging configuration details (without exposing sensitive data)
 * 
 * SECURITY CONSIDERATIONS:
 * ⚠️  CURRENT SECURITY CONCERNS:
 * - Sensitive values logged to console (though marked as "Set" vs actual values)
 * - Client secrets and tokens stored in memory as plain text
 * - No environment variable validation beyond presence checking
 * - Configuration loaded at module level (global state)
 * 
 * 🔒 PRODUCTION SECURITY IMPROVEMENTS NEEDED:
 * - Implement configuration encryption for sensitive values
 * - Add environment variable format validation (UUIDs, URLs, etc.)
 * - Consider using Azure Key Vault or AWS Secrets Manager for secrets
 * - Add configuration change auditing
 * - Implement configuration reload without restart
 * - Add configuration schema validation
 * - Redact sensitive values from logs completely
 */

import dotenv from 'dotenv';

// Load environment variables from .env file
// This reads the .env file and makes variables available via process.env
dotenv.config();

/**
 * Validate required environment variables before starting the application
 * 
 * This function acts as a "pre-flight check" to ensure all necessary configuration
 * is present before the application starts. Think of it like checking that you have
 * your keys, wallet, and phone before leaving the house.
 * 
 * Why this is important:
 * - Fails fast if configuration is missing (better than mysterious errors later)
 * - Provides clear error messages about what's missing
 * - Prevents partial application startup with broken functionality
 * 
 * SECURITY CONSIDERATIONS:
 * - Only checks presence, not validity of values
 * - Doesn't validate format (UUIDs, URLs, etc.)
 * - No secrets validation (could be expired, revoked, etc.)
 * 
 * TODO: SECURITY IMPROVEMENTS NEEDED:
 * - Add format validation for GUIDs, URLs, tokens
 * - Validate token permissions and expiration
 * - Check network connectivity to required services
 * - Implement configuration schema validation
 */
function validateConfig() {
    // Essential configuration for connecting to Microsoft Copilot Studio
    // These are like the "address and phone number" to reach the AI service
    const requiredCopilot = [
        'COPILOT_ENVIRONMENT_ID',    // Which Microsoft environment (like a server location)
        'COPILOT_AGENT_IDENTIFIER',  // Which specific AI bot to connect to
        'COPILOT_APP_CLIENT_ID',     // Your app's registration ID with Microsoft
        'COPILOT_CLIENT_SECRET',     // Your app's secret key (like a password)
        'COPILOT_TENANT_ID'          // Your organization's ID in Microsoft's system
    ];

    // Required configuration for connecting to Slack
    // These are the "credentials" that let our bot talk to Slack
    const requiredSlack = [
        'SLACK_BOT_TOKEN',      // The bot's identity token (like an ID card)
        'SLACK_SIGNING_SECRET', // Used to verify messages really came from Slack (security)
        'SLACK_APP_TOKEN'       // Socket Mode token for real-time connection
    ];

    // Check which required variables are missing
    const missingCopilot = requiredCopilot.filter(key => !process.env[key]);
    const missingSlack = requiredSlack.filter(key => !process.env[key]);
    
    // Copilot Studio configuration is absolutely required
    // Without this, the bot has no AI to talk to
    if (missingCopilot.length > 0) {
        console.error('❌ Missing required Copilot Studio environment variables:');
        missingCopilot.forEach(key => console.error(`  - ${key}`));
        console.error('\nPlease check your .env file and ensure all Copilot Studio variables are set.');
        console.error('💡 Tip: Copy these values from your Microsoft Copilot Studio agent settings');
        process.exit(1);  // Stop the application - it can't work without these
    }

    // Slack configuration is optional in some cases (testing mode)
    // Without this, the bot can't connect to Slack but might be useful for testing
    if (missingSlack.length > 0) {
        console.warn('⚠️ Missing Slack environment variables (Slack integration will be disabled):');
        missingSlack.forEach(key => console.warn(`  - ${key}`));
        console.warn('ℹ️ You can still test the Copilot Studio connection using the /test/message endpoint');
        console.warn('💡 Tip: Get these values from your Slack app settings at api.slack.com');
    } else {
        console.log('✅ All Slack environment variables are present');
    }

    console.log('✅ Copilot Studio environment variables are present');
}

/**
 * Main Configuration Object
 * 
 * This object centralizes all configuration settings for the application.
 * Think of it as the "control panel" that defines how the bot behaves.
 * 
 * SECURITY CONSIDERATIONS:
 * ⚠️  CURRENT SECURITY ISSUES:
 * - Sensitive values (client secrets, tokens) stored in plain text in memory
 * - Configuration loaded at startup and never refreshed
 * - No validation of value formats or ranges
 * - Environment variables accessible to all code
 * - Default values might be insecure for production
 * 
 * 🔒 PRODUCTION SECURITY IMPROVEMENTS NEEDED:
 * - Encrypt sensitive configuration values
 * - Validate configuration value formats (GUIDs, URLs, etc.)
 * - Implement configuration hot-reload for security updates
 * - Use secret management systems (Azure Key Vault, AWS Secrets Manager)
 * - Add configuration change auditing
 * - Implement least-privilege access to configuration values
 * - Add configuration value sanitization
 */
const config = {
    // Microsoft Copilot Studio connection settings
    // These tell our bot how to find and connect to the AI service
    copilotStudio: {
        environmentId: process.env.COPILOT_ENVIRONMENT_ID,      // Where the AI lives (Microsoft environment)
        agentIdentifier: process.env.COPILOT_AGENT_IDENTIFIER,  // Which AI agent to use
        appClientId: process.env.COPILOT_APP_CLIENT_ID,         // Our app's ID with Microsoft
        clientSecret: process.env.COPILOT_CLIENT_SECRET,        // 🔒 SENSITIVE: App secret key
        tenantId: process.env.COPILOT_TENANT_ID,                // Organization ID in Microsoft
        requireAuth: process.env.COPILOT_REQUIRE_AUTH !== 'false', // Whether users must log in (default: true for security)
    },

    // OAuth/Authentication settings for Microsoft services
    // These control how users log in and what permissions they get
    oauth: {
        scope: process.env.OAUTH_SCOPE || 'https://api.powerplatform.com/.default',  // What permissions to request
        authority: process.env.MICROSOFT_LOGIN_AUTHORITY || 'https://login.microsoftonline.com',  // Microsoft's login server
        // TODO: SECURITY IMPROVEMENT - Use minimal scopes instead of .default
        // TODO: SECURITY IMPROVEMENT - Validate scope format
    },

    // Slack integration settings
    // These are the "keys" that let our bot talk to Slack
    slack: {
        botToken: process.env.SLACK_BOT_TOKEN,          // 🔒 SENSITIVE: Bot's identity token
        signingSecret: process.env.SLACK_SIGNING_SECRET, // 🔒 SENSITIVE: Used to verify Slack messages
        appToken: process.env.SLACK_APP_TOKEN,          // 🔒 SENSITIVE: Socket Mode connection token
        // TODO: SECURITY IMPROVEMENT - Validate token formats
        // TODO: SECURITY IMPROVEMENT - Check token expiration
    },

    // SAML SSO Integration Settings (Optional)
    // These settings enable seamless authentication for organizations using SAML SSO
    // When enabled, users authenticated via SAML won't need to complete OAuth again
    saml: {
        // Enable SAML SSO integration (defaults to false for backward compatibility)
        enabled: process.env.SAML_SSO_ENABLED === 'true',
        
        // SAML Identity Provider (currently only supports Microsoft Entra ID)
        identityProvider: process.env.SAML_IDENTITY_PROVIDER || 'entraid',
        
        // Trust Slack SAML assertions for authentication
        // When true: Skip OAuth if valid SAML session detected
        // When false: Always require explicit OAuth (more secure but less UX)
        trustSlackSamlAssertions: process.env.TRUST_SLACK_SAML_ASSERTIONS === 'true',
        
        // Require explicit OAuth even with valid SAML (defense in depth)
        // When true: Always show OAuth flow regardless of SAML status
        // When false: Skip OAuth if SAML is valid (better UX)
        requireExplicitOAuth: process.env.REQUIRE_EXPLICIT_OAUTH !== 'false', // Default to true for security
        
        // Slack Enterprise Grid token for accessing SAML user information
        // Required only for Enterprise Grid workspaces with SAML
        enterpriseGridToken: process.env.SLACK_ENTERPRISE_GRID_TOKEN || null,
        
        // Path to SAML certificate for assertion validation (future enhancement)
        certificatePath: process.env.SAML_CERTIFICATE_PATH || null,
        
        // SECURITY CONSIDERATIONS:
        // ⚠️  CURRENT SECURITY CONCERNS:
        // - SAML assertion validation not yet implemented
        // - Enterprise Grid token has broad permissions
        // - Certificate validation placeholder only
        // - Email domain validation needed
        // - Audit logging for SAML auth events missing
        
        // 🔒 PRODUCTION SECURITY IMPROVEMENTS NEEDED:
        // - Implement proper SAML assertion signature validation
        // - Add email domain allowlist validation
        // - Implement audit logging for all SAML authentication events
        // - Add rate limiting for SAML authentication attempts
        // - Validate Enterprise Grid token scope limitations
        // - Add certificate rotation and validation
        // - Implement fallback to OAuth on SAML validation failure
    },

    // Web server settings
    // These control how our bot accepts incoming requests
    server: {
        port: parseInt(process.env.PORT || '8005', 10),  // Which port to listen on
        nodeEnv: process.env.NODE_ENV || 'development',  // Environment mode (development/production)
        baseUrl: process.env.SERVER_BASE_URL || `http://localhost:${parseInt(process.env.PORT || '8005', 10)}`, // Public URL for OAuth redirects
        // TODO: SECURITY IMPROVEMENT - Validate URL format and HTTPS in production
        // TODO: SECURITY IMPROVEMENT - Add CORS configuration
        // TODO: SECURITY IMPROVEMENT - Add rate limiting configuration
    },

    // Logging configuration
    // Controls how detailed the application logs are
    logLevel: process.env.LOG_LEVEL || 'info',
    // TODO: SECURITY IMPROVEMENT - Ensure sensitive data isn't logged at higher log levels

    // Application behavior settings
    // These control timing and cleanup behavior
    app: {
        cleanupIntervalMs: parseInt(process.env.CLEANUP_INTERVAL_MS || '600000', 10), //10 * 60 * 1000, // How often to clean up old connections (5 minutes)
        connectionTimeoutMs: parseInt(process.env.CONNECTION_TIMEOUT_MS || '7200000', 10), //120 * 60 * 1000, // How long to keep inactive connections (30 minutes)
        messageTimeoutMs: 30 * 1000, // How long to wait for AI responses (30 seconds)
        authPopupCloseDelay: parseInt(process.env.AUTH_POPUP_CLOSE_DELAY || '3000', 10), // How long before closing auth popup (3 seconds)
        // TODO: SECURITY IMPROVEMENT - Add rate limiting configuration
        // TODO: SECURITY IMPROVEMENT - Add maximum message length limits
        // TODO: SECURITY IMPROVEMENT - Add user session timeout configuration
    }
};

/**
 * Log the current configuration (safely, without exposing sensitive data)
 * 
 * This function shows what configuration the bot is using, but it's careful
 * not to show sensitive information like passwords or secret keys.
 * 
 * Think of it like showing someone your driver's license but covering up
 * your license number - they can see it's valid but not the sensitive details.
 * 
 * SECURITY CONSIDERATIONS:
 * - Sensitive values shown as "Set" vs "Not set" instead of actual values
 * - Even this might leak information about configuration state
 * - URLs and IDs are shown but these might be considered sensitive in some environments
 * 
 * TODO: SECURITY IMPROVEMENTS:
 * - Consider masking/truncating even non-secret values in production
 * - Add audit logging when configuration is accessed
 * - Implement different log levels for different environments
 * - Consider making this optional in production builds
 */
function logConfig() {
    console.log('🔧 Configuration loaded:');
    
    // Show Copilot Studio settings (non-sensitive parts)
    console.log('  Copilot Studio:');
    console.log(`    Environment ID: ${config.copilotStudio.environmentId}`);
    console.log(`    Agent ID: ${config.copilotStudio.agentIdentifier}`);
    console.log(`    App Client ID: ${config.copilotStudio.appClientId}`);
    console.log(`    Tenant ID: ${config.copilotStudio.tenantId}`);
    console.log(`    Require Auth: ${config.copilotStudio.requireAuth}`);
    
    // Show OAuth settings (URLs are generally not sensitive)
    console.log('  OAuth:');
    console.log(`    Scope: ${config.oauth.scope}`);
    console.log(`    Authority: ${config.oauth.authority}`);
    
    // Show Slack connection status (never show actual tokens)
    console.log('  Slack:');
    console.log(`    Bot Token: ${config.slack.botToken ? '🔒 Set' : '❌ Not set'}`);
    console.log(`    Signing Secret: ${config.slack.signingSecret ? '🔒 Set' : '❌ Not set'}`);
    console.log(`    App Token: ${config.slack.appToken ? '🔒 Set' : '❌ Not set'}`);
    
    // Show server settings (generally safe to show)
    console.log('  Server:');
    console.log(`    Port: ${config.server.port}`);
    console.log(`    Base URL: ${config.server.baseUrl}`);
    console.log(`    Environment: ${config.server.nodeEnv}`);
    console.log(`    Log Level: ${config.logLevel}`);
    
    // Show timing/behavior settings (safe to show)
    console.log('  App Settings:');
    console.log(`    Cleanup Interval: ${config.app.cleanupIntervalMs}ms (${config.app.cleanupIntervalMs / (60 * 1000)} minutes)`);
    console.log(`    Connection Timeout: ${config.app.connectionTimeoutMs}ms (${config.app.connectionTimeoutMs / (60 * 1000)} minutes)`);
    console.log(`    Auth Popup Close Delay: ${config.app.authPopupCloseDelay}ms`);
    
    // Show SAML SSO settings (when enabled)
    if (config.saml.enabled) {
        console.log('  SAML SSO:');
        console.log(`    Enabled: ${config.saml.enabled}`);
        console.log(`    Identity Provider: ${config.saml.identityProvider}`);
        console.log(`    Trust SAML Assertions: ${config.saml.trustSlackSamlAssertions}`);
        console.log(`    Require Explicit OAuth: ${config.saml.requireExplicitOAuth}`);
        console.log(`    Enterprise Grid Token: ${config.saml.enterpriseGridToken ? '🔒 Set' : '❌ Not set'}`);
        console.log(`    Certificate Path: ${config.saml.certificatePath || 'Not configured'}`);
        
        // SAML security warnings
        if (config.saml.trustSlackSamlAssertions && !config.saml.requireExplicitOAuth) {
            console.log('⚠️  SAML SSO configured for maximum UX (minimal security checks)');
        } else if (config.saml.enabled) {
            console.log('✅ SAML SSO configured with security-conscious settings');
        }
    } else {
        console.log('  SAML SSO: Disabled (using standard OAuth flow)');
    }
    
    // Security warning for development environment
    if (config.server.nodeEnv === 'development') {
        console.log('⚠️  Development mode - additional security measures needed for production');
    }
}

// Validate configuration on module load
// This runs immediately when the app starts, ensuring we catch configuration
// problems early rather than discovering them when a user tries to use the bot
validateConfig();

// Export the configuration object and logging function for use by other parts of the application
// Think of this like making the "control panel" available to other components
export { config as default, logConfig };
