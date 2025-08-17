const axios = require('axios');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const connectDB = require('./src/config/database'); // <-- Add this
const app = require('./src/app');
const AuditLog = require('./src/models/AuditLog');
const User = require('./src/models/User');
let mongoServer;
let server;
let token;
let user;

jest.setTimeout(30000); // 30 seconds

beforeAll(async () => {
  try {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    process.env.MONGODB_URI = mongoUri; // <-- Set before connectDB
    await connectDB(); // <-- Connect app to in-memory DB

    user = new User({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      password: 'password',
      phone: '1234567890',
      role: 'admin',
      isVerified: true,
    });
    await user.save();

    server = app.listen(4000, () => {
      console.log('Test server running on port 4000');
    });

    // Wait a moment for the server to start
    await new Promise(res => setTimeout(res, 1000));

    // Register/login to get token (simulate login route if needed)
    const res = await axios.post('http://localhost:4000/api/auth/login', {
      email: 'admin@example.com',
      password: 'password',
    });
    token = res.data.token;
    if (!token) {
      console.error('No token returned from login:', res.data);
    }

    await AuditLog.create([
      {
        user: user._id,
        action: 'create',
        collection: 'Test',
        recordId: new mongoose.Types.ObjectId(),
        before: null,
        after: { name: 'Test 1' },
      },
      {
        user: user._id,
        action: 'update',
        collection: 'Test',
        recordId: new mongoose.Types.ObjectId(),
        before: { name: 'Test 2' },
        after: { name: 'Test 2 Updated' },
      },
    ]);
  } catch (err) {
    console.error('Error in beforeAll:', err);
    throw err;
  }
});

afterAll(async () => {
  try {
    await mongoose.disconnect();
    await mongoServer.stop();
    if (server && server.close) await new Promise(res => server.close(res));
  } catch (err) {
    console.error('Error in afterAll:', err);
  }
});

describe('GET /api/admin/audit-log', () => {
  it('should fetch all audit logs', async () => {
    const res = await axios.get('http://localhost:4000/api/admin/audit-log', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(200);
    expect(res.data.length).toBe(2);
  });

  it('should filter audit logs by action', async () => {
    const res = await axios.get(
      'http://localhost:4000/api/admin/audit-log?action=create',
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );
    expect(res.status).toBe(200);
    expect(res.data.length).toBe(1);
    expect(res.data[0].action).toBe('create');
  });

  it('should return 403 for non-admin users', async () => {
    const nonAdminUser = new User({
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: 'password',
      phone: '0987654321',
      role: 'student',
      isVerified: true,
    });
    await nonAdminUser.save();

    const res = await axios.post('http://localhost:4000/api/auth/login', {
      email: 'test@example.com',
      password: 'password',
    });
    const nonAdminToken = res.data.token;
    if (!nonAdminToken) {
      console.error('No token returned from login (non-admin):', res.data);
    }

    try {
      await axios.get('http://localhost:4000/api/admin/audit-log', {
        headers: { Authorization: `Bearer ${nonAdminToken}` },
      });
      throw new Error('Should have thrown 403 error');
    } catch (error) {
      expect(error.response.status).toBe(403);
    }
  });
}); 