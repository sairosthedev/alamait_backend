# 📋 Monthly Template Approval System Implementation

## 🎯 **Problem Identified**

The current system treats templates as **one-time approvals** instead of **recurring monthly approvals**. Each month should be submitted and approved individually.

## 🔧 **Solution: Monthly Template Submission & Approval**

### **1. Backend Implementation**

#### **Add these routes to `src/routes/monthlyRequestRoutes.js`:**

```javascript
// Submit template for specific month approval (admin only)
router.post('/:id/submit-month', 
    checkRole(['admin']), 
    monthlyRequestController.submitTemplateForMonth
);

// Approve/reject template for specific month (finance only)
router.post('/:id/approve-month', 
    checkRole(['finance', 'finance_admin', 'finance_user']), 
    monthlyRequestController.approveTemplateForMonth
);

// Get monthly approval status for specific month
router.get('/:id/approval-status/:month/:year', 
    monthlyRequestController.getMonthlyApprovalStatus
);
```

#### **Add these functions to `src/controllers/monthlyRequestController.js`:**

```javascript
// Submit template for specific month approval
exports.submitTemplateForMonth = async (req, res) => {
    try {
        const { month, year, submittedBy, submittedByEmail, items, totalEstimatedCost } = req.body;
        const { id } = req.params;

        const template = await MonthlyRequest.findById(id);
        if (!template || !template.isTemplate) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }

        // Check if month already has an approval
        const existingApproval = template.monthlyApprovals.find(
            approval => approval.month === parseInt(month) && approval.year === parseInt(year)
        );

        if (existingApproval && existingApproval.status === 'approved') {
            return res.status(400).json({ 
                success: false, 
                message: `Month ${month}/${year} already approved` 
            });
        }

        // Create or update monthly approval
        const monthlyApproval = {
            month: parseInt(month),
            year: parseInt(year),
            status: 'pending',
            items: items || template.items,
            totalCost: totalEstimatedCost || template.totalEstimatedCost,
            submittedAt: new Date(),
            submittedBy: submittedBy || req.user._id,
            submittedByEmail: submittedByEmail || req.user.email,
            notes: `Submitted for ${month}/${year} approval`
        };

        // Update existing or add new
        if (existingApproval) {
            Object.assign(existingApproval, monthlyApproval);
        } else {
            template.monthlyApprovals.push(monthlyApproval);
        }

        await template.save();

        res.json({
            success: true,
            message: `Template submitted for ${month}/${year} approval`,
            data: template
        });

    } catch (error) {
        console.error('Error submitting month:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Approve/reject template for specific month
exports.approveTemplateForMonth = async (req, res) => {
    try {
        const { month, year, status, notes } = req.body;
        const { id } = req.params;

        const template = await MonthlyRequest.findById(id);
        if (!template || !template.isTemplate) {
            return res.status(404).json({ success: false, message: 'Template not found' });
        }

        // Find the monthly approval
        const monthlyApproval = template.monthlyApprovals.find(
            approval => approval.month === parseInt(month) && approval.year === parseInt(year)
        );

        if (!monthlyApproval) {
            return res.status(404).json({ 
                success: false, 
                message: `No submission found for ${month}/${year}` 
            });
        }

        // Update approval
        monthlyApproval.status = status;
        monthlyApproval.notes = notes || monthlyApproval.notes;
        monthlyApproval.approvedBy = req.user._id;
        monthlyApproval.approvedAt = new Date();
        monthlyApproval.approvedByEmail = req.user.email;

        // If rejected, mark future months as pending
        if (status === 'rejected') {
            const currentDate = new Date(parseInt(year), parseInt(month) - 1, 1);
            
            template.monthlyApprovals.forEach(approval => {
                const approvalDate = new Date(approval.year, approval.month - 1, 1);
                if (approvalDate > currentDate && approval.status !== 'approved') {
                    approval.status = 'pending';
                    approval.notes = 'Pending due to previous month rejection';
                    approval.approvedBy = null;
                    approval.approvedAt = null;
                    approval.approvedByEmail = null;
                }
            });
        }

        await template.save();

        // If approved, create expense
        if (status === 'approved') {
            try {
                const tempRequest = {
                    ...template.toObject(),
                    items: monthlyApproval.items,
                    totalEstimatedCost: monthlyApproval.totalCost,
                    month: monthlyApproval.month,
                    year: monthlyApproval.year,
                    status: 'approved'
                };
                
                const expenseConversionResult = await convertRequestToExpenses(tempRequest, req.user);
                console.log(`Auto-converted expenses for approved month: ${month}/${year}`);
            } catch (conversionError) {
                console.error('Error auto-converting to expenses:', conversionError);
            }
        }

        res.json({
            success: true,
            message: `Template ${status} for ${month}/${year}`,
            data: template
        });

    } catch (error) {
        console.error('Error approving month:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// Get monthly approval status for specific month
exports.getMonthlyApprovalStatus = async (req, res) => {
    try {
        const { id, month, year } = req.params;
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);

        const template = await MonthlyRequest.findById(id);
        if (!template) {
            return res.status(404).json({ 
                success: false, 
                message: 'Template not found' 
            });
        }

        // Find approval for the specified month
        const approval = template.monthlyApprovals.find(
            approval => approval.month === monthNum && approval.year === yearNum
        );

        if (approval) {
            return res.json({
                success: true,
                data: approval
            });
        }

        // Check if there's a rejected month before the requested month
        const currentDate = new Date(yearNum, monthNum - 1, 1);
        const hasRejectedPreviousMonth = template.monthlyApprovals.some(approval => {
            const approvalDate = new Date(approval.year, approval.month - 1, 1);
            return approvalDate < currentDate && approval.status === 'rejected';
        });

        if (hasRejectedPreviousMonth) {
            return res.json({
                success: true,
                data: {
                    month: monthNum,
                    year: yearNum,
                    status: 'pending',
                    notes: 'Pending due to previous month rejection',
                    totalCost: template.totalEstimatedCost
                }
            });
        }

        // No approval found and no previous rejection
        return res.json({
            success: true,
            data: {
                month: monthNum,
                year: yearNum,
                status: 'draft',
                totalCost: template.totalEstimatedCost
            }
        });

    } catch (error) {
        console.error('Error getting approval status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
};
```

### **2. Frontend Implementation**

#### **Add these functions to your frontend service:**

```javascript
// In your API service file
export const submitTemplateForMonth = async (templateId, month, year, data) => {
    const response = await api.post(`/monthly-requests/${templateId}/submit-month`, {
        month,
        year,
        ...data
    });
    return response.data;
};

export const approveTemplateForMonth = async (templateId, month, year, status, notes = '') => {
    const response = await api.post(`/monthly-requests/${templateId}/approve-month`, {
        month,
        year,
        status,
        notes
    });
    return response.data;
};

export const getMonthlyApprovalStatus = async (templateId, month, year) => {
    const response = await api.get(`/monthly-requests/${templateId}/approval-status/${month}/${year}`);
    return response.data;
};
```

#### **Add monthly submission buttons to Admin Dashboard:**

```javascript
// In your Admin MonthlyRequests component
const submitTemplateForMonth = async (templateId, month, year) => {
    try {
        const response = await submitTemplateForMonth(templateId, month, year, {
            submittedBy: user._id,
            submittedByEmail: user.email,
            items: template.items,
            totalEstimatedCost: template.totalEstimatedCost
        });

        if (response.success) {
            toast.success(`Template submitted for ${month}/${year} approval`);
            // Refresh dashboard
        }
    } catch (error) {
        toast.error('Failed to submit template for approval');
    }
};

// Monthly submission buttons
{templates.map(template => (
    <Card key={template._id}>
        <CardHeader>
            <CardTitle>{template.title}</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
                    const status = getMonthlyApprovalStatus(template, month, 2025);
                    return (
                        <Button
                            key={month}
                            variant={status === 'approved' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => submitTemplateForMonth(template._id, month, 2025)}
                            disabled={status === 'approved'}
                        >
                            {monthNames[month-1]} - {status}
                        </Button>
                    );
                })}
            </div>
        </CardContent>
    </Card>
))}
```

#### **Add monthly approval buttons to Finance Dashboard:**

```javascript
// In your Finance MonthlyRequests component
const approveTemplateForMonth = async (templateId, month, year, status) => {
    try {
        const response = await approveTemplateForMonth(templateId, month, year, status);
        
        if (response.success) {
            toast.success(`Template ${status} for ${month}/${year}`);
            // Refresh dashboard
        }
    } catch (error) {
        toast.error(`Failed to ${status} template`);
    }
};

// Monthly approval buttons
{requests.map(request => (
    <Card key={request._id}>
        <CardHeader>
            <CardTitle>{request.title}</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(month => {
                    const status = getMonthlyApprovalStatus(request, month, 2025);
                    return (
                        <div key={month} className="flex gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => approveTemplateForMonth(request._id, month, 2025, 'approved')}
                                disabled={status === 'approved'}
                            >
                                Approve
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => approveTemplateForMonth(request._id, month, 2025, 'rejected')}
                                disabled={status === 'rejected'}
                            >
                                Reject
                            </Button>
                            <span className="text-xs">{monthNames[month-1]} - {status}</span>
                        </div>
                    );
                })}
            </div>
        </CardContent>
    </Card>
))}
```

### **3. Monthly Workflow Process**

#### **Step-by-Step Monthly Process:**

1. **Month 1 (January):**
   - Admin clicks "Submit January" button
   - Template submitted for January approval
   - Finance sees January in pending approvals
   - Finance clicks "Approve January"
   - `monthlyApprovals[0] = { month: 1, year: 2025, status: 'approved' }`

2. **Month 2 (February):**
   - Admin clicks "Submit February" button
   - Template submitted for February approval
   - Finance clicks "Approve February"
   - `monthlyApprovals[1] = { month: 2, year: 2025, status: 'approved' }`

3. **Month 6 (June):**
   - Admin clicks "Submit June" button
   - Finance clicks "Reject June"
   - `monthlyApprovals[5] = { month: 6, year: 2025, status: 'rejected' }`

4. **Month 7 (July):**
   - July automatically becomes `pending` due to June rejection
   - Admin can still submit July, but it will be pending
   - Finance can approve July (overriding the pending status)

### **4. Key Benefits**

✅ **Monthly Control**: Each month is approved individually
✅ **Rejection Cascade**: Future months become pending after rejection
✅ **Audit Trail**: Full history of approvals/rejections
✅ **Auto-Expense**: Approved months automatically create expenses
✅ **Status Clarity**: Clear status for each month

### **5. Implementation Steps**

1. **Backend**: Add the three new endpoints and controller functions
2. **Frontend**: Add monthly submission and approval buttons
3. **Testing**: Test the monthly workflow
4. **Deployment**: Deploy and monitor

This system ensures that **every month** the template is properly submitted to finance and approved/rejected individually, maintaining the correct finance status for each month! 🎯 