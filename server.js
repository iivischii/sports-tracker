import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import webPush from "web-push";
import cron from "node-cron";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const app = express();

const PORT =
  Number(process.env.PORT) ||
  3001;

app.use(cors());
app.use(express.json());

/* =========================================================
   FILE PATHS
========================================================= */

const __filename =
  fileURLToPath(import.meta.url);

const __dirname =
  path.dirname(__filename);

const distDir =
  path.join(
    __dirname,
    "dist"
  );

const subscriptionsFile =
  path.join(
    __dirname,
    "subscriptions.json"
  );

const remindersFile =
  path.join(
    __dirname,
    "reminders.json"
  );

const gameLinksFile =
  path.join(
    __dirname,
    "game-links.json"
  );

const liveScoresFile =
  path.join(
    __dirname,
    "live-scores.json"
  );

/* =========================================================
   ESPN CONFIG
========================================================= */

const JUDE_ESPN_ID =
  "291281";

const ESPN = {
  /*
    FUTURE FIXTURES

    IMPORTANT:
    ?fixture=true is REQUIRED here.
  */

  realMadridUpcoming:
    "https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/86/schedule?fixture=true",

  englandUpcoming:
    "https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/448/schedule?fixture=true",

  /*
    COMPLETED MATCHES

    Same team schedule, but without
    fixture=true.
  */

  realMadridResults:
    "https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/86/schedule",

  englandResults:
    "https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/448/schedule",

  /*
    Backup scoreboard.
  */

  scoreboard:
    "https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard",

  /*
    Match summary for lineups.
  */

  summary:
    "https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary",
};

/* =========================================================
   VAPID
========================================================= */

if (
  !process.env.VAPID_SUBJECT ||
  !process.env.VAPID_PUBLIC_KEY ||
  !process.env.VAPID_PRIVATE_KEY
) {
  console.error(
    "❌ Missing VAPID environment variables."
  );

  console.error(
    "Check your .env file."
  );

  process.exit(1);
}

webPush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/* =========================================================
   JSON FILE HELPERS
========================================================= */

/*
  STORAGE

  If UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are set
  (production), subscriptions and reminders live in Upstash Redis,
  so they survive restarts and redeploys on free hosting.
  Otherwise the local .json files are used (your PC).
*/

const UPSTASH_URL =
  process.env.UPSTASH_REDIS_REST_URL;

const UPSTASH_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN;

const useRedis =
  Boolean(
    UPSTASH_URL &&
    UPSTASH_TOKEN
  );

async function redisCommand(
  command
) {
  const response =
    await fetch(
      UPSTASH_URL,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${UPSTASH_TOKEN}`,

          "Content-Type":
            "application/json",
        },

        body:
          JSON.stringify(
            command
          ),
      }
    );

  if (!response.ok) {
    throw new Error(
      `Upstash ${response.status}`
    );
  }

  const data =
    await response.json();

  if (data.error) {
    throw new Error(
      data.error
    );
  }

  return data.result;
}

function storageKey(
  file
) {
  return `bellingham:${path.basename(file)}`;
}

async function readJSON(
  file,
  fallback
) {
  if (useRedis) {
    /*
      Errors are thrown on purpose: returning the fallback on a
      failed read could make the next write wipe real data.
    */

    const raw =
      await redisCommand([
        "GET",
        storageKey(file),
      ]);

    return raw
      ? JSON.parse(raw)
      : fallback;
  }

  try {
    const raw =
      await fs.readFile(
        file,
        "utf8"
      );

    return JSON.parse(
      raw
    );
  } catch {
    return fallback;
  }
}

async function writeJSON(
  file,
  data
) {
  if (useRedis) {
    await redisCommand([
      "SET",
      storageKey(file),
      JSON.stringify(data),
    ]);

    return;
  }

  await fs.writeFile(
    file,
    JSON.stringify(
      data,
      null,
      2
    ),
    "utf8"
  );
}

/* =========================================================
   ESPN FETCH
========================================================= */

async function fetchJSON(
  url
) {
  const response =
    await fetch(url);

  if (!response.ok) {
    throw new Error(
      `ESPN ${response.status} ${response.statusText}`
    );
  }

  return await response.json();
}

/* =========================================================
   EVENT EXTRACTION
========================================================= */

function extractEvents(
  data
) {
  if (!data) {
    return [];
  }

  if (
    Array.isArray(
      data.events
    )
  ) {
    return data.events;
  }

  if (
    Array.isArray(
      data.schedule?.events
    )
  ) {
    return data.schedule.events;
  }

  if (
    Array.isArray(
      data.items
    )
  ) {
    return data.items;
  }

  return [];
}

/* =========================================================
   EVENT DATE
========================================================= */

function getEventDate(
  event
) {
  return (
    event?.date ||
    event?.competitions?.[0]?.date ||
    null
  );
}

/* =========================================================
   COMPLETED EVENT
========================================================= */

function getEventStatus(
  event
) {
  /*
    ESPN's team schedule puts status on the
    competition, not on the event itself.
    The scoreboard puts it on the event.
  */

  return (
    event?.status ||
    event?.competitions?.[0]
      ?.status ||
    null
  );
}

function isCompleted(
  event
) {
  const status =
    getEventStatus(event);

  return (
    status?.type?.completed ===
      true ||
    status?.type?.state ===
      "post"
  );
}

/* =========================================================
   UPCOMING FILTER
========================================================= */

function getUpcomingEvents(
  ...datasets
) {
  const now =
    Date.now();

  const unique =
    new Map();

  for (
    const data of datasets
  ) {
    const events =
      extractEvents(
        data
      );

    for (
      const event of events
    ) {
      if (!event?.id) {
        continue;
      }

      const date =
        getEventDate(
          event
        );

      if (!date) {
        continue;
      }

      const kickoff =
        new Date(
          date
        ).getTime();

      if (
        !Number.isFinite(
          kickoff
        )
      ) {
        continue;
      }

      /*
        HARD RULE:

        Past = never upcoming.
      */

      if (
        kickoff <= now
      ) {
        continue;
      }

      /*
        Completed = never upcoming.
      */

      if (
        isCompleted(
          event
        )
      ) {
        continue;
      }

      unique.set(
        String(
          event.id
        ),
        {
          ...event,
          date,
          status:
            getEventStatus(
              event
            ),
        }
      );
    }
  }

  /*
    EARLIEST GAME FIRST
  */

  return Array.from(
    unique.values()
  ).sort(
    (a, b) =>
      new Date(
        a.date
      ).getTime() -
      new Date(
        b.date
      ).getTime()
  );
}

/* =========================================================
   RESULTS FILTER
========================================================= */

function getCompletedEvents(
  ...datasets
) {
  const now =
    Date.now();

  const unique =
    new Map();

  for (
    const data of datasets
  ) {
    const events =
      extractEvents(
        data
      );

    for (
      const event of events
    ) {
      if (!event?.id) {
        continue;
      }

      const date =
        getEventDate(
          event
        );

      if (!date) {
        continue;
      }

      const eventTime =
        new Date(
          date
        ).getTime();

      if (
        !Number.isFinite(
          eventTime
        )
      ) {
        continue;
      }

      if (
        eventTime >= now
      ) {
        continue;
      }

      if (
        !isCompleted(
          event
        )
      ) {
        continue;
      }

      unique.set(
        String(
          event.id
        ),
        {
          ...event,
          date,
          status:
            getEventStatus(
              event
            ),
        }
      );
    }
  }

  /*
    NEWEST RESULT FIRST
  */

  return Array.from(
    unique.values()
  ).sort(
    (a, b) =>
      new Date(
        b.date
      ).getTime() -
      new Date(
        a.date
      ).getTime()
  );
}

/* =========================================================
   SCOREBOARD FALLBACK
========================================================= */

function eventHasTeam(
  event,
  teamId
) {
  const competitors =
    event?.competitions?.[0]
      ?.competitors || [];

  return competitors.some(
    (item) =>
      String(
        item?.team?.id
      ) ===
      String(teamId)
  );
}

function formatESPNDate(
  date
) {
  const year =
    date.getUTCFullYear();

  const month =
    String(
      date.getUTCMonth() +
        1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getUTCDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}${month}${day}`;
}

async function getScoreboardFallback(
  teamId,
  daysBack = 0,
  daysForward = 60
) {
  const start =
    new Date();

  start.setUTCDate(
    start.getUTCDate() -
      daysBack
  );

  const end =
    new Date();

  end.setUTCDate(
    end.getUTCDate() +
      daysForward
  );

  const startDate =
    formatESPNDate(
      start
    );

  const endDate =
    formatESPNDate(
      end
    );

  const url =
    `${ESPN.scoreboard}?dates=${startDate}-${endDate}&limit=1000`;

  console.log(
    `🔎 ESPN FALLBACK ${startDate}-${endDate}`
  );

  const data =
    await fetchJSON(
      url
    );

  return extractEvents(
    data
  ).filter(
    (event) =>
      eventHasTeam(
        event,
        teamId
      )
  );
}

/* =========================================================
   SEASON-AWARE SCHEDULE FETCH

   ESPN's team schedule can default to a different season
   than the one currently being played, which returns no
   fixtures. So we ask for the plain URL AND this year AND
   last year, then merge everything.
========================================================= */

async function fetchSchedules(
  baseUrl,
  label
) {
  const year =
    new Date().getUTCFullYear();

  const joiner =
    baseUrl.includes("?")
      ? "&"
      : "?";

  const urls = [
    baseUrl,
    `${baseUrl}${joiner}season=${year}`,
    `${baseUrl}${joiner}season=${year - 1}`,
  ];

  const settled =
    await Promise.allSettled(
      urls.map((url) =>
        fetchJSON(url)
      )
    );

  const datasets = [];

  settled.forEach(
    (result, index) => {
      if (
        result.status ===
        "fulfilled"
      ) {
        console.log(
          `🔎 ${label} ${urls[index]} -> ${
            extractEvents(
              result.value
            ).length
          } events`
        );

        datasets.push(
          result.value
        );
      } else {
        console.error(
          `❌ ${label} ${urls[index]} -> ${
            result.reason
              ?.message ||
            result.reason
          }`
        );
      }
    }
  );

  if (
    datasets.length === 0
  ) {
    throw new Error(
      `${label}: every ESPN request failed`
    );
  }

  return datasets;
}

/* =========================================================
   REAL MADRID UPCOMING
========================================================= */

async function getRealMadridUpcoming() {
  const data =
    await fetchSchedules(
      ESPN.realMadridUpcoming,
      "RMA upcoming"
    );

  let events =
    getUpcomingEvents(
      ...data
    );

  /*
    Safety fallback.
  */

  if (
    events.length ===
    0
  ) {
    try {
      const fallback =
        await getScoreboardFallback(
          "86"
        );

      events =
        getUpcomingEvents({
          events:
            fallback,
        });
    } catch (error) {
      console.error(
        "RMA fallback failed:",
        error
      );
    }
  }

  console.log(
    `⚪ RMA FUTURE MATCHES: ${events.length}`
  );

  return {
    team:
      "Real Madrid",

    source:
      "ESPN",

    updatedAt:
      new Date().toISOString(),

    events,
  };
}

/* =========================================================
   ENGLAND UPCOMING
========================================================= */

async function getEnglandUpcoming() {
  const data =
    await fetchSchedules(
      ESPN.englandUpcoming,
      "ENG upcoming"
    );

  let events =
    getUpcomingEvents(
      ...data
    );

  /*
    Safety fallback.
  */

  if (
    events.length ===
    0
  ) {
    try {
      const fallback =
        await getScoreboardFallback(
          "448"
        );

      events =
        getUpcomingEvents({
          events:
            fallback,
        });
    } catch (error) {
      console.error(
        "England fallback failed:",
        error
      );
    }
  }

  console.log(
    `🏴 ENGLAND FUTURE MATCHES: ${events.length}`
  );

  return {
    team:
      "England",

    source:
      "ESPN",

    updatedAt:
      new Date().toISOString(),

    events,
  };
}

/* =========================================================
   REAL MADRID RESULTS
========================================================= */

async function getRealMadridResults() {
  const data =
    await fetchSchedules(
      ESPN.realMadridResults,
      "RMA results"
    );

  let events =
    getCompletedEvents(
      ...data
    );

  /*
    Safety fallback: scoreboard for the last 45 days.
  */

  if (
    events.length ===
    0
  ) {
    try {
      const fallback =
        await getScoreboardFallback(
          "86",
          45,
          0
        );

      events =
        getCompletedEvents({
          events:
            fallback,
        });
    } catch (error) {
      console.error(
        "Real Madrid results fallback failed:",
        error
      );
    }
  }

  events =
    events.slice(
      0,
      20
    );

  console.log(
    `📊 RMA COMPLETED: ${events.length}`
  );

  return {
    team:
      "Real Madrid",

    source:
      "ESPN",

    updatedAt:
      new Date().toISOString(),

    events,
  };
}

/* =========================================================
   ENGLAND RESULTS
========================================================= */

async function getEnglandResults() {
  const data =
    await fetchSchedules(
      ESPN.englandResults,
      "ENG results"
    );

  let events =
    getCompletedEvents(
      ...data
    );

  /*
    Safety fallback: scoreboard for the last 45 days.
  */

  if (
    events.length ===
    0
  ) {
    try {
      const fallback =
        await getScoreboardFallback(
          "448",
          45,
          0
        );

      events =
        getCompletedEvents({
          events:
            fallback,
        });
    } catch (error) {
      console.error(
        "England results fallback failed:",
        error
      );
    }
  }

  events =
    events.slice(
      0,
      20
    );

  console.log(
    `📊 ENGLAND COMPLETED: ${events.length}`
  );

  return {
    team:
      "England",

    source:
      "ESPN",

    updatedAt:
      new Date().toISOString(),

    events,
  };
}

/* =========================================================
   5-MINUTE CACHE

   The reminder timer runs every minute and the website polls too.
   Without this, every call would hit ESPN several times.
========================================================= */

function withCache(
  fn,
  ttlMs
) {
  let value = null;
  let storedAt = 0;
  let pending = null;

  return async () => {
    if (
      value &&
      Date.now() - storedAt <
        ttlMs
    ) {
      return value;
    }

    if (pending) {
      return pending;
    }

    pending =
      fn()
        .then((result) => {
          value = result;
          storedAt = Date.now();
          return result;
        })
        .finally(() => {
          pending = null;
        });

    return pending;
  };
}

const CACHE_MS =
  5 * 60 * 1000;

{
  const rmaUp = getRealMadridUpcoming;
  const engUp = getEnglandUpcoming;
  const rmaRes = getRealMadridResults;
  const engRes = getEnglandResults;

  getRealMadridUpcoming = withCache(rmaUp, CACHE_MS);
  getEnglandUpcoming = withCache(engUp, CACHE_MS);
  getRealMadridResults = withCache(rmaRes, CACHE_MS);
  getEnglandResults = withCache(engRes, CACHE_MS);
}

/* =========================================================
   JUDE BASIC INFO
========================================================= */

app.get(
  "/api/jude",
  (req, res) => {
    res.json({
      id:
        JUDE_ESPN_ID,

      name:
        "Jude Bellingham",

      team:
        "Real Madrid",
    });
  }
);

/* =========================================================
   REAL MADRID ROUTE
========================================================= */

app.get(
  "/api/schedule/realmadrid",
  async (
    req,
    res
  ) => {
    try {
      console.log(
        "⚪ REAL MADRID REQUEST"
      );

      const data =
        await getRealMadridUpcoming();

      res.json(
        data
      );
    } catch (error) {
      console.error(
        "RMA schedule error:",
        error
      );

      res.status(
        500
      ).json({
        error:
          "Failed to get Real Madrid schedule",
      });
    }
  }
);

/* =========================================================
   OLD JUDE MATCH ROUTE
========================================================= */

app.get(
  "/api/jude/matches",
  async (
    req,
    res
  ) => {
    try {
      const data =
        await getRealMadridUpcoming();

      res.json(
        data
      );
    } catch (error) {
      console.error(
        "Jude match error:",
        error
      );

      res.status(
        500
      ).json({
        error:
          "Failed to get Jude matches",
      });
    }
  }
);

/* =========================================================
   ENGLAND ROUTE
========================================================= */

app.get(
  "/api/schedule/england",
  async (
    req,
    res
  ) => {
    try {
      console.log(
        "🏴 ENGLAND REQUEST"
      );

      const data =
        await getEnglandUpcoming();

      res.json(
        data
      );
    } catch (error) {
      console.error(
        "England schedule error:",
        error
      );

      res.status(
        500
      ).json({
        error:
          "Failed to get England schedule",
      });
    }
  }
);

/* =========================================================
   UPCOMING BOTH
========================================================= */

app.get(
  "/api/upcoming",
  async (
    req,
    res
  ) => {
    console.log(
      "⚽ UPCOMING REQUEST"
    );

    const [
      rmaResult,
      englandResult,
    ] =
      await Promise.allSettled([
        getRealMadridUpcoming(),
        getEnglandUpcoming(),
      ]);

    const realMadrid =
      rmaResult.status ===
      "fulfilled"
        ? rmaResult.value
        : {
            team:
              "Real Madrid",

            source:
              "ESPN",

            events: [],

            error:
              "RMA schedule unavailable",
          };

    const england =
      englandResult.status ===
      "fulfilled"
        ? englandResult.value
        : {
            team:
              "England",

            source:
              "ESPN",

            events: [],

            error:
              "England schedule unavailable",
          };

    console.log(
      `✅ RMA: ${realMadrid.events.length}`
    );

    console.log(
      `✅ ENGLAND: ${england.events.length}`
    );

    res.json({
      realMadrid,
      england,

      updatedAt:
        new Date().toISOString(),
    });
  }
);

/* =========================================================
   RESULTS
========================================================= */

app.get(
  "/api/results",
  async (
    req,
    res
  ) => {
    console.log(
      "📊 RESULTS REQUEST"
    );

    const [
      rmaResult,
      englandResult,
    ] =
      await Promise.allSettled([
        getRealMadridResults(),
        getEnglandResults(),
      ]);

    const realMadrid =
      rmaResult.status ===
      "fulfilled"
        ? rmaResult.value
        : {
            team:
              "Real Madrid",

            source:
              "ESPN",

            events: [],
          };

    const england =
      englandResult.status ===
      "fulfilled"
        ? englandResult.value
        : {
            team:
              "England",

            source:
              "ESPN",

            events: [],
          };

    res.json({
      realMadrid,
      england,

      updatedAt:
        new Date().toISOString(),
    });
  }
);

/* =========================================================
   JUDE LINEUP
========================================================= */

function extractRosterPlayers(
  summary
) {
  const players = [];

  const rosters =
    summary?.rosters;

  if (
    !Array.isArray(
      rosters
    )
  ) {
    return players;
  }

  for (
    const roster of rosters
  ) {
    if (
      Array.isArray(
        roster.roster
      )
    ) {
      players.push(
        ...roster.roster
      );
    }

    if (
      Array.isArray(
        roster.entries
      )
    ) {
      players.push(
        ...roster.entries
      );
    }

    if (
      Array.isArray(
        roster.players
      )
    ) {
      players.push(
        ...roster.players
      );
    }
  }

  return players;
}

app.get(
  "/api/bellingham/status/:eventId",
  async (
    req,
    res
  ) => {
    try {
      const {
        eventId,
      } = req.params;

      if (!eventId) {
        return res
          .status(400)
          .json({
            error:
              "Missing event ID",
          });
      }

      const url =
        `${ESPN.summary}?event=` +
        encodeURIComponent(
          eventId
        );

      const summary =
        await fetchJSON(
          url
        );

      const players =
        extractRosterPlayers(
          summary
        );

      const jude =
        players.find(
          (player) => {
            const id =
              player?.athlete?.id ??
              player?.player?.id ??
              "";

            const name =
              player?.athlete
                ?.displayName ??
              player?.athlete
                ?.fullName ??
              player?.player
                ?.displayName ??
              player?.player
                ?.fullName ??
              "";

            return (
              String(id) ===
                JUDE_ESPN_ID ||
              name
                .toLowerCase() ===
                "jude bellingham"
            );
          }
        );

      let status =
        "not_announced";

      if (
        jude?.starter ===
          true ||
        jude?.starter ===
          "true"
      ) {
        status =
          "starting";
      } else if (
        jude?.starter ===
          false ||
        jude?.starter ===
          "false"
      ) {
        status =
          "not_starting";
      }

      res.json({
        eventId,

        player:
          "Jude Bellingham",

        status,

        checkedAt:
          new Date().toISOString(),
      });
    } catch (error) {
      console.error(
        "Jude status error:",
        error
      );

      res.status(
        500
      ).json({
        error:
          "Failed to get Jude status",
      });
    }
  }
);

app.get(
  "/api/bellingham/stats/:eventId",
  async (
    req,
    res
  ) => {
    try {
      const {
        eventId,
      } = req.params;

      if (!/^\d+$/.test(eventId)) {
        return res
          .status(400)
          .json({
            error:
              "Invalid event ID",
          });
      }

      const summary =
        await fetchJSON(
          `${ESPN.summary}?event=` +
            encodeURIComponent(eventId)
        );

      const jude =
        extractRosterPlayers(summary).find(
          (player) => {
            const id =
              player?.athlete?.id ??
              player?.player?.id ??
              "";

            const name =
              player?.athlete?.displayName ??
              player?.player?.displayName ??
              "";

            return (
              String(id) === JUDE_ESPN_ID ||
              name.toLowerCase() === "jude bellingham"
            );
          }
        );

      const playerStats =
        (jude?.stats ?? []).map((stat) => ({
          name:
            stat.displayName ?? stat.name,
          value:
            stat.displayValue ?? String(stat.value ?? ""),
          description:
            stat.description ?? "",
        }));

      const playerEvents =
        (jude?.plays ?? []).map((play) => ({
          time:
            play.clock?.displayValue ?? "",
          yellowCard:
            Boolean(play.yellowCard),
          redCard:
            Boolean(play.redCard),
          scoringPlay:
            Boolean(play.scoringPlay),
          substitution:
            Boolean(play.substitution),
        }));

      const teamStats =
        (summary?.boxscore?.teams ?? []).map((team) => ({
          name:
            team.team?.displayName ?? "Team",
          stats:
            (team.statistics ?? []).map((stat) => ({
              name:
                stat.label ?? stat.name,
              value:
                stat.displayValue ?? "-",
            })),
        }));

      const matchEvents =
        (summary?.keyEvents ?? [])
          .filter((event) =>
            /goal|yellow card|red card|substitution|penalty/i.test(
              event?.text ?? ""
            )
          )
          .map((event) => ({
            id:
              String(event.id ?? `${event.clock?.value}-${event.text}`),
            time:
              event.clock?.displayValue ?? "",
            type:
              event.scoringPlay
                ? "goal"
                : /red card/i.test(event.text)
                  ? "red-card"
                  : /yellow card/i.test(event.text)
                    ? "yellow-card"
                    : /penalty/i.test(event.text)
                      ? "penalty"
                      : "substitution",
            text:
              event.text,
          }));

      const lineups =
        (summary?.rosters ?? []).map((roster) => ({
          team:
            roster.team?.displayName ?? "Team",
          logo:
            roster.team?.logo ?? null,
          formation:
            roster.formation ?? "",
          starters:
            (roster.roster ?? [])
              .filter((player) => player.starter)
              .sort(
                (a, b) =>
                  Number(a.formationPlace) -
                  Number(b.formationPlace)
              )
              .map((player) => ({
                id:
                  String(player.athlete?.id ?? player.jersey ?? player.formationPlace),
                name:
                  player.athlete?.displayName ?? "Player",
                shortName:
                  player.athlete?.shortName ??
                  player.athlete?.displayName ??
                  "Player",
                jersey:
                  player.jersey ?? "",
                position:
                  player.position?.displayName ??
                  player.position?.abbreviation ??
                  "",
                formationPlace:
                  Number(player.formationPlace) || 0,
                headshot:
                  player.athlete?.headshot?.href ??
                  player.headshot?.href ??
                  null,
              })),
        }));

      res.json({
        eventId,
        player: jude
          ? {
              name:
                jude.athlete?.displayName ?? "Jude Bellingham",
              position:
                jude.position?.displayName ?? "",
              starter:
                Boolean(jude.starter),
              stats:
                playerStats,
              events:
                playerEvents,
            }
          : null,
        teamStats,
        matchEvents,
        lineups,
        heatmapAvailable: false,
      });
    } catch (error) {
      console.error(
        "Jude match stats error:",
        error
      );

      res.status(500).json({
        error:
          "Failed to get Jude match stats",
      });
    }
  }
);

/* =========================================================
   GAME LINKS

   Saved on the server (Redis in production, a local file in
   dev) instead of only in the browser's localStorage, so the
   same links show up no matter which device/app/browser opens
   the site.
========================================================= */

app.get(
  "/api/game-links",
  async (
    req,
    res
  ) => {
    try {
      const links =
        await readJSON(
          gameLinksFile,
          []
        );

      res.json({
        links,
      });
    } catch (error) {
      console.error(
        "Game links read error:",
        error
      );

      res.status(
        500
      ).json({
        error:
          "Failed to load game links",
      });
    }
  }
);

app.post(
  "/api/game-links",
  async (
    req,
    res
  ) => {
    try {
      const links =
        req.body?.links;

      if (
        !Array.isArray(
          links
        )
      ) {
        return res
          .status(400)
          .json({
            error:
              "links must be an array",
          });
      }

      await writeJSON(
        gameLinksFile,
        links
      );

      console.log(
        "🔗 GAME LINKS SAVED"
      );

      res.json({
        success:
          true,
      });
    } catch (error) {
      console.error(
        "Game links save error:",
        error
      );

      res.status(
        500
      ).json({
        error:
          "Failed to save game links",
      });
    }
  }
);

/* =========================================================
   NOTIFICATION PUBLIC KEY
========================================================= */

app.get(
  "/api/notifications/public-key",
  (
    req,
    res
  ) => {
    res.json({
      publicKey:
        process.env
          .VAPID_PUBLIC_KEY,
    });
  }
);

const VALID_REMINDER_HOURS = [
  1,
  12,
  24,
];

function normalizeReminderHours(hours) {
  if (!Array.isArray(hours)) {
    return [1];
  }

  return [
    ...new Set(
      hours
        .map(Number)
        .filter((hour) =>
          VALID_REMINDER_HOURS.includes(hour)
        )
    ),
  ].sort((a, b) => a - b);
}

/* =========================================================
   SUBSCRIBE
========================================================= */

app.post(
  "/api/notifications/subscribe",
  async (
    req,
    res
  ) => {
    try {
      const requestBody =
        req.body;

      const subscription =
        requestBody?.subscription ??
        requestBody;

      if (
        !subscription?.endpoint
      ) {
        return res
          .status(400)
          .json({
            error:
              "Invalid subscription",
          });
      }

      const subscriptionRecord = {
        ...subscription,
        reminderHours:
          normalizeReminderHours(
            requestBody?.reminderHours
          ),
      };

      const subscriptions =
        await readJSON(
          subscriptionsFile,
          []
        );

      const existingIndex =
        subscriptions.findIndex(
          (item) =>
            item.endpoint ===
            subscription.endpoint
        );

      if (existingIndex === -1) {
        subscriptions.push(subscriptionRecord);
      } else {
        subscriptions[existingIndex] = {
          ...subscriptions[existingIndex],
          ...subscriptionRecord,
        };
      }

      await writeJSON(
        subscriptionsFile,
        subscriptions
      );

      console.log(
        "🔔 PUSH SUBSCRIPTION SAVED"
      );

      res.json({
        success:
          true,
      });
    } catch (error) {
      console.error(
        "Subscription error:",
        error
      );

      res.status(
        500
      ).json({
        error:
          "Failed to save subscription",
      });
    }
  }
);

/* =========================================================
   UNSUBSCRIBE
========================================================= */

app.post(
  "/api/notifications/unsubscribe",
  async (
    req,
    res
  ) => {
    try {
      const endpoint =
        req.body?.endpoint;

      if (!endpoint) {
        return res
          .status(400)
          .json({
            error:
              "Missing endpoint",
          });
      }

      const subscriptions =
        await readJSON(
          subscriptionsFile,
          []
        );

      const filtered =
        subscriptions.filter(
          (item) =>
            item.endpoint !==
            endpoint
        );

      await writeJSON(
        subscriptionsFile,
        filtered
      );

      console.log(
        "🔕 PUSH SUBSCRIPTION REMOVED"
      );

      res.json({
        success:
          true,
      });
    } catch (error) {
      console.error(
        "Unsubscribe error:",
        error
      );

      res.status(
        500
      ).json({
        error:
          "Failed to remove subscription",
      });
    }
  }
);

/* =========================================================
   SEND PUSH
========================================================= */

async function sendPushNotification(
  payload,
  reminderHour = null
) {
  const subscriptions =
    await readJSON(
      subscriptionsFile,
      []
    );

  if (
    subscriptions.length ===
    0
  ) {
    return;
  }

  const remaining = [];

  for (
    const savedSubscription of
      subscriptions
  ) {
    const selectedReminderHours =
      normalizeReminderHours(
        savedSubscription.reminderHours
      );

    if (
      reminderHour !== null &&
      !selectedReminderHours.includes(reminderHour)
    ) {
      remaining.push(savedSubscription);
      continue;
    }

    const subscription = {
      ...savedSubscription,
    };

    delete subscription.reminderHours;

    try {
      await webPush.sendNotification(
        subscription,
        JSON.stringify(
          payload
        )
      );

      remaining.push(
        subscription
      );
    } catch (error) {
      console.error(
        "Push failed:",
        error.statusCode ||
          error.message
      );

      /*
        Delete invalid subscriptions.
      */

      if (
        error.statusCode !==
          404 &&
        error.statusCode !==
          410
      ) {
        remaining.push(
          subscription
        );
      }
    }
  }

  await writeJSON(
    subscriptionsFile,
    remaining
  );
}

/* =========================================================
   MATCH DETAILS
========================================================= */

function getMatchDetails(
  event,
  teamId
) {
  const competitors =
    event?.competitions?.[0]
      ?.competitors || [];

  const team =
    competitors.find(
      (item) =>
        String(
          item?.team?.id
        ) ===
        String(teamId)
    );

  const opponent =
    competitors.find(
      (item) =>
        String(
          item?.team?.id
        ) !==
        String(teamId)
    );

  return {
    id:
      String(
        event?.id
      ),

    opponent:
      opponent?.team
        ?.displayName ||
      "Opponent",

    date:
      getEventDate(
        event
      ),

    homeAway:
      team?.homeAway ||
      "",
  };
}

/* =========================================================
   ONE-HOUR REMINDERS
========================================================= */

async function checkMatchReminders() {
  try {
    const [
      rmaResult,
      englandResult,
    ] =
      await Promise.allSettled([
        getRealMadridUpcoming(),
        getEnglandUpcoming(),
      ]);

    const matches = [];

    if (
      rmaResult.status ===
      "fulfilled"
    ) {
      for (
        const event of
          rmaResult.value.events
      ) {
        matches.push({
          event,

          teamId:
            "86",

          teamName:
            "Real Madrid",
        });
      }
    }

    if (
      englandResult.status ===
      "fulfilled"
    ) {
      for (
        const event of
          englandResult.value.events
      ) {
        matches.push({
          event,

          teamId:
            "448",

          teamName:
            "England",
        });
      }
    }

    const reminders =
      await readJSON(
        remindersFile,
        {}
      );

    let remindersChanged =
      false;

    const now =
      Date.now();

    for (
      const match of matches
    ) {
      const details =
        getMatchDetails(
          match.event,
          match.teamId
        );

      if (!details.date) {
        continue;
      }

      const kickoff =
        new Date(
          details.date
        ).getTime();

      if (
        !Number.isFinite(
          kickoff
        )
      ) {
        continue;
      }

      const timeUntil =
        kickoff -
        now;

      for (const reminderHour of VALID_REMINDER_HOURS) {
        const targetTime =
          reminderHour * 60 * 60 * 1000;

        const tolerance =
          5 * 60 * 1000;

        if (
          timeUntil < targetTime - tolerance ||
          timeUntil > targetTime + tolerance
        ) {
          continue;
        }

        const reminderSuffix =
          reminderHour === 1
            ? "60"
            : `${reminderHour}h`;

        const reminderKey =
          `${match.teamName}-${details.id}-${reminderSuffix}`;

        if (reminders[reminderKey]) {
          continue;
        }

        await sendPushNotification({
          title:
            `⚽ ${match.teamName} match in ${reminderHour} ${reminderHour === 1 ? "hour" : "hours"}`,

          body:
            `${match.teamName} vs ${details.opponent}.`,

          tag:
            reminderKey,

          url:
            "/",
        }, reminderHour);

        reminders[reminderKey] =
          new Date().toISOString();

        remindersChanged =
          true;

        console.log(
          `🔔 SENT (${reminderHour}h): ${match.teamName} vs ${details.opponent}`
        );
      }
    }

    if (remindersChanged) {
      await writeJSON(
        remindersFile,
        reminders
      );
    }
  } catch (error) {
    console.error(
      "Reminder checker error:",
      error
    );
  }
}

/* =========================================================
  LIVE MATCH NOTIFICATIONS

  Every minute, checks ESPN's live scoreboard and commentary
  for Real Madrid and England. Score changes trigger goal
  alerts; new cards, penalties, and substitutions trigger
  moment alerts. The first poll stores a baseline so old
  events do not trigger notifications after a restart.
========================================================= */

const LIVE_TRACKED_TEAMS = [
  { id: "86", name: "Real Madrid" },
  { id: "448", name: "England" },
];

async function getLiveScoreboardEvents() {
  const today =
    new Date();

  const yesterday =
    new Date(today);

  yesterday.setUTCDate(
    yesterday.getUTCDate() - 1
  );

  const results =
    await Promise.allSettled(
      [yesterday, today].map((date) =>
        fetchJSON(
          `${ESPN.scoreboard}?dates=${formatESPNDate(date)}`
        )
      )
    );

  const eventMap =
    new Map();

  results.forEach((result) => {
    if (result.status !== "fulfilled") {
      return;
    }

    extractEvents(result.value).forEach((event) => {
      eventMap.set(
        String(event.id),
        event
      );
    });
  });

  if (
    results.every((result) => result.status !== "fulfilled")
  ) {
    throw new Error("ESPN live scoreboard unavailable");
  }

  return Array.from(eventMap.values());
}

function extractLiveMoments(summary) {
  return (summary?.commentary ?? [])
    .map((item) => item?.play)
    .filter((play) => {
      const type =
        play?.type?.type ?? "";

      return (
        play?.id &&
        /yellow-card|red-card|substitution|penalty/i.test(type)
      );
    })
    .map((play) => ({
      id:
        String(play.id),
      type:
        play.type.type,
      time:
        play.clock?.displayValue ?? "",
      text:
        play.text ?? "",
    }));
}

async function checkLiveGoals() {
  try {
    const liveScores =
      await readJSON(
        liveScoresFile,
        {}
      );

    let scoresChanged =
      false;

    const seenMatchIds =
      new Set();

    const scoreboardEvents =
      await getLiveScoreboardEvents();

    for (
      const trackedTeam of
        LIVE_TRACKED_TEAMS
    ) {
      const events =
        scoreboardEvents.filter((event) =>
          eventHasTeam(event, trackedTeam.id)
        );

      for (
        const event of events
      ) {
        const competition =
          event?.competitions?.[0];

        const state =
          competition?.status
            ?.type?.state;

        // Only care about matches currently being played.
        if (state !== "in") {
          continue;
        }

        const matchId =
          String(event?.id);

        seenMatchIds.add(
          matchId
        );

        const competitors =
          competition
            ?.competitors || [];

        const home =
          competitors.find(
            (c) =>
              c?.homeAway ===
              "home"
          );

        const away =
          competitors.find(
            (c) =>
              c?.homeAway ===
              "away"
          );

        if (!home || !away) {
          continue;
        }

        const homeName =
          home?.team
            ?.shortDisplayName ||
          home?.team
            ?.displayName ||
          "Home";

        const awayName =
          away?.team
            ?.shortDisplayName ||
          away?.team
            ?.displayName ||
          "Away";

        const homeScore =
          Number(
            home?.score ?? 0
          );

        const awayScore =
          Number(
            away?.score ?? 0
          );

        const scoreString =
          `${homeScore}-${awayScore}`;

        const previous =
          liveScores[matchId];

        let summary =
          null;

        try {
          summary =
            await fetchJSON(
              `${ESPN.summary}?event=${encodeURIComponent(matchId)}`
            );
        } catch (error) {
          console.error(
            `Live moments fetch failed for ${matchId}:`,
            error.statusCode || error.message
          );
        }

        const liveMoments =
          extractLiveMoments(summary);

        const momentIds =
          new Set(
            liveMoments.map((moment) => moment.id)
          );

        if (
          previous === undefined
        ) {
          // First time seeing this match live - just save
          // the baseline, don't notify.
          liveScores[matchId] = {
            score: scoreString,
            homeName,
            awayName,
            momentIds:
              Array.from(momentIds),
          };

          scoresChanged = true;
          continue;
        }

        const knownMomentIds =
          new Set(
            Array.isArray(previous.momentIds)
              ? previous.momentIds
              : momentIds
          );

        if (
          previous.score !== scoreString
        ) {
          const [previousHomeScore, previousAwayScore] =
            String(previous.score)
              .split("-")
              .map(Number);

          const goalScored =
            homeScore > previousHomeScore ||
            awayScore > previousAwayScore;

          await sendPushNotification({
            title: goalScored
              ? "⚽ GOAL!"
              : "📊 SCORE UPDATE",

            body:
              `${homeName} ${homeScore}-${awayScore} ${awayName}`,

            tag:
              `live-${matchId}-score-${scoreString}`,

            url:
              "/",
          });

          console.log(
            `⚽ GOAL PUSHED: ${homeName} ${homeScore}-${awayScore} ${awayName}`
          );
        }

        if (Array.isArray(previous.momentIds)) {
          for (const moment of liveMoments) {
            if (knownMomentIds.has(moment.id)) {
              continue;
            }

            const title =
              moment.type === "red-card"
                ? "🟥 RED CARD"
                : moment.type === "yellow-card"
                  ? "🟨 YELLOW CARD"
                  : /penalty/i.test(moment.type)
                    ? "⚽ PENALTY"
                    : "🔄 SUBSTITUTION";

            await sendPushNotification({
              title,
              body:
                `${homeName} ${homeScore}-${awayScore} ${awayName}. ${moment.time ? `${moment.time}: ` : ""}${moment.text}`,
              tag:
                `live-${matchId}-${moment.id}`,
              url:
                "/",
            });

            knownMomentIds.add(moment.id);

            console.log(
              `🔔 LIVE MOMENT: ${moment.type} ${homeName} vs ${awayName}`
            );
          }
        }

        liveScores[matchId] = {
          score: scoreString,
          homeName,
          awayName,
          momentIds:
            Array.from(knownMomentIds),
        };

        scoresChanged = true;
      }
    }

    /*
      Clean up matches that are no longer live (finished,
      postponed, or just not showing up anymore) so this file
      doesn't grow forever.
    */

    for (
      const storedId of
        Object.keys(liveScores)
    ) {
      if (
        !seenMatchIds.has(
          storedId
        )
      ) {
        delete liveScores[
          storedId
        ];

        scoresChanged = true;
      }
    }

    if (scoresChanged) {
      await writeJSON(
        liveScoresFile,
        liveScores
      );
    }
  } catch (error) {
    console.error(
      "Live goal checker error:",
      error
    );
  }
}

/* =========================================================
   CRON
========================================================= */

cron.schedule(
  "* * * * *",
  () => {
    checkMatchReminders();
    checkLiveGoals();
  }
);

/* =========================================================
   WEBSITE (the built frontend in /dist)
========================================================= */

app.use(
  express.static(
    distDir,
    {
      dotfiles:
        "allow",
    }
  )
);

app.get(
  "/{*splat}",
  (req, res) => {
    res.sendFile(
      path.join(
        distDir,
        "index.html"
      ),
      (error) => {
        if (error) {
          res
            .status(404)
            .send(
              "Not found"
            );
        }
      }
    );
  }
);

/* =========================================================
   SERVER
========================================================= */

app.listen(
  PORT,
  () => {
    console.log(
      "🔥 THIS IS THE NEW BELLI GOAL SERVER 🔥"
    );

    console.log(
      `BelliGoal backend running on port ${PORT}${useRedis ? " (Upstash storage)" : " (local files)"}`
    );

    console.log(
      "⚽ ESPN future fixtures enabled"
    );

    console.log(
      "📊 ESPN completed results enabled"
    );

    console.log(
      "🧑 Jude lineup checking enabled"
    );

    console.log(
      "🔔 Match reminders enabled: 1, 12, and 24 hours"
    );
  }
);