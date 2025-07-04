const Event = require('../../models/Event');
const User = require('../../models/User');
const Booking = require('../../models/Booking');
const Application = require('../../models/Application');
const Residence = require('../../models/Residence');
const { validationResult } = require('express-validator');

// Helper function to get student's residence ID
const getStudentResidenceId = async (userId) => {
    try {
        // Get current active booking first
        const currentBooking = await Booking.findOne({
            student: userId,
            status: 'active'
        }).populate('residence', '_id name');

        if (currentBooking?.residence?._id) {
            console.log('Found residence from current booking:', currentBooking.residence.name);
            return currentBooking.residence._id;
        }

        // Get approved application
        const approvedApplication = await Application.findOne({
            student: userId,
            status: { $in: ['approved', 'waitlisted'] }
        }).populate('residence', '_id name').sort({ applicationDate: -1 });

        if (approvedApplication?.residence?._id) {
            console.log('Found residence from approved application:', approvedApplication.residence.name);
            return approvedApplication.residence._id;
        }

        // Get student's current room and find residence
        const student = await User.findById(userId).select('currentRoom');
        if (student?.currentRoom) {
            const residence = await Residence.findOne({
                'rooms.roomNumber': student.currentRoom
            }).select('_id name');
            
            if (residence?._id) {
                console.log('Found residence from current room:', residence.name);
                return residence._id;
            }
        }

        // Fallback to student's direct residence field
        const studentWithResidence = await User.findById(userId).populate('residence', '_id name');
        if (studentWithResidence?.residence?._id) {
            console.log('Found residence from student field:', studentWithResidence.residence.name);
            return studentWithResidence.residence._id;
        }

        console.log('No residence found for student');
        return null;
    } catch (error) {
        console.error('Error getting student residence:', error);
        return null;
    }
};

// Get all events
exports.getEvents = async (req, res) => {
    try {
        console.log('Starting getEvents...');
        
        // Use residence from query if provided, else use student's residence
        let studentResidenceId = null;
        if (req.query.residence) {
            studentResidenceId = req.query.residence;
            console.log('Residence filter from query:', studentResidenceId);
        } else {
            studentResidenceId = await getStudentResidenceId(req.user._id);
            console.log('Student residence ID:', studentResidenceId);
        }
        
        // Build query to filter events by residence
        let query = {};
        if (studentResidenceId) {
            query.residence = studentResidenceId;
            console.log('Filtering events by residence:', studentResidenceId);
        } else {
            console.log('No residence found for student, returning all events');
        }
        
        // Get events filtered by residence
        const allEvents = await Event.find(query).populate('residence', 'name location');
        console.log('Total events found for student residence:', allEvents.length);
        console.log('Events found:', allEvents.map(e => ({ title: e.title, residence: e.residence?.name || 'Unknown' })));

        // Transform events to match frontend format
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

            // Check if student is registered for this event
            const isRegistered = event.participants && event.participants.some(p => 
                p.student && p.student.toString() === req.user._id.toString()
            );

            return {
                id: event._id,
                title: event.title,
                date: event.date.toISOString().split('T')[0],
                time: timeDisplay,
                location: event.location,
                category: event.category,
                status: isRegistered ? 'Registered' : 
                       event.status === 'Required' ? 'Required' : 'Open',
                description: event.description,
                visibility: event.visibility,
                residence: event.residence?._id ? event.residence._id : (event.residence || null),
                residenceName: event.residence?.name || null
            };
        };

        // Separate events into upcoming and past
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of day
        
        const upcoming = [];
        const past = [];
        
        allEvents.forEach(event => {
            const eventDate = new Date(event.date);
            eventDate.setHours(0, 0, 0, 0);
            
            const formattedEvent = formatEvent(event);
            
            if (eventDate >= today) {
                upcoming.push(formattedEvent);
            } else {
                past.push(formattedEvent);
            }
        });
        
        const response = {
            upcoming,
            past
        };
        
        console.log('Formatted response - Upcoming:', upcoming.length, 'Past:', past.length);
        console.log('Upcoming events:', upcoming.map(e => e.title));
        console.log('Past events:', past.map(e => e.title));
        res.json(response);
    } catch (error) {
        console.error('Error in getEvents:', error);
        res.status(500).json({ error: 'Error retrieving events' });
    }
};

// Get available events
exports.getAvailableEvents = async (req, res) => {
    try {
        const { category, date } = req.query;
        let query = {
            visibility: 'all',
            date: { $gte: new Date() }
        };

        if (category) query.category = category;
        if (date) {
            const searchDate = new Date(date);
            query.date = {
                $gte: searchDate,
                $lt: new Date(searchDate.setDate(searchDate.getDate() + 1))
            };
        }

        const events = await Event.find(query)
            .populate('residence', 'name location')
            .populate('organizer', 'firstName lastName')
            .sort('date');

        // Add availability information
        const eventsWithAvailability = events.map(event => ({
            ...event.toObject(),
            isRegistered: event.participants.some(p => 
                p.student.toString() === req.user._id.toString() && 
                p.status === 'registered'
            ),
            availableSpots: event.capacity - event.participants.filter(p => 
                p.status === 'registered'
            ).length
        }));

        res.json(eventsWithAvailability);
    } catch (error) {
        console.error('Get available events error:', error);
        res.status(500).json({ error: 'Error fetching events' });
    }
};

// Get my registered events
exports.getMyEvents = async (req, res) => {
    try {
        const events = await Event.find({
            'participants.student': req.user._id,
            'participants.status': { $in: ['registered', 'attended'] }
        })
            .populate('residence', 'name location')
            .populate('organizer', 'firstName lastName')
            .sort('date');

        res.json(events);
    } catch (error) {
        console.error('Get my events error:', error);
        res.status(500).json({ error: 'Error fetching registered events' });
    }
};

// Register for event
exports.registerForEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.eventId);
        
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Create date objects for comparison
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set time to midnight
        
        const eventDate = new Date(event.date);
        eventDate.setHours(0, 0, 0, 0); // Set time to midnight
        
        console.log('Today:', today);
        console.log('Event date:', eventDate);
        
        if (eventDate < today) {
            return res.status(400).json({ error: 'Cannot register for past events' });
        }

        // Check if already registered
        const isRegistered = event.participants.some(p => 
            p.student.toString() === req.user._id.toString() && 
            p.status === 'registered'
        );

        if (isRegistered) {
            return res.status(400).json({ error: 'Already registered for this event' });
        }

        // Add participant
        event.participants.push({
            student: req.user._id,
            status: 'registered'
        });

        await event.save();
        res.json({ message: 'Successfully registered for event' });
    } catch (error) {
        console.error('Error in registerForEvent:', error);
        res.status(500).json({ error: 'Error registering for event' });
    }
};

// Cancel event registration
exports.cancelRegistration = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Find participant
        const participantIndex = event.participants.findIndex(p => 
            p.student.toString() === req.user._id.toString() && 
            p.status === 'registered'
        );

        if (participantIndex === -1) {
            return res.status(400).json({ error: 'Not registered for this event' });
        }

        // Check if cancellation is allowed (e.g., not too close to event)
        const today = new Date();
        const eventDate = new Date(event.date);
        const hoursUntilEvent = (eventDate - today) / (1000 * 60 * 60);

        if (hoursUntilEvent < 24) {
            return res.status(400).json({ 
                error: 'Cannot cancel registration within 24 hours of event' 
            });
        }

        // Update participant status
        event.participants[participantIndex].status = 'cancelled';
        await event.save();

        res.json({ message: 'Registration cancelled successfully' });
    } catch (error) {
        console.error('Cancel registration error:', error);
        res.status(500).json({ error: 'Error cancelling registration' });
    }
};

// Submit event feedback
exports.submitEventFeedback = async (req, res) => {
    try {
        const { rating, comment } = req.body;
        const event = await Event.findById(req.params.eventId);
        
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        if (!event.participants.includes(req.user._id)) {
            return res.status(403).json({ error: 'Must be registered for event to submit feedback' });
        }

        event.feedback.push({
            student: req.user._id,
            rating,
            comment,
            date: new Date()
        });

        await event.save();

        res.json({ message: 'Feedback submitted successfully' });
    } catch (error) {
        console.error('Error in submitEventFeedback:', error);
        res.status(500).json({ error: 'Error submitting feedback' });
    }
}; 