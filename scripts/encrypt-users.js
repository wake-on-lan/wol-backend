#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class UserEncryption {
  constructor(masterKey) {
    this.algorithm = 'aes-256-gcm';
    this.keyDerivationIterations = 100000;
    this.masterKey = Buffer.from(masterKey, 'hex');
  }

  encrypt(plaintext) {
    if (!plaintext) return plaintext;

    try {
      const salt = crypto.randomBytes(16);
      const key = crypto.pbkdf2Sync(this.masterKey, salt, this.keyDerivationIterations, 32, 'sha256');
      const iv = crypto.randomBytes(12);

      const cipher = crypto.createCipheriv(this.algorithm, key, iv);

      let encrypted = cipher.update(plaintext, 'utf-8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Format: salt(16) + iv(12) + authTag(16) + encrypted
      const result = Buffer.concat([
        salt,
        iv,
        authTag,
        Buffer.from(encrypted, 'hex')
      ]);
      
      return result.toString('base64');
    } catch (error) {
      console.error('Failed to encrypt data:', error);
      throw new Error('Encryption failed');
    }
  }
}

function showUsage() {
  console.log(`
Usage: node encrypt-users.js [options]

Options:
  --input <file>     Path to JSON file containing users (default: users.json)
  --output <file>    Path to output encrypted file (default: users.encrypted.json)  
  --key <hex>        64-character hex master key (or set DATABASE_MASTER_KEY env var)
  --help             Show this help message

Example JSON format for input file:
{
  "users": [
    {
      "username": "admin",
      "password": "securePassword123"
    },
    {
      "username": "operator",
      "password": "anotherSecurePassword456"
    }
  ]
}

Example usage:
  node encrypt-users.js --input users.json --output users.encrypted.json --key abc123...
  DATABASE_MASTER_KEY=abc123... node encrypt-users.js --input users.json
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    input: 'users.json',
    output: 'users.encrypted.json',
    key: process.env.DATABASE_MASTER_KEY
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
        options.input = args[++i];
        break;
      case '--output':
        options.output = args[++i];
        break;
      case '--key':
        options.key = args[++i];
        break;
      case '--help':
        showUsage();
        process.exit(0);
        break;
      default:
        console.error(`Unknown option: ${args[i]}`);
        showUsage();
        process.exit(1);
    }
  }

  return options;
}

function validateUserData(data) {
  if (!data.users || !Array.isArray(data.users)) {
    throw new Error('Invalid JSON format: "users" array is required');
  }

  for (let i = 0; i < data.users.length; i++) {
    const user = data.users[i];
    if (!user.username || !user.password) {
      throw new Error(`Invalid user at index ${i}: username and password are required`);
    }
    if (typeof user.username !== 'string' || typeof user.password !== 'string') {
      throw new Error(`Invalid user at index ${i}: username and password must be strings`);
    }
  }

  console.log(`✅ Validated ${data.users.length} users`);
}

function main() {
  const options = parseArgs();

  // Validate master key
  if (!options.key) {
    console.error('❌ Master key is required. Provide --key or set DATABASE_MASTER_KEY environment variable');
    process.exit(1);
  }

  if (options.key.length !== 64) {
    console.error('❌ Master key must be 64 characters (32 bytes) in hex format');
    process.exit(1);
  }

  // Check if input file exists
  if (!fs.existsSync(options.input)) {
    console.error(`❌ Input file not found: ${options.input}`);
    process.exit(1);
  }

  try {
    // Read and parse input JSON
    console.log(`📖 Reading users from: ${options.input}`);
    const inputData = fs.readFileSync(options.input, 'utf8');
    const userData = JSON.parse(inputData);

    // Validate user data format
    validateUserData(userData);

    // Initialize encryption
    const encryptor = new UserEncryption(options.key);

    // Encrypt the JSON data
    console.log('🔒 Encrypting user data...');
    const encryptedData = encryptor.encrypt(JSON.stringify(userData));

    // Write encrypted data to output file
    console.log(`💾 Writing encrypted data to: ${options.output}`);
    fs.writeFileSync(options.output, encryptedData);

    console.log(`✅ Successfully created encrypted user file: ${options.output}`);
    console.log(`📊 Encrypted ${userData.users.length} users`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
main();