const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        const token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token) {
            throw new Error();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: decoded.user.id });

        if (!user) {
            throw new Error();
        }

        req.token = token;
        req.user = user;
        next();
    } catch (error) {
        res.status(401).json({ error: 'Please authenticate.' });
    }
};

const checkRole = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Please authenticate.' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Access denied.' });
        }

        next();
    };
};

const verifyApplicationCode = async (req, res, next) => {
    try {
        const { applicationCode } = req.body;
        
        if (!applicationCode) {
            return res.status(400).json({ error: 'Application code is required.' });
        }

        // Check if application code exists and hasn't been used
        const existingUser = await User.findOne({ applicationCode });
        if (existingUser) {
            return res.status(400).json({ error: 'Application code has already been used.' });
        }

        next();
    } catch (error) {
        res.status(500).json({ error: 'Server error.' });
    }
};

module.exports = {
    auth,
    checkRole,
    verifyApplicationCode
}; 