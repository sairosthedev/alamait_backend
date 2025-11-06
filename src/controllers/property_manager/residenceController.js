const { Residence } = require('../../models/Residence');
const { validationResult } = require('express-validator');

// Get managed residences
exports.getManagedResidences = async (req, res) => {
    try {
        const residences = await Residence.find({ manager: req.user._id })
            .sort('name');

        res.json(residences);
    } catch (error) {
        console.error('Get managed residences error:', error);
        res.status(500).json({ error: 'Error fetching residences' });
    }
};

// Get single residence
exports.getResidence = async (req, res) => {
    try {
        const residence = await Residence.findOne({
            _id: req.params.id,
            manager: req.user._id
        });

        if (!residence) {
            return res.status(404).json({ error: 'Residence not found' });
        }

        res.json(residence);
    } catch (error) {
        console.error('Get residence error:', error);
        res.status(500).json({ error: 'Error fetching residence' });
    }
};

// Create residence
exports.createResidence = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const residence = new Residence({
            ...req.body,
            manager: req.user._id
        });

        await residence.save();
        res.status(201).json(residence);
    } catch (error) {
        console.error('Create residence error:', error);
        res.status(500).json({ error: 'Error creating residence' });
    }
};

// Update residence
exports.updateResidence = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const residence = await Residence.findOne({
            _id: req.params.id,
            manager: req.user._id
        });

        if (!residence) {
            return res.status(404).json({ error: 'Residence not found' });
        }

        // Update allowed fields
        const allowedUpdates = [
            'name', 'description', 'address', 'amenities', 
            'rules', 'features', 'status', 'contactInfo'
        ];

        allowedUpdates.forEach(update => {
            if (req.body[update] !== undefined) {
                residence[update] = req.body[update];
            }
        });

        await residence.save();
        res.json(residence);
    } catch (error) {
        console.error('Update residence error:', error);
        res.status(500).json({ error: 'Error updating residence' });
    }
};

// Add room to residence
exports.addRoom = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const residence = await Residence.findOne({
            _id: req.params.id,
            manager: req.user._id
        });

        if (!residence) {
            return res.status(404).json({ error: 'Residence not found' });
        }

        // Check if room number already exists
        if (residence.rooms.some(room => room.roomNumber === req.body.roomNumber)) {
            return res.status(400).json({ error: 'Room number already exists' });
        }

        residence.rooms.push(req.body);
        await residence.save();

        res.status(201).json(residence);
    } catch (error) {
        console.error('Add room error:', error);
        res.status(500).json({ error: 'Error adding room' });
    }
};

// Update room
exports.updateRoom = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const residence = await Residence.findOne({
            _id: req.params.residenceId,
            manager: req.user._id
        });

        if (!residence) {
            return res.status(404).json({ error: 'Residence not found' });
        }

        const roomIndex = residence.rooms.findIndex(
            room => room.roomNumber === req.params.roomNumber
        );

        if (roomIndex === -1) {
            return res.status(404).json({ error: 'Room not found' });
        }

        const oldRoomNumber = residence.rooms[roomIndex].roomNumber;
        const newRoomNumber = req.body.roomNumber;

        // Check if room number is being changed
        const roomNumberChanged = newRoomNumber && newRoomNumber !== oldRoomNumber;

        // Update allowed room fields (including roomNumber if provided)
        const allowedUpdates = ['type', 'price', 'status', 'features', 'roomNumber'];
        allowedUpdates.forEach(update => {
            if (req.body[update] !== undefined) {
                residence.rooms[roomIndex][update] = req.body[update];
            }
        });

        await residence.save();

        // Cascade update all related documents if room number changed
        let cascadeUpdateResult = null;
        if (roomNumberChanged) {
            try {
                const RoomUpdateService = require('../../services/roomUpdateService');
                cascadeUpdateResult = await RoomUpdateService.cascadeUpdateRoomNumber(
                    req.params.residenceId,
                    oldRoomNumber,
                    newRoomNumber
                );
                console.log('✅ Cascade update completed:', cascadeUpdateResult);
            } catch (cascadeError) {
                console.error('⚠️ Error in cascade update (room still updated):', cascadeError);
                // Don't fail the request if cascade update fails, but log it
            }
        }

        res.json({
            ...residence.rooms[roomIndex].toObject(),
            cascadeUpdate: cascadeUpdateResult || undefined
        });
    } catch (error) {
        console.error('Update room error:', error);
        res.status(500).json({ error: 'Error updating room' });
    }
};

// Get room availability
exports.getRoomAvailability = async (req, res) => {
    try {
        const residence = await Residence.findOne({
            _id: req.params.residenceId,
            manager: req.user._id
        });

        if (!residence) {
            return res.status(404).json({ error: 'Residence not found' });
        }

        const room = residence.rooms.find(
            room => room.roomNumber === req.params.roomNumber
        );

        if (!room) {
            return res.status(404).json({ error: 'Room not found' });
        }

        const availability = {
            roomNumber: room.roomNumber,
            status: room.status,
            isAvailable: room.status === 'available'
        };

        res.json(availability);
    } catch (error) {
        console.error('Get room availability error:', error);
        res.status(500).json({ error: 'Error checking room availability' });
    }
}; 