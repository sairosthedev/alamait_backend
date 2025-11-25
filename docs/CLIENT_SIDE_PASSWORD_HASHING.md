# Client-Side Password Hashing

This document explains how to implement client-side password hashing in your frontend application.

## Overview

The backend now supports receiving passwords that have been pre-hashed using SHA-256 on the client side. This means passwords will appear as hashed values in the request payload instead of plain text.

**Note:** This does not improve security - HTTPS still encrypts passwords in transit. This is primarily for visual privacy in browser DevTools.

## How It Works

1. **Client**: Hashes password with SHA-256 before sending
2. **Server**: Receives SHA-256 hash, then hashes it again with bcrypt before storage
3. **Login**: Client sends SHA-256 hash, server normalizes and compares

## Frontend Implementation

### JavaScript/TypeScript

```javascript
// Utility function to hash password with SHA-256
async function hashPassword(password) {
    // Convert password to ArrayBuffer
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    
    // Hash with SHA-256
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // Convert to hex string
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hashHex;
}

// Usage in login
async function login(email, password) {
    const hashedPassword = await hashPassword(password);
    
    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: email,
            password: hashedPassword // Sends SHA-256 hash instead of plain text
        })
    });
    
    return response.json();
}

// Usage in registration
async function register(email, password, firstName, lastName, phone) {
    const hashedPassword = await hashPassword(password);
    
    const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: email,
            password: hashedPassword, // Sends SHA-256 hash instead of plain text
            firstName: firstName,
            lastName: lastName,
            phone: phone
        })
    });
    
    return response.json();
}
```

### React Example

```jsx
import { useState } from 'react';

// Utility function
const hashPassword = async (password) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Hash password before sending
        const hashedPassword = await hashPassword(password);
        
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: email,
                password: hashedPassword // Hashed value, not plain text
            })
        });
        
        const data = await response.json();
        // Handle response...
    };
    
    return (
        <form onSubmit={handleSubmit}>
            <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />
            <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <button type="submit">Login</button>
        </form>
    );
}
```

## Backend Support

The backend automatically detects if a password is:
- **Plain text**: Will hash it with SHA-256, then bcrypt
- **Already SHA-256 hashed**: Will hash it with bcrypt directly

This means the backend is backward compatible - it accepts both formats.

## Important Notes

1. **HTTPS is still required**: Client-side hashing doesn't replace HTTPS encryption
2. **Password strength matters**: Weak passwords are still weak even when hashed
3. **Browser compatibility**: Requires browsers that support Web Crypto API (all modern browsers)

## Error Handling: Password Format Mismatch

### The Problem

When a user has an old password format (created before client-side hashing was implemented), logging in with a SHA-256 hash will fail. This happens because:

- **Old format**: Password stored as `bcrypt(plain_text)`
- **New format**: Password stored as `bcrypt(SHA-256_hash)`
- **Issue**: SHA-256 is one-way, so we can't reverse the hash to compare with the old format

### API Response

The API will return a helpful error:

```json
{
  "error": "Invalid credentials",
  "message": "Password format mismatch. Your account uses an older password format. Please use your original password (plain text) or reset your password to migrate to the new secure format.",
  "requiresPasswordReset": true
}
```

### Frontend Handling Options

#### Option 1: Auto-fallback to plain text (recommended for migration)

```javascript
async function login(email, password) {
    // Try with hashed password first
    let hashedPassword = await hashPassword(password);
    let response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: hashedPassword })
    });
    
    let data = await response.json();
    
    // If login fails with SHA-256 hash, try with plain text (for old format users)
    // This handles the migration period where some users have old password format
    if (!response.ok && response.status === 401) {
        console.log('Login with hashed password failed, trying with plain text for migration...');
        response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password: password }) // Plain text
        });
        data = await response.json();
        
        // On successful login with plain text, password will be auto-migrated to new format
        if (response.ok) {
            console.log('✅ Login successful! Password has been migrated to new format.');
            console.log('   Future logins will work with SHA-256 hashed passwords.');
        }
    }
    
    return data;
}
```

#### Option 2: Prompt user to reset password (recommended)

```javascript
async function login(email, password) {
    const hashedPassword = await hashPassword(password);
    const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: hashedPassword })
    });
    
    const data = await response.json();
    
    if (data.requiresPasswordReset) {
        // Show a message prompting user to reset password
        alert('Your account needs to be updated. Please reset your password to use the new secure login.');
        // Redirect to password reset page
        window.location.href = '/reset-password';
        return;
    }
    
    return data;
}
```

### Automatic Migration

If a user successfully logs in with a **plain text password** (old format), their password will be automatically migrated to the new format (`bcrypt(SHA-256_hash)`) on the next login. This means:

1. First login with plain text → Password migrated → Login succeeds
2. Subsequent logins → Use SHA-256 hash → Login succeeds

## Testing

You can test the hashing function in browser console:

```javascript
async function hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Test
hashPassword('12345678').then(hash => console.log(hash));
// Output: ef797c8118f02dfb649607dd5d3f8c7623048c9c063d532cc95c5ed7a898a64f
```

