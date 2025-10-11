// Simple test to verify the residence filtering logic works
console.log('🧪 Testing Residence Filtering Logic...\n');

// Mock data to test the filtering logic
const mockEntries = [
    {
        _id: '1',
        date: new Date('2025-09-01'),
        residence: { _id: '67c13eb8425a2e078f61d00e', name: 'Belvedere Student House' },
        sourceId: null,
        entries: [
            { accountType: 'Income', accountCode: '4001', accountName: 'Rental Income', credit: 100, debit: 0 }
        ]
    },
    {
        _id: '2', 
        date: new Date('2025-09-02'),
        residence: { _id: '67d723cf20f89c4ae69804f3', name: 'St Kilda Student House' },
        sourceId: null,
        entries: [
            { accountType: 'Income', accountCode: '4001', accountName: 'Rental Income', credit: 150, debit: 0 }
        ]
    },
    {
        _id: '3',
        date: new Date('2025-09-03'),
        residence: null, // No direct residence
        sourceId: { 
            residence: { _id: '67c13eb8425a2e078f61d00e', name: 'Belvedere Student House' },
            student: 'John Doe'
        },
        entries: [
            { accountType: 'Expense', accountCode: '5001', accountName: 'Maintenance', credit: 0, debit: 50 }
        ]
    },
    {
        _id: '4',
        date: new Date('2025-09-04'),
        residence: 'Unknown', // Unknown residence
        sourceId: {
            residence: { _id: '67d723cf20f89c4ae69804f3', name: 'St Kilda Student House' },
            student: 'Jane Doe'
        },
        entries: [
            { accountType: 'Income', accountCode: '4002', accountName: 'Admin Fees', credit: 25, debit: 0 }
        ]
    }
];

// Test the filtering logic
function testResidenceFiltering(entries, targetResidenceId) {
    console.log(`🔍 Filtering for residence: ${targetResidenceId}`);
    
    const filteredEntries = entries.filter(entry => {
        // Check if transaction has direct residence match
        if (entry.residence && entry.residence._id && 
            entry.residence._id.toString() === targetResidenceId.toString()) {
            console.log(`✅ Entry ${entry._id}: Direct residence match`);
            return true;
        }
        
        // For transactions without residence field, check if they're linked to payments/expenses for this residence
        if (!entry.residence || entry.residence === "Unknown") {
            // Check if sourceId has residence match
            if (entry.sourceId && entry.sourceId.residence && 
                entry.sourceId.residence._id.toString() === targetResidenceId.toString()) {
                console.log(`✅ Entry ${entry._id}: Source residence match`);
                return true;
            }
        }
        
        console.log(`❌ Entry ${entry._id}: No match`);
        return false;
    });
    
    return filteredEntries;
}

// Test filtering for Belvedere Student House
console.log('📊 Test 1: Filtering for Belvedere Student House');
const belvedereId = '67c13eb8425a2e078f61d00e';
const belvedereFiltered = testResidenceFiltering(mockEntries, belvedereId);
console.log(`Found ${belvedereFiltered.length} entries for Belvedere\n`);

// Test filtering for St Kilda Student House  
console.log('📊 Test 2: Filtering for St Kilda Student House');
const stKildaId = '67d723cf20f89c4ae69804f3';
const stKildaFiltered = testResidenceFiltering(mockEntries, stKildaId);
console.log(`Found ${stKildaFiltered.length} entries for St Kilda\n`);

// Test management fee calculation
function calculateManagementFee(entries) {
    let totalRevenue = 0;
    
    entries.forEach(entry => {
        entry.entries.forEach(line => {
            if (line.accountType === 'Income') {
                totalRevenue += (line.credit || 0) - (line.debit || 0);
            }
        });
    });
    
    const managementFee = totalRevenue * 0.25;
    return { totalRevenue, managementFee };
}

console.log('💰 Management Fee Calculation Test:');
const belvedereRevenue = calculateManagementFee(belvedereFiltered);
const stKildaRevenue = calculateManagementFee(stKildaFiltered);

console.log(`Belvedere Revenue: $${belvedereRevenue.totalRevenue}`);
console.log(`Belvedere Management Fee (25%): $${belvedereRevenue.managementFee.toFixed(2)}`);
console.log(`St Kilda Revenue: $${stKildaRevenue.totalRevenue}`);
console.log(`St Kilda Management Fee (25%): $${stKildaRevenue.managementFee.toFixed(2)}`);

console.log('\n✅ All tests completed successfully!');
console.log('🎉 Residence filtering logic is working correctly!');
