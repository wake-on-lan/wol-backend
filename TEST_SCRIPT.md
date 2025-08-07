# Encrypted API Workflow Test Script

## Overview
This script tests the complete encrypted communication workflow with the Wake-on-LAN server, demonstrating:

1. **RSA Key Generation**: Client generates 2048-bit RSA key pair locally
2. **Authentication**: Login with username/password to get JWT token
3. **Key Exchange**: Get server public key and register client public key
4. **Encrypted Communication**: Send/receive encrypted data using RSA keys

## Usage

### Prerequisites
- Node.js installed
- Server running on `http://localhost:3000`

### Run the Test
```bash
# Make executable (if needed)
chmod +x test-workflow.js

# Run the complete workflow test
node test-workflow.js

# Or run directly (if executable)
./test-workflow.js
```

### Configuration
Edit the config object in `test-workflow.js`:
```javascript
const config = {
  baseUrl: 'http://localhost:3000',  // Server URL
  username: 'admin',                 // Test user
  password: 'admin123'               // Test password
};
```

## Test Flow

### 🔑 Step 1: Generate Client Keys
- Creates RSA-2048 key pair locally
- Private key never leaves client

### 🔐 Step 2: Login  
- Authenticates with server using username/password
- Receives JWT access token

### 📡 Step 3: Get Server Public Key
- Fetches server's current public key (unencrypted)
- Needed to encrypt data sent to server

### 📝 Step 4: Register Client Public Key
- Encrypts client's public key using server's public key
- Sends encrypted registration request
- Server responds with unencrypted confirmation (no race condition)

### 🔍 Step 5: Test Encrypted Communication
- Makes authenticated request to `/commands/scan-devices`
- Server encrypts response using client's registered public key  
- Client decrypts response using its private key

### 💤 Bonus: Wake-on-LAN Test
- Demonstrates encrypted Wake-on-LAN request
- Encrypts MAC address and target info
- Receives encrypted confirmation

## Expected Output
```
🚀 Starting complete encrypted workflow test...
============================================================
🔑 Generating client RSA key pair...
✅ Client key pair generated

🔐 Step 1: Logging in as admin...
✅ Login successful
   Token: eyJhbGciOiJIUzI1NiIs...

🔑 Step 2: Getting server public key...
✅ Server public key received
   Expires: 2024-01-16T10:30:00.000Z

📝 Step 3: Registering client public key...
✅ Public key registered successfully
   Key ID: 123
   Expires: 2024-01-16T10:30:00.000Z

🔍 Step 4: Requesting device scan (encrypted)...
✅ Received encrypted response
   Timestamp: 2024-01-15T10:35:00.000Z
🔓 Decrypted response:
{
  "success": true,
  "devices": [...]
}

💤 Bonus: Testing encrypted Wake-on-LAN...
✅ Wake-on-LAN successful (encrypted)
{
  "success": true,
  "message": "Wake-on-LAN packet sent successfully"
}

============================================================
🎉 Complete workflow test SUCCESSFUL!
```

## Security Features Demonstrated

1. **End-to-End Encryption**: All sensitive data encrypted with RSA-2048
2. **Key Rotation**: 24-hour key expiration enforced
3. **No Private Key Transmission**: Client private keys never leave the client
4. **JWT Authentication**: Secure session management
5. **Race Condition Prevention**: Registration endpoint returns unencrypted response

## Error Handling
The script includes comprehensive error handling for:
- Network failures
- Authentication errors  
- Encryption/decryption failures
- Missing or expired keys
- Server errors

## Customization
You can modify the `EncryptedAPIClient` class to:
- Test other endpoints
- Change encryption parameters
- Add additional validation
- Test error conditions