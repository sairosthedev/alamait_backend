const nodemailer = require('nodemailer');
const { sendEmail } = require('../utils/email');

// Create email transporter
const transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: process.env.EMAIL_USER,
		pass: process.env.EMAIL_APP_PASSWORD
	}
});

/**
 * Email Notification Service
 * Handles all email notifications for the Alamait system
 */
class EmailNotificationService {
	
	/**
	 * 1. MONTHLY REQUEST APPROVAL WORKFLOW
	 */
	
	/**
	 * Send notification when admin sends template to finance
	 */
	static async sendMonthlyRequestToFinance(monthlyRequest, user, month, year) {
		try {
			// Get finance users
			const User = require('../models/User');
			const financeUsers = await User.find({
				role: { $in: ['finance', 'finance_admin', 'finance_user'] }
			});

			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">Monthly Request Pending Approval</h2>
						<p>Dear Finance Team,</p>
						<p>A new monthly request has been submitted for your approval:</p>
						<ul>
							<li><strong>Residence:</strong> ${monthlyRequest.residence?.name || 'N/A'}</li>
							<li><strong>Month/Year:</strong> ${month}/${year}</li>
							<li><strong>Total Amount:</strong> $${monthlyRequest.totalEstimatedCost?.toFixed(2) || '0.00'}</li>
							<li><strong>Submitted By:</strong> ${user.firstName} ${user.lastName}</li>
							<li><strong>Items Count:</strong> ${monthlyRequest.items?.length || 0}</li>
						</ul>
						<p>Please review and approve/reject this request.</p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			// Send to all finance users with valid email addresses
			let sentCount = 0;
			for (const financeUser of financeUsers) {
				// Skip invalid email addresses (like alamait.com domain)
				if (!financeUser.email || !financeUser.email.includes('@gmail.com')) {
					console.log(`⚠️ Skipping invalid email: ${financeUser.email}`);
					continue;
				}
				
				try {
					await sendEmail({
						to: financeUser.email,
						subject: 'Monthly Request Pending Approval',
						html: emailContent
					});
					sentCount++;
					console.log(`✅ Email sent to: ${financeUser.email}`);
				} catch (emailError) {
					console.error(`❌ Failed to send email to ${financeUser.email}:`, emailError.message);
				}
			}

			console.log(`✅ Monthly request notification sent to ${financeUsers.length} finance users`);
			return true;
		} catch (error) {
			console.error('❌ Error sending monthly request to finance notification:', error);
			throw error;
		}
	}

	/**
	 * Send notification when finance approves/rejects monthly request
	 */
	static async sendMonthlyRequestApprovalNotification(monthlyRequest, approved, notes, month, year, approvedBy) {
		try {
			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">Monthly Request ${approved ? 'Approved' : 'Rejected'}</h2>
						<p>Dear ${monthlyRequest.submittedBy?.firstName || 'User'},</p>
						<p>Your monthly request has been <strong>${approved ? 'approved' : 'rejected'}</strong>:</p>
						<ul>
							<li><strong>Residence:</strong> ${monthlyRequest.residence?.name || 'N/A'}</li>
							<li><strong>Month/Year:</strong> ${month}/${year}</li>
							<li><strong>Status:</strong> ${approved ? 'Approved' : 'Rejected'}</li>
							<li><strong>Approved By:</strong> ${approvedBy.firstName} ${approvedBy.lastName}</li>
							${notes ? `<li><strong>Notes:</strong> ${notes}</li>` : ''}
						</ul>
						${approved ? '<p>Your request has been approved and expenses will be created automatically.</p>' : '<p>Please review the notes and resubmit if necessary.</p>'}
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			await sendEmail({
				to: monthlyRequest.submittedBy?.email,
				subject: `Monthly Request ${approved ? 'Approved' : 'Rejected'}`,
				html: emailContent
			});

			console.log(`✅ Monthly request ${approved ? 'approval' : 'rejection'} notification sent`);
			return true;
		} catch (error) {
			console.error('❌ Error sending monthly request approval notification:', error);
			throw error;
		}
	}

	/**
	 * 2. MAINTENANCE REQUEST WORKFLOW
	 */
	
	/**
	 * Send notification when maintenance request is submitted
	 */
	static async sendMaintenanceRequestSubmitted(maintenance, submittedBy) {
		try {
			// Notify admins about new maintenance request
			const User = require('../models/User');
			const admins = await User.find({
				role: { $in: ['admin', 'property_manager'] }
			});

			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">New Maintenance Request</h2>
						<p>Dear Admin Team,</p>
						<p>A new maintenance request has been submitted:</p>
						<ul>
							<li><strong>Issue:</strong> ${maintenance.issue}</li>
							<li><strong>Location:</strong> ${maintenance.residence?.name || 'N/A'}</li>
							<li><strong>Room:</strong> ${maintenance.room?.roomNumber || 'N/A'}</li>
							<li><strong>Priority:</strong> ${maintenance.priority}</li>
							<li><strong>Submitted By:</strong> ${submittedBy.firstName} ${submittedBy.lastName}</li>
							<li><strong>Submitted Date:</strong> ${new Date().toLocaleDateString()}</li>
						</ul>
						<p>Please review and process this request.</p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			for (const admin of admins) {
				await sendEmail({
					to: admin.email,
					subject: 'New Maintenance Request',
					html: emailContent
				});
			}

			console.log(`✅ Maintenance request notification sent to ${admins.length} admins`);
			return true;
		} catch (error) {
			console.error('❌ Error sending maintenance request notification:', error);
			throw error;
		}
	}

	/**
	 * Send notification when maintenance request is approved by finance
	 */
	static async sendMaintenanceRequestApproved(maintenance, approvedBy) {
		try {
			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">Maintenance Request Approved</h2>
						<p>Dear ${maintenance.requestedBy?.firstName || 'User'},</p>
						<p>Your maintenance request has been approved:</p>
						<ul>
							<li><strong>Issue:</strong> ${maintenance.issue}</li>
							<li><strong>Location:</strong> ${maintenance.residence?.name || 'N/A'}</li>
							<li><strong>Room:</strong> ${maintenance.room?.roomNumber || 'N/A'}</li>
							<li><strong>Approved Amount:</strong> $${maintenance.amount?.toFixed(2) || '0.00'}</li>
							<li><strong>Approved By:</strong> ${approvedBy.firstName} ${approvedBy.lastName}</li>
							<li><strong>Approval Date:</strong> ${new Date().toLocaleDateString()}</li>
						</ul>
						<p>We will assign a technician shortly to address your maintenance request.</p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			await sendEmail({
				to: maintenance.requestedBy?.email,
				subject: 'Maintenance Request Approved',
				html: emailContent
			});

			console.log('✅ Maintenance request approval notification sent');
			return true;
		} catch (error) {
			console.error('❌ Error sending maintenance approval notification:', error);
			throw error;
		}
	}

	/**
	 * Send notification when maintenance is completed
	 */
	static async sendMaintenanceCompleted(maintenance, completedBy) {
		try {
			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">Maintenance Request Completed</h2>
						<p>Dear ${maintenance.requestedBy?.firstName || 'User'},</p>
						<p>Your maintenance request has been completed:</p>
						<ul>
							<li><strong>Issue:</strong> ${maintenance.issue}</li>
							<li><strong>Location:</strong> ${maintenance.residence?.name || 'N/A'}</li>
							<li><strong>Room:</strong> ${maintenance.room?.roomNumber || 'N/A'}</li>
							<li><strong>Completed By:</strong> ${completedBy.firstName} ${completedBy.lastName}</li>
							<li><strong>Completion Date:</strong> ${new Date().toLocaleDateString()}</li>
						</ul>
						<p>Please rate our service in the app and let us know if you have any concerns.</p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			await sendEmail({
				to: maintenance.requestedBy?.email,
				subject: 'Maintenance Request Completed',
				html: emailContent
			});

			console.log('✅ Maintenance completion notification sent');
			return true;
		} catch (error) {
			console.error('❌ Error sending maintenance completion notification:', error);
			throw error;
		}
	}

	/**
	 * 3. CEO APPROVAL WORKFLOW
	 */
	
	/**
	 * Send notification when request is sent to CEO for approval
	 */
	static async sendRequestToCEO(request, submittedBy) {
		try {
			// Get CEO users
			const User = require('../models/User');
			const ceoUsers = await User.find({ role: 'ceo' });

			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">Request Pending CEO Approval</h2>
						<p>Dear CEO,</p>
						<p>A new request has been submitted for your approval:</p>
						<ul>
							<li><strong>Request Type:</strong> ${request.type || 'Maintenance'}</li>
							<li><strong>Title:</strong> ${request.title || request.issue}</li>
							<li><strong>Location:</strong> ${request.residence?.name || 'N/A'}</li>
							<li><strong>Amount:</strong> $${request.amount?.toFixed(2) || '0.00'}</li>
							<li><strong>Submitted By:</strong> ${submittedBy.firstName} ${submittedBy.lastName}</li>
							<li><strong>Submitted Date:</strong> ${new Date().toLocaleDateString()}</li>
						</ul>
						<p>Please review and approve/reject this request.</p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			for (const ceo of ceoUsers) {
				await sendEmail({
					to: ceo.email,
					subject: 'Request Pending CEO Approval',
					html: emailContent
				});
			}

			console.log(`✅ CEO approval notification sent to ${ceoUsers.length} CEO users`);
			return true;
		} catch (error) {
			console.error('❌ Error sending CEO approval notification:', error);
			throw error;
		}
	}

	/**
	 * Send notification when CEO approves/rejects request
	 */
	static async sendCEOApprovalNotification(request, approved, approvalReason, approvedBy) {
		try {
			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">Request ${approved ? 'Approved' : 'Rejected'} by CEO</h2>
						<p>Dear ${request.submittedBy?.firstName || 'User'},</p>
						<p>Your request has been <strong>${approved ? 'approved' : 'rejected'}</strong> by the CEO:</p>
						<ul>
							<li><strong>Request Type:</strong> ${request.type || 'Maintenance'}</li>
							<li><strong>Title:</strong> ${request.title || request.issue}</li>
							<li><strong>Status:</strong> ${approved ? 'Approved' : 'Rejected'}</li>
							<li><strong>Approved By:</strong> ${approvedBy.firstName} ${approvedBy.lastName}</li>
							<li><strong>Approval Date:</strong> ${new Date().toLocaleDateString()}</li>
							${approvalReason ? `<li><strong>Reason:</strong> ${approvalReason}</li>` : ''}
						</ul>
						${approved ? '<p>Your request has been approved and will be processed accordingly.</p>' : '<p>Please review the reason and resubmit if necessary.</p>'}
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			await sendEmail({
				to: request.submittedBy?.email,
				subject: `Request ${approved ? 'Approved' : 'Rejected'} by CEO`,
				html: emailContent
			});

			console.log('✅ CEO approval notification sent');
			return true;
		} catch (error) {
			console.error('❌ Error sending CEO approval notification:', error);
			throw error;
		}
	}

	/**
	 * 4. EVENT NOTIFICATIONS
	 */
	
	/**
	 * Send notification when new event is created
	 */
	static async sendNewEventNotification(event, createdBy) {
		try {
			// Get all students
			const User = require('../models/User');
			const students = await User.find({ role: 'student' });

			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">New Event Announcement</h2>
						<p>Dear Students,</p>
						<p>A new event has been scheduled:</p>
						<ul>
							<li><strong>Event:</strong> ${event.title}</li>
							<li><strong>Date:</strong> ${new Date(event.date).toLocaleDateString()}</li>
							<li><strong>Time:</strong> ${event.startTime}</li>
							<li><strong>Location:</strong> ${event.location}</li>
							${event.description ? `<li><strong>Description:</strong> ${event.description}</li>` : ''}
						</ul>
						<p>We look forward to seeing you there!</p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			// Send to all students
			for (const student of students) {
				await sendEmail({
					to: student.email,
					subject: `New Event: ${event.title}`,
					html: emailContent
				});
			}

			console.log(`✅ New event notification sent to ${students.length} students`);
			return true;
		} catch (error) {
			console.error('❌ Error sending new event notification:', error);
			throw error;
		}
	}

	/**
	 * Send event reminder (24h before)
	 */
	static async sendEventReminder(event) {
		try {
			// Get students who haven't RSVP'd or all students
			const User = require('../models/User');
			const students = await User.find({ role: 'student' });

			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">Event Reminder</h2>
						<p>Dear Students,</p>
						<p>This is a friendly reminder about tomorrow's event:</p>
						<ul>
							<li><strong>Event:</strong> ${event.title}</li>
							<li><strong>Date:</strong> ${new Date(event.date).toLocaleDateString()}</li>
							<li><strong>Time:</strong> ${event.startTime}</li>
							<li><strong>Location:</strong> ${event.location}</li>
						</ul>
						<p>Don't forget to attend!</p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			for (const student of students) {
				await sendEmail({
					to: student.email,
					subject: `Event Reminder: ${event.title}`,
					html: emailContent
				});
			}

			console.log(`✅ Event reminder sent to ${students.length} students`);
			return true;
		} catch (error) {
			console.error('❌ Error sending event reminder:', error);
			throw error;
		}
	}

	/**
	 * 5. PAYMENT REMINDERS
	 */
	
	/**
	 * Send payment due reminder
	 */
	static async sendPaymentDueReminder(invoice, student) {
		try {
			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">Payment Reminder</h2>
						<p>Dear ${student.firstName},</p>
						<p>This is a friendly reminder that your payment is due soon:</p>
						<ul>
							<li><strong>Amount Due:</strong> $${invoice.balanceDue?.toFixed(2) || '0.00'}</li>
							<li><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</li>
							<li><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</li>
							<li><strong>Residence:</strong> ${invoice.residence?.name || 'N/A'}</li>
						</ul>
						<p>Please ensure timely payment to avoid late fees.</p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			await sendEmail({
				to: student.email,
				subject: 'Payment Due Reminder',
				html: emailContent
			});

			console.log('✅ Payment due reminder sent');
			return true;
		} catch (error) {
			console.error('❌ Error sending payment due reminder:', error);
			throw error;
		}
	}

	/**
	 * Send overdue payment notification
	 */
	static async sendOverduePaymentNotification(invoice, student) {
		try {
			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">Payment Overdue Alert</h2>
						<p>Dear ${student.firstName},</p>
						<p>Your payment is now overdue:</p>
						<ul>
							<li><strong>Overdue Amount:</strong> $${invoice.balanceDue?.toFixed(2) || '0.00'}</li>
							<li><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString()}</li>
							<li><strong>Days Overdue:</strong> ${Math.floor((new Date() - new Date(invoice.dueDate)) / (1000 * 60 * 60 * 24))}</li>
							<li><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</li>
						</ul>
						<p><strong>Please settle the payment immediately to avoid further penalties.</strong></p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			await sendEmail({
				to: student.email,
				subject: 'Payment Overdue Alert',
				html: emailContent
			});

			console.log('✅ Overdue payment notification sent');
			return true;
		} catch (error) {
			console.error('❌ Error sending overdue payment notification:', error);
			throw error;
		}
	}

	/**
	 * 6. ROOM CHANGE REQUESTS
	 */
	
	/**
	 * Send notification when room change request is submitted
	 */
	static async sendRoomChangeRequestNotification(request, student) {
		try {
			// Notify admins about new room change request
			const User = require('../models/User');
			const admins = await User.find({
				role: { $in: ['admin', 'property_manager'] }
			});

			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">New Room Change Request</h2>
						<p>Dear Admin Team,</p>
						<p>A student has requested a room change:</p>
						<ul>
							<li><strong>Student:</strong> ${student.firstName} ${student.lastName}</li>
							<li><strong>Current Room:</strong> ${request.currentRoom || 'N/A'}</li>
							<li><strong>Requested Room:</strong> ${request.requestedRoom || 'N/A'}</li>
							<li><strong>Request Type:</strong> ${request.requestType || 'Change'}</li>
							<li><strong>Reason:</strong> ${request.reason || 'N/A'}</li>
							<li><strong>Submitted Date:</strong> ${new Date().toLocaleDateString()}</li>
						</ul>
						<p>Please review and process this request.</p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			for (const admin of admins) {
				await sendEmail({
					to: admin.email,
					subject: 'New Room Change Request',
					html: emailContent
				});
			}

			console.log(`✅ Room change request notification sent to ${admins.length} admins`);
			return true;
		} catch (error) {
			console.error('❌ Error sending room change request notification:', error);
			throw error;
		}
	}

	/**
	 * Send notification when room change is approved/rejected
	 */
	static async sendRoomChangeApprovalNotification(request, approved, approvedBy, student) {
		try {
			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">Room Change Request ${approved ? 'Approved' : 'Rejected'}</h2>
						<p>Dear ${student.firstName},</p>
						<p>Your room change request has been <strong>${approved ? 'approved' : 'rejected'}</strong>:</p>
						<ul>
							<li><strong>Current Room:</strong> ${request.currentRoom || 'N/A'}</li>
							<li><strong>Requested Room:</strong> ${request.requestedRoom || 'N/A'}</li>
							<li><strong>Status:</strong> ${approved ? 'Approved' : 'Rejected'}</li>
							<li><strong>Processed By:</strong> ${approvedBy.firstName} ${approvedBy.lastName}</li>
							<li><strong>Processed Date:</strong> ${new Date().toLocaleDateString()}</li>
						</ul>
						${approved ? '<p>Your room change will be processed shortly. Please contact the office for move-in arrangements.</p>' : '<p>Please contact the office if you have any questions.</p>'}
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			await sendEmail({
				to: student.email,
				subject: `Room Change Request ${approved ? 'Approved' : 'Rejected'}`,
				html: emailContent
			});

			console.log('✅ Room change approval notification sent');
			return true;
		} catch (error) {
			console.error('❌ Error sending room change approval notification:', error);
			throw error;
		}
	}

	/**
	 * 7. SYSTEM NOTIFICATIONS
	 */
	
	/**
	 * Send system maintenance announcement
	 */
	static async sendSystemMaintenanceNotification(maintenanceDate, startTime, endTime) {
		try {
			const User = require('../models/User');
			const allUsers = await User.find({});

			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">System Maintenance Notice</h2>
						<p>Dear Users,</p>
						<p>We will be performing system maintenance on <strong>${maintenanceDate}</strong> from <strong>${startTime}</strong> to <strong>${endTime}</strong>.</p>
						<p>During this time, the system may be temporarily unavailable.</p>
						<p>We apologize for any inconvenience and appreciate your patience.</p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			for (const user of allUsers) {
				await sendEmail({
					to: user.email,
					subject: 'System Maintenance Notice',
					html: emailContent
				});
			}

			console.log(`✅ System maintenance notification sent to ${allUsers.length} users`);
			return true;
		} catch (error) {
			console.error('❌ Error sending system maintenance notification:', error);
			throw error;
		}
	}
}

module.exports = EmailNotificationService; 