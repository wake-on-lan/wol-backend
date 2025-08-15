#!/usr/bin/env node

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Command line arguments parsing
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    baseUrl: 'http://localhost:3000',
    username: 'admin',
    password: 'admin123',
    action: null,
    hostname: null,
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
      case '--action':
      case '-a':
        config.action = args[++i];
        break;
      case '--hostname':
        config.hostname = args[++i];
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: node wol-interactive.js [options]

Options:
  -u, --url <url>        Base URL of the WOL server (default: http://localhost:3000)
  --username <username>  Username for authentication (default: admin)
  --password <password>  Password for authentication (default: admin123)
  -a, --action <action>  Action to perform: wake, https, ping, command, or interactive (default: interactive)
  --hostname <hostname>  Hostname for https/ping actions
  -h, --help            Show this help message

Actions:
  wake         Scan for devices and wake up a selected device
  https        Check HTTPS availability of a hostname
  ping         Check if a host is up (ping)
  command      Execute shell commands via SSH
  interactive  Show interactive menu to choose action (default)

Examples:
  node wol-interactive.js                                    # Interactive menu
  node wol-interactive.js --action wake                      # Direct wake action
  node wol-interactive.js --action https --hostname google.com
  node wol-interactive.js --action ping --hostname 192.168.1.1
  node wol-interactive.js --action command                   # Interactive shell command
        `);
        process.exit(0);
        break;
    }
  }

  return config;
}

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

  async checkHttpsAvailability(hostname) {
    const res = await this.makeRequest('GET', `/commands/checkHttpsAvailability?hostname=${encodeURIComponent(hostname)}`);

    if (res.status === 200) {
      const { data, key, iv } = res.data;
      if (data && key && iv) {
        const decrypted = this.decrypt(res.data, this.clientKeyPair.privateKey);
        return JSON.parse(decrypted);
      }
      return res.data;
    }

    throw new Error(`HTTPS availability check failed: ${res.status} - ${JSON.stringify(res.data)}`);
  }

  async checkHost(hostname) {
    const res = await this.makeRequest('GET', `/commands/up?hostname=${encodeURIComponent(hostname)}`);

    if (res.status === 200) {
      const { data, key, iv } = res.data;
      if (data && key && iv) {
        const decrypted = this.decrypt(res.data, this.clientKeyPair.privateKey);
        return JSON.parse(decrypted);
      }
      return res.data;
    }

    throw new Error(`Host check failed: ${res.status} - ${JSON.stringify(res.data)}`);
  }

  async sendShellCommand(shellCommand) {
    const payload = this.encrypt(shellCommand, this.serverPublicKey);
    const res = await this.makeRequest('POST', '/commands/shell', payload);

    if (res.status === 200 || res.status === 201) {
      const { data, key, iv } = res.data;
      if (data && key && iv) {
        const decrypted = this.decrypt(res.data, this.clientKeyPair.privateKey);
        return JSON.parse(decrypted);
      }
      return res.data;
    }

    throw new Error(`Shell command failed: ${res.status} - ${JSON.stringify(res.data)}`);
  }

  async initialize() {
    this.generateClientKeyPair();
    await this.login(this.config.username, this.config.password);
    await this.getServerPublicKey();
    await this.registerPublicKey();
  }

  async actionWake() {
    try {
      await this.initialize();

      console.log('🔍 Scanning for devices...');
      const devices = await this.scanDevices();
      
      if (devices.length === 0) {
        console.log('❌ No devices found on the network');
        return;
      }

      console.log(`\n📱 Found ${devices.length} device(s):\n`);
      devices.forEach((device, index) => {
        console.log(`${index + 1}. ${device.name}`);
        console.log(`   IP: ${device.ip}`);
        console.log(`   MAC: ${device.mac}\n`);
      });

      const selectedDevice = await this.promptDeviceSelection(devices);
      
      if (selectedDevice) {
        console.log(`\n⚡ Sending Wake-on-LAN packet to ${selectedDevice.name} (${selectedDevice.mac})...`);
        const wolResult = await this.testWakeOnLAN(selectedDevice.mac);
        console.log('Wake-on-LAN result:', wolResult);
        
        if (wolResult.success) {
          console.log('✅ Wake-on-LAN packet sent successfully');
        } else {
          console.log('❌ Failed to send Wake-on-LAN packet');
        }
      } else {
        console.log('❌ No device selected');
      }
    } catch (err) {
      console.error('❌ Wake operation failed:', err.message);
    }
  }

  async actionHttps(hostname) {
    if (!hostname) {
      console.log('❌ Hostname is required for HTTPS availability check');
      return;
    }

    try {
      await this.initialize();
      console.log(`🌐 Checking HTTPS availability for ${hostname}...`);
      const result = await this.checkHttpsAvailability(hostname);
      
      if (result.reachable) {
        console.log(`✅ ${hostname} is reachable via HTTPS`);
      } else {
        console.log(`❌ ${hostname} is not reachable via HTTPS`);
      }
    } catch (err) {
      console.error('❌ HTTPS check failed:', err.message);
    }
  }

  async actionPing(hostname) {
    if (!hostname) {
      console.log('❌ Hostname is required for ping check');
      return;
    }

    try {
      await this.initialize();
      console.log(`🏓 Pinging ${hostname}...`);
      const result = await this.checkHost(hostname);
      
      if (result.alive) {
        console.log(`✅ ${hostname} is alive (${result.time}ms)`);
        console.log(`   Min: ${result.min}ms, Max: ${result.max}ms, Avg: ${result.avg}ms`);
      } else {
        console.log(`❌ ${hostname} is not responding to ping`);
      }
    } catch (err) {
      console.error('❌ Ping check failed:', err.message);
    }
  }

  async actionCommand() {
    try {
      await this.initialize();

      console.log('\n💻 Shell Command Execution\n');

      const host = await this.promptChoice('Enter target host (default: 127.0.0.1): ') || '127.0.0.1';
      const port = parseInt(await this.promptChoice('Enter SSH port (default: 22): ') || '22');
      const user = await this.promptChoice('Enter SSH username (default: admin): ') || 'admin';
      const command = await this.promptChoice('Enter shell command to execute: ');

      if (!command) {
        console.log('❌ Command is required');
        return;
      }

      console.log('\n🔐 Authentication method:');
      console.log('1. Password');
      console.log('2. Private key file');
      const authChoice = await this.promptChoice('Choose authentication method (1-2): ');

      const shellCommand = {
        host,
        port,
        user,
        command,
      };

      if (authChoice === '1') {
        const password = await this.promptChoice('Enter SSH password: ');
        if (!password) {
          console.log('❌ Password is required');
          return;
        }
        shellCommand.password = password;
        console.log(`\n💻 Executing: ${command} (using password auth)`);
      } else if (authChoice === '2') {
        const keyPath = await this.promptChoice('Enter path to private key file (default: ../privateKeys/wakeonlan.key): ') || 
                       path.join(__dirname, '../privateKeys/wakeonlan.key');
        
        if (!fs.existsSync(keyPath)) {
          console.log(`❌ Private key file not found: ${keyPath}`);
          return;
        }

        shellCommand.privateKey = fs.readFileSync(keyPath, 'base64');
        console.log(`\n💻 Executing: ${command} (using key auth)`);
      } else {
        console.log('❌ Invalid authentication method');
        return;
      }

      console.log(`📡 Target: ${user}@${host}:${port}`);

      const result = await this.sendShellCommand(shellCommand);
      
      if (!result.success && result.exitStatus !== 0) {
        console.error('\n❌ Command execution failed');
        console.error('Error:', result.message);
        return;
      }

      console.log('\n📄 Results:');
      console.log('==================');
      if (result.command) {
        console.log(`Command: ${result.command}`);
      }

      if (result.timestamp) {
        console.log(`Timestamp: ${result.timestamp}`);
      }
      
      if (result.message) {
        console.log('\nOUTPUT:');
        console.log(result.message.trim());
      }

      console.log('==================');
      
      if (result.success) {
        console.log('✅ Command executed successfully');
      }
    } catch (err) {
      console.error('❌ Shell command execution failed:', err.message);
    }
  }

  async showInteractiveMenu() {
    console.log(`
🔧 WOL Interactive Tool

Select an action:
1. Wake on LAN - Scan and wake up a device
2. HTTPS Check - Check if a hostname is reachable via HTTPS
3. Ping Check - Check if a host is up (ping)
4. Shell Command - Execute shell commands via SSH
5. Exit
    `);

    const choice = await this.promptChoice('Enter your choice (1-5): ');
    
    switch (choice) {
      case '1':
        await this.actionWake();
        break;
      case '2':
        const httpsHostname = await this.promptChoice('Enter hostname to check HTTPS availability: ');
        await this.actionHttps(httpsHostname);
        break;
      case '3':
        const pingHostname = await this.promptChoice('Enter hostname to ping: ');
        await this.actionPing(pingHostname);
        break;
      case '4':
        await this.actionCommand();
        break;
      case '5':
        console.log('👋 Goodbye!');
        return;
      default:
        console.log('❌ Invalid choice. Please try again.');
        await this.showInteractiveMenu();
    }
  }

  async promptChoice(question) {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
    });
  }

  async promptDeviceSelection(devices) {
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      rl.question('Select a device (enter number, or 0 to cancel): ', (answer) => {
        rl.close();
        
        const choice = parseInt(answer, 10);
        
        if (choice === 0) {
          resolve(null);
        } else if (choice >= 1 && choice <= devices.length) {
          resolve(devices[choice - 1]);
        } else {
          console.log('❌ Invalid selection');
          resolve(null);
        }
      });
    });
  }
}

// --- Entry Point ---

async function main() {
  const config = parseArgs();
  const client = new EncryptedAPIClient(config.baseUrl);
  client.config = config; // Store config for use in the client

  switch (config.action) {
    case 'wake':
      await client.actionWake();
      break;
    case 'https':
      await client.actionHttps(config.hostname);
      break;
    case 'ping':
      await client.actionPing(config.hostname);
      break;
    case 'command':
      if (config.hostname) {
        console.error('❌ --hostname parameter is not supported for command action. SSH connection details will be prompted interactively.');
        process.exit(1);
      }
      await client.actionCommand();
      break;
    case 'interactive':
    case null:
    default:
      await client.showInteractiveMenu();
      break;
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error('❌ Execution failed:', err.message);
    process.exit(1);
  });
}

module.exports = { EncryptedAPIClient };
