# Token Expiration Bug Fix - Analysis & Resolution

## Problem Summary
Users are experiencing 401 "TokenExpired" errors when attempting to message the bot after approximately one hour, despite the application logging "🔐 Found valid token". The token validation logic was not properly checking JWT token expiration.

## Root Cause Analysis

### Evidence from Production Logs

**User1 (Lisa Taylor):**
- Token issued: 2025-10-16T19:53:16Z
- Token expires: 2025-10-16T21:01:37Z  
- Error occurred: 2025-10-16T21:32:20Z
- **Result**: Token expired 30+ minutes before use

**User2 (Michael Adams):**
- Token issued: 2025-10-16T19:49:43Z
- Token expires: 2025-10-16T20:57:11Z
- Error occurred: 2025-10-16T21:52:19Z  
- **Result**: Token expired 55+ minutes before use

### Technical Root Cause

The issue was in `/src/middleware/relay-middleware.js`:

1. **`storeUserToken()` method** (lines 200-220):
   - Stored tokens in new object format but **without `expiresAt` field**
   - Comment on line 214: `// TODO: Add expiresAt based on token introspection`

2. **`getUserToken()` method** (lines 275-285):
   - **Does** check expiration: `if (tokenData.expiresAt && now > tokenData.expiresAt)`
   - But since `expiresAt` was undefined, condition always fails

3. **`hasValidAuth()` method** (lines 305-308):
   - Expiration check code was **commented out**
   - Always returned true for tokens in new format

## Fix Implementation

### 1. Enhanced `storeUserToken()` Method
- **Added JWT token decoding** to extract expiration time
- **Converts Unix timestamp** (exp field) to milliseconds  
- **Graceful error handling** - continues storing without expiration if decoding fails
- **Better logging** with expiration timestamps

```javascript
// Extract expiration time from JWT token
let expiresAt = null;
try {
    const parts = accessToken.split('.');
    if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
        if (payload.exp) {
            expiresAt = payload.exp * 1000; // Convert to milliseconds
            console.log(`🔐 Token expires at: ${new Date(expiresAt).toISOString()}`);
        }
    }
} catch (jwtError) {
    console.warn(`⚠️ Could not decode JWT token: ${jwtError.message}`);
}
```

### 2. Enhanced `getUserToken()` Method  
- **Added legacy token expiration checking** with JWT decoding
- **Improved logging** to show expiration dates  
- **Better debugging** information
- **Proper cleanup** of expired tokens

## Security Benefits

1. **Prevents expired token usage** - tokens are now properly validated
2. **Automatic cleanup** - expired tokens are removed from memory
3. **Better audit trail** - expiration events are logged
4. **Graceful degradation** - fallback behavior if JWT decoding fails

## Expected Behavior After Fix

1. **On token storage**: JWT expiration is extracted and stored
2. **On token retrieval**: Expiration is checked before returning token
3. **On authentication check**: Both legacy and new tokens are validated
4. **On expiration**: Users are automatically prompted to re-authenticate

## Impact

- ✅ **Fixes the immediate issue**: Users will be prompted to re-authenticate when tokens expire
- ✅ **Improves security**: No more usage of expired tokens
- ✅ **Better debugging**: Clear logging shows when and why tokens expire  
- ✅ **Backward compatible**: Handles both legacy string tokens and new object format

## Files Modified

- `src/middleware/relay-middleware.js`
  - `storeUserToken()` method: Added JWT expiration extraction
  - `getUserToken()` method: Added legacy token expiration checking and enhanced logging
  - Removed unused `hasValidAuth()` method

## Testing Recommendation

After deployment, monitor logs for:
- `🔐 Token expires at:` messages during token storage
- `⚠️ Token expired for Slack user:` messages during validation
- Verify users are prompted to re-authenticate instead of getting 401 errors