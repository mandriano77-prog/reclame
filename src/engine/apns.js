const http2 = require('http2');
const fs = require('fs');
const path = require('path');

const APNS_PRODUCTION = 'https://api.push.apple.com';
const APNS_SANDBOX = 'https://api.sandbox.push.apple.com';
const APNS_INVALID_TOKEN_REASONS = new Set(['BadDeviceToken', 'DeviceTokenNotForTopic', 'Unregistered']);
const APNS_HOST = process.env.APNS_ENV === 'sandbox' ? APNS_SANDBOX : APNS_PRODUCTION;
const DEFAULT_CONCURRENCY = Math.max(1, Math.min(parseInt(process.env.APNS_PUSH_CONCURRENCY || '32', 10) || 32, 64));

let cachedMaterial = null;
let activeSession = null;
let activeSessionHost = null;

function getApnsMaterial(options = {}) {
  const certPath = options.certPath || process.env.CERT_PATH || path.join(__dirname, '../../certs/signerCert.pem');
  const keyPath = options.keyPath || process.env.KEY_PATH || path.join(__dirname, '../../certs/signerKey.pem');
  const passTypeIdentifier = options.passTypeIdentifier || process.env.PASS_TYPE_IDENTIFIER || 'pass.com.nudj';
  const host = options.host || APNS_HOST;

  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    return null;
  }

  if (!cachedMaterial || cachedMaterial.certPath !== certPath || cachedMaterial.keyPath !== keyPath) {
    cachedMaterial = {
      certPath,
      keyPath,
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
    };
  }

  return {
    ...cachedMaterial,
    passTypeIdentifier,
    host,
  };
}

function getOrCreateApnsSession(material) {
  if (activeSession && activeSessionHost === material.host && !activeSession.destroyed && !activeSession.closed) {
    return activeSession;
  }
  if (activeSession && !activeSession.destroyed) {
    try { activeSession.close(); } catch (_) {}
  }

  const client = http2.connect(material.host, {
    cert: material.cert,
    key: material.key,
    rejectUnauthorized: process.env.NODE_ENV === 'production',
  });

  client.on('error', (err) => {
    console.error('APNs session error:', err.message);
    if (activeSession === client) {
      activeSession = null;
      activeSessionHost = null;
    }
  });

  activeSession = client;
  activeSessionHost = material.host;
  return client;
}

function closeApnsSession() {
  if (activeSession && !activeSession.destroyed) {
    try { activeSession.close(); } catch (_) {}
  }
  activeSession = null;
  activeSessionHost = null;
}

function sendPushOnSession(client, pushToken, passTypeIdentifier) {
  return new Promise((resolve) => {
    const headers = {
      ':method': 'POST',
      ':path': `/3/device/${pushToken}`,
      'apns-topic': passTypeIdentifier,
      'content-length': 2,
    };

    const req = client.request(headers);
    let responseData = '';
    let statusCode;

    req.on('response', (h) => {
      statusCode = h[':status'];
    });

    req.on('data', (chunk) => {
      responseData += chunk;
    });

    req.on('end', () => {
      if (statusCode === 200) {
        resolve({ success: true, statusCode });
      } else {
        let reason = 'unknown';
        try {
          const parsed = JSON.parse(responseData);
          reason = parsed.reason || reason;
        } catch (_) {
          reason = responseData || reason;
        }
        resolve({ success: false, statusCode, reason });
      }
    });

    req.on('error', (err) => {
      resolve({ success: false, reason: 'request_error', error: err.message });
    });

    req.write('{}');
    req.end();
  });
}

/**
 * Send a push notification to an Apple Wallet pass device.
 * Wallet push payload is empty — device fetches updated pass from webServiceURL.
 */
async function sendPushUpdate(pushToken, options = {}) {
  const results = await sendPushBatch([pushToken], options);
  const result = results[0];
  if (!result) return { success: false, reason: 'no_result' };
  const { pushToken: _token, ...rest } = result;
  return rest;
}

/**
 * Send push updates in parallel over a shared HTTP/2 APNs session.
 */
async function sendPushBatch(pushTokens, options = {}) {
  const material = getApnsMaterial(options);
  const tokens = (pushTokens || []).filter(Boolean);
  if (!tokens.length) return [];

  if (!material) {
    console.warn('⚠️ APNs: certificates not found, skipping push');
    return tokens.map((pushToken) => ({ pushToken, success: false, reason: 'no_certs' }));
  }

  let client;
  try {
    client = getOrCreateApnsSession(material);
  } catch (err) {
    console.error('APNs connection error:', err.message);
    return tokens.map((pushToken) => ({
      pushToken,
      success: false,
      reason: 'connection_error',
      error: err.message,
    }));
  }

  const concurrency = Math.max(1, Math.min(options.concurrency || DEFAULT_CONCURRENCY, tokens.length));
  const results = new Array(tokens.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const index = cursor++;
      if (index >= tokens.length) break;
      const pushToken = tokens[index];
      try {
        const outcome = await sendPushOnSession(client, pushToken, material.passTypeIdentifier);
        results[index] = { pushToken, ...outcome };
        if (outcome.success) {
          console.log(`✓ APNs push sent to ${pushToken.substring(0, 8)}...`);
        } else {
          console.warn(`⚠️ APNs push failed: ${outcome.reason || 'unknown'}`);
        }
      } catch (err) {
        results[index] = { pushToken, success: false, reason: 'exception', error: err.message };
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

function shouldPruneApnsRegistration(result) {
  if (!result || result.success) return false;
  const reason = String(result.reason || '').trim();
  return APNS_INVALID_TOKEN_REASONS.has(reason);
}

async function pushUpdateToAllDevices(serialNumber, getDevicesForPass) {
  try {
    const devices = await getDevicesForPass(serialNumber);
    if (!devices || devices.length === 0) {
      console.log(`ℹ️ No devices registered for pass ${serialNumber}`);
      return { sent: 0, total: 0, results: [] };
    }

    console.log(`📤 Sending push to ${devices.length} device(s) for pass ${serialNumber}`);
    const batch = await sendPushBatch(devices.map((d) => d.push_token));
    const results = batch.map((result, i) => ({
      device_library_id: devices[i]?.device_library_id,
      ...result,
    }));
    const sent = results.filter((r) => r.success).length;
    console.log(`✓ Push sent: ${sent}/${devices.length}`);
    return { sent, total: devices.length, results };
  } catch (err) {
    console.error('pushUpdateToAllDevices error:', err.message);
    return { sent: 0, total: 0, error: err.message };
  }
}

module.exports = {
  sendPushUpdate,
  sendPushBatch,
  closeApnsSession,
  pushUpdateToAllDevices,
  shouldPruneApnsRegistration,
};
