const TransactionEntry = require('../../models/TransactionEntry');
const Account = require('../../models/Account');

/**
 * Depreciation Controller
 * Handles recording monthly depreciation for fixed assets
 */
class DepreciationController {
    
    /**
     * Record monthly depreciation for a specific asset
     * POST /api/finance/depreciation/record
     */
    static async recordDepreciation(req, res) {
        try {
            const {
                assetAccountCode,
                depreciationAccountCode,
                monthlyDepreciationAmount,
                description,
                depreciationDate
            } = req.body;

            // Validate required fields
            if (!assetAccountCode || !depreciationAccountCode || !monthlyDepreciationAmount) {
                return res.status(400).json({
                    success: false,
                    message: 'Asset account code, depreciation account code, and monthly amount are required'
                });
            }

            // Validate accounts exist
            const assetAccount = await Account.findOne({ code: assetAccountCode });
            const depreciationAccount = await Account.findOne({ code: depreciationAccountCode });

            if (!assetAccount) {
                return res.status(404).json({
                    success: false,
                    message: `Asset account ${assetAccountCode} not found`
                });
            }

            if (!depreciationAccount) {
                return res.status(404).json({
                    success: false,
                    message: `Depreciation account ${depreciationAccountCode} not found`
                });
            }

            // Generate transaction ID
            const transactionId = `DEP-${assetAccountCode}-${Date.now()}`;
            const date = depreciationDate ? new Date(depreciationDate) : new Date();

            // Create depreciation transaction
            const transactionData = {
                transactionId,
                date,
                description: description || `Monthly depreciation - ${assetAccount.name}`,
                reference: `DEP-${assetAccountCode}`,
                entries: [
                    {
                        accountCode: '5015', // Depreciation Expense
                        accountName: 'Depreciation Expense',
                        accountType: 'Expense',
                        debit: monthlyDepreciationAmount,
                        credit: 0,
                        description: `Depreciation expense for ${assetAccount.name}`
                    },
                    {
                        accountCode: depreciationAccountCode,
                        accountName: depreciationAccount.name,
                        accountType: 'Asset',
                        debit: 0,
                        credit: monthlyDepreciationAmount,
                        description: `Accumulated depreciation for ${assetAccount.name}`
                    }
                ],
                totalDebit: monthlyDepreciationAmount,
                totalCredit: monthlyDepreciationAmount,
                source: 'manual',
                sourceId: assetAccount._id,
                sourceModel: 'Account',
                createdBy: req.user.email || 'system'
            };

            const transaction = new TransactionEntry(transactionData);
            await transaction.save();

            res.status(201).json({
                success: true,
                message: 'Depreciation recorded successfully',
                transaction: {
                    id: transaction._id,
                    transactionId: transaction.transactionId,
                    amount: monthlyDepreciationAmount,
                    assetAccount: assetAccount.name,
                    depreciationAccount: depreciationAccount.name,
                    date: transaction.date
                }
            });

        } catch (error) {
            console.error('Error recording depreciation:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to record depreciation',
                error: error.message
            });
        }
    }

    /**
     * Get depreciation schedule for an asset
     * GET /api/finance/depreciation/schedule?assetCode=1234
     */
    static async getDepreciationSchedule(req, res) {
        try {
            const { assetCode, startDate, endDate } = req.query;

            if (!assetCode) {
                return res.status(400).json({
                    success: false,
                    message: 'Asset code is required'
                });
            }

            // Build query
            const query = {
                'entries.accountCode': { $in: ['5015'] }, // Depreciation Expense
                source: 'manual',
                reference: { $regex: `^DEP-${assetCode}` }
            };

            if (startDate || endDate) {
                query.date = {};
                if (startDate) query.date.$gte = new Date(startDate);
                if (endDate) query.date.$lte = new Date(endDate);
            }

            const transactions = await TransactionEntry.find(query)
                .sort({ date: -1 })
                .select('transactionId date description totalDebit reference');

            // Calculate totals
            const totalDepreciation = transactions.reduce((sum, tx) => sum + tx.totalDebit, 0);

            res.json({
                success: true,
                assetCode,
                totalDepreciation,
                transactionCount: transactions.length,
                transactions
            });

        } catch (error) {
            console.error('Error getting depreciation schedule:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get depreciation schedule',
                error: error.message
            });
        }
    }

    /**
     * Get all fixed assets with their depreciation status
     * GET /api/finance/depreciation/assets
     */
    static async getFixedAssets(req, res) {
        try {
            // Get all fixed asset accounts
            const fixedAssets = await Account.find({
                type: 'Asset',
                category: 'Fixed Assets',
                isActive: true
            }).select('code name openingBalance openingBalanceDate');

            // Get accumulated depreciation for each asset
            const assetsWithDepreciation = await Promise.all(
                fixedAssets.map(async (asset) => {
                    // Find corresponding accumulated depreciation account
                    const depreciationAccount = await Account.findOne({
                        code: { $regex: `^140[0-9]` }, // 1400-1409 series
                        name: { $regex: asset.name, $options: 'i' }
                    });

                    // Calculate total depreciation recorded
                    const depreciationTransactions = await TransactionEntry.find({
                        'entries.accountCode': { $in: ['5015'] },
                        reference: { $regex: `^DEP-${asset.code}` }
                    });

                    const totalDepreciation = depreciationTransactions.reduce(
                        (sum, tx) => sum + tx.totalDebit, 0
                    );

                    const netBookValue = (asset.openingBalance || 0) - totalDepreciation;

                    return {
                        code: asset.code,
                        name: asset.name,
                        originalCost: asset.openingBalance || 0,
                        totalDepreciation,
                        netBookValue,
                        depreciationAccount: depreciationAccount ? {
                            code: depreciationAccount.code,
                            name: depreciationAccount.name
                        } : null
                    };
                })
            );

            res.json({
                success: true,
                assets: assetsWithDepreciation
            });

        } catch (error) {
            console.error('Error getting fixed assets:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get fixed assets',
                error: error.message
            });
        }
    }
}

module.exports = DepreciationController;




