# Wake-on-LAN Encrypted Relay Server

A NestJS-based backend service that acts as an authenticated relay/proxy for encrypted commands and wake-on-LAN packets. The system implements bidirectional encryption where clients generate their own RSA key pairs and communicate with the server using encrypted messages.

## Features

### Core Functionality
- **Encrypted Command Relay**: Receives encrypted commands from clients and forwards them to target servers
- **Bidirectional Encryption**: Client-to-server and server-to-client message encryption using RSA
- **Wake-on-LAN Support**: Specialized handling for wake-on-LAN magic packets
- **JWT Authentication**: Secure user authentication with session management

### Security Model
- **Client-Side Key Generation**: Users generate RSA/ECDSA key pairs locally (private keys never leave client)
- **Public Key Registration**: Users register only their public keys with the server after authentication
- **Server Key Rotation**: Automatic 24-hour server key pair rotation
- **Key Expiration Management**: Automated key lifecycle with expiration warnings

### Key Management
- **24-Hour Key Lifecycle**: All keys expire after 24 hours for enhanced security
- **Automated Rotation**: Scheduled tasks handle key expiration and server key rotation
- **Grace Period Warnings**: Users receive warnings before key expiration
- **Key Status Monitoring**: Real-time key status and expiration checking

## API Endpoints

### Authentication
- `POST /auth/login` - User authentication with existing SQLite credentials

### Key Management  
- `GET /keys/server-public` - Retrieve server's current public key
- `POST /keys/register` - Register new public key for authenticated user
- `GET /keys/my-keys` - List user's registered public keys and status
- `GET /keys/status` - Check key expiration warnings and status

### Command Processing
- `POST /commands/send` - Send encrypted command and receive encrypted response

## Database Schema

### SQLite Tables
- **users**: `id`, `username`, `password_hash`, `created_at`
- **user_public_keys**: `id`, `user_id`, `public_key_pem`, `expires_at`, `is_active`, `created_at`  
- **server_keys**: `id`, `public_key_pem`, `private_key_pem`, `expires_at`, `is_active`, `created_at`

## Project Setup

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn

### Installation

```bash
# Clone and navigate to project
cd encrypted-relay-server

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env
```

### Environment Configuration

Update `.env` file with your settings:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Configuration (Change in production!)
JWT_SECRET=secure-jwt-secret-key-change-in-production

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001

# Database Configuration
DATABASE_PATH=encrypted-relay.db
```

### Running the Application

```bash
# Development mode with hot reload
npm run start:dev

# Production mode
npm run start:prod

# Standard development mode
npm run start
```

## Default Users

The application seeds the following test users on first run:

| Username | Password | Role |
|----------|----------|------|
| admin    | admin123 | Administrator |
| user     | user123  | Standard User |
| testuser | test123  | Test User |

## Encryption Workflow

### 1. Initial Setup
1. Client generates RSA key pair locally (private key stays on client)
2. Client authenticates with username/password 
3. Client registers public key with server via `POST /keys/register`
4. Client retrieves server's public key via `GET /keys/server-public`

### 2. Command Processing
1. Client encrypts command using server's public key
2. Client sends encrypted command via `POST /commands/send`
3. Server decrypts command using its private key
4. Server processes command and generates response
5. Server encrypts response using client's registered public key
6. Server returns encrypted response to client
7. Client decrypts response using its private key

### 3. Key Rotation
- Server keys rotate every 24 hours automatically
- User keys expire after 24 hours (users must generate new ones)
- Grace period warnings sent 2 hours before expiration
- Expired keys are automatically deactivated

## Supported Commands

The server supports the following command types:

### Wake-on-LAN
```json
{
  "type": "wake-on-lan",
  "payload": {
    "macAddress": "00:11:22:33:44:55",
    "ipAddress": "192.168.1.100",
    "port": 9
  }
}
```

### Ping
```json
{
  "type": "ping", 
  "payload": {
    "target": "192.168.1.100"
  }
}
```

### System Status
```json
{
  "type": "system-status",
  "payload": {}
}
```

## Development

### Code Linting
```bash
npm run lint
```

### Testing
```bash
# Unit tests
npm run test

# E2E tests  
npm run test:e2e

# Test coverage
npm run test:cov
```

### Database Management

The application uses SQLite with TypeORM:
- Database file: `encrypted-relay.db` (created automatically)
- Automatic schema synchronization in development
- Initial user seeding on first run

## Production Deployment

### Security Checklist
- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Update default user passwords or disable test accounts  
- [ ] Configure appropriate `ALLOWED_ORIGINS` for CORS
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS/TLS termination
- [ ] Configure proper logging and monitoring
- [ ] Set up database backups
- [ ] Review and harden server configuration

### Environment Variables
```env
NODE_ENV=production
JWT_SECRET=your-super-secure-random-jwt-secret
PORT=3000
ALLOWED_ORIGINS=https://yourdomain.com
```

## Architecture

### Modules
- **AuthModule**: JWT-based authentication and user management
- **KeysModule**: RSA key generation, storage, and lifecycle management  
- **CommandsModule**: Encrypted command processing and relay functionality
- **CryptoModule**: RSA encryption/decryption operations
- **SchedulerModule**: Automated key rotation and expiration tasks
- **DatabaseModule**: SQLite database configuration and seeding

### Security Features
- Input validation with class-validator
- Global exception filtering and error handling
- CORS configuration
- JWT token-based authentication
- RSA-2048 encryption for all sensitive communications
- Automated key rotation and expiration

## License

This project is MIT licensed.