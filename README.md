# Wake-on-LAN Encrypted Relay Server

A secure NestJS-based backend service that provides authenticated Wake-on-LAN functionality with end-to-end RSA/AES encryption. The server acts as an encrypted relay for network commands, device discovery, host monitoring, and remote command execution with automatic key rotation and comprehensive security features.

## Features

### Core Functionality
- **Wake-on-LAN**: Send magic packets to wake up remote devices
- **Network Scanning**: Discover devices on the local network using broadcast scans
- **Host Monitoring**: Check host availability via ping and HTTPS connectivity
- **Shell Command Execution**: Execute SSH commands remotely with full encryption
- **Interactive Client Tools**: Command-line scripts for easy interaction
- **Hybrid Encryption**: RSA-2048 + AES-256 encryption for secure communications
- **JWT Authentication**: Token-based user authentication with secure sessions
- **Database Encryption**: All sensitive data encrypted at rest with AES-256-GCM
- **Encrypted User Management**: Generate and deploy encrypted user configurations
- **SystemD Integration**: Production-ready service configuration

### Security Model
- **Client-Generated Keys**: Users generate RSA key pairs locally (private keys never transmitted)
- **Public Key Registration**: Only public keys are registered with the server
- **Automatic Key Rotation**: Server keys rotate every 24 hours
- **Key Expiration**: All keys expire after 24 hours for enhanced security
- **Database Encryption**: Sensitive database fields encrypted with master key

## Technology Stack

- **Framework**: NestJS (Node.js)
- **Database**: SQLite with TypeORM
- **Authentication**: JWT with Passport
- **Encryption**: 
  - RSA-2048 for message encryption
  - AES-256-GCM for database encryption
  - bcrypt for password hashing
- **Networking**: SSH2, wake_on_lan, local-devices
- **Validation**: class-validator, class-transformer

## API Endpoints

### Authentication
- `POST /auth/login` - Authenticate user with username/password and receive JWT token

### Key Management
- `GET /keys/server-public` - Get server's current public key (requires auth)
- `POST /keys/register` - Register client's public key (requires auth, encrypted response)
- `GET /keys/my-key` - Get current user's registered key info (requires auth, encrypted response)

### Commands (All require authentication and registered public key)
- `GET /commands/scan-devices` - Scan local network for devices (encrypted response)
- `POST /commands/wake-on-lan` - Send Wake-on-LAN magic packet (encrypted request/response)
- `POST /commands/shell` - Execute remote SSH commands (encrypted request/response)
- `GET /commands/up?hostname=<host>` - Ping a hostname (encrypted response)
- `GET /commands/checkHttpsAvailability?hostname=<host>` - Check HTTPS availability (encrypted response)

### Request/Response Formats

**WakeOnLanDto:**
```json
{
  "macAddress": "XX:XX:XX:XX:XX:XX"
}
```

**ShellCommandDto:**
```json
{
  "host": "192.168.1.100",
  "port": 22,
  "user": "username",
  "command": "ls -la",
  "password": "password",
  "privateKey": "base64_encoded_ssh_key"
}
```

**Note**: All command endpoints require authentication and encryption. Responses are encrypted with the user's registered public key.

## Quick Start

### Prerequisites
- Node.js 16+ 
- yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd wake-on-lan

# Install dependencies
yarn install

# Copy environment configuration
cp .env.example .env
```

### Environment Configuration

Edit `.env` with your settings:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Database Configuration  
DATABASE_TYPE=better-sqlite3
DATABASE_PATH=encrypted-relay.db
DATABASE_SYNCHRONIZE=true
DATABASE_LOGGING=false

# Database Encryption - REQUIRED
# Generate with: openssl rand -hex 32
DATABASE_MASTER_KEY=your_64_character_hex_key_here_replace_this_value

# JWT Configuration
JWT_SECRET=secure-jwt-secret-key-change-in-production
JWT_EXPIRES_IN=24h

# Server Key Configuration
EXPIRE_PRIVATE_KEY_IN=24h
ROTATION_CUTOFF_MS=1h
```

### Generate Database Master Key

```bash
# Generate a secure 64-character hex key for database encryption
openssl rand -hex 32
```

### Start the Application

```bash
# Development mode with hot reload
yarn start:dev

# Production mode  
yarn start:prod

# Standard mode
yarn start
```

The server will start on port 3000 (or your configured PORT).

## Default Test Users

The application creates test users on first startup:

| Username | Password | Description |
|----------|----------|-------------|
| admin    | admin123 | Administrator account |
| user     | user123  | Standard user account |
| testuser | test123  | Test user account |

**Important**: Change these passwords in production!

## Database Schema

The application uses SQLite with the following main entities:

- **users**: User accounts with encrypted passwords
- **user_public_keys**: Client public keys with expiration tracking
- **server_keys**: Server key pairs (private keys encrypted at rest)

All sensitive fields are automatically encrypted using AES-256-GCM.

## Usage Examples

### 1. Authentication

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'
```

Response:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "admin"
  }
}
```

### 2. Register Public Key

Before sending commands, register your public key:

```bash
curl -X POST http://localhost:3000/keys/register \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "publicKey": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----"
  }'
```

### 3. Wake-on-LAN

```bash
curl -X POST http://localhost:3000/commands/wake-on-lan \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "macAddress": "00:11:22:33:44:55",
    "ipAddress": "192.168.1.100",
    "port": 9
  }'
```

### 4. Network Scan

```bash
curl -X GET http://localhost:3000/commands/scan-devices \
  -H "Authorization: Bearer <your-jwt-token>"
```

## Encryption Workflow

### Initial Setup
1. Client generates RSA key pair locally
2. Client authenticates with username/password
3. Client registers public key with server
4. Client retrieves server's current public key

### Command Processing
1. Client encrypts command with server's public key
2. Server decrypts command with its private key
3. Server processes command
4. Server encrypts response with client's public key
5. Client decrypts response with its private key

### Key Management
- Server keys rotate automatically every 24 hours
- User keys expire after 24 hours
- Grace period warnings sent before expiration
- Expired keys are automatically deactivated

## Utility Scripts

The `/scripts` directory contains powerful utility scripts for testing, user management, and interactive operations:

### wol-interactive.js
**Interactive multi-function client** - The main utility script providing menu-driven or direct access to all server functionality.

#### Interactive Menu Mode (Default)
```bash
# Launch interactive menu
node scripts/wol-interactive.js

# With custom server
node scripts/wol-interactive.js --url http://192.168.1.100:3000 --username admin --password admin123
```

#### Direct Action Mode
```bash
# Wake-on-LAN: Scan devices and select one to wake
node scripts/wol-interactive.js --action wake

# HTTPS Check: Test if hostname is reachable via HTTPS
node scripts/wol-interactive.js --action https --hostname google.com

# Ping Check: Test if host responds to ping
node scripts/wol-interactive.js --action ping --hostname 192.168.1.1

# Shell Command: Execute remote SSH commands (interactive prompts)
node scripts/wol-interactive.js --action command

# Show help
node scripts/wol-interactive.js --help
```

#### Available Options
- `-u, --url <url>` - Base URL of the WOL server (default: http://localhost:3000)
- `--username <username>` - Username for authentication (default: admin)
- `--password <password>` - Password for authentication (default: admin123)
- `-a, --action <action>` - Action: wake, https, ping, command, or interactive (default: interactive)
- `--hostname <hostname>` - Hostname for https/ping actions (not supported for command action)

**Features:**
- Full end-to-end encryption workflow automation
- Device discovery and interactive selection
- Host availability monitoring
- Remote SSH command execution with interactive prompts
- User-friendly menu interface
- Complete error handling and status reporting

### test-auth.js
Comprehensive testing script for authentication and key management endpoints. Tests the complete auth workflow including login, key exchange, and encrypted responses.

```bash
# Basic authentication test
node scripts/test-auth.js

# With custom server and credentials
node scripts/test-auth.js --url http://192.168.1.100:3000 --username testuser --password test123

# Show help
node scripts/test-auth.js --help
```

**Available Options:**
- `-u, --url <url>` - Base URL of the WOL server (default: http://localhost:3000)
- `--username <username>` - Username for authentication (default: admin)
- `--password <password>` - Password for authentication (default: admin123)

**Test Coverage:**
- `POST /auth/login` - User authentication with username/password
- `GET /keys/server-public` - Server public key retrieval
- `POST /keys/register` - Client public key registration
- `GET /keys/my-key` - User's registered key information

**Features:**
- Complete RSA key pair generation and management
- Full encryption/decryption workflow testing
- Detailed test output with step-by-step results
- Error handling and validation testing
- Compatible with both development and production environments

### encrypt-users.js
Encrypts user data for secure production deployment.

```bash
# Basic usage with environment variable
DATABASE_MASTER_KEY=your_64_char_hex_key node scripts/encrypt-users.js

# With custom input/output files
node scripts/encrypt-users.js --input users.json --output users.encrypted.json --key abc123...

# Show help
node scripts/encrypt-users.js --help
```

**Input JSON format:**
```json
{
  "users": [
    {
      "username": "admin",
      "password": "securePassword123"
    },
    {
      "username": "user",
      "password": "userPassword456"
    }
  ]
}
```

**Features:**
- AES-256-GCM encryption with PBKDF2 key derivation
- Batch user creation for production deployment
- Secure credential management

## Development

### Code Quality

```bash
# Run linting
yarn lint

# Format code
yarn format
```

### Testing

```bash
# Run unit tests
yarn test

# Run tests with coverage
yarn test:cov

# Run e2e tests
yarn test:e2e

# Watch mode
yarn test:watch
```

### Build

```bash
# Build for production
yarn build
```

## Production Deployment

### Security Checklist

- [ ] Generate secure `DATABASE_MASTER_KEY` (64 hex characters): `openssl rand -hex 32`
- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Update default user passwords or create encrypted user file
- [ ] Set `NODE_ENV=production`
- [ ] Configure appropriate `ALLOWED_ORIGINS` for CORS
- [ ] Set `DATABASE_SYNCHRONIZE=false` in production
- [ ] Enable HTTPS/TLS termination (reverse proxy)
- [ ] Set up monitoring and logging
- [ ] Configure database backups
- [ ] Review server security and firewall configuration

### SystemD Service Installation

The repository includes a SystemD service configuration for production deployment:

```bash
# Create dedicated user
sudo useradd -r -s /bin/false wakeonlan

# Copy application files
sudo cp -r /path/to/wol-backend /home/wakeonlan/
sudo chown -R wakeonlan:wakeonlan /home/wakeonlan/wol-backend

# Install SystemD service
sudo cp systemd/wol-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable wol-backend.service

# Configure environment
sudo cp .env.example /home/wakeonlan/wol-backend/.env
# Edit the .env file with production values

# Start service
sudo systemctl start wol-backend.service
sudo systemctl status wol-backend.service
```

### Environment Variables

For production, ensure these are properly configured in `/home/wakeonlan/wol-backend/.env`:

```env
NODE_ENV=production
DATABASE_MASTER_KEY=<64-character-hex-key>
JWT_SECRET=<strong-random-secret>
DATABASE_SYNCHRONIZE=false
DATABASE_LOGGING=false
PORT=3000
ALLOWED_ORIGINS=https://yourdomain.com
EXPIRE_PRIVATE_KEY_IN=24h
ROTATION_CUTOFF=1h
```

### Production User Management

Create an encrypted user file for production:

```bash
# Create users.json
echo '{
  "users": [
    {"username": "admin", "password": "secure_admin_password"},
    {"username": "operator", "password": "secure_operator_password"}
  ]
}' > users.json

# Encrypt for production
node scripts/encrypt-users.js --input users.json --output users.encrypted.json --key $DATABASE_MASTER_KEY

# Deploy encrypted file
sudo cp users.encrypted.json /home/wakeonlan/wol-backend/
sudo chown wakeonlan:wakeonlan /home/wakeonlan/wol-backend/users.encrypted.json
```

## Architecture

### Modules
- **AppModule**: Main application orchestrator integrating all modules with global middleware
- **AuthModule**: JWT authentication, user validation, and Passport strategy implementation
- **KeysModule**: RSA key generation, automatic rotation (24h), and hybrid encryption management
- **CommandsModule**: Network operations (WOL, SSH, ping, HTTPS), device scanning, and encrypted command processing
- **DatabaseModule**: SQLite with TypeORM, automatic seeding, and encrypted data storage

### Database Schema

**User Entity:**
- `id` (Primary Key)
- `username` (Unique, not encrypted)
- `passwordHash` (bcrypt hashed)
- `createdAt` (Timestamp)

**UserPublicKey Entity:**
- `id` (Primary Key)
- `userId` (Foreign Key → User)
- `publicKeyPem` (RSA public key, encrypted at rest)
- `expiresAt` (24-hour expiration)
- `isActive` (Boolean status)
- `createdAt` (Timestamp)

**ServerKey Entity:**
- `id` (Primary Key)
- `publicKeyPem` (RSA public key, encrypted at rest)
- `privateKeyPem` (RSA private key, encrypted at rest)
- `expiresAt` (24-hour expiration)
- `isActive` (Boolean status)
- `createdAt` (Timestamp)

### Security Architecture

**Encryption Layers:**
1. **Transport Security**: HTTPS/TLS (reverse proxy recommended)
2. **Message Security**: RSA-2048 + AES-256-CBC hybrid encryption
3. **Database Security**: AES-256-GCM encryption for sensitive fields
4. **Authentication**: JWT tokens with 24-hour expiration
5. **Key Management**: Automated rotation with 1-hour grace period

**Security Features:**
- Input validation with class-validator
- Global exception handling with sanitized error responses
- CORS protection with configurable origins
- JWT token authentication with secure secrets
- RSA-2048 message encryption for API communications
- AES-256-GCM database field encryption
- Automated key rotation every 24 hours
- bcrypt password hashing with salt rounds
- Request/response encryption interceptors
- Private key isolation (never transmitted)

## License

UNLICENSED - Private project