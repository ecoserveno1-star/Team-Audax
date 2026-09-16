// Representative Sri Lankan hospitality-sector unit rates (LKR), 2025.
// These are realistic planning figures for a commercial-tariff hotel property,
// not a live pricing feed — there is no public real-time API for hotel utility
// costs, so EcoServe uses stable reference rates you can tune per property later.
const RATES_LKR = {
  electricity: 68, // LKR per kWh, commercial (Hotel) CEB tariff band
  water: 0.18, // LKR per litre, commercial NWSDB tariff
  food: 780, // LKR per kg, average kitchen ingredient cost
  waste: 210, // LKR per kg, commercial waste collection & disposal
};

const PRICING_TIERS_LKR = [
  {
    key: "boutique",
    name: "Boutique",
    monthly: 15000,
    who: "Independent hotels & boutique stays (up to 40 rooms)",
  },
  {
    key: "resort",
    name: "Resort & chain",
    monthly: 45000,
    who: "Resorts and hotel groups (up to 200 rooms)",
    popular: true,
  },
  {
    key: "enterprise",
    name: "Enterprise",
    monthly: null,
    who: "Large hotel groups & international chains",
  },
];

function money(n) {
  const v = Math.round(n || 0);
  return "LKR " + v.toLocaleString("en-LK");
}

// A hotel's expected usage scales with occupancy and room count. This gives
// each metric a same-sized property "should" be using, so EcoScore reflects
// efficiency rather than just being a smaller or quieter hotel.
function expectedUsage(rooms, occupancyPct) {
  const occ = Math.max(5, Math.min(100, occupancyPct)) / 100;
  const occupiedRooms = rooms * occ;
  return {
    electricity_kwh: occupiedRooms * 14 + rooms * 4, // base load + per occupied room
    water_l: occupiedRooms * 480 + rooms * 60,
    food_kg: occupiedRooms * 3.1,
    food_waste_kg: occupiedRooms * 3.1 * 0.14, // ~14% is considered a reasonable waste ratio
    general_waste_kg: occupiedRooms * 1.6,
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// Turns "actual vs expected" into a 0-100 sub-score. Being at or under the
// expectation scores 100; every 10% over expectation costs ~10 points.
function subScore(actual, expected) {
  if (expected <= 0) return 100;
  const ratio = actual / expected;
  if (ratio <= 1) return clamp(100 - (1 - ratio) * 25, 70, 100); // reward doing much better, but cap upside
  return clamp(100 - (ratio - 1) * 100, 0, 100);
}

function computeScores(entries, rooms) {
  if (!entries.length) {
    return {
      ecoScore: null,
      savingsScore: null,
      breakdown: [],
      resourcesSavedPct: null,
      estimatedSavingsLkr: 0,
      totalCostLkr: 0,
      expectedCostLkr: 0,
    };
  }

  let actualTotals = { electricity_kwh: 0, water_l: 0, food_kg: 0, food_waste_kg: 0, general_waste_kg: 0 };
  let expectedTotals = { electricity_kwh: 0, water_l: 0, food_kg: 0, food_waste_kg: 0, general_waste_kg: 0 };

  entries.forEach((e) => {
    const exp = expectedUsage(rooms, Number(e.occupancy_pct));
    actualTotals.electricity_kwh += Number(e.electricity_kwh);
    actualTotals.water_l += Number(e.water_l);
    actualTotals.food_kg += Number(e.food_kg);
    actualTotals.food_waste_kg += Number(e.food_waste_kg);
    actualTotals.general_waste_kg += Number(e.general_waste_kg);
    expectedTotals.electricity_kwh += exp.electricity_kwh;
    expectedTotals.water_l += exp.water_l;
    expectedTotals.food_kg += exp.food_kg;
    expectedTotals.food_waste_kg += exp.food_waste_kg;
    expectedTotals.general_waste_kg += exp.general_waste_kg;
  });

  const energyScore = subScore(actualTotals.electricity_kwh, expectedTotals.electricity_kwh);
  const waterScore = subScore(actualTotals.water_l, expectedTotals.water_l);
  const foodScore = subScore(actualTotals.food_waste_kg, expectedTotals.food_waste_kg);
  const wasteScore = subScore(actualTotals.general_waste_kg, expectedTotals.general_waste_kg);

  const ecoScore = Math.round((energyScore + waterScore + foodScore + wasteScore) / 4);

  const totalCostLkr =
    actualTotals.electricity_kwh * RATES_LKR.electricity +
    actualTotals.water_l * RATES_LKR.water +
    actualTotals.food_waste_kg * RATES_LKR.food +
    actualTotals.general_waste_kg * RATES_LKR.waste;

  const expectedCostLkr =
    expectedTotals.electricity_kwh * RATES_LKR.electricity +
    expectedTotals.water_l * RATES_LKR.water +
    expectedTotals.food_waste_kg * RATES_LKR.food +
    expectedTotals.general_waste_kg * RATES_LKR.waste;

  const estimatedSavingsLkr = Math.max(0, expectedCostLkr - totalCostLkr);
  const resourcesSavedPct = expectedCostLkr > 0 ? clamp(((expectedCostLkr - totalCostLkr) / expectedCostLkr) * 100, -100, 100) : 0;
  const savingsScore = Math.round(clamp(50 + resourcesSavedPct * 1.4, 0, 100));

  return {
    ecoScore,
    savingsScore,
    breakdown: [
      { label: "Energy Efficiency", value: Math.round(energyScore) },
      { label: "Water Efficiency", value: Math.round(waterScore) },
      { label: "Food Waste", value: Math.round(foodScore) },
      { label: "Waste Management", value: Math.round(wasteScore) },
    ],
    resourcesSavedPct: Math.round(resourcesSavedPct * 10) / 10,
    estimatedSavingsLkr: Math.round(estimatedSavingsLkr),
    totalCostLkr: Math.round(totalCostLkr),
    expectedCostLkr: Math.round(expectedCostLkr),
  };
}

module.exports = { RATES_LKR, PRICING_TIERS_LKR, money, expectedUsage, computeScores };
