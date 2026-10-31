const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const prisma = require("../db");
const { authenticate, allow } = require("../middleware");

const signupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.email(),
  password: z.string().min(9).regex(/[a-z]/).regex(/[A-Z]/).regex(/[^A-Za-z0-9]/)
});
const tokenFor = user => jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "12h" });

router.post("/signup", async (req, res, next) => {
  try {
    const data = signupSchema.parse(req.body);
    const email = data.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ error: "Email already registered" });
    const user = await prisma.user.create({ data: { name: data.name, email, passwordHash: await bcrypt.hash(data.password, 12), role: "CUSTOMER", customer: { create: { name: data.name, email } } } });
    res.status(201).json({ token: tokenFor(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { next(e); }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email: String(email || "").toLowerCase() } });
    if (!user || !user.active || !(await bcrypt.compare(password || "", user.passwordHash))) return res.status(401).json({ error: "Invalid email or password" });
    res.json({ token: tokenFor(user), user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (e) { next(e); }
});

router.get("/me", authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user.id }, select: { id: true, name: true, email: true, role: true } });
  res.json({ user });
});

// Admin-only staff creation. Staff cannot create other staff or admins.
router.post("/staff", authenticate, allow("ADMIN"), async (req, res, next) => {
  try {
    const data = z.object({ name: z.string().min(2), email: z.email(), password: signupSchema.shape.password }).parse(req.body);
    const email = data.email.toLowerCase();
    if (await prisma.user.findUnique({ where: { email } })) return res.status(409).json({ error: "Email already registered" });
    const user = await prisma.user.create({ data: { name: data.name, email, role: "STAFF", passwordHash: await bcrypt.hash(data.password, 12) }, select: { id: true, name: true, email: true, role: true } });
    res.status(201).json({ user });
  } catch (e) { next(e); }
});

module.exports = router;
