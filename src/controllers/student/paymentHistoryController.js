const Payment = require('../../models/Payment');
const User = require('../../models/User');
const Booking = require('../../models/Booking');

exports.getPaymentHistory = async (req, res) => {
    try {
        // Get student info
        const student = await User.findById(req.user._id);
        
        // Get current booking for fee structure
        const currentBooking = await Booking.findOne({ 
            student: req.user._id,
            status: 'active'
        });

        // Get all payments
        const payments = await Payment.find({ student: req.user._id })
            .populate('booking')
            .sort({ date: -1 });

        // Calculate balances
        const currentDate = new Date();
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        // Get confirmed payments for current month
        const currentMonthPayments = payments.filter(payment => {
            const paymentDate = new Date(payment.date);
            return payment.status === 'Confirmed' && 
                   paymentDate.getMonth() === currentMonth &&
                   paymentDate.getFullYear() === currentYear;
        });

        // Calculate current month's total confirmed payments
        const currentMonthPaid = currentMonthPayments.reduce((sum, payment) => sum + payment.totalAmount, 0);

        // Current due is the difference between monthly rent and current month's payments
        const currentDue = Math.max(0, (currentBooking?.monthlyRent || 0) - currentMonthPaid);

        // Calculate past due (unpaid amounts from previous months, excluding overdue)
        const threeMonthsAgo = new Date(currentDate.setMonth(currentDate.getMonth() - 3));
        const pastDue = payments.reduce((acc, payment) => {
            const paymentDate = new Date(payment.date);
            if (paymentDate > threeMonthsAgo && 
                paymentDate < new Date(currentYear, currentMonth, 1) && 
                payment.status !== 'Confirmed') {
                return acc + payment.totalAmount;
            }
            return acc;
        }, 0);

        // Calculate past overdue (unpaid amounts older than 3 months)
        const pastOverDue = payments.reduce((acc, payment) => {
            const paymentDate = new Date(payment.date);
            if (paymentDate <= threeMonthsAgo && payment.status !== 'Confirmed') {
                return acc + payment.totalAmount;
            }
            return acc;
        }, 0);

        // Format student info
        const studentInfo = {
            name: `${student.firstName} ${student.lastName}`,
            roll: student.studentId,
            course: student.program,
            year: student.year,
            institution: student.institution || "University of Zimbabwe",
            currentDue: currentDue.toFixed(2),
            pastDue: pastDue.toFixed(2),
            pastOverDue: pastOverDue.toFixed(2)
        };

        // Format fee structure
        const feeStructure = [
            { 
                id: 1, 
                description: "Monthly Rent", 
                amount: currentBooking ? currentBooking.monthlyRent.toFixed(2) : "N/A" 
            },
            { 
                id: 2, 
                description: "Admin Fee (Once-off)", 
                amount: "20.00" 
            },
            { 
                id: 3, 
                description: "Security Deposit", 
                amount: currentBooking ? currentBooking.monthlyRent.toFixed(2) : "N/A" 
            },
            { 
                id: 4, 
                description: "Damages Fee", 
                amount: "N/A" 
            }
        ];

        // Format payment history
        const paymentHistory = payments.map(payment => {
            const date = new Date(payment.date);
            return {
                date: date.toLocaleDateString('en-US', { 
                    day: '2-digit', 
                    month: '2-digit', 
                    year: '2-digit' 
                }),
                amount: payment.totalAmount.toFixed(2),
                type: payment.rentAmount > 0 ? 'Rent' : (payment.deposit > 0 ? 'Initial' : 'Admin'),
                ref: payment.paymentId,
                status: payment.status === 'Confirmed' ? 'Verified' : payment.status,
                month: date.toLocaleString('en-US', { month: 'long' }),
                paymentMethod: payment.method,
                processingTime: "2 minutes"
            };
        });

        // Calculate current period stats
        const totalPaid = payments
            .filter(p => p.status === 'Confirmed')
            .reduce((sum, p) => sum + p.totalAmount, 0);

        const currentPeriod = {
            totalDue: (currentBooking?.monthlyRent || 0).toFixed(2),
            amountPaid: currentMonthPaid.toFixed(2),
            balance: currentDue.toFixed(2),
            startDate: new Date(currentYear, currentMonth, 1).toLocaleDateString('en-US', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }),
            endDate: new Date(currentYear, currentMonth + 1, 0).toLocaleDateString('en-US', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            }),
            lastPayment: payments[0]?.totalAmount.toFixed(2) || "0.00",
            nextDue: new Date(currentYear, currentMonth + 1, 1).toLocaleDateString('en-US', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            })
        };

        res.json({
            studentInfo,
            feeStructure,
            paymentHistory,
            currentPeriod
        });
    } catch (error) {
        console.error('Error in getPaymentHistory:', error);
        res.status(500).json({ error: 'Error retrieving payment history' });
    }
}; 