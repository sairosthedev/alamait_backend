const Maintenance = require('../models/Maintenance');
const Expense = require('../models/finance/Expense');
const { generateUniqueId } = require('../utils/idGenerator');

// Get all maintenance requests
exports.getAllMaintenance = async (req, res) => {
    try {
        const maintenance = await Maintenance.find()
            .sort({ dateAssigned: -1 })
            .populate('requestedBy', 'firstName lastName email role')
            .populate('student', 'firstName lastName email');
        res.status(200).json(maintenance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get maintenance request by ID
exports.getMaintenanceById = async (req, res) => {
    try {
        const maintenance = await Maintenance.findById(req.params.id)
            .populate('requestedBy', 'firstName lastName email role')
            .populate('student', 'firstName lastName email');
        if (!maintenance) {
            return res.status(404).json({ message: 'Maintenance request not found' });
        }
        res.status(200).json(maintenance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Create new maintenance request
exports.createMaintenance = async (req, res) => {
    try {
        // Accept both 'issue' and 'title' (map 'title' to 'issue' if 'issue' is missing)
        let { issue, title, description, room, category, priority, residence, residenceId, assignedTo, amount, laborCost, paymentMethod, paymentIcon } = req.body;

        // Map 'title' to 'issue' if 'issue' is not provided
        if (!issue && title) {
            issue = title;
        }

        // Accept 'residenceId' as an alias for 'residence'
        if (!residence && residenceId) {
            residence = residenceId;
        }

        // Validate required fields
        if (!issue || !description || !room || !residence) {
            return res.status(400).json({ message: 'Missing required fields: issue, description, room, or residence' });
        }

        // Validate payment method if provided
        if (paymentMethod) {
            const validPaymentMethods = ['Bank Transfer', 'Cash', 'Online Payment', 'Ecocash', 'Innbucks', 'MasterCard', 'Visa', 'PayPal'];
            const normalizedPaymentMethod = paymentMethod.toLowerCase();
            const validLowercaseMethods = validPaymentMethods.map(method => method.toLowerCase());
            
            if (!validLowercaseMethods.includes(normalizedPaymentMethod)) {
                return res.status(400).json({ 
                    message: 'Invalid payment method',
                    validPaymentMethods: validPaymentMethods
                });
            }
            
            // Normalize to title case
            const mapping = {
                'bank transfer': 'Bank Transfer',
                'cash': 'Cash',
                'online payment': 'Online Payment',
                'ecocash': 'Ecocash',
                'innbucks': 'Innbucks',
                'mastercard': 'MasterCard',
                'visa': 'Visa',
                'paypal': 'PayPal'
            };
            paymentMethod = mapping[normalizedPaymentMethod];
        }

        // Always set requestedBy from the authenticated user
        const requestedBy = req.user ? req.user._id : undefined;

        // Build the maintenance request data
        const maintenanceData = {
            issue,
            description,
            room,
            category,
            priority,
            residence,
            status: 'pending',
            requestDate: new Date(),
            requestedBy,
            amount: amount ? parseFloat(amount) : 0,
            laborCost: laborCost ? parseFloat(laborCost) : 0,
            paymentMethod,
            paymentIcon
        };

        // If assignedTo is provided, set it
        if (assignedTo && assignedTo._id) {
            maintenanceData.assignedTo = {
                _id: assignedTo._id,
                name: assignedTo.name,
                surname: assignedTo.surname,
                role: assignedTo.role
            };
        }

        const maintenance = new Maintenance(maintenanceData);
        const savedMaintenance = await maintenance.save();

        // Populate requestedBy for the response
        await savedMaintenance.populate('requestedBy', 'firstName lastName email role');
        res.status(201).json(savedMaintenance);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

// Update maintenance request
exports.updateMaintenance = async (req, res) => {
    try {
        const { financeStatus, amount, paymentMethod, paymentIcon } = req.body;
        
        // Check if financeStatus is being updated to 'approved'
        const maintenance = await Maintenance.findById(req.params.id);
        if (!maintenance) {
            return res.status(404).json({ message: 'Maintenance request not found' });
        }

        // If financeStatus is being set to 'approved' and amount is provided, create an expense
        if (financeStatus === 'approved' && amount && amount > 0) {
            try {
                // Delete any existing expense for this maintenance request
                await Expense.deleteMany({ maintenanceRequestId: maintenance._id });

                // Generate unique expense ID
                const expenseId = await generateUniqueId('EXP');

                // Create expense data
                const expenseData = {
                    expenseId,
                    residence: maintenance.residence,
                    category: 'Maintenance',
                    amount: parseFloat(amount),
                    description: `Maintenance: ${maintenance.issue} - ${maintenance.description}`,
                    expenseDate: new Date(),
                    paymentStatus: 'Pending',
                    createdBy: req.user._id,
                    period: 'monthly',
                    paymentMethod: paymentMethod || maintenance.paymentMethod || 'Bank Transfer',
                    paymentIcon: paymentIcon || maintenance.paymentIcon,
                    maintenanceRequestId: maintenance._id
                };

                // Create the expense
                const newExpense = new Expense(expenseData);
                await newExpense.save();

                console.log(`Expense created for maintenance request ${maintenance._id}: ${expenseId}`);
            } catch (expenseError) {
                console.error('Error creating expense for maintenance:', expenseError);
                // Continue with maintenance update even if expense creation fails
            }
        }

        // Update the maintenance request
        const updatedMaintenance = await Maintenance.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        res.status(200).json(updatedMaintenance);
    } catch (error) {
        console.error('Error updating maintenance:', error);
        res.status(400).json({ message: error.message });
    }
};

// Delete maintenance request
exports.deleteMaintenance = async (req, res) => {
    try {
        const maintenance = await Maintenance.findByIdAndDelete(req.params.id);
        if (!maintenance) {
            return res.status(404).json({ message: 'Maintenance request not found' });
        }
        res.status(200).json({ message: 'Maintenance request deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get maintenance requests by status
exports.getMaintenanceByStatus = async (req, res) => {
    try {
        const maintenance = await Maintenance.find({ status: req.params.status })
            .sort({ dateAssigned: -1 })
            .populate('requestedBy', 'firstName lastName email role')
            .populate('student', 'firstName lastName email');
        res.status(200).json(maintenance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get maintenance requests by room
exports.getMaintenanceByRoom = async (req, res) => {
    try {
        const maintenance = await Maintenance.find({ room: req.params.room })
            .sort({ dateAssigned: -1 })
            .populate('requestedBy', 'firstName lastName email role')
            .populate('student', 'firstName lastName email');
        res.status(200).json(maintenance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get maintenance requests by priority
exports.getMaintenanceByPriority = async (req, res) => {
    try {
        const maintenance = await Maintenance.find({ priority: req.params.priority })
            .sort({ dateAssigned: -1 })
            .populate('requestedBy', 'firstName lastName email role')
            .populate('student', 'firstName lastName email');
        res.status(200).json(maintenance);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Add update to request history
exports.addRequestHistory = async (req, res) => {
    try {
        const maintenance = await Maintenance.findById(req.params.id);
        if (!maintenance) {
            return res.status(404).json({ message: 'Maintenance request not found' });
        }
        
        maintenance.requestHistory.push({
            date: new Date(),
            action: req.body.action,
            user: req.body.user
        });
        
        const updatedMaintenance = await maintenance.save();
        res.status(200).json(updatedMaintenance);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
}; 