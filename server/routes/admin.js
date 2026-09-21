const express = require("express");
const bcrypt = require("bcryptjs");
const { pool } = require("../db");
const { signToken, requireAdmin } = require("../auth");
const { seedHotel } = require("../seed");

const router = express.Router();

const VALID_TIERS = ["boutique", "resort", "enterprise"];

function isEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

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

router.use(requireAdmin);

/* ---------------------------------- early access requests ---------------------------------- */

router.get("/early-access", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, property_name, email, rooms, created_at FROM early_access_requests ORDER BY created_at DESC"
    );
    res.json({ requests: result.rows });
  } catch (err) {
    console.error("admin early-access list error", err);
    res.status(500).json({ error: "Could not load early access requests." });
  }
});

router.post("/early-access", async (req, res) => {
  try {
    const { name, propertyName, email, rooms } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: "Name is required." });
    if (!propertyName || !propertyName.trim()) return res.status(400).json({ error: "Property name is required." });
    if (!isEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });

    const roomCount = rooms !== undefined && rooms !== "" ? Math.max(1, Math.min(5000, parseInt(rooms, 10) || 0)) || null : null;

    const result = await pool.query(
      "INSERT INTO early_access_requests (name, property_name, email, rooms) VALUES ($1,$2,$3,$4) RETURNING id, name, property_name, email, rooms, created_at",
      [name.trim(), propertyName.trim(), email.toLowerCase().trim(), roomCount]
    );
    res.status(201).json({ request: result.rows[0] });
  } catch (err) {
    console.error("admin early-access create error", err);
    res.status(500).json({ error: "Could not create the request." });
  }
});

router.put("/early-access/:id", async (req, res) => {
  try {
    const { name, propertyName, email, rooms } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: "Name is required." });
    if (!propertyName || !propertyName.trim()) return res.status(400).json({ error: "Property name is required." });
    if (!isEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });

    const roomCount = rooms !== undefined && rooms !== "" ? Math.max(1, Math.min(5000, parseInt(rooms, 10) || 0)) || null : null;

    const result = await pool.query(
      `UPDATE early_access_requests SET name = $1, property_name = $2, email = $3, rooms = $4
       WHERE id = $5
       RETURNING id, name, property_name, email, rooms, created_at`,
      [name.trim(), propertyName.trim(), email.toLowerCase().trim(), roomCount, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Request not found." });
    res.json({ request: result.rows[0] });
  } catch (err) {
    console.error("admin early-access update error", err);
    res.status(500).json({ error: "Could not update the request." });
  }
});

router.delete("/early-access/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM early_access_requests WHERE id = $1 RETURNING id", [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: "Request not found." });
    res.json({ ok: true });
  } catch (err) {
    console.error("admin early-access delete error", err);
    res.status(500).json({ error: "Could not delete the request." });
  }
});

/* ---------------------------------- hotel accounts ---------------------------------- */

router.get("/hotels", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT h.id, h.user_id, h.name, h.location, h.rooms, h.tier, u.email, h.created_at
       FROM hotels h JOIN users u ON u.id = h.user_id
       ORDER BY h.created_at DESC`
    );
    res.json({ hotels: result.rows });
  } catch (err) {
    console.error("admin hotels list error", err);
    res.status(500).json({ error: "Could not load hotel accounts." });
  }
});

router.post("/hotels", async (req, res) => {
  const client = await pool.connect();
  try {
    const { email, password, hotelName, rooms, location, tier } = req.body || {};
    if (!isEmail(email)) return res.status(400).json({ error: "Enter a valid email address." });
    if (!password || password.length < 8) return res.status(400).json({ error: "Password must be at least 8 characters." });
    if (!hotelName || !hotelName.trim()) return res.status(400).json({ error: "Property name is required." });
    const tierValue = VALID_TIERS.includes(tier) ? tier : "boutique";
    const roomCount = Math.max(1, Math.min(2000, parseInt(rooms, 10) || 50));

    await client.query("BEGIN");

    const existing = await client.query("SELECT id FROM users WHERE email = $1", [email.toLowerCase()]);
    if (existing.rows.length) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: "An account with that email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      "INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email",
      [email.toLowerCase(), passwordHash]
    );
    const user = userResult.rows[0];

    const hotelResult = await client.query(
      "INSERT INTO hotels (user_id, name, location, rooms, tier) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, location, rooms, tier, created_at",
      [user.id, hotelName.trim(), (location || "Sri Lanka").trim(), roomCount, tierValue]
    );
    const hotel = hotelResult.rows[0];

    await client.query("COMMIT");

    await seedHotel(pool, hotel.id, hotel.rooms);

    res.status(201).json({ hotel: Object.assign({}, hotel, { email: user.email, user_id: user.id }) });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("admin hotel create error", err);
    res.status(500).json({ error: "Could not create the account." });
  } finally {
    client.release();
  }
});

router.put("/hotels/:id", async (req, res) => {
  try {
    const { name, location, rooms, tier, newPassword } = req.body || {};
    if (!name || !name.trim()) return res.status(400).json({ error: "Property name is required." });
    const tierValue = VALID_TIERS.includes(tier) ? tier : "boutique";
    const roomCount = Math.max(1, Math.min(2000, parseInt(rooms, 10) || 50));

    const result = await pool.query(
      `UPDATE hotels SET name = $1, location = $2, rooms = $3, tier = $4
       WHERE id = $5
       RETURNING id, user_id, name, location, rooms, tier, created_at`,
      [name.trim(), (location || "").trim(), roomCount, tierValue, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: "Hotel not found." });
    const hotel = result.rows[0];

    if (newPassword) {
      if (newPassword.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters." });
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, hotel.user_id]);
    }

    const emailRow = await pool.query("SELECT email FROM users WHERE id = $1", [hotel.user_id]);
    res.json({ hotel: Object.assign({}, hotel, { email: emailRow.rows[0] && emailRow.rows[0].email }) });
  } catch (err) {
    console.error("admin hotel update error", err);
    res.status(500).json({ error: "Could not update the account." });
  }
});

router.delete("/hotels/:id", async (req, res) => {
  try {
    const hotelRow = await pool.query("SELECT user_id FROM hotels WHERE id = $1", [req.params.id]);
    if (!hotelRow.rows.length) return res.status(404).json({ error: "Hotel not found." });
    // Deleting the user cascades to hotels, usage_entries, and chat_messages,
    // fully removing the account instead of leaving an orphaned login.
    await pool.query("DELETE FROM users WHERE id = $1", [hotelRow.rows[0].user_id]);
    res.json({ ok: true });
  } catch (err) {
    console.error("admin hotel delete error", err);
    res.status(500).json({ error: "Could not delete the account." });
  }
});

module.exports = router;
