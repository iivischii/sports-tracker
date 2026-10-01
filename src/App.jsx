import { useEffect, useMemo, useState } from "react";

import {
  Bell,
  BarChart3,
  Settings,
  X,
  ExternalLink,
  Link,
} from "lucide-react";

import "./index.css";
import "./collage.css";

/*
  Empty = same origin. In dev, Vite proxies /api to the
  backend on :3001 (see vite.config.js), so this works from
  your PC *and* your phone. For a deployed build, set
  VITE_API_BASE in .env to the backend URL.
*/
const API_BASE =
  import.meta.env.VITE_API_BASE ??
  "";

const RMA_TEAM_ID = "86";
const ENGLAND_TEAM_ID = "448";

/* =========================================================
   APP
========================================================= */

function App() {
  /* =========================================================
     DATA
  ========================================================= */

  const [upcomingMatches, setUpcomingMatches] =
    useState({
      realMadrid: {
        team: "Real Madrid",
        events: [],
      },

      england: {
        team: "England",
        events: [],
      },
    });

  const [completedMatches, setCompletedMatches] =
    useState({
      realMadrid: {
        team: "Real Madrid",
        events: [],
      },

      england: {
        team: "England",
        events: [],
      },
    });

  const [scheduleLoading, setScheduleLoading] =
    useState(true);

  const [resultsLoading, setResultsLoading] =
    useState(false);

  const [scheduleError, setScheduleError] =
    useState(false);

  const [judeStatuses, setJudeStatuses] =
    useState({});

  /* =========================================================
     POPUP
  ========================================================= */

  const [popup, setPopup] =
    useState(null);

  /* =========================================================
     NOTIFICATIONS
  ========================================================= */

  const [notificationsOn, setNotificationsOn] =
    useState(
      localStorage.getItem(
        "belliGoalNotifications"
      ) === "true"
    );

  /* =========================================================
     LINKS
  ========================================================= */

  const defaultLinks = [
    {
      name: "MATCH CENTER",
      url:
        "https://www.realmadrid.com/",
    },

    {
      name: "OFFICIAL WEBSITE",
      url:
        "https://www.realmadrid.com/",
    },

    {
      name: "TEAM NEWS",
      url:
        "https://www.realmadrid.com/news",
    },
  ];

  const [gameLinks, setGameLinks] =
    useState(() => {
      const saved =
        localStorage.getItem(
          "belliGoalLinks"
        );

      if (!saved) {
        return defaultLinks;
      }

      try {
        const parsed =
          JSON.parse(saved);

        /*
          Keep the saved links exactly as they
          are in this browser.

          We do NOT overwrite them.
        */

        if (
          Array.isArray(parsed) &&
          parsed.length > 0
        ) {
          return parsed;
        }

        return defaultLinks;
      } catch {
        return defaultLinks;
      }
    });

  const [editingLinks, setEditingLinks] =
    useState(gameLinks);

  /* =========================================================
     LOAD UPCOMING
     
     IMPORTANT:
     The backend already has:
       GET /api/upcoming

     This returns BOTH:
       realMadrid
       england
  ========================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadUpcoming() {
      try {
        setScheduleLoading(true);
        setScheduleError(false);

        const response =
          await fetch(
            `${API_BASE}/api/upcoming`
          );

        console.log(
          "UPCOMING RESPONSE:",
          response.status,
          response.url
        );

        if (!response.ok) {
          throw new Error(
            `/api/upcoming returned ${response.status}`
          );
        }

        const data =
          await response.json();

        console.log(
          "✅ UPCOMING DATA:",
          data
        );

        if (cancelled) {
          return;
        }

        const safeRMA = {
          team:
            "Real Madrid",

          events:
            Array.isArray(
              data?.realMadrid?.events
            )
              ? data.realMadrid.events
              : [],
        };

        const safeEngland = {
          team:
            "England",

          events:
            Array.isArray(
              data?.england?.events
            )
              ? data.england.events
              : [],
        };

        setUpcomingMatches({
          realMadrid:
            safeRMA,

          england:
            safeEngland,
        });

        const totalEvents =
          safeRMA.events.length +
          safeEngland.events.length;

        setScheduleError(
          totalEvents === 0
        );

        setScheduleLoading(false);

        console.log(
          "⚪ REAL MADRID UPCOMING:",
          safeRMA.events.length
        );

        console.log(
          "🏴 ENGLAND UPCOMING:",
          safeEngland.events.length
        );
      } catch (error) {
        console.error(
          "❌ UPCOMING LOAD FAILED:",
          error
        );

        if (!cancelled) {
          setScheduleLoading(false);
          setScheduleError(true);
        }
      }
    }

    loadUpcoming();

    const interval =
      setInterval(
        loadUpcoming,
        5 * 60 * 1000
      );

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  /* =========================================================
     COMPLETED RESULTS

     GET /api/results
     Returns { realMadrid, england } with finished matches
     (newest first). These feed the Stats popup.
  ========================================================= */

  useEffect(() => {
    let cancelled = false;

    async function loadResults() {
      try {
        setResultsLoading(true);

        const response =
          await fetch(
            `${API_BASE}/api/results`
          );

        if (!response.ok) {
          throw new Error(
            `/api/results returned ${response.status}`
          );
        }

        const data =
          await response.json();

        if (cancelled) {
          return;
        }

        setCompletedMatches({
          realMadrid: {
            team:
              "Real Madrid",

            events:
              Array.isArray(
                data?.realMadrid
                  ?.events
              )
                ? data.realMadrid
                    .events
                : [],
          },

          england: {
            team:
              "England",

            events:
              Array.isArray(
                data?.england
                  ?.events
              )
                ? data.england
                    .events
                : [],
          },
        });
      } catch (error) {
        console.error(
          "❌ RESULTS LOAD FAILED:",
          error
        );
      } finally {
        if (!cancelled) {
          setResultsLoading(
            false
          );
        }
      }
    }

    loadResults();

    const interval =
      setInterval(
        loadResults,
        5 * 60 * 1000
      );

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  /* =========================================================
     COMBINE UPCOMING MATCHES
  ========================================================= */

  const allUpcomingMatches =
    useMemo(() => {
      const matches = [];

      const rma =
        upcomingMatches
          ?.realMadrid
          ?.events || [];

      const england =
        upcomingMatches
          ?.england
          ?.events || [];

      /*
        Real Madrid
      */

      rma.forEach(
        (event) => {
          if (
            !event?.id ||
            !event?.date
          ) {
            return;
          }

          const kickoff =
            new Date(
              event.date
            ).getTime();

          /*
            SECOND SAFETY CHECK:

            Never show an old match.
          */

          if (
            !Number.isFinite(
              kickoff
            ) ||
            kickoff <=
              Date.now()
          ) {
            return;
          }

          matches.push({
            event,

            team:
              "Real Madrid",

            teamId:
              RMA_TEAM_ID,

            logo:
              "/rma.png",
          });
        }
      );

      /*
        England
      */

      england.forEach(
        (event) => {
          if (
            !event?.id ||
            !event?.date
          ) {
            return;
          }

          const kickoff =
            new Date(
              event.date
            ).getTime();

          if (
            !Number.isFinite(
              kickoff
            ) ||
            kickoff <=
              Date.now()
          ) {
            return;
          }

          matches.push({
            event,

            team:
              "England",

            teamId:
              ENGLAND_TEAM_ID,

            /*
              FIXED FILE NAME:
              3lions.png
            */

            logo:
              "/3lions.png",
          });
        }
      );

      /*
        Remove duplicate ESPN IDs.
      */

      const unique =
        new Map();

      matches.forEach(
        (match) => {
          unique.set(
            String(
              match.event.id
            ),
            match
          );
        }
      );

      /*
        Sort earliest → latest.
      */

      return Array.from(
        unique.values()
      ).sort(
        (a, b) =>
          new Date(
            a.event.date
          ).getTime() -
          new Date(
            b.event.date
          ).getTime()
      );
    }, [
      upcomingMatches,
    ]);

  /* =========================================================
     COMBINE COMPLETED MATCHES
  ========================================================= */

  const allCompletedMatches =
    useMemo(() => {
      const matches = [];

      const rma =
        completedMatches
          ?.realMadrid
          ?.events || [];

      const england =
        completedMatches
          ?.england
          ?.events || [];

      rma.forEach(
        (event) => {
          if (!event?.id) {
            return;
          }

          matches.push({
            event,

            team:
              "Real Madrid",

            teamId:
              RMA_TEAM_ID,

            logo:
              "/rma.png",
          });
        }
      );

      england.forEach(
        (event) => {
          if (!event?.id) {
            return;
          }

          matches.push({
            event,

            team:
              "England",

            teamId:
              ENGLAND_TEAM_ID,

            logo:
              "/3lions.png",
          });
        }
      );

      const unique =
        new Map();

      matches.forEach(
        (match) => {
          unique.set(
            String(
              match.event.id
            ),
            match
          );
        }
      );

      /*
        Most recent completed match first.
      */

      return Array.from(
        unique.values()
      ).sort(
        (a, b) =>
          new Date(
            b.event.date
          ).getTime() -
          new Date(
            a.event.date
          ).getTime()
      );
    }, [
      completedMatches,
    ]);

  /* =========================================================
     MATCH INFO
  ========================================================= */

  const getMatchInfo =
    (match) => {
      const event =
        match?.event;

      if (!event) {
        return {
          opponent:
            "Opponent",

          homeAway:
            "",

          date:
            "DATE UNAVAILABLE",

          time:
            "TIME UNAVAILABLE",

          status:
            "SCHEDULED",

          eventId:
            null,

          homeTeam:
            null,

          awayTeam:
            null,
        };
      }

      const competitors =
        event
          ?.competitions?.[0]
          ?.competitors ||
        [];

      const team =
        competitors.find(
          (item) =>
            String(
              item?.team?.id
            ) ===
            String(
              match.teamId
            )
        );

      const opponent =
        competitors.find(
          (item) =>
            String(
              item?.team?.id
            ) !==
            String(
              match.teamId
            )
        );

      const homeTeam =
        competitors.find(
          (item) =>
            item?.homeAway ===
            "home"
        );

      const awayTeam =
        competitors.find(
          (item) =>
            item?.homeAway ===
            "away"
        );

      return {
        opponent:
          opponent
            ?.team
            ?.displayName ||
          opponent
            ?.team
            ?.shortDisplayName ||
          "Opponent",

        homeAway:
          team?.homeAway ===
          "home"
            ? "HOME"
            : "AWAY",

        date:
          formatMatchDate(
            event.date
          ),

        time:
          formatMatchTime(
            event.date
          ),

        status:
          (
            event?.status ||
            event
              ?.competitions?.[0]
              ?.status
          )?.type
            ?.shortDetail ||
          (
            event?.status ||
            event
              ?.competitions?.[0]
              ?.status
          )?.type
            ?.detail ||
          "SCHEDULED",

        eventId:
          String(
            event.id
          ),

        homeTeam:
          homeTeam ||
          null,

        awayTeam:
          awayTeam ||
          null,
      };
    };

  /* =========================================================
     JUDE STATUS
  ========================================================= */

  useEffect(() => {
    if (
      allUpcomingMatches.length ===
      0
    ) {
      return;
    }

    let cancelled = false;

    async function checkStatuses() {
      const updates = {};

      await Promise.all(
        allUpcomingMatches.map(
          async (match) => {
            const event =
              match.event;

            const eventId =
              event?.id;

            if (!eventId) {
              return;
            }

            const kickoff =
              new Date(
                event.date
              ).getTime();

            const hoursAway =
              (
                kickoff -
                Date.now()
              ) /
              (1000 * 60 * 60);

            /*
              Don't check lineups
              days before kickoff.
            */

            if (
              !Number.isFinite(
                hoursAway
              ) ||
              hoursAway > 72
            ) {
              updates[
                eventId
              ] =
                "not_announced";

              return;
            }

            if (
              hoursAway < 0
            ) {
              return;
            }

            try {
              const response =
                await fetch(
                  `${API_BASE}/api/bellingham/status/${eventId}`
                );

              if (!response.ok) {
                updates[
                  eventId
                ] =
                  "not_announced";

                return;
              }

              const data =
                await response.json();

              updates[
                eventId
              ] =
                data.status ||
                "not_announced";
            } catch {
              updates[
                eventId
              ] =
                "not_announced";
            }
          }
        )
      );

      if (!cancelled) {
        setJudeStatuses(
          updates
        );
      }
    }

    checkStatuses();

    const interval =
      setInterval(
        checkStatuses,
        5 * 60 * 1000
      );

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [
    allUpcomingMatches,
  ]);

  /* =========================================================
     GROUP UPCOMING BY DATE
  ========================================================= */

  const upcomingGroups =
    useMemo(() => {
      const groups = {};

      allUpcomingMatches.forEach(
        (match) => {
          const key =
            getDateKey(
              match.event.date
            );

          if (!groups[key]) {
            groups[key] = [];
          }

          groups[key].push(
            match
          );
        }
      );

      return groups;
    }, [
      allUpcomingMatches,
    ]);

  const upcomingDateKeys =
    Object.keys(
      upcomingGroups
    ).sort();

  /* =========================================================
     GROUP COMPLETED BY DATE
  ========================================================= */

  const completedGroups =
    useMemo(() => {
      const groups = {};

      allCompletedMatches.forEach(
        (match) => {
          const key =
            getDateKey(
              match.event.date
            );

          if (!groups[key]) {
            groups[key] = [];
          }

          groups[key].push(
            match
          );
        }
      );

      return groups;
    }, [
      allCompletedMatches,
    ]);

  const completedDateKeys =
    Object.keys(
      completedGroups
    ).sort(
      (a, b) =>
        b.localeCompare(a)
    );

  /* =========================================================
     NOTIFICATION HELPERS
  ========================================================= */

  const urlBase64ToUint8Array =
    (base64String) => {
      const padding =
        "=".repeat(
          (
            4 -
            (
              base64String.length %
              4
            )
          ) % 4
        );

      const base64 =
        (
          base64String +
          padding
        )
          .replace(
            /-/g,
            "+"
          )
          .replace(
            /_/g,
            "/"
          );

      const rawData =
        window.atob(
          base64
        );

      return Uint8Array.from(
        [...rawData].map(
          (char) =>
            char.charCodeAt(
              0
            )
        )
      );
    };

  /* =========================================================
     ENABLE NOTIFICATIONS
  ========================================================= */

  const enableNotifications =
    async () => {
      try {
        if (
          !(
            "serviceWorker" in
            navigator
          )
        ) {
          alert(
            "Service workers are not supported by this browser."
          );

          return;
        }

        if (
          !(
            "PushManager" in
            window
          )
        ) {
          alert(
            "Push notifications are not supported by this browser."
          );

          return;
        }

        const permission =
          await Notification.requestPermission();

        if (
          permission !==
          "granted"
        ) {
          alert(
            "BelliGoal needs notification permission."
          );

          return;
        }

        const registration =
          await navigator.serviceWorker.register(
            "/sw.js"
          );

        const keyResponse =
          await fetch(
            `${API_BASE}/api/notifications/public-key`
          );

        if (
          !keyResponse.ok
        ) {
          throw new Error(
            "Could not get VAPID public key"
          );
        }

        const keyData =
          await keyResponse.json();

        let subscription =
          await registration
            .pushManager
            .getSubscription();

        if (
          !subscription
        ) {
          subscription =
            await registration
              .pushManager
              .subscribe({
                userVisibleOnly:
                  true,

                applicationServerKey:
                  urlBase64ToUint8Array(
                    keyData.publicKey
                  ),
              });
        }

        const saveResponse =
          await fetch(
            `${API_BASE}/api/notifications/subscribe`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify(
                  subscription
                ),
            }
          );

        if (
          !saveResponse.ok
        ) {
          throw new Error(
            "Could not save push subscription"
          );
        }

        setNotificationsOn(
          true
        );

        localStorage.setItem(
          "belliGoalNotifications",
          "true"
        );

        alert(
          "🔔 Notifications are ON!\n\nYou'll get a reminder about 1 hour before a match."
        );
      } catch (error) {
        console.error(
          "Notification error:",
          error
        );

        alert(
          "Could not enable notifications."
        );
      }
    };

  /* =========================================================
     DISABLE NOTIFICATIONS
  ========================================================= */

  const disableNotifications =
    async () => {
      try {
        const registration =
          await navigator.serviceWorker
            .getRegistration();

        const subscription =
          await registration
            ?.pushManager
            .getSubscription();

        if (
          subscription
        ) {
          await fetch(
            `${API_BASE}/api/notifications/unsubscribe`,
            {
              method:
                "POST",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body:
                JSON.stringify({
                  endpoint:
                    subscription.endpoint,
                }),
            }
          );

          await subscription.unsubscribe();
        }
      } catch (error) {
        console.error(
          "Disable notifications error:",
          error
        );
      }

      setNotificationsOn(
        false
      );

      localStorage.setItem(
        "belliGoalNotifications",
        "false"
      );
    };

  /* =========================================================
     TOGGLE NOTIFICATIONS
  ========================================================= */

  const toggleNotifications =
    async () => {
      if (
        notificationsOn
      ) {
        await disableNotifications();
      } else {
        await enableNotifications();
      }
    };

  /* =========================================================
     LINK FUNCTIONS
  ========================================================= */

  const updateLinkName =
    (
      index,
      value
    ) => {
      const updated =
        [...editingLinks];

      updated[index] = {
        ...updated[index],

        name:
          value,
      };

      setEditingLinks(
        updated
      );
    };

  const updateLinkUrl =
    (
      index,
      value
    ) => {
      const updated =
        [...editingLinks];

      updated[index] = {
        ...updated[index],

        url:
          value,
      };

      setEditingLinks(
        updated
      );
    };

  const saveLinks =
    () => {
      setGameLinks(
        editingLinks
      );

      localStorage.setItem(
        "belliGoalLinks",
        JSON.stringify(
          editingLinks
        )
      );

      alert(
        "✅ Game links saved."
      );
    };

  const openLink =
    (url) => {
      if (!url) {
        return;
      }

      let finalUrl =
        url.trim();

      if (
        !finalUrl.startsWith(
          "http://"
        ) &&
        !finalUrl.startsWith(
          "https://"
        )
      ) {
        finalUrl =
          "https://" +
          finalUrl;
      }

      window.open(
        finalUrl,
        "_blank"
      );
    };

  /* =========================================================
     STATUS
  ========================================================= */

  const getJudeStatus =
    (eventId) =>
      judeStatuses[
        eventId
      ] ||
      "not_announced";

  const formatJudeStatus =
    (status) => {
      if (
        status ===
        "starting"
      ) {
        return "JUDE — STARTING XI";
      }

      if (
        status ===
        "not_starting"
      ) {
        return "JUDE — NOT STARTING";
      }

      return "JUDE — NOT ANNOUNCED";
    };

  const getStatusStyle =
    (status) => {
      if (
        status ===
        "starting"
      ) {
        return {
          background:
            "rgba(80, 200, 120, 0.18)",

          border:
            "2px solid rgba(80, 200, 120, 0.50)",

          color:
            "#ffffff",
        };
      }

      if (
        status ===
        "not_starting"
      ) {
        return {
          background:
            "rgba(255, 80, 100, 0.18)",

          border:
            "2px solid rgba(255, 80, 100, 0.50)",

          color:
            "#ffffff",
        };
      }

      return {
        background:
          "rgba(255, 255, 255, 0.10)",

        border:
          "2px solid rgba(255, 255, 255, 0.30)",

        color:
          "#ffffff",
      };
    };

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="app">

      {/* =====================================================
          COLLAGE DECORATIONS (desktop only, see collage.css)
      ===================================================== */}

      <div className="collage" aria-hidden="true">
        <span className="star" style={{ width: "26px", height: "20px", left: "5%", top: "7%" }} />
        <span className="star" style={{ width: "18px", height: "18px", left: "8.5%", top: "4%" }} />
        <span className="star" style={{ width: "22px", height: "22px", left: "3%", top: "16%" }} />
        <span className="star wine" style={{ width: "16px", height: "16px", left: "92%", top: "15%" }} />
        <span className="star" style={{ width: "20px", height: "20px", left: "95%", top: "22%" }} />
        <span className="star" style={{ width: "24px", height: "24px", left: "88%", top: "86%" }} />
        <span className="star wine" style={{ width: "16px", height: "16px", left: "60%", top: "9%" }} />
        <span className="star" style={{ width: "18px", height: "18px", left: "40%", top: "88%" }} />

        <div className="beads">
          <span>J</span><span>U</span><span>D</span><span>E</span>
          <span className="gap" />
          <span>♡</span>
        </div>

        {(() => {
          const next = allUpcomingMatches[0];

          if (!next) {
            return null;
          }

          const info = getMatchInfo(next);

          return (
            <div className="stat-pill pill-left">
              <div>
                <small>Next match</small>
                <b>{next.team}</b>
              </div>

              <div>
                <small>vs</small>
                <b>{info.opponent}</b>
              </div>

              <div>
                <small>{info.date}</small>
                <b>{info.time}</b>
              </div>
            </div>
          );
        })()}

        <div className="stat-pill pill-right">
          <div>
            <small>Real Madrid</small>
            <b>
              {upcomingMatches?.realMadrid?.events?.length || 0} fixtures
            </b>
          </div>

          <div>
            <small>England</small>
            <b>
              {upcomingMatches?.england?.events?.length || 0} fixtures
            </b>
          </div>
        </div>

        <span className="corner-note left">@BELLIGOAL</span>
        <span className="corner-note right">MATCHDAY TRACKER</span>
      </div>

      {/* =====================================================
          TITLE
      ===================================================== */}

      <header className="title">
        <span className="title-word">
          Belli
        </span>

        <span className="title-word">
          goal
        </span>
      </header>

      {/* =====================================================
          JUDE
      ===================================================== */}

      <div
        className="title-jude"
        style={{
          pointerEvents:
            "none",

          zIndex:
            0,
        }}
      >
        <picture>
          <source
            media="(max-width: 700px)"
            srcSet="/jude-mobile.png"
          />

          <img
            src="/jude.png"
            alt="Jude Bellingham"
          />
        </picture>
      </div>

      {/* =====================================================
          GAME
      ===================================================== */}

      <button
        className="crystal-button game-button"
        style={{
          zIndex:
            20,
        }}
        onClick={() =>
          setPopup("game")
        }
      >
        <span
          style={{
            fontSize:
              "27px",

            lineHeight:
              1,
          }}
        >
          
        </span>

        GAME
      </button>

      {/* =====================================================
          STATS
      ===================================================== */}

      <button
        className="crystal-button stats-button"
        style={{
          zIndex:
            20,
        }}
        onClick={() =>
          setPopup("stats")
        }
      >
        <BarChart3
          size={24}
        />

        STATS
      </button>

      {/* =====================================================
          SETTINGS
      ===================================================== */}

      <button
        className="crystal-button settings-button"
        style={{
          zIndex:
            20,
        }}
        onClick={() =>
          setPopup("settings")
        }
      >
        <Settings
          size={24}
        />

        SETTINGS
      </button>

      {/* =====================================================
          BELL
      ===================================================== */}

      <button
        className={`bell-button ${
          notificationsOn
            ? "notifications-on"
            : ""
        }`}
        style={{
          zIndex:
            25,
        }}
        onClick={
          toggleNotifications
        }
        aria-label={
          notificationsOn
            ? "Disable notifications"
            : "Enable notifications"
        }
      >
        <Bell
          size={27}
        />

        {notificationsOn && (
          <span className="notification-dot"></span>
        )}
      </button>

      {/* =====================================================
          POPUP
      ===================================================== */}

      {popup && (
        <div
          className="popup-overlay"
          style={{
            zIndex:
              100,
          }}
          onClick={() =>
            setPopup(null)
          }
        >
          <div
            className="popup"
            onClick={(e) =>
              e.stopPropagation()
            }
          >

            {/* CLOSE */}

            <button
              className="close-button"
              onClick={() =>
                setPopup(null)
              }
              aria-label="Close"
            >
              <X
                size={24}
              />
            </button>

            <div className="popup-content">

              {/* =================================================
                  GAME
              ================================================= */}

              {popup ===
                "game" && (
                <>

                  <div
                    style={{
                      textAlign:
                        "center",

                      marginBottom:
                        "20px",
                    }}
                  >

                    <div
                      className="popup-icon"
                      style={{
                        margin:
                          "0 auto 15px",
                      }}
                    >
                      <span
                        style={{
                          fontSize:
                            "34px",
                        }}
                      >
                        ⚽
                      </span>
                    </div>

                    <p className="popup-label">
                      BELLI GOAL
                    </p>

                    <h2>
                      Upcoming Matches
                    </h2>

                    <p className="popup-description">
                      Every upcoming Real Madrid
                      and England fixture currently
                      available from ESPN.
                    </p>

                  </div>

                  {/* GAME LINKS */}

                  <div
                    className="settings-section"
                    style={{
                      marginTop:
                        0,

                      marginBottom:
                        "28px",
                    }}
                  >

                    <div className="settings-section-title">

                      <Link
                        size={22}
                      />

                      <div>

                        <strong>
                          GAME LINKS
                        </strong>

                        <span>
                          Quick access to your
                          saved football websites.
                        </span>

                      </div>

                    </div>

                    <div
                      className="game-links"
                      style={{
                        marginTop:
                          "12px",
                      }}
                    >

                      {gameLinks.map(
                        (
                          link,
                          index
                        ) => (
                          <button
                            key={
                              index
                            }
                            className="game-link-button"
                            onClick={() =>
                              openLink(
                                link.url
                              )
                            }
                          >
                            <ExternalLink
                              size={
                                19
                              }
                            />

                            <span>
                              {link.name ||
                                `LINK ${
                                  index +
                                  1
                                }`}
                            </span>
                          </button>
                        )
                      )}

                    </div>
                  </div>

                  {/* =================================================
                      LOADING
                  ================================================= */}

                  {scheduleLoading && (
                    <div
                      style={{
                        textAlign:
                          "center",

                        padding:
                          "30px 10px",

                        fontFamily:
                          "Arial, Helvetica, sans-serif",

                        fontWeight:
                          900,

                        color:
                          "#ffffff",
                      }}
                    >
                      LOADING MATCHES...
                    </div>
                  )}

                  {/* =================================================
                      ERROR
                  ================================================= */}

                  {!scheduleLoading &&
                    scheduleError &&
                    allUpcomingMatches.length ===
                      0 && (
                    <div
                      style={{
                        textAlign:
                          "center",

                        padding:
                          "30px 10px",

                        fontFamily:
                          "Arial, Helvetica, sans-serif",

                        fontWeight:
                          900,

                        color:
                          "#ffffff",
                      }}
                    >
                      COULD NOT LOAD UPCOMING MATCHES

                      <div
                        style={{
                          marginTop:
                            "8px",

                          fontSize:
                            "12px",

                          fontWeight:
                            700,

                          opacity:
                            0.85,
                        }}
                      >
                        Is the backend running?
                        (npm run server)
                      </div>
                    </div>
                  )}

                  {/* =================================================
                      NO MATCHES
                  ================================================= */}

                  {!scheduleLoading &&
                    !scheduleError &&
                    allUpcomingMatches.length ===
                      0 && (
                    <div
                      style={{
                        textAlign:
                          "center",

                        padding:
                          "30px 10px",

                        fontFamily:
                          "Arial, Helvetica, sans-serif",

                        fontWeight:
                          900,

                        color:
                          "#ffffff",
                      }}
                    >
                      NO UPCOMING MATCHES
                    </div>
                  )}

                  {/* =================================================
                      MATCH LIST
                  ================================================= */}

                  {!scheduleLoading &&
                    upcomingDateKeys.map(
                      (
                        dateKey
                      ) => (
                        <div
                          key={
                            dateKey
                          }
                          style={{
                            marginBottom:
                              "24px",
                          }}
                        >

                          {/* DATE */}

                          <div
                            style={{
                              marginBottom:
                                "10px",

                              fontFamily:
                                "Arial, Helvetica, sans-serif",

                              fontWeight:
                                900,

                              fontSize:
                                "18px",

                              letterSpacing:
                                "0.7px",

                              color:
                                "#ffffff",
                            }}
                          >
                            {formatDateHeader(
                              upcomingGroups[
                                dateKey
                              ][0]
                                ?.event
                                ?.date
                            )}
                          </div>

                          {/* MATCHES */}

                          <div
                            style={{
                              display:
                                "flex",

                              flexDirection:
                                "column",

                              gap:
                                "12px",
                            }}
                          >

                            {upcomingGroups[
                              dateKey
                            ].map(
                              (
                                match
                              ) => {
                                const info =
                                  getMatchInfo(
                                    match
                                  );

                                const judeStatus =
                                  getJudeStatus(
                                    info.eventId
                                  );

                                return (
                                  <div
                                    key={
                                      info.eventId
                                    }
                                    style={{
                                      border:
                                        "1px solid rgba(255,255,255,0.35)",

                                      borderRadius:
                                        "18px",

                                      background:
                                        "rgba(255,255,255,0.09)",

                                      padding:
                                        "16px",

                                      boxShadow:
                                        "0 8px 25px rgba(90,30,55,0.10)",
                                    }}
                                  >

                                    {/* JUDE */}

                                    <div
                                      style={{
                                        ...getStatusStyle(
                                          judeStatus
                                        ),

                                        width:
                                          "100%",

                                        padding:
                                          "9px 12px",

                                        borderRadius:
                                          "12px",

                                        textAlign:
                                          "center",

                                        fontFamily:
                                          "Arial, Helvetica, sans-serif",

                                        fontWeight:
                                          900,

                                        fontSize:
                                          "14px",

                                        letterSpacing:
                                          "0.4px",

                                        marginBottom:
                                          "15px",

                                        boxSizing:
                                          "border-box",
                                      }}
                                    >
                                      {formatJudeStatus(
                                        judeStatus
                                      )}
                                    </div>

                                    {/* MATCH */}

                                    <div
                                      style={{
                                        display:
                                          "grid",

                                        gridTemplateColumns:
                                          "0.7fr 1fr 0.7fr",

                                        alignItems:
                                          "center",

                                        gap:
                                          "10px",
                                      }}
                                    >

                                      {/* OWN TEAM */}

                                      <div
                                        style={{
                                          display:
                                            "flex",

                                          flexDirection:
                                            "column",

                                          alignItems:
                                            "center",

                                          textAlign:
                                            "center",
                                        }}
                                      >

                                        <img
                                          src={
                                            match.logo
                                          }
                                          alt=""
                                          style={{
                                            width:
                                              "70px",

                                            height:
                                              "70px",

                                            objectFit:
                                              "contain",

                                            display:
                                              "block",
                                          }}
                                        />

                                        <span
                                          style={{
                                            marginTop:
                                              "6px",

                                            fontFamily:
                                              "Arial, Helvetica, sans-serif",

                                            fontSize:
                                              "11px",

                                            fontWeight:
                                              800,

                                            color:
                                              "rgba(255,255,255,0.85)",
                                          }}
                                        >
                                          {
                                            info.homeAway
                                          }
                                        </span>

                                      </div>

                                      {/* CENTER */}

                                      <div
                                        style={{
                                          textAlign:
                                            "center",

                                          color:
                                            "#ffffff",

                                          fontFamily:
                                            "Arial, Helvetica, sans-serif",
                                        }}
                                      >

                                        <div
                                          style={{
                                            fontSize:
                                              "19px",

                                            fontWeight:
                                              900,

                                            marginBottom:
                                              "4px",
                                          }}
                                        >
                                          VS
                                        </div>

                                        <div
                                          style={{
                                            fontSize:
                                              "17px",

                                            fontWeight:
                                              900,

                                            marginBottom:
                                              "6px",
                                          }}
                                        >
                                          {
                                            info.opponent
                                          }
                                        </div>

                                        <div
                                          style={{
                                            fontSize:
                                              "14px",

                                            fontWeight:
                                              800,

                                            marginBottom:
                                              "4px",
                                          }}
                                        >
                                          {
                                            info.time
                                          }
                                        </div>

                                        <div
                                          style={{
                                            fontSize:
                                              "11px",

                                            opacity:
                                              0.78,

                                            fontWeight:
                                              700,
                                          }}
                                        >
                                          SCHEDULED
                                        </div>

                                      </div>

                                      {/* OPPONENT */}

                                      <div
                                        style={{
                                          display:
                                            "flex",

                                          alignItems:
                                            "center",

                                          justifyContent:
                                            "center",
                                        }}
                                      >

                                        <div
                                          style={{
                                            width:
                                              "62px",

                                            height:
                                              "62px",

                                            borderRadius:
                                              "50%",

                                            display:
                                              "flex",

                                            alignItems:
                                              "center",

                                            justifyContent:
                                              "center",

                                            background:
                                              "rgba(255,255,255,0.10)",

                                            fontSize:
                                              "27px",
                                          }}
                                        >
                                          ⚽
                                        </div>

                                      </div>

                                    </div>

                                  </div>
                                );
                              }
                            )}

                          </div>

                        </div>
                      )
                    )}

                </>
              )}

              {/* =================================================
                  STATS
              ================================================= */}

              {popup ===
                "stats" && (
                <>

                  <div
                    style={{
                      textAlign:
                        "center",

                      marginBottom:
                        "22px",
                    }}
                  >

                    <div
                      className="popup-icon"
                      style={{
                        margin:
                          "0 auto 15px",
                      }}
                    >
                      <BarChart3
                        size={
                          32
                        }
                      />
                    </div>

                    <p className="popup-label">
                      MATCH RESULTS
                    </p>

                    <h2>
                      Stats
                    </h2>

                    <p className="popup-description">
                      Completed matches and
                      final scores.
                    </p>

                  </div>

                  {resultsLoading && (
                    <div
                      style={{
                        textAlign:
                          "center",

                        padding:
                          "30px",

                        fontFamily:
                          "Arial, Helvetica, sans-serif",

                        fontWeight:
                          900,

                        color:
                          "#ffffff",
                      }}
                    >
                      LOADING RESULTS...
                    </div>
                  )}

                  {!resultsLoading &&
                    allCompletedMatches.length ===
                      0 && (
                    <div
                      style={{
                        textAlign:
                          "center",

                        padding:
                          "30px",

                        fontFamily:
                          "Arial, Helvetica, sans-serif",

                        fontWeight:
                          900,

                        color:
                          "#ffffff",
                      }}
                    >
                      NO COMPLETED MATCHES
                    </div>
                  )}

                  {!resultsLoading &&
                    completedDateKeys.map(
                      (
                        dateKey
                      ) => (
                        <div
                          key={
                            dateKey
                          }
                          style={{
                            marginBottom:
                              "22px",
                          }}
                        >

                          <div
                            style={{
                              marginBottom:
                                "10px",

                              fontFamily:
                                "Arial, Helvetica, sans-serif",

                              fontWeight:
                                900,

                              fontSize:
                                "18px",

                              letterSpacing:
                                "0.7px",

                              color:
                                "#ffffff",
                            }}
                          >
                            {formatDateHeader(
                              completedGroups[
                                dateKey
                              ][0]
                                ?.event
                                ?.date
                            )}
                          </div>

                          <div
                            style={{
                              display:
                                "flex",

                              flexDirection:
                                "column",

                              gap:
                                "12px",
                            }}
                          >

                            {completedGroups[
                              dateKey
                            ].map(
                              (
                                match
                              ) => {
                                const info =
                                  getMatchInfo(
                                    match
                                  );

                                const teamScore =
                                  getTeamScore(
                                    match,
                                    info
                                  );

                                const opponentScore =
                                  getOpponentScore(
                                    match,
                                    info
                                  );

                                return (
                                  <div
                                    key={
                                      info.eventId
                                    }
                                    style={{
                                      display:
                                        "grid",

                                      gridTemplateColumns:
                                        "70px 1fr auto",

                                      alignItems:
                                        "center",

                                      gap:
                                        "15px",

                                      padding:
                                        "16px",

                                      border:
                                        "1px solid rgba(255,255,255,0.35)",

                                      borderRadius:
                                        "18px",

                                      background:
                                        "rgba(255,255,255,0.09)",
                                    }}
                                  >

                                    <img
                                      src={
                                        match.logo
                                      }
                                      alt=""
                                      style={{
                                        width:
                                          "62px",

                                        height:
                                          "62px",

                                        objectFit:
                                          "contain",
                                      }}
                                    />

                                    <div
                                      style={{
                                        fontFamily:
                                          "Arial, Helvetica, sans-serif",

                                        color:
                                          "#ffffff",
                                      }}
                                    >

                                      <div
                                        style={{
                                          fontSize:
                                            "16px",

                                          fontWeight:
                                            900,

                                          marginBottom:
                                            "5px",
                                        }}
                                      >
                                        VS{" "}
                                        {
                                          info.opponent
                                        }
                                      </div>

                                      <div
                                        style={{
                                          fontSize:
                                            "12px",

                                          fontWeight:
                                            600,

                                          opacity:
                                            0.78,

                                          marginBottom:
                                            "4px",
                                        }}
                                      >
                                        {
                                          info.date
                                        }
                                      </div>

                                      <div
                                        style={{
                                          fontSize:
                                            "11px",

                                          fontWeight:
                                            800,

                                          opacity:
                                            0.8,
                                        }}
                                      >
                                        FINAL
                                      </div>

                                    </div>

                                    <div
                                      style={{
                                        fontFamily:
                                          "Arial, Helvetica, sans-serif",

                                        fontSize:
                                          "28px",

                                        fontWeight:
                                          900,

                                        color:
                                          "#ffffff",

                                        minWidth:
                                          "70px",

                                        textAlign:
                                          "center",
                                      }}
                                    >
                                      {teamScore ??
                                        "-"}{" "}
                                      -{" "}
                                      {opponentScore ??
                                        "-"}
                                    </div>

                                  </div>
                                );
                              }
                            )}

                          </div>

                        </div>
                      )
                    )}

                </>
              )}

              {/* =================================================
                  SETTINGS
              ================================================= */}

              {popup ===
                "settings" && (
                <>

                  <div
                    style={{
                      textAlign:
                        "center",

                      marginBottom:
                        "20px",
                    }}
                  >

                    <div
                      className="popup-icon"
                      style={{
                        margin:
                          "0 auto 15px",
                      }}
                    >
                      <Settings
                        size={
                          32
                        }
                      />
                    </div>

                    <p className="popup-label">
                      APP SETTINGS
                    </p>

                    <h2>
                      Settings
                    </h2>

                    <p className="popup-description">
                      Customize your BelliGoal experience.
                    </p>

                  </div>

                  {/* NOTIFICATIONS */}

                  <div className="setting-row">

                    <div>

                      <strong>
                        Match Notifications
                      </strong>

                      <span>
                        Get a phone notification 1
                        hour before a Real Madrid or
                        England match.
                      </span>

                    </div>

                    <button
                      className={`toggle ${
                        notificationsOn
                          ? "toggle-on"
                          : ""
                      }`}
                      onClick={
                        toggleNotifications
                      }
                    >
                      {notificationsOn
                        ? "ON"
                        : "OFF"}
                    </button>

                  </div>

                  {/* LINKS */}

                  <div className="settings-section">

                    <div className="settings-section-title">

                      <Link
                        size={22}
                      />

                      <div>

                        <strong>
                          GAME LINKS
                        </strong>

                        <span>
                          Edit the links shown
                          above your matches.
                        </span>

                      </div>

                    </div>

                    {editingLinks.map(
                      (
                        link,
                        index
                      ) => (
                        <div
                          className="link-setting"
                          key={
                            index
                          }
                        >

                          <label>
                            BUTTON{" "}
                            {index +
                              1}
                          </label>

                          <input
                            type="text"
                            value={
                              link.name ||
                              ""
                            }
                            onChange={(e) =>
                              updateLinkName(
                                index,
                                e.target
                                  .value
                              )
                            }
                          />

                          <input
                            type="text"
                            value={
                              link.url ||
                              ""
                            }
                            onChange={(e) =>
                              updateLinkUrl(
                                index,
                                e.target
                                  .value
                              )
                            }
                          />

                        </div>
                      )
                    )}

                    <button
                      className="save-links-button"
                      onClick={
                        saveLinks
                      }
                    >
                      SAVE GAME LINKS
                    </button>

                  </div>

                </>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  );
}

/* =========================================================
   DATE
========================================================= */

function formatMatchDate(
  dateString
) {
  if (!dateString) {
    return "DATE UNAVAILABLE";
  }

  const date =
    new Date(
      dateString
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "DATE UNAVAILABLE";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone:
        "Asia/Manila",

      weekday:
        "short",

      month:
        "short",

      day:
        "numeric",

      year:
        "numeric",
    }
  ).format(date);
}

/* =========================================================
   TIME
========================================================= */

function formatMatchTime(
  dateString
) {
  if (!dateString) {
    return "TIME UNAVAILABLE";
  }

  const date =
    new Date(
      dateString
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "TIME UNAVAILABLE";
  }

  return (
    new Intl.DateTimeFormat(
      "en-PH",
      {
        timeZone:
          "Asia/Manila",

        hour:
          "numeric",

        minute:
          "2-digit",

        hour12:
          true,
      }
    ).format(date) +
    " PHT"
  );
}

/* =========================================================
   DATE KEY
========================================================= */

function getDateKey(
  dateString
) {
  if (!dateString) {
    return "unknown";
  }

  const date =
    new Date(
      dateString
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "unknown";
  }

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "Asia/Manila",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",
    }
  ).format(date);
}

/* =========================================================
   DATE HEADER
========================================================= */

function formatDateHeader(
  dateString
) {
  if (!dateString) {
    return "DATE UNAVAILABLE";
  }

  const date =
    new Date(
      dateString
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "DATE UNAVAILABLE";
  }

  return new Intl.DateTimeFormat(
    "en-PH",
    {
      timeZone:
        "Asia/Manila",

      weekday:
        "long",

      month:
        "long",

      day:
        "numeric",

      year:
        "numeric",
    }
  )
    .format(date)
    .toUpperCase();
}

/* =========================================================
   SCORE HELPERS
========================================================= */

function getScoreFromTeam(
  team
) {
  if (!team) {
    return null;
  }

  let score =
    team.score;

  /*
    ESPN's team schedule sends the score as an object:
    { value: 2, displayValue: "2" }
    The scoreboard sends a plain string.
  */

  if (
    score &&
    typeof score === "object"
  ) {
    score =
      score.displayValue ??
      score.value;
  }

  if (
    score === undefined ||
    score === null ||
    score === ""
  ) {
    return null;
  }

  const number =
    Number(score);

  return Number.isNaN(
    number
  )
    ? String(score)
    : number;
}

function getTeamScore(
  match,
  info
) {
  if (
    !info.homeTeam ||
    !info.awayTeam
  ) {
    return null;
  }

  const homeId =
    info.homeTeam?.team?.id ||
    info.homeTeam?.id;

  const isHome =
    String(homeId) ===
    String(match.teamId);

  return isHome
    ? getScoreFromTeam(
        info.homeTeam
      )
    : getScoreFromTeam(
        info.awayTeam
      );
}

function getOpponentScore(
  match,
  info
) {
  if (
    !info.homeTeam ||
    !info.awayTeam
  ) {
    return null;
  }

  const homeId =
    info.homeTeam?.team?.id ||
    info.homeTeam?.id;

  const isHome =
    String(homeId) ===
    String(match.teamId);

  return isHome
    ? getScoreFromTeam(
        info.awayTeam
      )
    : getScoreFromTeam(
        info.homeTeam
      );
}

/* =========================================================
   EXPORT
========================================================= */

export default App;