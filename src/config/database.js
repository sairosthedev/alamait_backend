const mongoose = require('mongoose');

/** Build driver options — SRV uses TLS automatically; plain mongodb:// must opt in */
function buildMongoOptions(uri) {
    const opts = {
        serverSelectionTimeoutMS: 30000,
        socketTimeoutMS: 45000,
        connectTimeoutMS: 30000,
        maxPoolSize: Number(process.env.MONGO_MAX_POOL_SIZE) || 15,
        minPoolSize: Number(process.env.MONGO_MIN_POOL_SIZE) || 2,
        retryWrites: true,
        retryReads: true,
        maxIdleTimeMS: 30000,
        heartbeatFrequencyMS: 10000
    };

    // mongodb+srv:// enables TLS by default; mongodb:// does not
    if (!uri.includes('mongodb+srv://')) {
        opts.tls = process.env.MONGO_TLS !== 'false';
        if (process.env.MONGO_TLS_ALLOW_INVALID_CERTS === 'true') {
            opts.tlsAllowInvalidCertificates = true;
        }
    }

    // If URI has no database path (e.g. ...mongodb.net/?authSource=admin), set dbName explicitly
    const hasDbInPath = /mongodb(\+srv)?:\/\/[^/]+\/[^/?]+/.test(uri);
    if (!hasDbInPath && process.env.MONGO_DB_NAME) {
        opts.dbName = process.env.MONGO_DB_NAME;
    }

    return opts;
}

function logConnectionHelp(error) {
    const msg = error?.message || '';
    if (msg.includes('ENOTFOUND') || msg.includes('querySrv')) {
        console.error('❌ MongoDB DNS lookup failed. Check:');
        console.error('   1. Copy a fresh connection string from Atlas → Connect → Drivers (mongodb+srv://...)');
        console.error('   2. Atlas cluster is Running (not Paused)');
        console.error('   3. Your IP is in Atlas → Network Access');
        console.error('   4. Local DNS — try switching to 8.8.8.8 or 1.1.1.1 if lookups time out');
        console.error('   5. Use mongodb+srv:// (TLS is automatic) — not mongodb:// without tls=true');
    } else if (msg.includes('bad auth') || msg.includes('Authentication failed')) {
        console.error('❌ MongoDB auth failed — verify username/password in Atlas → Database Access');
    }
}

const connectDB = async (retryCount = 0) => {
    try {
        if (!process.env.MONGODB_URI) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }

        const uri = process.env.MONGODB_URI.trim();
        console.log(`Attempting to connect to MongoDB... (Attempt ${retryCount + 1})`);
        console.log('Connection URI:', uri.replace(/\/\/[^:]+:[^@]+@/, '//****:****@'));

        const conn = await mongoose.connect(uri, buildMongoOptions(uri));

        if (!uri.includes('mongodb+srv://')) {
            console.warn(
                '⚠️ MONGODB_URI is not using mongodb+srv://. For Atlas, use the SRV string from Atlas (Drivers → Connect) — it enables TLS automatically.'
            );
        }

        console.log(`MongoDB Connected: ${conn.connection.host}`);
        console.log('Database name:', conn.connection.name);
        console.log('MongoDB connection state:', conn.connection.readyState);
        console.log('Connection options:', {
            maxPoolSize: conn.connection.client?.options?.maxPoolSize,
            minPoolSize: conn.connection.client?.options?.minPoolSize,
            tls: conn.connection.client?.options?.tls ?? (uri.includes('mongodb+srv://') ? true : undefined)
        });

        // Create/update indexes in background (do not block HTTP listen)
        setImmediate(() => {
            const { ensureCriticalIndexes } = require('../utils/ensureIndexes');
            ensureCriticalIndexes().catch(() => {});
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
        logConnectionHelp(error);
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