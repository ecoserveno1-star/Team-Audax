const express = require("express");
const { pool } = require("../db");
const { signToken, requireAdmin } = require("../auth");

const router = express.Router();

router.post("/login", (req, res) => {
  const { password } = req.body || {};
  const expected = process.env.ADMIN_PASSWORD;

  if (!expected) {
    return res.status(500).json({ error: "Admin access isn't configured yet. Set ADMIN_PASSWORD on the server." });
  }
  if (!password || password !== expected) {
    return res.status(401).json({ error: "Incorrect password." });
  }

  const token = signToken({ role: "admin" });
  res.json({ token });
});

router.get("/early-access", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, property_name, email, rooms, created_at FROM early_access_requests ORDER BY created_at DESC"
    );
    res.json({ requests: result.rows });
  } catch (err) {
    console.error("admin early-access error", err);
    res.status(500).json({ error: "Could not load early access requests." });
  }
});

router.get("/hotels", requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT h.id, h.name, h.location, h.rooms, h.tier, u.email, h.created_at
       FROM hotels h JOIN users u ON u.id = h.user_id
       ORDER BY h.created_at DESC`
    );
    res.json({ hotels: result.rows });
  } catch (err) {
    console.error("admin hotels error", err);
    res.status(500).json({ error: "Could not load hotel accounts." });
  }
});

module.exports = router;
