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

module.exports = {
    getEvents,
    createEvent,
    updateEvent,
    deleteEvent
}; 