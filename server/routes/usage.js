const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../auth");

const router = express.Router();
router.use(requireAuth);

function rangeToDays(range) {
  if (range === "12m") return 365;
  if (range === "30") return 30;
  return 7;
}

router.get("/", async (req, res) => {
  try {
    const days = rangeToDays(req.query.range);
    const result = await pool.query(
      `SELECT entry_date, occupancy_pct, electricity_kwh, water_l, food_kg, food_waste_kg, general_waste_kg, recycling_kg
       FROM usage_entries
       WHERE hotel_id = $1 AND entry_date >= (CURRENT_DATE - $2::int)
       ORDER BY entry_date ASC`,
      [req.user.hotelId, days]
    );
    res.json({ entries: result.rows });
  } catch (err) {
    console.error("list usage error", err);
    res.status(500).json({ error: "Could not load usage data." });
  }
});

router.post("/", async (req, res) => {
  try {
    const b = req.body || {};
    const date = (b.date || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const nums = [
      "occupancyPct",
      "electricityKwh",
      "waterL",
      "foodKg",
      "foodWasteKg",
      "generalWasteKg",
      "recyclingKg",
    ];
    for (const key of nums) {
      const v = b[key];
      if (v !== undefined && (isNaN(Number(v)) || Number(v) < 0)) {
        return res.status(400).json({ error: `${key} must be a non-negative number.` });
      }
    }

    const result = await pool.query(
      `INSERT INTO usage_entries
        (hotel_id, entry_date, occupancy_pct, electricity_kwh, water_l, food_kg, food_waste_kg, general_waste_kg, recycling_kg)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (hotel_id, entry_date) DO UPDATE SET
        occupancy_pct = EXCLUDED.occupancy_pct,
        electricity_kwh = EXCLUDED.electricity_kwh,
        water_l = EXCLUDED.water_l,
        food_kg = EXCLUDED.food_kg,
        food_waste_kg = EXCLUDED.food_waste_kg,
        general_waste_kg = EXCLUDED.general_waste_kg,
        recycling_kg = EXCLUDED.recycling_kg
       RETURNING *`,
      [
        req.user.hotelId,
        date,
        Number(b.occupancyPct || 0),
        Number(b.electricityKwh || 0),
        Number(b.waterL || 0),
        Number(b.foodKg || 0),
        Number(b.foodWasteKg || 0),
        Number(b.generalWasteKg || 0),
        Number(b.recyclingKg || 0),
      ]
    );
    res.status(201).json({ entry: result.rows[0] });
  } catch (err) {
    console.error("save usage error", err);
    res.status(500).json({ error: "Could not save data." });
  }
});

module.exports = router;
