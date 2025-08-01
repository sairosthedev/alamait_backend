// MongoDB Update Script to Add Status Field to Existing Template
// Run this in MongoDB shell or MongoDB Compass

// Update the specific template to add status field to itemHistory
db.monthlyrequests.updateOne(
  { "_id": ObjectId("688b79ce2af26ca41a8574ad") },
  {
    $set: {
      "items.0.itemHistory.0.status": "inactive", // removed action
      "items.0.itemHistory.1.status": "active",   // added action
      "items.1.itemHistory.0.status": "active",   // modified action
      "items.2.itemHistory.0.status": "active",   // modified action
      "items.3.itemHistory.0.status": "active"    // modified action
    }
  }
);

// Alternative: Update all templates in the collection
// This will update ALL templates that have itemHistory without status field
db.monthlyrequests.updateMany(
  {
    "isTemplate": true,
    "items.itemHistory": { $exists: true }
  },
  [
    {
      $set: {
        "items": {
          $map: {
            input: "$items",
            as: "item",
            in: {
              $mergeObjects: [
                "$$item",
                {
                  "itemHistory": {
                    $map: {
                      input: { $ifNull: ["$$item.itemHistory", []] },
                      as: "history",
                      in: {
                        $mergeObjects: [
                          "$$history",
                          {
                            "status": {
                              $cond: {
                                if: { $eq: ["$$history.action", "removed"] },
                                then: "inactive",
                                else: "active"
                              }
                            }
                          }
                        ]
                      }
                    }
                  }
                }
              ]
            }
          }
        }
      }
    }
  ]
);

// Verify the update worked
const updatedTemplate = db.monthlyrequests.findOne({ "_id": ObjectId("688b79ce2af26ca41a8574ad") });

print("=== Template Status Update Results ===");
print("Template ID:", updatedTemplate._id);
print("Title:", updatedTemplate.title);

updatedTemplate.items.forEach((item, index) => {
  print(`\n--- Item ${index + 1}: ${item.title} ---`);
  if (item.itemHistory && item.itemHistory.length > 0) {
    item.itemHistory.forEach((history, hIndex) => {
      print(`  History ${hIndex + 1}:`);
      print(`    Action: ${history.action}`);
      print(`    Status: ${history.status || 'MISSING'}`);
      print(`    Month/Year: ${history.month}/${history.year}`);
      print(`    Note: ${history.note}`);
    });
  } else {
    print("  No item history");
  }
});

print("\n=== Status Summary ===");
let totalHistoryEntries = 0;
let entriesWithStatus = 0;

updatedTemplate.items.forEach(item => {
  if (item.itemHistory) {
    item.itemHistory.forEach(history => {
      totalHistoryEntries++;
      if (history.status) {
        entriesWithStatus++;
      }
    });
  }
});

print(`Total history entries: ${totalHistoryEntries}`);
print(`Entries with status: ${entriesWithStatus}`);
print(`Status coverage: ${((entriesWithStatus / totalHistoryEntries) * 100).toFixed(1)}%`);

if (entriesWithStatus === totalHistoryEntries) {
  print("✅ SUCCESS: All itemHistory entries now have status field!");
} else {
  print("❌ WARNING: Some entries still missing status field");
} 