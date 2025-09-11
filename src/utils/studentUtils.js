const mongoose = require('mongoose');
const User = require('../models/User');
const ExpiredStudent = require('../models/ExpiredStudent');

/**
 * Get student information from either active users or expired students
 * This ensures we can show student data even if they have expired
 * @param {string} studentId - The student's ID
 * @returns {Object|null} Student information with expiration status
 */
async function getStudentInfo(studentId) {
    try {
        // First try to find in active users
        const activeStudent = await User.findById(studentId);
        if (activeStudent) {
            return {
                _id: activeStudent._id,
                firstName: activeStudent.firstName,
                lastName: activeStudent.lastName,
                email: activeStudent.email,
                phone: activeStudent.phone,
                role: activeStudent.role,
                status: 'active',
                isExpired: false,
                roomValidUntil: activeStudent.roomValidUntil,
                currentRoom: activeStudent.currentRoom,
                residence: activeStudent.residence
            };
        }

        // If not found in active users, check expired students
        // Handle both cases: student as object with _id and student as direct ID string
        const expiredStudent = await ExpiredStudent.findOne({
            $or: [
                { 'student._id': studentId },
                { 'student': studentId },
                { 'student': new mongoose.Types.ObjectId(studentId) }
            ]
        });

        if (expiredStudent) {
            // First, try to get student data from application.student (most complete)
            if (expiredStudent.application && expiredStudent.application.student) {
                const appStudent = expiredStudent.application.student;
                return {
                    _id: studentId,
                    firstName: appStudent.firstName,
                    lastName: appStudent.lastName,
                    email: appStudent.email,
                    phone: appStudent.phone,
                    role: appStudent.role,
                    status: 'expired',
                    isExpired: true,
                    roomValidUntil: appStudent.roomValidUntil,
                    currentRoom: appStudent.currentRoom,
                    residence: appStudent.residence,
                    expiredAt: expiredStudent.archivedAt,
                    expirationReason: expiredStudent.reason
                };
            }
            // If no application.student, check if student field is a full object
            else if (expiredStudent.student && typeof expiredStudent.student === 'object' && expiredStudent.student.constructor.name !== 'ObjectId') {
                return {
                    _id: studentId,
                    firstName: expiredStudent.student.firstName,
                    lastName: expiredStudent.student.lastName,
                    email: expiredStudent.student.email,
                    phone: expiredStudent.student.phone,
                    role: expiredStudent.student.role,
                    status: 'expired',
                    isExpired: true,
                    roomValidUntil: expiredStudent.student.roomValidUntil,
                    currentRoom: expiredStudent.student.currentRoom,
                    residence: expiredStudent.student.residence,
                    expiredAt: expiredStudent.archivedAt,
                    expirationReason: expiredStudent.reason
                };
            }
            // Handle case where student data might be stored as just an ID (string or ObjectId)
            else if (typeof expiredStudent.student === 'string' || 
                (typeof expiredStudent.student === 'object' && expiredStudent.student.constructor.name === 'ObjectId')) {
                
                // Try to get student name from transaction metadata as fallback
                const TransactionEntry = require('../models/TransactionEntry');
                const transactionWithName = await TransactionEntry.findOne({
                    'metadata.studentId': studentId,
                    'metadata.studentName': { $exists: true, $ne: null }
                }).sort({ date: -1 });

                let firstName = 'Unknown';
                let lastName = 'Student';
                
                if (transactionWithName && transactionWithName.metadata.studentName) {
                    const nameParts = transactionWithName.metadata.studentName.split(' ');
                    firstName = nameParts[0] || 'Unknown';
                    lastName = nameParts.slice(1).join(' ') || 'Student';
                }

                return {
                    _id: studentId,
                    firstName: firstName,
                    lastName: lastName,
                    email: 'unknown@example.com',
                    phone: null,
                    role: 'student',
                    status: 'expired',
                    isExpired: true,
                    roomValidUntil: null,
                    currentRoom: null,
                    residence: null,
                    expiredAt: expiredStudent.archivedAt,
                    expirationReason: expiredStudent.reason,
                    note: 'Student data incomplete in expired collection - name retrieved from transaction metadata'
                };
            }

            // Handle case where student data is a full object
            return {
                _id: expiredStudent.student._id,
                firstName: expiredStudent.student.firstName,
                lastName: expiredStudent.student.lastName,
                email: expiredStudent.student.email,
                phone: expiredStudent.student.phone,
                role: expiredStudent.student.role,
                status: 'expired',
                isExpired: true,
                roomValidUntil: expiredStudent.student.roomValidUntil,
                currentRoom: expiredStudent.student.currentRoom,
                residence: expiredStudent.student.residence,
                expiredAt: expiredStudent.archivedAt,
                expirationReason: expiredStudent.reason
            };
        }

        return null;
    } catch (error) {
        console.error('Error getting student info:', error);
        return null;
    }
}

/**
 * Get multiple students' information from both active and expired collections
 * @param {Array} studentIds - Array of student IDs
 * @returns {Array} Array of student information objects
 */
async function getMultipleStudentInfo(studentIds) {
    try {
        const results = [];
        
        for (const studentId of studentIds) {
            const studentInfo = await getStudentInfo(studentId);
            if (studentInfo) {
                results.push(studentInfo);
            }
        }
        
        return results;
    } catch (error) {
        console.error('Error getting multiple student info:', error);
        return [];
    }
}

/**
 * Get student name (first + last) from either active or expired students
 * @param {string} studentId - The student's ID
 * @returns {string} Student's full name or "Unknown Student"
 */
async function getStudentName(studentId) {
    try {
        const studentInfo = await getStudentInfo(studentId);
        if (studentInfo) {
            return `${studentInfo.firstName} ${studentInfo.lastName}`;
        }
        return 'Unknown Student';
    } catch (error) {
        console.error('Error getting student name:', error);
        return 'Unknown Student';
    }
}

/**
 * Check if a student is expired
 * @param {string} studentId - The student's ID
 * @returns {boolean} True if student is expired, false otherwise
 */
async function isStudentExpired(studentId) {
    try {
        const studentInfo = await getStudentInfo(studentId);
        return studentInfo ? studentInfo.isExpired : false;
    } catch (error) {
        console.error('Error checking if student is expired:', error);
        return false;
    }
}

module.exports = {
    getStudentInfo,
    getMultipleStudentInfo,
    getStudentName,
    isStudentExpired
};
