const Application = require('../../models/Application');
const { sendEmail } = require('../../utils/email');
const whatsappService = require('../../services/whatsappService');
const User = require('../../models/User');
const ExpiredStudent = require('../../models/ExpiredStudent');

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
            endDate,
            residence
        } = req.body;

        // Validate residence ID
        if (!residence) {
            return res.status(400).json({ error: 'Residence ID is required' });
        }

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
            endDate,
            residence
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

// Check if email has been used before and if eligible for renewal
exports.checkEmailUsage = async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ error: 'Email is required' });

        // Check active user
        const user = await User.findOne({ email: email.toLowerCase() });
        if (user) {
            return res.json({ used: true, isRenewal: false });
        }

        // Check active or pending application
        const activeApp = await Application.findOne({ email: email.toLowerCase(), status: { $in: ['pending', 'approved', 'waitlisted'] } });
        if (activeApp) {
            return res.json({ used: true, isRenewal: false });
        }

        // Check expired/archived students
        const expired = await ExpiredStudent.findOne({ 'student.email': email.toLowerCase() });
        if (expired) {
            return res.json({ used: true, isRenewal: true, previousApplication: expired.application });
        }

        // Not used
        return res.json({ used: false, isRenewal: false });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}; 