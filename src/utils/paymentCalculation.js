const Student = require('../models/Student');
const Residence = require('../models/Residence');
const Payment = require('../models/Payment');
const mongoose = require('mongoose');

// Helper: get months between two dates (inclusive of start month)
function monthsBetween(startDate, endDate) {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
  let months = (end.getFullYear() - start.getFullYear()) * 12;
  months += end.getMonth() - start.getMonth();
  return months + 1;
}

// Helper: get current rental period
function getCurrentRental(rentalHistory, currentDate) {
  return rentalHistory.find(rh => {
    if (rh.status && rh.status.toLowerCase() === 'active') return true;
    if (rh.startDate && rh.endDate) {
      return new Date(rh.startDate) <= currentDate && currentDate <= new Date(rh.endDate);
    }
    return false;
  });
}

// Helper: get due date (7th of current month)
function getDueDate(currentDate) {
  return new Date(currentDate.getFullYear(), currentDate.getMonth(), 7, 23, 59, 59, 999);
}

// Main function: calculate required payment for the month
async function getRequiredPaymentForStudent(studentId, currentDate = new Date()) {
  // 1. Get student
  const student = await Student.findById(studentId).lean();
  if (!student) throw new Error('Student not found');

  // 2. Get current rental
  const rental = getCurrentRental(student.rentalHistory || [], currentDate);
  if (!rental) throw new Error('No active rental found for student');

  // 3. Get room from residences collection
  const residence = await Residence.findOne({
    'rooms.roomNumber': rental.room || student.room
  }).lean();
  
  if (!residence) throw new Error('Residence not found');
  
  const room = residence.rooms.find(r => r.roomNumber === (rental.room || student.room));
  if (!room) throw new Error('Room not found');

  // Determine residence type for payment requirements
  const residenceName = residence.name.trim().toLowerCase();
  const isStKilda = residenceName.includes('st kilda');
  const isBelvedere = residenceName.includes('belvedere');

  // 5. Calculate stay duration (months)
  const stayMonths = monthsBetween(new Date(rental.startDate), new Date(rental.endDate));

  // 6. Get payment history (confirmed/verified payments only)
  const payments = await Payment.find({
    student: studentId,
    status: { $in: ['Confirmed', 'Verified'] },
    date: { $gte: new Date(rental.startDate), $lte: new Date(rental.endDate) }
  });

  let rentPaid = 0, adminFeePaid = 0, depositPaid = 0;
  payments.forEach(p => {
    rentPaid += p.rentAmount || 0;
    adminFeePaid += p.adminFee || 0;
    depositPaid += p.deposit || 0;
  });

  // 7. Calculate what is due this month
  const rentDue = room.price;
  let adminFeeDue = 0, depositDue = 0;
  
  if (isStKilda) {
    // St Kilda: Admin fee + Deposit required
    adminFeeDue = Math.max(20 - adminFeePaid, 0);
    const totalDeposit = room.price;
    const depositLeft = Math.max(totalDeposit - depositPaid, 0);
    const monthsElapsed = monthsBetween(new Date(rental.startDate), currentDate);
    const minDepositShouldHavePaid = Math.min(Math.ceil((monthsElapsed / stayMonths) * totalDeposit), totalDeposit);
    const minDepositThisMonth = Math.max(minDepositShouldHavePaid - depositPaid, 0);
    depositDue = depositLeft > 0 ? Math.min(depositLeft, minDepositThisMonth) : 0;
  } else if (!isBelvedere) {
    // Other residences (not St Kilda, not Belvedere): Deposit required, no admin fee
    const totalDeposit = room.price;
    const depositLeft = Math.max(totalDeposit - depositPaid, 0);
    const monthsElapsed = monthsBetween(new Date(rental.startDate), currentDate);
    const minDepositShouldHavePaid = Math.min(Math.ceil((monthsElapsed / stayMonths) * totalDeposit), totalDeposit);
    const minDepositThisMonth = Math.max(minDepositShouldHavePaid - depositPaid, 0);
    depositDue = depositLeft > 0 ? Math.min(depositLeft, minDepositThisMonth) : 0;
  }
  // Belvedere: No deposit, no admin fee (both remain 0)

  // 8. Total due
  const totalDue = rentDue + adminFeeDue + depositDue;

  // 9. Due date and overdue logic
  const dueDate = getDueDate(currentDate);
  const today = new Date(currentDate);
  const isOverdue = today > dueDate;
  const isPaymentWindowOpen = (today.getDate() >= 1 && today.getDate() <= 7) || (isOverdue && totalDue > 0);

  return {
    rent: rentDue,
    adminFeeDue,
    depositDue,
    totalDue,
    dueDate,
    isOverdue,
    isPaymentWindowOpen,
    breakdown: {
      rent: rentDue,
      adminFeeDue,
      depositDue,
      alreadyPaid: { rentPaid, adminFeePaid, depositPaid },
      stayMonths,
      isStKilda,
      isBelvedere,
      room: room.name,
      residence: residence.name
    }
  };
}

// Validation function
async function validateStudentPayment(studentId, paymentAmount, currentDate = new Date()) {
  const required = await getRequiredPaymentForStudent(studentId, currentDate);
  if (Number(paymentAmount) !== Number(required.totalDue)) {
    return { valid: false, reason: `Payment must be exactly ${required.totalDue}` };
  }
  return { valid: true };
}

module.exports = {
  getRequiredPaymentForStudent,
  validateStudentPayment
}; 