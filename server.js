import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;
const RIOT_API_KEY = process.env.RIOT_API_KEY;
const LOG_FILE = path.join(__dirname, "searches.log");

app.use(express.static(path.join(__dirname, "public")));
// Necesario para leer la IP real si algún día lo pones detrás de un proxy (nginx, etc.)
app.set("trust proxy", true);

// Enrutado regional de la API de Riot.
// account-v1 usa rutas "regionales": americas | europe | asia
// summoner-v4 / league-v4 usan rutas de "plataforma": euw1 | na1 | kr | ...
const PLATFORM_TO_REGION = {
  euw1: "europe", eun1: "europe", tr1: "europe", ru: "europe",
  na1: "americas", br1: "americas", la1: "americas", la2: "americas",
  kr: "asia", jp1: "asia", oc1: "americas",
};

function logSearch({ query, platform, ip, result }) {
  const line = `${new Date().toISOString()}\t${ip}\t${platform}\t${query}\t${result}\n`;
  // Se registra en fichero y en consola. Es exactamente lo que hace
  // cualquier web con su log de acceso: quién pidió qué y cuándo.
  fs.appendFile(LOG_FILE, line, (err) => {
    if (err) console.error("No se pudo escribir el log:", err);
  });
  console.log("[SEARCH]", line.trim());
}

async function riotFetch(url) {
  const res = await fetch(url, { headers: { "X-Riot-Token": RIOT_API_KEY } });
  if (!res.ok) {
    const err = new Error(`Riot API ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

app.get("/api/search", async (req, res) => {
  const raw = (req.query.riotId || "").trim();       // formato: Nombre#TAG
  const platform = (req.query.platform || "euw1").toLowerCase();
  const ip = req.ip;

  // Registramos TODO intento de búsqueda nada más entrar, aunque luego
  // falle la validación o la API. Así queda constancia de lo que se buscó.
  logSearch({ query: raw || "(vacío)", platform, ip, result: "ATTEMPT" });

  if (!RIOT_API_KEY) {
    logSearch({ query: raw, platform, ip, result: "NO_API_KEY" });
    return res.status(500).json({ error: "Missing RIOT_API_KEY in environment" });
  }
  if (!raw.includes("#")) {
    logSearch({ query: raw, platform, ip, result: "BAD_FORMAT" });
    return res.status(400).json({ error: "Use the format Name#TAG (e.g. Faker#KR1)" });
  }
  const region = PLATFORM_TO_REGION[platform] || "europe";
  const [gameName, tagLine] = raw.split("#");

  try {
    // 1) Riot ID -> cuenta (puuid)
    const account = await riotFetch(
      `https://${region}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
    );

    // 2) puuid -> datos del invocador
    const summoner = await riotFetch(
      `https://${platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${account.puuid}`
    );

    // 3) puuid -> ligas / rango
    const ranks = await riotFetch(
      `https://${platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${account.puuid}`
    );

    logSearch({ query: raw, platform, ip, result: "OK" });

    res.json({
      riotId: `${account.gameName}#${account.tagLine}`,
      summonerLevel: summoner.summonerLevel,
      profileIconId: summoner.profileIconId,
      ranks: ranks.map((r) => ({
        queue: r.queueType,
        tier: r.tier,
        rank: r.rank,
        lp: r.leaguePoints,
        wins: r.wins,
        losses: r.losses,
      })),
    });
  } catch (err) {
    logSearch({ query: raw, platform, ip, result: `ERROR ${err.status || err.message}` });
    if (err.status === 404) return res.status(404).json({ error: "Summoner not found" });
    if (err.status === 403) return res.status(403).json({ error: "Invalid or expired API key" });
    if (err.status === 429) return res.status(429).json({ error: "Too many requests, try again shortly" });
    res.status(500).json({ error: "Error querying the Riot API" });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
  console.log(`Las búsquedas se registran en: ${LOG_FILE}`);
});
