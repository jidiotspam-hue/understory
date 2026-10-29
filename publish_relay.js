#!/usr/bin/env node
// publish_relay.js — writes relay.json: the current relay URL, encrypted with the
// vault passphrase (AES-256-GCM + PBKDF2, same format as data.js). The public repo
// never contains the tunnel URL in plaintext; the vault page decrypts it after unlock.
//
// usage: UNDERSTORY_PASS=... node publish_relay.js <relay-url> | --offline
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ITER = 250000;
const pass = process.env.UNDERSTORY_PASS;
const arg = process.argv[2];
if (!pass || !arg) {
  console.error('usage: UNDERSTORY_PASS=... node publish_relay.js <relay-url>|--offline');
  process.exit(1);
}

const b64 = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const payload = arg === '--offline'
  ? { url: null, ts: Date.now() }
  : { url: arg.endsWith('/') ? arg : arg + '/', ts: Date.now() };

const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(pass, salt, ITER, 32, 'sha256');
const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
const enc = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final(), cipher.getAuthTag()]);
const blob = b64(Buffer.concat([Buffer.from([2]), salt, iv, enc]));

fs.writeFileSync(path.join(__dirname, 'relay.json'), JSON.stringify({ relay: blob, v: 1 }) + '\n');
console.log(arg === '--offline' ? 'relay.json: marked offline' : 'relay.json: published');
