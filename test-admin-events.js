require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('./src/models/Event');
const Residence = require('./src/models/Residence');

// Test what event data is being sent to admin
async function testAdminEvents() {
    try {
        console.log('=== TESTING ADMIN EVENTS DATA ===');
        
        // Connect using the same URI as your backend
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ Connected to MongoDB');
        console.log('Database name:', conn.connection.name);

        // Test 1: Get all events with residence populated (like admin controller does)
        console.log('\n1. Testing GET /api/admin/events (with residence populated)');
        const eventsWithResidence = await Event.find().populate('residence');
        console.log(`Found ${eventsWithResidence.length} events:`);
        
        eventsWithResidence.forEach((event, index) => {
            console.log(`\nEvent ${index + 1}:`);
            console.log(`  ID: ${event._id}`);
            console.log(`  Title: ${event.title}`);
            console.log(`  Description: ${event.description}`);
            console.log(`  Date: ${event.date}`);
            console.log(`  Start Time: ${event.startTime}`);
            console.log(`  End Time: ${event.endTime}`);
            console.log(`  Location: ${event.location}`);
            console.log(`  Category: ${event.category}`);
            console.log(`  Status: ${event.status}`);
            console.log(`  Visibility: ${event.visibility}`);
            console.log(`  Capacity: ${event.capacity}`);
            console.log(`  Requirements: ${event.requirements.join(', ') || 'None'}`);
            console.log(`  Resources: ${event.resources.join(', ') || 'None'}`);
            console.log(`  Participants Count: ${event.participants.length}`);
            console.log(`  Feedback Count: ${event.feedback.length}`);
            console.log(`  Created At: ${event.createdAt}`);
            console.log(`  Updated At: ${event.updatedAt}`);
            
            // Residence details
            if (event.residence) {
                console.log(`  Residence: ${event.residence.name} (ID: ${event.residence._id})`);
            } else {
                console.log(`  Residence: Not populated or missing`);
            }
            
            // Image details
            if (event.image && event.image.url) {
                console.log(`  Image: ${event.image.url} (Caption: ${event.image.caption || 'None'})`);
            } else {
                console.log(`  Image: None`);
            }
        });

        // Test 2: Check if there are any events without residence
        console.log('\n2. Checking events without residence...');
        const eventsWithoutResidence = await Event.find({ residence: { $exists: false } });
        console.log(`Events without residence: ${eventsWithoutResidence.length}`);

        // Test 3: Check all unique categories
        console.log('\n3. Checking all unique categories...');
        const uniqueCategories = await Event.distinct('category');
        console.log('Unique categories:', uniqueCategories);

        // Test 4: Check all unique statuses
        console.log('\n4. Checking all unique statuses...');
        const uniqueStatuses = await Event.distinct('status');
        console.log('Unique statuses:', uniqueStatuses);

        // Test 5: Sample event data structure (first event)
        if (eventsWithResidence.length > 0) {
            console.log('\n5. Sample event data structure:');
            const sampleEvent = eventsWithResidence[0];
            console.log(JSON.stringify(sampleEvent, null, 2));
        }

        console.log('\n=== SUMMARY ===');
        console.log('Total events:', eventsWithResidence.length);
        console.log('Events with residence:', eventsWithResidence.filter(e => e.residence).length);
        console.log('Events without residence:', eventsWithoutResidence.length);
        console.log('Categories:', uniqueCategories);
        console.log('Statuses:', uniqueStatuses);
        
        if (eventsWithResidence.length === 0) {
            console.log('⚠️  No events found - this explains empty results');
        } else {
            console.log('✅ Events found - admin should receive this data');
        }

    } catch (error) {
        console.error('Error testing admin events:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

// Run the test
testAdminEvents(); 