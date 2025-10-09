# Residence Payment Configuration System

## Overview

The residence payment configuration system allows you to set up different payment types and amounts for each residence, making it easy to manage various billing structures across your properties.

## Features

- **Configurable Payment Types**: Admin fees, deposits, utilities, maintenance fees
- **Flexible Application Rules**: Choose when each payment type applies (first month, every month, upfront, etc.)
- **Multiple Calculation Methods**: Fixed amounts, percentage of rent, one month's rent, etc.
- **Admin Management**: Easy-to-use endpoints for managing configurations

## Payment Types

### 1. Admin Fee
- **Purpose**: Administration/processing fees
- **Application Options**: 
  - `first_month`: Only charged in the first month
  - `every_month`: Charged every month
  - `upfront`: Charged upfront with lease
  - `last_month`: Charged in the last month

### 2. Deposit
- **Purpose**: Security deposit for damages/guarantees
- **Calculation Options**:
  - `fixed_amount`: Set a fixed dollar amount
  - `one_month_rent`: Equal to one month's rent
  - `percentage_of_rent`: Percentage of monthly rent
  - `custom`: Custom calculation logic
- **Application Options**: Same as admin fee

### 3. Utilities
- **Purpose**: Utilities fees (electricity, water, etc.)
- **Application Options**: Same as admin fee

### 4. Maintenance
- **Purpose**: Maintenance fees for upkeep
- **Application Options**: Same as admin fee

## API Endpoints

### Get All Residence Payment Configurations
```
GET /api/admin/residence-payments/all
```

### Get Specific Residence Configuration
```
GET /api/admin/residence-payments/:residenceId
```

### Update Residence Payment Configuration
```
PUT /api/admin/residence-payments/:residenceId
```

**Request Body:**
```json
{
  "paymentConfiguration": {
    "adminFee": {
      "enabled": true,
      "amount": 20,
      "description": "Administration fee",
      "application": "first_month"
    },
    "deposit": {
      "enabled": true,
      "amount": 0,
      "calculation": "one_month_rent",
      "percentage": 100,
      "description": "Security deposit",
      "application": "upfront"
    },
    "utilities": {
      "enabled": false,
      "amount": 0,
      "description": "Utilities fee",
      "application": "every_month"
    },
    "maintenance": {
      "enabled": false,
      "amount": 0,
      "description": "Maintenance fee",
      "application": "every_month"
    }
  }
}
```

### Calculate Payment Amounts
```
POST /api/admin/residence-payments/:residenceId/calculate
```

**Request Body:**
```json
{
  "room": {
    "price": 180
  },
  "startDate": "2025-01-01T00:00:00.000Z",
  "endDate": "2025-07-01T00:00:00.000Z",
  "currentMonth": 1,
  "currentYear": 2025
}
```

### Apply Default Configuration
```
POST /api/admin/residence-payments/:residenceId/apply-default
```

**Request Body:**
```json
{
  "residenceType": "st_kilda"
}
```

**Supported residence types:**
- `st_kilda`: Admin fee $20 (first month) + Deposit (1 month rent)
- `belvedere`: No admin fee, no deposit (rent only)
- `newlands`: Admin fee $15 (first month) + Deposit (1 month rent)
- `default`: Standard configuration (deposit only)

## Example Configurations

### St Kilda Student House
```json
{
  "adminFee": {
    "enabled": true,
    "amount": 20,
    "description": "Administration fee",
    "application": "first_month"
  },
  "deposit": {
    "enabled": true,
    "amount": 0,
    "calculation": "one_month_rent",
    "percentage": 100,
    "description": "Security deposit",
    "application": "upfront"
  }
}
```

### Belvedere Student House
```json
{
  "adminFee": {
    "enabled": false,
    "amount": 0,
    "description": "Administration fee",
    "application": "first_month"
  },
  "deposit": {
    "enabled": false,
    "amount": 0,
    "calculation": "one_month_rent",
    "percentage": 100,
    "description": "Security deposit",
    "application": "upfront"
  }
}
```

### Premium Residence with Utilities
```json
{
  "adminFee": {
    "enabled": true,
    "amount": 25,
    "description": "Administration fee",
    "application": "first_month"
  },
  "deposit": {
    "enabled": true,
    "amount": 0,
    "calculation": "one_month_rent",
    "percentage": 100,
    "description": "Security deposit",
    "application": "upfront"
  },
  "utilities": {
    "enabled": true,
    "amount": 30,
    "description": "Utilities fee (electricity, water)",
    "application": "every_month"
  },
  "maintenance": {
    "enabled": true,
    "amount": 15,
    "description": "Maintenance fee",
    "application": "every_month"
  }
}
```

## Migration

The system has been automatically configured for existing residences:

- **St Kilda**: Admin fee $20 (first month) + Deposit (1 month rent)
- **Belvedere**: No admin fee, no deposit (rent only)
- **Newlands**: Admin fee $15 (first month) + Deposit (1 month rent)
- **Others**: Default configuration (deposit only)

## Integration

The new system integrates with:
- Payment calculation utilities
- Debtor creation services
- Rental accrual services
- Student payment history

All existing hardcoded logic has been replaced with configurable rules based on residence settings.

## Benefits

1. **Flexibility**: Easy to change payment structures without code changes
2. **Consistency**: Centralized configuration management
3. **Scalability**: Easy to add new residences with different billing structures
4. **Transparency**: Clear breakdown of all payment types and amounts
5. **Maintainability**: No more hardcoded values scattered throughout the codebase
