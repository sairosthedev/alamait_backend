const Payment = require('../../models/Payment');
const User = require('../../models/User');

exports.getAllStudentAccounts = async (req, res) => {
  try {
    // Get all students
    const students = await User.find({ role: 'student' });

    // For each student, aggregate their payments
    const results = await Promise.all(students.map(async (student) => {
      const payments = await Payment.find({ student: student._id });

      // Calculate totals
      const totalDue = payments.reduce((sum, p) => sum + (p.rentAmount || 0) + (p.adminFee || 0) + (p.deposit || 0), 0);
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
        payments // Optionally include payment details
      };
    }));

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch student accounts' });
  }
}; 