const Employee = require('../../models/Employee');
const MonthlyRequest = require('../../models/MonthlyRequest');
const Request = require('../../models/Request');
const { validateMongoId } = require('../../utils/validators');

// List employees with basic filtering and pagination
exports.list = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, status, department, jobTitle } = req.query;
        const query = {};

        if (status) query.status = status;
        if (department) query.department = department;
        if (jobTitle) query.jobTitle = jobTitle;
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { jobTitle: { $regex: search, $options: 'i' } },
                { department: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [employees, total] = await Promise.all([
            Employee.find(query)
                .sort({ lastName: 1, firstName: 1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Employee.countDocuments(query)
        ]);

        return res.status(200).json({
            employees,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            total
        });
    } catch (error) {
        console.error('Error listing employees:', error);
        return res.status(500).json({ error: 'Failed to list employees' });
    }
};

// Create
exports.create = async (req, res) => {
    try {
        const data = req.body || {};
        const required = ['firstName', 'lastName', 'email', 'jobTitle', 'salary'];
        const missing = required.filter(f => !data[f]);
        if (missing.length) {
            return res.status(400).json({ error: 'Missing required fields', missing });
        }
        const employee = await Employee.create({ ...data, createdBy: req.user?._id });
        return res.status(201).json({ message: 'Employee created', employee });
    } catch (error) {
        console.error('Error creating employee:', error);
        if (error.code === 11000) {
            return res.status(409).json({ error: 'Employee with this email already exists' });
        }
        return res.status(500).json({ error: 'Failed to create employee' });
    }
};

// Read by id
exports.getById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!validateMongoId(id)) return res.status(400).json({ error: 'Invalid employee ID' });
        const employee = await Employee.findById(id);
        if (!employee) return res.status(404).json({ error: 'Employee not found' });
        return res.status(200).json({ employee });
    } catch (error) {
        console.error('Error fetching employee:', error);
        return res.status(500).json({ error: 'Failed to fetch employee' });
    }
};

// Update
exports.update = async (req, res) => {
    try {
        const { id } = req.params;
        if (!validateMongoId(id)) return res.status(400).json({ error: 'Invalid employee ID' });
        const update = { ...req.body, updatedBy: req.user?._id };
        const employee = await Employee.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
        if (!employee) return res.status(404).json({ error: 'Employee not found' });
        return res.status(200).json({ message: 'Employee updated', employee });
    } catch (error) {
        console.error('Error updating employee:', error);
        return res.status(500).json({ error: 'Failed to update employee' });
    }
};

// Delete
exports.remove = async (req, res) => {
    try {
        const { id } = req.params;
        if (!validateMongoId(id)) return res.status(400).json({ error: 'Invalid employee ID' });
        const employee = await Employee.findByIdAndDelete(id);
        if (!employee) return res.status(404).json({ error: 'Employee not found' });
        return res.status(200).json({ message: 'Employee deleted' });
    } catch (error) {
        console.error('Error deleting employee:', error);
        return res.status(500).json({ error: 'Failed to delete employee' });
    }
};

// Convert selected employees to a salary request
// Supports two backends: MonthlyRequest (preferred) or Request fallback (category: Salaries)
exports.createSalaryRequest = async (req, res) => {
    try {
        const { employees = [], month, year, description, residence, notes } = req.body || {};
        if (!Array.isArray(employees) || employees.length === 0) {
            return res.status(400).json({ error: 'No employees provided' });
        }
        if (!month || !year) {
            return res.status(400).json({ error: 'month and year are required' });
        }

        // Load employees and compute total
        const employeeDocs = await Employee.find({ _id: { $in: employees } }).lean();
        if (employeeDocs.length === 0) {
            return res.status(404).json({ error: 'Employees not found' });
        }

        const total = employeeDocs.reduce((sum, e) => sum + (e.salary || 0), 0);

        // Prefer MonthlyRequest if available
        if (MonthlyRequest) {
            const title = 'Salary Payment Request';
            const items = employeeDocs.map(e => ({
                title: e.fullName || `${e.firstName} ${e.lastName}`,
                description: `${e.jobTitle || 'Employee'} salary`,
                quantity: 1,
                estimatedCost: e.salary || 0,
                category: 'services',
                priority: 'high',
                notes: notes || undefined,
                provider: undefined
            }));

            const reqDoc = new MonthlyRequest({
                title,
                description: description || `Salaries for ${month}/${year}`,
                residence: residence, // optional; front-end can pass a default residence if needed
                month: parseInt(month),
                year: parseInt(year),
                status: 'pending',
                items,
                submittedBy: req.user?._id
            });

            await reqDoc.save();

            return res.status(201).json({
                message: 'Salary request created (MonthlyRequest)',
                request: reqDoc,
                total
            });
        }

        // Fallback: use Request model under financial type and Salaries category
        const request = new Request({
            title: 'Salary Payment Request',
            description: description || `Salaries for ${month}/${year}`,
            type: 'financial',
            submittedBy: req.user?._id,
            residence: residence,
            department: 'Finance',
            requestedBy: req.user?.email,
            items: employeeDocs.map(e => ({
                description: `${e.fullName || e.firstName + ' ' + e.lastName} - ${e.jobTitle || 'Employee'}`,
                quantity: 1,
                unitCost: e.salary || 0,
                purpose: 'Salary'
            })),
            totalEstimatedCost: total,
            expenseCategory: 'Salaries',
            paymentMethod: 'Bank Transfer'
        });

        await request.save();
        return res.status(201).json({ message: 'Salary request created', request, total });
    } catch (error) {
        console.error('Error creating salary request:', error);
        return res.status(500).json({ error: 'Failed to create salary request', details: error.message });
    }
};



