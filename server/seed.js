const { expectedUsage } = require("./economics");

// Generates a realistic-looking 30-day usage history for a freshly created
// hotel, so a new account isn't a blank dashboard. Values wobble around a
// slightly-better-than-expected baseline with some day-to-day noise and a
// gentle improving trend, similar to a property that's already made a few
// small efficiency changes.
function generateStarterHistory(rooms) {
  const days = 30;
  const out = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    const weekday = date.getDay();
    const isWeekend = weekday === 0 || weekday === 6;
    const occupancy = clampPct(58 + (isWeekend ? 22 : 0) + Math.sin(i * 0.5) * 10 + noise(6));

    const exp = expectedUsage(rooms, occupancy);
    const efficiency = 0.86 + (days - i) * 0.002; // slowly improving over the month

    out.push({
      entry_date: date.toISOString().slice(0, 10),
      occupancy_pct: Math.round(occupancy),
      electricity_kwh: round1(exp.electricity_kwh * efficiency * (1 + noise(0.05))),
      water_l: round1(exp.water_l * efficiency * (1 + noise(0.05))),
      food_kg: round1(exp.food_kg * (1 + noise(0.04))),
      food_waste_kg: round1(exp.food_waste_kg * efficiency * (1 + noise(0.08))),
      general_waste_kg: round1(exp.general_waste_kg * efficiency * (1 + noise(0.06))),
      recycling_kg: round1(exp.general_waste_kg * 0.35 * (1 + noise(0.1))),
    });
  }
  return out;
}

function noise(spread) {
  return (Math.random() * 2 - 1) * spread;
}
function clampPct(v) {
  return Math.max(20, Math.min(98, v));
}
function round1(v) {
  return Math.round(v * 10) / 10;
}

async function seedHotel(pool, hotelId, rooms) {
  const rows = generateStarterHistory(rooms);
  for (const r of rows) {
    await pool.query(
      `INSERT INTO usage_entries
        (hotel_id, entry_date, occupancy_pct, electricity_kwh, water_l, food_kg, food_waste_kg, general_waste_kg, recycling_kg)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (hotel_id, entry_date) DO NOTHING`,
      [
        hotelId,
        r.entry_date,
        r.occupancy_pct,
        r.electricity_kwh,
        r.water_l,
        r.food_kg,
        r.food_waste_kg,
        r.general_waste_kg,
        r.recycling_kg,
      ]
    );
  }
}

module.exports = { seedHotel, generateStarterHistory };
