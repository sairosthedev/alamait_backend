const mongoose = require('mongoose');

const paymentDetailSchema = new mongoose.Schema({
  type: String,
  amount: Number,
  status: String
});

const paymentHistorySchema = new mongoose.Schema({
  date: Date,
  details: [paymentDetailSchema],
  totalAmount: Number,
  status: String
});

const rentalHistorySchema = new mongoose.Schema({
  room: String,
  startDate: Date,
  endDate: Date,
  status: String
});

const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  program: String,
  room: String,
  residence: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Residence',
    required: true
  },
  status: String,
  phone: String,
  emergencyContact: String,
  paymentHistory: [paymentHistorySchema],
  rentalHistory: [rentalHistorySchema]
});

module.exports = mongoose.model('Student', studentSchema);

const getStudentRoomPrice = async (studentId) => {
  const student = await Student.findById(studentId).lean();
  if (!student || !student.residence) return null;

  const residence = await Residence.findById(student.residence).lean();
  if (!residence) return null;

  const room = residence.rooms.find(r => r.roomNumber === student.room);
  return room ? room.price : null;
};

const getStudentInfo = async (req, res) => {
  const student = await Student.findById(req.params.id).lean();
  if (!student || !student.residence) {
    return res.status(404).json({ error: 'Student or residence not found' });
  }

  const residence = await Residence.findById(student.residence).lean();
  if (!residence) {
    return res.status(404).json({ error: 'Residence not found' });
  }

  const allocatedRoomDetails = residence.rooms.find(
    room => room.roomNumber === student.room
  );

  res.json({
    ...student,
    allocatedRoomDetails // includes price, type, etc.
  });
}; 