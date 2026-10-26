
const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
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

        if (
            !Number.isSafeInteger(payload.userId) ||
            !Number.isSafeInteger(payload.institutionId) ||
            payload.institutionId < 1
        ) {
            return res.status(401).json({
                success: false,
                message: "Invalid authentication claims"
            });
        }

        req.user = {
            id: payload.userId,
            institutionId: payload.institutionId
        };

        next();
    } catch {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
}

module.exports = requireAuth;
