const http2 = require('http2');
const fs = require('fs');
const path = require('path');

// APNs endpoints
const APNS_PRODUCTION = 'https://api.push.apple.com';
const APNS_SANDBOX = 'https://api.sandbox.push.apple.com';
const APNS_INVALID_TOKEN_REASONS = new Set(['BadDeviceToken', 'DeviceTokenNotForTopic', 'Unregistered']);

// Default to production — Apple Wallet passes with Distribution certs use production APNs
const APNS_HOST = process.env.APNS_ENV === 'sandbox' ? APNS_SANDBOX : APNS_PRODUCTION;

/**
 * Send a push notification to an Apple Wallet pass device.
 *
 * Apple Wallet push is special: the payload is EMPTY.
 * It just tells the device "hey, go check for updates on this pass".
 * The device then calls your webServiceURL to get the updated .pkpass.
 *
 * We authenticate using the same pass signing certificate (PEM cert + key).
 */
async function sendPushUpdate(pushToken, options = {}) {
  const {
    certPath = process.env.CERT_PATH || path.join(__dirname, '../../certs/signerCert.pem'),
    keyPath = process.env.KEY_PATH || path.join(__dirname, '../../certs/signerKey.pem'),
    passTypeIdentifier = process.env.PASS_TYPE_IDENTIFIER || 'pass.com.nudj',
    host = APNS_HOST
  } = options;

  // Check if certs exist
  if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
    console.warn('⚠️ APNs: certificates not found, skipping push');
    return { success: false, reason: 'no_certs' };
  }

  return new Promise((resolve) => {
    try {
      const cert = fs.readFileSync(certPath);
      const key = fs.readFileSync(keyPath);

      const client = http2.connect(host, {
        cert,
        key,
        // Don't reject self-signed certs in dev
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      });

      client.on('error', (err) => {
        console.error('APNs connection error:', err.message);
        resolve({ success: false, reason: 'connection_error', error: err.message });
      });

      const headers = {
        ':method': 'POST',
        ':path': `/3/device/${pushToken}`,
        'apns-topic': passTypeIdentifier,
        // Empty push for Wallet pass updates
        'content-length': 2
      };

      const req = client.request(headers);

      let responseData = '';
      let statusCode;

      req.on('response', (headers) => {
        statusCode = headers[':status'];
      });

      req.on('data', (chunk) => {
        responseData += chunk;
      });

      req.on('end', () => {
        client.close();

        if (statusCode === 200) {
          console.log(`✓ APNs push sent to ${pushToken.substring(0, 8)}...`);
          resolve({ success: true, statusCode });
        } else {
          let reason = 'unknown';
          try {
            const parsed = JSON.parse(responseData);
            reason = parsed.reason || 'unknown';
          } catch (e) {
            reason = responseData || 'unknown';
          }
          console.warn(`⚠️ APNs push failed (${statusCode}): ${reason}`);
          resolve({ success: false, statusCode, reason });
        }
      });

      req.on('error', (err) => {
        client.close();
        console.error('APNs request error:', err.message);
        resolve({ success: false, reason: 'request_error', error: err.message });
      });

      // Wallet push payload is an empty JSON object
      req.write('{}');
      req.end();
    } catch (err) {
      console.error('APNs error:', err.message);
      resolve({ success: false, reason: 'exception', error: err.message });
    }
  });
}

function shouldPruneApnsRegistration(result) {
  if (!result || result.success) return false;
  const reason = String(result.reason || '').trim();
  return APNS_INVALID_TOKEN_REASONS.has(reason);
}

/**
 * Send push updates to ALL devices registered for a given pass serial number.
 *
 * @param {string} serialNumber - The pass serial number
 * @param {Function} getDevicesForPass - Function that returns [{push_token}] for a serial
 * @returns {Object} Summary of push results
 */
async function pushUpdateToAllDevices(serialNumber, getDevicesForPass) {
  try {
    const devices = await getDevicesForPass(serialNumber);

    if (!devices || devices.length === 0) {
      console.log(`ℹ️ No devices registered for pass ${serialNumber}`);
      return { sent: 0, total: 0, results: [] };
    }

    console.log(`📤 Sending push to ${devices.length} device(s) for pass ${serialNumber}`);

    const results = [];
    for (const device of devices) {
      const result = await sendPushUpdate(device.push_token);
      results.push({
        device_library_id: device.device_library_id,
        ...result
      });
    }

    const sent = results.filter(r => r.success).length;
    console.log(`✓ Push sent: ${sent}/${devices.length}`);

    return { sent, total: devices.length, results };
  } catch (err) {
    console.error('pushUpdateToAllDevices error:', err.message);
    return { sent: 0, total: 0, error: err.message };
  }
}

module.exports = {
  sendPushUpdate,
  pushUpdateToAllDevices,
  shouldPruneApnsRegistration
};
