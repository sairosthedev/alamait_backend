const Event = require('../../models/Event');
const Residence = require('../../models/Residence');
const { validationResult } = require('express-validator');

// Get events for managed residences
exports.getEvents = async (req, res) => {
    try {
        // Get all residences managed by the property manager
        const managedResidences = await Residence.find({ manager: req.user._id });
        const residenceIds = managedResidences.map(residence => residence._id);

        const { status, category, date } = req.query;
        let query = { residence: { $in: residenceIds } };

        if (status) query.status = status;
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
        console.error('Get events error:', error);
        res.status(500).json({ error: 'Error fetching events' });
    }
};

// Get single event
exports.getEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('residence', 'name location manager')
            .populate('organizer', 'firstName lastName')
            .populate('participants.student', 'firstName lastName email')
            .populate('feedback.student', 'firstName lastName');

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Check if user manages this residence
        if (event.residence.manager.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        res.json(event);
    } catch (error) {
        console.error('Get event error:', error);
        res.status(500).json({ error: 'Error fetching event' });
    }
};

// Create event
exports.createEvent = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        // Verify residence is managed by user
        const residence = await Residence.findOne({
            _id: req.body.residence,
            manager: req.user._id
        });

        if (!residence) {
            return res.status(404).json({ error: 'Residence not found or not authorized' });
        }

        const event = new Event({
            ...req.body,
            organizer: req.user._id
        });

        await event.save();

        const populatedEvent = await Event.findById(event._id)
            .populate('residence', 'name location')
            .populate('organizer', 'firstName lastName');

        res.status(201).json(populatedEvent);
    } catch (error) {
        console.error('Create event error:', error);
        res.status(500).json({ error: 'Error creating event' });
    }
};

// Update event
exports.updateEvent = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const event = await Event.findById(req.params.id)
            .populate('residence', 'manager');

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Check if user manages this residence
        if (event.residence.manager.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        // Update allowed fields
        const allowedUpdates = [
            'title', 'description', 'date', 'startTime', 'endTime',
            'location', 'category', 'capacity', 'status', 'requirements',
            'resources'
        ];

        allowedUpdates.forEach(update => {
            if (req.body[update] !== undefined) {
                event[update] = req.body[update];
            }
        });

        await event.save();

        const updatedEvent = await Event.findById(req.params.id)
            .populate('residence', 'name location')
            .populate('organizer', 'firstName lastName');

        res.json(updatedEvent);
    } catch (error) {
        console.error('Update event error:', error);
        res.status(500).json({ error: 'Error updating event' });
    }
};

// Cancel event
exports.cancelEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id)
            .populate('residence', 'manager');

        if (!event) {
            return res.status(404).json({ error: 'Event not found' });
        }

        // Check if user manages this residence
        if (event.residence.manager.toString() !== req.user._id.toString()) {
            return res.status(403).json({ error: 'Not authorized' });
        }

        event.status = 'cancelled';
        await event.save();

        res.json({ message: 'Event cancelled successfully' });
    } catch (error) {
        console.error('Cancel event error:', error);
        res.status(500).json({ error: 'Error cancelling event' });
    }
};

// Get event statistics
exports.getEventStats = async (req, res) => {
    try {
        // Get all residences managed by the property manager
        const managedResidences = await Residence.find({ manager: req.user._id });
        const residenceIds = managedResidences.map(residence => residence._id);

        const stats = await Event.aggregate([
            {
                $match: {
                    residence: { $in: residenceIds }
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    avgParticipants: {
                        $avg: {
                            $size: {
                                $filter: {
                                    input: '$participants',
                                    as: 'participant',
                                    cond: { $eq: ['$$participant.status', 'registered'] }
                                }
                            }
                        }
                    }
                }
            }
        ]);

        const categoryStats = await Event.aggregate([
            {
                $match: {
                    residence: { $in: residenceIds }
                }
            },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    avgRating: {
                        $avg: {
                            $avg: '$feedback.rating'
                        }
                    }
                }
            }
        ]);

        res.json({
            statusStats: stats,
            categoryStats
        });
    } catch (error) {
        console.error('Get event stats error:', error);
        res.status(500).json({ error: 'Error fetching event statistics' });
    }
}; 