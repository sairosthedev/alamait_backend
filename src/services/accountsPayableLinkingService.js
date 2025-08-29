const Account = require('../models/Account');

/**
 * Accounts Payable Linking Service
 * 
 * Ensures all Accounts Payable accounts are properly linked to the main
 * Accounts Payable parent account (2000) for proper balance sheet aggregation.
 */
class AccountsPayableLinkingService {
    
    /**
     * Ensure an Accounts Payable account is linked to the main parent account (2000)
     * @param {string} accountCode - The account code to link
     * @param {string} accountName - The account name
     * @param {Object} vendor - Optional vendor object for metadata
     * @returns {Promise<Object>} The linked account
     */
    static async ensureAccountsPayableLink(accountCode, accountName, vendor = null) {
        try {
            // Get the main Accounts Payable account (2000)
            const mainAPAccount = await Account.findOne({ code: '2000', type: 'Liability' });
            if (!mainAPAccount) {
                console.error('❌ Main Accounts Payable account (2000) not found');
                throw new Error('Main Accounts Payable account (2000) not found');
            }
            
            // Find or create the specific Accounts Payable account
            let apAccount = await Account.findOne({ code: accountCode });
            
            if (!apAccount) {
                // Create new account
                apAccount = new Account({
                    code: accountCode,
                    name: accountName,
                    type: 'Liability',
                    category: 'Current Liabilities',
                    subcategory: 'Accounts Payable',
                    description: `Payable account for ${accountName}`,
                    isActive: true,
                    level: 2, // Child of main AP account
                    parentAccount: mainAPAccount._id,
                    metadata: {
                        linkedToMainAP: true,
                        linkedDate: new Date(),
                        mainAPAccountCode: '2000',
                        ...(vendor && {
                            vendorId: vendor._id,
                            vendorCode: vendor.vendorCode,
                            vendorType: vendor.category
                        })
                    }
                });
                await apAccount.save();
                
                console.log(`✅ Created and linked AP account: ${accountCode} - ${accountName} to 2000`);
            } else {
                // Check if already linked to 2000
                if (!apAccount.parentAccount || apAccount.parentAccount.toString() !== mainAPAccount._id.toString()) {
                    // Link to main AP account
                    apAccount.parentAccount = mainAPAccount._id;
                    apAccount.level = 2;
                    apAccount.metadata = {
                        ...apAccount.metadata,
                        linkedToMainAP: true,
                        linkedDate: new Date(),
                        mainAPAccountCode: '2000',
                        ...(vendor && {
                            vendorId: vendor._id,
                            vendorCode: vendor.vendorCode,
                            vendorType: vendor.category
                        })
                    };
                    await apAccount.save();
                    
                    console.log(`✅ Linked existing AP account: ${accountCode} - ${accountName} to 2000`);
                } else {
                    console.log(`ℹ️ AP account already linked: ${accountCode} - ${accountName}`);
                }
            }
            
            // Update main AP account metadata - ensure childrenCount is numeric
            const currentMetadata = mainAPAccount.metadata || {};
            const currentChildrenCount = typeof currentMetadata.childrenCount === 'number' ? currentMetadata.childrenCount : 0;
            
            await Account.findByIdAndUpdate(mainAPAccount._id, {
                $set: {
                    'metadata.hasChildren': true,
                    'metadata.lastUpdated': new Date(),
                    'metadata.childrenCount': currentChildrenCount + 1
                }
            });
            
            return apAccount;
            
        } catch (error) {
            console.error('❌ Error ensuring Accounts Payable link:', error);
            throw error;
        }
    }
    
    /**
     * Fix all existing Accounts Payable accounts to ensure they're linked to 2000
     * @returns {Promise<Object>} Summary of the fix operation
     */
    static async fixAllAccountsPayableLinks() {
        try {
            console.log('🔧 Fixing all Accounts Payable account links...');
            
            // Get the main Accounts Payable account (2000)
            const mainAPAccount = await Account.findOne({ code: '2000', type: 'Liability' });
            if (!mainAPAccount) {
                throw new Error('Main Accounts Payable account (2000) not found');
            }
            
            // Find all accounts that should be children of 2000
            const potentialChildren = await Account.find({
                code: { $regex: '^2000', $ne: '2000' },
                type: 'Liability',
                isActive: true
            });
            
            let linkedCount = 0;
            let alreadyLinkedCount = 0;
            
            for (const childAccount of potentialChildren) {
                // Check if already linked to 2000
                if (childAccount.parentAccount && childAccount.parentAccount.toString() === mainAPAccount._id.toString()) {
                    alreadyLinkedCount++;
                    continue;
                }
                
                // Link to 2000
                await Account.updateOne(
                    { _id: childAccount._id },
                    { 
                        parentAccount: mainAPAccount._id,
                        level: 2,
                        'metadata.linkedToMainAP': true,
                        'metadata.linkedDate': new Date(),
                        'metadata.mainAPAccountCode': '2000'
                    }
                );
                
                linkedCount++;
                console.log(`✅ Linked: ${childAccount.code} - ${childAccount.name}`);
            }
            
            const summary = {
                totalAccounts: potentialChildren.length,
                alreadyLinked: alreadyLinkedCount,
                newlyLinked: linkedCount,
                totalFixed: linkedCount
            };
            
            console.log('📊 Summary:', summary);
            return summary;
            
        } catch (error) {
            console.error('❌ Error fixing Accounts Payable links:', error);
            throw error;
        }
    }
    
    /**
     * Get all children of the main Accounts Payable account (2000)
     * @returns {Promise<Array>} Array of child accounts
     */
    static async getAccountsPayableChildren() {
        try {
            const mainAPAccount = await Account.findOne({ code: '2000', type: 'Liability' });
            if (!mainAPAccount) {
                return [];
            }
            
            return await Account.find({ 
                parentAccount: mainAPAccount._id,
                isActive: true 
            }).sort({ code: 1 });
            
        } catch (error) {
            console.error('❌ Error getting Accounts Payable children:', error);
            return [];
        }
    }
    
    /**
     * Validate that all Accounts Payable accounts are properly linked
     * @returns {Promise<Object>} Validation results
     */
    static async validateAccountsPayableLinks() {
        try {
            const mainAPAccount = await Account.findOne({ code: '2000', type: 'Liability' });
            if (!mainAPAccount) {
                return { valid: false, error: 'Main Accounts Payable account (2000) not found' };
            }
            
            // Find all AP accounts that should be linked
            const allAPAccounts = await Account.find({
                code: { $regex: '^2000', $ne: '2000' },
                type: 'Liability',
                isActive: true
            });
            
            const linkedAccounts = allAPAccounts.filter(account => 
                account.parentAccount && account.parentAccount.toString() === mainAPAccount._id.toString()
            );
            
            const unlinkedAccounts = allAPAccounts.filter(account => 
                !account.parentAccount || account.parentAccount.toString() !== mainAPAccount._id.toString()
            );
            
            return {
                valid: unlinkedAccounts.length === 0,
                totalAccounts: allAPAccounts.length,
                linkedAccounts: linkedAccounts.length,
                unlinkedAccounts: unlinkedAccounts.length,
                unlinkedAccountCodes: unlinkedAccounts.map(acc => acc.code)
            };
            
        } catch (error) {
            console.error('❌ Error validating Accounts Payable links:', error);
            return { valid: false, error: error.message };
        }
    }
}

module.exports = AccountsPayableLinkingService;
