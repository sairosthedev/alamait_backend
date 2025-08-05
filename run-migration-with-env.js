// Set environment variable for MongoDB URI
process.env.MONGODB_URI = 'mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

console.log('🔧 Environment variable set:', process.env.MONGODB_URI ? 'MONGODB_URI is set' : 'MONGODB_URI is not set');

// Import and run the migration script
const path = require('path');
const migrationScript = require('./src/scripts/simpleMigrationScript.js');

console.log('🚀 Starting migration with environment variable...');
console.log('================================================');

// The migration script should now have access to the environment variable
// Let's run it directly
migrationScript.runSimpleMigration().catch(error => {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
}); 