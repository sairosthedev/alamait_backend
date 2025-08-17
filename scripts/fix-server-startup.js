const fs = require('fs');
const path = require('path');

console.log('🔧 FIXING SERVER STARTUP ISSUE');
console.log('===============================\n');

try {
    // Check if the audit log controller file exists and has the required exports
    const controllerPath = path.join(__dirname, 'src', 'controllers', 'finance', 'auditLogController.js');
    
    if (fs.existsSync(controllerPath)) {
        console.log('✅ Audit log controller file exists');
        
        // Read the file content
        const content = fs.readFileSync(controllerPath, 'utf8');
        
        // Check if all required functions are exported
        const requiredFunctions = ['getAuditLogs', 'getAuditLogById', 'getUserAuditLogs'];
        const missingFunctions = [];
        
        requiredFunctions.forEach(func => {
            if (!content.includes(`exports.${func}`) && !content.includes(`module.exports.${func}`)) {
                missingFunctions.push(func);
            }
        });
        
        if (missingFunctions.length > 0) {
            console.log(`❌ Missing functions: ${missingFunctions.join(', ')}`);
            
            // Add missing functions
            let updatedContent = content;
            
            missingFunctions.forEach(func => {
                const functionCode = `
/**
 * ${func.replace(/([A-Z])/g, ' $1').toLowerCase()}
 */
exports.${func} = async (req, res) => {
  try {
    // TODO: Implement ${func}
    res.status(501).json({ message: '${func} not implemented yet' });
  } catch (error) {
    console.error('Error in ${func}:', error);
    res.status(500).json({ message: 'Error in ${func}', error: error.message });
  }
};`;
                
                updatedContent += functionCode;
            });
            
            // Write the updated content back
            fs.writeFileSync(controllerPath, updatedContent);
            console.log('✅ Added missing functions to audit log controller');
        } else {
            console.log('✅ All required functions are present');
        }
    } else {
        console.log('❌ Audit log controller file not found');
    }
    
    // Check the routes file
    const routesPath = path.join(__dirname, 'src', 'routes', 'finance', 'auditLogRoutes.js');
    
    if (fs.existsSync(routesPath)) {
        console.log('✅ Audit log routes file exists');
        
        const routesContent = fs.readFileSync(routesPath, 'utf8');
        
        // Check if the controller import is correct
        if (routesContent.includes('auditLogController')) {
            console.log('✅ Controller import looks correct');
        } else {
            console.log('❌ Controller import issue detected');
        }
    } else {
        console.log('❌ Audit log routes file not found');
    }
    
    console.log('\n✅ Server startup fix completed');
    console.log('You can now try starting the server with: npm start');
    
} catch (error) {
    console.error('❌ Error fixing server startup:', error);
} 