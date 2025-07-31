const requestLogger = (req, res, next) => {
    if (req.path.includes('/monthly-requests') && req.method === 'POST') {
        console.log('=== MONTHLY REQUEST CREATION ATTEMPT ===');
        console.log('Path:', req.path);
        console.log('Method:', req.method);
        console.log('User:', req.user?._id);
        console.log('User Role:', req.user?.role);
        console.log('Request Body:', JSON.stringify(req.body, null, 2));
        console.log('Headers:', {
            'content-type': req.headers['content-type'],
            'authorization': req.headers.authorization ? '[REDACTED]' : undefined,
            'user-agent': req.headers['user-agent']
        });
        console.log('Timestamp:', new Date().toISOString());
        console.log('==========================================');
    }
    next();
};

module.exports = requestLogger; 