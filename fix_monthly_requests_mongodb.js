// MongoDB Script to Add Missing Approval Fields
// Run this in MongoDB Compass or MongoDB Shell
// No Node.js modules required

// Database name
use test;

print("🔧 Adding missing approval fields to monthly requests...");

// Get count of documents that need updating
var needsUpdate = db.monthlyrequests.countDocuments({
  $or: [
    { approvedBy: { $exists: false } },
    { approvedAt: { $exists: false } },
    { approvedByEmail: { $exists: false } }
  ]
});

print("📊 Found " + needsUpdate + " documents that need approval fields");

if (needsUpdate > 0) {
  // Update all documents that are missing approval fields
  var result = db.monthlyrequests.updateMany(
    {
      $or: [
        { approvedBy: { $exists: false } },
        { approvedAt: { $exists: false } },
        { approvedByEmail: { $exists: false } }
      ]
    },
    {
      $set: {
        approvedBy: null,
        approvedAt: null,
        approvedByEmail: null
      }
    }
  );
  
  print("✅ Updated " + result.modifiedCount + " documents");
  print("📝 Added missing fields: approvedBy, approvedAt, approvedByEmail");
} else {
  print("✅ All documents already have approval fields");
}

// Verify the update
var totalDocs = db.monthlyrequests.countDocuments();
var docsWithFields = db.monthlyrequests.countDocuments({
  approvedBy: { $exists: true },
  approvedAt: { $exists: true },
  approvedByEmail: { $exists: true }
});

print("\n📈 Verification:");
print("Total monthly requests: " + totalDocs);
print("Documents with approval fields: " + docsWithFields);
print("Documents missing approval fields: " + (totalDocs - docsWithFields));

// Show sample of updated documents
print("\n📄 Sample of updated documents:");
var sampleDocs = db.monthlyrequests.find({
  approvedBy: { $exists: true },
  approvedAt: { $exists: true },
  approvedByEmail: { $exists: true }
}).limit(3).toArray();

sampleDocs.forEach(function(doc, index) {
  print("Document " + (index + 1) + ":");
  print("  ID: " + doc._id);
  print("  Title: " + (doc.title || "N/A"));
  print("  Status: " + (doc.status || "N/A"));
  print("  approvedBy: " + (doc.approvedBy || "null"));
  print("  approvedAt: " + (doc.approvedAt || "null"));
  print("  approvedByEmail: " + (doc.approvedByEmail || "null"));
  print("");
});

print("✅ Script completed successfully!"); 