const mongoose = require('mongoose');
require('dotenv').config();

async function checkAccountCodes() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        const Debtor = require('./src/models/Debtor');
        const Account = require('./src/models/Account');
        
        const debtors = await Debtor.find({});
        console.log('\n📊 Debtor Account Codes:');
        debtors.forEach(d => console.log(`${d.debtorCode}: ${d.accountCode}`));
        
        const accounts = await Account.find({});
        console.log('\n📊 Existing Account Codes:');
        accounts.forEach(a => console.log(`${a.code}: ${a.name}`));
        
        await mongoose.disconnect();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkAccountCodes();
