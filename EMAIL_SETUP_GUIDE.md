# 📧 Email Setup Guide for Alamait Maintenance System

## 🎯 Current Status
✅ **Email functionality is fully implemented and working**
❌ **Email credentials need to be configured**

## 🔧 How to Fix the "Missing credentials for PLAIN" Error

### Step 1: Create Environment Variables

Create a `.env` file in the `alamait_backend` directory with the following content:

```bash
# Database Configuration
MONGODB_URI=mongodb+srv://macdonaldsairos24:12345678@cluster0.qzq1z.mongodb.net/alamait?retryWrites=true&w=majority&appName=Cluster0

# Email Configuration (Gmail)
EMAIL_USER=your-gmail@gmail.com
EMAIL_APP_PASSWORD=your-gmail-app-password

# JWT Secret
JWT_SECRET=your-jwt-secret-key-here

# Server Configuration
PORT=5000
NODE_ENV=development
```

### Step 2: Set Up Gmail App Password

**⚠️ IMPORTANT: You cannot use your regular Gmail password. You need an App Password.**

1. **Go to your Google Account settings:**
   - Visit: https://myaccount.google.com/
   - Click on "Security"

2. **Enable 2-Factor Authentication:**
   - Find "2-Step Verification" and enable it
   - Follow the setup process

3. **Generate App Password:**
   - Go back to Security
   - Find "App passwords" (appears after enabling 2FA)
   - Select "Mail" as the app
   - Select "Other" as device
   - Enter "Alamait System" as the name
   - Click "Generate"
   - Copy the 16-character password

4. **Update your .env file:**
   ```bash
   EMAIL_USER=your-actual-gmail@gmail.com
   EMAIL_APP_PASSWORD=your-16-character-app-password
   ```

### Step 3: Test Email Configuration

After setting up the credentials, run:

```bash
node test-maintenance-email.js
```

## 🎉 What's Already Working

### ✅ Complete Email Workflow Implemented:

1. **Student submits maintenance request** → Admins notified + Student gets confirmation
2. **Admin assigns request** → Student + Technician notified  
3. **Status updates** → Student notified with color-coded status
4. **Finance approves** → Student gets detailed approval confirmation
5. **Finance rejects** → Student gets rejection with reasons and next steps

### ✅ Professional Email Templates:

- **Responsive HTML design** - Works on all devices
- **Color-coded status indicators** - Visual status feedback
- **Detailed information** - Complete request details
- **Next steps guidance** - Clear instructions on what happens next
- **Professional branding** - Proper Alamait branding and contact details

### ✅ Error Handling:

- **Graceful failures** - Email errors don't break main functionality
- **Comprehensive logging** - Detailed error logging for debugging
- **Non-blocking** - Main operations continue even if emails fail

## 🔍 Alternative Email Services

If you prefer not to use Gmail, you can configure other email services:

### Option 1: Outlook/Hotmail
```bash
EMAIL_SERVICE=outlook
EMAIL_USER=your-outlook@outlook.com
EMAIL_APP_PASSWORD=your-outlook-app-password
```

### Option 2: Custom SMTP Server
```bash
EMAIL_HOST=smtp.your-provider.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@your-domain.com
EMAIL_APP_PASSWORD=your-password
```

## 🚀 Production Deployment

For production deployment, consider using:

1. **SendGrid** - Professional email service
2. **Mailgun** - Reliable email delivery
3. **AWS SES** - Cost-effective for high volume

## 📋 Email Templates Available

1. **Maintenance Request Submitted** (Admin notification)
2. **Maintenance Request Confirmation** (Student confirmation)
3. **Maintenance Request Assigned** (Student + Technician notification)
4. **Maintenance Status Update** (Status change notification)
5. **Maintenance Request Approved** (Finance approval)
6. **Maintenance Request Rejected** (Finance rejection)

## 🎯 Next Steps

1. **Set up Gmail App Password** (see Step 2 above)
2. **Create .env file** with your credentials
3. **Test the email functionality** with `node test-maintenance-email.js`
4. **Deploy to production** with proper email credentials

## 🔧 Troubleshooting

### Common Issues:

1. **"Missing credentials for PLAIN"** → Set up Gmail App Password
2. **"Invalid credentials"** → Check your App Password is correct
3. **"Less secure app access"** → Use App Password instead of regular password
4. **"Rate limit exceeded"** → Gmail has daily sending limits

### Support:

If you need help setting up email credentials, contact your system administrator or refer to Gmail's official documentation on App Passwords. 