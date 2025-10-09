const { Residence } = require('../../models/Residence');
const User = require('../../models/User');

// Get all residences (for finance)
exports.getAllResidences = async (req, res) => {
    try {
        const residences = await Residence.find().populate('manager', 'firstName lastName email');
        res.json(residences);
    } catch (error) {
        console.error('Finance: Error in getAllResidences:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get single residence (for finance)
exports.getResidence = async (req, res) => {
    try {
        const residence = await Residence.findById(req.params.id).populate('manager', 'firstName lastName email');
        if (!residence) {
            return res.status(404).json({ error: 'Residence not found' });
        }
        res.json(residence);
    } catch (error) {
        console.error('Finance: Error in getResidence:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 