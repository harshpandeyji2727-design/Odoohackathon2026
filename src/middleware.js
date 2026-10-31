const jwt = require("jsonwebtoken");
const prisma = require("./db");

async function authenticate(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).json({ error: "Authentication required" });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.active) return res.status(401).json({ error: "Account unavailable" });
    req.user = { id: user.id, role: user.role, email: user.email };
    next();
  } catch { return res.status(401).json({ error: "Invalid or expired token" }); }
}

const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: "Insufficient permissions" });

module.exports = { authenticate, allow };
