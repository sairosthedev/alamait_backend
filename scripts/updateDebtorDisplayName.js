/**
 * One-off: Update display name for a debtor/AR account.
 * Usage: node scripts/updateDebtorDisplayName.js [accountCode] [displayName]
 * Example: node scripts/updateDebtorDisplayName.js 1100-69705d09d17f45d7f8c4dc4e "Tishan Chakweza"
 */

const mongoose = require('mongoose');
require('dotenv').config();

const Account = require('../src/models/Account');
const Debtor = require('../src/models/Debtor');

const AR_CODE = process.argv[2] || '1100-69705d09d17f45d7f8c4dc4e';
const DISPLAY_NAME = process.argv[3] || 'Tishan Chakweza';

async function run() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
        console.log('Connected to database\n');

        if (!AR_CODE.startsWith('1100-')) {
            console.error('Account code must be in format 1100-<debtorId>');
            process.exit(1);
        }

        const debtorId = AR_CODE.replace('1100-', '');
        if (!mongoose.Types.ObjectId.isValid(debtorId)) {
            console.error('Invalid debtor ID in account code:', debtorId);
            process.exit(1);
        }

        const accountName = `Accounts Receivable - ${DISPLAY_NAME.trim()}`;

        const account = await Account.findOne({ code: AR_CODE });
        if (account) {
            await Account.updateOne({ code: AR_CODE }, { $set: { name: accountName } });
            console.log('Updated Account:', AR_CODE, '-> name:', accountName);
        } else {
            console.log('No Account found with code:', AR_CODE);
        }

        const debtor = await Debtor.findById(debtorId);
        if (debtor) {
            await Debtor.updateOne(
                { _id: new mongoose.Types.ObjectId(debtorId) },
                { $set: { 'contactInfo.name': DISPLAY_NAME.trim() } }
            );
            console.log('Updated Debtor:', debtorId, '-> contactInfo.name:', DISPLAY_NAME.trim());
        } else {
            console.log('No Debtor found with _id:', debtorId);
        }

        console.log('\nDone.');
    } catch (err) {
        console.error(err);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
    }
}

run();
