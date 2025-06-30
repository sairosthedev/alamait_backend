const Student = require('../../models/Student');
const { validationResult } = require('express-validator');
const User = require('../../models/User');
const bcrypt = require('bcryptjs');
const Residence = require('../../models/Residence');
const Application = require('../../models/Application');
const Booking = require('../../models/Booking');
const path = require('path');
const fs = require('fs');
const mammoth = require('mammoth');
const PDFDocument = require('pdfkit');
const multer = require('multer');
const { s3, s3Configs, fileFilter, fileTypes } = require('../../config/s3');

// Get all students
const getAllStudents = async (req, res) => {
  try {
    const students = await Student.find();
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
};

// Get a student by ID
const getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (student) {
      res.json(student);
    } else {
      res.status(404).send('Student not found');
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch student' });
  }
};

// Create a new student
const createStudent = async (req, res) => {
  try {
    const newStudent = new Student(req.body);
    await newStudent.save();
    res.status(201).json(newStudent);
  } catch (error) {
    res.status(400).json({ error: 'Failed to create student' });
  }
};

// Update an existing student
const updateStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (student) {
      res.json(student);
    } else {
      res.status(404).send('Student not found');
    }
  } catch (error) {
    res.status(400).json({ error: 'Failed to update student' });
  }
};

// Delete a student
const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (student) {
      res.status(204).send();
    } else {
      res.status(404).send('Student not found');
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete student' });
  }
};

// @route   GET /api/student/profile
// @desc    Get student profile
// @access  Private (Student only)
const getProfile = async (req, res) => {
    try {
        console.log('Fetching profile for user:', req.user._id);
        
        if (!req.user || !req.user._id) {
            console.error('No user found in request');
            return res.status(401).json({ error: 'User not authenticated' });
        }

        const student = await User.findById(req.user._id)
            .select('-password')
            .populate('residence', 'name')
            .lean();

        if (!student) {
            console.log('Student not found in database');
            return res.status(404).json({ error: 'Student not found' });
        }

        console.log('Found student:', {
            id: student._id,
            email: student.email,
            currentRoom: student.currentRoom,
            roomValidUntil: student.roomValidUntil,
            roomApprovalDate: student.roomApprovalDate
        });

        // Check for active booking
        const currentBooking = await Booking.findOne({
            student: req.user._id,
            status: 'active'
        })
        .populate('residence', 'name')
        .populate('room', 'roomNumber type features floor')
        .lean();

        console.log('Current booking found:', currentBooking);

        // Check for approved application
        const approvedApplication = await Application.findOne({
            email: student.email,
            status: 'approved'
        })
        .populate('residence', 'name')
        .sort({ updatedAt: -1 })
        .lean();

        console.log('Approved application found:', approvedApplication);

        // Get residence details if we have a room number
        let residenceDetails = null;
        if (student.currentRoom) {
            const residence = await Residence.findOne({
                'rooms.roomNumber': student.currentRoom
            }).lean();
            
            if (residence) {
                const room = residence.rooms.find(r => r.roomNumber === student.currentRoom);
                residenceDetails = {
                    name: residence.name,
                    room: room
                };
            }
        }

        console.log('Residence details found:', residenceDetails);

        // Determine the residence name from various sources
        let residenceName = null;
        let residenceId = null; // Track residence ID
        if (currentBooking?.residence?.name) {
            residenceName = currentBooking.residence.name;
            residenceId = currentBooking.residence._id; // Get residence ID from booking
        } else if (approvedApplication?.residence?.name) {
            residenceName = approvedApplication.residence.name;
            residenceId = approvedApplication.residence._id; // Get residence ID from application
        } else if (residenceDetails?.name) {
            residenceName = residenceDetails.name;
            // Try to get residence ID from the residence lookup
            const residence = await Residence.findOne({ name: residenceDetails.name });
            residenceId = residence ? residence._id : null;
        } else if (student.residence?.name) {
            residenceName = student.residence.name;
            residenceId = student.residence._id; // Get residence ID from student
        }

        console.log('Determined residence name:', residenceName);
        console.log('Determined residence ID:', residenceId);

        // Format response to match frontend requirements
        const formattedProfile = {
            id: student._id,
            firstName: student.firstName,
            lastName: student.lastName,
            email: student.email,
            phone: student.phone,
            studentId: student.studentId,
            program: student.program,
            year: student.year,
            emergencyContact: student.emergencyContact || {
                name: '',
                relationship: '',
                phone: ''
            },
            currentRoom: currentBooking ? {
                status: currentBooking.status,
                validUntil: currentBooking.endDate,
                approvalDate: currentBooking.startDate,
                roomNumber: currentBooking.room.roomNumber,
                roomType: currentBooking.room.type,
                residence: currentBooking.residence.name,
                residenceId: currentBooking.residence._id
            } : student.currentRoom && residenceDetails ? {
                status: 'active',
                validUntil: student.roomValidUntil,
                approvalDate: student.roomApprovalDate,
                roomNumber: student.currentRoom,
                roomType: residenceDetails.room.type,
                residence: residenceDetails.name,
                residenceId: residenceId
            } : approvedApplication ? {
                status: 'approved',
                validUntil: approvedApplication.actionDate ? new Date(new Date(approvedApplication.actionDate).setMonth(new Date(approvedApplication.actionDate).getMonth() + 4)) : new Date(Date.now() + (4 * 30 * 24 * 60 * 60 * 1000)),
                approvalDate: approvedApplication.actionDate || new Date(),
                roomNumber: approvedApplication.allocatedRoom || approvedApplication.preferredRoom,
                roomType: 'Standard',
                residence: residenceName || 'Not Assigned',
                residenceId: residenceId
            } : null
        };

        console.log('Sending formatted profile:', formattedProfile);
        res.json(formattedProfile);
    } catch (error) {
        console.error('Error in getProfile:', error);
        res.status(500).json({ 
            error: 'Server error',
            message: process.env.NODE_ENV === 'development' ? error.message : 'Failed to fetch student profile'
        });
    }
};

// @route   PUT /api/student/profile
// @desc    Update student profile
// @access  Private (Student only)
const updateProfile = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const {
            firstName,
            lastName,
            phone,
            emergencyContact
        } = req.body;

        const student = await User.findById(req.user._id);

        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Update fields if provided
        if (firstName) student.firstName = firstName;
        if (lastName) student.lastName = lastName;
        if (phone) student.phone = phone;
        if (emergencyContact) student.emergencyContact = emergencyContact;

        await student.save();

        // Return formatted profile
        const updatedProfile = {
            id: student._id,
            firstName: student.firstName,
            lastName: student.lastName,
            email: student.email,
            phone: student.phone,
            studentId: student.studentId,
            program: student.program,
            year: student.year,
            emergencyContact: student.emergencyContact
        };

        res.json(updatedProfile);
    } catch (error) {
        console.error('Error in updateProfile:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// @route   PUT /api/student/profile/password
// @desc    Change student password
// @access  Private (Student only)
const changePassword = async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const { currentPassword, newPassword } = req.body;

        const student = await User.findById(req.user._id);
        if (!student) {
            return res.status(404).json({ error: 'Student not found' });
        }

        // Verify current password
        const isMatch = await bcrypt.compare(currentPassword, student.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        student.password = await bcrypt.hash(newPassword, salt);
        await student.save();

        res.json({ message: 'Password updated successfully' });
    } catch (error) {
        console.error('Error in changePassword:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// @route   GET /api/student/current-residence
// @desc    Get student's current residence details
// @access  Private (Student only)
const getCurrentResidence = async (req, res) => {
    try {
        // Get current active booking
        const currentBooking = await Booking.findOne({
            student: req.user._id,
            status: 'active'
        })
        .populate('residence', 'name address image')
        .populate('room', 'roomNumber type features price floor')
        .lean();

        if (!currentBooking) {
            return res.status(404).json({ error: 'No active booking found' });
        }

        const response = {
            name: currentBooking.residence.name,
            address: currentBooking.residence.address,
            residenceId: currentBooking.residence._id,
            room: {
                number: currentBooking.room.roomNumber,
                type: currentBooking.room.type,
                floor: currentBooking.room.floor,
                features: currentBooking.room.features
            },
            status: currentBooking.status,
            validUntil: currentBooking.endDate,
            approvalDate: currentBooking.startDate,
            image: currentBooking.residence.image
        };

        res.json(response);
    } catch (error) {
        console.error('Error in getCurrentResidence:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

// @route   GET /api/student/users/students
// @desc    Get all students for the student-to-student messaging
// @access  Private (Student only)
const getAllUsersForMessaging = async (req, res) => {
  try {
    // Find all users with student role
    const students = await User.find({ 
      role: 'student', 
      _id: { $ne: req.user._id } // Exclude current user
    })
    .select('_id firstName lastName currentRoom')
    .lean();
    
    // Return formatted list of students
    res.json(students);
  } catch (error) {
    console.error('Error fetching students for messaging:', error);
    res.status(500).json({ error: 'Failed to fetch students list' });
  }
};

// Get signed leases for the current student
const getSignedLeases = async (req, res) => {
  try {
    console.log('=== Getting signed leases for student:', req.user._id);
    
    // Find the current user
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Find the latest application for this student
    const application = await Application.findOne({ 
      student: req.user._id 
    }).sort({ createdAt: -1 });

    console.log('User signedLeasePath:', user.signedLeasePath);
    console.log('Application signedLeasePath:', application?.signedLeasePath);

    // Check if user has a signed lease (either in User or Application)
    const userHasLease = user.signedLeasePath;
    const applicationHasLease = application?.signedLeasePath;
    
    if (!userHasLease && !applicationHasLease) {
      return res.json({
        message: 'No signed lease found',
        signedLeases: []
      });
    }

    // Return the signed lease information (prioritize Application over User)
    const signedLease = {
      id: user._id,
      studentName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      fileUrl: applicationHasLease || userHasLease,
      uploadDate: application?.signedLeaseUploadDate || user.signedLeaseUploadDate,
      fileName: application?.signedLeaseFileName || (user.signedLeasePath ? user.signedLeasePath.split('/').pop() : null),
      source: applicationHasLease ? 'application' : 'user'
    };

    res.json({
      message: 'Signed lease found',
      signedLeases: [signedLease]
    });

  } catch (error) {
    console.error('Error getting signed leases:', error);
    res.status(500).json({ 
      error: 'Failed to get signed leases',
      message: error.message 
    });
  }
};

// Download lease agreement as PDF
const downloadLeaseAgreement = async (req, res) => {
    try {
        console.log('=== Starting downloadLeaseAgreement ===');
        
        // 1. Find the student's residenceId
        let residenceId = req.user.residence;
        let firstName = req.user.firstName || 'Student';
        let lastName = req.user.lastName || '';
        
        console.log('User residence:', residenceId);
        console.log('User name:', firstName, lastName);
        
        // If not in user, try latest approved application
        if (!residenceId) {
            const application = await Application.findOne({
                email: req.user.email,
                status: 'approved'
            }).sort({ updatedAt: -1 });
            
            if (application && application.residence) {
                residenceId = application.residence;
                firstName = application.firstName || firstName;
                lastName = application.lastName || lastName;
                console.log('Found residence from application:', residenceId);
            }
        }
        
        if (!residenceId) {
            console.log('No residence found for student');
            return res.status(404).json({ error: 'Residence not found for student.' });
        }

        // 2. Try to find lease template in S3 first
        const templateKey = `lease_templates/${residenceId}_lease_template.docx`;
        console.log('Looking for S3 template:', templateKey);
        
        try {
            // Check if template exists in S3
            await s3.headObject({
                Bucket: s3Configs.leaseTemplates.bucket,
                Key: templateKey
            }).promise();
            
            console.log('Found template in S3');
            
            // Get the template from S3
            const s3Object = await s3.getObject({
                Bucket: s3Configs.leaseTemplates.bucket,
                Key: templateKey
            }).promise();
            
            // 3. Convert DOCX to HTML using mammoth
            const { value: html } = await mammoth.convertToHtml({ buffer: s3Object.Body });
            
            // 4. Convert HTML to PDF using pdfkit
            const doc = new PDFDocument();
            let filename = `Lease_Agreement_${firstName}_${lastName}.pdf`;
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            doc.pipe(res);
            
            // Simple HTML to PDF rendering
            doc.fontSize(12).text(html.replace(/<[^>]+>/g, ''), { align: 'left' });
            doc.end();
            
        } catch (s3Error) {
            console.log('S3 template not found, checking local uploads');
            
            // Fallback to local uploads directory
        const templateName = `lease_agreement_${residenceId}.docx`;
        const templatePath = path.normalize(path.join(__dirname, '..', '..', '..', 'uploads', templateName));
            
        if (!fs.existsSync(templatePath)) {
                console.log('Local template not found either');
                return res.status(404).json({ 
                    error: 'Lease agreement template not found for your property.',
                    message: 'Please contact the administrator to upload a lease template for your residence.'
                });
        }
            
        // 3. Convert DOCX to HTML using mammoth
        const docxBuffer = fs.readFileSync(templatePath);
        const { value: html } = await mammoth.convertToHtml({ buffer: docxBuffer });
            
        // 4. Convert HTML to PDF using pdfkit
        const doc = new PDFDocument();
        let filename = `Lease_Agreement_${firstName}_${lastName}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);
            
            // Simple HTML to PDF rendering
        doc.fontSize(12).text(html.replace(/<[^>]+>/g, ''), { align: 'left' });
        doc.end();
        }
        
    } catch (error) {
        console.error('Error downloading lease agreement:', error);
        res.status(500).json({ 
            error: 'Failed to generate lease agreement PDF.',
            message: error.message 
        });
    }
};

// Set up multer for temporary file storage (we'll upload to S3 manually)
const uploadSignedLease = multer({
  storage: multer.memoryStorage(), // Store in memory temporarily
  fileFilter: fileFilter([...fileTypes.documents, ...fileTypes.images]),
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1,
    fieldSize: 1024 * 1024 // 1MB for other fields
  }
}).single('signedLease');

// Student uploads signed lease (to S3)
const uploadSignedLeaseHandler = async (req, res) => {
  console.log('=== Starting uploadSignedLeaseHandler ===');
  
  // Add timeout to prevent hanging
  const timeout = setTimeout(() => {
    console.error('Upload timeout - request took too long');
    if (!res.headersSent) {
      res.status(408).json({ error: 'Upload timeout - request took too long' });
    }
  }, 45000); // 45 second timeout
  
  uploadSignedLease(req, res, async function (err) {
    console.log('=== Inside uploadSignedLease callback ===');
    
    // Clear timeout since we got a response
    clearTimeout(timeout);
    
    if (err) {
      console.error('Upload error:', err);
      if (!res.headersSent) {
      return res.status(400).json({ error: err.message });
    }
      return;
    }

    try {
      console.log('Processing signed lease upload...');
      
      if (!req.file) {
        console.log('No file uploaded');
        if (!res.headersSent) {
          return res.status(400).json({ error: 'No file uploaded' });
        }
        return;
      }

      console.log('File received:', {
        originalname: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      });

      // Manually upload to S3
      console.log('Uploading signed lease to S3...');
      const s3Key = `leases/${req.user._id}_${Date.now()}_${req.file.originalname}`;
      
      const s3UploadParams = {
        Bucket: s3Configs.signedLeases.bucket,
        Key: s3Key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        ACL: s3Configs.signedLeases.acl,
        Metadata: {
          fieldName: req.file.fieldname,
          uploadedBy: req.user._id.toString(),
          uploadDate: new Date().toISOString()
        }
      };

      const s3Result = await s3.upload(s3UploadParams).promise();
      console.log('Signed lease uploaded successfully to S3:', s3Result.Location);

    // Save S3 file URL in user model
      await User.findByIdAndUpdate(req.user._id, { 
        signedLeasePath: s3Result.Location,
        signedLeaseUploadDate: new Date()
      });
      console.log('User record updated with signed lease path');

      // Update the latest Application document for this student
      const application = await Application.findOne({ student: req.user._id }).sort({ createdAt: -1 });
      if (application) {
        application.signedLeasePath = s3Result.Location;
        application.signedLeaseUploadDate = new Date();
        application.signedLeaseFileName = req.file.originalname;
        application.signedLeaseSize = req.file.size;
        await application.save();
        console.log('Application updated with signed lease:', application._id);

        // Create a Lease document for admin visibility
        const Lease = require('../../models/Lease');
        const fileName = req.file.filename || req.file.originalname;
        const s3Url = s3Result.Location;
        // Compose backend download/view URLs
        const downloadUrl = `/api/leases/download/${fileName}`;
        const viewUrl = `/api/leases/view/${fileName}`;
        await Lease.create({
          studentId: req.user._id,
          studentName: `${application.firstName} ${application.lastName}`,
          email: application.email,
          residence: application.residence,
          residenceName: application.allocatedRoomDetails?.residenceName || application.residenceName || '',
          startDate: application.allocatedRoomDetails?.startDate || application.startDate || null,
          endDate: application.allocatedRoomDetails?.endDate || application.endDate || null,
          filename: fileName,
          originalname: req.file.originalname,
          path: s3Url,
          mimetype: req.file.mimetype,
          size: req.file.size,
          uploadedAt: new Date(),
          downloadUrl,
          viewUrl
        });
        console.log('Lease document created for admin visibility');
      } else {
        console.log('No application found for student, only updated user record');
      }

      res.json({ 
        message: 'Signed lease uploaded successfully', 
        fileUrl: s3Result.Location 
      });

    } catch (error) {
      console.error('Error in uploadSignedLeaseHandler:', error);
      if (!res.headersSent) {
        res.status(500).json({ 
          error: 'Failed to upload signed lease',
          message: error.message 
        });
      }
    }
  });
};

module.exports = {
    getAllStudents,
    getStudentById,
    createStudent,
    updateStudent,
    deleteStudent,
    getProfile,
    updateProfile,
    changePassword,
    getCurrentResidence,
    getAllUsersForMessaging,
    downloadLeaseAgreement,
    uploadSignedLeaseHandler,
    getSignedLeases
}; 