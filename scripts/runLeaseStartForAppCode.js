require('dotenv').config();

const connectDB = require('../src/config/database');
// Ensure referenced models are registered for populate/lookups inside services
require('../src/models/User');
require('../src/models/Debtor');
require('../src/models/Account');
require('../src/models/Invoice');
const Application = require('../src/models/Application');
const RentalAccrualService = require('../src/services/rentalAccrualService');

async function main() {
  const appCode = process.argv[2];
  if (!appCode) {
    console.error('Usage: node scripts/runLeaseStartForAppCode.js <APPLICATION_CODE>');
    process.exit(1);
  }

  await connectDB();

  const app = await Application.findOne({ applicationCode: appCode }).lean();

  if (!app) {
    console.error(`Application not found for code: ${appCode}`);
    process.exit(1);
  }

  console.log('Found application:', {
    _id: String(app._id),
    applicationCode: app.applicationCode,
    studentId: app.student?._id ? String(app.student._id) : app.student,
    studentName: app.student?.firstName
      ? `${app.student.firstName} ${app.student.lastName}`
      : `${app.firstName} ${app.lastName}`,
    startDate: app.startDate,
    endDate: app.endDate,
    residence: app.residence,
    allocatedRoom: app.allocatedRoom,
  });

  // Run lease start creation
  const result = await RentalAccrualService.processLeaseStart(app);
  console.log('processLeaseStart result:', result);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

