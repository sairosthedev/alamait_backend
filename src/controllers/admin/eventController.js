const Event = require('../../models/Event');

// Create a new event
const createEvent = async (req, res) => {
    try {
        const { title, date, time, location, category, description, status, startTime, endTime } = req.body;
        
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
            resources: []
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
        const events = await Event.find().populate('residence');
        res.json(events);
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