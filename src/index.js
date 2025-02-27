require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/database');

const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectDB();

        // Start server
        const PORT = process.env.PORT || 5000;
        app.listen(PORT, () => {
            console.log(`Server rikumhanya pa ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
};

startServer(); 