const mongoose = require('mongoose');

const connectDB = async (retryCount = 0) => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }

        console.log(`Attempting to connect to MongoDB... (Attempt ${retryCount + 1})`);
        console.log('Connection URI:', process.env.MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//****:****@')); // Hide credentials

        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 30000, // Increased to 30 seconds
            socketTimeoutMS: 45000,
            connectTimeoutMS: 30000, // Added connection timeout
            maxPoolSize: 20, // Increased pool size for better concurrency
            minPoolSize: 5,
            retryWrites: true,
            retryReads: true,
            maxIdleTimeMS: 30000, // Close connections after 30 seconds of inactivity
            heartbeatFrequencyMS: 10000 // Send heartbeat every 10 seconds
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
        
        // Retry connection up to 3 times with exponential backoff
        if (retryCount < 3) {
            const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
            console.log(`Retrying connection in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return connectDB(retryCount + 1);
        }
        
        throw error;
    }
};

module.exports = connectDB; 