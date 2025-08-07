#!/usr/bin/env node

const crypto = require('crypto');
const https = require('https');
const http = require('http');

// Configuration
const config = {
  baseUrl: 'http://localhost:3000',
  username: 'admin',
  password: 'admin123',
};

class EncryptedAPIClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.accessToken = null;
    this.clientKeyPair = null;
    this.serverPublicKey = null;
  }

  // --- Key Management ---

  generateClientKeyPair() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });

    this.clientKeyPair = { publicKey, privateKey };
    return this.clientKeyPair;
  }

  encryptRSA(data, publicKey) {
    const buffer = Buffer.from(data, 'base64');
    return crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      buffer
    ).toString('base64');
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
        Buffer.from(key, 'base64')
      );

      const decryptedIv = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        Buffer.from(iv, 'base64')
      );

      const decipher = crypto.createDecipheriv(
        'aes-256-cbc',
        Buffer.from(decryptedKey, 'hex'),
        Buffer.from(decryptedIv, 'hex')
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

  // --- API Workflow ---

  async login(username, password) {
    const res = await this.makeRequest('POST', '/auth/login', { username, password });

    if (res.status === 201 && res.data.access_token) {
      this.accessToken = res.data.access_token;
      return res.data;
    }

    throw new Error(`Login failed: ${res.status} - ${JSON.stringify(res.data)}`);
  }

  async getServerPublicKey() {
    const res = await this.makeRequest('GET', '/keys/server-public');

    if (res.status === 200) {
      this.serverPublicKey = res.data.publicKey;
    } else {
      throw new Error(`Failed to get server public key: ${res.status} - ${JSON.stringify(res.data)}`);
    }
  }

  async registerPublicKey() {
    if (!this.clientKeyPair) throw new Error('Client key pair not generated yet');
    if (!this.serverPublicKey) throw new Error('Server public key not retrieved yet');

    const payload = { publicKey: this.clientKeyPair.publicKey };
    const res = await this.makeRequest('POST', '/keys/register', payload);

    if (res.status === 201) {
      const { data, key, iv } = res.data;
      if (data && key && iv) {
        const decrypted = this.decrypt(res.data, this.clientKeyPair.privateKey);
        return JSON.parse(decrypted);
      }
      return res.data;
    }

    throw new Error(`Failed to register public key: ${res.status} - ${JSON.stringify(res.data)}`);
  }

  async scanDevices() {
    const res = await this.makeRequest('GET', '/commands/scan-devices');

    if (res.status === 200) {
      const { data, key, iv } = res.data;
      if (data && key && iv) {
        const decrypted = this.decrypt(res.data, this.clientKeyPair.privateKey);
        return JSON.parse(decrypted);
      }
      return res.data;
    }

    throw new Error(`Scan devices failed: ${res.status} - ${JSON.stringify(res.data)}`);
  }

  async testWakeOnLAN(macAddress = '00:11:22:33:44:55') {
    const payload = this.encrypt({ macAddress }, this.serverPublicKey);
    const res = await this.makeRequest('POST', '/commands/wake-on-lan', payload);

    if (res.status === 200 || res.status === 201) {
      const { data, key, iv } = res.data;
      if (data && key && iv) {
        const decrypted = this.decrypt(res.data, this.clientKeyPair.privateKey);
        return JSON.parse(decrypted);
      }
      return res.data;
    }

    throw new Error(`Wake-on-LAN failed: ${res.status} - ${JSON.stringify(res.data)}`);
  }

  async testCompleteWorkflow(username, password) {
    try {
      this.generateClientKeyPair();
      console.log("JWT", await this.login(username, password));
      await this.getServerPublicKey();
      await this.registerPublicKey();

      const devices = await this.scanDevices();
      console.log('Devices found:', devices);

      const wolResult = await this.testWakeOnLAN('84:d8:1b:36:a2:67');
      console.log('Wake-on-LAN result:', wolResult);
      console.log('✅ Complete workflow test successful');
    } catch (err) {
      console.error('❌ Workflow test failed:', err.message);
      process.exit(1);
    }
  }
}

// --- Entry Point ---

async function main() {
  const client = new EncryptedAPIClient(config.baseUrl);
  await client.testCompleteWorkflow(config.username, config.password);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Execution failed:', err.message);
    process.exit(1);
  });
}

module.exports = { EncryptedAPIClient };
