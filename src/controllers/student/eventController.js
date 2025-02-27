const Event = require('../../models/Event');
const { validationResult } = require('express-validator');

// Get available events
exports.getAvailableEvents = async (req, res) => {
    try {
        const { category, date } = req.query;
        let query = {
            status: 'upcoming',
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
        const event = await Event.findById(req.params.id);
        
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Check if event is still open for registration
        if (event.status !== 'upcoming') {
            return res.status(400).json({ error: 'Event is no longer open for registration' });
        }

        // Check if already registered
        if (event.participants.some(p => 
            p.student.toString() === req.user._id.toString() && 
            p.status === 'registered'
        )) {
            return res.status(400).json({ error: 'Already registered for this event' });
        }

        // Check capacity
        if (event.isFull()) {
            return res.status(400).json({ error: 'Event is at full capacity' });
        }

        // Register participant
        event.registerParticipant(req.user._id);
        await event.save();

        const updatedEvent = await Event.findById(req.params.id)
            .populate('residence', 'name location')
            .populate('organizer', 'firstName lastName');

        res.json(updatedEvent);
    } catch (error) {
        console.error('Register for event error:', error);
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

// Add feedback for event
exports.addFeedback = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const event = await Event.findById(req.params.id);
        
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Check if user attended the event
        const participant = event.participants.find(p => 
            p.student.toString() === req.user._id.toString() && 
            p.status === 'attended'
        );

        if (!participant) {
            return res.status(400).json({ error: 'Must have attended the event to provide feedback' });
        }

        // Check if user already provided feedback
        if (event.feedback.some(f => f.student.toString() === req.user._id.toString())) {
            return res.status(400).json({ error: 'Already provided feedback for this event' });
        }

        event.feedback.push({
            student: req.user._id,
            rating: req.body.rating,
            comment: req.body.comment
        });

        await event.save();

        res.json({ message: 'Feedback added successfully' });
    } catch (error) {
        console.error('Add feedback error:', error);
        res.status(500).json({ error: 'Error adding feedback' });
    }
}; 