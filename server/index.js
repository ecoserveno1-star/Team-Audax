require("dotenv").config();
const path = require("path");
const express = require("express");
const { pool, initSchema } = require("./db");

const authRoutes = require("./routes/auth");
const usageRoutes = require("./routes/usage");
const dashboardRoutes = require("./routes/dashboard");
const chatRoutes = require("./routes/chat");
const earlyAccessRoutes = require("./routes/earlyAccess");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "200kb" }));

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, chatbot: process.env.ANTHROPIC_API_KEY ? "claude" : "built-in" });
  } catch (err) {
    res.status(500).json({ ok: false, error: "Database unavailable." });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/usage", usageRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/early-access", earlyAccessRoutes);

app.use(express.static(path.join(__dirname, "..")));

// Single-page app: any other GET falls back to index.html.
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "index.html"));
});

async function start() {
  try {
    await initSchema();
    console.log("Database schema ready.");
  } catch (err) {
    console.error("Failed to initialize database schema:", err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`EcoServe server listening on port ${PORT}`);
    console.log(`Chatbot mode: ${process.env.ANTHROPIC_API_KEY ? "Claude API" : "built-in assistant"}`);
  });
}

start();
