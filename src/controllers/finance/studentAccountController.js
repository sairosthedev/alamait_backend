const Payment = require('../../models/Payment');
const User = require('../../models/User');
const Lease = require('../../models/Lease');

exports.getAllStudentAccounts = async (req, res) => {
  try {
    const students = await User.find({ role: 'student' });

    const results = await Promise.all(students.map(async (student) => {
      // Find all leases for the student
      const leases = await Lease.find({ student: student._id });
      // Calculate total due from all leases (rent * months)
      let totalDue = 0;
      leases.forEach(lease => {
        if (lease.rent && lease.startDate && lease.endDate) {
          const start = new Date(lease.startDate);
          const end = new Date(lease.endDate);
          const months = Math.max(
            1,
            (end.getFullYear() - start.getFullYear()) * 12 +
            (end.getMonth() - start.getMonth()) + 1
          );
          totalDue += lease.rent * months;
        }
      });

      // Find all payments for the student
      const payments = await Payment.find({ student: student._id });
      const totalPaid = payments
        .filter(p => ['Confirmed', 'Verified'].includes(p.status))
        .reduce((sum, p) => sum + (p.totalAmount || 0), 0);
      const amountOwed = totalDue - totalPaid;
      const paymentMethods = [...new Set(payments.map(p => p.method || ''))];

      return {
        studentId: student._id,
        studentName: `${student.firstName} ${student.lastName}`,
        totalDue,
        totalPaid,
        amountOwed,
        paymentMethods,
        leases,
        payments
      };
    }));

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch student accounts' });
  }
}; 