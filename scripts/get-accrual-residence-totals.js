require('dotenv').config();
const mongoose = require('mongoose');
const RentalAccrualService = require('../src/services/rentalAccrualService');

async function getAccrualResidenceTotals() {
    try {
        // Connect to MongoDB using the same method as your server
        if (!process.env.MONGODB_URI) {
            console.log('❌ MONGODB_URI not found in environment variables');
            return;
        }
        
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        console.log('\n📊 Getting Accrual Residence Totals and Collections...');
        console.log('=====================================================');
        
        const currentYear = new Date().getFullYear();
        const currentMonth = new Date().getMonth() + 1;
        
        console.log(`\n📅 Current Period: ${currentMonth}/${currentYear}`);
        
        // Get outstanding balances with residence breakdown
        console.log('\n1️⃣ Getting Outstanding Balances by Residence...');
        try {
            const outstandingBalances = await RentalAccrualService.getOutstandingRentBalances();
            
            if (outstandingBalances.students.length > 0) {
                // Group by residence
                const residenceTotals = {};
                
                outstandingBalances.students.forEach(student => {
                    const residence = student.residence || 'Unknown';
                    if (!residenceTotals[residence]) {
                        residenceTotals[residence] = {
                            students: [],
                            totalOutstanding: 0,
                            totalMonthlyRent: 0,
                            totalMonthlyAdminFees: 0,
                            totalCollected: 0,
                            totalShouldBeOwed: 0
                        };
                    }
                    
                    residenceTotals[residence].students.push(student);
                    residenceTotals[residence].totalOutstanding += student.totalOutstanding;
                    residenceTotals[residence].totalMonthlyRent += student.monthlyRent;
                    residenceTotals[residence].totalMonthlyAdminFees += student.monthlyAdminFee;
                    residenceTotals[residence].totalShouldBeOwed += student.totalShouldBeOwed;
                    residenceTotals[residence].totalCollected += student.totalPaid;
                 // Also track by payment type if available
                 if (student.totalRentPaid !== undefined) {
                     if (!residenceTotals[residence].totalRentCollected) residenceTotals[residence].totalRentCollected = 0;
                     if (!residenceTotals[residence].totalAdminCollected) residenceTotals[residence].totalAdminCollected = 0;
                     if (!residenceTotals[residence].totalDepositCollected) residenceTotals[residence].totalDepositCollected = 0;
                     residenceTotals[residence].totalRentCollected += student.totalRentPaid;
                     residenceTotals[residence].totalAdminCollected += student.totalAdminPaid;
                     residenceTotals[residence].totalDepositCollected += student.totalDepositPaid;
                 }
                });
                
                console.log('\n🏢 Residence Breakdown:');
                Object.keys(residenceTotals).forEach(residence => {
                    const totals = residenceTotals[residence];
                    console.log(`\n   🏢 ${residence}:`);
                    console.log(`      👥 Students: ${totals.students.length}`);
                    console.log(`      🏠 Total Monthly Rent: $${totals.totalMonthlyRent}`);
                    console.log(`      📋 Total Monthly Admin Fees: $${totals.totalMonthlyAdminFees}`);
                    console.log(`      💰 Total Monthly: $${totals.totalMonthlyRent + totals.totalMonthlyAdminFees}`);
                    console.log(`      📈 Total Should Be Owed: $${totals.totalShouldBeOwed}`);
                                         console.log(`      💵 Total Collected: $${totals.totalCollected}`);
                     if (totals.totalRentCollected !== undefined) {
                         console.log(`         🏠 Rent Collected: $${totals.totalRentCollected}`);
                         console.log(`         📋 Admin Collected: $${totals.totalAdminCollected}`);
                         console.log(`         💰 Deposit Collected: $${totals.totalDepositCollected}`);
                     }
                    console.log(`      ❌ Total Outstanding: $${totals.totalOutstanding}`);
                    
                    // Show individual students
                    totals.students.forEach(student => {
                        console.log(`\n         👤 ${student.studentName}`);
                        console.log(`            Room: ${student.room} (${student.roomType})`);
                        console.log(`            Monthly: $${student.monthlyRent} + $${student.monthlyAdminFee} = $${student.monthlyRent + student.monthlyAdminFee}`);
                        console.log(`            Months Active: ${student.monthsActive}`);
                        console.log(`            Should Owe: $${student.totalShouldBeOwed}`);
                                                 console.log(`            Collected: $${student.totalPaid}`);
                         if (student.totalRentPaid !== undefined) {
                             console.log(`               🏠 Rent: $${student.totalRentPaid}`);
                             console.log(`               📋 Admin: $${student.totalAdminPaid}`);
                             console.log(`               💰 Deposit: $${student.totalDepositPaid}`);
                         }
                        console.log(`            Outstanding: $${student.totalOutstanding}`);
                    });
                });
                
                // Overall totals
                const overallTotals = {
                    totalStudents: outstandingBalances.students.length,
                    totalMonthlyRent: Object.values(residenceTotals).reduce((sum, r) => sum + r.totalMonthlyRent, 0),
                    totalMonthlyAdminFees: Object.values(residenceTotals).reduce((sum, r) => sum + r.totalMonthlyAdminFees, 0),
                    totalShouldBeOwed: Object.values(residenceTotals).reduce((sum, r) => sum + r.totalShouldBeOwed, 0),
                    totalCollected: Object.values(residenceTotals).reduce((sum, r) => sum + r.totalCollected, 0),
                    totalOutstanding: Object.values(residenceTotals).reduce((sum, r) => sum + r.totalOutstanding, 0)
                };
                
                console.log('\n📊 OVERALL TOTALS:');
                console.log('==================');
                console.log(`👥 Total Students: ${overallTotals.totalStudents}`);
                console.log(`🏠 Total Monthly Rent: $${overallTotals.totalMonthlyRent}`);
                console.log(`📋 Total Monthly Admin Fees: $${overallTotals.totalMonthlyAdminFees}`);
                console.log(`💰 Total Monthly: $${overallTotals.totalMonthlyRent + overallTotals.totalMonthlyAdminFees}`);
                console.log(`📈 Total Should Be Owed: $${overallTotals.totalShouldBeOwed}`);
                console.log(`💵 Total Collected: $${overallTotals.totalCollected}`);
                console.log(`❌ Total Outstanding: $${overallTotals.totalOutstanding}`);
                
            } else {
                console.log('   ❌ No students with outstanding balances found');
            }
            
        } catch (error) {
            console.log('   ❌ Failed:', error.message);
        }
        
        // Get monthly summary
        console.log('\n2️⃣ Getting Monthly Accrual Summary...');
        try {
            const monthlySummary = await RentalAccrualService.getRentAccrualSummary(currentMonth, currentYear);
            console.log('   ✅ Monthly Summary:');
            console.log(`      Month: ${monthlySummary.month}/${monthlySummary.year}`);
            console.log(`      Total Students: ${monthlySummary.totalStudents}`);
            console.log(`      Total Rent Accrued: $${monthlySummary.totalRentAccrued}`);
            console.log(`      Total Admin Fees Accrued: $${monthlySummary.totalAdminFeesAccrued}`);
            console.log(`      Total Amount Accrued: $${monthlySummary.totalAmountAccrued}`);
            console.log(`      Accruals Created: ${monthlySummary.accrualsCreated}`);
            console.log(`      Pending Accruals: ${monthlySummary.pendingAccruals}`);
            
        } catch (error) {
            console.log('   ❌ Failed:', error.message);
        }
        
        // Get detailed student information with collections
        console.log('\n3️⃣ Getting Detailed Student Collections by Residence...');
        try {
            const activeStudents = await mongoose.connection.db
                .collection('applications')
                .find({
                    status: 'approved',
                    startDate: { $lte: new Date(currentYear, currentMonth, 0) },
                    endDate: { $gte: new Date(currentYear, currentMonth - 1, 1) },
                    paymentStatus: { $ne: 'cancelled' }
                }).toArray();
            
            const residences = await mongoose.connection.db
                .collection('residences')
                .find({}).toArray();
            
            const residenceMap = {};
            residences.forEach(residence => {
                residenceMap[residence._id.toString()] = residence;
            });
            
            // Get payments for all students
            const payments = await mongoose.connection.db
                .collection('payments')
                .find({}).toArray();
            
            // Group students by residence with collection details
            const studentsByResidence = {};
            
            activeStudents.forEach(student => {
                const residenceId = student.residence?.toString();
                const residenceName = residenceMap[residenceId]?.name || 'Unknown';
                const allocatedRoom = student.allocatedRoom || student.preferredRoom;
                
                if (!studentsByResidence[residenceName]) {
                    studentsByResidence[residenceName] = [];
                }
                
                // Find room pricing
                let roomRent = 0;
                let roomAdminFee = 0;
                
                if (residenceMap[residenceId] && residenceMap[residenceId].rooms) {
                    const roomData = residenceMap[residenceId].rooms.find(room => 
                        room.roomNumber === allocatedRoom || 
                        room.name === allocatedRoom ||
                        room._id?.toString() === allocatedRoom
                    );
                    
                    if (roomData && roomData.price) {
                        roomRent = roomData.price;
                        // Add admin fee based on residence type
                        if (residenceName.includes('St Kilda')) {
                            roomAdminFee = 20;
                        } else if (residenceName.includes('Belvedere')) {
                            roomAdminFee = 25;
                        } else if (residenceName.includes('Newlands')) {
                            roomAdminFee = 15;
                        } else if (residenceName.includes('1ACP')) {
                            roomAdminFee = 15;
                        } else if (residenceName.includes('Fife Avenue')) {
                            roomAdminFee = 30;
                        } else {
                            roomAdminFee = 20;
                        }
                    }
                }
                
                // Find payments for this student
                const studentPayments = payments.filter(payment => 
                    payment.student && payment.student.toString() === student._id.toString()
                );
                
                const totalCollected = studentPayments.reduce((sum, payment) => {
                    return sum + (payment.totalAmount || 0);
                }, 0);
                
                // Calculate what should be owed
                const leaseStart = new Date(student.startDate);
                const now = new Date();
                const monthsActive = Math.max(0, 
                    (now.getFullYear() - leaseStart.getFullYear()) * 12 + 
                    (now.getMonth() - leaseStart.getMonth())
                );
                
                const totalShouldBeOwed = monthsActive * (roomRent + roomAdminFee);
                const outstandingBalance = Math.max(0, totalShouldBeOwed - totalCollected);
                
                studentsByResidence[residenceName].push({
                    student: `${student.firstName} ${student.lastName}`,
                    room: allocatedRoom,
                    roomRent,
                    roomAdminFee,
                    totalMonthly: roomRent + roomAdminFee,
                    monthsActive,
                    totalShouldBeOwed,
                    totalCollected,
                    outstandingBalance,
                    payments: studentPayments.length
                });
            });
            
            console.log('\n🏢 Detailed Collections by Residence:');
            Object.keys(studentsByResidence).forEach(residenceName => {
                const students = studentsByResidence[residenceName];
                const totalRent = students.reduce((sum, s) => sum + s.roomRent, 0);
                const totalAdminFees = students.reduce((sum, s) => sum + s.roomAdminFee, 0);
                const totalMonthly = students.reduce((sum, s) => sum + s.totalMonthly, 0);
                const totalShouldBeOwed = students.reduce((sum, s) => sum + s.totalShouldBeOwed, 0);
                const totalCollected = students.reduce((sum, s) => sum + s.totalCollected, 0);
                const totalOutstanding = students.reduce((sum, s) => sum + s.outstandingBalance, 0);
                
                console.log(`\n   🏢 ${residenceName}:`);
                console.log(`      👥 Students: ${students.length}`);
                console.log(`      🏠 Total Monthly Rent: $${totalRent}`);
                console.log(`      📋 Total Monthly Admin Fees: $${totalAdminFees}`);
                console.log(`      💰 Total Monthly: $${totalMonthly}`);
                console.log(`      📈 Total Should Be Owed: $${totalShouldBeOwed}`);
                console.log(`      💵 Total Collected: $${totalCollected}`);
                console.log(`      ❌ Total Outstanding: $${totalOutstanding}`);
                
                students.forEach(student => {
                    console.log(`\n         👤 ${student.student}`);
                    console.log(`            Room: ${student.room}`);
                    console.log(`            Monthly: $${student.roomRent} + $${student.roomAdminFee} = $${student.totalMonthly}`);
                    console.log(`            Months Active: ${student.monthsActive}`);
                    console.log(`            Should Owe: $${student.totalShouldBeOwed}`);
                    console.log(`            Collected: $${student.totalCollected}`);
                    console.log(`            Outstanding: $${student.outstandingBalance}`);
                    console.log(`            Payments: ${student.payments}`);
                });
            });
            
        } catch (error) {
            console.log('   ❌ Failed:', error.message);
        }
        
        console.log('\n✅ Analysis completed!');
        console.log('\n💡 Summary:');
        console.log('===========');
        console.log('✅ You now have detailed totals collected by residence');
        console.log('✅ Each residence shows total rent, admin fees, and collections');
        console.log('✅ Outstanding balances are calculated per residence');
        console.log('✅ Individual student payment history is tracked');
        console.log('✅ Monthly accrual amounts are broken down by property');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        if (mongoose.connection.readyState === 1) {
            await mongoose.disconnect();
            console.log('\n🔌 Disconnected from MongoDB');
        }
    }
}

console.log('📊 Starting Accrual Residence Totals Analysis...');
getAccrualResidenceTotals();
