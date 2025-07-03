const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Application = require('../models/Application');
const Payment = require('../models/Payment');
const Student = require('../models/Student');
const Event = require('../models/Event');
const Maintenance = require('../models/Maintenance');
const Message = require('../models/Message');
const Lease = require('../models/Lease');
const Residence = require('../models/Residence');
const User = require('../models/User');

async function connectToDatabase() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}

async function fixUserResidenceReferences() {
    try {
      const students = await User.find({ role: 'student' });
      let updated = 0;
      for (const user of students) {
        // Find application by email
        const app = await Application.findOne({ email: user.email });
        if (app && app.roomOccupancy && app.roomOccupancy.residence) {
          const update = {
            residence: app.roomOccupancy.residence,
          };
          if (app.allocatedRoom) update.currentRoom = app.allocatedRoom;
          await User.updateOne({ _id: user._id }, { $set: update });
          console.log(`Updated user ${user.email} with residence ${app.roomOccupancy.residence} and room ${app.allocatedRoom}`);
          updated++;
        } else {
          console.log(`No application or residence found for user ${user.email}`);
        }
      }
      console.log(`Done. Updated ${updated} users.`);
    } catch (err) {
      console.error('Error updating users:', err);
    } finally {
      await mongoose.disconnect();
    }
  } 
  
async function backfillApplicationUserField() {
  try {
    const applications = await Application.find({ user: { $exists: false } });
    let updated = 0;
    for (const app of applications) {
      if (!app.email) continue;
      const user = await User.findOne({ email: app.email });
      if (user) {
        app.user = user._id;
        await app.save();
        console.log(`Linked application ${app._id} (${app.email}) to user ${user._id}`);
        updated++;
      }
    }
    console.log(`Done. Linked ${updated} applications to users.`);
  } catch (err) {
    console.error('Error linking applications to users:', err);
  } finally {
    await mongoose.disconnect();
  }
}

async function fixAlineResidence() {
  try {
    const result = await User.updateOne(
      { email: "makanakapemhiwa489@gmail.com" },
      { $set: { residence: "67d723cf20f89c4ae69804f3" } }
    );
    if (result.modifiedCount > 0) {
      console.log("Aline's residence updated successfully.");
    } else {
      console.log("Aline's user document not found or already up to date.");
    }
  } catch (err) {
    console.error('Error updating Aline residence:', err);
  } finally {
    await mongoose.disconnect();
  }
}

async function updateAllStudentsResidence() {
  try {
    const students = await User.find({ role: 'student' });
    let updated = 0;
    for (const user of students) {
      // Try to find application by user field first
      let app = await Application.findOne({ user: user._id });
      // Fallback: find by email if not found
      if (!app) app = await Application.findOne({ email: user.email });
      if (app && app.roomOccupancy && app.roomOccupancy.residence) {
        const result = await User.updateOne(
          { _id: user._id },
          { $set: { residence: app.roomOccupancy.residence } }
        );
        if (result.modifiedCount > 0) {
          console.log(`Updated ${user.email} with residence ${app.roomOccupancy.residence}`);
          updated++;
        }
      } else {
        console.log(`No application with residence found for user ${user.email}`);
      }
    }
    console.log(`Done. Updated ${updated} student users with residence.`);
  } catch (err) {
    console.error('Error updating student residences:', err);
  } finally {
    await mongoose.disconnect();
  }
}

// Remove main and just run fixUserResidenceReferences if run directly
if (require.main === module) {
  require('dotenv').config();
  mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => {
      // fixUserResidenceReferences();
      // backfillApplicationUserField();
      // fixAlineResidence();
      updateAllStudentsResidence();
    });
}

// module.exports = { fixResidenceReferences }; 