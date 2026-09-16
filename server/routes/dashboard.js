const express = require("express");
const { pool } = require("../db");
const { requireAuth } = require("../auth");
const { computeScores, money } = require("../economics");
const { buildSummary } = require("../summaryService");

const router = express.Router();
router.use(requireAuth);

async function getHotel(req) {
  const r = await pool.query("SELECT id, name, location, rooms, tier FROM hotels WHERE id = $1", [req.user.hotelId]);
  return r.rows[0];
}

router.get("/summary", async (req, res) => {
  try {
    const hotel = await getHotel(req);
    if (!hotel) return res.status(404).json({ error: "Hotel not found." });

    const summary = await buildSummary(pool, hotel);
    const { ecoScore, previousEcoScore, breakdown } = summary;

    const alerts = [];
    if (breakdown.find((b) => b.label === "Energy Efficiency")?.value < 65) {
      alerts.push({ level: "red", text: "Electricity usage is running well above expected for current occupancy." });
    }
    if (breakdown.find((b) => b.label === "Water Efficiency")?.value < 65) {
      alerts.push({ level: "amber", text: "Water usage anomaly detected in the last 30 days." });
    }
    if (breakdown.find((b) => b.label === "Food Waste")?.value < 65) {
      alerts.push({ level: "amber", text: "Food waste is trending above target this period." });
    }
    if (ecoScore !== null && previousEcoScore !== null && ecoScore > previousEcoScore) {
      alerts.push({ level: "green", text: `EcoScore improved ${ecoScore - previousEcoScore} points vs. the prior 30 days.` });
    }
    if (!alerts.length) alerts.push({ level: "green", text: "No anomalies detected — usage tracking close to expected." });

    const insights = [];
    const energy = breakdown.find((b) => b.label === "Energy Efficiency");
    const water = breakdown.find((b) => b.label === "Water Efficiency");
    const food = breakdown.find((b) => b.label === "Food Waste");
    if (water && water.value < 75) {
      insights.push({
        key: "water",
        tone: "warning",
        title: "Water usage above target",
        body: `Water efficiency is at ${water.value}/100 for the last 30 days.`,
        cause: "Often linked to higher occupancy combined with laundry or irrigation use.",
        action: "Check laundry scheduling and inspect for leaks in high-usage zones.",
      });
    }
    if (energy && energy.value < 85) {
      const potentialSaving = Math.round((summary.estimatedSavingsLkr || 5000) * 0.6 + 15000);
      insights.push({
        key: "energy",
        tone: "idea",
        title: "Energy saving opportunity",
        body: "Adjusting HVAC schedules to occupancy could meaningfully cut electricity use.",
        saving: money(potentialSaving) + " / month",
      });
    }
    if (food && food.value < 80) {
      insights.push({
        key: "food",
        tone: "warning",
        title: "Food waste above target",
        body: `Food waste efficiency is at ${food.value}/100.`,
        cause: "Preparation volumes may not be tracking occupancy closely enough.",
        action: "Adjust food preparation quantities based on occupancy forecasts.",
      });
    }
    if (!insights.length) {
      insights.push({
        key: "steady",
        tone: "idea",
        title: "Performing well",
        body: "All tracked resources are within or better than expected range for current occupancy.",
      });
    }

    res.json({ hotel, ...summary, alerts, insights });
  } catch (err) {
    console.error("summary error", err);
    res.status(500).json({ error: "Could not load dashboard summary." });
  }
});

router.get("/reports", async (req, res) => {
  try {
    const hotel = await getHotel(req);
    if (!hotel) return res.status(404).json({ error: "Hotel not found." });

    const result = await pool.query(
      `SELECT date_trunc('month', entry_date) AS month, json_agg(usage_entries.*) AS rows
       FROM usage_entries
       WHERE hotel_id = $1 AND entry_date >= (CURRENT_DATE - INTERVAL '6 months')
       GROUP BY month
       ORDER BY month DESC`,
      [hotel.id]
    );

    const reports = result.rows.map((r) => {
      const scores = computeScores(r.rows, hotel.rooms);
      return {
        month: new Date(r.month).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
        ecoScore: scores.ecoScore,
        resourcesSavedPct: scores.resourcesSavedPct,
        estimatedSavingsLkr: scores.estimatedSavingsLkr,
        estimatedSavingsFormatted: money(scores.estimatedSavingsLkr),
      };
    });

    res.json({ reports });
  } catch (err) {
    console.error("reports error", err);
    res.status(500).json({ error: "Could not load reports." });
  }
});

module.exports = router;
