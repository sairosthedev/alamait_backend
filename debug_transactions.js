const mongoose = require('mongoose');
const TransactionEntry = require('./src/models/TransactionEntry');
const EnhancedPaymentAllocationService = require('./src/services/enhancedPaymentAllocationService');

// Connect to MongoDB Atlas cluster
mongoose.connect('mongodb+srv://macdonaldsairos24:macdonald24@cluster0.ulvve.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0')
  .then(async () => {
    console.log('Connected to MongoDB Atlas test database');
    
    const studentId = '68b3fac4c3f9d68481ea6972';
    console.log('🔍 Testing EnhancedPaymentAllocationService for student:', studentId);
    
    // Test the service directly
    try {
      const result = await EnhancedPaymentAllocationService.getDetailedOutstandingBalances(studentId);
      console.log(`\n📊 Service returned ${result.length} items:`);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('❌ Service error:', error);
    }
    
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Error:', err);
    mongoose.connection.close();
  });
