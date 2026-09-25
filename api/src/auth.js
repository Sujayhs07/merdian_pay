import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getUserById } from "./db.js";

const JWT_SECRET = process.env.JWT_SECRET || "meridianpay_dev_jwt_secret_key_2026";
const TOKEN_EXPIRY = "7d";

export async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
}

export async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

export function signToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email || null,
      businessName: user.businessName || null,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRY }
  );
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentication required." });
  }

  const token = header.slice(7).trim();
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = getUserById(payload.userId);
    if (!user) {
      return res.status(401).json({ error: "User account not found." });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired session. Please log in again." });
  }
}

export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = getUserById(payload.userId) || null;
    } catch {
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next();
}
