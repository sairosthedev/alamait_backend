const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }

        console.log('Attempting to connect to MongoDB...');
        console.log('Connection URI:', process.env.MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//****:****@')); // Hide credentials

        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10,
            minPoolSize: 5,
            retryWrites: true,
            retryReads: true
        });

        console.log(`MongoDB Connected: ${conn.connection.host}`);
        console.log('Database name:', conn.connection.name);
        console.log('MongoDB connection state:', conn.connection.readyState);
        console.log('Connection options:', {
            maxPoolSize: conn.connection.config.maxPoolSize,
            minPoolSize: conn.connection.config.minPoolSize,
            serverSelectionTimeoutMS: conn.connection.config.serverSelectionTimeoutMS,
            socketTimeoutMS: conn.connection.config.socketTimeoutMS
        });

        // Handle connection events
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', {
                message: err.message,
                name: err.name,
                code: err.code,
                stack: err.stack
            });
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('MongoDB disconnected. Attempting to reconnect...');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('MongoDB reconnected successfully');
        });

        mongoose.connection.on('close', () => {
            console.log('MongoDB connection closed');
        });

        return conn;
    } catch (error) {
        console.error('MongoDB connection error:', {
            message: error.message,
            name: error.name,
            code: error.code,
            stack: error.stack
        });
        throw error;
    }
};

module.exports = connectDB; 