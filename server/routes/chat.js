const express = require("express");
const { pool } = require("../db");
const { softAuth } = require("../auth");
const { answerRuleBased } = require("../knowledge");
const { buildSummary } = require("../summaryService");

const router = express.Router();

const SYSTEM_PROMPT = `You are the EcoServe assistant, embedded in the EcoServe website — an AI platform that turns a hotel's food, water, and energy data into an EcoScore (0-100 efficiency rating) and a Savings Score (money saved through efficiency), priced and reported in Sri Lankan Rupees (LKR).

Answer questions about: how EcoScore and Savings Score are calculated, EcoServe's pricing tiers (Boutique, Resort & chain, Enterprise), practical sustainability tips for hotels (energy, water, food waste, general waste), and how to use the platform.

If the user is logged in, real figures for their property are provided below — use them and speak specifically to their numbers. If not, answer generally and suggest they log in or request early access for a personalized view.

Keep answers concise (2-4 sentences unless the question needs a list), concrete, and specific to hospitality operations. Do not invent numbers that weren't provided to you.`;

async function getContext(req) {
  if (!req.user) return null;
  const hotelRes = await pool.query("SELECT id, name, location, rooms, tier FROM hotels WHERE id = $1", [req.user.hotelId]);
  const hotel = hotelRes.rows[0];
  if (!hotel) return null;
  const summary = await buildSummary(pool, hotel);
  return { hotel, summary };
}

async function askClaude(message, context, history) {
  const Anthropic = require("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  let contextBlock = "The visitor is not logged in — no property data is available.";
  if (context) {
    contextBlock = `Logged in as: ${context.hotel.name} (${context.hotel.rooms} rooms, ${context.hotel.location}).
EcoScore: ${context.summary.ecoScore ?? "not enough data yet"}/100
Savings Score: ${context.summary.savingsScore ?? "not enough data yet"}/100
Estimated savings (last 30 days): ${context.summary.estimatedSavingsFormatted}
Breakdown: ${context.summary.breakdown.map((b) => `${b.label} ${b.value}/100`).join(", ")}`;
  }

  const messages = (history || [])
    .slice(-8)
    .filter((m) => m && m.role && m.content)
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content).slice(0, 2000) }));
  messages.push({ role: "user", content: message });

  const response = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 400,
    system: `${SYSTEM_PROMPT}\n\n${contextBlock}`,
    messages,
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text : "Sorry, I couldn't generate a response just now.";
}

router.post("/", softAuth, async (req, res) => {
  try {
    const message = String((req.body && req.body.message) || "").slice(0, 1000).trim();
    if (!message) return res.status(400).json({ error: "Message is required." });

    const context = await getContext(req);

    let reply;
    let source;
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        reply = await askClaude(message, context, req.body && req.body.history);
        source = "claude";
      } catch (err) {
        console.error("Claude API error, falling back to built-in assistant:", err.message);
        reply = answerRuleBased(message, context);
        source = "built-in";
      }
    } else {
      reply = answerRuleBased(message, context);
      source = "built-in";
    }

    if (context) {
      await pool
        .query("INSERT INTO chat_messages (hotel_id, role, content) VALUES ($1,'user',$2), ($1,'assistant',$3)", [
          context.hotel.id,
          message,
          reply,
        ])
        .catch((e) => console.error("chat log error", e.message));
    }

    res.json({ reply, source });
  } catch (err) {
    console.error("chat error", err);
    res.status(500).json({ error: "The assistant is temporarily unavailable." });
  }
});

module.exports = router;
