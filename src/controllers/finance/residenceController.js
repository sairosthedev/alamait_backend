const { Residence } = require('../../models/Residence');
const cacheService = require('../../services/cacheService');

const FINANCE_RESIDENCE_SELECT = [
    'name',
    'address',
    'status',
    'manager',
    'rooms.roomNumber',
    'rooms.type',
    'rooms.price',
    'rooms.status',
    'rooms.capacity',
    'rooms.occupied',
    'rooms.currentOccupants'
].join(' ');

// Get all residences (for finance) — slim projection, no images/rules/amenities
exports.getAllResidences = async (req, res) => {
    try {
        const cacheKey = 'finance-residences:slim:v2';

        const cached = await cacheService.getOrSet(cacheKey, 600, async () => {
            return Residence.find()
                .select(FINANCE_RESIDENCE_SELECT)
                .populate('manager', 'firstName lastName email')
                .lean();
        });

        res.set('Cache-Control', 'private, max-age=300');
        res.json(cached);
    } catch (error) {
        console.error('Finance: Error in getAllResidences:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get single residence (for finance)
exports.getResidence = async (req, res) => {
    try {
        const residence = await Residence.findById(req.params.id)
            .select(FINANCE_RESIDENCE_SELECT)
            .populate('manager', 'firstName lastName email')
            .lean();
        if (!residence) {
            return res.status(404).json({ error: 'Residence not found' });
        }
        res.json(residence);
    } catch (error) {
        console.error('Finance: Error in getResidence:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
