# Wake-on-LAN Encrypted Relay Server

A secure NestJS-based backend service that provides authenticated Wake-on-LAN functionality with end-to-end encryption. The server acts as a secure relay for network commands, featuring hybrid RSA/AES encryption and automatic key rotation.

## Features

### Core Functionality
- **Wake-on-LAN**: Send magic packets to wake up remote devices
- **Network Scanning**: Discover devices on the local network
- **Shell Command Execution**: Execute system commands remotely (authenticated users only)
- **Hybrid Encryption**: RSA + AES encryption for secure communications
- **JWT Authentication**: Token-based user authentication
- **Database Encryption**: All sensitive data encrypted at rest with AES-256-GCM
- **Encrypted User Management**: Generate and deploy encrypted user configurations
- **CI/CD Support**: GitLab CI integration for automated deployments

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
- `POST /auth/login` - Authenticate user and receive JWT token

### Key Management
- `GET /keys/server-public` - Get server's current public key
- `POST /keys/register` - Register client's public key (requires authentication)
- `GET /keys/my-keys` - List registered keys for authenticated user
- `GET /keys/status` - Check key expiration status

### Commands
- `POST /commands/send` - Send encrypted command and receive encrypted response
- `GET /commands/scan-devices` - Scan network for devices
- `POST /commands/shell` - Execute shell commands
- `POST /commands/wake-on-lan` - Send Wake-on-LAN magic packet

**Note**: All command endpoints require authentication and a registered public key for encrypted responses.

## Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd wake-on-lan

# Install dependencies
npm install

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
DATABASE_TYPE=sqlite
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
npm run start:dev

# Production mode  
npm run start:prod

# Standard mode
npm run start
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

The `/scripts` directory contains utility scripts for testing and user management:

### encrypt-users.js
Encrypts user data for secure deployment. Creates encrypted user files that can be used to seed the database with pre-configured accounts.

```bash
# Basic usage with environment variable
DATABASE_MASTER_KEY=your_64_char_hex_key node scripts/encrypt-users.js

# With custom input/output files
node scripts/encrypt-users.js --input users.json --output users.encrypted.json --key abc123...

# Show help
node scripts/encrypt-users.js --help
```

Input JSON format:
```json
{
  "users": [
    {
      "username": "admin",
      "password": "securePassword123"
    }
  ]
}
```

### shell-command.js
Execute remote shell commands through the encrypted API. Supports both password and key-based SSH authentication.

```bash
# Basic command execution
node scripts/shell-command.js --command "ls -la ~"

# With custom authentication
node scripts/shell-command.js --command "df -h" --password mypassword --host 192.168.1.100

# Using SSH key
node scripts/shell-command.js --command "ps aux" --key /path/to/private/key --user myuser

# Show help
node scripts/shell-command.js --help
```

### test-workflow.js
Complete end-to-end workflow test that demonstrates the full encryption lifecycle including authentication, key exchange, device scanning, and Wake-on-LAN operations.

```bash
# Run complete workflow test
node scripts/test-workflow.js
```

This script automatically:
- Authenticates with the API
- Generates client RSA key pair
- Registers public key with server
- Scans for network devices
- Tests Wake-on-LAN functionality

## Development

### Code Quality

```bash
# Run linting
npm run lint

# Format code
npm run format
```

### Testing

```bash
# Run unit tests
npm run test

# Run tests with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e

# Watch mode
npm run test:watch
```

### Build

```bash
# Build for production
npm run build
```

## Production Deployment

### Security Checklist

- [ ] Generate secure `DATABASE_MASTER_KEY` (64 hex characters)
- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Update default user passwords or remove test accounts
- [ ] Set `NODE_ENV=production`
- [ ] Configure appropriate `ALLOWED_ORIGINS` for CORS
- [ ] Set `DATABASE_SYNCHRONIZE=false` in production
- [ ] Enable HTTPS/TLS
- [ ] Set up monitoring and logging
- [ ] Configure database backups
- [ ] Review server security configuration

### Environment Variables

For production, ensure these are properly configured:

```env
NODE_ENV=production
DATABASE_MASTER_KEY=<64-character-hex-key>
JWT_SECRET=<strong-random-secret>
DATABASE_SYNCHRONIZE=false
DATABASE_LOGGING=false
PORT=3000
ALLOWED_ORIGINS=https://yourdomain.com
```

## Architecture

### Modules
- **AppModule**: Main application module
- **AuthModule**: JWT authentication and user management
- **KeysModule**: RSA key generation, storage, and lifecycle
- **CommandsModule**: Command processing and execution
- **DatabaseModule**: SQLite configuration and data seeding

### Security Features
- Input validation with class-validator
- Global exception handling
- CORS protection
- JWT token authentication
- RSA-2048 message encryption
- AES-256-GCM database encryption
- Automated key rotation
- Password hashing with bcrypt

## License

UNLICENSED - Private project