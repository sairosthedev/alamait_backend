const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Application = require('../src/models/Application');

async function checkApplicationSchema() {
  try {
    console.log('🔍 Checking Application schema...\n');
    
    // Connect to database
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to database\n');
    
    // Get the schema
    const schema = Application.schema;
    console.log('📋 Application Schema Paths:');
    
    Object.keys(schema.paths).forEach(path => {
      const schemaType = schema.paths[path];
      console.log(`   ${path}: ${schemaType.instance || schemaType.constructor.name}`);
    });
    
    // Check current application document
    console.log('\n📋 Current Application Document:');
    const app = await Application.findOne({});
    if (app) {
      console.log('Application found:', JSON.stringify(app, null, 2));
    } else {
      console.log('No applications found');
    }
    
  } catch (error) {
    console.error('❌ Error checking schema:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Disconnected from database');
  }
}

// Run the script
checkApplicationSchema();





