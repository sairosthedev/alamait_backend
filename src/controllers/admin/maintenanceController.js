const { validationResult } = require('express-validator');
const Maintenance = require('../../models/Maintenance');
const User = require('../../models/User');
const mongoose = require('mongoose');

// Get maintenance dashboard stats
exports.getMaintenanceStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
            openRequests,
            highPriorityCount,
            inProgressCount,
            completedToday
        ] = await Promise.all([
            Maintenance.countDocuments({ status: { $ne: 'completed' } }),
            Maintenance.countDocuments({ priority: 'high', status: { $ne: 'completed' } }),
            Maintenance.countDocuments({ status: 'in-progress' }),
            Maintenance.countDocuments({
                status: 'completed',
                completedDate: {
                    $gte: today,
                    $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
                }
            })
        ]);

        res.json({
            openRequests,
            highPriorityCount,
            inProgressCount,
            completedToday
        });
    } catch (error) {
        console.error('Error in getMaintenanceStats:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get all maintenance requests
exports.getAllMaintenanceRequests = async (req, res) => {
    try {
        const { status, priority, search, page = 1, limit = 10 } = req.query;
        const query = {};

        if (status && status !== 'all') {
            query.status = status;
        }
        if (priority) {
            query.priority = priority;
        }
        if (search) {
            query.$or = [
                { title: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { location: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (page - 1) * limit;

        console.log('Fetching maintenance requests with query:', query);

        // First, get all maintenance requests
        const [requests, total] = await Promise.all([
            Maintenance.find(query)
                .sort({ requestDate: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('student', 'firstName lastName')
                .populate('residence', 'name')
                .populate('updates.author', 'firstName lastName')
                .lean(),
            Maintenance.countDocuments(query)
        ]);

        console.log('Found requests:', requests.length);

        // Get all unique staff IDs from the requests
        const staffIds = [...new Set(requests
            .filter(req => req.assignedTo)
            .map(req => req.assignedTo)
        )];

        console.log('Staff IDs to fetch:', staffIds);

        // Fetch all staff members in one query
        const staffMembers = await User.find({
            _id: { $in: staffIds },
            role: 'maintenance_staff'
        }).select('firstName lastName role').lean();

        console.log('Fetched staff members:', staffMembers);

        // Create a map of staff members by ID for quick lookup
        const staffMap = staffMembers.reduce((map, staff) => {
            map[staff._id.toString()] = {
                _id: staff._id,
                name: staff.firstName,
                surname: staff.lastName,
                role: staff.role
            };
            return map;
        }, {});

        console.log('Staff map created:', staffMap);

        // Transform requests to match frontend format
        const transformedRequests = requests.map(request => {
            // Get staff details from the map using the assignedTo ID
            const assignedTo = request.assignedTo ? staffMap[request.assignedTo.toString()] : null;

            console.log('Processing request:', {
                requestId: request._id,
                assignedToId: request.assignedTo,
                assignedToDetails: assignedTo
            });

            return {
                _id: request._id,
                id: request.id,
                room: request.room,
                issue: request.issue,
                description: request.description,
                requestedBy: request.requestedBy,
                status: request.status,
                dateAssigned: request.dateAssigned,
                expectedCompletion: request.expectedCompletion,
                amount: request.materials !== null && request.materials !== undefined ? request.materials : 0,
                laborCost: request.labour !== null && request.labour !== undefined ? request.labour : 0,
                priority: request.priority,
                studentResponse: request.studentResponse,
                financeStatus: request.financeStatus,
                financeNotes: request.financeNotes,
                adminNotes: request.adminNotes,
                requestHistory: request.requestHistory,
                assignedTo: assignedTo,
                updatedAt: request.updatedAt
            };
        });

        // Log the final transformed data
        console.log('Sample transformed request:', {
            _id: transformedRequests[0]?._id,
            assignedTo: transformedRequests[0]?.assignedTo
        });

        res.json({
            requests: transformedRequests,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        console.error('Error in getAllMaintenanceRequests:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Server error' });
    }
};

// Create maintenance request
exports.createMaintenanceRequest = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const {
            id,
            room,
            issue,
            description,
            requestedBy,
            status,
            dateAssigned,
            expectedCompletion,
            amount,
            laborCost,
            priority,
            studentResponse,
            financeStatus,
            financeNotes,
            adminNotes,
            requestHistory,
            assignedTo
        } = req.body;

        console.log('Received request data:', {
            room,
            issue,
            description,
            requestedBy,
            dateAssigned,
            expectedCompletion,
            amount,
            laborCost,
            assignedTo
        });

        // Validate required fields
        if (!issue || !description || !room) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields',
                message: 'Issue, description, and room are required'
            });
        }

        // Find the student by name
        const student = await mongoose.model('User').findOne({
            firstName: requestedBy.split(' ')[0],
            lastName: requestedBy.split(' ')[1],
            role: 'student',
            'residence.roomNumber': room
        });

        if (!student) {
            return res.status(400).json({
                success: false,
                error: 'Invalid student',
                message: 'The selected student is not assigned to the specified room'
            });
        }

        // If assignedTo is provided, validate the staff member
        let staffMember = null;
        if (assignedTo) {
            staffMember = await User.findById(assignedTo);
            if (!staffMember || staffMember.role !== 'maintenance_staff') {
                return res.status(400).json({
                    success: false,
                    error: 'Invalid staff member',
                    message: 'The assigned staff member is not valid'
                });
            }
        }

        // Create maintenance request data
        const maintenanceData = {
            issue,
            description,
            room,
            student: student._id,
            status: status?.toLowerCase() || 'pending',
            priority: priority?.toLowerCase() || 'low',
            category: 'other',
            // Map financial fields
            materials: amount ? parseFloat(amount) : 0,
            labour: laborCost ? parseFloat(laborCost) : 0,
            // Map date fields
            requestDate: dateAssigned ? new Date(dateAssigned) : new Date(),
            scheduledDate: dateAssigned ? new Date(dateAssigned) : undefined,
            estimatedCompletion: expectedCompletion ? new Date(expectedCompletion) : undefined,
            financeStatus: financeStatus?.toLowerCase() || 'pending',
            financeNotes,
            // Handle assignedTo with staff details
            assignedTo: staffMember ? {
                _id: staffMember._id,
                name: staffMember.firstName,
                surname: staffMember.lastName,
                role: staffMember.role
            } : undefined,
            updates: [{
                message: adminNotes || 'Maintenance request created',
                author: req.user._id,
                date: new Date()
            }],
            requestHistory: requestHistory?.map(history => ({
                date: new Date(history.date),
                action: history.action,
                user: req.user._id,
                changes: [history.action.toLowerCase().replace(/\s+/g, '-')]
            })) || [{
                date: new Date(),
                action: 'Request created',
                user: req.user._id,
                changes: ['created']
            }]
        };

        console.log('Creating maintenance request with data:', {
            ...maintenanceData,
            estimatedCost: maintenanceData.estimatedCost,
            actualCost: maintenanceData.actualCost,
            requestDate: maintenanceData.requestDate,
            scheduledDate: maintenanceData.scheduledDate,
            estimatedCompletion: maintenanceData.estimatedCompletion,
            assignedTo: maintenanceData.assignedTo
        });

        // Create the maintenance request
        const request = new Maintenance(maintenanceData);

        // Log the request object before saving
        console.log('Maintenance request object before save:', {
            room: request.room,
            issue: request.issue,
            description: request.description,
            estimatedCost: request.estimatedCost,
            actualCost: request.actualCost,
            requestDate: request.requestDate,
            scheduledDate: request.scheduledDate,
            estimatedCompletion: request.estimatedCompletion,
            assignedTo: request.assignedTo
        });

        await request.save();

        // Populate the created request with student details and add additional fields
        const populatedRequest = await Maintenance.findById(request._id)
            .populate('student', 'firstName lastName')
            .populate('updates.author', 'firstName lastName');

        // Format dates to ISO string
        const formatDate = (date) => {
            return date ? new Date(date).toISOString().split('T')[0] : null;
        };

        // Transform the response to include additional fields
        const transformedRequest = {
            ...populatedRequest.toObject(),
            id: populatedRequest._id,
            room: populatedRequest.room,
            requestedBy: `${populatedRequest.student.firstName} ${populatedRequest.student.lastName}`,
            studentId: populatedRequest.student._id,
            studentName: `${populatedRequest.student.firstName} ${populatedRequest.student.lastName}`,
            roomNumber: populatedRequest.room,
            issue: populatedRequest.issue,
            status: populatedRequest.status,
            priority: populatedRequest.priority,
            description: populatedRequest.description,
            dateRequested: formatDate(populatedRequest.requestDate),
            dateAssigned: formatDate(populatedRequest.scheduledDate),
            expectedCompletion: formatDate(populatedRequest.estimatedCompletion),
            amount: populatedRequest.materials !== null && populatedRequest.materials !== undefined ? populatedRequest.materials : 0,
            laborCost: populatedRequest.labour !== null && populatedRequest.labour !== undefined ? populatedRequest.labour : 0,
            financeStatus: populatedRequest.financeStatus,
            financeNotes: populatedRequest.financeNotes,
            adminNotes: populatedRequest.updates[0]?.message,
            requestHistory: populatedRequest.requestHistory.map(history => ({
                date: formatDate(history.date),
                action: history.action,
                user: history.user
            })),
            assignedTo: populatedRequest.assignedTo ? {
                _id: populatedRequest.assignedTo._id,
                name: populatedRequest.assignedTo.name,
                surname: populatedRequest.assignedTo.surname
            } : null
        };

        res.status(201).json({
            success: true,
            message: 'Maintenance request created successfully',
            request: transformedRequest
        });
    } catch (error) {
        console.error('Error in createMaintenanceRequest:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack
        });
        res.status(500).json({ 
            success: false,
            error: 'Server error',
            message: error.message 
        });
    }
};

// Update maintenance request
exports.updateMaintenanceRequest = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const requestId = req.params.requestId;
        console.log('Received request ID:', requestId);

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            console.log('Invalid request ID format:', requestId);
            return res.status(400).json({
                success: false,
                error: 'Invalid request ID format',
                message: 'The provided request ID is not a valid MongoDB ObjectId'
            });
        }

        const objectId = new mongoose.Types.ObjectId(requestId);
        console.log('Converted to ObjectId:', objectId);

        const {
            status,
            assignedTo,
            estimatedCompletion,
            priority,
            category,
            description,
            comment,
            materials,
            labour,
            scheduledDate,
            financeStatus
        } = req.body;

        console.log('Raw request body:', req.body);
        console.log('Parsed update data:', {
            status,
            assignedTo,
            estimatedCompletion,
            priority,
            category,
            description,
            comment,
            materials,
            labour,
            scheduledDate,
            financeStatus
        });

        // Find the request and ensure it exists
        const request = await Maintenance.findById(objectId);
        if (!request) {
            console.log('Maintenance request not found');
            return res.status(404).json({
                success: false,
                error: 'Maintenance request not found',
                message: 'No maintenance request found with the provided ID'
            });
        }

        console.log('Found existing request:', {
            _id: request._id,
            status: request.status,
            assignedTo: request.assignedTo
        });

        // Create updates object
        const updates = {};
        const changes = [];

        if (status) {
            updates.status = status;
            changes.push('status');
            if (status === 'completed') {
                updates.completedDate = new Date();
                changes.push('completedDate');
            }
        }

        // Handle assignedTo update
        if (assignedTo) {
            console.log('Processing assignedTo:', assignedTo);
            
            // Validate assignedTo ID
            if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
                console.log('Invalid assignedTo ID format:', assignedTo);
                return res.status(400).json({
                    success: false,
                    error: 'Invalid assignedTo ID',
                    message: 'The provided assignedTo ID is not a valid MongoDB ObjectId'
                });
            }

            // Verify staff member exists and has correct role
            const staff = await User.findById(assignedTo);
            if (!staff || staff.role !== 'maintenance_staff') {
                console.log('Invalid staff member:', staff);
                return res.status(400).json({
                    success: false,
                    error: 'Invalid staff member',
                    message: 'The provided staff ID does not belong to a maintenance staff member'
                });
            }

            console.log('Valid staff member found:', {
                _id: staff._id,
                name: `${staff.firstName} ${staff.lastName}`,
                role: staff.role
            });
            
            // Update assignedTo field with both ID and staff details
            updates.assignedTo = {
                _id: staff._id,
                name: staff.firstName,
                surname: staff.lastName,
                role: staff.role
            };
            changes.push('assignedTo');

            // Update status to assigned if not already set
            if (!status || status === 'pending') {
                updates.status = 'assigned';
                changes.push('status');
            }
        }

        if (estimatedCompletion) {
            updates.estimatedCompletion = new Date(estimatedCompletion);
            changes.push('estimatedCompletion');
        }
        if (priority) {
            updates.priority = priority;
            changes.push('priority');
        }
        if (category) {
            updates.category = category;
            changes.push('category');
        }
        if (description) {
            updates.description = description;
            changes.push('description');
        }
        if (materials) {
            updates.materials = parseFloat(materials);
            changes.push('materials');
        }
        if (labour) {
            updates.labour = parseFloat(labour);
            changes.push('labour');
        }
        if (scheduledDate) {
            updates.scheduledDate = new Date(scheduledDate);
            changes.push('scheduledDate');
        }
        if (financeStatus) {
            updates.financeStatus = financeStatus.toLowerCase();
            changes.push('financeStatus');
        }

        console.log('Final updates object:', updates);
        console.log('Changes to be tracked:', changes);

        // Apply updates using findByIdAndUpdate for atomic operation
        const updateOperation = {
            $set: updates
        };

        // Add updates array push if comment exists
        if (comment) {
            updateOperation.$push = {
                updates: {
                    message: comment,
                    author: req.user._id,
                    date: new Date()
                }
            };
        }

        // Always add to request history
        if (!updateOperation.$push) {
            updateOperation.$push = {};
        }
        updateOperation.$push.requestHistory = {
            date: new Date(),
            action: 'Request updated',
            user: req.user._id,
            changes: changes
        };

        console.log('MongoDB update operation:', JSON.stringify(updateOperation, null, 2));

        console.log('About to perform update with operation:', {
            requestId: objectId,
            updateOperation: updateOperation,
            changes: changes
        });

        const updatedRequest = await Maintenance.findByIdAndUpdate(
            objectId,
            updateOperation,
            {
                new: true,
                runValidators: true
            }
        )
        .populate('student', 'firstName lastName')
        .populate('residence', 'name')
        .populate('updates.author', 'firstName lastName');

        if (!updatedRequest) {
            console.log('Failed to update maintenance request');
            return res.status(500).json({
                success: false,
                error: 'Update failed',
                message: 'Failed to update maintenance request'
            });
        }

        console.log('Maintenance request updated successfully:', {
            _id: updatedRequest._id,
            status: updatedRequest.status,
            assignedTo: updatedRequest.assignedTo
        });

        // Verify the update in MongoDB
        const verifyRequest = await Maintenance.findById(objectId);
        console.log('Verification - Updated fields:', changes.map(field => ({
            field,
            oldValue: request[field],
            newValue: verifyRequest[field]
        })));

        // Transform the response to include frontend-expected fields
        const formatDate = (date) => {
            return date ? new Date(date).toISOString().split('T')[0] : null;
        };

        const transformedResponse = {
            ...updatedRequest.toObject(),
            id: updatedRequest._id,
            room: updatedRequest.room,
            requestedBy: updatedRequest.student ? `${updatedRequest.student.firstName} ${updatedRequest.student.lastName}` : 'Unknown',
            studentId: updatedRequest.student?._id,
            studentName: updatedRequest.student ? `${updatedRequest.student.firstName} ${updatedRequest.student.lastName}` : 'Unknown',
            roomNumber: updatedRequest.room,
            issue: updatedRequest.issue,
            status: updatedRequest.status,
            priority: updatedRequest.priority,
            description: updatedRequest.description,
            dateRequested: formatDate(updatedRequest.requestDate),
            dateAssigned: formatDate(updatedRequest.scheduledDate),
            expectedCompletion: formatDate(updatedRequest.estimatedCompletion),
            amount: updatedRequest.materials !== null && updatedRequest.materials !== undefined ? updatedRequest.materials : 0,
            laborCost: updatedRequest.labour !== null && updatedRequest.labour !== undefined ? updatedRequest.labour : 0,
            financeStatus: updatedRequest.financeStatus,
            financeNotes: updatedRequest.financeNotes,
            adminNotes: updatedRequest.updates?.[0]?.message,
            requestHistory: updatedRequest.requestHistory?.map(history => ({
                date: formatDate(history.date),
                action: history.action,
                user: history.user
            })) || [],
            assignedTo: updatedRequest.assignedTo ? {
                _id: updatedRequest.assignedTo._id,
                name: updatedRequest.assignedTo.name,
                surname: updatedRequest.assignedTo.surname
            } : null
        };

        res.json({
            success: true,
            message: 'Maintenance request updated successfully',
            request: transformedResponse
        });
    } catch (error) {
        console.error('Error in updateMaintenanceRequest:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ 
            success: false,
            error: 'Server error',
            message: error.message 
        });
    }
};

// Get single maintenance request
exports.getMaintenanceRequest = async (req, res) => {
    try {
        const request = await Maintenance.findById(req.params.requestId)
            .populate('student', 'firstName lastName')
            .populate('residence', 'name')
            .populate('assignedTo', 'firstName lastName');

        if (!request) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        res.json(request);
    } catch (error) {
        console.error('Error in getMaintenanceRequest:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Assign maintenance request to staff
exports.assignMaintenanceRequest = async (req, res) => {
    try {
        const { requestId } = req.params;
        const { assignedTo, estimatedCompletion } = req.body;

        // Validate request ID
        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ error: 'Invalid request ID' });
        }

        // Validate staff ID
        if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
            return res.status(400).json({ error: 'Invalid staff ID' });
        }

        // Check if staff exists and has maintenance role
        const staff = await User.findOne({ _id: assignedTo, role: 'maintenance_staff' });
        if (!staff) {
            return res.status(404).json({ error: 'Maintenance staff not found' });
        }

        // Find and update the maintenance request
        const maintenanceRequest = await Maintenance.findById(requestId);
        if (!maintenanceRequest) {
            return res.status(404).json({ error: 'Maintenance request not found' });
        }

        // Update the request
        maintenanceRequest.assignedTo = assignedTo;
        maintenanceRequest.status = 'assigned';
        maintenanceRequest.dateAssigned = new Date();
        if (estimatedCompletion) {
            maintenanceRequest.expectedCompletion = new Date(estimatedCompletion);
        }

        // Add to request history
        maintenanceRequest.requestHistory.push({
            status: 'assigned',
            date: new Date(),
            note: `Assigned to ${staff.firstName} ${staff.lastName}`,
            author: req.user._id
        });

        await maintenanceRequest.save();

        res.json({
            message: 'Maintenance request assigned successfully',
            request: maintenanceRequest
        });
    } catch (error) {
        console.error('Error in assignMaintenanceRequest:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get maintenance staff
exports.getMaintenanceStaff = async (req, res) => {
    try {
        const staff = await User.find({ role: 'maintenance_staff' })
            .select('-password')
            .sort({ firstName: 1 });

        res.json(staff);
    } catch (error) {
        console.error('Error in getMaintenanceStaff:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Add maintenance staff
exports.addMaintenanceStaff = async (req, res) => {
    try {
        const { firstName, lastName, email, phone, specialization } = req.body;

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        // Create new maintenance staff user
        const maintenanceStaff = new User({
            firstName,
            lastName,
            email,
            phone,
            role: 'maintenance_staff',
            specialization
        });

        await maintenanceStaff.save();

        res.status(201).json({
            message: 'Maintenance staff added successfully',
            staff: {
                _id: maintenanceStaff._id,
                firstName: maintenanceStaff.firstName,
                lastName: maintenanceStaff.lastName,
                email: maintenanceStaff.email,
                phone: maintenanceStaff.phone,
                specialization: maintenanceStaff.specialization
            }
        });
    } catch (error) {
        console.error('Error in addMaintenanceStaff:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Remove maintenance staff
exports.removeMaintenanceStaff = async (req, res) => {
    try {
        const staff = await User.findById(req.params.staffId);
        
        if (!staff || staff.role !== 'maintenance_staff') {
            return res.status(404).json({ error: 'Maintenance staff not found' });
        }

        // Check if staff has any assigned maintenance requests
        const assignedRequests = await Maintenance.countDocuments({ 
            assignedTo: staff._id,
            status: { $in: ['assigned', 'in_progress'] }
        });

        if (assignedRequests > 0) {
            return res.status(400).json({ 
                error: 'Cannot remove staff with active maintenance requests' 
            });
        }

        await staff.remove();
        res.json({ message: 'Maintenance staff removed successfully' });
    } catch (error) {
        console.error('Error in removeMaintenanceStaff:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get students for maintenance request
exports.getStudentsForMaintenance = async (req, res) => {
    try {
        const { residenceId, roomNumber } = req.query;

        if (!residenceId || !roomNumber) {
            return res.status(400).json({
                success: false,
                error: 'Missing parameters',
                message: 'Both residenceId and roomNumber are required'
            });
        }

        const students = await mongoose.model('User').find({
            role: 'student',
            'residence.residenceId': residenceId,
            'residence.roomNumber': roomNumber
        }).select('firstName lastName email');

        res.json({
            success: true,
            students
        });
    } catch (error) {
        console.error('Error in getStudentsForMaintenance:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: error.message
        });
    }
};

// Get residences for maintenance request
exports.getResidencesForMaintenance = async (req, res) => {
    try {
        const residences = await mongoose.model('Residence').find()
            .select('name rooms')
            .lean();

        // Transform the data to include room numbers
        const transformedResidences = residences.map(residence => ({
            _id: residence._id,
            name: residence.name,
            rooms: residence.rooms.map(room => room.roomNumber)
        }));

        res.json({
            success: true,
            residences: transformedResidences
        });
    } catch (error) {
        console.error('Error in getResidencesForMaintenance:', error);
        res.status(500).json({
            success: false,
            error: 'Server error',
            message: error.message
        });
    }
}; 