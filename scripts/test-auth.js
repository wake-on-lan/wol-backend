#!/usr/bin/env node

const crypto = require('crypto');
const https = require('https');
const http = require('http');

// Command line arguments parsing
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    baseUrl: 'http://localhost:3000',
    username: 'admin',
    password: 'admin123',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
      case '-u':
        config.baseUrl = args[++i];
        break;
      case '--username':
        config.username = args[++i];
        break;
      case '--password':
        config.password = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: node test-auth.js [options]

Options:
  -u, --url <url>        Base URL of the WOL server (default: http://localhost:3000)
  --username <username>  Username for authentication (default: admin)
  --password <password>  Password for authentication (default: admin123)
  -h, --help            Show this help message

This script tests the authentication and key management endpoints:
- POST /auth/login
- POST /keys/register  
- GET /keys/my-key
        `);
        process.exit(0);
        break;
    }
  }

  return config;
}

class AuthTestClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.accessToken = null;
    this.clientKeyPair = null;
    this.serverPublicKey = null;
  }

  // --- Key Management ---

  generateClientKeyPair() {
    console.log('🔑 Generating client RSA key pair...');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    this.clientKeyPair = { publicKey, privateKey };
    console.log('✅ Client key pair generated successfully');
    console.log(`   Public key length: ${publicKey.length} characters`);
    return this.clientKeyPair;
  }

  encryptRSA(data, publicKey) {
    const buffer = Buffer.from(data, 'base64');
    return crypto
      .publicEncrypt(
        {
          key: publicKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        buffer,
      )
      .toString('base64');
  }

  // --- Encryption / Decryption ---

  encrypt(data, recipientPublicKey) {
    try {
      const json = typeof data === 'string' ? data : JSON.stringify(data);
      const aesKey = crypto.randomBytes(32);
      const iv = crypto.randomBytes(16);

      const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
      let encrypted = cipher.update(json, 'utf-8', 'base64');
      encrypted += cipher.final('base64');

      return {
        data: encrypted,
        key: this.encryptRSA(aesKey.toString('base64'), recipientPublicKey),
        iv: this.encryptRSA(iv.toString('base64'), recipientPublicKey),
      };
    } catch (err) {
      throw new Error(`Encryption failed: ${err.message}`);
    }
  }

  decrypt(encryptedMessage, privateKey) {
    try {
      const { data, key, iv } = encryptedMessage;

      const decryptedKey = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        Buffer.from(key, 'base64'),
      );

      const decryptedIv = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        Buffer.from(iv, 'base64'),
      );

      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(decryptedKey, 'hex'),
        Buffer.from(decryptedIv, 'hex'),
      );

      let decrypted = decipher.update(data, 'base64', 'utf-8');
      decrypted += decipher.final('utf-8');

      return decrypted;
    } catch (err) {
      throw new Error(`Decryption failed: ${err.message}`);
    }
  }

  // --- HTTP Utilities ---

  async makeRequest(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;

      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      };

      if (this.accessToken) {
        options.headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: body ? JSON.parse(body) : null,
            });
          } catch {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: body,
            });
          }
        });
      });

      req.on('error', reject);
      if (data) req.write(JSON.stringify(data));
      req.end();
    });
  }

  // --- API Methods ---

  async testLogin(username, password) {
    console.log(`\n🔐 Testing login endpoint with username: ${username}`);

    try {
      let res = await this.makeRequest(
        'POST',
        '/auth/login',
        this.encrypt(
          {
            username,
            password,
            publicKey: this.clientKeyPair.publicKey,
          },
          this.serverPublicKey,
        ),
      );

      console.log(`   Response status: ${res.status}`);
      const decryptMessage = this.decrypt(res.data, this.clientKeyPair.privateKey);
      const decryptedResult = JSON.parse(decryptMessage);
      if (res.status === 201 && decryptedResult && decryptedResult.access_token) {
        this.accessToken = decryptedResult.access_token;
        console.log('✅ Login successful');
        console.log(
          `   Token length: ${decryptedResult.access_token.length} characters`,
        );
        console.log(
          `   Token preview: ${decryptedResult.access_token.substring(0, 50)}...`,
        );
        return decryptedResult;
      } else {
        console.log('❌ Login failed');
        console.log(`   Error: ${JSON.stringify(res.data, null, 2)}`);
        throw new Error(
          `Login failed: ${res.status} - ${JSON.stringify(res.data)}`,
        );
      }
    } catch (err) {
      console.log('❌ Login request failed');
      console.log(`   Error: ${err.message}`);
      throw err;
    }
  }

  async testGetServerPublicKey() {
    console.log(`\n🗝️  Testing server public key endpoint`);

    try {
      const res = await this.makeRequest('GET', '/keys/server-public');

      console.log(`   Response status: ${res.status}`);

      if (res.status === 200) {
        this.serverPublicKey = res.data.publicKey;
        console.log('✅ Server public key retrieved successfully');
        console.log(`   Key length: ${res.data.publicKey.length} characters`);
        console.log(
          `   Key preview: ${res.data.publicKey.substring(0, 100)}...`,
        );
        return res.data;
      } else {
        console.log('❌ Failed to get server public key');
        console.log(`   Error: ${JSON.stringify(res.data, null, 2)}`);
        throw new Error(
          `Failed to get server public key: ${res.status} - ${JSON.stringify(res.data)}`,
        );
      }
    } catch (err) {
      console.log('❌ Server public key request failed');
      console.log(`   Error: ${err.message}`);
      throw err;
    }
  }

  async testRegisterPublicKey() {
    console.log(`\n📝 Testing public key registration endpoint`);

    if (!this.clientKeyPair) {
      throw new Error('Client key pair not generated yet');
    }
    if (!this.serverPublicKey) {
      throw new Error('Server public key not retrieved yet');
    }

    try {
      const payload = { publicKey: this.clientKeyPair.publicKey };
      const res = await this.makeRequest('POST', '/keys/register', payload);

      console.log(`   Response status: ${res.status}`);

      if (res.status === 201) {
        const { data, key, iv } = res.data;
        console.log('✅ Public key registration successful');

        if (data && key && iv) {
          console.log('🔓 Decrypting registration response...');
          const decrypted = this.decrypt(
            res.data,
            this.clientKeyPair.privateKey,
          );
          const decryptedData = JSON.parse(decrypted);
          console.log('✅ Response decrypted successfully');
          console.log(
            `   Registration data: ${JSON.stringify(decryptedData, null, 2)}`,
          );
          return decryptedData;
        } else {
          console.log('ℹ️  Response was not encrypted (development mode)');
          console.log(
            `   Registration data: ${JSON.stringify(res.data, null, 2)}`,
          );
          return res.data;
        }
      } else {
        console.log('❌ Failed to register public key');
        console.log(`   Error: ${JSON.stringify(res.data, null, 2)}`);
        throw new Error(
          `Failed to register public key: ${res.status} - ${JSON.stringify(res.data)}`,
        );
      }
    } catch (err) {
      console.log('❌ Public key registration request failed');
      console.log(`   Error: ${err.message}`);
      throw err;
    }
  }

  async testGetMyKey() {
    console.log(`\n🔍 Testing my-key endpoint`);

    if (!this.accessToken) {
      throw new Error('Not authenticated - access token required');
    }

    try {
      const res = await this.makeRequest('GET', '/keys/my-key');

      console.log(`   Response status: ${res.status}`);

      if (res.status === 200) {
        const { data, key, iv } = res.data;
        console.log('✅ My-key endpoint successful');

        if (data && key && iv) {
          console.log('🔓 Decrypting my-key response...');
          const decrypted = this.decrypt(
            res.data,
            this.clientKeyPair.privateKey,
          );
          const decryptedData = JSON.parse(decrypted);
          console.log('✅ Response decrypted successfully');
          console.log(`   Key data: ${JSON.stringify(decryptedData, null, 2)}`);
          return decryptedData;
        } else {
          console.log('ℹ️  Response was not encrypted (development mode)');
          console.log(`   Key data: ${JSON.stringify(res.data, null, 2)}`);
          return res.data;
        }
      } else {
        console.log('❌ Failed to get my-key');
        console.log(`   Error: ${JSON.stringify(res.data, null, 2)}`);
        throw new Error(
          `Failed to get my-key: ${res.status} - ${JSON.stringify(res.data)}`,
        );
      }
    } catch (err) {
      console.log('❌ My-key request failed');
      console.log(`   Error: ${err.message}`);
      throw err;
    }
  }

  async runFullTest() {
    try {
      console.log('🚀 Starting authentication and key management test');
      console.log(`   Server URL: ${this.baseUrl}`);
      console.log(`   Username: ${this.config.username}`);

      // Step 1: Generate client key pair
      this.generateClientKeyPair();

      // Step 2: Get server public key
      await this.testGetServerPublicKey();

      // Step 3: Test login
      await this.testLogin(this.config.username, this.config.password);

      // Step 4: Register client public key
      await this.testRegisterPublicKey();

      // Step 5: Test my-key endpoint
      await this.testGetMyKey();

      console.log(
        '\n🎉 All authentication and key management tests completed successfully!',
      );
      console.log('\n📋 Test Summary:');
      console.log('   ✅ Login endpoint working');
      console.log('   ✅ Server public key retrieval working');
      console.log('   ✅ Public key registration working');
      console.log('   ✅ My-key endpoint working');
      console.log('   ✅ Encryption/decryption working');
    } catch (err) {
      console.error('\n❌ Authentication test failed:', err.message);
      process.exit(1);
    }
  }
}

// --- Entry Point ---

async function main() {
  const config = parseArgs();
  const client = new AuthTestClient(config.baseUrl);
  client.config = config; // Store config for use in the client
  await client.runFullTest();
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Execution failed:', err.message);
    process.exit(1);
  });
}

module.exports = { AuthTestClient };
