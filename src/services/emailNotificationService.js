const nodemailer = require('nodemailer');
const { sendEmail } = require('../utils/email');
const Residence = require('../models/Residence');

// Create email transporter with production-optimized settings
const transporter = nodemailer.createTransport({
	service: 'gmail',
	pool: true,
	maxConnections: 1, // Reduced for production stability
	maxMessages: 10,   // Reduced for production stability
	connectionTimeout: 15000, // 15 seconds
	greetingTimeout: 10000,   // 10 seconds
	socketTimeout: 20000,     // 20 seconds
	secure: true,
	tls: {
		rejectUnauthorized: false
	},
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
     * Send notification to CEO users when a financial request for salaries is created
     */
    static async sendFinancialSalariesRequestToCEO(request, submittedBy) {
        try {
            const User = require('../models/User');
            const ceoUsers = await User.find({ role: 'ceo' });

            // Get residence name if not populated
            let residenceName = 'N/A';
            if (request.residence?.name) {
                residenceName = request.residence.name;
            } else if (request.residence) {
                try {
                    // Use mongoose.Types.ObjectId to ensure proper ObjectId handling
                    const mongoose = require('mongoose');
                    const residenceId = typeof request.residence === 'string' 
                        ? new mongoose.Types.ObjectId(request.residence)
                        : request.residence;
                    
                    // Ensure Residence model is properly loaded
                    if (typeof Residence.findById === 'function') {
                        const residence = await Residence.findById(residenceId);
                        residenceName = residence?.name || 'Unknown Residence';
                    } else {
                        console.error('Residence model not properly loaded - findById is not a function');
                        residenceName = 'Unknown Residence';
                    }
                } catch (err) {
                    console.error('Error fetching residence:', err);
                    residenceName = 'Unknown Residence';
                }
            }

            const emailContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
                        <h2 style="color: #333;">Financial Request: Salaries</h2>
                        <p>Dear CEO,</p>
                        <p>A financial request categorized as <strong>Salaries</strong> has been submitted:</p>
                        <ul>
                            <li><strong>Title:</strong> ${request.title || 'N/A'}</li>
                            <li><strong>Description:</strong> ${request.description || 'N/A'}</li>
                            <li><strong>Residence:</strong> ${residenceName}</li>
                            <li><strong>Amount:</strong> $${(request.amount || request.totalEstimatedCost || 0).toFixed(2)}</li>
                            <li><strong>Submitted By:</strong> ${submittedBy?.firstName || ''} ${submittedBy?.lastName || ''}</li>
                            <li><strong>Date:</strong> ${new Date(request.createdAt || Date.now()).toLocaleDateString()}</li>
                        </ul>
                        <p>Please review and take the necessary action.</p>
                        <hr style="margin: 20px 0;">
                        <p style="font-size: 12px; color: #666;">
                            This is an automated message from Alamait Student Accommodation.<br>
                            Please do not reply to this email.
                        </p>
                    </div>
                </div>
            `;

            let sentCount = 0;
            for (const ceo of ceoUsers) {
                if (!ceo.email || !ceo.email.includes('@')) {
                    console.log(`⚠️ Skipping invalid CEO email: ${ceo.email}`);
                    continue;
                }
                // Send email in background (same pattern as invoice emails)
                setTimeout(async () => {
                    try {
                        console.log(`📧 Sending financial salaries request email to CEO: ${ceo.email}`);
                        
                        // Use same method as invoice emails (reliable queue system)
                        await sendEmail({
                            to: ceo.email,
                            subject: 'Financial Request - Salaries',
                            html: emailContent
                        });
                        console.log(`✅ Salaries notification sent to CEO: ${ceo.email}`);
                    } catch (emailError) {
                        console.error(`❌ Failed to send email to CEO ${ceo.email}:`, emailError.message);
                    }
                }, 100);
                sentCount++;
            }

            console.log(`✅ Salaries financial request notification sent to ${sentCount}/${ceoUsers.length} CEO users`);
            return true;
        } catch (error) {
            console.error('❌ Error sending salaries financial request notification:', error);
            throw error;
        }
    }
	
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
			const Residence = require('../models/Residence');
			const financeUsers = await User.find({
				role: { $in: ['finance', 'finance_admin', 'finance_user'] }
			});

			// Get residence name if not populated
			let residenceName = 'N/A';
			if (monthlyRequest.residence?.name) {
				residenceName = monthlyRequest.residence.name;
			} else if (monthlyRequest.residence) {
				try {
					// Use mongoose.Types.ObjectId to ensure proper ObjectId handling
					const mongoose = require('mongoose');
					const residenceId = typeof monthlyRequest.residence === 'string' 
						? new mongoose.Types.ObjectId(monthlyRequest.residence)
						: monthlyRequest.residence;
					
					const residence = await Residence.findById(residenceId);
					residenceName = residence?.name || 'Unknown Residence';
					console.log(`🏠 Residence lookup: ${residenceName}`);
				} catch (err) {
					console.error('Error fetching residence:', err);
					residenceName = 'Unknown Residence';
				}
			}

			// Create items table HTML
			let itemsTableHtml = '';
			if (monthlyRequest.items && monthlyRequest.items.length > 0) {
				itemsTableHtml = `
					<div style="margin: 20px 0;">
						<h3 style="color: #333; margin-bottom: 15px;">Request Items</h3>
						<table style="width: 100%; border-collapse: collapse; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
							<thead>
								<tr style="background-color: #f8f9fa;">
									<th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6; color: #495057; font-weight: 600;">Item</th>
									<th style="padding: 12px; text-align: left; border-bottom: 2px solid #dee2e6; color: #495057; font-weight: 600;">Category</th>
									<th style="padding: 12px; text-align: center; border-bottom: 2px solid #dee2e6; color: #495057; font-weight: 600;">Qty</th>
									<th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6; color: #495057; font-weight: 600;">Unit Cost</th>
									<th style="padding: 12px; text-align: right; border-bottom: 2px solid #dee2e6; color: #495057; font-weight: 600;">Total</th>
								</tr>
							</thead>
							<tbody>
								${monthlyRequest.items.map((item, index) => `
									<tr style="border-bottom: 1px solid #dee2e6; ${index % 2 === 0 ? 'background-color: #f8f9fa;' : 'background-color: white;'}">
										<td style="padding: 12px; color: #333;">
											<div style="font-weight: 600; color: #495057;">${item.title || 'Untitled Item'}</div>
											${item.description ? `<div style="font-size: 12px; color: #6c757d; margin-top: 4px;">${item.description}</div>` : ''}
										</td>
										<td style="padding: 12px; color: #495057;">
											<span style="background-color: #e9ecef; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #495057;">
												${item.category || 'General'}
											</span>
										</td>
										<td style="padding: 12px; text-align: center; color: #495057;">${item.quantity || 1}</td>
										<td style="padding: 12px; text-align: right; color: #495057;">$${(item.estimatedCost || 0).toFixed(2)}</td>
										<td style="padding: 12px; text-align: right; color: #495057; font-weight: 600;">$${((item.estimatedCost || 0) * (item.quantity || 1)).toFixed(2)}</td>
									</tr>
								`).join('')}
							</tbody>
							<tfoot>
								<tr style="background-color: #e9ecef; border-top: 2px solid #dee2e6;">
									<td colspan="4" style="padding: 12px; text-align: right; font-weight: 600; color: #495057;">Total Amount:</td>
									<td style="padding: 12px; text-align: right; font-weight: 700; color: #28a745; font-size: 16px;">$${monthlyRequest.totalEstimatedCost?.toFixed(2) || '0.00'}</td>
								</tr>
							</tfoot>
						</table>
					</div>
				`;
			}

			const emailContent = `
				<div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 700px; margin: 0 auto; background-color: #ffffff;">
					<!-- Header -->
					<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
						<h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">📋 Monthly Request Pending Approval</h1>
						<p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">New monthly request requires your review</p>
					</div>
					
					<!-- Main Content -->
					<div style="padding: 30px; background-color: #ffffff;">
						<p style="color: #333; font-size: 16px; margin-bottom: 20px;">Dear Finance Team,</p>
						<p style="color: #666; font-size: 14px; margin-bottom: 25px;">A new monthly request has been submitted for your approval with the following details:</p>
						
						<!-- Request Summary -->
						<div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; border-left: 4px solid #007bff; margin-bottom: 25px;">
							<h3 style="color: #333; margin: 0 0 15px 0; font-size: 18px;">📊 Request Summary</h3>
							<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
								<div>
									<strong style="color: #495057;">🏠 Residence:</strong><br>
									<span style="color: #333; font-size: 14px;">${residenceName}</span>
								</div>
								<div>
									<strong style="color: #495057;">📅 Period:</strong><br>
									<span style="color: #333; font-size: 14px;">${month}/${year}</span>
								</div>
								<div>
									<strong style="color: #495057;">💰 Total Amount:</strong><br>
									<span style="color: #28a745; font-size: 16px; font-weight: 600;">$${monthlyRequest.totalEstimatedCost?.toFixed(2) || '0.00'}</span>
								</div>
								<div>
									<strong style="color: #495057;">👤 Submitted By:</strong><br>
									<span style="color: #333; font-size: 14px;">${user.firstName} ${user.lastName}</span>
								</div>
							</div>
						</div>
						
						${itemsTableHtml}
						
						<!-- Action Required -->
						<div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 25px 0;">
							<h3 style="color: #856404; margin: 0 0 10px 0; font-size: 16px;">⚠️ Action Required</h3>
							<p style="color: #856404; margin: 0; font-size: 14px;">Please review the request details above and approve or reject this monthly request in the admin panel.</p>
						</div>
					</div>
					
					<!-- Footer -->
					<div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; border-top: 1px solid #dee2e6;">
						<p style="color: #6c757d; font-size: 12px; margin: 0;">
							This is an automated message from <strong>Alamait Student Accommodation</strong><br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			// Send to all finance users with valid email addresses (avoid duplicates)
			let sentCount = 0;
			const sentEmails = new Set(); // Track sent emails to prevent duplicates
			
			for (const financeUser of financeUsers) {
				// Skip invalid email addresses (like alamait.com domain)
				if (!financeUser.email || !financeUser.email.includes('@')) {
					console.log(`⚠️ Skipping invalid email: ${financeUser.email}`);
					continue;
				}
				
				// Skip if already sent to this email
				if (sentEmails.has(financeUser.email.toLowerCase())) {
					console.log(`⚠️ Skipping duplicate email: ${financeUser.email}`);
					continue;
				}
				
				try {
					// Use same method as invoice emails (reliable queue system)
					await sendEmail({
						to: financeUser.email,
						subject: 'Monthly Request Pending Approval',
						html: emailContent
					});
					sentEmails.add(financeUser.email.toLowerCase());
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
			// Get residence name if not populated
			let residenceName = 'N/A';
			if (monthlyRequest.residence?.name) {
				residenceName = monthlyRequest.residence.name;
			} else if (monthlyRequest.residence) {
				try {
					// Use mongoose.Types.ObjectId to ensure proper ObjectId handling
					const mongoose = require('mongoose');
					const residenceId = typeof monthlyRequest.residence === 'string' 
						? new mongoose.Types.ObjectId(monthlyRequest.residence)
						: monthlyRequest.residence;
					
					// Ensure Residence model is properly loaded
					if (typeof Residence.findById === 'function') {
						const residence = await Residence.findById(residenceId);
						residenceName = residence?.name || 'Unknown Residence';
					} else {
						console.error('Residence model not properly loaded - findById is not a function');
						residenceName = 'Unknown Residence';
					}
				} catch (err) {
					console.error('Error fetching residence:', err);
					residenceName = 'Unknown Residence';
				}
			}

			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">Monthly Request ${approved ? 'Approved' : 'Rejected'}</h2>
						<p>Dear ${monthlyRequest.submittedBy?.firstName || 'User'},</p>
						<p>Your monthly request has been <strong>${approved ? 'approved' : 'rejected'}</strong>:</p>
						<ul>
							<li><strong>Residence:</strong> ${residenceName}</li>
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

			// Helper function to format values with better fallbacks
		const formatValue = (value, fallback = 'Not specified') => {
			if (value === null || value === undefined || value === '') {
				return fallback;
			}
			return value;
		};
		
		// Format category with proper capitalization
		const formatCategory = (category) => {
			if (!category) return 'Not specified';
			return category.split('_').map(word => 
				word.charAt(0).toUpperCase() + word.slice(1)
			).join(' ');
		};
		
		// Format residence name
		const residenceName = maintenance.residence?.name || 
			(maintenance.residence && typeof maintenance.residence === 'string' ? maintenance.residence : 'Not specified');
		
		// Format room information
		const roomInfo = formatValue(maintenance.room, 'Not specified');

		const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">New Maintenance Request</h2>
						<p>Dear Admin Team,</p>
						<p>A new maintenance request has been submitted by a student:</p>
						
						<div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
							<h3 style="color: #333; margin-top: 0;">Request Details</h3>
							<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
								<tbody>
									<tr>
										<td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; width: 30%;">Issue</td>
										<td style="border: 1px solid #ddd; padding: 8px;">${formatValue(maintenance.issue, 'No issue specified')}</td>
									</tr>
									<tr>
										<td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Description</td>
										<td style="border: 1px solid #ddd; padding: 8px;">${formatValue(maintenance.description, 'No description provided')}</td>
									</tr>
									<tr>
										<td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Category</td>
										<td style="border: 1px solid #ddd; padding: 8px;">${formatCategory(maintenance.category)}</td>
									</tr>
									<tr>
										<td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Priority</td>
										<td style="border: 1px solid #ddd; padding: 8px;">
											<span style="color: ${maintenance.priority === 'urgent' ? '#dc3545' : maintenance.priority === 'high' ? '#fd7e14' : maintenance.priority === 'medium' ? '#ffc107' : '#28a745'}; font-weight: bold;">
												${formatValue(maintenance.priority, 'Medium').charAt(0).toUpperCase() + formatValue(maintenance.priority, 'Medium').slice(1)}
											</span>
										</td>
									</tr>
									${roomInfo !== 'Not specified' ? `
									<tr>
										<td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Room</td>
										<td style="border: 1px solid #ddd; padding: 8px;">${roomInfo}</td>
									</tr>
									` : ''}
									<tr>
										<td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Residence</td>
										<td style="border: 1px solid #ddd; padding: 8px;">${residenceName}</td>
									</tr>
									<tr>
										<td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Estimated Amount</td>
										<td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold; color: #007bff; font-size: 16px;">
											$${(maintenance.amount || 0).toFixed(2)}
										</td>
									</tr>
									<tr>
										<td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Submitted By</td>
										<td style="border: 1px solid #ddd; padding: 8px;">${submittedBy?.firstName} ${submittedBy?.lastName} (${submittedBy?.email})</td>
									</tr>
									<tr>
										<td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Submitted Date</td>
										<td style="border: 1px solid #ddd; padding: 8px;">${new Date(maintenance.createdAt || Date.now()).toLocaleDateString()}</td>
									</tr>
								</tbody>
							</table>
						</div>
						
						<div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 15px 0;">
							<h3 style="color: #856404; margin-top: 0;">Action Required</h3>
							<p>Please review this student maintenance request and take appropriate action. Consider the priority level and estimated cost when scheduling the work.</p>
						</div>
						
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			// Send to all admins with valid email addresses (non-blocking)
			let sentCount = 0;
			for (const admin of admins) {
				// Skip invalid email addresses (like alamait.com domain) - same logic as monthly requests
				if (!admin.email || !admin.email.includes('@')) {
					console.log(`⚠️ Skipping invalid email: ${admin.email}`);
					continue;
				}
				
				// Send email in background to avoid blocking request processing
				setTimeout(async () => {
					try {
						await sendEmail({
							to: admin.email,
							subject: 'New Maintenance Request - Action Required',
							html: emailContent
						});
						console.log(`✅ Email sent to: ${admin.email}`);
					} catch (emailError) {
						console.error(`❌ Failed to send email to ${admin.email}:`, emailError.message);
					}
				}, 100);
				sentCount++;
			}

			console.log(`✅ Maintenance request notification sent to ${sentCount} admins`);
			return true;
		} catch (error) {
			console.error('❌ Error sending maintenance request notification:', error);
			throw error;
		}
	}

	/**
	 * Send confirmation email to student when maintenance request is submitted
	 */
	static async sendMaintenanceRequestConfirmation(maintenance, submittedBy) {
		try {
			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #e8f5e8; padding: 20px; border-radius: 5px;">
						<h2 style="color: #2d5a2d;">Maintenance Request Confirmation</h2>
						<p>Dear ${submittedBy?.firstName || 'Student'},</p>
						<p>Your maintenance request has been successfully submitted and is now under review.</p>
						<div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
							<h3 style="color: #333; margin-top: 0;">Request Details:</h3>
							<ul>
								<li><strong>Issue:</strong> ${maintenance.issue}</li>
								<li><strong>Description:</strong> ${maintenance.description || 'No description provided'}</li>
								<li><strong>Category:</strong> ${maintenance.category}</li>
								<li><strong>Priority:</strong> ${maintenance.priority}</li>
								<li><strong>Residence:</strong> ${maintenance.residence?.name || 'N/A'}</li>
								<li><strong>Request ID:</strong> ${maintenance._id}</li>
								<li><strong>Submitted Date:</strong> ${new Date().toLocaleDateString()}</li>
							</ul>
						</div>
						<p><strong>What happens next?</strong></p>
						<ol>
							<li>Your request will be reviewed by our maintenance team</li>
							<li>You will receive updates on the status of your request</li>
							<li>Once approved, a technician will be assigned to address the issue</li>
						</ol>
						<p>You can track the status of your request through your student portal.</p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			await sendEmail({
				to: submittedBy?.email,
				subject: 'Maintenance Request Confirmation',
				html: emailContent
			});

			console.log('✅ Maintenance request confirmation sent to student');
			return true;
		} catch (error) {
			console.error('❌ Error sending maintenance request confirmation:', error);
			throw error;
		}
	}

	/**
	 * Send notification when maintenance request is assigned
	 */
	static async sendMaintenanceRequestAssigned(maintenance, assignedBy, assignedTo) {
		try {
			// Notify student that request has been assigned
			const studentEmailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #fff3cd; padding: 20px; border-radius: 5px;">
						<h2 style="color: #856404;">Maintenance Request Assigned</h2>
						<p>Dear ${maintenance.student?.firstName || 'Student'},</p>
						<p>Your maintenance request has been assigned and is now being processed:</p>
						<div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
							<h3 style="color: #333; margin-top: 0;">Request Details:</h3>
							<ul>
								<li><strong>Issue:</strong> ${maintenance.issue}</li>
								<li><strong>Status:</strong> ${maintenance.status}</li>
								<li><strong>Assigned To:</strong> ${assignedTo?.firstName} ${assignedTo?.lastName}</li>
								<li><strong>Assigned By:</strong> ${assignedBy?.firstName} ${assignedBy?.lastName}</li>
								<li><strong>Assignment Date:</strong> ${new Date().toLocaleDateString()}</li>
							</ul>
						</div>
						<p>You will receive further updates as the work progresses.</p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			// Notify assigned person
			const assignedEmailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #d1ecf1; padding: 20px; border-radius: 5px;">
						<h2 style="color: #0c5460;">New Maintenance Assignment</h2>
						<p>Dear ${assignedTo?.firstName || 'Team Member'},</p>
						<p>You have been assigned a new maintenance request:</p>
						<div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
							<h3 style="color: #333; margin-top: 0;">Request Details:</h3>
							<ul>
								<li><strong>Issue:</strong> ${maintenance.issue}</li>
								<li><strong>Description:</strong> ${maintenance.description || 'No description provided'}</li>
								<li><strong>Category:</strong> ${maintenance.category}</li>
								<li><strong>Priority:</strong> ${maintenance.priority}</li>
								<li><strong>Residence:</strong> ${maintenance.residence?.name || 'N/A'}</li>
								<li><strong>Student:</strong> ${maintenance.student?.firstName} ${maintenance.student?.lastName}</li>
								<li><strong>Student Email:</strong> ${maintenance.student?.email}</li>
							</ul>
						</div>
						<p>Please review and begin work on this request as soon as possible.</p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			// Send to student
			if (maintenance.student?.email) {
				await sendEmail({
					to: maintenance.student.email,
					subject: 'Maintenance Request Assigned',
					html: studentEmailContent
				});
			}

			// Send to assigned person
			if (assignedTo?.email) {
				await sendEmail({
					to: assignedTo.email,
					subject: 'New Maintenance Assignment',
					html: assignedEmailContent
				});
			}

			console.log('✅ Maintenance request assignment notifications sent');
			return true;
		} catch (error) {
			console.error('❌ Error sending maintenance assignment notifications:', error);
			throw error;
		}
	}

	/**
	 * Send notification when maintenance request status is updated
	 */
	static async sendMaintenanceStatusUpdate(maintenance, previousStatus, updatedBy) {
		try {
			const statusColors = {
				'pending': '#ffc107',
				'in-progress': '#17a2b8',
				'completed': '#28a745',
				'rejected': '#dc3545',
				'cancelled': '#6c757d'
			};

			const statusDescriptions = {
				'pending': 'Pending Review',
				'in-progress': 'In Progress',
				'completed': 'Completed',
				'rejected': 'Rejected',
				'cancelled': 'Cancelled'
			};

			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: ${statusColors[maintenance.status] || '#f8f9fa'}; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">Maintenance Request Status Update</h2>
						<p>Dear ${maintenance.student?.firstName || 'Student'},</p>
						<p>Your maintenance request status has been updated:</p>
						<div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
							<h3 style="color: #333; margin-top: 0;">Status Change:</h3>
							<ul>
								<li><strong>Previous Status:</strong> ${statusDescriptions[previousStatus] || previousStatus}</li>
								<li><strong>New Status:</strong> ${statusDescriptions[maintenance.status] || maintenance.status}</li>
								<li><strong>Issue:</strong> ${maintenance.issue}</li>
								<li><strong>Updated By:</strong> ${updatedBy?.firstName} ${updatedBy?.lastName}</li>
								<li><strong>Update Date:</strong> ${new Date().toLocaleDateString()}</li>
							</ul>
						</div>
						${maintenance.status === 'completed' ? '<p><strong>Your maintenance request has been completed. Please check the work and let us know if you have any concerns.</strong></p>' : ''}
						${maintenance.status === 'rejected' ? '<p><strong>Your maintenance request has been rejected. Please contact the maintenance team for more information.</strong></p>' : ''}
						<p>You can track the status of your request through your student portal.</p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			await sendEmail({
				to: maintenance.student?.email,
				subject: `Maintenance Request Status: ${statusDescriptions[maintenance.status] || maintenance.status}`,
				html: emailContent
			});

			console.log('✅ Maintenance status update notification sent');
			return true;
		} catch (error) {
			console.error('❌ Error sending maintenance status update notification:', error);
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
					<div style="background-color: #d4edda; padding: 20px; border-radius: 5px;">
						<h2 style="color: #155724;">Maintenance Request Approved</h2>
						<p>Dear ${maintenance.student?.firstName || 'Student'},</p>
						<p>Great news! Your maintenance request has been approved by finance:</p>
						<div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
							<h3 style="color: #333; margin-top: 0;">Approval Details:</h3>
							<ul>
								<li><strong>Issue:</strong> ${maintenance.issue}</li>
								<li><strong>Description:</strong> ${maintenance.description || 'No description provided'}</li>
								<li><strong>Category:</strong> ${maintenance.category}</li>
								<li><strong>Priority:</strong> ${maintenance.priority}</li>
								<li><strong>Residence:</strong> ${maintenance.residence?.name || 'N/A'}</li>
								<li><strong>Approved Amount:</strong> $${maintenance.amount?.toFixed(2) || '0.00'}</li>
								<li><strong>Approved By:</strong> ${approvedBy?.firstName} ${approvedBy?.lastName}</li>
								<li><strong>Approval Date:</strong> ${new Date().toLocaleDateString()}</li>
							</ul>
						</div>
						<p><strong>What happens next?</strong></p>
						<ol>
							<li>A technician will be assigned to your request</li>
							<li>You will receive notification when work begins</li>
							<li>You will be updated on the progress</li>
							<li>You will be notified when the work is completed</li>
						</ol>
						<p>Thank you for your patience. We will address your maintenance request as soon as possible.</p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			await sendEmail({
				to: maintenance.student?.email,
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
	 * Send notification when maintenance request is rejected by finance
	 */
	static async sendMaintenanceRequestRejected(maintenance, rejectedBy, rejectionReason) {
		try {
			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8d7da; padding: 20px; border-radius: 5px;">
						<h2 style="color: #721c24;">Maintenance Request Rejected</h2>
						<p>Dear ${maintenance.student?.firstName || 'Student'},</p>
						<p>We regret to inform you that your maintenance request has been rejected:</p>
						<div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
							<h3 style="color: #333; margin-top: 0;">Request Details:</h3>
							<ul>
								<li><strong>Issue:</strong> ${maintenance.issue}</li>
								<li><strong>Description:</strong> ${maintenance.description || 'No description provided'}</li>
								<li><strong>Category:</strong> ${maintenance.category}</li>
								<li><strong>Priority:</strong> ${maintenance.priority}</li>
								<li><strong>Residence:</strong> ${maintenance.residence?.name || 'N/A'}</li>
								<li><strong>Rejected By:</strong> ${rejectedBy?.firstName} ${rejectedBy?.lastName}</li>
								<li><strong>Rejection Date:</strong> ${new Date().toLocaleDateString()}</li>
								<li><strong>Rejection Reason:</strong> ${rejectionReason || 'No reason provided'}</li>
							</ul>
						</div>
						<p><strong>Next Steps:</strong></p>
						<ul>
							<li>If you believe this rejection was made in error, please contact the maintenance team</li>
							<li>You may submit a new request with additional details or clarification</li>
							<li>For urgent issues, please contact the residence manager directly</li>
						</ul>
						<p>If you have any questions, please don't hesitate to contact us.</p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			await sendEmail({
				to: maintenance.student?.email,
				subject: 'Maintenance Request Rejected',
				html: emailContent
			});

			console.log('✅ Maintenance request rejection notification sent');
			return true;
		} catch (error) {
			console.error('❌ Error sending maintenance rejection notification:', error);
			throw error;
		}
	}

	/**
	 * Send notification when admin creates maintenance request (sends to CEO and Finance Admin)
	 */
	static async sendAdminMaintenanceRequestToCEOAndFinance(maintenance, submittedBy) {
		try {
			// Get CEO and Finance Admin users
			const User = require('../models/User');
			const ceoAndFinanceUsers = await User.find({
				role: { $in: ['ceo', 'finance_admin', 'finance'] }
			});

		// Helper function to format values with better fallbacks
		const formatValue = (value, fallback = 'Not specified') => {
			if (value === null || value === undefined || value === '') {
				return fallback;
			}
			return value;
		};
		
		// Format category with proper capitalization
		const formatCategory = (category) => {
			if (!category) return 'Not specified';
			return category.split('_').map(word => 
				word.charAt(0).toUpperCase() + word.slice(1)
			).join(' ');
		};
		
		// Format residence name
		const residenceName = maintenance.residence?.name || 
			(maintenance.residence && typeof maintenance.residence === 'string' ? maintenance.residence : 'Not specified');
		
		// Format room information
		const roomInfo = formatValue(maintenance.room, 'Not specified');
		
		const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">New Maintenance Request - Admin Created</h2>
						<p>Dear Management Team,</p>
						<p>An admin has created a new maintenance request that requires your attention:</p>
						
						<div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
							<h3 style="color: #333; margin-top: 0;">Request Details</h3>
							<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
								<tbody>
									<tr>
										<td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold; width: 30%;">Issue</td>
										<td style="border: 1px solid #ddd; padding: 8px;">${formatValue(maintenance.issue, 'No issue specified')}</td>
									</tr>
									<tr>
										<td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Description</td>
										<td style="border: 1px solid #ddd; padding: 8px;">${formatValue(maintenance.description, 'No description provided')}</td>
									</tr>
									<tr>
										<td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Category</td>
										<td style="border: 1px solid #ddd; padding: 8px;">${formatCategory(maintenance.category)}</td>
									</tr>
									<tr>
										<td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Priority</td>
										<td style="border: 1px solid #ddd; padding: 8px;">
											<span style="color: ${maintenance.priority === 'urgent' ? '#dc3545' : maintenance.priority === 'high' ? '#fd7e14' : maintenance.priority === 'medium' ? '#ffc107' : '#28a745'}; font-weight: bold;">
												${formatValue(maintenance.priority, 'Medium').charAt(0).toUpperCase() + formatValue(maintenance.priority, 'Medium').slice(1)}
											</span>
										</td>
									</tr>
									${roomInfo !== 'Not specified' ? `
									<tr>
										<td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Room</td>
										<td style="border: 1px solid #ddd; padding: 8px;">${roomInfo}</td>
									</tr>
									` : ''}
									<tr>
										<td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Residence</td>
										<td style="border: 1px solid #ddd; padding: 8px;">${residenceName}</td>
									</tr>
									<tr>
										<td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Amount</td>
										<td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold; color: #007bff; font-size: 16px;">
											$${(maintenance.amount || 0).toFixed(2)}
										</td>
									</tr>
									<tr>
										<td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Created By</td>
										<td style="border: 1px solid #ddd; padding: 8px;">${submittedBy?.firstName} ${submittedBy?.lastName} (${submittedBy?.email})</td>
									</tr>
									<tr>
										<td style="border: 1px solid #ddd; padding: 8px; background-color: #f8f9fa; font-weight: bold;">Created Date</td>
										<td style="border: 1px solid #ddd; padding: 8px;">${new Date(maintenance.createdAt || Date.now()).toLocaleDateString()}</td>
									</tr>
								</tbody>
							</table>
						</div>
						
						<div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 15px 0;">
							<h3 style="color: #1976d2; margin-top: 0;">Action Required</h3>
							<p>Please review and process this maintenance request for approval. The request requires your attention due to its priority level and estimated cost.</p>
						</div>
						
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			// Send to all CEO and Finance users with valid email addresses
			let sentCount = 0;
			for (const user of ceoAndFinanceUsers) {
				// Skip invalid email addresses (like alamait.com domain) - same logic as monthly requests
				if (!user.email || !user.email.includes('@')) {
					console.log(`⚠️ Skipping invalid email: ${user.email}`);
					continue;
				}
				
				try {
					await sendEmail({
						to: user.email,
						subject: 'New Maintenance Request - Admin Created - Action Required',
						html: emailContent
					});
					sentCount++;
					console.log(`✅ Email sent to: ${user.email}`);
				} catch (emailError) {
					console.error(`❌ Failed to send email to ${user.email}:`, emailError.message);
				}
			}

			console.log(`✅ Admin maintenance request notification sent to ${sentCount} CEO/Finance users`);
			return true;
		} catch (error) {
			console.error('❌ Error sending admin maintenance request notification:', error);
			throw error;
		}
	}

	/**
	 * Send notification when admin creates request (sends to CEO and Finance Admin) - for Request objects
	 */
	static async sendAdminRequestToCEOAndFinance(request, submittedBy) {
		try {
			// Get CEO and Finance Admin users
			const User = require('../models/User');
			const ceoAndFinanceUsers = await User.find({
				role: { $in: ['ceo', 'finance_admin', 'finance'] }
			});

			// Determine request type display name
			let requestTypeDisplay = 'Request';
			if (request.type === 'student_maintenance') {
				requestTypeDisplay = 'Student Maintenance Request';
			} else if (request.type === 'operational') {
				requestTypeDisplay = 'Operational Request';
			} else if (request.type === 'financial') {
				requestTypeDisplay = 'Financial Request';
			} else if (request.type === 'maintenance') {
				requestTypeDisplay = 'Maintenance Request';
			}

		// Helper function to format values with better fallbacks
		const formatValue = (value, fallback = 'Not specified') => {
			if (value === null || value === undefined || value === '') {
				return fallback;
			}
			return value;
		};
		
		// Format category with proper capitalization
		const formatCategory = (category) => {
			if (!category) return 'Not specified';
			return category.split('_').map(word => 
				word.charAt(0).toUpperCase() + word.slice(1)
			).join(' ');
		};
		
		// Format residence name
		const residenceName = request.residence?.name || 
			(request.residence && typeof request.residence === 'string' ? request.residence : 'Not specified');
		
		// Format room information
		const roomInfo = formatValue(request.room, 'Not specified');
		
		// Format department information
		const departmentInfo = formatValue(request.department, 'Not specified');
		
		const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">New ${requestTypeDisplay} - Admin Created</h2>
						<p>Dear Management Team,</p>
						<p>An admin has created a new ${requestTypeDisplay.toLowerCase()} that requires your attention:</p>
						<ul>
							<li><strong>Request Type:</strong> ${requestTypeDisplay}</li>
							<li><strong>Title:</strong> ${formatValue(request.title, 'No title provided')}</li>
							<li><strong>Description:</strong> ${formatValue(request.description, 'No description provided')}</li>
							${request.issue ? `<li><strong>Issue:</strong> ${request.issue}</li>` : ''}
							<li><strong>Category:</strong> ${formatCategory(request.category)}</li>
							<li><strong>Priority:</strong> ${formatValue(request.priority, 'Medium').charAt(0).toUpperCase() + formatValue(request.priority, 'Medium').slice(1)}</li>
							${roomInfo !== 'Not specified' ? `<li><strong>Room:</strong> ${roomInfo}</li>` : ''}
							<li><strong>Residence:</strong> ${residenceName}</li>
							${departmentInfo !== 'Not specified' ? `<li><strong>Department:</strong> ${departmentInfo}</li>` : ''}
							<li><strong>Amount:</strong> $${(request.amount || request.totalEstimatedCost || 0).toFixed(2)}</li>
							<li><strong>Created By:</strong> ${submittedBy?.firstName} ${submittedBy?.lastName} (${submittedBy?.email})</li>
							<li><strong>Created Date:</strong> ${new Date(request.createdAt || Date.now()).toLocaleDateString()}</li>
						</ul>
						<p><strong>Action Required:</strong> Please review and process this ${requestTypeDisplay.toLowerCase()} for approval.</p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			// Send to all CEO and Finance users with valid email addresses
			let sentCount = 0;
			for (const user of ceoAndFinanceUsers) {
				// Skip invalid email addresses (like alamait.com domain) - same logic as monthly requests
				if (!user.email || !user.email.includes('@')) {
					console.log(`⚠️ Skipping invalid email: ${user.email}`);
					continue;
				}
				
				try {
					// Use same method as invoice emails (reliable queue system)
					await sendEmail({
						to: user.email,
						subject: `New ${requestTypeDisplay} - Admin Created - Action Required`,
						html: emailContent
					});
					sentCount++;
					console.log(`✅ Email sent to: ${user.email}`);
				} catch (emailError) {
					console.error(`❌ Failed to send email to ${user.email}:`, emailError.message);
				}
			}

			console.log(`✅ Admin ${requestTypeDisplay.toLowerCase()} notification sent to ${sentCount} CEO/Finance users`);
			return true;
		} catch (error) {
			console.error('❌ Error sending admin request notification:', error);
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
			const { Residence } = require('../models/Residence');
			const ceoUsers = await User.find({ role: 'ceo' });

			// Resolve residence name robustly
			let residenceName = 'N/A';
			try {
				if (request.residence?.name) {
					residenceName = request.residence.name;
				} else if (request.residence) {
					const residenceId = typeof request.residence === 'string' ? request.residence : request.residence._id;
					if (residenceId) {
						// Ensure Residence model is properly loaded
						if (typeof Residence.findById === 'function') {
							const resDoc = await Residence.findById(residenceId).select('name');
							if (resDoc && resDoc.name) {
								residenceName = resDoc.name;
							}
						} else {
							console.error('Residence model not properly loaded - findById is not a function');
						}
					}
				}
			} catch (_) {}

			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">Request Pending CEO Approval</h2>
						<p>Dear CEO,</p>
						<p>A new request has been submitted for your approval:</p>
						<ul>
							<li><strong>Request Type:</strong> ${request.type || 'Maintenance'}</li>
							<li><strong>Title:</strong> ${request.title || request.issue}</li>
							<li><strong>Location:</strong> ${residenceName}</li>
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
				// Skip invalid emails as elsewhere
				if (!ceo.email || !ceo.email.includes('@')) {
					continue;
				}
				
				try {
					// Use same method as invoice emails (reliable queue system)
					await sendEmail({
						to: ceo.email,
						subject: 'Request Pending CEO Approval',
						html: emailContent
					});
					console.log(`✅ CEO approval email sent to: ${ceo.email}`);
				} catch (emailError) {
					console.error(`❌ Failed to send CEO approval email to ${ceo.email}:`, emailError.message);
				}
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
			// Get recipient email with fallback
			const recipientEmail = request.submittedBy?.email || process.env.TEST_EMAIL || 'macdonaldsairos24@gmail.com';
			
			if (!recipientEmail) {
				console.log('⚠️  No recipient email found for CEO approval notification, skipping...');
				return false;
			}

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

			// Send email in background to avoid blocking request processing
			setTimeout(async () => {
				try {
					await sendEmail({
						to: recipientEmail,
						subject: `Request ${approved ? 'Approved' : 'Rejected'} by CEO`,
						html: emailContent
					});
					console.log(`✅ CEO approval email sent to: ${recipientEmail}`);
				} catch (emailError) {
					console.error(`❌ Failed to send CEO approval email to ${recipientEmail}:`, emailError.message);
				}
			}, 100);

			console.log(`✅ CEO approval notification sent to ${recipientEmail}`);
			return true;
		} catch (error) {
			console.error('❌ Error sending CEO approval notification:', error);
			throw error;
		}
	}

	/**
	 * Send notification when request is sent to CEO for approval
	 */
	static async sendRequestSentToCEONotification(request, sentBy) {
		try {
			// Get recipient email with fallback
			const recipientEmail = request.submittedBy?.email || process.env.TEST_EMAIL || 'macdonaldsairos24@gmail.com';
			
			if (!recipientEmail) {
				console.log('⚠️  No recipient email found for CEO notification, skipping...');
				return false;
			}

			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">Request Sent to CEO for Approval</h2>
						<p>Dear ${request.submittedBy?.firstName || 'User'},</p>
						<p>Your request has been sent to the CEO for final approval:</p>
						<ul>
							<li><strong>Request Title:</strong> ${request.title || request.issue}</li>
							<li><strong>Request Type:</strong> ${request.type || 'Maintenance'}</li>
							<li><strong>Current Status:</strong> Pending CEO Approval</li>
							<li><strong>Sent By:</strong> ${sentBy.firstName} ${sentBy.lastName}</li>
							<li><strong>Date:</strong> ${new Date().toLocaleDateString()}</li>
						</ul>
						<p>You will be notified once the CEO makes a decision.</p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			await sendEmail({
				to: recipientEmail,
				subject: 'Request Sent to CEO for Approval',
				html: emailContent
			});

			console.log(`✅ Request sent to CEO notification sent to ${recipientEmail}`);
			return true;
		} catch (error) {
			console.error('❌ Error sending request sent to CEO notification:', error);
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
	 * Send event update notification
	 */
	static async sendEventUpdateNotification(event, previousEvent, updatedBy) {
		try {
			// Get all students
			const User = require('../models/User');
			const students = await User.find({ role: 'student' });

			// Determine what changed
			const changes = [];
			if (previousEvent.title !== event.title) changes.push(`Title: "${previousEvent.title}" → "${event.title}"`);
			if (previousEvent.date.getTime() !== event.date.getTime()) changes.push(`Date: ${previousEvent.date.toLocaleDateString()} → ${event.date.toLocaleDateString()}`);
			if (previousEvent.startTime !== event.startTime) changes.push(`Time: ${previousEvent.startTime} → ${event.startTime}`);
			if (previousEvent.location !== event.location) changes.push(`Location: ${previousEvent.location} → ${event.location}`);
			if (previousEvent.description !== event.description) changes.push('Description updated');

			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">Event Update</h2>
						<p>Dear Students,</p>
						<p>The following event has been updated:</p>
						<ul>
							<li><strong>Event:</strong> ${event.title}</li>
							<li><strong>Date:</strong> ${new Date(event.date).toLocaleDateString()}</li>
							<li><strong>Time:</strong> ${event.startTime}</li>
							<li><strong>Location:</strong> ${event.location}</li>
							${event.description ? `<li><strong>Description:</strong> ${event.description}</li>` : ''}
						</ul>
						${changes.length > 0 ? `
						<p><strong>Changes made:</strong></p>
						<ul>
							${changes.map(change => `<li>${change}</li>`).join('')}
						</ul>
						` : ''}
						<p>Please update your calendars accordingly.</p>
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
					subject: `Event Updated: ${event.title}`,
					html: emailContent
				});
			}

			console.log(`✅ Event update notification sent to ${students.length} students`);
			return true;
		} catch (error) {
			console.error('❌ Error sending event update notification:', error);
			throw error;
		}
	}

	/**
	 * Send event cancellation notification
	 */
	static async sendEventCancellationNotification(event, cancelledBy) {
		try {
			// Get all students
			const User = require('../models/User');
			const students = await User.find({ role: 'student' });

			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">Event Cancelled</h2>
						<p>Dear Students,</p>
						<p>The following event has been cancelled:</p>
						<ul>
							<li><strong>Event:</strong> ${event.title}</li>
							<li><strong>Date:</strong> ${new Date(event.date).toLocaleDateString()}</li>
							<li><strong>Time:</strong> ${event.startTime}</li>
							<li><strong>Location:</strong> ${event.location}</li>
						</ul>
						<p>We apologize for any inconvenience. Please check for future events.</p>
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
					subject: `Event Cancelled: ${event.title}`,
					html: emailContent
				});
			}

			console.log(`✅ Event cancellation notification sent to ${students.length} students`);
			return true;
		} catch (error) {
			console.error('❌ Error sending event cancellation notification:', error);
			throw error;
		}
	}

	/**
	 * 7. ROOM CHANGE & BOOKING NOTIFICATIONS
	 */
	
	/**
	 * Send room change request notification
	 */
	static async sendRoomChangeRequestNotification(application, requestedRoom, currentRoom, student) {
		try {
			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">Room Change Request Received</h2>
						<p>Dear ${student.firstName},</p>
						<p>We have received your request to ${application.requestType} your room:</p>
						<ul>
							<li><strong>Current Room:</strong> ${currentRoom}</li>
							<li><strong>Requested Room:</strong> ${requestedRoom.roomNumber}</li>
							<li><strong>Room Type:</strong> ${requestedRoom.type}</li>
							<li><strong>Request Type:</strong> ${application.requestType}</li>
							<li><strong>Request Date:</strong> ${new Date(application.applicationDate).toLocaleDateString()}</li>
							<li><strong>Reason:</strong> ${application.reason}</li>
						</ul>
						<p>We will review your request and notify you of the decision within 3-5 business days.</p>
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
				subject: 'Room Change Request Received',
				html: emailContent
			});

			console.log(`✅ Room change request notification sent to ${student.email}`);
			return true;
		} catch (error) {
			console.error('❌ Error sending room change request notification:', error);
			throw error;
		}
	}

	/**
	 * Send room change approval notification
	 */
	static async sendRoomChangeApprovalNotification(application, approvedBy) {
		try {
			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">Room Change Request Approved</h2>
						<p>Dear ${application.firstName},</p>
						<p>Great news! Your room change request has been approved:</p>
						<ul>
							<li><strong>Current Room:</strong> ${application.currentRoom}</li>
							<li><strong>New Room:</strong> ${application.preferredRoom}</li>
							<li><strong>Request Type:</strong> ${application.requestType}</li>
							<li><strong>Approval Date:</strong> ${new Date().toLocaleDateString()}</li>
							<li><strong>Approved By:</strong> ${approvedBy.firstName} ${approvedBy.lastName}</li>
							<li><strong>Application Code:</strong> ${application.applicationCode}</li>
						</ul>
						<p>Next Steps:</p>
						<ol>
							<li>Complete any required payments for the new room</li>
							<li>Schedule your move-in date</li>
							<li>Return keys for your current room</li>
							<li>Collect keys for your new room</li>
						</ol>
						<p>Please contact administration to arrange the details of your move.</p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			await sendEmail({
				to: application.email,
				subject: 'Room Change Request Approved',
				html: emailContent
			});

			console.log(`✅ Room change approval notification sent to ${application.email}`);
			return true;
		} catch (error) {
			console.error('❌ Error sending room change approval notification:', error);
			throw error;
		}
	}

	/**
	 * Send room change rejection notification
	 */
	static async sendRoomChangeRejectionNotification(application, rejectedBy, reason) {
		try {
			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">Room Change Request Update</h2>
						<p>Dear ${application.firstName},</p>
						<p>We regret to inform you that your room change request could not be approved:</p>
						<ul>
							<li><strong>Current Room:</strong> ${application.currentRoom}</li>
							<li><strong>Requested Room:</strong> ${application.preferredRoom}</li>
							<li><strong>Request Type:</strong> ${application.requestType}</li>
							<li><strong>Decision Date:</strong> ${new Date().toLocaleDateString()}</li>
							<li><strong>Reviewed By:</strong> ${rejectedBy.firstName} ${rejectedBy.lastName}</li>
							${reason ? `<li><strong>Reason:</strong> ${reason}</li>` : ''}
						</ul>
						<p>You may submit a new request in the future if circumstances change.</p>
						<p>If you have any questions, please contact administration.</p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			await sendEmail({
				to: application.email,
				subject: 'Room Change Request Update',
				html: emailContent
			});

			console.log(`✅ Room change rejection notification sent to ${application.email}`);
			return true;
		} catch (error) {
			console.error('❌ Error sending room change rejection notification:', error);
			throw error;
		}
	}

	/**
	 * Send booking confirmation notification
	 */
	static async sendBookingConfirmationNotification(booking, student) {
		try {
			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">Booking Confirmation</h2>
						<p>Dear ${student.firstName},</p>
						<p>Your booking has been confirmed!</p>
						<ul>
							<li><strong>Residence:</strong> ${booking.residence?.name || 'N/A'}</li>
							<li><strong>Room:</strong> ${booking.room?.roomNumber || 'N/A'}</li>
							<li><strong>Room Type:</strong> ${booking.room?.type || 'N/A'}</li>
							<li><strong>Check-in:</strong> ${new Date(booking.startDate).toLocaleDateString()}</li>
							<li><strong>Check-out:</strong> ${new Date(booking.endDate).toLocaleDateString()}</li>
							<li><strong>Monthly Rent:</strong> $${booking.room?.price || booking.totalAmount}</li>
							<li><strong>Status:</strong> ${booking.status}</li>
						</ul>
						<p>Next Steps:</p>
						<ol>
							<li>Complete your payment to secure your booking</li>
							<li>Submit any required documents</li>
							<li>Schedule your move-in date</li>
						</ol>
						<p>If you have any questions, please don't hesitate to contact us.</p>
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
				subject: 'Booking Confirmation - Alamait Student Accommodation',
				html: emailContent
			});

			console.log(`✅ Booking confirmation notification sent to ${student.email}`);
			return true;
		} catch (error) {
			console.error('❌ Error sending booking confirmation notification:', error);
			throw error;
		}
	}

	/**
	 * Send booking cancellation notification
	 */
	static async sendBookingCancellationNotification(booking, student, reason) {
		try {
			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #333;">Booking Cancellation</h2>
						<p>Dear ${student.firstName},</p>
						<p>Your booking has been cancelled:</p>
						<ul>
							<li><strong>Residence:</strong> ${booking.residence?.name || 'N/A'}</li>
							<li><strong>Room:</strong> ${booking.room?.roomNumber || 'N/A'}</li>
							<li><strong>Check-in:</strong> ${new Date(booking.startDate).toLocaleDateString()}</li>
							<li><strong>Check-out:</strong> ${new Date(booking.endDate).toLocaleDateString()}</li>
							<li><strong>Cancellation Date:</strong> ${new Date().toLocaleDateString()}</li>
							${reason ? `<li><strong>Reason:</strong> ${reason}</li>` : ''}
						</ul>
						<p>If you have any questions about this cancellation, please contact administration.</p>
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
				subject: 'Booking Cancellation - Alamait Student Accommodation',
				html: emailContent
			});

			console.log(`✅ Booking cancellation notification sent to ${student.email}`);
			return true;
		} catch (error) {
			console.error('❌ Error sending booking cancellation notification:', error);
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

	/**
	 * Send payment confirmation email to student
	 */
	static async sendPaymentConfirmation({ studentEmail, studentName, amount, paymentId, method, date, allocation }) {
		try {
			// Generate allocation breakdown HTML
			let allocationHtml = '';
			if (allocation && allocation.monthlyBreakdown && allocation.monthlyBreakdown.length > 0) {
				allocationHtml = `
					<div style="background-color: #e8f5e8; padding: 15px; border-radius: 5px; margin: 15px 0;">
						<h3 style="color: #28a745; margin-top: 0;">Payment Allocation</h3>
						<p><strong>Total Allocated:</strong> $${allocation.summary?.totalAllocated?.toFixed(2) || '0.00'}</p>
						<p><strong>Remaining Balance:</strong> $${allocation.summary?.remainingBalance?.toFixed(2) || '0.00'}</p>
						<p><strong>Months Covered:</strong> ${allocation.summary?.monthsCovered || 0}</p>
						${allocation.summary?.advancePaymentAmount > 0 ? `<p><strong>Advance Payment:</strong> $${allocation.summary.advancePaymentAmount.toFixed(2)}</p>` : ''}
						
						<h4 style="color: #28a745; margin-bottom: 10px;">Monthly Breakdown:</h4>
						<table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
							<thead>
								<tr style="background-color: #f8f9fa;">
									<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Month</th>
									<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Type</th>
									<th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Amount</th>
									<th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Status</th>
								</tr>
							</thead>
							<tbody>
								${allocation.monthlyBreakdown.map(item => `
									<tr>
										<td style="border: 1px solid #ddd; padding: 8px;">${item.monthName || item.month}</td>
										<td style="border: 1px solid #ddd; padding: 8px;">${item.paymentType || 'N/A'}</td>
										<td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${item.amountAllocated?.toFixed(2) || '0.00'}</td>
										<td style="border: 1px solid #ddd; padding: 8px;">
											<span style="color: ${item.allocationType === 'rent_settlement' ? '#28a745' : '#007bff'}; font-weight: bold;">
												${item.allocationType === 'rent_settlement' ? 'Settled' : 'Advance'}
											</span>
										</td>
									</tr>
								`).join('')}
							</tbody>
						</table>
					</div>
				`;
			}

			const emailContent = `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
					<div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
						<h2 style="color: #28a745;">Payment Confirmation</h2>
						<p>Dear ${studentName},</p>
						<p>We have successfully received your payment. Here are the details:</p>
						<div style="background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0;">
							<ul style="list-style: none; padding: 0;">
								<li><strong>Payment ID:</strong> ${paymentId}</li>
								<li><strong>Amount:</strong> $${amount.toFixed(2)}</li>
								<li><strong>Payment Method:</strong> ${method}</li>
								<li><strong>Date:</strong> ${new Date(date).toLocaleDateString()}</li>
								<li><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">Confirmed</span></li>
							</ul>
						</div>
						${allocationHtml}
						<p>Thank you for your payment. If you have any questions, please contact our finance team.</p>
						<hr style="margin: 20px 0;">
						<p style="font-size: 12px; color: #666;">
							This is an automated message from Alamait Student Accommodation.<br>
							Please do not reply to this email.
						</p>
					</div>
				</div>
			`;

			await sendEmail({
				to: studentEmail,
				subject: 'Payment Confirmation - Alamait Student Accommodation',
				html: emailContent
			});

			console.log(`✅ Payment confirmation email sent to ${studentEmail}`);
		} catch (error) {
			console.error('❌ Error sending payment confirmation email:', error);
			throw error;
		}
	}
}

module.exports = EmailNotificationService; 