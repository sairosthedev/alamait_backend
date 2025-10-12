#!/usr/bin/env node

/**
 * DEBUG APPLICATIONS SCRIPT
 * Check what applications exist in the database
 */

const mongoose = require('mongoose');

async function debugApplications() {
    try {
        console.log('🔍 DEBUGGING APPLICATIONS - Finding the issue!');
        
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/alamait');
        console.log('✅ Connected to MongoDB');
        
        // Check all applications
        const allApplications = await mongoose.connection.db
            .collection('applications')
            .find({})
            .toArray();
        
        console.log(`\n📊 TOTAL APPLICATIONS: ${allApplications.length}`);
        
        if (allApplications.length > 0) {
            console.log('\n📋 APPLICATION DETAILS:');
            allApplications.forEach((app, index) => {
                console.log(`\n   App ${index + 1}: ${app.firstName} ${app.lastName}`);
                console.log(`     ID: ${app._id}`);
                console.log(`     Status: ${app.status}`);
                console.log(`     Payment Status: ${app.paymentStatus}`);
                console.log(`     Start: ${app.startDate} (${new Date(app.startDate).toLocaleDateString()})`);
                console.log(`     End: ${app.endDate} (${new Date(app.endDate).toLocaleDateString()})`);
                console.log(`     Room: ${app.allocatedRoom}`);
                console.log(`     Residence: ${app.residence}`);
            });
            
            // Check status distribution
            const statusCounts = {};
            const paymentStatusCounts = {};
            
            allApplications.forEach(app => {
                statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
                paymentStatusCounts[app.paymentStatus] = (paymentStatusCounts[app.paymentStatus] || 0) + 1;
            });
            
            console.log('\n📊 STATUS DISTRIBUTION:');
            Object.entries(statusCounts).forEach(([status, count]) => {
                console.log(`   ${status}: ${count}`);
            });
            
            console.log('\n📊 PAYMENT STATUS DISTRIBUTION:');
            Object.entries(paymentStatusCounts).forEach(([status, count]) => {
                console.log(`   ${status}: ${count}`);
            });
            
            // Check for approved applications specifically
            const approvedApps = allApplications.filter(app => 
                app.status === 'approved' && app.paymentStatus !== 'cancelled'
            );
            
            console.log(`\n✅ APPROVED APPLICATIONS: ${approvedApps.length}`);
            
            if (approvedApps.length === 0) {
                console.log('\n🚨 ISSUE FOUND: No approved applications!');
                console.log('   This is why backfill created 0 accruals.');
                console.log('   You need to approve some applications first.');
            }
            
        } else {
            console.log('\n🚨 NO APPLICATIONS FOUND!');
            console.log('   The applications collection is empty.');
            console.log('   You need to create some applications first.');
        }
        
    } catch (error) {
        console.error('❌ DEBUG FAILED:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n✅ Disconnected from MongoDB');
    }
}

// Run the debug
debugApplications();
