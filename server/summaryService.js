const { computeScores, money } = require("./economics");

// Shared by the dashboard API and the chatbot, so both see identical numbers.
async function buildSummary(pool, hotel) {
  const last30 = await pool.query(
    `SELECT * FROM usage_entries WHERE hotel_id = $1 AND entry_date >= (CURRENT_DATE - 30) ORDER BY entry_date ASC`,
    [hotel.id]
  );
  const prev30 = await pool.query(
    `SELECT * FROM usage_entries WHERE hotel_id = $1 AND entry_date >= (CURRENT_DATE - 60) AND entry_date < (CURRENT_DATE - 30) ORDER BY entry_date ASC`,
    [hotel.id]
  );

  const current = computeScores(last30.rows, hotel.rooms);
  const previous = computeScores(prev30.rows, hotel.rooms);

  return {
    ecoScore: current.ecoScore,
    savingsScore: current.savingsScore,
    resourcesSavedPct: current.resourcesSavedPct,
    estimatedSavingsLkr: current.estimatedSavingsLkr,
    estimatedSavingsFormatted: money(current.estimatedSavingsLkr),
    breakdown: current.breakdown,
    previousEcoScore: previous.ecoScore,
    daysLogged: last30.rows.length,
  };
}

module.exports = { buildSummary };
