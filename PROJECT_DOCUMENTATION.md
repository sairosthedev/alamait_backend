# Alamait Property Management System - Backend Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Technology Stack](#technology-stack)
4. [Database Design](#database-design)
5. [API Documentation](#api-documentation)
6. [User Roles & Permissions](#user-roles--permissions)
7. [Core Features](#core-features)
8. [Security Implementation](#security-implementation)
9. [File Management](#file-management)
10. [Monitoring & Analytics](#monitoring--analytics)
11. [Backup & Recovery](#backup--recovery)
12. [Deployment](#deployment)
13. [Development Setup](#development-setup)
14. [API Endpoints Reference](#api-endpoints-reference)
15. [Error Handling](#error-handling)
16. [Performance Considerations](#performance-considerations)
17. [Future Enhancements](#future-enhancements)

---

## Project Overview

The Alamait Property Management System is a comprehensive backend solution designed to manage student accommodation properties, applications, payments, maintenance, and financial operations. The system serves multiple user types including students, administrators, property managers, and finance personnel.

### Key Objectives
- Streamline student accommodation application process
- Manage property bookings and room allocations
- Handle maintenance requests and staff management
- Process payments and financial reporting
- Provide real-time communication between stakeholders
- Ensure data security and system reliability

### Business Scope
- **Student Accommodation Management**: Application processing, room booking, payment tracking
- **Property Management**: Residence management, room allocation, occupancy tracking
- **Maintenance Operations**: Request handling, staff assignment, cost tracking
- **Financial Management**: Payment processing, expense tracking, financial reporting
- **Communication System**: Messaging, notifications, event management
- **Administrative Functions**: User management, reporting, system monitoring

---

## System Architecture

### High-Level Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Database      │
│   (React/Vite)  │◄──►│   (Node.js)     │◄──►│   (MongoDB)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌─────────────────┐
                       │   External      │
                       │   Services      │
                       │   (Email, SMS)  │
                       └─────────────────┘
```

### Backend Architecture Pattern
- **MVC Pattern**: Model-View-Controller architecture
- **RESTful API**: Standard REST endpoints
- **Middleware-based**: Authentication, validation, error handling
- **Service Layer**: Business logic separation
- **Repository Pattern**: Data access abstraction

### Directory Structure
```
alamait_backend/
├── src/
│   ├── config/           # Database and app configuration
│   ├── controllers/      # Request handlers by user role
│   │   ├── admin/        # Admin-specific controllers
│   │   ├── student/      # Student-specific controllers
│   │   ├── finance/      # Finance-specific controllers
│   │   └── property_manager/ # Property manager controllers
│   ├── middleware/       # Authentication and validation
│   ├── models/          # Database schemas
│   │   └── finance/     # Financial models
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic services
│   ├── utils/           # Utility functions
│   └── scripts/         # Database scripts and utilities
├── uploads/             # File storage
├── swagger.yaml         # API documentation
└── package.json         # Dependencies and scripts
```

---

## Technology Stack

### Core Technologies
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (JSON Web Tokens)
- **File Upload**: Multer
- **Email**: Nodemailer
- **SMS**: Twilio
- **Documentation**: Swagger/OpenAPI 3.0

### Key Dependencies
```json
{
  "express": "^4.18.2",
  "mongoose": "^7.0.3",
  "jsonwebtoken": "^9.0.0",
  "bcryptjs": "^2.4.3",
  "multer": "^1.4.5-lts.2",
  "nodemailer": "^6.9.1",
  "twilio": "^4.23.0",
  "swagger-ui-express": "^5.0.0",
  "node-cron": "^3.0.3",
  "exceljs": "^4.4.0",
  "pdfkit": "^0.14.0"
}
```

### Development Tools
- **Hot Reload**: Nodemon
- **Testing**: Jest
- **Linting**: ESLint
- **Environment**: dotenv

---

## Database Design

### Core Entities

#### 1. User Management
- **User**: Base user entity with role-based access
- **Student**: Extended user profile for students
- **Application**: Student accommodation applications

#### 2. Property Management
- **Residence**: Property/residence information
- **Room**: Individual room details and availability
- **Booking**: Room booking records
- **Lease**: Lease agreement management

#### 3. Maintenance System
- **Maintenance**: Maintenance request tracking
- **MaintenanceCategory**: Categorization of maintenance types
- **MaintenanceStaff**: Staff management for maintenance

#### 4. Financial Management
- **Payment**: Payment records and tracking
- **Expense**: Expense management
- **BalanceSheet**: Financial balance sheet
- **IncomeStatement**: Income statement tracking
- **Asset/Liability/Equity**: Financial accounting entities

#### 5. Communication
- **Message**: Internal messaging system
- **Event**: Event management and notifications

### Database Relationships
```
User (1) ──► (N) Application
User (1) ──► (N) Booking
User (1) ──► (N) Payment
User (1) ──► (N) Message
Residence (1) ──► (N) Room
Room (1) ──► (N) Booking
Maintenance (N) ──► (1) MaintenanceCategory
Maintenance (N) ──► (1) MaintenanceStaff
```

---

## API Documentation

### Base URL
- **Development**: `http://localhost:5000/api`
- **Production**: `https://alamait-backend.onrender.com/api`

### Authentication
All protected endpoints require JWT Bearer token in Authorization header:
```
Authorization: Bearer <jwt_token>
```

### API Documentation Access
- **Swagger UI**: `/api-docs`
- **OpenAPI Spec**: `/swagger.yaml`

### Response Format
```json
{
  "success": true,
  "data": {},
  "message": "Operation successful",
  "timestamp": "2025-01-27T10:30:00.000Z"
}
```

### Error Response Format
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "timestamp": "2025-01-27T10:30:00.000Z"
}
```

---

## User Roles & Permissions

### 1. Student
**Permissions:**
- View available residences and rooms
- Submit accommodation applications
- Book rooms and manage bookings
- Submit maintenance requests
- View payment history
- Send/receive messages
- View events and notifications

**Access Level:** Limited to personal data and public information

### 2. Admin
**Permissions:**
- Full system access
- User management (create, update, delete)
- Application approval/rejection
- Residence and room management
- Payment processing
- System monitoring and reporting
- Event management
- Lease management

**Access Level:** Complete system administration

### 3. Property Manager
**Permissions:**
- Residence management
- Maintenance request handling
- Staff assignment
- Property-specific reporting
- Event management for properties

**Access Level:** Property-specific operations

### 4. Finance
**Permissions:**
- Payment processing
- Expense management
- Financial reporting
- Balance sheet management
- Income statement tracking

**Access Level:** Financial operations only

---

## Core Features

### 1. User Management System
- **Registration & Authentication**: JWT-based authentication
- **Role-based Access Control**: Multi-level user permissions
- **Profile Management**: User profile updates and management
- **Password Reset**: Secure password recovery system

### 2. Application Management
- **Application Submission**: Student accommodation applications
- **Application Processing**: Admin approval/rejection workflow
- **Status Tracking**: Real-time application status updates
- **Document Upload**: Supporting document management

### 3. Property Management
- **Residence Management**: Property information and details
- **Room Management**: Individual room tracking and availability
- **Booking System**: Room booking and allocation
- **Occupancy Tracking**: Real-time occupancy monitoring

### 4. Maintenance System
- **Request Submission**: Student maintenance request creation
- **Request Processing**: Admin/maintenance staff handling
- **Staff Assignment**: Maintenance staff allocation
- **Cost Tracking**: Maintenance expense management
- **Status Updates**: Real-time maintenance progress

### 5. Payment System
- **Payment Processing**: Secure payment handling
- **Payment History**: Complete payment records
- **Overpayment Handling**: Overpayment detection and management
- **Payment Due Tracking**: Automated due date monitoring

### 6. Financial Management
- **Expense Tracking**: Comprehensive expense management
- **Balance Sheet**: Financial balance sheet generation
- **Income Statement**: Income statement tracking
- **Financial Reporting**: Automated financial reports

### 7. Communication System
- **Internal Messaging**: User-to-user messaging
- **Event Management**: System-wide event creation and management
- **Notifications**: Automated notification system
- **Email Integration**: Email notifications and communications

### 8. File Management
- **Document Upload**: Secure file upload system
- **Document Storage**: Organized file storage structure
- **Document Retrieval**: Secure file access and download
- **File Validation**: File type and size validation

---

## Security Implementation

### Authentication & Authorization
- **JWT Tokens**: Secure token-based authentication
- **Password Hashing**: bcryptjs for password security
- **Role-based Access**: Granular permission system
- **Token Expiration**: Configurable token lifetime

### Data Protection
- **Input Validation**: Comprehensive input sanitization
- **SQL Injection Prevention**: Mongoose ODM protection
- **XSS Protection**: Content Security Policy
- **CORS Configuration**: Strict origin validation

### File Security
- **File Type Validation**: Whitelist-based file acceptance
- **File Size Limits**: Configurable upload limits
- **Secure Storage**: Protected file storage location
- **Access Control**: Role-based file access

### API Security
- **Rate Limiting**: Request rate limiting
- **Request Logging**: Comprehensive request logging
- **Error Handling**: Secure error responses
- **HTTPS Enforcement**: Production HTTPS requirement

---

## File Management

### Upload Structure
```
uploads/
├── pop/                    # Proof of payment files
├── leases/                 # Lease agreement documents
├── applications/           # Application supporting documents
├── maintenance/            # Maintenance-related files
└── general/                # General system files
```

### File Handling Features
- **Automatic Directory Creation**: Ensures upload directories exist
- **File Naming**: Unique timestamp-based file naming
- **File Validation**: Type and size validation
- **Storage Management**: Organized file storage

### Supported File Types
- **Images**: JPG, JPEG, PNG
- **Documents**: PDF, DOC, DOCX
- **Spreadsheets**: XLS, XLSX

---

## Monitoring & Analytics

### System Monitoring
- **Health Checks**: `/health` endpoint for system status
- **Performance Metrics**: Request duration tracking
- **Error Tracking**: Comprehensive error logging
- **Uptime Monitoring**: System availability tracking

### Analytics Service
- **User Analytics**: User behavior tracking
- **Application Analytics**: Application processing metrics
- **Financial Analytics**: Payment and expense analytics
- **Maintenance Analytics**: Maintenance request analytics

### Prometheus Integration
- **Custom Metrics**: Application-specific metrics
- **HTTP Request Metrics**: Request count and duration
- **System Metrics**: Memory and performance metrics

---

## Backup & Recovery

### Automated Backup System
- **Daily Backups**: Automated daily database backups
- **Compression**: Backup file compression for storage efficiency
- **Retention Policy**: 7-day backup retention
- **Backup Verification**: Backup integrity checking

### Backup Management
- **Manual Backup Creation**: On-demand backup generation
- **Backup Listing**: Available backup enumeration
- **Backup Restoration**: Database restoration capabilities
- **Backup Deletion**: Backup cleanup management

### Recovery Procedures
- **Point-in-time Recovery**: Specific backup restoration
- **Data Validation**: Post-restoration data verification
- **Rollback Procedures**: Emergency rollback capabilities

---

## Deployment

### Environment Configuration
```env
NODE_ENV=production
PORT=5000
MONGODB_URI=mongodb://...
JWT_SECRET=your_jwt_secret
EMAIL_USER=your_email
EMAIL_PASS=your_email_password
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
```

### Production Deployment
- **Platform**: Render.com
- **Environment**: Node.js production environment
- **Database**: MongoDB Atlas
- **SSL**: Automatic HTTPS enforcement
- **Scaling**: Automatic scaling based on demand

### Deployment Scripts
```bash
# Build script
npm run build

# Start production server
npm start

# Development server
npm run dev
```

---

## Development Setup

### Prerequisites
- Node.js (v16 or higher)
- MongoDB (local or Atlas)
- Git

### Installation Steps
```bash
# Clone repository
git clone <repository-url>
cd alamait_backend

# Install dependencies
npm install

# Environment setup
cp .env.example .env
# Edit .env with your configuration

# Start development server
npm run dev
```

### Development Scripts
```bash
npm run dev          # Start development server
npm run test         # Run tests
npm run create-admin # Create admin user
npm run fix-occupancy # Fix room occupancy
```

### Database Setup
```bash
# Connect to MongoDB
# Import initial data if needed
# Run database scripts
npm run save-stkilda
npm run save-belvedere
```

---

## API Endpoints Reference

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Password reset

### Public Endpoints
- `GET /api/residences` - List available residences
- `POST /api/applications` - Submit application
- `GET /api/applications/:id` - Get application status

### Admin Endpoints
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users/:id` - Update user
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/applications` - List applications
- `PUT /api/admin/applications/:id/approve` - Approve application
- `PUT /api/admin/applications/:id/reject` - Reject application

### Student Endpoints
- `GET /api/student/dashboard` - Student dashboard
- `GET /api/student/bookings` - Student bookings
- `POST /api/student/bookings` - Create booking
- `GET /api/student/payments` - Payment history
- `POST /api/student/maintenance` - Submit maintenance request

### Finance Endpoints
- `GET /api/finance/dashboard` - Finance dashboard
- `GET /api/finance/expenses` - List expenses
- `POST /api/finance/expenses` - Create expense
- `GET /api/finance/balance-sheets` - Balance sheet data
- `GET /api/finance/income-statements` - Income statements

### Maintenance Endpoints
- `GET /api/maintenance` - List maintenance requests
- `POST /api/maintenance` - Create maintenance request
- `PUT /api/maintenance/:id` - Update maintenance request
- `GET /api/maintenance/staff` - List maintenance staff
- `GET /api/maintenance/categories` - List maintenance categories

### Property Manager Endpoints
- `GET /api/property-manager/residences` - Manage residences
- `GET /api/property-manager/maintenance` - Property maintenance
- `POST /api/property-manager/events` - Create property events

---

## Error Handling

### Error Categories
1. **Validation Errors** (400): Input validation failures
2. **Authentication Errors** (401): Invalid or missing authentication
3. **Authorization Errors** (403): Insufficient permissions
4. **Not Found Errors** (404): Resource not found
5. **Conflict Errors** (409): Resource conflicts
6. **Server Errors** (500): Internal server errors

### Error Response Format
```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": {
    "field": "Specific field error"
  },
  "timestamp": "2025-01-27T10:30:00.000Z"
}
```

### Global Error Handling
- **Centralized Error Handler**: Consistent error responses
- **Error Logging**: Comprehensive error logging
- **Development vs Production**: Different error detail levels
- **Request Tracking**: Error request correlation

---

## Performance Considerations

### Database Optimization
- **Indexing**: Strategic database indexing
- **Query Optimization**: Efficient database queries
- **Connection Pooling**: Optimized database connections
- **Data Pagination**: Large dataset pagination

### API Performance
- **Response Caching**: Strategic response caching
- **Request Limiting**: Rate limiting implementation
- **Compression**: Response compression
- **Async Operations**: Non-blocking operations

### Monitoring & Optimization
- **Performance Metrics**: Request duration tracking
- **Memory Management**: Memory usage optimization
- **Load Testing**: Performance testing procedures
- **Scalability Planning**: Horizontal scaling preparation

---

## Future Enhancements

### Planned Features
1. **Real-time Notifications**: WebSocket implementation
2. **Advanced Reporting**: Enhanced analytics and reporting
3. **Mobile API**: Mobile-optimized endpoints
4. **Multi-language Support**: Internationalization
5. **Advanced Search**: Full-text search capabilities
6. **API Versioning**: Versioned API endpoints

### Technical Improvements
1. **Microservices Architecture**: Service decomposition
2. **Containerization**: Docker implementation
3. **CI/CD Pipeline**: Automated deployment
4. **Advanced Security**: Enhanced security measures
5. **Performance Optimization**: Further performance improvements

### Integration Opportunities
1. **Payment Gateways**: Additional payment providers
2. **SMS Services**: Enhanced SMS integration
3. **Third-party APIs**: External service integrations
4. **Analytics Platforms**: Advanced analytics integration

---

## Conclusion

The Alamait Property Management System backend provides a robust, scalable, and secure foundation for managing student accommodation operations. With comprehensive features covering user management, property operations, maintenance, finance, and communication, the system addresses all aspects of modern property management requirements.

The modular architecture, comprehensive security measures, and extensive monitoring capabilities ensure the system can handle current demands while remaining adaptable for future growth and enhancement.

For technical support or questions, please contact the development team or refer to the API documentation at `/api-docs`.

---

**Document Version**: 1.0  
**Last Updated**: January 2025  
**Maintained By**: Alamait Development Team 