const { validationResult } = require('express-validator');
const Residence = require('../../models/Residence');

// Add new residence
exports.addResidence = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const residence = new Residence({
            ...req.body,
            manager: req.user._id // Set the current admin user as manager
        });

        await residence.save();
        res.status(201).json(residence);
    } catch (error) {
        console.error('Error in addResidence:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get all residences
exports.getAllResidences = async (req, res) => {
    try {
        const residences = await Residence.find().populate('manager', 'firstName lastName email');
        res.json(residences);
    } catch (error) {
        console.error('Error in getAllResidences:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get single residence
exports.getResidence = async (req, res) => {
    try {
        const residence = await Residence.findById(req.params.id).populate('manager', 'firstName lastName email');
        if (!residence) {
            return res.status(404).json({ error: 'Residence not found' });
        }
        res.json(residence);
    } catch (error) {
        console.error('Error in getResidence:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Update residence
exports.updateResidence = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }

        const residence = await Residence.findByIdAndUpdate(
            req.params.id,
            { ...req.body },
            { new: true, runValidators: true }
        ).populate('manager', 'firstName lastName email');

        if (!residence) {
            return res.status(404).json({ error: 'Residence not found' });
        }

        res.json(residence);
    } catch (error) {
        console.error('Error in updateResidence:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Delete residence
exports.deleteResidence = async (req, res) => {
    try {
        const residence = await Residence.findByIdAndDelete(req.params.id);
        if (!residence) {
            return res.status(404).json({ error: 'Residence not found' });
        }
        res.json({ message: 'Residence deleted successfully' });
    } catch (error) {
        console.error('Error in deleteResidence:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 