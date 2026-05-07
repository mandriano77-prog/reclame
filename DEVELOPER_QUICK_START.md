# Nudj MVP - Developer Quick Start

> **Allineamento 2026:** lo stack live è **Node.js + PostgreSQL** (`pg`), deploy tipico **DigitalOcean** (App Platform o Droplet + DB gestito). Variabili, URL pubblici (`CUSTOM_DOMAIN`) e cron sono descritti in **`CLAUDE.md`**. Il contenuto qui sotto (SQLite / `data/nudj.db`) è **storico**: non riflette più il progetto nella cartella corrente; usalo solo come richiamo sul motore pass, non come guida allo stack.

## Overview

Il database e il motore Apple Wallet sono implementati in produzione con PostgreSQL. Questa guida contiene frammenti di integrazione, alcuni dei quali datano dall’uso di SQLite locale.

## File Structure

```
nudj-mvp/
├── src/
│   ├── db/
│   │   └── index.js (535 lines) - SQLite database layer
│   ├── engine/
│   │   ├── passkit.js (470 lines) - Apple Wallet .pkpass generator
│   │   ├── templates.js (306 lines) - Pre-built Italian templates
│   │   └── test.js (158 lines) - Comprehensive test suite
│   ├── api/
│   ├── dashboard/
│   └── ...
├── data/
│   └── nudj.db (persistent database)
├── test-output/
│   └── test.pkpass (example pass file)
├── certs/ (create for real Apple signing)
└── package.json
```

## Quick Start

### 1. Initialize Database

```javascript
const db = require('./src/db/index.js');

// Initialize (creates database and tables if needed)
await db.getDb();
console.log('✓ Database ready');
```

### 2. Create a Brand

```javascript
const brand = db.createBrand({
  name: 'Your Brand',
  slug: 'your-brand',
  config: {
    colors: {
      primary: '#0D0B1A',
      accent: '#00D4AA'
    }
  }
});

console.log(brand);
// {
//   id: 'uuid...',
//   name: 'Your Brand',
//   slug: 'your-brand',
//   config: {...}
// }
```

### 3. Create a Pass Template

```javascript
const templates = require('./src/engine/templates.js');

const template = db.createTemplate({
  brand_id: brand.id,
  name: templates.welcomeOffer.name,
  pass_type: templates.welcomeOffer.pass_type,
  style: templates.welcomeOffer.style,
  fields: templates.welcomeOffer.fields
});

console.log(template.id);
```

### 4. Create a Pass Instance

```javascript
const passInstance = db.createPassInstance({
  template_id: template.id,
  brand_id: brand.id,
  customer_data: {
    name: 'John Doe',
    email: 'john@example.com'
  },
  field_values: {
    offer: '-20%',
    description: 'First purchase discount'
  }
});

console.log(passInstance);
// {
//   id: 'uuid...',
//   serial_number: 'timestamp-random...',
//   status: 'active',
//   ...
// }
```

### 5. Generate .pkpass File

```javascript
const passkit = require('./src/engine/passkit.js');

const pkpassBuffer = await passkit.createPkpass(
  template,
  passInstance,
  brand,
  {
    baseUrl: 'https://your-domain.com',
    passTypeIdentifier: 'pass.com.nudj.your-brand'
  }
);

// Save to file
const fs = require('fs');
fs.writeFileSync('pass.pkpass', pkpassBuffer);
```

### 6. Log Events

```javascript
db.logEvent({
  pass_id: passInstance.id,
  brand_id: brand.id,
  event_type: 'created',
  metadata: {
    source: 'API'
  }
});
```

### 7. Get Analytics

```javascript
const analytics = db.getAnalytics(brand.id);
console.log(analytics);
// {
//   totalPasses: 1,
//   byStatus: { active: 1 },
//   events: { created: 1 }
// }
```

## API Integration Example

### Create Pass Endpoint (Express)

```javascript
const express = require('express');
const db = require('./src/db/index.js');
const passkit = require('./src/engine/passkit.js');
const app = express();

app.post('/api/v1/passes', async (req, res) => {
  try {
    const { brand_id, template_id, customer_data, field_values } = req.body;

    // Create pass instance
    const passInstance = db.createPassInstance({
      template_id,
      brand_id,
      customer_data,
      field_values
    });

    // Log event
    db.logEvent({
      pass_id: passInstance.id,
      brand_id,
      event_type: 'created',
      metadata: { source: 'API' }
    });

    // Generate .pkpass
    const brand = db.getBrand(brand_id);
    const template = db.getTemplate(template_id);
    
    const pkpassBuffer = await passkit.createPkpass(
      template,
      passInstance,
      brand,
      { baseUrl: process.env.BASE_URL }
    );

    res.type('application/vnd.apple.pkpass');
    res.send(pkpassBuffer);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(3000);
```

## Available Templates

All templates have Italian labels:

1. **welcomeOffer** - `-20%` discount coupon
2. **flashPromo** - Limited-time `-30%` promotion
3. **eventTicket** - Event/conference ticket with date & seat
4. **memberCard** - Store membership with tier level
5. **loyaltyCard** - Loyalty program with points
6. **boardingPass** - Travel/transit boarding pass
7. **generic** - Flexible multipurpose pass

### Use a Template

```javascript
const templates = require('./src/engine/templates.js');

// Access any template
const template = db.createTemplate({
  brand_id: brand.id,
  ...templates.flashPromo // Spread template config
});
```

## Database Operations

### Read Pass Instance

```javascript
// By ID
const pass = db.getPassInstance('pass-id');

// By Serial Number
const pass = db.getPassBySerial('1777058145062-14xh84pj3');
```

### Update Pass Instance

```javascript
const updated = db.updatePassInstance(pass.id, {
  status: 'redeemed',
  customer_data: { ...pass.customer_data, notes: 'Used' },
  field_values: { ...pass.field_values }
});
```

### Register Device for Push Notifications

```javascript
db.registerDevice({
  device_library_id: 'library-id-from-apple',
  push_token: 'token-from-apns',
  serial_number: passInstance.serial_number
});

// Get devices for a pass
const devices = db.getDevicesForPass(passInstance.serial_number);
// Returns: [{ device_library_id, push_token }, ...]
```

## Pass Signing

### Mock Mode (Development)

Currently, passes are generated in MOCK MODE. The signature file contains a placeholder. This is fine for development and testing.

```
⚠ MOCK MODE: pass not signed (install Apple certificate to enable)
```

### Real Signing (Production)

To enable real PKCS7 signing:

1. Get Apple Pass Certificate from Apple Developer account
2. Export certificates:
   ```bash
   mkdir certs
   # Export signerCert.pem and signerKey.pem
   ```
3. Optionally add WWDR Intermediate Certificate (wwdr.pem)
4. The engine will auto-detect and use real certificates

The engine checks for certificate files at:
- `certs/signerCert.pem`
- `certs/signerKey.pem`
- `certs/wwdr.pem` (optional)

## Running the Test

```bash
node src/engine/test.js
```

Output:
```
=== Nudj MVP Database & Pass Engine Test ===

Step 1: Initializing database...
✓ Database initialized

Step 2: Creating brand "CASTELLI"...
✓ Brand created: 9f2e85d3-1a6c-4f2b-88f0-e48a2b7c2617

...

=== TEST COMPLETED SUCCESSFULLY ===
```

## Pass Structure (pass.json)

The generated pass.json includes:

```json
{
  "formatVersion": 1,
  "passTypeIdentifier": "pass.com.nudj.castelli",
  "serialNumber": "1777058145062-14xh84pj3",
  "organizationName": "CASTELLI",
  "description": "Benvenuto",
  "foregroundColor": "#FFFFFF",
  "backgroundColor": "#0D0B1A",
  "labelColor": "#00D4AA",
  "coupon": {
    "primaryFields": [...],
    "secondaryFields": [...],
    "auxiliaryFields": [...]
  },
  "barcode": {
    "format": "PKBarcodeFormatQR",
    "message": "http://localhost:3000/pass/291707e0-46ae-4e3e-86e7-1089adeda479"
  },
  "authenticationToken": "...",
  "webServiceURL": "http://localhost:3000/api/v1"
}
```

## .pkpass Archive Contents

Every .pkpass file contains:

```
pass.pkpass
├── pass.json (pass definition)
├── icon.png (29x29px brand icon)
├── icon@2x.png (58x58px brand icon)
├── logo.png (160x50px brand logo)
├── logo@2x.png (320x100px brand logo)
├── strip.png (375x123px - coupon/storeCard only)
├── strip@2x.png (750x246px - coupon/storeCard only)
├── manifest.json (SHA1 hashes of all files)
└── signature (PKCS7 detached signature)
```

## Key Features

- **Synchronous database** - sql.js is fully synchronous
- **Persistent storage** - Data saved to `data/nudj.db`
- **Dynamic images** - Icons/logos generated from brand colors
- **Flexible fields** - Support for header, primary, secondary, auxiliary, back fields
- **Event logging** - Track pass creation, scans, redemptions
- **Device tracking** - Register devices for push notifications
- **Mock signing** - Ready for real Apple certificates
- **Italian templates** - All 7 pre-built templates use Italian labels

## Next Steps

- **Task 4**: Build REST API endpoints for pass management
- **Task 5**: Create landing page with "Add to Wallet" button
- **Task 6**: Build dashboard for brand management and analytics
- **Task 7**: Deploy with Apple certificates and push notifications

---

For questions or issues, refer to BUILD_SUMMARY.txt for detailed documentation.
