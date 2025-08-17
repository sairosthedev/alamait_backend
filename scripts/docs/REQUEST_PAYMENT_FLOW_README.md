# Complete Request-to-Payment Flow System Documentation

## 🎯 **System Overview**

This document provides a comprehensive guide to the complete request-to-payment flow system, covering everything from request creation to final payment and financial reporting. The system handles both student maintenance requests and administrative operational/financial requests with full vendor management, quotation processing, approval workflows, and financial integration.

## 📋 **Table of Contents**

1. [System Architecture](#system-architecture)
2. [Database Schema](#database-schema)
3. [Request Creation Flow](#request-creation-flow)
4. [Vendor Management](#vendor-management)
5. [Quotation Process](#quotation-process)
6. [Approval Workflow](#approval-workflow)
7. [Payment Processing](#payment-processing)
8. [Financial Integration](#financial-integration)
9. [API Endpoints](#api-endpoints)
10. [Test Cases](#test-cases)
11. [Real-Life Scenarios](#real-life-scenarios)
12. [Frontend Integration Guide](#frontend-integration-guide)

## 🏗️ **System Architecture**

### **Core Components**
- **Request Management**: Enhanced request system with items and quotations
- **Vendor Management**: Auto-creation and manual vendor management
- **Quotation System**: Multi-level quotations (request-level and item-level)
- **Approval Workflow**: Multi-stage approval (Admin → Finance → CEO)
- **Financial Integration**: Chart of Accounts and Transaction Entries
- **Payment Processing**: Multiple payment methods with bank integration

### **User Roles & Permissions**
- **Student**: Can create maintenance requests only
- **Admin**: Can create all request types, upload quotations, approve requests
- **Finance**: Can approve/reject requests, manage quotations, process payments
- **CEO**: Final approval authority, can change quotations
- **Finance Admin/User**: Finance role variations with specific permissions

## 🔄 **Complete Flow Overview**

```
1. Request Creation → 2. Vendor Creation → 3. Quotation Process → 4. Approval → 5. Payment → 6. Financial Reporting
```

### **Detailed Flow Steps**

1. **Request Creation**
   - User submits request (student maintenance or admin operational/financial)
   - System validates permissions and required fields
   - Request stored with initial status

2. **Vendor Creation (Auto)**
   - When quotations include new vendor names
   - System auto-creates vendor records
   - Generates unique chart of accounts codes
   - Sets payment methods based on bank details

3. **Quotation Process**
   - Admins upload quotations (request-level or item-level)
   - System links quotations to vendors
   - Multiple quotations per request/item allowed

4. **Approval Workflow**
   - Admin approval (automatic for admin-created requests)
   - Finance approval (with quotation selection)
   - CEO approval (final approval)

5. **Payment Processing**
   - Request converts to expense when approved
   - Payment method determined by vendor bank details
   - Transaction entries created for financial tracking

6. **Financial Reporting**
   - All transactions recorded in TransactionEntry collection
   - Chart of accounts updated automatically
   - Financial statements generated from transaction data

## 📊 **Database Collections Overview**

### **Core Collections**
- `requests` (maintenance collection): Enhanced request system
- `vendors`: Vendor management with auto-creation
- `expenses`: Financial expense tracking
- `accounts`: Chart of accounts
- `transactions`: Financial transactions
- `transactionentries`: Individual transaction entries for financial statements
- `users`: User management with role-based access
- `residences`: Property management

### **Key Relationships**
- Request → Vendor (via quotations)
- Request → Expense (when approved)
- Expense → TransactionEntry (for financial tracking)
- Vendor → Account (chart of accounts integration)

## 🎯 **Key Features**

### **Auto-Vendor Creation**
- Automatic vendor creation from quotation provider names
- Smart category detection based on request/item descriptions
- Chart of accounts integration with unique vendor codes
- Payment method determination (Bank Transfer vs Cash)

### **Multi-Level Quotations**
- Request-level quotations for overall project costs
- Item-level quotations for specific items/services
- File upload support with S3 integration
- Vendor linking and payment method tracking

### **Financial Integration**
- Complete double-entry bookkeeping
- Automatic transaction entry creation
- Chart of accounts integration
- Payment method tracking and reporting

### **Approval Workflow**
- Role-based approval stages
- Quotation selection and approval
- Status tracking and history logging
- Automatic expense conversion

This documentation will provide detailed information for each component, including schemas, API endpoints, test cases, and real-life scenarios to help you integrate with the frontend seamlessly. 