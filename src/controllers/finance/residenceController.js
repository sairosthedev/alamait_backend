const { Residence } = require('../../models/Residence');
const User = require('../../models/User');
const cacheService = require('../../services/cacheService');

// Get all residences (for finance)
// OPTIMIZED: Added caching and lean() for better performance
exports.getAllResidences = async (req, res) => {
    try {
        const cacheKey = 'finance-residences';
        
        // Try cache first (5 minute TTL)
        const cached = await cacheService.getOrSet(cacheKey, 300, async () => {
            // Use lean() for better performance (returns plain objects, not Mongoose documents)
            const residences = await Residence.find()
                .populate('manager', 'firstName lastName email')
                .lean();
            return residences;
        });
        
        res.json(cached);
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