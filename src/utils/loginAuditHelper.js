const { createAuditLog } = require('./auditLogger');

const SYSTEM_USER_ID = '68b7909295210ad2fa2c5dcf';

const ROLE_DASHBOARD_PATHS = {
    admin: '/admin',
    finance: '/finance',
    finance_admin: '/finance',
    finance_user: '/finance',
    ceo: '/ceo',
    student: '/student',
    property_manager: '/propertymanager'
};

const getClientIP = (req) => {
    let ip = req.headers['x-forwarded-for'];
    if (ip) {
        ip = ip.split(',')[0].trim();
        if (ip.startsWith('::ffff:')) ip = ip.substring(7);
    }
    if (!ip || ip === '::1' || ip === '127.0.0.1') {
        ip = req.headers['x-real-ip'] || req.headers['cf-connecting-ip'] || req.ip || req.connection?.remoteAddress;
    }
    if (ip && ip.startsWith('::ffff:')) ip = ip.substring(7);
    return ip || null;
};

const isPrivateOrLocalIp = (ip) => {
    if (!ip || ip === 'unknown') return true;
    if (ip === '::1' || ip === '127.0.0.1' || ip === 'localhost') return true;
    if (ip.startsWith('10.') || ip.startsWith('192.168.') || ip.startsWith('169.254.')) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)) return true;
    return false;
};

/**
 * Approximate location from public IP (city / region / country).
 * Best-effort; never blocks login if lookup fails.
 */
const lookupIpLocation = async (ip) => {
    if (isPrivateOrLocalIp(ip)) {
        return { city: null, region: null, country: null, label: 'Local / private network' };
    }

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2500);
        const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
            signal: controller.signal,
            headers: { Accept: 'application/json' }
        });
        clearTimeout(timer);

        if (!res.ok) return null;
        const data = await res.json();
        if (data?.error) return null;

        const city = data.city || null;
        const region = data.region || data.region_code || null;
        const country = data.country_name || data.country || null;
        const parts = [city, region, country].filter(Boolean);

        return {
            city,
            region,
            country,
            label: parts.length ? parts.join(', ') : null
        };
    } catch {
        return null;
    }
};

const buildLoginAuditDetails = ({ user, req, loginSource, reason, statusCode = 200, deviceInfo = null, location = null }) => {
    const role = user?.role || null;
    const email = user?.email || req.body?.email?.toLowerCase?.() || req.body?.email || null;
    const ipAddress = deviceInfo?.deviceIp || getClientIP(req);

    return {
        path: '/api/auth/login',
        loginSource: loginSource || req.body?.loginSource || 'web',
        email,
        firstName: user?.firstName || null,
        lastName: user?.lastName || null,
        role,
        dashboardPath: role ? ROLE_DASHBOARD_PATHS[role] || null : null,
        statusCode,
        reason: reason || null,
        ipAddress,
        userAgent: deviceInfo?.userAgent || req.headers['user-agent'] || null,
        deviceType: deviceInfo?.deviceType || null,
        deviceName: deviceInfo?.deviceName || null,
        osName: deviceInfo?.osName || null,
        browserName: deviceInfo?.browserName || null,
        deviceIdentifier: deviceInfo?.deviceIdentifier || null,
        location: location?.label || null,
        locationCity: location?.city || null,
        locationRegion: location?.region || null,
        locationCountry: location?.country || null,
        timestamp: new Date().toISOString()
    };
};

/**
 * Write a single AuditLog row for login / login_failed with device + approximate location.
 * Skips writing a second successful login for the same user within 2 minutes.
 */
const recordLoginAudit = async ({ success, user, req, loginSource, reason, statusCode, deviceInfo = null }) => {
    const action = success ? 'login' : 'login_failed';
    const auditUserId = user?._id || SYSTEM_USER_ID;
    const ipAddress = deviceInfo?.deviceIp || getClientIP(req);
    const location = await lookupIpLocation(ipAddress);

    // Deduplicate successful logins (e.g. double submit / remount)
    if (success && user?._id) {
        const AuditLog = require('../models/AuditLog');
        const recent = await AuditLog.findOne({
            user: user._id,
            action: 'login',
            timestamp: { $gte: new Date(Date.now() - 2 * 60 * 1000) }
        })
            .sort({ timestamp: -1 })
            .select('_id timestamp')
            .lean();

        if (recent) {
            console.log(`[AUDIT] Skipping duplicate login for user ${user._id} (recent ${recent._id})`);
            return recent;
        }
    }

    const details = buildLoginAuditDetails({
        user,
        req,
        loginSource,
        reason,
        statusCode: success ? 200 : (statusCode || 401),
        deviceInfo,
        location
    });

    return createAuditLog({
        action,
        collection: 'Authentication',
        recordId: user?._id || null,
        userId: auditUserId,
        before: null,
        after:
            success && user
                ? {
                      user: {
                          email: user.email,
                          role: user.role,
                          firstName: user.firstName,
                          lastName: user.lastName
                      },
                      device: {
                          type: details.deviceType,
                          name: details.deviceName,
                          os: details.osName,
                          browser: details.browserName,
                          identifier: details.deviceIdentifier
                      },
                      location: details.location
                  }
                : null,
        details,
        ipAddress: details.ipAddress,
        userAgent: details.userAgent,
        statusCode: details.statusCode,
        errorMessage: success ? null : reason || 'Authentication failed'
    });
};

module.exports = {
    SYSTEM_USER_ID,
    ROLE_DASHBOARD_PATHS,
    getClientIP,
    lookupIpLocation,
    buildLoginAuditDetails,
    recordLoginAudit
};
