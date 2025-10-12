const mongoose = require('mongoose');
const Employee = require('../../models/Employee');
const MonthlyRequest = require('../../models/MonthlyRequest');
const Request = require('../../models/Request');
const { Residence } = require('../../models/Residence');
const { validateMongoId } = require('../../utils/validators');
const { logSalaryRequestOperation } = require('../../utils/auditHelpers');

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

// Convert selected employees to salary requests grouped by residence
exports.createSalaryRequestByResidence = async (req, res) => {
    try {
        console.log('🚀 createSalaryRequestByResidence called');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        console.log('Request method:', req.method);
        console.log('Request URL:', req.url);
        
        const { 
            employees = [], 
            month, 
            year, 
            description, 
            notes, 
            employeeResidences = [],
            // New format: array of objects with employeeId, residenceId, allocationPercentage
            employeeAllocations = []
        } = req.body || {};
        
        if (!Array.isArray(employees) || employees.length === 0) {
            return res.status(400).json({ error: 'No employees provided' });
        }
        if (!month || !year) {
            return res.status(400).json({ error: 'month and year are required' });
        }

        console.log('📊 Processing salary request with:');
        console.log(`   Employees: ${employees.length}`);
        console.log(`   Employee residences: ${employeeResidences.length}`);
        console.log(`   Employee allocations: ${employeeAllocations.length}`);

        // Set longer timeout for this operation
        req.setTimeout(300000); // 5 minutes
        res.setTimeout(300000);
        
        // Extract month from description if it contains date info
        let actualMonth = parseInt(month);
        let actualYear = parseInt(year);
        
        if (description && description.includes('Date Requested:')) {
            const dateMatch = description.match(/Date Requested:\s*(\d{4}-\d{2}-\d{2})/);
            if (dateMatch) {
                const requestDate = new Date(dateMatch[1]);
                actualMonth = requestDate.getMonth() + 1; // Convert 0-based to 1-based
                actualYear = requestDate.getFullYear();
                console.log(`Extracted month/year from description: ${actualMonth}/${actualYear}`);
            }
        }

        // Load employees and residences in parallel for better performance
        const [employeeDocs, residenceDocs] = await Promise.all([
            Employee.find({ _id: { $in: employees } }).lean(),
            Residence.find({}).lean()
        ]);
        
        if (employeeDocs.length === 0) {
            return res.status(404).json({ error: 'Employees not found' });
        }

        // Create residence lookup map for faster access
        const residenceMap = {};
        residenceDocs.forEach(res => {
            residenceMap[res._id.toString()] = res;
        });

        // Group employees by residence with flexible allocation handling
        const employeesByResidence = {};
        
        console.log('🔍 Debug info:');
        console.log('Employee docs:', employeeDocs.map(e => ({ id: e._id.toString(), name: `${e.firstName} ${e.lastName}` })));
        console.log('Employee residences:', employeeResidences);
        console.log('Employee allocations:', employeeAllocations);
        
        // Priority 1: Use employeeAllocations if provided (new format)
        if (employeeAllocations && employeeAllocations.length > 0) {
            console.log('📋 Using employeeAllocations format');
            employeeAllocations.forEach(allocation => {
                const employee = employeeDocs.find(e => e._id.toString() === allocation.employeeId);
                if (employee) {
                    const residenceId = allocation.residenceId;
                    const allocationPercentage = allocation.allocationPercentage || 100;
                    
                    if (!employeesByResidence[residenceId]) {
                        employeesByResidence[residenceId] = [];
                    }
                    
                    // Create employee object with allocation percentage
                    const employeeWithAllocation = {
                        ...employee,
                        allocationPercentage: allocationPercentage,
                        allocatedSalary: (employee.salary || 0) * (allocationPercentage / 100),
                        residenceId: residenceId
                    };
                    
                    employeesByResidence[residenceId].push(employeeWithAllocation);
                    console.log(`✅ Added ${employee.firstName} ${employee.lastName} to residence ${residenceId} with ${allocationPercentage}% allocation ($${employeeWithAllocation.allocatedSalary})`);
                }
            });
        }
        // Priority 2: Use employeeResidences array if provided (legacy format)
        else if (employeeResidences && employeeResidences.length > 0) {
            console.log('📋 Using employeeResidences format (legacy)');
            employeeResidences.forEach(assignment => {
                const employee = employeeDocs.find(e => e._id.toString() === assignment.employeeId);
                if (employee) {
                    const residenceId = assignment.residenceId;
                    const allocationPercentage = assignment.allocationPercentage || 100;
                    
                    if (!employeesByResidence[residenceId]) {
                        employeesByResidence[residenceId] = [];
                    }
                    
                    // Create employee object with allocation percentage
                    const employeeWithAllocation = {
                        ...employee,
                        allocationPercentage: allocationPercentage,
                        allocatedSalary: (employee.salary || 0) * (allocationPercentage / 100),
                        residenceId: residenceId
                    };
                    
                    employeesByResidence[residenceId].push(employeeWithAllocation);
                    console.log(`✅ Added ${employee.firstName} ${employee.lastName} to residence ${residenceId} with ${allocationPercentage}% allocation ($${employeeWithAllocation.allocatedSalary})`);
                }
            });
        }
        // Priority 3: Fallback - distribute employees across available residences
        else {
            console.log('📋 Using fallback distribution');
            const residenceIds = ['67c13eb8425a2e078f61d00e', '68e614d88a25f0de3ad3bbc2', '6859be80cabd83fabe7761de'];
            employeeDocs.forEach(employee => {
                const residenceId = residenceIds[employeeDocs.indexOf(employee) % residenceIds.length];
                if (!employeesByResidence[residenceId]) {
                    employeesByResidence[residenceId] = [];
                }
                
                // Default 100% allocation for fallback
                const employeeWithAllocation = {
                    ...employee,
                    allocationPercentage: 100,
                    allocatedSalary: employee.salary || 0,
                    residenceId: residenceId
                };
                
                employeesByResidence[residenceId].push(employeeWithAllocation);
                console.log(`✅ Added ${employee.firstName} ${employee.lastName} to residence ${residenceId} with 100% allocation ($${employeeWithAllocation.allocatedSalary})`);
            });
        }
        
        console.log('Employees by residence:', Object.keys(employeesByResidence).map(resId => ({
            residenceId: resId,
            employeeCount: employeesByResidence[resId].length
        })));

        // Create separate requests for each residence in parallel
        const requestPromises = Object.entries(employeesByResidence).map(async ([residenceId, residenceEmployees]) => {
            if (residenceEmployees.length === 0) return null; // Skip empty residences
            
            console.log(`Creating request for residence ${residenceId} with ${residenceEmployees.length} employees`);
            
            try {
                const residence = residenceMap[residenceId];
                const residenceName = residence ? residence.name : 'Unknown Residence';
                
                console.log(`Residence found: ${residenceName}`);
                
                const totalForResidence = residenceEmployees.reduce((sum, e) => sum + (e.allocatedSalary || 0), 0);
                
                const title = `Salary Request - ${residenceName} - ${actualMonth}/${actualYear}`;
                const items = residenceEmployees.map(e => ({
                    title: e.fullName || `${e.firstName} ${e.lastName}`,
                    description: `${e.jobTitle || 'Employee'} salary for ${residenceName} (${e.allocationPercentage || 100}%)`,
                    quantity: 1,
                    estimatedCost: e.allocatedSalary || 0,
                    category: 'services',
                    priority: 'high',
                    notes: notes || undefined,
                    provider: undefined
                }));

                console.log(`Creating MonthlyRequest with title: ${title}`);
                console.log(`Items:`, items);
                console.log(`Residence ID: ${residenceId} (type: ${typeof residenceId})`);

                // Validate residenceId is a valid ObjectId
                if (!mongoose.Types.ObjectId.isValid(residenceId)) {
                    throw new Error(`Invalid residence ID: ${residenceId}`);
                }

                const reqDoc = new Request({
                    title,
                    description: description || `Salaries for ${residenceName} - ${actualMonth}/${actualYear}`,
                    residence: residenceId, // This should be a valid ObjectId
                    type: 'financial',
                    category: 'salary',
                    status: 'pending',
                    priority: 'high',
                    items: items.map(item => ({
                        title: item.title,
                        description: item.description,
                        quantity: item.quantity,
                        estimatedCost: item.estimatedCost,
                        category: item.category,
                        priority: item.priority,
                        notes: item.notes,
                        provider: item.provider
                    })),
                    totalEstimatedCost: totalForResidence,
                    submittedBy: req.user?._id,
                    // Provide default values for finance requests to satisfy validation
                    department: 'Finance',
                    requestedBy: req.user?.email || 'Finance Department',
                    // Set finance approval as already done (since finance created this)
                    approval: {
                        admin: { approved: true, approvedBy: req.user?._id, approvedAt: new Date() },
                        finance: { approved: true, approvedBy: req.user?._id, approvedAt: new Date() },
                        ceo: { approved: false } // Needs CEO approval
                    }
                });

                console.log(`Saving Request...`);
                await reqDoc.save();
                console.log(`Request saved successfully with ID: ${reqDoc._id}`);
                
                // Log the salary request creation (non-blocking)
                logSalaryRequestOperation(
                    'create',
                    reqDoc,
                    req.user._id,
                    `Created salary request for ${residenceName} with ${residenceEmployees.length} employees`,
                    req
                ).catch(err => console.error('Audit logging failed:', err));

                return {
                    request: reqDoc,
                    residence: residenceName,
                    total: totalForResidence,
                    employeeCount: residenceEmployees.length,
                    employees: residenceEmployees.map(e => ({
                        id: e._id,
                        name: e.fullName || `${e.firstName} ${e.lastName}`,
                        jobTitle: e.jobTitle,
                        salary: e.allocatedSalary,
                        allocationPercentage: e.allocationPercentage
                    }))
                };

            } catch (residenceError) {
                console.error(`Error creating request for residence ${residenceId}:`, residenceError);
                throw residenceError;
            }
        });

        // Wait for all requests to be created in parallel
        const results = await Promise.all(requestPromises);
        const createdRequests = results.filter(result => result !== null);

        return res.status(201).json({
            message: `Created ${createdRequests.length} salary requests by residence`,
            requests: createdRequests,
            totalRequests: createdRequests.length,
            totalAmount: createdRequests.reduce((sum, req) => sum + req.total, 0),
            summary: {
                residencesProcessed: createdRequests.length,
                totalEmployees: createdRequests.reduce((sum, req) => sum + req.employeeCount, 0),
                totalAmount: createdRequests.reduce((sum, req) => sum + req.total, 0),
                month: actualMonth,
                year: actualYear
            }
        });

    } catch (error) {
        console.error('Error creating salary requests by residence:', error);
        console.error('Error details:', error.message);
        console.error('Stack trace:', error.stack);
        res.status(500).json({ 
            error: 'Error creating salary requests',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// Create individual salary requests for each residence with detailed allocation handling
exports.createIndividualSalaryRequests = async (req, res) => {
    try {
        console.log('🚀 createIndividualSalaryRequests called');
        console.log('Request body:', JSON.stringify(req.body, null, 2));
        
        const { 
            employeeAllocations = [], 
            month, 
            year, 
            description, 
            notes 
        } = req.body || {};
        
        if (!Array.isArray(employeeAllocations) || employeeAllocations.length === 0) {
            return res.status(400).json({ error: 'No employee allocations provided' });
        }
        if (!month || !year) {
            return res.status(400).json({ error: 'month and year are required' });
        }

        // Set longer timeout for this operation
        req.setTimeout(300000); // 5 minutes
        res.setTimeout(300000);

        console.log('📊 Processing individual salary requests:');
        console.log(`   Employee allocations: ${employeeAllocations.length}`);

        // Extract unique employee IDs and residence IDs
        const employeeIds = [...new Set(employeeAllocations.map(a => a.employeeId))];
        const residenceIds = [...new Set(employeeAllocations.map(a => a.residenceId))];

        // Load employees and residences in parallel
        const [employeeDocs, residenceDocs] = await Promise.all([
            Employee.find({ _id: { $in: employeeIds } }).lean(),
            Residence.find({ _id: { $in: residenceIds } }).lean()
        ]);

        // Create lookup maps
        const employeeMap = {};
        employeeDocs.forEach(emp => {
            employeeMap[emp._id.toString()] = emp;
        });

        const residenceMap = {};
        residenceDocs.forEach(res => {
            residenceMap[res._id.toString()] = res;
        });

        // Group allocations by residence
        const allocationsByResidence = {};
        employeeAllocations.forEach(allocation => {
            const residenceId = allocation.residenceId;
            if (!allocationsByResidence[residenceId]) {
                allocationsByResidence[residenceId] = [];
            }
            allocationsByResidence[residenceId].push(allocation);
        });

        // Create one request per residence with list of allocated employees
        const requestPromises = Object.entries(allocationsByResidence).map(async ([residenceId, allocations]) => {
            try {
                const residence = residenceMap[residenceId];
                const residenceName = residence ? residence.name : 'Unknown Residence';

                console.log(`🏠 Creating salary request for ${residenceName} with ${allocations.length} allocated employees`);

                // Calculate total for this residence
                let totalForResidence = 0;
                const allocatedEmployees = [];

                allocations.forEach(allocation => {
                    const employee = employeeMap[allocation.employeeId];
                    if (employee) {
                        const allocationPercentage = allocation.allocationPercentage || 100;
                        const allocatedSalary = (employee.salary || 0) * (allocationPercentage / 100);
                        totalForResidence += allocatedSalary;

                        allocatedEmployees.push({
                            employeeId: employee._id,
                            employeeName: employee.fullName || `${employee.firstName} ${employee.lastName}`,
                            jobTitle: employee.jobTitle || 'Employee',
                            baseSalary: employee.salary || 0,
                            allocationPercentage: allocationPercentage,
                            allocatedSalary: allocatedSalary
                        });

                        console.log(`   👤 ${employee.firstName} ${employee.lastName}: ${allocationPercentage}% of $${employee.salary} = $${allocatedSalary}`);
                    }
                });

                const title = `Salary Request - ${residenceName} - ${month}/${year}`;
                const descriptionText = description || `Monthly salary payments for ${residenceName} - ${month}/${year}`;
                
                // Create the request with allocated employees list
                const reqDoc = new Request({
                    title,
                    description: descriptionText,
                    residence: residenceId,
                    type: 'financial',
                    category: 'salary',
                    status: 'pending',
                    priority: 'high',
                    // Store allocated employees in the request
                    allocatedEmployees: allocatedEmployees,
                    totalEstimatedCost: totalForResidence,
                    submittedBy: req.user?._id,
                    // Provide default values for finance requests to satisfy validation
                    department: 'Finance',
                    requestedBy: req.user?.email || 'Finance Department',
                    // Set finance approval as already done (since finance created this)
                    approval: {
                        admin: { approved: true, approvedBy: req.user?._id, approvedAt: new Date() },
                        finance: { approved: true, approvedBy: req.user?._id, approvedAt: new Date() },
                        ceo: { approved: false } // Needs CEO approval
                    },
                    // Add metadata for salary requests
                    metadata: {
                        type: 'salary_request',
                        month: parseInt(month),
                        year: parseInt(year),
                        employeeCount: allocatedEmployees.length,
                        totalAllocatedAmount: totalForResidence
                    }
                });

                await reqDoc.save();
                console.log(`✅ Salary request saved for ${residenceName}: $${totalForResidence} (${allocatedEmployees.length} employees)`);

                // Log the salary request creation (non-blocking)
                logSalaryRequestOperation(
                    'create',
                    reqDoc,
                    req.user._id,
                    `Created salary request for ${residenceName} with ${allocatedEmployees.length} allocated employees`,
                    req
                ).catch(err => console.error('Audit logging failed:', err));

                return {
                    request: reqDoc,
                    residence: residenceName,
                    residenceId: residenceId,
                    total: totalForResidence,
                    employeeCount: allocatedEmployees.length,
                    allocatedEmployees: allocatedEmployees,
                    month: parseInt(month),
                    year: parseInt(year)
                };

            } catch (residenceError) {
                console.error(`❌ Error creating salary request for residence ${residenceId}:`, residenceError);
                return {
                    error: true,
                    residenceId: residenceId,
                    residenceName: residenceMap[residenceId]?.name || 'Unknown Residence',
                    errorMessage: residenceError.message
                };
            }
        });

        // Wait for all requests to be created
        const results = await Promise.all(requestPromises);
        const successfulRequests = results.filter(result => !result.error);
        const failedRequests = results.filter(result => result.error);

        console.log(`📊 Results: ${successfulRequests.length} successful, ${failedRequests.length} failed`);

        return res.status(201).json({
            message: `Created ${successfulRequests.length} salary requests by residence`,
            requests: successfulRequests,
            failedRequests: failedRequests,
            totalRequests: successfulRequests.length,
            totalAmount: successfulRequests.reduce((sum, req) => sum + req.total, 0),
            summary: {
                residencesProcessed: successfulRequests.length,
                residencesFailed: failedRequests.length,
                totalEmployees: successfulRequests.reduce((sum, req) => sum + req.employeeCount, 0),
                totalAmount: successfulRequests.reduce((sum, req) => sum + req.total, 0),
                month: parseInt(month),
                year: parseInt(year)
            }
        });

    } catch (error) {
        console.error('❌ Error creating individual salary requests:', error);
        res.status(500).json({ 
            error: 'Error creating individual salary requests',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// Convert selected employees to a salary request
// Supports two backends: MonthlyRequest (preferred) or Request fallback (category: Salaries)
exports.createSalaryRequest = async (req, res) => {
    try {
        // Set longer timeout for this operation
        req.setTimeout(300000); // 5 minutes
        res.setTimeout(300000);

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



