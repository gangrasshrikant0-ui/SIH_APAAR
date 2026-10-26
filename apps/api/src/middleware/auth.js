
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
    if (!process.env.JWT_SECRET) {
        return res.status(500).json({
            success: false,
            message: "Authentication is not configured"
        });
    }

    const header = req.headers.authorization;

    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Authentication required"
        });
    }

    const token = header.slice(7);

    try {
        const payload = jwt.verify(
            token,
            process.env.JWT_SECRET,
            {
                algorithms: ["HS256"],
                issuer: "apaar-api",
                audience: "apaar-platform"
            }
        );

        if (!Number.isSafeInteger(payload.userId) ||
            typeof payload.role !== "string" ||
            !["INSTITUTION", "AICTE", "VERIFIER"].includes(payload.role) ||
            (payload.role === "INSTITUTION" &&
                (!Number.isSafeInteger(payload.institutionId) || payload.institutionId < 1))) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication claims"
            });
        }

        req.user = {
            id: payload.userId,
            institutionId: payload.institutionId ?? null,
            role: payload.role
        };

        next();
    } catch {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
}

function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "Insufficient permissions"
            });
        }

        next();
    };
}

module.exports = requireAuth;
module.exports.requireRole = requireRole;
