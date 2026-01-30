const mongoose = require('mongoose');
const User = require('../models/User');
const ExpiredStudent = require('../models/ExpiredStudent');
const TransactionEntry = require('../models/TransactionEntry');

let identifierMapCache = null;
let identifierMapCacheTime = 0;
const IDENTIFIER_MAP_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function buildStudentIdentifierMap() {
    const addCandidate = (set, id) => {
        if (!id) return;
        if (Array.isArray(id)) {
            id.forEach(item => addCandidate(set, item));
            return;
        }
        if (typeof id === 'object' && id.toString) {
            set.add(id.toString());
        } else {
            set.add(String(id));
        }
    };

    const candidateIds = new Set();
    const [metadataStudentIds, metadataUserIds, sourceIds, accountCodes] = await Promise.all([
        TransactionEntry.distinct('metadata.studentId', { 'metadata.studentId': { $exists: true, $ne: null } }),
        TransactionEntry.distinct('metadata.userId', { 'metadata.userId': { $exists: true, $ne: null } }),
        TransactionEntry.distinct('sourceId', { sourceId: { $exists: true, $ne: null } }),
        TransactionEntry.distinct('entries.accountCode', { 'entries.accountCode': { $regex: /^1100-/ } })
    ]);

    addCandidate(candidateIds, metadataStudentIds);
    addCandidate(candidateIds, metadataUserIds);
    addCandidate(candidateIds, sourceIds);
    accountCodes.forEach(code => {
        if (typeof code === 'string' && code.startsWith('1100-')) {
            const stripped = code.replace(/^1100-/, '');
            if (stripped) candidateIds.add(stripped);
        }
    });

    const candidates = Array.from(candidateIds).filter(Boolean);
    const resolutionResults = await Promise.all(
        candidates.map(async rawId => {
            const resolvedId = await resolveStudentIdentifier(rawId);
            return { rawId, resolvedId: resolvedId || rawId };
        })
    );

    const map = new Map();
    resolutionResults.forEach(({ rawId, resolvedId }) => {
        if (!resolvedId) return;
        if (!map.has(resolvedId)) {
            map.set(resolvedId, new Set());
        }
        map.get(resolvedId).add(rawId);
    });

    return map;
}

async function getStudentIdentifierMap() {
    if (identifierMapCache && (Date.now() - identifierMapCacheTime) < IDENTIFIER_MAP_TTL_MS) {
        return identifierMapCache;
    }
    identifierMapCache = await buildStudentIdentifierMap();
    identifierMapCacheTime = Date.now();
    return identifierMapCache;
}

/**
 * Get student information from either active users or expired students
 * This ensures we can show student data even if they have expired
 * @param {string} studentId - The student's ID
 * @returns {Object|null} Student information with expiration status
 */
async function getStudentInfo(studentId) {
    try {
        // Validate studentId before using it
        if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
            console.warn(`⚠️ Invalid studentId provided to getStudentInfo: ${studentId}`);
            return null;
        }
        
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
        // Only try ObjectId conversion if studentId is valid
        const expiredStudentQuery = {
            $or: [
                { 'student._id': studentId },
                { 'student': studentId }
            ]
        };
        
        // Only add ObjectId conversion if studentId is valid
        if (mongoose.Types.ObjectId.isValid(studentId)) {
            expiredStudentQuery.$or.push({ 'student': new mongoose.Types.ObjectId(studentId) });
        }
        
        const expiredStudent = await ExpiredStudent.findOne(expiredStudentQuery);

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

/**
 * Resolve any student identifier (active user ID, expired student record ID, application student ID)
 * to the canonical student/user ID used in transaction metadata.
 * @param {string|mongoose.Types.ObjectId} studentId
 * @returns {Promise<string>} resolved student ID
 */
async function resolveStudentIdentifier(studentId) {
    if (!studentId) return null;
    const idString = studentId.toString();

    // If this is a valid ObjectId and matches an active user, return it immediately
    if (mongoose.Types.ObjectId.isValid(idString)) {
        const user = await User.findById(idString).select('_id');
        if (user) {
            return user._id.toString();
        }
    }

    // Build OR conditions to find matching expired student records
    const orConditions = [
        { _id: idString },
        { 'student._id': idString },
        { 'application.student._id': idString },
        { studentId: idString }
    ];

    if (mongoose.Types.ObjectId.isValid(idString)) {
        const objectId = new mongoose.Types.ObjectId(idString);
        orConditions.push({ _id: objectId });
        orConditions.push({ 'student._id': objectId });
        orConditions.push({ 'application.student._id': objectId });
        orConditions.push({ student: objectId });
    }

    const expiredStudent = await ExpiredStudent.findOne({ $or: orConditions }).lean();

    if (expiredStudent) {
        const possibleIds = [];

        if (expiredStudent.student && expiredStudent.student._id) {
            possibleIds.push(expiredStudent.student._id.toString());
        }
        if (expiredStudent.application && expiredStudent.application.student && expiredStudent.application.student._id) {
            possibleIds.push(expiredStudent.application.student._id.toString());
        }
        if (typeof expiredStudent.student === 'string') {
            possibleIds.push(expiredStudent.student);
        } else if (expiredStudent.student && expiredStudent.student.constructor && expiredStudent.student.constructor.name === 'ObjectId') {
            possibleIds.push(expiredStudent.student.toString());
        }
        if (expiredStudent.studentId) {
            possibleIds.push(expiredStudent.studentId.toString());
        }

        for (const possibleId of possibleIds) {
            if (possibleId) {
                return possibleId;
            }
        }
    }

    // Fallback to the provided identifier
    // Try to infer from transaction history (metadata or AR account codes)
    try {
        const transactionMatch = await TransactionEntry.findOne({
            $or: [
                { 'metadata.studentId': idString },
                { 'metadata.userId': idString },
                { sourceId: idString },
                { reference: { $regex: idString, $options: 'i' } },
                { transactionId: { $regex: idString, $options: 'i' } },
                { 'entries.accountCode': { $regex: idString } }
            ]
        }).select('metadata.studentId entries.accountCode').lean();

        if (transactionMatch) {
            if (transactionMatch.metadata && transactionMatch.metadata.studentId) {
                return transactionMatch.metadata.studentId.toString();
            }

            const arEntry = transactionMatch.entries?.find(entry => 
                entry.accountCode && entry.accountCode.startsWith('1100-')
            );
            if (arEntry) {
                const potentialId = arEntry.accountCode.replace(/^1100-/, '');
                if (potentialId) {
                    return potentialId;
                }
            }
        }
    } catch (err) {
        console.warn('resolveStudentIdentifier transaction lookup failed:', err.message);
    }

    return idString;
}

/**
 * Get all raw identifiers that resolve to the same canonical student ID.
 * Uses cached mapping built from transaction activity to align with transaction endpoints.
 * @param {string|mongoose.Types.ObjectId} studentId
 * @returns {Promise<string[]>}
 */
async function getLinkedStudentIdentifiers(studentId) {
    if (!studentId) return [];
    const canonicalId = await resolveStudentIdentifier(studentId);
    const canonicalString = (canonicalId || studentId).toString();
    const identifierMap = await getStudentIdentifierMap();
    const linkedSet = identifierMap.get(canonicalString) || new Set();
    const variants = new Set([canonicalString, ...linkedSet]);

    // If the original provided ID is different, include it as well for completeness
    variants.add(studentId.toString());

    return Array.from(variants).filter(Boolean);
}

module.exports = {
    getStudentInfo,
    getMultipleStudentInfo,
    getStudentName,
    isStudentExpired,
    resolveStudentIdentifier,
    getLinkedStudentIdentifiers
};