const db = require('../db/index.js');
const passkit = require('./passkit.js');
const templates = require('./templates.js');
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

async function runTest() {
  console.log('\n=== Nudj MVP Database & Pass Engine Test ===\n');

  try {
    // Step 1: Initialize database
    console.log('Step 1: Initializing database...');
    await db.getDb();
    console.log('✓ Database initialized\n');

    // Step 2: Create a brand
    console.log('Step 2: Creating brand "CASTELLI"...');
    const brand = db.createBrand({
      name: 'CASTELLI',
      slug: 'castelli',
      config: {
        colors: {
          primary: '#0D0B1A',
          accent: '#00D4AA'
        },
        website: 'https://castelli.com',
        contact: 'support@castelli.com'
      }
    });
    console.log(`✓ Brand created: ${brand.id}`);
    console.log(`  Name: ${brand.name}, Slug: ${brand.slug}\n`);

    // Step 3: Create a welcome offer template
    console.log('Step 3: Creating welcome offer template...');
    const welcomeTemplate = templates.welcomeOffer;
    const template = db.createTemplate({
      brand_id: brand.id,
      name: welcomeTemplate.name,
      pass_type: welcomeTemplate.pass_type,
      style: welcomeTemplate.style,
      fields: welcomeTemplate.fields,
      config: {
        expirationDate: '2026-12-31'
      }
    });
    console.log(`✓ Template created: ${template.id}`);
    console.log(`  Type: ${template.pass_type}, Fields: ${template.fields.length}\n`);

    // Step 4: Create a pass instance
    console.log('Step 4: Creating pass instance...');
    const passInstance = db.createPassInstance({
      template_id: template.id,
      brand_id: brand.id,
      customer_data: {
        name: 'Giovanni Rossi',
        email: 'giovanni@example.com',
        phone: '+39 3XX XXX XXXX'
      },
      field_values: {
        offer: '-20%',
        description: 'Sul tuo primo acquisto',
        expiry: '2026-12-31'
      }
    });
    console.log(`✓ Pass instance created: ${passInstance.id}`);
    console.log(`  Serial: ${passInstance.serial_number}`);
    console.log(`  Status: ${passInstance.status}\n`);

    // Step 5: Log an event
    console.log('Step 5: Logging event...');
    db.logEvent({
      pass_id: passInstance.id,
      brand_id: brand.id,
      event_type: 'created',
      device_id: null,
      metadata: {
        source: 'test',
        userAgent: 'test-script'
      }
    });
    console.log('✓ Event logged\n');

    // Step 6: Generate the .pkpass file
    console.log('Step 6: Generating .pkpass file...');
    const pkpassBuffer = await passkit.createPkpass(
      template,
      passInstance,
      brand,
      {
        baseUrl: 'http://localhost:3000',
        passTypeIdentifier: `pass.com.nudj.castelli`
      }
    );
    console.log(`✓ .pkpass generated (${pkpassBuffer.length} bytes)\n`);

    // Step 7: Create output directory and save the file
    console.log('Step 7: Saving .pkpass file...');
    const outputDir = path.join(__dirname, '../../test-output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputPath = path.join(outputDir, 'test.pkpass');
    fs.writeFileSync(outputPath, pkpassBuffer);
    console.log(`✓ File saved to: ${outputPath}\n`);

    // Step 8: Inspect the ZIP contents
    console.log('Step 8: Inspecting .pkpass contents...');
    const zip = new AdmZip(pkpassBuffer);
    const entries = zip.getEntries();
    console.log('✓ Files in .pkpass archive:');
    entries.forEach(entry => {
      const size = entry.getData().length;
      console.log(`  - ${entry.entryName} (${size} bytes)`);
    });
    console.log();

    // Step 9: Verify pass.json structure
    console.log('Step 9: Verifying pass.json structure...');
    const passJsonEntry = entries.find(e => e.entryName === 'pass.json');
    if (passJsonEntry) {
      const passJsonData = JSON.parse(passJsonEntry.getData().toString());
      console.log('✓ pass.json parsed successfully');
      console.log(`  - formatVersion: ${passJsonData.formatVersion}`);
      console.log(`  - organizationName: ${passJsonData.organizationName}`);
      console.log(`  - serialNumber: ${passJsonData.serialNumber}`);
      console.log(`  - passTypeIdentifier: ${passJsonData.passTypeIdentifier}`);
      console.log(`  - structure type: ${Object.keys(passJsonData).find(k => ['generic', 'coupon', 'storeCard', 'eventTicket', 'boardingPass'].includes(k))}`);
    }
    console.log();

    // Step 10: Get analytics
    console.log('Step 10: Retrieving analytics...');
    const analytics = db.getAnalytics(brand.id);
    console.log('✓ Analytics:');
    console.log(`  - Total passes: ${analytics.totalPasses}`);
    console.log(`  - By status: ${JSON.stringify(analytics.byStatus)}`);
    console.log(`  - Events: ${JSON.stringify(analytics.events)}`);
    console.log();

    console.log('=== TEST COMPLETED SUCCESSFULLY ===\n');
    console.log('Summary:');
    console.log(`- Brand: ${brand.name} (${brand.id})`);
    console.log(`- Template: ${template.name} (${template.id})`);
    console.log(`- Pass Instance: ${passInstance.id}`);
    console.log(`- .pkpass file: ${outputPath}`);
    console.log(`- Files in archive: ${entries.length}`);
    console.log();

  } catch (error) {
    console.error('\n✗ TEST FAILED:');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
runTest();
