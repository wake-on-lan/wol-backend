#!/usr/bin/env node

const crypto = require('crypto');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

class ShellCommandClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.accessToken = null;
    this.clientKeyPair = null;
    this.serverPublicKey = null;
  }

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

  async login(username, password) {
    const res = await this.makeRequest('POST', '/auth/login', {
      username,
      password,
    });

    if (res.status === 201 && res.data.access_token) {
      this.accessToken = res.data.access_token;
      return res.data;
    }

    throw new Error(
      `Login failed: ${res.status} - ${JSON.stringify(res.data)}`,
    );
  }

  async getServerPublicKey() {
    const res = await this.makeRequest('GET', '/keys/server-public');

    if (res.status === 200) {
      this.serverPublicKey = res.data.publicKey;
    } else {
      throw new Error(
        `Failed to get server public key: ${res.status} - ${JSON.stringify(res.data)}`,
      );
    }
  }

  async registerPublicKey() {
    if (!this.clientKeyPair)
      throw new Error('Client key pair not generated yet');
    if (!this.serverPublicKey)
      throw new Error('Server public key not retrieved yet');

    const payload = { publicKey: this.clientKeyPair.publicKey };
    const res = await this.makeRequest('POST', '/keys/register', payload);

    if (res.status === 201) {
      return res.data;
    }

    throw new Error(
      `Failed to register public key: ${res.status} - ${JSON.stringify(res.data)}`,
    );
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

    throw new Error(
      `Shell command failed: ${res.status} - ${JSON.stringify(res.data)}`,
    );
  }
}

function showUsage() {
  console.log(`
Usage: node shell-command.js [options] --command "shell command"

Required:
  --command <cmd>    Shell command to execute

Connection Options:
  --host <host>      Target host (default: 127.0.0.1)
  --port <port>      SSH port (default: 22)
  --user <user>      SSH username (default: admin)

Authentication (choose one):
  --password <pass>  SSH password
  --key <path>       Path to private key file (default: ../privateKeys/wakeonlan.key)

API Options:
  --server <url>     Server URL (default: http://localhost:3000)
  --api-user <user>  API username (default: admin)
  --api-pass <pass>  API password (default: admin123)
  --help             Show this help message

Examples:
  node shell-command.js --command "ls -la ~"
  node shell-command.js --command "df -h" --password mypassword
  node shell-command.js --command "ps aux" --host 192.168.1.100 --user myuser --key /path/to/key
`);
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    command: null,
    host: '127.0.0.1',
    port: 22,
    user: 'admin',
    password: null,
    keyPath: path.join(__dirname, '../privateKeys/wakeonlan.key'),
    server: 'http://localhost:3000',
    apiUser: 'admin',
    apiPass: 'admin123',
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--command':
        options.command = args[++i];
        break;
      case '--host':
        options.host = args[++i];
        break;
      case '--port':
        options.port = parseInt(args[++i]);
        break;
      case '--user':
        options.user = args[++i];
        break;
      case '--password':
        options.password = args[++i];
        break;
      case '--key':
        options.keyPath = args[++i];
        break;
      case '--server':
        options.server = args[++i];
        break;
      case '--api-user':
        options.apiUser = args[++i];
        break;
      case '--api-pass':
        options.apiPass = args[++i];
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

async function main() {
  const options = parseArgs();

  if (!options.command) {
    console.error('❌ --command is required');
    showUsage();
    process.exit(1);
  }

  // Validate authentication method
  if (!options.password && !fs.existsSync(options.keyPath)) {
    console.error(
      `❌ Either --password or valid key file at ${options.keyPath} is required`,
    );
    process.exit(1);
  }

  try {
    const client = new ShellCommandClient(options.server);

    console.log('🔐 Authenticating with API...');
    await client.login(options.apiUser, options.apiPass);

    console.log('🔑 Setting up encryption...');
    client.generateClientKeyPair();
    await client.getServerPublicKey();
    await client.registerPublicKey();

    // Prepare shell command payload
    const shellCommand = {
      host: options.host,
      port: options.port,
      user: options.user,
      command: options.command,
    };

    // Add authentication method
    if (options.password) {
      shellCommand.password = options.password;
      console.log(`💻 Executing: ${options.command} (using password auth)`);
    } else {
      shellCommand.privateKey = fs.readFileSync(options.keyPath, 'base64');
      console.log(`💻 Executing: ${options.command} (using key auth)`);
    }

    console.log(`📡 Target: ${options.user}@${options.host}:${options.port}`);

    const result = await client.sendShellCommand(shellCommand);
    if (!result.success && result.exitStatus !== 0) {
      console.error('❌ Command execution failed');
      console.error('Error:', result.message);
      process.exit(result.exitStatus);
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

    process.exit(result.exitStatus || 0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

main();
