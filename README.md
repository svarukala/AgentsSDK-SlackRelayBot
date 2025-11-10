# 🤖 Slack Relay Bot

**DISCLAIMER**: This is a proof of concept code and not ready for production deployment. There could be undocumented bugs. 

**Transform your Slack workspace into an AI-powered collaboration hub by connecting it directly to Microsoft Copilot Studio.**

This headless middleware bot creates a seamless bridge between Slack users and Microsoft Copilot Studio agents using the official Microsoft Agents SDK. Your team can chat with your custom AI agents without leaving Slack - no WebChat iframes, no context switching, just natural conversation.

## 🎯 What This Solves

**The Problem**: Your organization has invested in Microsoft Copilot Studio to create custom AI agents, but your team lives in Slack. Context switching between tools breaks workflow and reduces AI adoption.

**The Solution**: This bot brings your Copilot Studio agents directly into Slack conversations, maintaining the full power of your AI while keeping teams in their preferred collaboration environment.

## ✨ Key Features

- 🤖 **Native Microsoft Integration** - Direct connection using official Microsoft Agents SDK (no WebChat wrapper)
- 💬 **Real-time Messaging** - Slack Socket Mode for instant responses without webhook complexity
- 🔐 **Enterprise Security** - OAuth 2.0 + PKCE authentication with Azure AD integration
- 👥 **Multi-user & Multi-tenant** - Each user gets isolated conversations with proper authentication
- 🔄 **Conversation Management** - Users can reset context and start fresh conversations
- 📊 **Production Ready** - Health monitoring, graceful shutdown, and comprehensive logging
- 🧹 **Resource Efficient** - Automatic cleanup of idle connections to prevent memory leaks
- ⚡ **Enhanced UX** - Typing indicators and rich message formatting for better user experience

## 🏗️ Architecture & Flow

```
┌─────────────┐    WebSocket    ┌──────────────┐    Agents SDK    ┌─────────────────┐
│ Slack Users │ ←────────────→ │  Slack Bot   │ ←──────────────→ │ Copilot Studio  │
└─────────────┘                 └──────────────┘                  └─────────────────┘
       │                               │                                   ▲
       │                               │                                   │
       ▼                               ▼                                   │
┌─────────────┐    HTTPS/OAuth   ┌──────────────┐    MSAL Auth     ┌─────────────────┐
│ Web Browser │ ←──────────────→ │ Express App  │ ←──────────────→ │ Microsoft Entra │
└─────────────┘                 └──────────────┘                  └─────────────────┘
```

**Authentication Flow:**
1. User messages bot in Slack
2. Bot checks for stored authentication token
3. If needed, bot sends OAuth link via Slack
4. User authenticates with Microsoft via secure PKCE flow
5. Bot stores token and enables personalized AI conversations
6. All future messages use user's authenticated context

## 📋 Prerequisites

Before you begin, ensure you have access to these Microsoft and Slack resources:

### 🎨 Microsoft Copilot Studio Setup
- [ ] **Published Copilot Studio Agent** - Your AI agent must be published and accessible
- [ ] **Azure AD App Registration** - With client secret and proper permissions
- [ ] **Power Platform Environment** - Know your Environment ID
- [ ] **Agent Identifier** - Your specific agent/bot ID

### 💬 Slack App Requirements  
- [ ] **Slack Workspace Admin Access** - To create and install apps
- [ ] **Socket Mode Enabled** - For real-time messaging without webhooks
- [ ] **OAuth Scopes Configured** - Specific permissions for bot functionality
- [ ] **App Tokens Generated** - Bot token, signing secret, and app-level token

### 🛠️ Technical Requirements
- [ ] **Node.js 18+** - For local development
- [ ] **Docker & Docker Compose** - For containerized deployment (recommended)
- [ ] **HTTPS Domain** - For production OAuth callbacks (localhost OK for development)

## 🚀 Quick Start Guide

### ⚡ TL;DR - Get Running in 5 Minutes

If you just want to get the bot running quickly:

1. **Clone and setup:**
   ```bash
   git clone <this-repository>
   cd slack-relay-bot
   cp .env.example .env
   # Edit .env with your credentials (see Configuration section below)
   ```

2. **Start the bot:**
   ```bash
   make up          # Production mode
   # OR
   make dev         # Development mode with live reload
   ```

3. **Test it's working:**
   ```bash
   make test        # Check health endpoints
   ```

**That's it!** Your bot should be running on `http://localhost:3000`

---

### 📦 Option 1: Docker Installation (Recommended)

**Perfect for production deployments and if you want to get running quickly without Node.js setup.**

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd slack-relay-bot
   ```

2. **Set up your environment:**
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Edit with your actual values (see Configuration section below)
   nano .env  # or use your preferred editor
   ```

3. **Start with Docker Compose:**
   ```bash
   # For production deployment
   make up
   # OR: docker compose up --build -d
   
   # For development with live reload
   make dev
   # OR: docker compose -f docker compose.dev.yml up --build
   
   # Check logs to ensure everything started correctly
   make logs
   # OR: docker compose logs -f slack-relay-bot
   ```

4. **Verify installation:**
   ```bash
   # Quick test of all endpoints
   make test
   
   # Manual health check
   curl http://localhost:3000/health
   # Should return: {"status":"healthy","timestamp":"..."}
   
   # Detailed status
   curl http://localhost:3000/status
   ```

### 💻 Option 2: Local Development Installation

**Best for active development and customization of the bot code.**

1. **Prerequisites check:**
   ```bash
   # Verify Node.js version (18+ required)
   node --version
   npm --version
   ```

2. **Clone and install:**
   ```bash
   git clone <repository-url>
   cd slack-relay-bot
   
   # Install all dependencies
   npm install
   ```

3. **Environment setup:**
   ```bash
   # Copy example environment file
   cp .env.example .env
   
   # Edit with your configuration (detailed guide below)
   code .env  # or your preferred editor
   ```

5. **Start the bot:**
   ```bash
   # Development mode (auto-restart on file changes)
   npm run dev
   
   # Production mode
   npm start
   
   # OR use make commands for consistency:
   make dev     # Development with Docker
   make up      # Production with Docker
   ```

5. **Verify setup:**
   ```bash
   # Test health endpoint
   curl http://localhost:3000/health
   
   # Test status endpoint for detailed info
   curl http://localhost:3000/status
   ```

## ⚙️ Configuration Guide

Your `.env` file is the control center for the entire application. Here's how to configure each section:

### 🎨 Microsoft Copilot Studio Configuration

```bash
# Your Power Platform environment (find in Power Platform admin center)
COPILOT_ENVIRONMENT_ID=12345678-1234-1234-1234-123456789012

# Your specific agent/bot identifier (from Copilot Studio)
COPILOT_AGENT_IDENTIFIER=your-bot-name-or-id

# Azure App Registration details (from Azure Portal)
COPILOT_APP_CLIENT_ID=87654321-4321-4321-4321-210987654321
COPILOT_CLIENT_SECRET=your-super-secret-client-secret
COPILOT_TENANT_ID=11111111-1111-1111-1111-111111111111

# Authentication requirement (true = more secure, false = easier testing)
COPILOT_REQUIRE_AUTH=true
```

**Where to find these values:**
- **Environment ID**: Power Platform Admin Center → Environments → Select yours → Settings
- **Agent ID**: Copilot Studio → Your agent → Settings → Agent details
- **App Registration**: Azure Portal → App Registrations → Your app → Overview
- **Client Secret**: Azure Portal → App Registrations → Your app → Certificates & secrets

### 💬 Slack Configuration

```bash
# Get these from your Slack app configuration
SLACK_BOT_TOKEN=xoxb-placeholder-token
SLACK_SIGNING_SECRET=placeholder-secret
SLACK_APP_TOKEN=xapp-1-placeholder-token
```

**Where to find these values:**
- **Bot Token**: Slack App → OAuth & Permissions → Bot User OAuth Token
- **Signing Secret**: Slack App → Basic Information → App Credentials → Signing Secret  
- **App Token**: Slack App → Basic Information → App-Level Tokens

### 🌐 Server Configuration

```bash
# Port for the web server (OAuth callbacks and health checks)
PORT=3000

# Environment mode (development for testing, production for live)
NODE_ENV=development

# Your server's public URL (for OAuth redirects)
SERVER_BASE_URL=http://localhost:3000  # Development
# SERVER_BASE_URL=https://your-domain.com  # Production

# OAuth settings for Power Platform API access
OAUTH_AUTHORITY=https://login.microsoftonline.com
OAUTH_SCOPE=https://api.powerplatform.com/.default

# Application behavior
LOG_LEVEL=info
CLEANUP_INTERVAL_MS=300000
CONNECTION_TIMEOUT_MS=1800000
AUTH_POPUP_CLOSE_DELAY=3000
```

## 🔧 Detailed Setup Instructions

### 📝 Step 1: Create Azure App Registration

1. **Go to Azure Portal** → Azure Active Directory → App registrations
2. **Click "New registration"**
3. **Fill in details:**
   - Name: `Slack Copilot Bot`
   - Supported account types: `Accounts in this organizational directory only`
   - Redirect URI: `Web` → `http://localhost:3000/auth/callback` (for development)
4. **Click "Register"**
5. **Add additional redirect URIs:**
   - Go to Authentication → Redirect URIs → Add URI
   - **Platform type:** Select "Web" for all redirect URIs
   - Add: `https://token.botframework.com/.auth/web/redirect` (required for Copilot Studio manual authentication)
   - For production, also add: `https://your-domain.com/auth/callback`
6. **Note down:** Application (client) ID and Directory (tenant) ID
7. **Go to "Certificates & secrets"** → Client secrets → New client secret
8. **Note down:** The secret value (you won't see it again!)
9. **Go to "API permissions"** → Add API permissions for Power Platform API:
   - **Click "Add a permission"**
   - **Select "APIs my organization uses"** 
   - **Search for "Power Platform API"**
   - **Add these permissions:**
     - **Delegated:** `CopilotStudio.Copilots.Invoke` (user authentication)
     - **Application:** `CopilotStudio.Copilots.Invoke` (service account access)
   - **If you don't see Power Platform API**, see this article: [Power Platform Authentication Guide](https://learn.microsoft.com/en-us/power-platform/admin/programmability-authentication-v2?tabs=powershell)
   
   📖 **Reference:** [Power Platform Authentication Guide](https://learn.microsoft.com/en-us/power-platform/admin/programmability-authentication-v2?tabs=powershell)

10. **Grant admin consent** for your organization (required for both delegated and application permissions)

### 🎨 Step 2: Configure Copilot Studio

1. **Open Copilot Studio** → Select your environment
2. **Create or select your agent/bot**
3. **Configure Manual Authentication BEFORE Publishing** (⚠️ **Critical:** Manual authentication cannot be changed after publishing):
   - Go to Settings → Security → Authentication
   - Choose "Manual (for any channel including Teams)"
   - **Redirect URL:** https://token.botframework.com/.auth/web/redirect
   - **Service Provider:** Microsoft Entra ID
   - **Client ID:** Your Azure App Registration Client ID
   - **Client Secret:** Your Azure App Registration Client Secret
   - **Grant type:** ``
   - **Login URL:** ``
   - **Tenant ID:** `{hardcoded}`
   - **Resource URL:** `https://api.powerplatform.com/`
   - **Scopes:** `profile openid`
   - **Save** the authentication configuration
4. **Publish your agent** (must be published to work with SDK)
5. **Go to Settings** → Advanced > Metadata
6. **Note down:** 
   - Environment ID
   - Tenant ID
   - Agent app ID
   - Schema name
7. **Ensure your agent** has proper conversation flow and responses configured

**Note:** The manual authentication setup allows Copilot Studio to handle user authentication directly, using the `https://token.botframework.com/.auth/web/redirect` callback URL. This works alongside the bot's OAuth flow for a seamless user experience.

**Authentication Options:**
- **Without Manual Auth:** Users authenticate via the bot's OAuth flow (`/auth/callback`)
- **With Manual Auth:** Copilot Studio can also authenticate users directly (both methods work together)
- **Production Recommendation:** Enable manual authentication for better integration with Copilot Studio's built-in auth features

### 💬 Step 3: Create Slack App

1. **Go to [Slack API](https://api.slack.com/apps)** → Create New App → From scratch
2. **App Name:** `Copilot Bot` **Workspace:** Your workspace
3. **Basic Information:**
   - Go to App-Level Tokens → Generate Token
   - Token Name: `socket_token` 
   - Scopes: `connections:write`
   - **Note down:** The app token (starts with `xapp-`)
4. **Socket Mode:**
   - Go to Socket Mode → Enable Socket Mode
   - Use the app token you just created
5. **OAuth & Permissions:**
   - Scopes → Bot Token Scopes → Add:
     - `app_mentions:read` - Listen for @mentions
     - `chat:write` - Send messages as bot
     - `im:read` - Read direct messages
     - `im:write` - Send direct messages
     - `user:read` - 
   - **Note:** You may need additional OAuth scopes depending on your specific needs
6. **App Home:** Go to Features → App Home → Check **"Allow users to send Slash commands and messages from the messages tab"** (required for DM functionality)
7. **Install App** Go to Settings -> Install App
   - **Install App to Workspace**
   - **Note down:** Bot User OAuth Token (starts with `xoxb-`)
8. **Basic Information:**
   - App Credentials → **Note down:** Signing Secret
9. **Slash Commands** (optional but recommended):
   - Create `/newchat` command
   - Request URL: `http://localhost:3000/slack/commands` (for development) - This step is not req'd for socket mode
10. **Event Subscriptions:**
   - Enable Events → Request URL: (leave blank for Socket Mode)
   - Subscribe to bot events:
     - `app_mention` - When bot is mentioned
     - `message.im` - Direct messages to bot

### 🔗 Step 4: Configure OAuth Redirect

**For Development:**
- Use `http://localhost:3000/auth/callback`

**For Copilot Studio Manual Authentication:**
- `https://token.botframework.com/.auth/web/redirect` (automatically added in Step 1)

**For Production:**
1. **Set up HTTPS domain** (required for OAuth)
2. **Update Azure App Registration** redirect URIs
3. **Update `SERVER_BASE_URL`** in your environment variables
4. **Ensure your domain** can receive OAuth callbacks

### ✅ Step 5: Test Your Configuration

1. **Start the bot:**
   ```bash
   npm run dev  # or make dev
   ```

2. **Check the logs** for successful connections:
   ```
   🚀 Starting Slack Relay Bot...
   ✅ Configuration loaded
   🤖 Relay Middleware initialized  
   💬 Slack Bot initialized
   ⚡️ Slack bot is running in Socket Mode!
   🌐 Server running on port 3000
   ```

3. **Test in Slack:**
   - Send a direct message to your bot
   - Try mentioning the bot in a channel: `@YourBot hello`
   - Use slash command: `/newchat`

4. **Verify OAuth flow:**
   - If `COPILOT_REQUIRE_AUTH=true`, bot should prompt for authentication
   - Click the auth button and complete Microsoft login
   - Should see success message and bot should respond to messages

## 🎮 How to Use

Once your bot is running, your team can interact with it in several ways:

### 💬 Direct Messages
Send any message directly to the bot:
```
User: Hello, what can you help me with?
Bot: Hi! I'm your Copilot Studio assistant. I can help you with...
```

### 🏷️ Channel Mentions  
Mention the bot in any channel where it's been added:
```
User: @CopilotBot can you help me analyze this data?
Bot: I'd be happy to help you analyze your data. Could you share more details...
```

### ⚡ Slash Commands
Quick commands for bot management:
- `/newchat` - Start a fresh conversation (clears context)
- Use this when you want to change topics or start over
- Socket Mode is enabled. You won’t need to specify a Request URL.

### 🔐 Authentication Flow
If authentication is enabled (`COPILOT_REQUIRE_AUTH=true`):
1. Send a message to the bot
2. Bot responds with an authentication button
3. Click "Authenticate with Microsoft"
4. Complete the OAuth flow in your browser
5. Return to Slack - you're now authenticated!
6. The bot will remember your authentication across sessions

## 🛠️ Management & Monitoring

### ⚡ Quick Commands (Makefile)

This project includes a `Makefile` for easy management. Run `make help` to see all available commands:

```bash
# Essential commands
make help        # Show all available commands
make up          # Start in production mode
make dev         # Start in development mode with live reload
make down        # Stop the application
make logs        # View live logs
make restart     # Restart the application
make status      # Show container status
make test        # Test all endpoints
make clean       # Clean up containers and images

# Development workflow
make dev-build   # Build and start in development mode
make build       # Build production image
```

### 📊 Health Monitoring
Check bot status anytime:
```bash
# Quick health check
curl http://localhost:3000/health

# Detailed status with metrics
curl http://localhost:3000/status

# Test all endpoints at once
make test
```

### 🐳 Docker Management
```bash
# Using make commands (recommended)
make up          # Start the bot
make logs        # View live logs
make restart     # Restart bot (picks up new environment variables)
make down        # Stop everything
make status      # Show container status

# OR using docker compose directly
docker compose up -d
docker compose logs -f slack-relay-bot
docker compose restart slack-relay-bot
docker compose down
```

### 💻 Local Development
```bash
# Development mode (auto-restart on file changes)
npm run dev

# Production mode  
npm start

# Install new dependencies
npm install

# Update to latest packages
npm update
```

## 🏗️ Development Guide

### 📁 Project Architecture

```
slack-relay-bot/
├── src/
│   ├── app.js                    # 🚀 Main application & Express server
│   ├── config/
│   │   └── index.js             # ⚙️ Environment configuration management
│   ├── middleware/
│   │   └── relay-middleware.js   # 🔗 Core bridge to Copilot Studio
│   └── integrations/
│       └── slack-bot.js         # 💬 Slack Socket Mode integration
├── .env.example                  # 📝 Environment variable template
├── docker-compose.yml           # 🐳 Production Docker setup
├── docker-compose.dev.yml       # 🔧 Development Docker setup
├── Dockerfile                   # 📦 Container definition
└── package.json                 # 📋 Dependencies and scripts
```

### 🧩 Core Components

**🚀 `app.js` - Application Entry Point**
- Express.js server for OAuth callbacks and health endpoints
- Application lifecycle management (startup, shutdown)
- OAuth 2.0 + PKCE authentication flow implementation
- Graceful error handling and logging

**🔗 `relay-middleware.js` - AI Bridge**
- Microsoft Agents SDK integration
- Per-user conversation management
- Connection pooling and cleanup
- Token storage and authentication

**💬 `slack-bot.js` - Slack Integration**  
- Socket Mode real-time messaging
- Event handling (DMs, mentions, slash commands)
- User authentication prompts
- Typing indicators and rich message formatting

**⚙️ `config/index.js` - Configuration Management**
- Environment variable validation
- Default value handling
- Configuration logging (with secret masking)
- Centralized settings access

### 🔧 Adding New Features

**Adding a new Slack command:**
1. Update `slack-bot.js` with new command handler
2. Register command in Slack App dashboard
3. Add any new environment variables to `.env.example`
4. Update this README with usage instructions

**Extending AI capabilities:**
1. Modify `relay-middleware.js` to add new Copilot Studio interactions
2. Update authentication scopes if needed
3. Add configuration options in `config/index.js`
4. Test with different user scenarios

### 🧪 Testing Your Changes

**Local testing:**
```bash
# Start in development mode
npm run dev

# Test health endpoints
curl http://localhost:3000/health
curl http://localhost:3000/status

# Test authentication flow (if enabled)
curl http://localhost:3000/auth/login/test_user
```

**Slack testing checklist:**
- [ ] Direct messages work
- [ ] @mentions in channels work
- [ ] Slash commands respond correctly
- [ ] Authentication flow completes successfully
- [ ] Bot remembers conversation context
- [ ] `/newchat` clears context properly
- [ ] Error handling is graceful

### 📝 Code Style & Standards

This project follows these principles:
- **Comprehensive commenting** - Every function explains what and why
- **Security consciousness** - All security concerns documented
- **Error handling** - Graceful failure with helpful messages
- **Resource cleanup** - Proper connection and memory management
- **Monitoring friendly** - Detailed logging and health endpoints

## 🚀 Production Deployment

### 🐳 Docker Production (Recommended)

**For most production environments - provides isolation, consistency, and easy scaling.**

```bash
# 1. Prepare your environment
cp .env.example .env
# Edit .env with production values (use secrets management in real production)

# 2. Deploy with Docker Compose
docker compose up --build -d

# 3. Verify deployment
docker compose logs -f slack-relay-bot
curl https://your-domain.com/health

# 4. Monitor and maintain
docker compose logs --tail=100 slack-relay-bot  # Check recent logs
docker compose restart slack-relay-bot          # Restart if needed
```

### ☁️ Cloud Platform Deployment

**The Docker container is fully cloud-ready and can be deployed on any major platform with just environment variable changes and an updated Azure App Registration redirect URI.**

#### 🔄 **What Changes for Cloud Deployment:**

1. **Azure App Registration Redirect URI:**
   ```
   Development: http://localhost:3000/auth/callback
   Production:  https://your-cloud-url.com/auth/callback
   ```

2. **Environment Variable: `SERVER_BASE_URL`:**
   ```bash
   # Update to match your cloud platform's URL
   SERVER_BASE_URL=https://your-cloud-service-url.com
   ```

#### ☁️ **Platform-Specific Examples:**

**Azure Container Instances (Easiest):**
```bash
# Build and push to Azure Container Registry
az acr build --registry myregistry --image slack-relay-bot:latest .

# Deploy with automatic HTTPS and custom domain
az container create \
  --resource-group myResourceGroup \
  --name slack-relay-bot \
  --image myregistry.azurecr.io/slack-relay-bot:latest \
  --dns-name-label my-slack-bot \
  --ports 3000 \
  --environment-variables \
    COPILOT_ENVIRONMENT_ID="your-env-id" \
    COPILOT_AGENT_IDENTIFIER="your-agent-id" \
    COPILOT_APP_CLIENT_ID="your-client-id" \
    COPILOT_CLIENT_SECRET="your-client-secret" \
    COPILOT_TENANT_ID="your-tenant-id" \
    SLACK_BOT_TOKEN="xoxb-your-token" \
    SLACK_SIGNING_SECRET="your-signing-secret" \
    SLACK_APP_TOKEN="xapp-your-token" \
    SERVER_BASE_URL="https://my-slack-bot.eastus.azurecontainer.io" \
    NODE_ENV="production"

# Your bot will be available at: https://my-slack-bot.eastus.azurecontainer.io
# Update Azure App Registration redirect URI to: https://my-slack-bot.eastus.azurecontainer.io/auth/callback
```

**AWS ECS Fargate:**
```bash
# Build and push to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com
docker build -t slack-relay-bot .
docker tag slack-relay-bot:latest 123456789012.dkr.ecr.us-east-1.amazonaws.com/slack-relay-bot:latest
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/slack-relay-bot:latest

# Create ECS task definition with environment variables
# Deploy with Application Load Balancer for HTTPS
# Update SERVER_BASE_URL to ALB URL: https://my-alb-123456789.us-east-1.elb.amazonaws.com
# Update Azure App Registration redirect URI accordingly
```

**Google Cloud Run (Simplest):**
```bash
# Deploy directly from source with environment variables
gcloud run deploy slack-relay-bot \
  --source . \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars \
    COPILOT_ENVIRONMENT_ID="your-env-id",\
    COPILOT_AGENT_IDENTIFIER="your-agent-id",\
    COPILOT_APP_CLIENT_ID="your-client-id",\
    COPILOT_CLIENT_SECRET="your-client-secret",\
    COPILOT_TENANT_ID="your-tenant-id",\
    SLACK_BOT_TOKEN="xoxb-your-token",\
    SLACK_SIGNING_SECRET="your-signing-secret",\
    SLACK_APP_TOKEN="xapp-your-token",\
    SERVER_BASE_URL="https://slack-relay-bot-xxx.a.run.app",\
    NODE_ENV="production"

# Cloud Run provides automatic HTTPS
# Update Azure App Registration redirect URI to: https://slack-relay-bot-xxx.a.run.app/auth/callback
```

#### 🌐 **Custom Domain Setup (Any Platform):**

```bash
# 1. Set up your custom domain with SSL certificate
# 2. Point domain to your cloud service
# 3. Update environment variables
SERVER_BASE_URL=https://slack-bot.mycompany.com

# 4. Update Azure App Registration
# Redirect URI: https://slack-bot.mycompany.com/auth/callback

# 5. Test OAuth flow
curl https://slack-bot.mycompany.com/health
```

#### 🔒 **Cloud Secrets Management (Recommended):**

**Azure Key Vault:**
```bash
# Store secrets in Key Vault instead of environment variables
az keyvault secret set --vault-name MyKeyVault --name "slack-bot-token" --value "xoxb-..."
az keyvault secret set --vault-name MyKeyVault --name "copilot-client-secret" --value "your-secret"

# Use Key Vault references in Container Instances
# Or integrate with Azure Container Apps for automatic secret injection
```

**AWS Secrets Manager:**
```bash
# Store secrets in AWS Secrets Manager
aws secretsmanager create-secret --name "slack-relay-bot/config" \
  --secret-string '{"SLACK_BOT_TOKEN":"xoxb-...","COPILOT_CLIENT_SECRET":"your-secret"}'

# Reference in ECS task definition
# Use AWS Systems Manager Parameter Store for non-sensitive config
```

**Google Secret Manager:**
```bash
# Store secrets in Secret Manager
echo -n "xoxb-your-token" | gcloud secrets create slack-bot-token --data-file=-
echo -n "your-client-secret" | gcloud secrets create copilot-client-secret --data-file=-

# Use secret mounting in Cloud Run
# Or inject as environment variables automatically
```

#### 📊 **Resource Requirements:**

The container is lightweight and works well with minimal resources:

```yaml
# Typical cloud resource allocation:
CPU: 0.25-0.5 vCPU
Memory: 512MB-1GB  
Storage: Minimal (stateless application)
Network: Standard (HTTPS ingress, outbound to Slack/Microsoft)

# Auto-scaling recommendations:
Min instances: 1
Max instances: 3-5 (unless very high traffic)
Scale trigger: CPU > 70% or Memory > 80%
```

#### ✅ **Cloud Deployment Checklist:**

- [ ] **Update Azure App Registration** redirect URI to cloud URL
- [ ] **Set `SERVER_BASE_URL`** environment variable to cloud URL
- [ ] **Use HTTPS** (all major cloud platforms provide this automatically)
- [ ] **Configure secrets management** (Key Vault, Secrets Manager, etc.)
- [ ] **Set `NODE_ENV=production`** in environment variables
- [ ] **Configure monitoring** and health check endpoints
- [ ] **Test OAuth flow** with cloud URL
- [ ] **Verify Slack integration** works in cloud environment
- [ ] **Set up backup and recovery** procedures
- [ ] **Configure auto-scaling** and resource limits

#### 🎯 **Platform Recommendations:**

- **🥇 Google Cloud Run**: Simplest deployment, automatic HTTPS, pay-per-use
- **🥈 Azure Container Instances**: Great Microsoft ecosystem integration, easy setup
- **🥉 AWS ECS Fargate**: Most enterprise features, complex but powerful
- **🏆 Any Kubernetes**: Maximum flexibility, requires more setup

#### 🏢 **Multi-Agent Architecture: One Container Per Agent**

**This bot follows a one-container-per-Copilot-Studio-agent architecture, which is the recommended approach:**

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   HR Bot        │    │  IT Support     │    │  Sales Bot      │
│   Container     │    │  Container      │    │  Container      │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ Agent: hr-bot   │    │ Agent: it-help  │    │ Agent: sales    │
│ Port: 3001      │    │ Port: 3002      │    │ Port: 3003      │
│ Slack: @hrbot   │    │ Slack: @itbot   │    │ Slack: @salesbot│
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────────────┐
                    │  Microsoft Copilot      │
                    │  Studio Environment     │
                    └─────────────────────────┘
```

**Why One Container Per Agent:**

✅ **Security Isolation**: Each agent has different permissions and access levels  
✅ **Independent Scaling**: Scale popular agents without affecting others  
✅ **Clear Ownership**: Different teams can manage their own agents  
✅ **Fault Isolation**: One agent failure doesn't impact others  
✅ **Configuration Simplicity**: Each container has focused, single-purpose config  
✅ **User Experience**: Clear bot personalities and distinct slash commands  

**Multi-Agent Deployment Example:**

```bash
# HR Assistant Bot
az container create \
  --name hr-slack-bot \
  --environment-variables \
    COPILOT_AGENT_IDENTIFIER="hr-assistant" \
    SERVER_BASE_URL="https://hr-bot.company.com"

# IT Support Bot  
az container create \
  --name it-slack-bot \
  --environment-variables \
    COPILOT_AGENT_IDENTIFIER="it-helpdesk" \
    SERVER_BASE_URL="https://it-bot.company.com"

# Sales Assistant Bot
az container create \
  --name sales-slack-bot \
  --environment-variables \
    COPILOT_AGENT_IDENTIFIER="sales-assistant" \
    SERVER_BASE_URL="https://sales-bot.company.com"
```

**Azure App Registration**: Each container can share the same Azure app registration (same `COPILOT_APP_CLIENT_ID`) but needs unique redirect URIs:
- `https://hr-bot.company.com/auth/callback`
- `https://it-bot.company.com/auth/callback`  
- `https://sales-bot.company.com/auth/callback`

**Slack Apps**: You need to create **separate Slack apps** for each agent. Each Slack app provides one bot user token, so one container = one Slack app = one bot in your workspace. This gives each agent a distinct name, avatar, and personality in Slack.

**Simple Multi-Agent Setup:**

For multiple agents, you just modify your `docker-compose.yml` and create separate `.env` files:

```yaml
# docker-compose.multi-agent.yml
version: '3.8'
services:
  hr-bot:
    build: .
    container_name: hr-slack-bot
    env_file: .env.hr
    ports:
      - "3001:3000"
    
  it-bot:
    build: .
    container_name: it-slack-bot
    env_file: .env.it
    ports:
      - "3002:3000"
      
  sales-bot:
    build: .
    container_name: sales-slack-bot
    env_file: .env.sales
    ports:
      - "3003:3000"
```

Each `.env.hr`, `.env.it`, `.env.sales` file just changes:
- `COPILOT_AGENT_IDENTIFIER` (different agent)
- `SLACK_BOT_TOKEN` (different Slack app)
- `SLACK_SIGNING_SECRET` (different Slack app)
- `SLACK_APP_TOKEN` (different Slack app)
- `SERVER_BASE_URL` (different port/domain)

**Single Azure App Registration**: Yes! You can reuse the same `COPILOT_APP_CLIENT_ID` across all containers. Just add all the callback URLs to your Azure app registration:
- `http://localhost:3001/auth/callback` (HR bot)
- `http://localhost:3002/auth/callback` (IT bot)
- `http://localhost:3003/auth/callback` (Sales bot)

Deploy with: `docker compose -f docker-compose.multi-agent.yml up -d`

#### 🎯 **SAML SSO Integration (Optional Enhancement)**

**For organizations using SAML SSO with both Slack and Microsoft Entra ID, this bot can provide seamless authentication:**

```
Traditional Flow (Double Authentication):
User → Slack (SAML) → Bot → "Please authenticate" → Microsoft OAuth → Login again → Bot works

SAML SSO Enhanced Flow (Seamless):
User → Slack (SAML) → Bot → Auto-validates SAML → Bot works immediately
```

**SAML SSO Configuration:**

```bash
# Enable SAML SSO integration
SAML_SSO_ENABLED=true
SAML_IDENTITY_PROVIDER=entraid
TRUST_SLACK_SAML_ASSERTIONS=true
REQUIRE_EXPLICIT_OAUTH=false  # Set to true for defense-in-depth

# For Enterprise Grid workspaces (optional)
SLACK_ENTERPRISE_GRID_TOKEN=xoxp-enterprise-token
```

**What SAML SSO Enhancement Provides:**

✅ **Seamless Authentication**: Users authenticated via SAML don't need to complete OAuth again  
✅ **Better User Experience**: Immediate bot response without authentication friction  
✅ **Enterprise Ready**: Integrates with existing SAML infrastructure  
✅ **Configurable Security**: Can be tuned from "seamless UX" to "defense-in-depth"  
✅ **Audit Friendly**: All SAML authentication events are logged  
✅ **Backward Compatible**: Standard OAuth flow remains as fallback  

**Current Implementation Status:**
- ✅ **Framework Complete**: Configuration and integration structure ready
- ✅ **Safe Fallback**: Always falls back to OAuth if any SAML validation fails
- ⚠️ **SAML Validation**: Placeholder implementation - OAuth flow used for safety
- 🚧 **Future Development**: Full SAML assertion validation coming in future releases

**Security Considerations:**
- Current implementation always uses OAuth for safety
- When SAML validation is completed, will include certificate verification
- Audit logging implemented for all authentication events
- Email domain allowlist validation planned for production use

### 🔒 Production Security Checklist

Before going live, ensure:

**Secrets Management:**
- [ ] Use Azure Key Vault, AWS Secrets Manager, or similar (not .env files)
- [ ] Rotate client secrets regularly
- [ ] Use service accounts with minimal permissions
- [ ] Enable audit logging for all authentication events

**Network Security:**
- [ ] Use HTTPS everywhere (TLS 1.3 recommended)
- [ ] Implement proper firewall rules
- [ ] Use reverse proxy (nginx, CloudFlare) for SSL termination
- [ ] Restrict admin endpoints to authorized IPs

**Application Security:**
- [ ] Set `NODE_ENV=production`
- [ ] Configure appropriate log levels (warn/error for production)
- [ ] Implement rate limiting and monitoring
- [ ] Set up health check monitoring and alerting
- [ ] Configure resource limits and auto-scaling

**Compliance:**
- [ ] Ensure GDPR/privacy compliance for user data
- [ ] Implement data retention policies
- [ ] Document security procedures and incident response
- [ ] Regular security reviews and penetration testing

## 🔍 Troubleshooting Guide

### 🚨 Common Issues & Solutions

**"Bot not responding in Slack"**
```bash
# Check if bot is running
curl http://localhost:3000/health
# OR: make test

# Check Slack connection in logs
make logs
# OR: docker compose logs slack-relay-bot | grep "Slack"

# Verify Socket Mode is enabled in Slack app
# Verify app token has connections:write scope
# Check that bot is added to channels where you're testing
```

**"Authentication keeps failing"**
```bash
# Verify Azure app registration
# - Client ID and secret are correct
# - Redirect URI matches SERVER_BASE_URL/auth/callback
# - Required API permissions are granted and admin consented

# Check OAuth flow in logs
make logs
# OR: docker compose logs slack-relay-bot | grep "OAuth"

# Test OAuth URL generation
curl http://localhost:3000/auth/login/test_user
```

**"Bot responds but with errors"**
```bash
# Check Copilot Studio configuration
# - Environment ID is correct
# - Agent is published and accessible
# - Service account has proper permissions

# Check relay middleware logs
make logs
# OR: docker compose logs slack-relay-bot | grep "Relay"

# Test authentication flow
curl http://localhost:3000/auth/login/test_user
```

**"High memory usage or crashes"**
```bash
# Check connection cleanup
curl http://localhost:3000/status

# Verify cleanup interval is reasonable
# Default: 5 minutes (300000ms)

# Monitor resource usage
docker stats slack-relay-bot

# Restart to clear memory
make restart
# OR: docker compose restart slack-relay-bot
```

**"SAML SSO not working as expected"**
```bash
# Check SAML configuration
curl http://localhost:3000/status | jq '.saml'

# Verify SAML is enabled in environment
echo $SAML_SSO_ENABLED

# Check SAML authentication logs
make logs
# OR: docker compose logs slack-relay-bot | grep "SAML SSO"

# Current status: SAML validation is placeholder
# Bot will log SAML checks but fall back to OAuth
# This is expected behavior until full SAML implementation
```

### 📊 Understanding Logs

**Normal startup sequence:**
```
🚀 Starting Slack Relay Bot...
✅ Configuration loaded
🤖 Relay Middleware initialized
💬 Slack Bot initialized
⚡️ Slack bot is running in Socket Mode!
🌐 Server running on port 3000
🎉 Slack Relay Bot is running!
```

**Successful message flow:**
```
📨 Message from John Doe (slack_U1234567): "Hello bot"
🔐 User slack_U1234567 authenticated
⏳ Typing indicator sent for DM: D1234567890
✅ Response sent to Slack: "Hello! How can I help you today?"
```

**Authentication flow:**
```
🔐 User slack_U1234567 not authenticated - sending auth link
🔗 Generating auth URL: http://localhost:3000/auth/login/U1234567
🔄 OAuth callback received: {code: "present", state: "U1234567"}
✅ Sent auth success notification to slack_U1234567
```

### 🔧 Advanced Debugging

**Enable debug logging:**
```bash
# Set LOG_LEVEL=debug in .env
LOG_LEVEL=debug

# Restart to pick up changes
make restart
# OR: docker compose restart slack-relay-bot
```

**Test individual components:**
```bash
# Test health endpoint
curl -v http://localhost:3000/health

# Test status endpoint with detailed info
curl http://localhost:3000/status | jq '.'

# Test OAuth initiation (returns redirect)
curl -v http://localhost:3000/auth/login/test_user

# Test all endpoints at once
make test
```

**Monitor resource usage:**
```bash
# Docker stats
docker stats slack-relay-bot

# System resources  
top -p $(pgrep -f slack-relay-bot)

# Memory and connection info
curl http://localhost:3000/status
```

## 🤝 Contributing

We welcome contributions! Please:

1. **Fork the repository** and create a feature branch
2. **Follow the existing code style** (comprehensive comments, security awareness)
3. **Add tests** for new functionality
4. **Update documentation** including this README
5. **Submit a pull request** with clear description of changes

### 📋 Development Setup for Contributors

```bash
# Fork and clone
git clone https://github.com/yourusername/slack-relay-bot.git
cd slack-relay-bot

# Install dependencies
npm install

# Set up development environment
cp .env.example .env
# Fill in your development credentials

# Start in development mode
npm run dev

# Run tests (when available)
npm test
```

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 📞 Support

- **Issues**: Report bugs and feature requests on GitHub Issues
- **Documentation**: This README and inline code comments
- **Community**: Check existing issues for common questions

---

**Made with ❤️ to bridge Slack and Microsoft Copilot Studio**
