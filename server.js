require('dotenv').config();
console.log('Loaded MONGODB_URI:', process.env.MONGODB_URI);
require('./src/index'); 