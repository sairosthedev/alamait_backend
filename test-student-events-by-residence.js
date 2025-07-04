const mongoose = require('mongoose');
const Event = require('./src/models/Event');
const User = require('./src/models/User');
const Residence = require('./src/models/Residence');
const Booking = require('./src/models/Booking');
const Application = require('./src/models/Application');

// Test student events filtered by residence
async function testStudentEventsByResidence() {
    try {
        console.log('=== TESTING STUDENT EVENTS BY RESIDENCE ===');
        
        // Check if MONGODB_URI is available
        if (!process.env.MONGODB_URI) {
            console.log('⚠️  MONGODB_URI not found in environment variables');
            console.log('📝 This test requires a MongoDB connection to run properly');
            console.log('💡 To run this test, set the MONGODB_URI environment variable');
            console.log('🔧 Example: MONGODB_URI=mongodb://localhost:27017/alamait node test-student-events-by-residence.js');
            return;
        }
        
        // Connect to MongoDB
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ Connected to MongoDB');
        console.log('Database name:', conn.connection.name);

        // Get all students
        const students = await User.find({ role: 'student' }).select('_id firstName lastName email currentRoom');
        console.log(`\nFound ${students.length} students in database`);

        // Get all residences
        const residences = await Residence.find({}).select('_id name');
        console.log(`Found ${residences.length} residences in database`);

        // Get all events
        const allEvents = await Event.find({}).populate('residence', 'name');
        console.log(`Found ${allEvents.length} total events in database`);

        console.log('\n=== EVENTS BY RESIDENCE ===');
        residences.forEach(residence => {
            const eventsForResidence = allEvents.filter(e => e.residence && e.residence._id.toString() === residence._id.toString());
            console.log(`${residence.name}: ${eventsForResidence.length} events`);
            eventsForResidence.forEach(event => {
                console.log(`  - ${event.title} (${event.date})`);
            });
        });

        // Test each student's residence determination
        console.log('\n=== TESTING STUDENT RESIDENCE DETERMINATION ===');
        
        for (const student of students) {
            console.log(`\n--- Student: ${student.firstName} ${student.lastName} (${student.email}) ---`);
            
            // Get current active booking
            const currentBooking = await Booking.findOne({
                student: student._id,
                status: 'active'
            }).populate('residence', '_id name');

            if (currentBooking?.residence) {
                console.log(`✅ Residence from booking: ${currentBooking.residence.name}`);
                continue;
            }

            // Get approved application
            const approvedApplication = await Application.findOne({
                student: student._id,
                status: { $in: ['approved', 'waitlisted'] }
            }).populate('residence', '_id name').sort({ applicationDate: -1 });

            if (approvedApplication?.residence) {
                console.log(`✅ Residence from application: ${approvedApplication.residence.name}`);
                continue;
            }

            // Get student's current room and find residence
            if (student.currentRoom) {
                const residence = await Residence.findOne({
                    'rooms.roomNumber': student.currentRoom
                }).select('_id name');
                
                if (residence) {
                    console.log(`✅ Residence from current room: ${residence.name}`);
                    continue;
                }
            }

            // Fallback to student's direct residence field
            const studentWithResidence = await User.findById(student._id).populate('residence', '_id name');
            if (studentWithResidence?.residence) {
                console.log(`✅ Residence from student field: ${studentWithResidence.residence.name}`);
                continue;
            }

            console.log(`❌ No residence found for student`);
        }

        // Test the actual event filtering logic
        console.log('\n=== TESTING EVENT FILTERING LOGIC ===');
        
        for (const student of students.slice(0, 3)) { // Test first 3 students
            console.log(`\n--- Testing events for: ${student.firstName} ${student.lastName} ---`);
            
            // Simulate the residence determination logic
            let studentResidenceId = null;
            
            // Get current active booking first
            const currentBooking = await Booking.findOne({
                student: student._id,
                status: 'active'
            }).populate('residence', '_id name');

            if (currentBooking?.residence?._id) {
                studentResidenceId = currentBooking.residence._id;
                console.log(`Found residence from booking: ${currentBooking.residence.name}`);
            } else {
                // Get approved application
                const approvedApplication = await Application.findOne({
                    student: student._id,
                    status: { $in: ['approved', 'waitlisted'] }
                }).populate('residence', '_id name').sort({ applicationDate: -1 });

                if (approvedApplication?.residence?._id) {
                    studentResidenceId = approvedApplication.residence._id;
                    console.log(`Found residence from application: ${approvedApplication.residence.name}`);
                } else if (student.currentRoom) {
                    const residence = await Residence.findOne({
                        'rooms.roomNumber': student.currentRoom
                    }).select('_id name');
                    
                    if (residence?._id) {
                        studentResidenceId = residence._id;
                        console.log(`Found residence from current room: ${residence.name}`);
                    }
                } else {
                    const studentWithResidence = await User.findById(student._id).populate('residence', '_id name');
                    if (studentWithResidence?.residence?._id) {
                        studentResidenceId = studentWithResidence.residence._id;
                        console.log(`Found residence from student field: ${studentWithResidence.residence.name}`);
                    }
                }
            }

            if (studentResidenceId) {
                // Filter events by residence
                const filteredEvents = allEvents.filter(event => 
                    event.residence && event.residence._id.toString() === studentResidenceId.toString()
                );
                
                console.log(`Events for this student's residence: ${filteredEvents.length}`);
                filteredEvents.forEach(event => {
                    console.log(`  - ${event.title} (${event.date})`);
                });
            } else {
                console.log('No residence found, would return all events');
            }
        }

        console.log('\n✅ Test completed successfully');
        mongoose.disconnect();
    } catch (error) {
        console.error('❌ Test failed:', error);
        if (mongoose.connection.readyState === 1) {
            mongoose.disconnect();
        }
    }
}

// Run the test
testStudentEventsByResidence(); 