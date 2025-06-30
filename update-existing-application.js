const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const Application = require('./src/models/Application');

async function updateExistingApplication() {
  try {
    console.log('=== Updating Existing Application with Signed Lease ===\n');
    
    // The application ID from your data
    const applicationId = '6861aa69e4ba2582c4e28595';
    const s3Url = 'https://alamait-uploads.s3.amazonaws.com/signed_leases/6861b5906e4adda437638081_1751243741706_ST%20Kilda%20Boarding%20Agreement%20Kudzai%5B1%5D.pdf';
    
    console.log('Updating application:', applicationId);
    console.log('With S3 URL:', s3Url);
    
    const updatedApp = await Application.findByIdAndUpdate(applicationId, {
      signedLeasePath: s3Url,
      signedLeaseUploadDate: new Date(),
      signedLeaseFileName: 'ST Kilda Boarding Agreement Kudzai[1].pdf'
    }, { new: true });
    
    if (updatedApp) {
      console.log('✅ Application updated successfully');
      console.log('Application details:', {
        id: updatedApp._id,
        student: updatedApp.student,
        email: updatedApp.email,
        name: `${updatedApp.firstName} ${updatedApp.lastName}`,
        status: updatedApp.status,
        signedLeasePath: updatedApp.signedLeasePath,
        signedLeaseFileName: updatedApp.signedLeaseFileName,
        signedLeaseUploadDate: updatedApp.signedLeaseUploadDate
      });
    } else {
      console.log('❌ Application not found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

updateExistingApplication(); 