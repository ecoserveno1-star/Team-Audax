const { money, RATES_LKR, PRICING_TIERS_LKR } = require("./economics");

// Built-in sustainability assistant. No external API calls, no cost — this is
// what answers chatbot questions when ANTHROPIC_API_KEY isn't configured, and
// it can speak to a logged-in hotel's real, current numbers when they're
// passed in as `context`.
const TOPICS = [
  {
    test: /\b(hi|hello|hey|good (morning|afternoon|evening))\b/i,
    reply: (ctx) =>
      ctx?.hotel
        ? `Hello! I'm the EcoServe assistant for ${ctx.hotel.name}. Ask me about your EcoScore, savings, or how to cut usage in a specific area.`
        : "Hello! I'm the EcoServe assistant. Ask me how EcoScore works, what EcoServe costs, or how the platform helps hotels save money.",
  },
  {
    test: /ecoscore|eco score/i,
    reply: (ctx) => {
      if (ctx?.summary?.ecoScore != null) {
        const b = ctx.summary.breakdown.map((x) => `${x.label} ${x.value}/100`).join(", ");
        return `Your current EcoScore is ${ctx.summary.ecoScore}/100, based on the last 30 days of logged data. Breakdown: ${b}. It compares your actual electricity, water, food waste, and general waste against what's expected for your occupancy — not a fixed target — so it stays fair as occupancy changes.`;
      }
      return "EcoScore is a 0–100 number showing how efficiently a property is running. It compares actual electricity, water, food waste, and general waste against what's expected for that day's occupancy, then averages the four into one score. Log in and add a few days of data to see your own.";
    },
  },
  {
    test: /savings ?score|how much (have i|are we) sav/i,
    reply: (ctx) => {
      if (ctx?.summary?.estimatedSavingsLkr != null) {
        return `Based on your logged data, EcoServe estimates ${money(ctx.summary.estimatedSavingsLkr)} saved over the last 30 days versus expected costs at your occupancy level — a Savings Score of ${ctx.summary.savingsScore}/100.`;
      }
      return "Savings Score turns your efficiency into a rupee figure — it estimates how much lower electricity, water, food waste, and general waste costs are compared to what your occupancy would normally be expected to cost, using representative Sri Lankan commercial utility rates.";
    },
  },
  {
    test: /price|pricing|cost|how much (is|does)|plan|tier|subscription/i,
    reply: () => {
      const lines = PRICING_TIERS_LKR.map((t) => `${t.name} — ${t.monthly ? money(t.monthly) + "/month" : "custom pricing"} (${t.who})`);
      return `EcoServe pricing:\n${lines.join("\n")}\nAll tiers include EcoScore & Savings Score tracking. Higher tiers add IoT/PMS integration, AI forecasting, and ESG reporting. Want early access? Use the "Request early access" form on the site.`;
    },
  },
  {
    test: /electricity|energy|power|kwh|air ?con|hvac/i,
    reply: () =>
      `A few reliable ways hotels cut electricity use: schedule HVAC to occupancy rather than running it constantly, switch corridor and back-of-house lighting to LED with occupancy sensors, and set water heating timers around actual guest patterns rather than 24/7 operation. Even a 9% cut on a mid-size property's electricity bill is often worth ${money(70000)}+ per month at current commercial rates (~${RATES_LKR.electricity} LKR/kWh).`,
  },
  {
    test: /water|leak|laundry/i,
    reply: () =>
      "Common water wins: fix running toilets and dripping taps quickly (a single steady leak can waste 20,000+ litres a month), batch laundry loads instead of running partial ones, and use low-flow fixtures in guest bathrooms. If your Water Efficiency score is dropping, check laundry scheduling first — it's the most common cause of a sudden spike.",
  },
  {
    test: /food waste|kitchen|buffet/i,
    reply: () =>
      "Food waste usually tracks poorly against occupancy when kitchens over-prepare for expected covers. Tying daily prep quantities to occupancy forecasts (rather than a fixed daily amount) is the single biggest lever — properties on EcoServe typically see food waste drop 15–20% within a couple of months of doing this consistently.",
  },
  {
    test: /waste|recycl|general waste/i,
    reply: () =>
      "For general waste: separate recyclables at the point of disposal (housekeeping carts and kitchen bins, not just the loading dock), and track your recycling rate over time — properties that hit 60%+ recycling usually also see their EcoScore's waste component improve, since less goes to costly general disposal.",
  },
  {
    test: /occupancy/i,
    reply: () =>
      "EcoServe compares your usage against what's expected for your current occupancy trend, not a flat baseline — so a busy weekend won't get flagged as \"waste\" the way it would with a simple bill comparison. That's also why logging occupancy % alongside each day's usage matters for accurate scoring.",
  },
  {
    test: /guest profile|qr code|shareable|booking platform/i,
    reply: () =>
      "The Guest Profile Page is a shareable summary of your EcoScore and key stats, with a QR code — useful on your website, booking listings, or printed in-room, so guests can see your environmental commitment backed by real numbers.",
  },
  {
    test: /integrat|iot|smart meter|pms|hotel management system/i,
    reply: () =>
      "You can start with manual or spreadsheet data entry on the Boutique tier. Smart meters, IoT devices, and hotel management system (PMS) integrations are available on the Resort & chain tier and above, and can be added later without switching platforms.",
  },
  {
    test: /sri lanka|launch|when|available|sign ?up|early access|get started|register|log ?in/i,
    reply: (ctx) =>
      ctx?.hotel
        ? "You're already set up! Use \"Add Hotel Data\" to keep logging daily figures — your EcoScore and Savings Score update automatically as you add more days."
        : "EcoServe is onboarding its first hotels in Sri Lanka now. Click \"Log in\" to create a free account instantly — you'll get a populated 30-day sample so you can explore before adding your own data.",
  },
  {
    test: /forecast|predict/i,
    reply: () =>
      "AI Forecasting projects next 7 days of expected usage per resource based on your historical data and occupancy trends, so you can see predicted vs. actual and catch drift early.",
  },
  {
    test: /report/i,
    reply: () =>
      "Sustainability Reports summarize each month's EcoScore, resources saved, estimated savings, and CO₂ reduction — generated automatically from your logged data, ready to download or share with ownership.",
  },
  {
    test: /thank/i,
    reply: () => "You're welcome! Ask me anything else about your EcoScore, savings, or how to reduce usage in a specific area.",
  },
];

const FALLBACK =
  "I can help with EcoScore, Savings Score, pricing, or practical tips on cutting electricity, water, food waste, or general waste. What would you like to know?";

function answerRuleBased(message, context) {
  const msg = (message || "").trim();
  if (!msg) return FALLBACK;
  for (const topic of TOPICS) {
    if (topic.test.test(msg)) return topic.reply(context);
  }
  return FALLBACK;
}

module.exports = { answerRuleBased, FALLBACK };
