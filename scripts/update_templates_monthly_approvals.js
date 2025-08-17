// MongoDB Script to Update Existing Templates with Monthly Approvals
// Run this in MongoDB shell or MongoDB Compass

print("=== Updating Templates with Monthly Approvals ===");

// Get current date for status logic
const currentDate = new Date();
const currentMonth = currentDate.getMonth() + 1; // 1-12
const currentYear = currentDate.getFullYear();

print(`Current Date: ${currentDate.toISOString()}`);
print(`Current Month/Year: ${currentMonth}/${currentYear}`);

// Helper function to determine status based on month/year and template status
function getStatusForMonth(month, year, templateStatus) {
  // If template is draft, all monthly approvals are pending
  if (templateStatus === "draft") {
    return "pending";
  }
  
  // If template is approved, use date-based logic
  if (year < currentYear) {
    return "approved"; // Past years
  } else if (year === currentYear && month < currentMonth) {
    return "approved"; // Past months in current year
  } else if (year === currentYear && month === currentMonth) {
    return "approved"; // Current month
  } else {
    return "pending"; // Future months
  }
}

// Generate monthly approvals for all months in 2025
function generateMonthlyApprovals(templateId, items, totalCost, templateStatus) {
  const approvals = [];
  
  for (let month = 1; month <= 12; month++) {
    const status = getStatusForMonth(month, 2025, templateStatus);
    const approval = {
      month: month,
      year: 2025,
      status: status,
      items: items.map(item => ({
        title: item.title,
        description: item.description || "",
        quantity: item.quantity || 1,
        estimatedCost: item.estimatedCost || 0,
        category: item.category || "maintenance",
        priority: item.priority || "medium",
        notes: item.notes || ""
      })),
      totalCost: totalCost,
      submittedAt: new Date(`2025-${month.toString().padStart(2, '0')}-01T00:00:00.000Z`),
      submittedBy: ObjectId("67c023adae5e27657502e887"), // Admin user
      notes: `Monthly request for ${getMonthName(month)} 2025`
    };
    
    // Add approval details for approved months (only if template is approved)
    if (status === "approved" && templateStatus === "approved") {
      approval.approvedBy = ObjectId("67f4ef0fcb87ffa3fb7e2d73"); // Finance user
      approval.approvedAt = new Date(`2025-${month.toString().padStart(2, '0')}-15T10:30:00.000Z`);
      approval.approvedByEmail = "finance@alamait.com";
    }
    
    approvals.push(approval);
  }
  
  return approvals;
}

function getMonthName(month) {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  return months[month - 1];
}

// Update Template 1: Belvedere (DRAFT)
print("\n1. Updating Belvedere template (DRAFT)...");
const belvedereDoc = db.monthlyrequests.findOne({ "_id": ObjectId("688b82c53126816645f32122") });
const belvedereApprovals = generateMonthlyApprovals(
  "688b82c53126816645f32122",
  belvedereDoc.items,
  belvedereDoc.totalEstimatedCost,
  belvedereDoc.status // "draft"
);

db.monthlyrequests.updateOne(
  { "_id": ObjectId("688b82c53126816645f32122") },
  {
    $set: {
      "monthlyApprovals": belvedereApprovals
    }
  }
);

// Update Template 2: St Kilda (DRAFT)
print("2. Updating St Kilda template (DRAFT)...");
const stKildaDoc = db.monthlyrequests.findOne({ "_id": ObjectId("688b79ce2af26ca41a8574ad") });
const stKildaApprovals = generateMonthlyApprovals(
  "688b79ce2af26ca41a8574ad",
  stKildaDoc.items,
  stKildaDoc.totalEstimatedCost,
  stKildaDoc.status // "draft"
);

db.monthlyrequests.updateOne(
  { "_id": ObjectId("688b79ce2af26ca41a8574ad") },
  {
    $set: {
      "monthlyApprovals": stKildaApprovals
    }
  }
);

// Update Template 3: 1ACP (APPROVED)
print("3. Updating 1ACP template (APPROVED)...");
const acpDoc = db.monthlyrequests.findOne({ "_id": ObjectId("688c449e57271825c8910fcf") });
const acpApprovals = generateMonthlyApprovals(
  "688c449e57271825c8910fcf",
  acpDoc.items,
  acpDoc.totalEstimatedCost,
  acpDoc.status // "approved"
);

db.monthlyrequests.updateOne(
  { "_id": ObjectId("688c449e57271825c8910fcf") },
  {
    $set: {
      "monthlyApprovals": acpApprovals
    }
  }
);

// Verify the updates
print("\n=== Verification ===");

const templates = [
  { id: "688b82c53126816645f32122", name: "Belvedere" },
  { id: "688b79ce2af26ca41a8574ad", name: "St Kilda" },
  { id: "688c449e57271825c8910fcf", name: "1ACP" }
];

templates.forEach(template => {
  const doc = db.monthlyrequests.findOne({ "_id": ObjectId(template.id) });
  
  print(`\n--- ${template.name} Template ---`);
  print(`ID: ${doc._id}`);
  print(`Title: ${doc.title}`);
  print(`Template Status: ${doc.status}`);
  print(`Is Template: ${doc.isTemplate}`);
  print(`Monthly Approvals: ${doc.monthlyApprovals ? doc.monthlyApprovals.length : 'MISSING'}`);
  
  if (doc.monthlyApprovals && doc.monthlyApprovals.length > 0) {
    print(`✅ Monthly Approvals field added successfully`);
    
    // Show status breakdown
    const approvedCount = doc.monthlyApprovals.filter(a => a.status === "approved").length;
    const pendingCount = doc.monthlyApprovals.filter(a => a.status === "pending").length;
    
    print(`📊 Status Breakdown:`);
    print(`   - Approved: ${approvedCount} months`);
    print(`   - Pending: ${pendingCount} months`);
    
    // Show specific months (only show first 3 and last 3 for brevity)
    print(`📅 Monthly Status:`);
    const monthlyStatuses = doc.monthlyApprovals.map(approval => {
      const monthName = getMonthName(approval.month);
      const statusIcon = approval.status === "approved" ? "✅" : "⏳";
      return `${statusIcon} ${monthName} 2025: ${approval.status}`;
    });
    
    // Show first 3 months
    monthlyStatuses.slice(0, 3).forEach(status => print(`   ${status}`));
    if (monthlyStatuses.length > 6) {
      print(`   ... (${monthlyStatuses.length - 6} months) ...`);
    }
    // Show last 3 months
    monthlyStatuses.slice(-3).forEach(status => print(`   ${status}`));
    
    // Show logic explanation
    if (doc.status === "draft") {
      print(`📝 Logic: Template is DRAFT → All monthly approvals are PENDING`);
    } else if (doc.status === "approved") {
      print(`📝 Logic: Template is APPROVED → Past/Current months APPROVED, Future months PENDING`);
    }
  } else {
    print(`❌ Monthly Approvals field missing`);
  }
});

// Summary
print("\n=== Summary ===");
print(`Current Month/Year: ${currentMonth}/${currentYear}`);
print(`Status Logic Rules:`);
print(`   - Template Status: DRAFT → All monthly approvals: PENDING`);
print(`   - Template Status: APPROVED → Past/Current months: APPROVED, Future months: PENDING`);

print("\n=== Update Complete ===");
print("All templates now have monthly approvals with correct status logic!");
print("Draft templates have all pending monthly approvals.");
print("Approved templates have date-based monthly approvals."); 