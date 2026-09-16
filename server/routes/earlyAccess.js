const express = require("express");
const { pool } = require("../db");

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { name, propertyName, email, rooms } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: "Your name is required." });
    if (!propertyName || !propertyName.trim()) return res.status(400).json({ error: "Property name is required." });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });

    const roomCount = rooms ? Math.max(1, Math.min(5000, parseInt(rooms, 10) || 0)) || null : null;

    await pool.query(
      "INSERT INTO early_access_requests (name, property_name, email, rooms) VALUES ($1, $2, $3, $4)",
      [name.trim(), propertyName.trim(), email.toLowerCase().trim(), roomCount]
    );

    res.status(201).json({ ok: true });
  } catch (err) {
    console.error("early access error", err);
    res.status(500).json({ error: "Could not submit your request. Please try again." });
  }
});

module.exports = router;
