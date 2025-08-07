#!/usr/bin/env node

const crypto = require('crypto');
const https = require('https');
const http = require('http');

// Configuration
const config = {
  baseUrl: 'http://localhost:3000',
  username: 'admin',
  password: 'admin123'
};

class EncryptedAPIClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.accessToken = null;
    this.clientKeyPair = null;
    this.serverPublicKey = null;
  }

  // Generate RSA key pair for client
  generateClientKeyPair() {
    console.log('🔑 Generating client RSA key pair...');
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem',
      },
    });

    this.clientKeyPair = { publicKey, privateKey };
    console.log('✅ Client key pair generated');
    return this.clientKeyPair;
  }

  // Encrypt data with public key using AES+RSA hybrid encryption
  encryptWithPublicKey(data, publicKeyPem) {
    // Generate random AES key and IV
    const aesKey = crypto.randomBytes(32); // AES-256 key
    const iv = crypto.randomBytes(16); // AES IV
    
    console.log(`[TestClient] Generated AES key (${aesKey.length} bytes) and IV (${iv.length} bytes)`);
    
    // Encrypt data with AES
    const cipher = crypto.createCipheriv('aes-256-cbc', aesKey, iv);
    let encryptedData = cipher.update(data, 'utf8', 'base64');
    encryptedData += cipher.final('base64');
    
    console.log(`[TestClient] Data encrypted with AES`);
    
    // Encrypt AES key with RSA public key
    const encryptedAesKey = crypto.publicEncrypt({
      key: publicKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    }, aesKey);
    
    console.log(`[TestClient] AES key encrypted with RSA`);
    
    return {
      encryptedKey: encryptedAesKey.toString('base64'),
      iv: iv.toString('base64'),
      encryptedData: encryptedData,
    };
  }

  // Decrypt data with private key using AES+RSA hybrid decryption
  decryptWithPrivateKey(encryptedPayload, privateKeyPem) {
    console.log(`[TestClient] Using AES+RSA hybrid decryption`);
    
    // Decrypt AES key with RSA private key
    const encryptedAesKeyBuffer = Buffer.from(encryptedPayload.encryptedKey, 'base64');
    const aesKey = crypto.privateDecrypt({
      key: privateKeyPem,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    }, encryptedAesKeyBuffer);
    
    console.log(`[TestClient] AES key decrypted with RSA`);
    
    // Decrypt data with AES
    const iv = Buffer.from(encryptedPayload.iv, 'base64');
    const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
    let decryptedData = decipher.update(encryptedPayload.encryptedData, 'base64', 'utf8');
    decryptedData += decipher.final('utf8');
    
    console.log(`[TestClient] Data decrypted with AES`);
    
    return decryptedData;
  }

  // HTTP request helper
  async makeRequest(method, path, data = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.baseUrl);
      const isHttps = url.protocol === 'https:';
      const client = isHttps ? https : http;
      
      const options = {
        hostname: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname + url.search,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      if (this.accessToken) {
        options.headers['Authorization'] = `Bearer ${this.accessToken}`;
      }

      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const result = {
              status: res.statusCode,
              headers: res.headers,
              data: body ? JSON.parse(body) : null
            };
            resolve(result);
          } catch (error) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: body
            });
          }
        });
      });

      req.on('error', reject);

      if (data) {
        const jsonData = JSON.stringify(data);
        req.write(jsonData);
      }

      req.end();
    });
  }

  // Step 1: Login
  async login(username, password) {
    console.log(`\n🔐 Step 1: Logging in as ${username}...`);
    
    const response = await this.makeRequest('POST', '/auth/login', {
      username,
      password
    });

    if (response.status === 201 && response.data.access_token) {
      this.accessToken = response.data.access_token;
      console.log('✅ Login successful');
      console.log(`   Token: ${this.accessToken.substring(0, 20)}...`);
      return response.data;
    } else {
      throw new Error(`Login failed: ${response.status} - ${JSON.stringify(response.data)}`);
    }
  }

  // Step 2: Get server public key
  async getServerPublicKey() {
    console.log('\n🔑 Step 2: Getting server public key...');
    
    const response = await this.makeRequest('GET', '/keys/server-public');
    
    if (response.status === 200 && response.data.publicKey) {
      this.serverPublicKey = response.data.publicKey;
      console.log('✅ Server public key received');
      console.log(`   Expires: ${response.data.expiresAt}`);
      return response.data;
    } else {
      throw new Error(`Failed to get server public key: ${response.status} - ${JSON.stringify(response.data)}`);
    }
  }

  // Step 3: Register client public key
  async registerPublicKey() {
    console.log('\n📝 Step 3: Registering client public key...');
    
    if (!this.clientKeyPair) {
      throw new Error('Client key pair not generated yet');
    }

    // Send public key directly (no encryption needed for public key registration)
    const response = await this.makeRequest('POST', '/keys/register', {
      publicKey: this.clientKeyPair.publicKey
    });

    if (response.status === 201) {
      console.log('✅ Public key registered successfully');
      console.log(`   Key ID: ${response.data.id}`);
      console.log(`   Expires: ${response.data.expiresAt}`);
      return response.data;
    } else {
      throw new Error(`Failed to register public key: ${response.status} - ${JSON.stringify(response.data)}`);
    }
  }

  // Step 4: Make encrypted request to scan-devices
  async scanDevices() {
    console.log('\n🔍 Step 4: Requesting device scan (encrypted)...');
    
    const response = await this.makeRequest('GET', '/commands/scan-devices');
    
    if (response.status === 200) {
      if (response.data.encryptedKey && response.data.iv && response.data.encryptedData) {
        console.log('✅ Received hybrid encrypted response');
        console.log(`   Timestamp: ${response.data.timestamp}`);
        
        // Decrypt the response using client's private key
        const encryptedPayload = {
          encryptedKey: response.data.encryptedKey,
          iv: response.data.iv,
          encryptedData: response.data.encryptedData
        };
        
        const decryptedData = this.decryptWithPrivateKey(
          encryptedPayload,
          this.clientKeyPair.privateKey
        );
        
        const deviceData = JSON.parse(decryptedData);
        console.log('🔓 Decrypted response:');
        console.log(JSON.stringify(deviceData, null, 2));
        
        return deviceData;
      } else {
        console.log('⚠️ Received unencrypted response:', response.data);
        return response.data;
      }
    } else {
      throw new Error(`Scan devices failed: ${response.status} - ${JSON.stringify(response.data)}`);
    }
  }

  // Complete workflow test
  async testCompleteWorkflow(username, password) {
    try {
      console.log('🚀 Starting complete encrypted workflow test...');
      console.log('='.repeat(60));

      // Generate client keys
      this.generateClientKeyPair();
      
      // Step 1: Login
      await this.login(username, password);
      
      // Step 2: Get server public key
      await this.getServerPublicKey();
      
      // Step 3: Register client public key
      await this.registerPublicKey();
      
      // Step 4: Test encrypted communication
      await this.scanDevices();
      
      console.log('\n' + '='.repeat(60));
      console.log('🎉 Complete workflow test SUCCESSFUL!');
      
    } catch (error) {
      console.error('\n' + '='.repeat(60));
      console.error('❌ Workflow test FAILED:');
      console.error(error.message);
      
      if (error.stack) {
        console.error('\nStack trace:');
        console.error(error.stack);
      }
      
      process.exit(1);
    }
  }
}

// Additional test: Wake-on-LAN with encryption
async function testWakeOnLAN(client, macAddress = '00:11:22:33:44:55', ipAddress = '192.168.1.100') {
  console.log('\n💤 Bonus: Testing encrypted Wake-on-LAN...');
  
  try {
    const wakePayload = {
      macAddress
    };
    
    // Encrypt the payload using server's public key
    const encryptionResult = client.encryptWithPublicKey(
      JSON.stringify(wakePayload),
      client.serverPublicKey
    );
    
    const response = await client.makeRequest('POST', '/commands/wake-on-lan', {
      encryptedKey: encryptionResult.encryptedKey,
      iv: encryptionResult.iv,
      encryptedData: encryptionResult.encryptedData
    });
    
    if (response.status === 200 && response.data.encryptedKey) {
      // Decrypt the response
      const encryptedPayload = {
        encryptedKey: response.data.encryptedKey,
        iv: response.data.iv,
        encryptedData: response.data.encryptedData
      };
      
      const decryptedData = client.decryptWithPrivateKey(
        encryptedPayload,
        client.clientKeyPair.privateKey
      );
      
      const result = JSON.parse(decryptedData);
      console.log('✅ Wake-on-LAN successful (encrypted)');
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log('⚠️ Wake-on-LAN response:', response.data);
    }
    
  } catch (error) {
    console.error('❌ Wake-on-LAN failed:', error.message);
  }
}

// Main execution
async function main() {
  const client = new EncryptedAPIClient(config.baseUrl);
  
  // Test complete workflow
  await client.testCompleteWorkflow(config.username, config.password);
  
  // Bonus: Test Wake-on-LAN
  await testWakeOnLAN(client);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { EncryptedAPIClient };