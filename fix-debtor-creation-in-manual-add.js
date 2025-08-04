const fs = require('fs');
const path = require('path');

// Path to the student controller file
const controllerPath = path.join(__dirname, 'src/controllers/admin/studentController.js');

// Read the current file
let controllerContent = fs.readFileSync(controllerPath, 'utf8');

// Find the debtor creation section and improve it
const debtorCreationPattern = /\/\/ Automatically create debtor account for the new student\s+try\s*\{[\s\S]*?\}\s*catch\s*\(debtorError\)\s*\{[\s\S]*?\}/;

// Improved debtor creation code with better error handling
const improvedDebtorCreation = `// Automatically create debtor account for the new student
        console.log('🔄 Starting debtor creation for student:', student.email);
        try {
            const debtorResult = await createDebtorForStudent(student, {
                residenceId: residenceId,
                roomNumber: roomNumber,
                createdBy: req.user._id
            });
            console.log(\`✅ Debtor account created for manually added student \${student.email}\`);
            console.log(\`   Debtor Code: \${debtorResult.debtorCode}\`);
            console.log(\`   Account Code: \${debtorResult.accountCode}\`);
        } catch (debtorError) {
            console.error('❌ Failed to create debtor account for manually added student:', debtorError);
            console.error('   Error details:', {
                message: debtorError.message,
                stack: debtorError.stack,
                studentId: student._id,
                studentEmail: student.email
            });
            
            // Log to a separate error file for debugging
            const errorLog = {
                timestamp: new Date().toISOString(),
                studentId: student._id,
                studentEmail: student.email,
                error: debtorError.message,
                stack: debtorError.stack
            };
            
            try {
                fs.appendFileSync('debtor-creation-errors.log', JSON.stringify(errorLog, null, 2) + '\\n');
            } catch (logError) {
                console.error('Failed to write error log:', logError);
            }
            
            // Continue with student creation even if debtor creation fails
            console.log('⚠️  Continuing with student creation despite debtor creation failure');
        }`;

// Replace the debtor creation section
if (debtorCreationPattern.test(controllerContent)) {
    controllerContent = controllerContent.replace(debtorCreationPattern, improvedDebtorCreation);
    
    // Write the improved file
    fs.writeFileSync(controllerPath, controllerContent, 'utf8');
    
    console.log('✅ Successfully updated manualAddStudent function with improved debtor creation error handling');
    console.log('📝 Changes made:');
    console.log('   - Added detailed logging before and after debtor creation');
    console.log('   - Enhanced error reporting with stack traces');
    console.log('   - Added error logging to file for debugging');
    console.log('   - Better error context information');
    console.log('');
    console.log('🔄 Now when you add a student, you will see:');
    console.log('   - "🔄 Starting debtor creation for student: [email]"');
    console.log('   - "✅ Debtor account created..." (if successful)');
    console.log('   - "❌ Failed to create debtor account..." (if failed)');
    console.log('   - Detailed error information in the console');
    console.log('   - Error logs saved to debtor-creation-errors.log file');
    console.log('');
    console.log('🚀 Try adding a student now and check the console output!');
} else {
    console.log('❌ Could not find the debtor creation section in the file');
    console.log('   The pattern might have changed. Please check the file manually.');
} 