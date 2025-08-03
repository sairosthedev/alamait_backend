# 📋 Monthly Template Approval Implementation Status

## ✅ **COMPLETED:**

### **Backend Routes (Already Implemented):**
```javascript
// These routes are already defined in src/routes/monthlyRequestRoutes.js
router.post('/:id/submit-month', checkRole(['admin']), monthlyRequestController.submitTemplateForMonth);
router.post('/:id/approve-month', checkRole(['finance']), monthlyRequestController.approveTemplateForMonth);
router.get('/:id/approval-status/:month/:year', monthlyRequestController.getMonthlyApprovalStatus);
```

### **Frontend Implementation (Already Implemented):**
- ✅ Monthly approval buttons in Finance dashboard
- ✅ Monthly status logic functions
- ✅ API service functions for monthly approvals
- ✅ UI components for monthly approvals

### **Backend Controller Functions (Partially Implemented):**
- ✅ `submitTemplateForMonth` - Added to controller
- ❌ `approveTemplateForMonth` - Still needs to be added
- ❌ `getMonthlyApprovalStatus` - Still needs to be added

## 🔧 **STILL NEEDS TO BE IMPLEMENTED:**

### **1. Complete the Controller Functions:**

Add these two functions to `src/controllers/monthlyRequestController.js`:

```javascript
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

### **2. Test the Implementation:**

Create a test file to verify the endpoints work:

```javascript
// test-monthly-approval.js
const axios = require('axios');

async function testMonthlyApproval() {
    const baseURL = 'http://localhost:3000/api';
    const token = 'YOUR_JWT_TOKEN';
    
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };

    try {
        // Test submit month
        const submitResponse = await axios.post(`${baseURL}/monthly-requests/TEMPLATE_ID/submit-month`, {
            month: 1,
            year: 2025,
            items: [{ description: 'Test', amount: 100 }],
            totalEstimatedCost: 100
        }, { headers });

        console.log('Submit response:', submitResponse.data);

        // Test approve month
        const approveResponse = await axios.post(`${baseURL}/monthly-requests/TEMPLATE_ID/approve-month`, {
            month: 1,
            year: 2025,
            status: 'approved'
        }, { headers });

        console.log('Approve response:', approveResponse.data);

    } catch (error) {
        console.error('Test failed:', error.response?.data || error.message);
    }
}

testMonthlyApproval();
```

## 🎯 **SUMMARY:**

**The frontend is ready and the backend routes are defined, but you need to:**

1. **Add the two missing controller functions** (`approveTemplateForMonth` and `getMonthlyApprovalStatus`)
2. **Test the endpoints** to ensure they work correctly
3. **Deploy and monitor** the monthly approval system

**Once you add these two functions, the monthly template approval system will be fully functional! 🚀** 