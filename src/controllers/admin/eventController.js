const Event = require('../../models/Event');

// Create a new event
const createEvent = async (req, res) => {
    try {
        const { title, date, time, location, category, description, status, startTime, endTime, residence } = req.body;
        
        // Validate residence ID
        if (!residence) {
            return res.status(400).json({ error: 'Residence ID is required' });
        }
        
        // Handle time in different formats
        let eventStartTime, eventEndTime;
        if (time) {
            if (time.includes('-')) {
                [eventStartTime, eventEndTime] = time.split('-').map(t => t.trim());
            } else {
                eventStartTime = time;
                eventEndTime = time;
            }
        } else {
            eventStartTime = startTime;
            eventEndTime = endTime || startTime;
        }
        
        const event = new Event({
            title,
            date,
            startTime: eventStartTime,
            endTime: eventEndTime,
            location,
            category,
            description,
            status,
            visibility: 'all',
            capacity: 50,
            requirements: [],
            resources: [],
            residence
        });

        await event.save();
        res.status(201).json(event);
    } catch (error) {
        console.error('Error creating event:', error);
        res.status(500).json({ error: 'Failed to create event' });
    }
};

// Get all events
const getEvents = async (req, res) => {
    try {
        let query = {};
        if (req.query.residence) {
            query.residence = req.query.residence;
        }
        const events = await Event.find(query).populate('residence');
        
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

            return {
                id: event._id,
                title: event.title,
                date: event.date.toISOString().split('T')[0],
                time: timeDisplay,
                location: event.location,
                category: event.category,
                status: event.status,
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
        
        events.forEach(event => {
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
        
        res.json(response);
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
};

const updateEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, date, time, location, category, description, status } = req.body;
        
        // Split time into startTime and endTime if provided
        let startTime, endTime;
        if (time) {
            [startTime, endTime] = time.split('-').map(t => t.trim());
        }

        const updateData = {
            ...(title && { title }),
            ...(date && { date }),
            ...(startTime && { startTime }),
            ...(endTime && { endTime }),
            ...(location && { location }),
            ...(category && { category }),
            ...(description && { description }),
            ...(status && { status })
        };

        const event = await Event.findByIdAndUpdate(id, updateData, { new: true });
        
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        res.json(event);
    } catch (error) {
        console.error('Error updating event:', error);
        res.status(500).json({ error: 'Failed to update event' });
    }
};

const deleteEvent = async (req, res) => {
    try {
        const { id } = req.params;
        const event = await Event.findByIdAndDelete(id);
        
        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        res.json({ message: 'Event deleted successfully' });
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).json({ error: 'Failed to delete event' });
    }
};

// Get RSVP summary for an event
const getEventRSVPSummary = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id).populate('participants.student', 'firstName lastName email');
        if (!event) return res.status(404).json({ error: 'Event not found' });
        const summary = { yes: [], no: [], maybe: [] };
        event.participants.forEach(p => {
            if (summary[p.status]) {
                summary[p.status].push({
                    id: p.student._id,
                    name: `${p.student.firstName} ${p.student.lastName}`,
                    email: p.student.email,
                    respondedAt: p.respondedAt
                });
            }
        });
        res.json({
            counts: {
                yes: summary.yes.length,
                no: summary.no.length,
                maybe: summary.maybe.length
            },
            participants: summary
        });
    } catch (error) {
        console.error('RSVP summary error:', error);
        res.status(500).json({ error: 'Error fetching RSVP summary' });
    }
};

// Get poll (date proposal) summary for an event
const getEventPollSummary = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id).populate('dateProposals.proposedBy', 'firstName lastName email').populate('dateProposals.votes', 'firstName lastName email');
        if (!event) return res.status(404).json({ error: 'Event not found' });
        const poll = event.dateProposals.map(p => ({
            date: p.date,
            proposedBy: p.proposedBy ? {
                id: p.proposedBy._id,
                name: `${p.proposedBy.firstName} ${p.proposedBy.lastName}`,
                email: p.proposedBy.email
            } : null,
            votes: p.votes.map(v => ({
                id: v._id,
                name: `${v.firstName} ${v.lastName}`,
                email: v.email
            })),
            voteCount: p.votes.length
        }));
        res.json({ proposals: poll });
    } catch (error) {
        console.error('Poll summary error:', error);
        res.status(500).json({ error: 'Error fetching poll summary' });
    }
};

module.exports = {
    getEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    getEventRSVPSummary,
    getEventPollSummary
}; 