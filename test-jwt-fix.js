/**
 * Test script to verify JWT token expiration extraction
 */

// Test with the actual expired tokens from the logs
const testTokens = [
    // User1 token (expired at 2025-10-16T21:01:37Z, used at 2025-10-16T21:32:20Z)
    'eyJ0eXAiOiJKV1QiLCJub25jZSI6IkpMMmJYeHdsOHhKMDg3Q0RkejRRQ2RDWXZLOWthWDZuT01FVDFUQ2Y0bGsiLCJhbGciOiJSUzI1NiIsIng1dCI6IkhTMjNiN0RvN1RjYVUxUm9MSHdwSXEyNFZZZyIsImtpZCI6IkhTMjNiN0RvN1RjYVUxUm9MSHdwSXEyNFZZZyJ9.eyJhdWQiOiJodHRwczovL2FwaS5wb3dlcnBsYXRmb3JtLmNvbSIsImlzcyI6Imh0dHBzOi8vc3RzLndpbmRvd3MubmV0LzE0NGI4YzgwLTM5OGQtNDA1ZS04MDU1LWZjOWE5ZDUwMTNmOC8iLCJpYXQiOjE3NjA2NDQzOTYsIm5iZiI6MTc2MDY0NDM5NiwiZXhwIjoxNzYwNjQ4NDk3LCJhY2N0IjowLCJhY3IiOiIxIiwiYWlvIjoiQWJRQVMvOGFBQUFBeWN0K0xHbzFobnl2QXhtQ1JYQ3ZCUGt2bTFzN1hZcWJETHZKRWltbEQxTjlKQnk2YS9FZ2lzN0ExMW5tRG1yZWhnNnBuVjlKaXNkWk9LOHJoUnNUSVNYcERnVmQ0RDlackdiYzNRMC85b0V6RGswRUF5RU52dy9GV1Q3NXlLTks1YzJoYXB0a2lUYS9hQzJQU3N6STdhZ2NhZzVFY1VKY3NvV0M0V0Njb0pCLzZ0MngvLzJPaGtSd3R1MFRzSGlIV1JkdkhISEJ2d1FqLys2QWozdEhabVBrVXRlTStuTStYN3VTdmpkQmx3dz0iLCJhbXIiOlsicHdkIiwibWZhIl0sImFwcGlkIjoiMGVlNzM3ZDEtNDk4ZC00ZWVhLThlNTItNGRmODM0MGQ1MTc4IiwiYXBwaWRhY3IiOiIxIiwiZmFtaWx5X25hbWUiOiJUYXlsb3IiLCJnaXZlbl9uYW1lIjoiTGlzYSIsImlkdHlwIjoidXNlciIsImlwYWRkciI6IjEzLjcyLjI0MS4yMzkiLCJuYW1lIjoiTGlzYSBUYXlsb3IiLCJvaWQiOiI0M2Q1MWVjOS1hMmY1LTRjMjYtYjI4YS02ODFhZmMzNzQwODQiLCJwdWlkIjoiMTAwMzIwMDM5NjAyNjYzRCIsInJoIjoiMS5BYmNBZ0l4TEZJMDVYa0NBVmZ5YW5WQVQtQVRnZUlYR3BlZEdrVDRTOVlrUzMwUFNBUWEzQUEuIiwic2NwIjoiQ29waWxvdFN0dWRpby5Db3BpbG90cy5JbnZva2UiLCJzaWQiOiIwMDVlYTJhOS0xNjE3LWZiZjQtMWFjYS0yNzk4YmYzNGI1ZmYiLCJzaWduaW5fc3RhdGUiOlsia21zaSJdLCJzdWIiOiJCeVFWUlYtdWZyVUJMbEVYUW1vMWFvYnNoMWJyby1xQ0JoV1pfdkdXelFNIiwidGlkIjoiMTQ0YjhjODAtMzk4ZC00MDVlLTgwNTUtZmM5YTlkNTAxM2Y4IiwidW5pcXVlX25hbWUiOiJMaXNhVEBNMzY1Q1BJMDUxODQ2NzguT25NaWNyb3NvZnQuY29tIiwidXBuIjoiTGlzYVRATTM2NUNQSTA1MTg0Njc4Lk9uTWljcm9zb2Z0LmNvbSIsInV0aSI6InhKbE9CdkZONTBDdThsaFNSalJDQUEiLCJ2ZXIiOiIxLjAiLCJ3aWRzIjpbIjA5NjRiYjVlLTliZGItNGQ3Yi1hYzI5LTU4ZTc5NDg2MmE0MCIsImI3OWZiZjRkLTNlZjktNDY4OS04MTQzLTc2YjE5NGU4NTUwOSJdLCJ4bXNfZnRkIjoiVlJtckhXRkY3TFppZmlrb3M4aXpGTVhrVnJiNmxXMHlDTkpscFVNbWlPRUJkWE5sWVhOMExXUnpiWE0iLCJ4bXNfaWRyZWwiOiIyIDEifQ.cg0RpUjrEUKnyjfL2KUpOrqub3gx3HjqwFA3bTxSmbn5yHl3wSUNj_cYlvy2oxCLMLnaeb_sb4ucvgRjS3msm3Q5nWWilnubhSz4Uv1nboepdS619EIXDQAbPy7fOUao8WAZ2gXsr0jT7hW4CTHNnusaGcb7EQYUfON0cQmhnPVS4aLVcUKm4Xok7ogM6bPDBAmkGFFbAQzqw0laQ62NqJt7VbdxfjrtqJnd7rVB1RdM88cBTwQf4cKZfb8VZgvLOJRqbJnqm0veBy5UW-G5cO-3LV2-jn3SKDHUVUFTBVMigId_I_o_bzNQqjFspxt7FCBrVhXc38daMCoDrQGPNQ'
];

function testJwtDecoding(token, testName) {
    console.log(`\n=== Testing ${testName} ===`);
    
    try {
        // JWT tokens have format: header.payload.signature
        const parts = token.split('.');
        if (parts.length === 3) {
            // Decode the payload (second part)
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            
            console.log('JWT Payload decoded successfully:');
            console.log('  - iat (issued at):', payload.iat, '->', new Date(payload.iat * 1000).toISOString());
            console.log('  - exp (expires at):', payload.exp, '->', new Date(payload.exp * 1000).toISOString());
            console.log('  - Current time:', Math.floor(Date.now() / 1000), '->', new Date().toISOString());
            
            const now = Date.now();
            const expiresAt = payload.exp * 1000;
            const isExpired = now > expiresAt;
            
            console.log(`  - Token is ${isExpired ? 'EXPIRED' : 'VALID'}`);
            if (isExpired) {
                const minutesExpired = Math.floor((now - expiresAt) / (1000 * 60));
                console.log(`  - Expired ${minutesExpired} minutes ago`);
            }
            
            return { success: true, expiresAt, isExpired };
        } else {
            console.log('❌ Invalid JWT format - should have 3 parts separated by dots');
            return { success: false, error: 'Invalid JWT format' };
        }
    } catch (error) {
        console.log('❌ Error decoding JWT:', error.message);
        return { success: false, error: error.message };
    }
}

// Test both tokens
console.log('🧪 Testing JWT Token Expiration Extraction Fix');
console.log('='.repeat(50));

testJwtDecoding(testTokens[0], 'User1 Token (from Lisa Taylor)');

console.log('\n✅ JWT decoding test completed');