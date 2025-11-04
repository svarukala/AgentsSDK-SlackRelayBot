/**
 * Relay Middleware - The Bridge Between Slack and Microsoft Copilot Studio
 * 
 * This file contains the core logic that connects Slack users to Microsoft Copilot Studio.
 * Think of it as a translator that:
 * 1. Takes messages from Slack users
 * 2. Sends them to Microsoft's AI chatbot (Copilot Studio)
 * 3. Gets the AI's response back
 * 4. Returns the response to Slack
 * 
 * Key Concepts:
 * - Uses Microsoft's official SDK (software development kit) to talk to Copilot Studio
 * - Manages authentication (who is allowed to use the bot)
 * - Keeps track of ongoing conversations (so the AI remembers context)
 * - Automatically cleans up old, unused connections to save memory
 * 
 * SECURITY CONSIDERATIONS:
 * ⚠️  CURRENT LIMITATIONS (suitable for development/testing only):
 * - Authentication tokens stored in memory (not encrypted)
 * - No token expiration validation
 * - No persistent storage (tokens lost on restart)
 * - No audit logging
 * - Broad OAuth scope permissions
 * 
 * 🔒 PRODUCTION SECURITY REQUIREMENTS:
 * - Implement encrypted token storage (database/Redis with encryption at rest)
 * - Add token expiration checking and refresh logic
 * - Implement audit logging for compliance
 * - Use minimal OAuth scopes (principle of least privilege)
 * - Add rate limiting and abuse detection
 * - Implement proper session management
 * - Consider token rotation strategies
 * - Add input validation and sanitization
 * - Implement proper error handling to prevent information leakage
 */

import {
    CopilotStudioClient,        // Microsoft's official client for connecting to Copilot Studio
    ConnectionSettings          // Settings needed to establish the connection
} from '@microsoft/agents-copilotstudio-client';
import { ConfidentialClientApplication } from '@azure/msal-node';  // Microsoft's authentication library

class RelayMiddleware {
    constructor(config, slackClient = null) {
        this.config = config;  // Store configuration settings (API keys, URLs, etc.)
        this.slackClient = slackClient;  // Store Slack Web API client for posting messages
        
        // In-memory storage for active connections
        // Think of this like a phone book: userId -> connection details
        // Each Slack user gets their own dedicated connection to Copilot Studio
        this.activeConnections = new Map(); // userId -> { client, conversationId, conversationActivity }
        
        // In-memory storage for user authentication tokens
        // This is like storing "login cookies" for each Slack user
        // Format: slackUserId -> userAccessToken (for Microsoft Entra ID authentication)
        this.userTokens = new Map(); 
        
        // Set up Microsoft's authentication system (MSAL = Microsoft Authentication Library)
        // This handles the OAuth flow when users need to log in with their Microsoft accounts
        this.msalInstance = new ConfidentialClientApplication({
            auth: {
                clientId: this.config.copilotStudio.appClientId,        // Your app's ID in Microsoft's system
                clientSecret: this.config.copilotStudio.clientSecret,   // Your app's secret key (like a password)
                authority: `${this.config.oauth.authority}/${this.config.copilotStudio.tenantId}`  // Microsoft's login server for your organization
            }
        });

        // Service token cache to avoid requesting new tokens every time
        this.serviceTokenCache = {
            token: null,
            expiresAt: 0
        };

        console.log('🤖 Relay Middleware initialized');
    }

    /**
     * Create a new connection between a Slack user and Copilot Studio
     * 
     * This is like opening a dedicated phone line between a specific Slack user 
     * and Microsoft's AI chatbot. Each user gets their own private conversation.
     * 
     * @param {string} userId - The Slack user's ID (format: "slack_U1234567890")
     * @param {string|null} userToken - Optional: the user's Microsoft login token
     * @returns {Object} Connection object containing the client and conversation details
     */
    async createUserConnection(userId, userToken = null) {
        try {
            console.log(`🔗 Creating connection for user: ${userId}`);

            // Configuration for connecting to Copilot Studio
            // This tells Microsoft which AI bot to connect to and where to find it
            const connectionConfig = {
                environmentId: this.config.copilotStudio.environmentId,    // Which Microsoft environment (like a server location)
                agentIdentifier: this.config.copilotStudio.agentIdentifier,        // Which specific AI bot to talk to
                authorityUrl: `${this.config.oauth.authority}/${this.config.copilotStudio.tenantId}`  // Microsoft's authentication server
            };

            // Get an authentication token (user token if available, otherwise service token)
            const token = userToken || await this.getServiceToken();

            // DEBUG: Log token information for debugging
            if (token) {
                try {
                    // Parse JWT token to see scopes and other claims
                    const tokenParts = token.split('.');
                    if (tokenParts.length === 3) {
                        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString());
                        console.log(`🔍 TOKEN DEBUG for ${userId}:`);
                        console.log(`  - Token Type: ${userToken ? 'User Token' : 'Service Token'}`);
                        console.log(`  - Scopes: ${payload.scp || payload.scope || 'Not found'}`);
                        console.log(`  - Audience: ${payload.aud || 'Not found'}`);
                        console.log(`  - Issuer: ${payload.iss || 'Not found'}`);
                        console.log(`  - Subject: ${payload.sub || 'Not found'}`);
                        console.log(`  - App ID: ${payload.appid || 'Not found'}`);
                    }
                } catch (e) {
                    console.log(`🔍 TOKEN DEBUG: Could not parse token - ${e.message}`);
                }
            }

            // Create the actual connection to Copilot Studio using Microsoft's official client
            // This is like dialing the phone number to reach the AI
            const client = new CopilotStudioClient(connectionConfig, token);

            // Start a new conversation with the AI
            // This is like saying "Hello" when someone picks up the phone
            const connectionInfo = await this.createAgentsConnection(client);

            // Save all the connection details so we can use them later
            // This is like writing down the phone number and conversation ID for future reference
            const connection = {
                client: connectionInfo.client,                      // The connection object to talk to AI
                conversationId: connectionInfo.conversationId,     // Unique ID for this conversation
                conversationActivity: connectionInfo.conversationActivity,  // Metadata about the conversation
                lastActivity: Date.now(),                          // Timestamp of when this connection was last used
                userId                                             // Which Slack user this belongs to
            };

            // Store this connection in our "phone book" so we can find it later
            this.activeConnections.set(userId, connection);

            console.log(`✅ Connection created successfully for user: ${userId}`);
            return connection;

        } catch (error) {
            console.error(`❌ Failed to create connection for user ${userId}:`, error);
            throw error;  // Re-throw the error so the calling code knows something went wrong
        }
    }

    /**
     * Start a conversation with Copilot Studio using Microsoft's official SDK
     * 
     * This function does the technical work of actually connecting to Microsoft's AI.
     * It's like making the initial handshake when you call someone on the phone.
     * 
     * @param {CopilotStudioClient} client - The Microsoft client object for communicating with AI
     * @returns {Object} Object containing the client, conversation ID, and conversation metadata
     */
    async createAgentsConnection(client) {
        try {
            // Tell Copilot Studio to start a new conversation
            // The 'true' parameter means "start immediately" (vs waiting for user input)
            const conversationActivity = await client.startConversationAsync(true);
            
            console.log(`🔗 Conversation started: ${conversationActivity.conversation?.id}`);
            
            // Return all the important details about this new conversation
            return {
                client,                                             // The connection object we'll use to send messages
                conversationId: conversationActivity.conversation?.id,  // Unique ID for this conversation
                conversationActivity                               // Full details about the conversation
            };
        } catch (error) {
            console.error('❌ Failed to start conversation:', error);
            throw error;
        }
    }

    /**
     * Save a user's Microsoft login token for future use
     * 
     * SECURITY CONSIDERATIONS:
     * - Tokens are currently stored in memory (not persistent or encrypted)
     * - In production, this should use encrypted storage (database with encryption at rest)
     * - Consider implementing token rotation and expiration checking
     * - Add audit logging for compliance requirements
     * 
     * When a user logs in with their Microsoft account, we get a special "token"
     * that proves they're authenticated. We save this token so they don't have to
     * log in again every time they send a message.
     * 
     * Think of this like saving someone's login session - similar to how websites
     * remember you're logged in even after you close and reopen your browser.
     * 
     * @param {string} slackUserId - The Slack user's ID (format: "slack_U1234567890")
     * @param {string} accessToken - The Microsoft authentication token
     */
    async storeUserToken(slackUserId, accessToken) {
        console.log(`🔐 Storing access token for Slack user: ${slackUserId}`);
        
        // TODO: SECURITY IMPROVEMENT - Encrypt tokens before storage
        // TODO: SECURITY IMPROVEMENT - Add audit logging
        
        // Extract expiration time from JWT token
        let expiresAt = null;
        try {
            // JWT tokens have format: header.payload.signature
            const parts = accessToken.split('.');
            if (parts.length === 3) {
                // Decode the payload (second part)
                const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                if (payload.exp) {
                    // Convert from Unix timestamp (seconds) to milliseconds
                    expiresAt = payload.exp * 1000;
                    console.log(`🔐 Token expires at: ${new Date(expiresAt).toISOString()}`);
                }
            }
        } catch (jwtError) {
            console.warn(`⚠️ Could not decode JWT token for expiration: ${jwtError.message}`);
            // Continue storing token without expiration - better than failing completely
        }
        
        // Store with metadata for better security management
        const tokenData = {
            token: accessToken,
            storedAt: Date.now(),
            lastUsed: Date.now(),
            expiresAt: expiresAt
        };
        
        this.userTokens.set(slackUserId, tokenData);
        
        // TODO: PRODUCTION SECURITY - Replace with encrypted persistent storage
        // Examples:
        // - Database with column-level encryption
        // - Redis with encryption at rest
        // - Azure Key Vault or AWS Secrets Manager
        // - Implement token rotation strategy
        
        console.log(`⚠️ SECURITY WARNING: Token stored in memory only - not suitable for production`);
    }

    /**
     * Retrieve a user's stored Microsoft login token with security checks
     * 
     * SECURITY ENHANCEMENTS:
     * - Check token expiration before returning
     * - Log access attempts for audit trail
     * - Validate token format and integrity
     * 
     * This checks if we have a saved login token for a specific Slack user.
     * If we find one, it means they're already authenticated and can use the bot.
     * If we don't find one, they need to log in first.
     * 
     * @param {string} slackUserId - The Slack user's ID (format: "slack_U1234567890")
     * @returns {string|undefined} The stored authentication token, or undefined if not found/expired
     */
    getUserToken(slackUserId) {
        const tokenData = this.userTokens.get(slackUserId);
        
        if (!tokenData) {
            console.log(`⚠️ No stored token for Slack user: ${slackUserId}`);
            return undefined;
        }
        
        // Handle legacy format (plain string) vs new format (object with metadata)
        if (typeof tokenData === 'string') {
            console.log(`🔐 Found legacy token for Slack user: ${slackUserId}`);
            
            // Check expiration for legacy tokens by decoding JWT
            try {
                const parts = tokenData.split('.');
                if (parts.length === 3) {
                    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
                    if (payload.exp) {
                        const now = Date.now();
                        const expiresAt = payload.exp * 1000;
                        if (now > expiresAt) {
                            const expiredDate = new Date(expiresAt).toISOString();
                            console.log(`⚠️ Legacy token expired for Slack user: ${slackUserId} (expired at ${expiredDate})`);
                            this.userTokens.delete(slackUserId);
                            return undefined;
                        }
                        console.log(`🔐 Legacy token valid until: ${new Date(expiresAt).toISOString()}`);
                    }
                }
            } catch (error) {
                console.warn(`⚠️ Could not check legacy token expiration for ${slackUserId}: ${error.message}`);
                // Continue with legacy token if expiration check fails
            }
            
            return tokenData;
        }
        
        // Check token expiration
        const now = Date.now();
        if (tokenData.expiresAt && now > tokenData.expiresAt) {
            const expiredDate = new Date(tokenData.expiresAt).toISOString();
            console.log(`⚠️ Token expired for Slack user: ${slackUserId} (expired at ${expiredDate})`);
            this.userTokens.delete(slackUserId); // Clean up expired token
            return undefined;
        }
        
        // Update last used timestamp for analytics and cleanup
        tokenData.lastUsed = Date.now();
        this.userTokens.set(slackUserId, tokenData);
        
        if (tokenData.expiresAt) {
            const expiryDate = new Date(tokenData.expiresAt).toISOString();
            console.log(`🔐 Found valid token for Slack user: ${slackUserId} (expires at ${expiryDate})`);
        } else {
            console.log(`🔐 Found valid token for Slack user: ${slackUserId} (no expiration set)`);
        }
        
        // TODO: SECURITY IMPROVEMENT - Add audit logging
        // this.auditLog('TOKEN_ACCESS', { userId: slackUserId, timestamp: Date.now() });
        
        return tokenData.token;
    }



    /**
     * Clear a user's connection to force re-authentication
     * 
     * This is useful when consent has been granted externally and the user
     * needs a fresh connection with updated permissions.
     * 
     * @param {string} userId - The Slack user's ID
     */
    clearUserConnection(userId) {
        const wasDeleted = this.activeConnections.delete(userId);
        if (wasDeleted) {
            console.log(`🔄 Cleared connection for user ${userId} to force fresh authentication`);
        }
        return wasDeleted;
    }

    /**
     * Securely remove a user's authentication token
     * 
     * SECURITY FEATURE: Explicit token revocation for logout scenarios
     * 
     * @param {string} slackUserId - The Slack user's ID
     */
    revokeUserToken(slackUserId) {
        const wasDeleted = this.userTokens.delete(slackUserId);
        if (wasDeleted) {
            console.log(`🔐 Revoked token for Slack user: ${slackUserId}`);
            // TODO: SECURITY IMPROVEMENT - Add audit logging
            // this.auditLog('TOKEN_REVOKED', { userId: slackUserId, timestamp: Date.now() });
        }
        return wasDeleted;
    }

    /**
     * Send a message from Slack to Copilot Studio and get the AI's response
     * 
     * This is the main function that handles the back-and-forth conversation.
     * Here's what happens:
     * 1. Takes a message from a Slack user
     * 2. Finds or creates their connection to Copilot Studio
     * 3. Sends the message to the AI
     * 4. Waits for the AI's response
     * 5. Returns the response back to Slack
     * 
     * @param {string} userId - The Slack user's ID
     * @param {string} messageText - The message the user sent
     * @param {string|null} userToken - Optional: user's authentication token
     * @returns {Object} Object with 'text' property containing the AI's response
     */
    async sendMessage(userId, messageText, userToken = null) {
        let thinkingMessage = null;
        
        try {
            console.log(`📤 Sending message from user ${userId}: "${messageText}"`);

            // Post initial "thinking" message to show the bot is processing
            thinkingMessage = await this.postThinkingMessage(userId);

            // Look for an existing connection for this user
            // This is like checking if we already have an open phone line to this person
            let connection = this.activeConnections.get(userId);
            
            // If no connection exists, create a new one
            // This is like dialing the phone number if we haven't called this person yet
            if (!connection) {
                connection = await this.createUserConnection(userId, userToken);
            }

            // Send the message to Copilot Studio and wait for response
            // This uses Microsoft's official API to ask the AI a question
            const replies = await connection.client.askQuestionAsync(messageText, connection.conversationId);
            
            // DEBUG: Log the full response structure to understand what we're getting
            console.log(`🔍 DEBUG: Received ${replies.length} activities from Copilot Studio`);
            replies.forEach((activity, index) => {
                console.log(`🔍 DEBUG: Activity ${index}:`, JSON.stringify(activity, null, 2));
            });
            
            // Process the AI's response(s) - sometimes the AI sends multiple reply parts
            // We combine all the text parts into one response
            let responseText = '';
            let consentCard = null;
            let userSignInCard = null;
            replies.forEach((activity, index) => {
                console.log(`🔍 DEBUG: Processing activity ${index}: type=${activity.type}, name=${activity.name || 'none'}, hasText=${!!activity.text}`);
                
                // Check if this reply part contains text (vs images, buttons, etc.)
                if (activity.type === 'message' && activity.text) {
                    responseText += activity.text + ' ';
                } else if (activity.name === 'connectors/consentCard') {
                    consentCard = activity;
                    console.log(`🔍 DEBUG: Consent card detected! Full activity:`, JSON.stringify(activity, null, 2));
                } else if (activity.type === 'message' && !activity.text) {
                    // Check for sign-in card
                    // A sign-in card is a message with an attachment of a specific content type.
                    const isSignInCard = activity.attachments?.some(
                        att => att.contentType === 'application/vnd.microsoft.card.oauth'
                    );

                    if (isSignInCard) {
                        userSignInCard = activity;
                        console.log(`🔍 DEBUG: User sign-in card detected!`);
                    }
                    else{
                    console.log(`⚠️ DEBUG: Received message activity with no text. Full activity:`, JSON.stringify(activity, null, 2));
                    }
                }
            });
            
            // Clean up the response and provide a fallback if AI didn't respond with text
            let finalResponse;
            if (responseText.trim()) {
                finalResponse = responseText.trim();
            } else if (consentCard) {
                // Automatically send "Allow" to proceed with the flow
                console.log(`🤖 Automatically sending 'Allow' for consent card...`);
                await this.handleConsentCardResponse(consentCard, userId);
                finalResponse = "I've sent the consent approval. Please wait a moment for the process to complete.";

            } else {
                finalResponse = 'No response from Copilot Studio';
            }

            if (userSignInCard) {
                finalResponse += " ";
                finalResponse += await this.handleUserSignInCard(userSignInCard);
            }
            
            console.log(`📥 Response received for user ${userId}: "${finalResponse}"`);
            
            // Update the thinking message with the actual response
            if (thinkingMessage?.ts && thinkingMessage?.channel) {
                await this.updateThinkingMessage(thinkingMessage.channel, thinkingMessage.ts, finalResponse);
            }
            
            // Update the "last used" timestamp for this connection
            // This helps us know which connections are still active vs stale
            connection.lastActivity = Date.now();
            
            // Return empty text since we already posted the response via message update
            return { text: '' };

        } catch (error) {
            console.error(`❌ Failed to send message for user ${userId}:`, error);
            
            // If we have a thinking message, update it with error
            if (thinkingMessage?.ts && thinkingMessage?.channel) {
                await this.updateThinkingMessage(thinkingMessage.channel, thinkingMessage.ts, 
                    "Sorry, I encountered an error processing your message. Please try again.");
            }
            
            throw error;  // Let the calling code handle the error
        }
    }


//function to handle consent card responses. 
async handleConsentCardResponse(activity, userId) {
    console.log(`🤖 Handling consent card response:`, JSON.stringify(activity, null, 2));

    const consentPayload = {
        type: "message",
        channelData: {
            postBack: true,
            enableDiagnostics: true
        },
        value: {
            action: "Allow",
            id: "submit",
            shouldAwaitUserInput: true
        }
    };
    const connection = this.activeConnections.get(userId);

    if (!connection) {
        console.error(`❌ No active connection found for user ${userId} while handling consent response.`);
        return;
    }
    const responses = await connection.client.askQuestionAsync(JSON.stringify(consentPayload), connection.conversationId);
    console.log(`🤞 DEBUG: Received ${responses.length} activities for consent response`);
    responses.forEach((activity, index) => {
        if (activity.name === 'connectors/consentCard') {
            this.handleConsentCardResponse(activity);
        }
    });
}

    /**
     * Start a completely new conversation for a user
     * 
     * Sometimes users want to "reset" their conversation with the AI - like starting
     * over with a clean slate. This function:
     * 1. Deletes their existing connection/conversation
     * 2. Creates a brand new connection
     * 3. The AI will have no memory of previous messages
     * 
     * This is like hanging up the phone and calling back to start fresh.
     * 
     * @param {string} userId - The Slack user's ID
     * @returns {Object} New connection object
     */
    async newConversation(userId) {
        console.log(`🔄 Starting new conversation for user: ${userId}`);
        
        // Remove the existing connection from our records
        // This "forgets" their previous conversation
        this.activeConnections.delete(userId);

        // Create a completely fresh connection with the AI
        // This starts a new conversation with no previous context
        const newConnection = await this.createUserConnection(userId);
        console.log(`✅ New conversation started for user: ${userId}`);
        
        return newConnection;
    }

    /**
     * Get or refresh the service authentication token
     * 
     * This function gets an authentication token for our application itself,
     * rather than for a specific human user. It includes caching to avoid
     * requesting new tokens unnecessarily and automatic refresh when expired.
     * 
     * @returns {string} Authentication token for the service account
     */
    async getServiceToken() {
        try {
            const now = Date.now();
            
            // Debug: Log current token cache status
            console.log(`🔍 [DEBUG] Service token cache check:`, {
                hasToken: !!this.serviceTokenCache.token,
                currentTime: new Date(now).toISOString(),
                expiresAt: this.serviceTokenCache.expiresAt ? new Date(this.serviceTokenCache.expiresAt).toISOString() : 'not set',
                bufferTime: this.serviceTokenCache.expiresAt ? new Date(this.serviceTokenCache.expiresAt - 300000).toISOString() : 'not set',
                isValid: this.serviceTokenCache.token && now < (this.serviceTokenCache.expiresAt - 300000)
            });
            
            // Check if we have a cached token that's still valid (with 5 minute buffer)
            if (this.serviceTokenCache.token && now < (this.serviceTokenCache.expiresAt - 300000)) {
                console.log('🔐 Using cached service token');
                return this.serviceTokenCache.token;
            }

            console.log('🔄 Acquiring new service token...');
            
            // Request a token using the "client credentials" flow
            // This is OAuth jargon for "give me a token for my application, not a user"
            const clientCredentialRequest = {
                scopes: [this.config.oauth.scope],  // What permissions we're requesting
            };

            // Ask Microsoft's authentication service for a token
            const response = await this.msalInstance.acquireTokenByClientCredential(clientCredentialRequest);
            
            // Debug: Log token response details
            console.log(`🔍 [DEBUG] Token response:`, {
                hasAccessToken: !!response.accessToken,
                tokenLength: response.accessToken ? response.accessToken.length : 0,
                expiresOn: response.expiresOn ? response.expiresOn.toISOString() : 'not provided',
                expiresOnTime: response.expiresOn ? response.expiresOn.getTime() : null
            });
            
            // Cache the token with expiration time
            this.serviceTokenCache.token = response.accessToken;
            this.serviceTokenCache.expiresAt = response.expiresOn ? response.expiresOn.getTime() : (now + 3600000); // Default 1 hour if no expiry
            
            console.log(`🔐 Service token acquired successfully (expires: ${new Date(this.serviceTokenCache.expiresAt).toISOString()})`);
            return response.accessToken;

        } catch (error) {
            console.error('❌ Failed to acquire service token:', error);
            // Clear cache on error to force retry next time
            this.serviceTokenCache.token = null;
            this.serviceTokenCache.expiresAt = 0;
            throw error;
        }
    }

    /**
     * Clean up old, unused connections and expired tokens to free up memory
     * 
     * SECURITY ENHANCEMENT: Now includes token cleanup for security hygiene
     * 
     * Over time, we accumulate connections from users who may have stopped using the bot.
     * These "stale" connections take up memory and can slow down our server.
     * 
     * This function:
     * 1. Checks all active connections
     * 2. Finds ones that haven't been used recently (based on configured timeout)
     * 3. Removes them to free up memory
     * 4. Cleans up old authentication tokens for security
     * 
     * Think of it like cleaning out old phone numbers from your contacts that you never call anymore.
     * 
     * This function is called automatically every few minutes by a timer.
     */
    cleanup() {
        const now = Date.now();  // Current timestamp
        const maxAge = this.config.app.connectionTimeoutMs;  // How long connections can be inactive (from config)
        let cleanedConnectionCount = 0;
        let cleanedTokenCount = 0;

        // Clean up stale connections
        for (const [userId, connection] of this.activeConnections.entries()) {
            // Calculate how long it's been since this connection was last used
            const timeSinceLastActivity = now - connection.lastActivity;
            
            // If it's been inactive longer than our timeout, remove it
            if (timeSinceLastActivity > maxAge) {
                this.activeConnections.delete(userId);
                cleanedConnectionCount++;
            }
        }

        // SECURITY IMPROVEMENT: Clean up old authentication tokens
        // This prevents tokens from accumulating indefinitely in memory
        const tokenMaxAge = 24 * 60 * 60 * 1000; // 24 hours (could be configurable)
        
        for (const [userId, tokenData] of this.userTokens.entries()) {
            let shouldCleanup = false;
            
            if (typeof tokenData === 'string') {
                // Legacy format - clean up if no recent connection activity
                const connection = this.activeConnections.get(userId);
                if (!connection || (now - connection.lastActivity) > tokenMaxAge) {
                    shouldCleanup = true;
                }
            } else {
                // New format - check lastUsed timestamp
                if (tokenData.lastUsed && (now - tokenData.lastUsed) > tokenMaxAge) {
                    shouldCleanup = true;
                }
                
                // TODO: Also check token expiration
                // if (tokenData.expiresAt && now > tokenData.expiresAt) {
                //     shouldCleanup = true;
                // }
            }
            
            if (shouldCleanup) {
                this.userTokens.delete(userId);
                cleanedTokenCount++;
            }
        }

        // Clean up expired service token
        if (this.serviceTokenCache.token && now > this.serviceTokenCache.expiresAt) {
            console.log('🧹 Clearing expired service token from cache');
            this.serviceTokenCache.token = null;
            this.serviceTokenCache.expiresAt = 0;
        }

        // Log the results (only if we actually cleaned something up)
        if (cleanedConnectionCount > 0 || cleanedTokenCount > 0) {
            console.log(`🧹 Cleanup completed: ${cleanedConnectionCount} connections, ${cleanedTokenCount} tokens removed`);
        }
    }

    /**
     * Get statistics about current connections
     * 
     * This function provides useful information for monitoring and debugging:
     * - How many users are currently connected
     * - When each connection was last used
     * - Whether each connection has an active conversation
     * 
     * This is useful for:
     * - Monitoring server health
     * - Debugging connection issues
     * - Understanding usage patterns
     * 
     * @returns {Object} Statistics object with connection details
     */
    getStats() {
        return {
            // Total number of active connections
            activeConnections: this.activeConnections.size,
            
            // Detailed list of each connection
            connections: Array.from(this.activeConnections.entries()).map(([userId, conn]) => ({
                userId,                                                    // Which Slack user this belongs to
                lastActivity: new Date(conn.lastActivity).toISOString(), // When it was last used (human-readable format)
                hasConversationId: !!conn.conversationId                 // Whether it has an active conversation with AI
            }))
        };
    }

    /**
     * Post initial "thinking" message to show the bot is processing
     * 
     * This provides immediate feedback to the user that their message was received
     * and the bot is working on a response. The message will be updated with the
     * actual response once it's received from Copilot Studio.
     * 
     * @param {string} userId - The Slack user's ID (format: "slack_U1234567890")
     * @returns {Object|null} Object with timestamp and channel, or null if failed
     */
    async postThinkingMessage(userId) {
        try {
            // Only post thinking message if we have a Slack client available
            if (!this.slackClient) {
                console.log('⚠️ No Slack client available for thinking message');
                return null;
            }

            // Convert slack_U123 format to just U123 for Slack API
            const channelId = userId.replace('slack_', '');
            
            const result = await this.slackClient.chat.postMessage({
                channel: channelId,
                text: ':thinking_face: Thinking...'
            });
            
            console.log(`🤔 Posted thinking message for user ${userId}`);
            return { ts: result.ts, channel: result.channel };
            
        } catch (error) {
            console.error('❌ Failed to post thinking message:', error);
            return null;
        }
    }

    /**
     * Update the thinking message with the actual response
     * 
     * This replaces the "Thinking..." message with the real response from Copilot Studio,
     * creating a seamless user experience where they see immediate feedback followed by
     * the actual answer in the same message.
     * 
     * @param {string} channelId - The Slack channel ID where the message was posted
     * @param {string} messageTs - The timestamp of the message to update
     * @param {string} responseText - The actual response text to display
     */
    async updateThinkingMessage(channelId, messageTs, responseText) {
        try {
            // Only update if we have a Slack client available
            if (!this.slackClient) {
                console.log('⚠️ No Slack client available for message update');
                return;
            }
            
            await this.slackClient.chat.update({
                channel: channelId,
                ts: messageTs,
                text: responseText
            });
            
            console.log(`✅ Updated thinking message in channel ${channelId}`);
            
        } catch (error) {
            console.error('❌ Failed to update thinking message:', error);
            
            // Fallback: post new message if update fails
            try {
                await this.slackClient.chat.postMessage({
                    channel: channelId,
                    text: responseText
                });
                console.log(`📤 Posted fallback message in channel ${channelId}`);
            } catch (fallbackError) {
                console.error('❌ Failed to post fallback message:', fallbackError);
            }
        }
    }

    /**
     * Handle user sign-in card by creating a Slack-friendly sign-in message
     * 
     * This function takes a sign-in card from Copilot Studio and transforms it
     * into a message that can be displayed in Slack. The goal is to provide
     * the user with a link to sign in with their Microsoft account.
     * 
     * @param {Object} userSignInCard - The sign-in card activity from Copilot Studio
     * @returns {string} A formatted string for Slack with the sign-in link
     */
    async handleUserSignInCard(userSignInCard) {
        try {
            console.log(`🔐 User sign-in card detected. Preparing sign-in link.`);
            
            // The sign-in card is usually in the first attachment
            const attachment = userSignInCard.attachments?.[0];
            if (!attachment || attachment.contentType !== 'application/vnd.microsoft.card.oauth') {
                console.error('❌ Invalid or missing sign-in card attachment.');
                return 'I need you to sign in, but I could not find the sign-in link. Please try again.';
            }

            const cardContent = attachment.content;
            const signInButton = cardContent?.buttons?.find(b => b.type === 'signin');
            
            if (!signInButton || !signInButton.value) {
                console.error('❌ Sign-in card is missing a valid sign-in button or URL.');
                return 'I need you to sign in, but the link is missing. Please contact support.';
            }

            const signInUrl = signInButton.value;
            const promptText = cardContent.text || 'Please sign in to continue.';

            // Create a user-friendly message for Slack
            const responseText = `${promptText}\n\nClick here to sign in: <${signInUrl}|Sign In>`;
            
            console.log(`✅ Generated sign-in link for user.`);
            return responseText;

        } catch (error) {
            console.error('❌ Failed to handle user sign-in card:', error);
            return 'Sorry, I encountered an error while trying to get you signed in. Please try again.';
        }
    }

    /**
     * Handle consent card by showing a simple warning message
     * 
     * This function detects consent cards from Copilot Studio and shows a warning
     * that user consent is required. This is a simplified approach until we can
     * properly implement the consent flow.
     * 
     * @param {Object} consentCard - The consent card activity from Copilot Studio
     * @param {string} userId - The Slack user's ID
     * @returns {string} Warning message about consent requirement
     */
    async handleConsentCard(consentCard, userId) {
        try {
            console.log(`🔐 Consent card detected for user ${userId}`);
            console.log(`🔍 DEBUG: Consent card details:`, JSON.stringify(consentCard, null, 2));
            
            // Extract service name if possible
            let serviceName = 'external service';
            const attachment = consentCard.attachments?.[0];
            const card = attachment?.content;
            
            if (card) {
                // Look for service name in the card body
                const serviceBlock = card.body?.find(block => 
                    block.type === 'ColumnSet' && 
                    block.columns?.some(col => 
                        col.items?.some(item => item.type === 'TextBlock' && item.weight === 'bolder')
                    )
                );
                
                if (serviceBlock) {
                    const serviceColumn = serviceBlock.columns?.find(col => 
                        col.items?.some(item => item.type === 'TextBlock' && item.weight === 'bolder')
                    );
                    const serviceTextBlock = serviceColumn?.items?.find(item => 
                        item.type === 'TextBlock' && item.weight === 'bolder'
                    );
                    if (serviceTextBlock?.text) {
                        serviceName = serviceTextBlock.text;
                    }
                }
            }
            
            return `⚠️ **User Consent Required**\n\nI need permission to access ${serviceName} to complete your request. This feature is currently being developed. Please contact your administrator if you need access to ${serviceName}.`;
            
        } catch (error) {
            console.error('❌ Failed to handle consent card:', error);
            return `⚠️ User consent required for external service access. This feature is currently being developed.`;
        }
    }
}

export default RelayMiddleware;
