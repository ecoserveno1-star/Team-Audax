const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const { signToken, requireAuth } = require("../auth");
const { seedHotel } = require("../seed");

const router = express.Router();

function isEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

router.post("/register", async (req, res) => {
  try {
    const { email, password, hotelName, rooms, location } = req.body || {};

    if (!isEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
    if (!password || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
    if (!hotelName || !hotelName.trim()) return res.status(400).json({ error: "Property name is required." });

    const roomCount = Math.max(1, Math.min(2000, parseInt(rooms, 10) || 50));

    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows.length) return res.status(409).json({ error: "An account with that email already exists." });

    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await pool.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email.toLowerCase(), passwordHash]
    );
    const user = userResult.rows[0];

    const hotelResult = await pool.query(
      "INSERT INTO hotels (user_id, name, location, rooms) VALUES ($1, $2, $3, $4) RETURNING id, name, location, rooms, tier",
      [user.id, hotelName.trim(), (location || "Sri Lanka").trim(), roomCount]
    );
    const hotel = hotelResult.rows[0];

    // Give new accounts a populated 30-day history instead of a blank dashboard.
    await seedHotel(pool, hotel.id, hotel.rooms);

    const token = signToken({ userId: user.id, hotelId: hotel.id });
    res.status(201).json({ token, user: { email: user.email }, hotel });
  } catch (err) {
    console.error("register error", err);
    res.status(500).json({ error: "Could not create account. Please try again." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!isEmail(email) || !password) return res.status(400).json({ error: "Enter your email and password." });

    const result = await pool.query(
      `SELECT u.id as user_id, u.email, u.password_hash, h.id as hotel_id, h.name, h.location, h.rooms, h.tier
       FROM users u JOIN hotels h ON h.user_id = u.id
       WHERE u.email = $1
       ORDER BY h.id ASC LIMIT 1`,
      [email.toLowerCase()]
    );
    if (!result.rows.length) return res.status(401).json({ error: "Incorrect email or password." });

    const row = result.rows[0];
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: "Incorrect email or password." });

    const token = signToken({ userId: row.user_id, hotelId: row.hotel_id });
    res.json({
      token,
      user: { email: row.email },
      hotel: { id: row.hotel_id, name: row.name, location: row.location, rooms: row.rooms, tier: row.tier },
    });
  } catch (err) {
    console.error("login error", err);
    res.status(500).json({ error: "Could not log in. Please try again." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.email, h.id as hotel_id, h.name, h.location, h.rooms, h.tier
       FROM users u JOIN hotels h ON h.user_id = u.id
       WHERE u.id = $1 AND h.id = $2`,
      [req.user.userId, req.user.hotelId]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Account not found." });
    const row = result.rows[0];
    res.json({
      user: { email: row.email },
      hotel: { id: row.hotel_id, name: row.name, location: row.location, rooms: row.rooms, tier: row.tier },
    });
  } catch (err) {
    console.error("me error", err);
    res.status(500).json({ error: "Could not load account." });
  }
});

module.exports = router;
