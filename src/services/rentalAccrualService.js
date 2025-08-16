const Transaction = require('../models/Transaction');
const TransactionEntry = require('../models/TransactionEntry');
const Account = require('../models/Account');
const Invoice = require('../models/Invoice');
const mongoose = require('mongoose');

/**
 * Rental Accrual Service
 * 
 * Automatically records rental income when it becomes due (accrual basis)
 * Creates proper double-entry accounting entries for rent accruals
 * Manages student rent invoices and outstanding balances
 */
class RentalAccrualService {
    
    /**
     * Create monthly rent accrual for all active students
     * This records rent as income when it becomes due, not when paid
     */
    static async createMonthlyRentAccrual(month, year) {
        try {
            console.log(`🏠 Creating rent accruals for ${month}/${year}...`);
            
            // Get all active student applications for the month
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            
            // Find students with active leases for this month
            const activeStudents = await mongoose.connection.db
                .collection('applications')
                .find({
                    status: 'approved',
                    startDate: { $lte: endDate },      // Changed from leaseStartDate
                    endDate: { $gte: startDate },      // Changed from leaseEndDate
                    paymentStatus: { $ne: 'cancelled' }
                }).toArray();
            
            console.log(`Found ${activeStudents.length} active students for ${month}/${year}`);
            
            let accrualsCreated = 0;
            let errors = [];
            
            for (const student of activeStudents) {
                try {
                    const result = await this.createStudentRentAccrual(student, month, year);
                    if (result.success) {
                        accrualsCreated++;
                    } else {
                        errors.push({ student: student.firstName, error: result.error });
                    }
                } catch (error) {
                    errors.push({ student: student.firstName, error: error.message });
                }
            }
            
            console.log(`✅ Created ${accrualsCreated} rent accruals for ${month}/${year}`);
            if (errors.length > 0) {
                console.log(`⚠️ ${errors.length} errors occurred:`, errors);
            }
            
            return {
                success: true,
                accrualsCreated,
                errors,
                month,
                year
            };
            
        } catch (error) {
            console.error('❌ Error creating monthly rent accruals:', error);
            throw error;
        }
    }
    
    /**
     * Create rent accrual for a specific student
     */
    static async createStudentRentAccrual(student, month, year) {
        try {
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            
            // Check if accrual already exists for this month
            const existingAccrual = await TransactionEntry.findOne({
                'metadata.studentId': student._id,
                'metadata.accrualMonth': month,
                'metadata.accrualYear': year,
                'metadata.type': 'rent_accrual'
            });
            
            if (existingAccrual) {
                return { success: false, error: 'Accrual already exists for this month' };
            }
            
            // Calculate rent amount (assuming $200/month from your data)
            const rentAmount = 200;
            const adminFee = 20; // St Kilda admin fee
            const totalAmount = rentAmount + adminFee;
            
            // Get required accounts
            const accountsReceivable = await Account.findOne({ code: '1100' }); // Accounts Receivable - Tenants
            const rentalIncome = await Account.findOne({ code: '4000' }); // Rental Income - Residential
            const adminIncome = await Account.findOne({ code: '4100' }); // Administrative Income
            
            if (!accountsReceivable || !rentalIncome || !adminIncome) {
                throw new Error('Required accounts not found');
            }
            
            // Create transaction
            const transaction = new Transaction({
                transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                date: monthStart,
                description: `Rent accrual for ${student.firstName} ${student.lastName} - ${month}/${year}`,
                type: 'rental_accrual',
                status: 'posted',
                createdBy: 'system',
                metadata: {
                    studentId: student._id,
                    studentName: `${student.firstName} ${student.lastName}`,
                    residence: student.residence,
                    room: student.room,
                    accrualMonth: month,
                    accrualYear: year,
                    type: 'rent_accrual'
                }
            });
            
            await transaction.save();
            
            // Create double-entry accounting entries
            const entries = [
                // Debit: Accounts Receivable (Student owes money)
                {
                    accountCode: accountsReceivable.code,
                    accountName: accountsReceivable.name,
                    accountType: accountsReceivable.type,
                    debit: totalAmount,
                    credit: 0,
                    description: `Rent due from ${student.firstName} ${student.lastName} - ${month}/${year}`
                },
                // Credit: Rental Income
                {
                    accountCode: rentalIncome.code,
                    accountName: rentalIncome.name,
                    accountType: rentalIncome.type,
                    debit: 0,
                    credit: rentAmount,
                    description: `Rental income accrued - ${student.firstName} ${student.lastName} - ${month}/${year}`
                },
                // Credit: Administrative Income
                {
                    accountCode: adminIncome.code,
                    accountName: adminIncome.name,
                    accountType: adminIncome.type,
                    debit: 0,
                    credit: adminFee,
                    description: `Admin fee accrued - ${student.firstName} ${student.lastName} - ${month}/${year}`
                }
            ];
            
            // Create transaction entry
            const transactionEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: monthStart,
                description: `Rent accrual: ${student.firstName} ${student.lastName} - ${month}/${year}`,
                reference: student._id.toString(),
                entries,
                totalDebit: totalAmount,
                totalCredit: totalAmount,
                source: 'rental_accrual',
                sourceId: student._id,
                sourceModel: 'Application',
                createdBy: 'system',
                status: 'posted',
                metadata: {
                    studentId: student._id,
                    studentName: `${student.firstName} ${student.lastName}`,
                    residence: student.residence,
                    room: student.room,
                    accrualMonth: month,
                    accrualYear: year,
                    type: 'rent_accrual',
                    rentAmount,
                    adminFee,
                    totalAmount
                }
            });
            
            await transactionEntry.save();
            
            // Update transaction with entry reference
            transaction.entries = [transactionEntry._id];
            await transaction.save();
            
            // Create invoice for the student
            await this.createStudentInvoice(student, month, year, totalAmount, rentAmount, adminFee);
            
            console.log(`✅ Rent accrual created for ${student.firstName} ${student.lastName} - $${totalAmount}`);
            
            return {
                success: true,
                transactionId: transaction.transactionId,
                amount: totalAmount,
                student: `${student.firstName} ${student.lastName}`
            };
            
        } catch (error) {
            console.error(`❌ Error creating rent accrual for ${student.firstName}:`, error);
            return { success: false, error: error.message };
        }
    }
    
    /**
     * Create invoice for student rent
     */
    static async createStudentInvoice(student, month, year, totalAmount, rentAmount, adminFee) {
        try {
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            
            // Check if invoice already exists
            const existingInvoice = await Invoice.findOne({
                student: student._id,
                billingPeriod: `${year}-${month.toString().padStart(2, '0')}`,
                status: { $ne: 'cancelled' }
            });
            
            if (existingInvoice) {
                return existingInvoice; // Invoice already exists
            }
            
            // Generate invoice number
            const invoiceNumber = await this.generateInvoiceNumber();
            
            // Create invoice
            const invoice = new Invoice({
                invoiceNumber,
                student: student._id,
                residence: student.residence,
                room: student.room,
                billingPeriod: `${year}-${month.toString().padStart(2, '0')}`,
                billingStartDate: monthStart,
                billingEndDate: monthEnd,
                dueDate: new Date(year, month - 1, 5), // Due on 5th of month
                subtotal: totalAmount,
                totalAmount: totalAmount,
                balanceDue: totalAmount,
                charges: [
                    {
                        description: 'Monthly Rent',
                        amount: rentAmount,
                        quantity: 1,
                        total: rentAmount
                    },
                    {
                        description: 'Administrative Fee',
                        amount: adminFee,
                        quantity: 1,
                        total: adminFee
                    }
                ],
                status: 'sent',
                paymentStatus: 'unpaid',
                createdBy: 'system',
                metadata: {
                    type: 'monthly_rent',
                    month,
                    year,
                    rentAmount,
                    adminFee
                }
            });
            
            await invoice.save();
            console.log(`📄 Invoice created for ${student.firstName}: ${invoiceNumber}`);
            
            return invoice;
            
        } catch (error) {
            console.error('❌ Error creating student invoice:', error);
            throw error;
        }
    }
    
    /**
     * Generate unique invoice number
     */
    static async generateInvoiceNumber() {
        const year = new Date().getFullYear();
        const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
        
        // Get count of invoices for this month
        const count = await Invoice.countDocuments({
            billingPeriod: `${year}-${month}`
        });
        
        return `INV-${year}${month}-${(count + 1).toString().padStart(3, '0')}`;
    }
    
    /**
     * Get outstanding rent balances for all students
     */
    static async getOutstandingRentBalances(month = null, year = null) {
        try {
            // Get all active students from applications
            const activeStudents = await mongoose.connection.db
                .collection('applications')
                .find({
                    status: 'approved',
                    paymentStatus: { $ne: 'cancelled' }
                }).toArray();
            
            // Get all residences with room pricing
            const residences = await mongoose.connection.db
                .collection('residences')
                .find({}).toArray();
            
            // Create residence map for quick lookup
            const residenceMap = {};
            residences.forEach(residence => {
                residenceMap[residence._id.toString()] = residence;
            });
            
            // Get all payments from payments collection
            const payments = await mongoose.connection.db
                .collection('payments')
                .find({}).toArray();
            
            // Calculate outstanding balances by student
            const studentBalances = {};
            
            // Use current date if month/year not provided
            if (!month || !year) {
                const now = new Date();
                month = now.getMonth() + 1;
                year = now.getFullYear();
            }
            
            for (const student of activeStudents) {
                const studentId = student._id.toString();
                const studentName = `${student.firstName || 'Unknown'} ${student.lastName || 'Student'}`;
                
                // Calculate what should be owed (based on lease period)
                const leaseStart = new Date(student.startDate);
                const leaseEnd = new Date(student.endDate);
                const now = new Date();
                
                // Calculate for all approved students (including future leases)
                // Calculate months from lease start to now (or 0 if lease hasn't started)
                const monthsActive = Math.max(0, 
                    (now.getFullYear() - leaseStart.getFullYear()) * 12 + 
                    (now.getMonth() - leaseStart.getMonth())
                );
                
                // Get student's residence and room pricing
                const residenceId = student.residence?.toString();
                const residence = residenceMap[residenceId];
                const allocatedRoom = student.allocatedRoom || student.preferredRoom;
                
                let monthlyRent = 0;
                let monthlyAdminFee = 0;
                
                if (residence && allocatedRoom && residence.rooms) {
                    // Find the specific room in the residence
                    const roomData = residence.rooms.find(room => 
                        room.roomNumber === allocatedRoom || 
                        room.name === allocatedRoom ||
                        room._id?.toString() === allocatedRoom
                    );
                    
                    if (roomData && roomData.price) {
                        monthlyRent = roomData.price;
                        
                        // Billing structure based on residence:
                        if (residence.name.includes('St Kilda')) {
                            // St Kilda: Rent + Admin Fee (one-time) + Deposit (last month's rent)
                            const leaseStartMonth = new Date(student.startDate).getMonth() + 1;
                            const leaseStartYear = new Date(student.startDate).getFullYear();
                            
                            if (month === leaseStartMonth && year === leaseStartYear) {
                                monthlyAdminFee = 20; // Admin fee only in first month
                            } else {
                                monthlyAdminFee = 0; // No admin fee in subsequent months
                            }
                            
                            // Check if this is the last month of the lease (deposit = last month's rent)
                            const leaseEndMonth = new Date(student.endDate).getMonth() + 1;
                            const leaseEndYear = new Date(student.endDate).getFullYear();
                            
                            if (month === leaseEndMonth && year === leaseEndYear) {
                                // Last month is called "deposit" but amount is same as regular rent
                                // No change to monthlyRent - it stays the same
                            }
                            
                        } else if (residence.name.includes('Belvedere')) {
                            // Belvedere: Rent only (no admin, no deposit)
                            monthlyAdminFee = 0;
                            
                        } else {
                            // All other properties: Rent + Deposit (no admin fee)
                            monthlyAdminFee = 0;
                            
                            // Check if this is the last month of the lease (deposit = last month's rent)
                            const leaseEndMonth = new Date(student.endDate).getMonth() + 1;
                            const leaseEndYear = new Date(student.endDate).getFullYear();
                            
                            if (month === leaseEndMonth && year === leaseEndYear) {
                                // Last month is called "deposit" but amount is same as regular rent
                                // No change to monthlyRent - it stays the same
                            }
                        }
                    } else {
                        // Fallback pricing if room not found
                        monthlyRent = 200;
                        monthlyAdminFee = 0; // No admin fee in fallback
                    }
                } else {
                    // Fallback pricing if residence not found
                    monthlyRent = 200;
                    monthlyAdminFee = 0; // No admin fee in fallback
                }
                
                const totalShouldBeOwed = monthsActive * (monthlyRent + monthlyAdminFee);
                
                // Find payments for this student
                const studentPayments = payments.filter(payment => 
                    payment.student && payment.student.toString() === studentId
                );
                
                // Calculate total paid by payment type
                let totalRentPaid = 0;
                let totalAdminPaid = 0;
                let totalDepositPaid = 0;
                
                studentPayments.forEach(payment => {
                    if (payment.payments && Array.isArray(payment.payments)) {
                        payment.payments.forEach(subPayment => {
                            if (subPayment.type === 'rent') {
                                totalRentPaid += subPayment.amount || 0;
                            } else if (subPayment.type === 'admin') {
                                totalAdminPaid += subPayment.amount || 0;
                            } else if (subPayment.type === 'deposit') {
                                totalDepositPaid += subPayment.amount || 0;
                            }
                        });
                    }
                });
                
                const totalPaid = totalRentPaid + totalAdminPaid + totalDepositPaid;
                
                // Calculate outstanding balance
                const outstandingBalance = Math.max(0, totalShouldBeOwed - totalPaid);
                
                // Include all students regardless of outstanding balance
                studentBalances[studentId] = {
                    studentId,
                    studentName,
                    email: student.email || 'N/A',
                    residence: residence?.name || 'N/A',
                    room: allocatedRoom || 'N/A',
                    totalOutstanding: outstandingBalance,
                    totalShouldBeOwed,
                    totalPaid,
                    totalRentPaid,
                    totalAdminPaid,
                    totalDepositPaid,
                    monthsActive,
                    leaseStart: leaseStart.toDateString(),
                    leaseEnd: leaseEnd.toDateString(),
                    monthlyRent,
                    monthlyAdminFee,
                    roomType: residence?.rooms?.find(r => 
                        r.roomNumber === allocatedRoom || 
                        r.name === allocatedRoom ||
                        r._id?.toString() === allocatedRoom
                    )?.type || 'N/A',
                    payments: studentPayments.length,
                    oldestPayment: studentPayments.length > 0 ? 
                        new Date(Math.min(...studentPayments.map(p => new Date(p.paymentDate || p.createdAt)))) : null
                };
            }
            
            // Calculate summary
            const totalOutstanding = Object.values(studentBalances).reduce((sum, student) => sum + student.totalOutstanding, 0);
            const totalStudents = Object.keys(studentBalances).length;
            const overdueStudents = Object.values(studentBalances).filter(student => student.totalOutstanding > 0).length;
            
            return {
                students: Object.values(studentBalances),
                summary: {
                    totalOutstanding,
                    totalStudents,
                    overdueStudents,
                    averageOutstanding: totalStudents > 0 ? totalOutstanding / totalStudents : 0
                }
            };
            
        } catch (error) {
            console.error('❌ Error getting outstanding rent balances:', error);
            throw error;
        }
    }
    
    /**
     * Get rent accrual summary for a period
     */
    static async getRentAccrualSummary(month, year) {
        try {
            const monthStart = new Date(year, month - 1, 1);
            const monthEnd = new Date(year, month, 0);
            
            // Get active students for this month from applications collection
            const activeStudents = await mongoose.connection.db
                .collection('applications')
                .find({
                    status: 'approved',
                    startDate: { $lte: monthEnd },
                    endDate: { $gte: monthStart },
                    paymentStatus: { $ne: 'cancelled' }
                }).toArray();
            
            // Get all residences with room pricing
            const residences = await mongoose.connection.db
                .collection('residences')
                .find({}).toArray();
            
            // Create residence map for quick lookup
            const residenceMap = {};
            residences.forEach(residence => {
                residenceMap[residence._id.toString()] = residence;
            });
            
            let totalRentAccrued = 0;
            let totalAdminFeesAccrued = 0;
            let totalStudents = activeStudents.length;
            
            // Calculate what should be accrued for each student
            for (const student of activeStudents) {
                // Get student's residence and room pricing
                const residenceId = student.residence?.toString();
                const residence = residenceMap[residenceId];
                const allocatedRoom = student.allocatedRoom || student.preferredRoom;
                
                let rentAmount = 0;
                let adminFee = 0;
                
                if (residence && allocatedRoom && residence.rooms) {
                    // Find the specific room in the residence
                    const roomData = residence.rooms.find(room => 
                        room.roomNumber === allocatedRoom || 
                        room.name === allocatedRoom ||
                        room._id?.toString() === allocatedRoom
                    );
                    
                    if (roomData && roomData.price) {
                        rentAmount = roomData.price;
                        // Add admin fee based on residence type
                        if (residence.name.includes('St Kilda')) {
                            adminFee = 20; // $20/month for St Kilda
                        } else if (residence.name.includes('Belvedere')) {
                            adminFee = 25; // $25/month for Belvedere
                        } else if (residence.name.includes('Newlands')) {
                            adminFee = 15; // $15/month for Newlands
                        } else if (residence.name.includes('1ACP')) {
                            adminFee = 15; // $15/month for 1ACP
                        } else if (residence.name.includes('Fife Avenue')) {
                            adminFee = 30; // $30/month for Fife Avenue
                        } else {
                            adminFee = 20; // Default admin fee
                        }
                    } else {
                        // Fallback pricing if room not found
                        rentAmount = 200;
                        adminFee = 20;
                    }
                } else {
                    // Fallback pricing if residence not found
                    rentAmount = 200;
                    adminFee = 20;
                }
                
                totalRentAccrued += rentAmount;
                totalAdminFeesAccrued += adminFee;
            }
            
            // Check if accruals were actually created in TransactionEntry
            const existingAccruals = await TransactionEntry.find({
                'metadata.type': 'rent_accrual',
                'metadata.accrualMonth': month,
                'metadata.accrualYear': year,
                status: 'posted'
            });
            
            return {
                month,
                year,
                totalStudents,
                totalRentAccrued,
                totalAdminFeesAccrued,
                totalAmountAccrued: totalRentAccrued + totalAdminFeesAccrued,
                accruals: existingAccruals.length,
                accrualsCreated: existingAccruals.length > 0,
                pendingAccruals: totalStudents - existingAccruals.length
            };
            
        } catch (error) {
            console.error('❌ Error getting rent accrual summary:', error);
            throw error;
        }
    }
    
    /**
     * Get yearly summary of rent accruals
     */
    static async getYearlySummary(year) {
        try {
            // Get all active students for the year from applications
            const yearStart = new Date(year, 0, 1);
            const yearEnd = new Date(year, 11, 31);
            
            const activeStudents = await mongoose.connection.db
                .collection('applications')
                .find({
                    status: 'approved',
                    startDate: { $lte: yearEnd },
                    endDate: { $gte: yearStart },
                    paymentStatus: { $ne: 'cancelled' }
                }).toArray();
            
            let totalAmountAccrued = 0;
            let totalStudents = activeStudents.length;
            let monthlyBreakdown = [];
            
            // Calculate monthly breakdown
            for (let month = 1; month <= 12; month++) {
                const monthStart = new Date(year, month - 1, 1);
                const monthEnd = new Date(year, month - 1, 31);
                
                // Count students active in this month
                const studentsThisMonth = activeStudents.filter(student => {
                    const studentStart = new Date(student.startDate);
                    const studentEnd = new Date(student.endDate);
                    return studentStart <= monthEnd && studentEnd >= monthStart;
                });
                
                const monthlyRent = studentsThisMonth.length * 200; // $200 per student
                const monthlyAdminFees = studentsThisMonth.length * 20; // $20 per student
                const monthlyTotal = monthlyRent + monthlyAdminFees;
                
                totalAmountAccrued += monthlyTotal;
                
                monthlyBreakdown.push({
                    month,
                    monthName: new Date(year, month - 1, 1).toLocaleString('default', { month: 'long' }),
                    students: studentsThisMonth.length,
                    rentAmount: monthlyRent,
                    adminFees: monthlyAdminFees,
                    total: monthlyTotal
                });
            }
            
            return {
                year,
                totalAmountAccrued,
                totalStudents,
                monthlyBreakdown,
                averageMonthlyAccrual: totalAmountAccrued / 12
            };
            
        } catch (error) {
            console.error('❌ Error getting yearly summary:', error);
            throw error;
        }
    }
    
    /**
     * Reverse a rent accrual (for corrections)
     */
    static async reverseAccrual(transactionEntryId, user) {
        try {
            console.log(`🔄 Reversing rent accrual: ${transactionEntryId}`);
            
            const transactionEntry = await TransactionEntry.findById(transactionEntryId);
            if (!transactionEntry) {
                throw new Error('Transaction entry not found');
            }
            
            if (transactionEntry.metadata?.type !== 'rent_accrual') {
                throw new Error('Transaction entry is not a rent accrual');
            }
            
            // Create reversal transaction
            const transaction = new Transaction({
                transactionId: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
                date: new Date(),
                description: `Reversal of rent accrual: ${transactionEntry.description}`,
                type: 'rental_accrual_reversal',
                status: 'posted',
                createdBy: user.email || 'system',
                metadata: {
                    originalTransactionId: transactionEntry._id,
                    reversalType: 'rent_accrual',
                    originalAmount: transactionEntry.totalDebit,
                    studentId: transactionEntry.metadata.studentId,
                    studentName: transactionEntry.metadata.studentName,
                    month: transactionEntry.metadata.accrualMonth,
                    year: transactionEntry.metadata.accrualYear
                }
            });
            
            await transaction.save();
            
            // Create reversal transaction entry
            const reversalEntry = new TransactionEntry({
                transactionId: transaction.transactionId,
                date: new Date(),
                description: `Reversal: ${transactionEntry.description}`,
                reference: transactionEntry._id.toString(),
                entries: [
                    // Reverse the original entries
                    {
                        accountCode: transactionEntry.entries[0].accountCode, // Accounts Receivable
                        accountName: transactionEntry.entries[0].accountName,
                        accountType: transactionEntry.entries[0].accountType,
                        debit: 0, // Reverse: was debit, now credit
                        credit: transactionEntry.entries[0].debit, // Reverse: was debit, now credit
                        description: `Reversal: ${transactionEntry.entries[0].description}`
                    },
                    {
                        accountCode: transactionEntry.entries[1].accountCode, // Rental Income
                        accountName: transactionEntry.entries[0].accountName,
                        accountType: transactionEntry.entries[1].accountType,
                        debit: transactionEntry.entries[1].credit, // Reverse: was credit, now debit
                        credit: 0, // Reverse: was credit, now debit
                        description: `Reversal: ${transactionEntry.entries[1].description}`
                    },
                    {
                        accountCode: transactionEntry.entries[2].accountCode, // Admin Income
                        accountName: transactionEntry.entries[0].accountName,
                        accountType: transactionEntry.entries[2].accountType,
                        debit: transactionEntry.entries[2].credit, // Reverse: was credit, now debit
                        credit: 0, // Reverse: was credit, now debit
                        description: `Reversal: ${transactionEntry.entries[2].description}`
                    }
                ],
                totalDebit: transactionEntry.totalCredit,
                totalCredit: transactionEntry.totalDebit,
                source: 'rental_accrual_reversal',
                sourceId: transactionEntry._id,
                sourceModel: 'TransactionEntry',
                createdBy: user.email || 'system',
                status: 'posted',
                metadata: {
                    originalTransactionId: transactionEntry._id,
                    reversalType: 'rent_accrual',
                    originalAmount: transactionEntry.totalDebit,
                    studentId: transactionEntry.metadata.studentId,
                    studentName: transactionEntry.metadata.studentName,
                    month: transactionEntry.metadata.accrualMonth,
                    year: transactionEntry.metadata.accrualYear
                }
            });
            
            await reversalEntry.save();
            
            // Update transaction with entry reference
            transaction.entries = [reversalEntry._id];
            await transaction.save();
            
            console.log(`✅ Rent accrual reversed successfully`);
            
            return {
                success: true,
                originalTransactionId: transactionEntry._id,
                reversalTransactionId: transaction._id,
                reversedAmount: transactionEntry.totalDebit
            };
            
        } catch (error) {
            console.error('❌ Error reversing rent accrual:', error);
            throw error;
        }
    }
}

module.exports = RentalAccrualService;
