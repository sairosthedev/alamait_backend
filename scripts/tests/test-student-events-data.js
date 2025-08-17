require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('./src/models/Event');
const User = require('./src/models/User');
const Residence = require('./src/models/Residence');

// Test what data is sent to students for events
async function testStudentEventsData() {
    try {
        console.log('=== TESTING STUDENT EVENTS DATA ===');
        
        // Connect using the same URI as your backend
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ Connected to MongoDB');
        console.log('Database name:', conn.connection.name);

        // Get a sample student for testing
        const sampleStudent = await User.findOne({ role: 'student' });
        if (!sampleStudent) {
            console.log('❌ No students found in database');
            return;
        }

        console.log(`\nUsing sample student: ${sampleStudent.firstName} ${sampleStudent.lastName} (${sampleStudent.email})`);

        // Get all events from database
        console.log('\n=== RAW EVENTS DATA FROM DATABASE ===');
        const allEvents = await Event.find({})
            .populate('residence', 'name location')
            .populate('participants.student', 'firstName lastName email')
            .lean();

        console.log(`Found ${allEvents.length} total events:`);
        allEvents.forEach((event, index) => {
            console.log(`\n${index + 1}. Event: ${event.title}`);
            console.log(`   - ID: ${event._id}`);
            console.log(`   - Date: ${event.date}`);
            console.log(`   - Time: ${event.startTime} - ${event.endTime}`);
            console.log(`   - Location: ${event.location}`);
            console.log(`   - Category: ${event.category}`);
            console.log(`   - Status: ${event.status}`);
            console.log(`   - Visibility: ${event.visibility}`);
            console.log(`   - Capacity: ${event.capacity}`);
            console.log(`   - Description: ${event.description}`);
            console.log(`   - Residence: ${event.residence ? event.residence.name : 'Unknown'}`);
            console.log(`   - Participants: ${event.participants ? event.participants.length : 0}`);
            console.log(`   - Requirements: ${event.requirements ? event.requirements.join(', ') : 'None'}`);
            console.log(`   - Resources: ${event.resources ? event.resources.join(', ') : 'None'}`);
            console.log(`   - Image: ${event.image ? event.image.url : 'None'}`);
            console.log(`   - Feedback: ${event.feedback ? event.feedback.length : 0} reviews`);
        });

        // Simulate what the student controller sends
        console.log('\n=== WHAT STUDENT CONTROLLER SENDS ===');
        
        const formatEvent = (event) => {
            // Format time display
            let timeDisplay = '';
            if (event.startTime && event.endTime) {
                if (event.startTime === event.endTime) {
                    timeDisplay = event.startTime;
                } else {
                    timeDisplay = `${event.startTime} - ${event.endTime}`;
                }
            } else if (event.startTime) {
                timeDisplay = event.startTime;
            } else if (event.endTime) {
                timeDisplay = event.endTime;
            }

            // Check if student is registered
            const isRegistered = event.participants && event.participants.some(p => 
                p.student && p.student._id.toString() === sampleStudent._id.toString()
            );

            return {
                id: event._id,
                title: event.title,
                date: event.date.toISOString().split('T')[0], // YYYY-MM-DD format
                time: timeDisplay,
                location: event.location,
                category: event.category,
                status: isRegistered ? 'Registered' : 
                       event.status === 'Required' ? 'Required' : 'Open',
                description: event.description,
                visibility: event.visibility
            };
        };

        // Simulate the exact response structure
        const studentResponse = {
            upcoming: allEvents.map(formatEvent),
            past: [] // Currently empty, but could be filtered by date
        };

        console.log('\nStudent API Response Structure:');
        console.log(JSON.stringify(studentResponse, null, 2));

        // Show what a single event looks like to students
        if (studentResponse.upcoming.length > 0) {
            console.log('\n=== SINGLE EVENT FOR STUDENT ===');
            const sampleEvent = studentResponse.upcoming[0];
            console.log('Sample event data sent to student:');
            console.log(JSON.stringify(sampleEvent, null, 2));
        }

        // Test registration status for each event
        console.log('\n=== REGISTRATION STATUS FOR SAMPLE STUDENT ===');
        allEvents.forEach((event, index) => {
            const isRegistered = event.participants && event.participants.some(p => 
                p.student && p.student._id.toString() === sampleStudent._id.toString()
            );
            console.log(`${index + 1}. ${event.title}: ${isRegistered ? '✅ Registered' : '❌ Not Registered'}`);
        });

        // Show available spots for each event
        console.log('\n=== AVAILABLE SPOTS FOR EACH EVENT ===');
        allEvents.forEach((event, index) => {
            const registeredCount = event.participants ? event.participants.length : 0;
            const availableSpots = event.capacity - registeredCount;
            console.log(`${index + 1}. ${event.title}: ${registeredCount}/${event.capacity} registered (${availableSpots} spots available)`);
        });

        console.log('\n=== SUMMARY ===');
        console.log(`Total events: ${allEvents.length}`);
        console.log(`Events with participants: ${allEvents.filter(e => e.participants && e.participants.length > 0).length}`);
        console.log(`Events with feedback: ${allEvents.filter(e => e.feedback && e.feedback.length > 0).length}`);
        console.log(`Sample student: ${sampleStudent.firstName} ${sampleStudent.lastName}`);

    } catch (error) {
        console.error('Error testing student events data:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the test
testStudentEventsData(); 