# Student Accommodation Management System - Complete Documentation

## 📋 Table of Contents
1. [System Overview](#system-overview)
2. [User Roles & Permissions](#user-roles--permissions)
3. [Dashboard Overview](#dashboard-overview)
4. [Core Modules](#core-modules)
5. [Financial Management](#financial-management)
6. [Student Management](#student-management)
7. [Request & Approval System](#request--approval-system)
8. [Event Management](#event-management)
9. [Reporting & Analytics](#reporting--analytics)
10. [Technical Architecture](#technical-architecture)
11. [API Endpoints](#api-endpoints)
12. [Troubleshooting](#troubleshooting)

---

## 🏢 System Overview

The Student Accommodation Management System is a comprehensive platform designed to manage student housing operations, financial transactions, and administrative tasks. The system supports multiple user roles with specific permissions and provides real-time tracking of all activities.

### Key Features
- **Multi-role Access Control**: Admin, Finance, CEO, and Student roles
- **Financial Management**: Double-entry bookkeeping, petty cash, expense tracking
- **Student Lifecycle Management**: Applications, payments, leases, maintenance requests
- **Request & Approval Workflows**: Automated approval processes with audit trails
- **Real-time Reporting**: Financial statements, audit trails, and analytics
- **Event Management**: Student events with RSVP functionality
- **Document Management**: Lease generation, invoice creation, bulk downloads

---

## 👥 User Roles & Permissions

### 1. **CEO (Chief Executive Officer)**
- **Full System Access**: Oversee all operations
- **Approval Authority**: Final approval for high-value requests
- **Financial Oversight**: View all financial reports and statements
- **Audit Access**: Complete audit trail visibility
- **Strategic Reports**: Executive dashboards and analytics

### 2. **Admin (Administrator)**
- **Student Management**: Add, edit, and manage student records
- **Application Processing**: Review and approve student applications
- **Payment Management**: Process student payments and generate invoices
- **Event Management**: Create and manage student events
- **Maintenance Requests**: Handle student maintenance requests
- **Petty Cash Management**: Manage petty cash transactions
- **Residence Management**: Oversee multiple student residences

### 3. **Finance (Finance Manager/Admin)**
- **Financial Transactions**: Process payments and expenses
- **Double-Entry Bookkeeping**: Create and manage accounting entries
- **Expense Approval**: Review and approve expense requests
- **Account Management**: Manage chart of accounts
- **Financial Reporting**: Generate financial statements
- **Audit Trail**: Track all financial activities
- **Supplier Management**: Manage vendor relationships

### 4. **Student**
- **Application Submission**: Submit accommodation applications
- **Payment Management**: View payment history and make payments
- **Maintenance Requests**: Submit and track maintenance requests
- **Event Participation**: RSVP for student events
- **Document Access**: View leases and invoices
- **Status Tracking**: Monitor application and request status

---

## 📊 Dashboard Overview

### CEO Dashboard
**Purpose**: Executive oversight and strategic decision-making

**Key Components**:
- **Financial Overview**: Income, expenses, profit margins
- **Request Approval Queue**: Pending high-value approvals
- **System Analytics**: Student occupancy rates, revenue trends
- **Audit Trail**: Complete system activity log
- **Performance Metrics**: KPI dashboards and reports

**How to Use**:
1. **View Financial Health**: Check income statements, balance sheets, and cash flow
2. **Approve Requests**: Review and approve pending requests requiring CEO approval
3. **Monitor Performance**: Track key performance indicators and trends
4. **Audit Activities**: Review system audit trails for compliance

### Admin Dashboard
**Purpose**: Day-to-day operational management

**Key Components**:
- **Student Management**: Add, edit, and manage student records
- **Application Processing**: Review and approve student applications
- **Payment Processing**: Handle student payments and generate invoices
- **Event Management**: Create and manage student events
- **Maintenance Requests**: Process student maintenance requests
- **Residence Management**: Oversee multiple student residences

**How to Use**:
1. **Add Students**: Use "Manual Add Student" to create student records
2. **Process Applications**: Review applications and assign rooms
3. **Manage Payments**: Process payments and send invoices
4. **Handle Requests**: Approve/reject maintenance requests
5. **Create Events**: Schedule student events and track RSVPs

### Finance Dashboard
**Purpose**: Financial management and accounting operations

**Key Components**:
- **Transaction Management**: Process financial transactions
- **Expense Approval**: Review and approve expense requests
- **Chart of Accounts**: Manage accounting structure
- **Petty Cash**: Handle petty cash transactions
- **Financial Reports**: Generate statements and reports
- **Audit Trail**: Track all financial activities

**How to Use**:
1. **Process Transactions**: Create double-entry bookkeeping entries
2. **Approve Expenses**: Review expense requests and approve/reject
3. **Manage Accounts**: Maintain chart of accounts structure
4. **Handle Petty Cash**: Process petty cash allocations and expenses
5. **Generate Reports**: Create financial statements and reports

---

## 🔧 Core Modules

### 1. **Request & Approval System**

#### Creating Requests
1. **Student Requests**:
   - Students submit maintenance requests through their dashboard
   - Requests include description, priority, and category
   - System automatically assigns request ID and timestamp

2. **Admin Requests**:
   - Admins can create requests on behalf of students
   - Include residence, room, and detailed description
   - Set priority levels and assign to maintenance staff

#### Approval Workflow
1. **Initial Review**: Admin reviews and categorizes request
2. **Finance Review**: Finance team reviews for cost implications
3. **CEO Approval**: High-value requests require CEO approval
4. **Execution**: Approved requests become expenses
5. **Completion**: Mark requests as completed with documentation

#### Status Tracking
- **Pending**: Awaiting initial review
- **Under Review**: Being evaluated by admin/finance
- **Approved**: Ready for execution
- **In Progress**: Work has begun
- **Completed**: Request fulfilled
- **Rejected**: Request denied with reason

### 2. **Financial Management**

#### Double-Entry Bookkeeping
**When Finance Approves a Request**:
1. **Request Approval**: Finance approves maintenance request
2. **Expense Creation**: System automatically creates expense record
3. **Double Entry**: Creates corresponding accounting entries
   - Debit: Expense Account (e.g., Maintenance Expense)
   - Credit: Accounts Payable or Cash Account

**When Payments Are Made**:
1. **Payment Processing**: Admin/Finance processes payment
2. **Double Entry**: Creates payment entries
   - Debit: Accounts Payable (if previously accrued)
   - Credit: Cash/Bank Account

#### Petty Cash Management
**Allocation Process**:
1. **Request Allocation**: Admin/Finance requests petty cash allocation
2. **Approval**: Finance approves allocation amount
3. **Double Entry**:
   - Debit: Petty Cash Account
   - Credit: Bank Account

**Expense Process**:
1. **Expense Submission**: Submit expense with receipts
2. **Approval**: Finance reviews and approves
3. **Double Entry**:
   - Debit: Expense Account
   - Credit: Petty Cash Account

#### Chart of Accounts
**Automatic Code Generation**:
- **Assets**: 1xxx series (Cash, Accounts Receivable, etc.)
- **Liabilities**: 2xxx series (Accounts Payable, Loans, etc.)
- **Equity**: 3xxx series (Owner's Equity, Retained Earnings)
- **Revenue**: 4xxx series (Rent Income, Other Income)
- **Expenses**: 5xxx series (Maintenance, Utilities, etc.)

### 3. **Student Management**

#### Adding Students
**Manual Add Student Process**:
1. **Basic Information**: Name, email, phone, emergency contact
2. **Residence Assignment**: Select residence and room
3. **Financial Setup**: Set rent amount, admin fee, deposit
4. **Lease Generation**: Automatically generate lease agreement
5. **Debtor Account**: Create debtor account for financial tracking
6. **Email Notification**: Send welcome email with credentials

#### Application Management
**Application Processing**:
1. **Review Application**: Admin reviews submitted application
2. **Room Assignment**: Assign available room based on preferences
3. **Financial Setup**: Set payment terms and amounts
4. **Approval**: Approve application and notify student
5. **Lease Generation**: Generate lease agreement
6. **Payment Setup**: Create payment schedule

#### Payment Management
**Payment Processing**:
1. **Payment Creation**: Admin creates payment record
2. **Status Tracking**: Track payment status (Pending, Paid, Overdue)
3. **Receipt Generation**: Automatically generate payment receipts
4. **Email Notification**: Send receipt to student email
5. **Financial Entries**: Create corresponding accounting entries

### 4. **Event Management**

#### Creating Events
**Admin Process**:
1. **Event Details**: Set title, description, date, time, location
2. **Capacity Management**: Set maximum attendees
3. **Requirements**: Specify any requirements or resources
4. **Student Notification**: Send event notifications to students
5. **RSVP Tracking**: Monitor student responses

#### Student Participation
**RSVP Process**:
1. **Event Viewing**: Students see available events
2. **RSVP Response**: Students can accept/decline invitations
3. **Status Updates**: Real-time updates on event participation
4. **Reminders**: Automated reminders for upcoming events

#### Event Analytics
**Admin View**:
1. **Participation Rates**: Track RSVP percentages
2. **Attendance Reports**: View actual vs. expected attendance
3. **Feedback Collection**: Gather student feedback
4. **Event History**: Review past events and outcomes

---

## 💰 Financial Management

### Transaction Tracker
**Purpose**: Monitor all financial transactions and double-entry bookkeeping

**Features**:
- **Real-time Tracking**: Monitor transactions as they occur
- **Double-Entry Validation**: Ensure debits equal credits
- **Account Balances**: View current account balances
- **Transaction History**: Complete audit trail of all transactions
- **Search & Filter**: Find specific transactions by date, account, or type

**How to Use**:
1. **View Transactions**: Browse all financial transactions
2. **Filter by Account**: View transactions for specific accounts
3. **Date Range**: Filter by date periods
4. **Export Data**: Download transaction reports
5. **Audit Trail**: Track who created each transaction

### Income Statement
**Purpose**: Show revenue, expenses, and net income for a period

**Components**:
- **Revenue**: Rent income, admin fees, deposits, other income
- **Expenses**: Maintenance, utilities, staff costs, administrative expenses
- **Net Income**: Revenue minus expenses

**How to Generate**:
1. **Select Period**: Choose date range for statement
2. **Generate Report**: System calculates totals automatically
3. **Review Details**: Drill down into specific accounts
4. **Export**: Download as PDF or Excel

### Balance Sheet
**Purpose**: Show assets, liabilities, and equity at a point in time

**Components**:
- **Assets**: Cash, accounts receivable, property, equipment
- **Liabilities**: Accounts payable, loans, deposits held
- **Equity**: Owner's equity, retained earnings

**How to Generate**:
1. **Select Date**: Choose specific date for balance sheet
2. **Generate Report**: System calculates account balances
3. **Review Balances**: Verify account balances are correct
4. **Export**: Download for external reporting

### Cash Flow Statement
**Purpose**: Track cash inflows and outflows

**Components**:
- **Operating Activities**: Cash from operations
- **Investing Activities**: Cash used for investments
- **Financing Activities**: Cash from financing

**How to Generate**:
1. **Select Period**: Choose date range for cash flow
2. **Generate Report**: System categorizes cash flows
3. **Review Trends**: Analyze cash flow patterns
4. **Export**: Download for analysis

---

## 🏠 Residence Management

### Multi-Residence Support
**Features**:
- **Residence Profiles**: Detailed information for each residence
- **Room Management**: Track room availability and assignments
- **Financial Tracking**: Separate financial records per residence
- **Staff Assignment**: Assign staff to specific residences

### Room Management
**Process**:
1. **Room Setup**: Define room types, prices, and amenities
2. **Availability Tracking**: Monitor room occupancy
3. **Assignment Process**: Assign students to available rooms
4. **Maintenance Tracking**: Track maintenance by room

---

## 📊 Reporting & Analytics

### Audit Trail
**Purpose**: Track all user actions for compliance and security

**Features**:
- **User Actions**: Log all create, update, delete operations
- **Financial Transactions**: Track all financial activities
- **Request Approvals**: Monitor approval workflows
- **System Access**: Track login/logout activities

**How to Use**:
1. **View Logs**: Browse all audit trail entries
2. **Filter by User**: View actions by specific users
3. **Filter by Action**: View specific types of actions
4. **Date Range**: Filter by time periods
5. **Export**: Download audit reports

### Management Reports
**Available Reports**:
- **Student Occupancy**: Room utilization rates
- **Financial Performance**: Revenue and expense analysis
- **Request Statistics**: Request volume and approval rates
- **Payment Tracking**: Payment collection rates
- **Event Participation**: Student engagement metrics

---

## 🔌 Technical Architecture

### Backend Stack
- **Node.js**: Server runtime environment
- **Express.js**: Web application framework
- **MongoDB**: NoSQL database
- **Mongoose**: MongoDB object modeling
- **JWT**: Authentication and authorization

### Frontend Stack
- **React**: User interface library
- **Material-UI**: Component library
- **Axios**: HTTP client for API calls
- **React Router**: Client-side routing

### Key Features
- **RESTful API**: Standard API design
- **Role-based Access Control**: Secure permission system
- **Real-time Updates**: Live data synchronization
- **File Upload**: Document management
- **Email Integration**: Automated notifications

---

## 🔗 API Endpoints

### Authentication
```
POST /api/auth/login
POST /api/auth/register
POST /api/auth/logout
```

### Student Management
```
GET /api/admin/students
POST /api/admin/students
GET /api/admin/students/:id
PUT /api/admin/students/:id
DELETE /api/admin/students/:id
```

### Financial Management
```
GET /api/finance/transactions
POST /api/finance/transactions
GET /api/finance/accounts
POST /api/finance/accounts
GET /api/finance/audit-log
```

### Request Management
```
GET /api/requests
POST /api/requests
PUT /api/requests/:id/approve
PUT /api/requests/:id/reject
```

### Event Management
```
GET /api/events
POST /api/events
PUT /api/events/:id/rsvp
```

---

## 🛠️ Troubleshooting

### Common Issues

#### Authentication Problems
**Symptoms**: 401 Unauthorized errors
**Solutions**:
1. Check if token is expired
2. Verify user has correct role permissions
3. Clear browser cache and re-login
4. Check localStorage for valid token

#### Financial Transaction Errors
**Symptoms**: Double-entry imbalances
**Solutions**:
1. Verify debits equal credits
2. Check account codes are valid
3. Ensure proper approval workflow
4. Review audit trail for errors

#### Student Data Issues
**Symptoms**: Missing student information
**Solutions**:
1. Check application approval status
2. Verify room assignment
3. Ensure debtor account creation
4. Review email notifications

### Support Contacts
- **Technical Issues**: Contact system administrator
- **Financial Questions**: Contact finance team
- **Student Issues**: Contact admin team
- **System Access**: Contact IT support

---

## 📝 Quick Start Guide

### For New Admins
1. **Login**: Use provided credentials
2. **Review Dashboard**: Familiarize with interface
3. **Add Students**: Practice adding test students
4. **Process Applications**: Review pending applications
5. **Handle Requests**: Practice request approval workflow

### For New Finance Users
1. **Login**: Use provided credentials
2. **Review Chart of Accounts**: Understand account structure
3. **Process Transactions**: Practice creating entries
4. **Approve Expenses**: Review expense approval process
5. **Generate Reports**: Practice creating financial statements

### For Students
1. **Login**: Use provided credentials
2. **Submit Application**: Complete accommodation application
3. **Make Payments**: Process payment transactions
4. **Submit Requests**: Create maintenance requests
5. **Participate in Events**: RSVP for student events

---

## 🔄 System Updates

### Recent Updates
- **Audit Trail Enhancement**: Improved logging and tracking
- **Financial Reporting**: Enhanced statement generation
- **User Interface**: Improved dashboard layouts
- **Performance**: Optimized database queries

### Upcoming Features
- **Mobile App**: Native mobile application
- **Advanced Analytics**: Machine learning insights
- **Integration**: Third-party system integrations
- **Automation**: Enhanced workflow automation

---

*This documentation is maintained by the development team. For questions or updates, please contact the system administrator.* 