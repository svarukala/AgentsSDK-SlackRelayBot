/**
 * Slack Bot Integration - Real-time Slack to Copilot Studio Bridge
 * 
 * This file manages the Slack side of our bot application using Socket Mode.
 * Think of it as the "front desk" that:
 * 1. Listens for messages from Slack users (direct messages and @mentions)
 * 2. Checks if users are authenticated (if required)
 * 3. Optionally uses SAML SSO for seamless authentication
 * 4. Shows typing indicators for better user experience
 * 5. Forwards messages to the Relay Middleware for AI processing
 * 6. Sends AI responses back to Slack
 * 
 * Key Technologies:
 * - Slack Bolt SDK: Official Slack framework for building apps
 * - Socket Mode: Real-time connection to Slack (no webhooks needed)
 * - OAuth Authentication: Secure user authentication with Microsoft
 * - SAML SSO Integration: Seamless authentication for SAML-enabled orgs
 * - Typing Indicators: Enhanced user experience during AI processing
 * 
 * How Socket Mode Works:
 * Instead of Slack sending webhooks to our server, we establish a persistent
 * WebSocket connection to Slack. This is perfect for development and internal
 * tools since it doesn't require a public URL or SSL certificates.
 * 
 * SAML SSO Integration:
 * When enabled, the bot can detect users who are already authenticated via SAML
 * and optionally skip the interactive OAuth flow for a seamless experience.
 * This is particularly useful for organizations where users authenticate to
 * both Slack and Microsoft services through the same identity provider.
 * 
 * SECURITY CONSIDERATIONS:
 * ⚠️  CURRENT SECURITY CONCERNS:
 * - No rate limiting on message processing (could be abused)
 * - Error messages may leak system information
 * - No input validation or sanitization of user messages
 * - Authentication bypass possible if config is modified at runtime
 * - No audit logging of user interactions
 * - Slack user IDs used directly without validation
 * - SAML assertion validation not yet fully implemented
 * 
 * 🔒 PRODUCTION SECURITY IMPROVEMENTS NEEDED:
 * - Implement rate limiting per user/channel
 * - Add comprehensive input validation and sanitization
 * - Implement audit logging for compliance (who said what, when)
 * - Add message content filtering for sensitive data
 * - Implement user permission levels (admin vs regular users)
 * - Add monitoring and alerting for suspicious activity
 * - Validate Slack signatures on all incoming requests
 * - Implement graceful degradation for service outages
 * - Add message size limits to prevent abuse
 * - Consider implementing conversation timeouts
 * - Complete SAML assertion signature validation
 * - Add email domain allowlist for SAML authentication
 * 
 * 📊 USER EXPERIENCE FEATURES:
 * - Typing indicators during AI processing
 * - Rich message formatting with buttons for authentication
 * - Slash commands for easy conversation management
 * - Error handling with user-friendly messages
 * - Seamless SAML SSO authentication (when configured)
 */

import pkg from '@slack/bolt';
const { App } = pkg;
import SamlAuthHandler from '../auth/saml-handler.js';

class SlackBot {
    /**
     * Constructor: Initialize the Slack Bot
     * 
     * Sets up the Slack App using the Bolt framework with Socket Mode.
     * Socket Mode creates a persistent WebSocket connection to Slack, which means:
     * - No need for a public URL or webhooks
     * - Real-time message delivery
     * - Perfect for development and internal tools
     * - Requires an App Token (different from Bot Token)
     * 
     * Also initializes SAML SSO handler for seamless authentication when configured.
     * 
     * @param {Object} config - Application configuration
     * @param {RelayMiddleware} relayMiddleware - Bridge to Copilot Studio
     * 
     * SECURITY NOTE: All tokens are stored in memory during runtime.
     * In production, consider implementing secure token storage.
     */
    constructor(config, relayMiddleware) {
        this.config = config;
        this.relay = relayMiddleware;  // Our bridge to Microsoft Copilot Studio
        
        // Initialize SAML SSO handler for seamless authentication
        this.samlHandler = new SamlAuthHandler();
        
        // Initialize Slack App with Socket Mode
        // Think of this as creating a "phone line" to Slack that stays open
        this.app = new App({
            token: config.slack.botToken,           // Bot token (starts with xoxb-)
            signingSecret: config.slack.signingSecret,  // Used to verify requests from Slack
            socketMode: true,                       // Use WebSocket instead of webhooks
            appToken: config.slack.appToken,       // App token for Socket Mode (starts with xapp-)
            logLevel: config.logLevel || 'info'    // Controls how much logging Slack SDK does
        });
        
        this.setupEventHandlers();
        console.log('💬 Slack Bot initialized with SAML SSO support');
    }

    /**
     * Set up Slack event handlers
     * 
     * This method defines how our bot responds to different events from Slack:
     * 1. Direct messages to the bot
     * 2. @mentions in channels
     * 3. Slash commands (like /newchat)
     * 
     * Each handler follows the same pattern:
     * - Authenticate user (if required)
     * - Show typing indicator for better UX
     * - Forward message to AI via Relay Middleware
     * - Send AI response back to Slack
     * 
     * SECURITY CONSIDERATIONS:
     * - User input is passed directly to AI without sanitization
     * - No rate limiting implemented
     * - Error messages might leak sensitive information
     * - No audit logging of conversations
     */
    setupEventHandlers() {
        // Handle direct messages and mentions
        // This is the main event handler that processes most user interactions
        this.app.message(async ({ message, say, client }) => {
            try {
                // Skip bot messages, message changes, and messages in threads (for now)
                // This prevents infinite loops where the bot responds to itself
                if (message.subtype === 'bot_message' || 
                    message.subtype === 'message_changed' ||
                    message.thread_ts || 
                    message.bot_id) {
                    return;
                }

                // Get user info for better logging and user experience
                // This API call provides real name, display name, etc.
                let userName = 'Unknown User';
                let userId = `slack_${message.user}`;  // Add prefix to distinguish from other platforms
                
                try {
                    const userInfo = await client.users.info({ user: message.user });
                    userName = userInfo.user.real_name || userInfo.user.name;
                } catch (userInfoError) {
                    console.warn(`⚠️ Could not get user info for ${message.user}:`, userInfoError.message);
                    // Continue with default userName, don't fail the whole message
                }

                console.log(`📨 Message from ${userName} (${userId}): "${message.text}"`);

                // AUTHENTICATION CHECK: SAML SSO or OAuth verification
                // This is where we enforce the security boundary with enhanced SAML support
                if (this.config.copilotStudio.requireAuth) {
                    let storedToken = this.relay.getUserToken(userId);
                    let authenticationMethod = 'none';
                    
                    // SAML SSO ENHANCEMENT: Check if user can be authenticated via SAML
                    if (!storedToken && this.samlHandler.enabled) {
                        console.log(`🔐 Checking SAML SSO authentication for ${userId}`);
                        
                        try {
                            const samlAuthResult = await this.samlHandler.canSkipOAuthForUser(message.user, userInfo.user);
                            
                            if (samlAuthResult.canSkipOAuth) {
                                console.log(`✅ SAML SSO: User ${userId} authenticated via SAML`);
                                
                                // Generate authentication token based on SAML validation
                                const samlToken = await this.samlHandler.generateSamlAuthToken(message.user, samlAuthResult.userInfo);
                                
                                if (samlToken) {
                                    // Store SAML-generated token for future use
                                    this.relay.storeUserToken(userId, samlToken);
                                    storedToken = samlToken;
                                    authenticationMethod = 'saml';
                                    
                                    // Log SAML authentication event for auditing
                                    this.samlHandler.logAuthenticationEvent(userId, 'saml_authenticated', {
                                        reason: samlAuthResult.reason,
                                        userName: userName
                                    });
                                    
                                    // Notify user of seamless authentication (optional)
                                    if (this.config.saml.identityProvider === 'entraid') {
                                        await say(`🔐 Welcome ${userName}! I can see you're authenticated via Microsoft SSO. How can I help you today?`);
                                    }
                                } else {
                                    console.log('⚠️ SAML SSO: Token generation failed - falling back to OAuth');
                                    
                                    // Log SAML token generation failure
                                    this.samlHandler.logAuthenticationEvent(userId, 'saml_token_failed', {
                                        reason: 'Token generation failed',
                                        userName: userName
                                    });
                                }
                            } else {
                                console.log(`🔐 SAML SSO: ${samlAuthResult.reason} - using OAuth flow`);
                                
                                // Log why SAML authentication was not used
                                this.samlHandler.logAuthenticationEvent(userId, 'saml_skipped', {
                                    reason: samlAuthResult.reason,
                                    action: samlAuthResult.action,
                                    userName: userName
                                });
                            }
                        } catch (samlError) {
                            console.error('❌ SAML SSO: Error during SAML authentication check:', samlError.message);
                            
                            // Log SAML error but continue with OAuth
                            this.samlHandler.logAuthenticationEvent(userId, 'saml_error', {
                                error: samlError.message,
                                userName: userName
                            });
                        }
                    }
                    
                    // If no token after SAML check, require OAuth authentication
                    if (!storedToken) {
                        console.log(`🔐 User ${userId} not authenticated - sending auth link`);
                        await this.sendAuthenticationLink(message.user, say);
                        return;
                    }

                    // Log successful authentication method for monitoring
                    if (authenticationMethod === 'saml') {
                        console.log(`🔐 User ${userId} authenticated via SAML SSO`);
                    } else {
                        console.log(`🔐 User ${userId} authenticated via OAuth`);
                    }

                    // Show typing indicator while processing (enhanced UX)
                    await this.showTypingIndicator(message.channel);

                    // Send to Copilot Studio with authenticated user token
                    // This ensures the AI call is made with proper user context
                    const response = await this.relay.sendMessage(userId, message.text, storedToken);
                    
                    if (response && response.text) {
                        await say(response.text);
                        console.log(`✅ Response sent to Slack: "${response.text}"`);
                    } else {
                        //TBD
                        // console.log('⚠️ No response from Copilot Studio');
                    }
                } else {
                    // UNAUTHENTICATED MODE: Use service account (less secure but simpler)
                    // WARNING: In this mode, all users share the same AI context
                    await this.showTypingIndicator(message.channel);

                    // Send without authentication using service account
                    const response = await this.relay.sendMessage(userId, message.text);
                    
                    if (response && response.text) {
                        await say(response.text);
                        console.log(`✅ Response sent to Slack: "${response.text}"`);
                    } else {
                        //TBD
                        //console.log('⚠️ No response from Copilot Studio');
                    }
                }

            } catch (error) {
                console.error('❌ Error handling Slack message:', error);
                
                // Send generic error message to user
                // TODO: Improve error handling to prevent information leakage
                try {
                    await say('Sorry, I encountered an error processing your message. Please try again.');
                } catch (sayError) {
                    console.error('❌ Failed to send error message:', sayError);
                }
            }
        });

        // Handle slash command for new conversation
        // Slash commands provide a clean UI for bot interactions
        // Users can type "/newchat" to reset their conversation context
        this.app.command('/newchat', async ({ command, ack, respond, client }) => {
            await ack();  // Always acknowledge slash commands immediately (Slack requirement)
            
            try {
                const userId = `slack_${command.user_id}`;
                const userInfo = await client.users.info({ user: command.user_id });
                const userName = userInfo.user.real_name || userInfo.user.name;

                console.log(`🔄 New conversation requested by ${userName} (${userId})`);

                // Clear the conversation context in Copilot Studio
                // This starts fresh without previous conversation history
                await this.relay.newConversation(userId);
                await respond('🔄 Started a new conversation! You can now ask me anything.');

                console.log(`✅ New conversation started for ${userName}`);

            } catch (error) {
                console.error('❌ Error starting new conversation:', error);
                await respond('❌ Failed to start new conversation. Please try again.');
            }
        });

        // Handle app mentions (@botname in channels)
        // This allows the bot to participate in channel conversations when mentioned
        // Different from direct messages - requires @mention to activate
        this.app.event('app_mention', async ({ event, say, client }) => {
            try {
                // Remove the bot mention from the message text
                // Slack sends mentions like "<@U1234567890>" which we need to clean
                const text = event.text.replace(/<@[^>]+>/g, '').trim();
                
                if (!text) {
                    await say('Hi! How can I help you today?');
                    return;
                }

                const userInfo = await client.users.info({ user: event.user });
                const userName = userInfo.user.real_name || userInfo.user.name;
                const userId = `slack_${event.user}`;

                console.log(`👋 Mention from ${userName} (${userId}): "${text}"`);

                // Same authentication pattern as direct messages
                if (this.config.copilotStudio.requireAuth) {
                    const storedToken = this.relay.getUserToken(userId);
                    
                    if (!storedToken) {
                        console.log(`🔐 User ${userId} not authenticated - sending auth link`);
                        await this.sendAuthenticationLink(event.user, say);
                        return;
                    }

                    // Show typing indicator while processing
                    await this.showTypingIndicator(event.channel);

                    // Send to Copilot Studio with authenticated user token
                    const response = await this.relay.sendMessage(userId, text, storedToken);
                    
                    if (response && response.text) {
                        await say(response.text);
                        console.log(`✅ Response sent to Slack: "${response.text}"`);
                    } else {
                        //TBD
                        //console.log('⚠️ No response from Copilot Studio');
                    }
                } else {
                    // Show typing indicator while processing
                    await this.showTypingIndicator(event.channel);

                    // Send without authentication
                    const response = await this.relay.sendMessage(userId, text);
                    
                    if (response && response.text) {
                        await say(response.text);
                        console.log(`✅ Response sent to Slack: "${response.text}"`);
                    } else {
                        //TBD
                        //console.log('⚠️ No response from Copilot Studio');
                    }
                }

            } catch (error) {
                console.error('❌ Error handling app mention:', error);
                await say('Sorry, I encountered an error. Please try again.');
            }
        });

        // Remove consent button handlers for now



        // Global error handler for the Slack app
        // This catches any unhandled errors in event processing
        // SECURITY NOTE: Be careful not to leak sensitive information in error logs
        this.app.error(async (error) => {
            console.error('❌ Slack app error:', error);
        });
    }

    /**
     * Show typing indicator in Slack channel
     * 
     * This provides visual feedback to users that the bot is processing their message.
     * It's like showing "..." when someone is typing in a chat app.
     * 
     * Important limitations of Slack's typing indicator:
     * - Only works in channels where the bot is a member
     * - Has a short duration (disappears after a few seconds)
     * - May not work consistently in all Slack clients
     * - Different behavior in DMs vs channels vs group chats
     * 
     * @param {string} channel - Slack channel ID to show typing indicator in
     * 
     * SECURITY NOTE: Channel IDs are considered non-sensitive but logging them
     * could reveal conversation patterns for analytics purposes.
     */
    async showTypingIndicator(channel) {
        try {
            // Use Slack's conversations.typing API
            // This is a recent addition to improve user experience
            await this.app.client.conversations.typing({
                channel: channel
            });
            
            // Log for debugging with channel type detection
            const channelType = channel.startsWith('D') ? 'DM' : 
                               channel.startsWith('C') ? 'Channel' : 
                               'Unknown';
            console.log(`⏳ Typing indicator sent for ${channelType}: ${channel}`);
        } catch (error) {
            // Typing indicator failures are non-critical, just log a warning
            // Don't fail the entire message processing if this doesn't work
            console.warn('⚠️ Failed to show typing indicator:', error.message);
        }
    }

    /**
     * Send authentication link to Slack user
     * 
     * Creates a rich message with a button that links to our OAuth flow.
     * This provides a smooth user experience for authentication.
     * 
     * The authentication flow:
     * 1. User clicks button in Slack
     * 2. Opens browser to our /auth/login endpoint
     * 3. Redirects to Microsoft OAuth
     * 4. User grants permissions
     * 5. Microsoft redirects back to our app
     * 6. We store the token and notify user in Slack
     * 
     * @param {string} slackUserId - Slack user ID to authenticate
     * @param {Function} say - Slack's say function to send messages
     * 
     * SECURITY CONSIDERATIONS:
     * - Auth URL contains user ID in path (could be logged by proxies)
     * - No CSRF protection on auth initiation
     * - Base URL construction could be vulnerable to header injection
     * - Consider using state parameter for additional security
     */
    async sendAuthenticationLink(slackUserId, say) {
        const baseUrl = this.config.server?.baseUrl || `http://localhost:${this.config.server?.port || 8005}`;
        const authUrl = `${baseUrl}/auth/login/${slackUserId}`;
        
        console.log(`🔗 Generating auth URL: ${authUrl} (base: ${baseUrl})`);
        
        // Create rich Slack message with authentication button
        // Using Slack's Block Kit for better UI than plain text
        const message = {
            text: '🔐 Authentication Required',  // Fallback text for notifications
            blocks: [
                {
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: '🔐 *Authentication Required*\n\nTo use this bot, you need to authenticate with your Microsoft account.'
                    }
                },
                {
                    type: 'actions',
                    elements: [
                        {
                            type: 'button',
                            text: {
                                type: 'plain_text',
                                text: '🔗 Authenticate with Microsoft'
                            },
                            url: authUrl,
                            action_id: 'auth_button'
                        }
                    ]
                }
            ]
        };

        await say(message);
    }

    /**
     * Notify user that authentication was successful
     * 
     * Sends a direct message to the user confirming their authentication worked.
     * This closes the loop and lets them know they can start using the bot.
     * 
     * @param {string} slackUserId - Slack user ID with 'slack_' prefix
     * 
     * SECURITY NOTE: This sends a DM to confirm auth success, which could
     * be sensitive information if accounts are compromised.
     */
    async notifyAuthSuccess(slackUserId) {
        try {
            if (this.app && this.app.client) {
                await this.app.client.chat.postMessage({
                    channel: slackUserId.replace('slack_', ''), // Remove prefix for DM
                    text: '✅ *Authentication Successful!*\n\nYou can now chat with the bot. Just send me a message or mention me in a channel!'
                });
                console.log(`✅ Sent auth success notification to ${slackUserId}`);
            }
        } catch (error) {
            console.error(`❌ Failed to send auth success notification to ${slackUserId}:`, error);
        }
    }

    /**
     * Start the Slack bot
     * 
     * Initializes the Socket Mode connection to Slack and starts listening for events.
     * Also sets up the cleanup interval for the relay middleware to prevent memory leaks.
     * 
     * Socket Mode creates a persistent WebSocket connection that:
     * - Receives events in real-time
     * - Handles reconnection automatically
     * - Doesn't require webhooks or public URLs
     * - Perfect for development and internal tools
     * 
     * SECURITY CONSIDERATIONS:
     * - No connection encryption validation
     * - Cleanup interval could be abused for DoS if configurable by users
     * - No graceful degradation if Slack connection fails
     */
    async start() {
        try {
            // Add connection event handlers before starting
            this.app.client.on('disconnect', (error) => {
                console.log('⚠️ Slack WebSocket disconnected:', error?.message || 'Unknown reason');
                console.log('🔄 Slack will attempt to reconnect automatically...');
            });

            this.app.client.on('error', (error) => {
                console.error('❌ Slack client error:', error?.message || error);
                // Don't throw here - let the client handle reconnection
            });

            await this.app.start();
            console.log('⚡️ Slack bot is running!');
            
            // Connect Slack client to RelayMiddleware for thinking messages
            if (this.app.client && this.relay.slackClient !== this.app.client) {
                this.relay.slackClient = this.app.client;
                console.log('🔗 Connected Slack client to RelayMiddleware for thinking messages');
            }
            
            // Start cleanup interval for relay middleware
            // This prevents memory leaks by cleaning up old connections
            setInterval(() => {
                this.relay.cleanup();
            }, this.config.app.cleanupIntervalMs);

            console.log(`🧹 Cleanup interval started (every ${this.config.app.cleanupIntervalMs / (60 * 1000)} minutes)`);

        } catch (error) {
            console.error('❌ Failed to start Slack bot:', error);
            
            // Provide more specific error messages for common issues
            if (error.message.includes('invalid_auth') || error.message.includes('token')) {
                console.error('🔑 Authentication failed - check your Slack tokens in .env file');
                console.error('ℹ️ Verify SLACK_BOT_TOKEN, SLACK_SIGNING_SECRET, and SLACK_APP_TOKEN');
            } else if (error.message.includes('socket')) {
                console.error('🔌 Socket Mode connection failed - check network connectivity');
                console.error('ℹ️ Ensure Socket Mode is enabled in your Slack app configuration');
            } else if (error.message.includes('server explicit disconnect')) {
                console.error('🔄 Slack server disconnected during connection - this is usually temporary');
                console.error('ℹ️ The bot will attempt to reconnect automatically');
            }
            
            throw error;
        }
    }

    /**
     * Stop the Slack bot
     * 
     * Gracefully shuts down the Socket Mode connection to Slack.
     * This should be called during application shutdown to clean up resources.
     * 
     * SECURITY NOTE: Doesn't clear sensitive data from memory.
     * Consider implementing secure memory cleanup for tokens.
     */
    async stop() {
        try {
            await this.app.stop();
            console.log('🛑 Slack bot stopped');
        } catch (error) {
            console.error('❌ Error stopping Slack bot:', error);
            throw error;
        }
    }
}

export default SlackBot;
