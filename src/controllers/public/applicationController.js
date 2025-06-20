const Application = require('../../models/Application');
const { sendEmail } = require('../../utils/email');
const whatsappService = require('../../services/whatsappService');

// Submit new application
exports.submitApplication = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            phone,
            preferredRoom,
            alternateRooms,
            startDate,
            endDate
        } = req.body;

        // Create new application
        const application = new Application({
            firstName,
            lastName,
            email,
            phone,
            requestType: 'new',
            preferredRoom,
            alternateRooms: alternateRooms || [],
            startDate,
            endDate
        });

        await application.save();

        // Send confirmation email
        const emailContent = `
            Dear ${firstName} ${lastName},

            Thank you for submitting your application to Alamait Student Accommodation.
            
            Your application has been received and is being processed. We will notify you once your application has been reviewed.
            
            Application Details:
            - Preferred Room: ${preferredRoom}
            - Alternative Rooms: ${alternateRooms.join(', ') || 'None'}
            - Desired Start Date: ${new Date(startDate).toLocaleDateString()}
            - Desired End Date: ${new Date(endDate).toLocaleDateString()}
            
            Please keep this email for your records.
            
            Best regards,
            Alamait Student Accommodation Team
        `;

        await sendEmail({
            to: email,
            subject: 'Application Received - Alamait Student Accommodation',
            text: emailContent
        });

        // Send WhatsApp confirmation
        await whatsappService.sendMessage(
            phone,
            `Dear ${firstName}, your application for Alamait Student Accommodation has been received and is being processed. We will notify you once your application has been reviewed. Your preferred room is ${preferredRoom}.`
        );

        res.status(201).json({
            message: 'Application submitted successfully',
            application: {
                id: application._id,
                status: application.status,
                applicationDate: application.applicationDate
            }
        });

    } catch (error) {
        console.error('Error in submitApplication:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// Get application status
exports.getApplicationStatus = async (req, res) => {
    try {
        const { email } = req.params;
        
        const application = await Application.findOne({ email })
            .select('status applicationDate preferredRoom applicationCode');

        if (!application) {
            return res.status(404).json({ error: 'Application not found' });
        }

        res.json(application);

    } catch (error) {
        console.error('Error in getApplicationStatus:', error);
        res.status(500).json({ error: 'Server error' });
    }
}; 