import { useEffect, useMemo, useRef, useState } from "react";

import {
  Bell,
  BarChart3,
  Settings,
  X,
  ExternalLink,
  Link,
  Volume2,
  VolumeX,
} from "lucide-react";

import "./index.css";
import "./Collage.css";

/*
  Empty = same origin. In dev, Vite proxies /api to the
  backend on :3001 (see vite.config.js), so this works from
  your PC *and* your phone. For a deployed build, set
  VITE_API_BASE in .env to the backend URL.
*/
const API_BASE =
  import.meta.env.DEV
    ? ""
    : import.meta.env.VITE_API_BASE ?? "";

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

  const [expandedStatsMatch, setExpandedStatsMatch] =
    useState(null);

  const [matchStatsByEvent, setMatchStatsByEvent] =
    useState({});

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

  const [reminderHours, setReminderHours] =
    useState(() => {
      try {
        const saved =
          JSON.parse(
            localStorage.getItem("belliGoalReminderHours")
          );

        if (Array.isArray(saved)) {
          return saved
            .map(Number)
            .filter((hour) => [1, 12, 24].includes(hour));
        }
      } catch {
        // Use the existing one-hour reminder by default.
      }

      return [1, 12, 24];
    });

  const [notificationSettingsError, setNotificationSettingsError] =
    useState("");

  const initialReminderSyncStarted =
    useRef(false);

  useEffect(() => {
    if (
      !notificationsOn ||
      initialReminderSyncStarted.current
    ) {
      return;
    }

    initialReminderSyncStarted.current = true;
    let cancelled = false;

    async function syncExistingSubscription() {
      try {
        const registration =
          await navigator.serviceWorker.getRegistration();

        const subscription =
          await registration?.pushManager.getSubscription();

        if (!subscription) {
          return;
        }

        const response =
          await fetch(
            `${API_BASE}/api/notifications/subscribe`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                subscription: subscription.toJSON(),
                reminderHours,
              }),
            }
          );

        if (!response.ok) {
          throw new Error("Could not sync reminder preferences");
        }
      } catch (error) {
        console.error(
          "Initial reminder preference sync failed:",
          error
        );

        if (!cancelled) {
          setNotificationSettingsError(
            "Could not sync these reminder times to your device."
          );
        }
      }
    }

    syncExistingSubscription();

    return () => {
      cancelled = true;
    };
  }, [
    notificationsOn,
    reminderHours,
  ]);

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

  /*
    RISING INTRO

    The "app" div starts without the "is-ready" class, so
    everything but the background is invisible/shifted down
    (see index.css). After a short pause we add the class,
    which CSS transitions turn into a staggered rise-and-fade.
  */

  const [isReady, setIsReady] =
    useState(false);

  useEffect(() => {
    const timer =
      setTimeout(() => {
        setIsReady(true);
      }, 350);

    return () => clearTimeout(timer);
  }, []);

  /* =========================================================
     BACKGROUND MUSIC

     Starts OFF (mobile browsers block autoplay-with-sound
     anyway, so there's no point trying). The button click
     itself counts as the "user gesture" that unlocks audio.
  ========================================================= */

  const audioRef =
    useRef(null);

  const [musicOn, setMusicOn] =
    useState(() => {
      return (
        localStorage.getItem(
          "belliGoalMusic"
        ) === "on"
      );
    });

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    if (musicOn) {
      audioRef.current
        .play()
        .catch((error) => {
          console.error(
            "Music play blocked:",
            error
          );
          setMusicOn(false);
        });
    } else {
      audioRef.current.pause();
    }

    localStorage.setItem(
      "belliGoalMusic",
      musicOn ? "on" : "off"
    );
  }, [musicOn]);

  const toggleMusic =
    () => {
      setMusicOn((current) => !current);
    };

  /*
    Pull the real, server-saved links on open. localStorage
    above just paints something instantly while this loads, so
    there's no blank flash.
  */

  useEffect(() => {
    (async () => {
      try {
        const response =
          await fetch(
            `${API_BASE}/api/game-links`
          );

        if (!response.ok) {
          return;
        }

        const data =
          await response.json();

        if (
          Array.isArray(data.links) &&
          data.links.length > 0
        ) {
          setGameLinks(data.links);
          setEditingLinks(data.links);

          localStorage.setItem(
            "belliGoalLinks",
            JSON.stringify(data.links)
          );
        }
      } catch (error) {
        console.error(
          "Could not load game links from server:",
          error
        );
        // Keep whatever localStorage/defaults already loaded.
      }
    })();
  }, []);

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

  const updateReminderHours =
    async (hour) => {
      const nextHours =
        reminderHours.includes(hour)
          ? reminderHours.filter((selectedHour) => selectedHour !== hour)
          : [...reminderHours, hour].sort((a, b) => a - b);

      setReminderHours(nextHours);
      localStorage.setItem(
        "belliGoalReminderHours",
        JSON.stringify(nextHours)
      );

      setNotificationSettingsError("");

      if (!notificationsOn) {
        return;
      }

      try {
        const registration =
          await navigator.serviceWorker.getRegistration();

        const subscription =
          await registration?.pushManager.getSubscription();

        if (!subscription) {
          throw new Error("No active push subscription");
        }

        const response =
          await fetch(
            `${API_BASE}/api/notifications/subscribe`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                subscription: subscription.toJSON(),
                reminderHours: nextHours,
              }),
            }
          );

        if (!response.ok) {
          throw new Error("Could not save reminder preferences");
        }
      } catch (error) {
        console.error(
          "Reminder preference save error:",
          error
        );

        setNotificationSettingsError(
          "Could not sync these reminder times to your device."
        );
      }
    };

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
                JSON.stringify({
                  subscription:
                    subscription.toJSON(),
                  reminderHours,
                }),
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

        setNotificationSettingsError("");

        localStorage.setItem(
          "belliGoalNotifications",
          "true"
        );

        alert(
          `🔔 Notifications are ON!\n\nMatch reminders: ${reminderHours.length ? reminderHours.map((hour) => `${hour} hour${hour === 1 ? "" : "s"}`).join(", ") : "off"}.`
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
    async () => {
      setGameLinks(
        editingLinks
      );

      localStorage.setItem(
        "belliGoalLinks",
        JSON.stringify(
          editingLinks
        )
      );

      try {
        const response =
          await fetch(
            `${API_BASE}/api/game-links`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                links: editingLinks,
              }),
            }
          );

        if (!response.ok) {
          throw new Error(
            "Server save failed"
          );
        }

        alert(
          "✅ Game links saved."
        );
      } catch (error) {
        console.error(
          "Game links save error:",
          error
        );

        alert(
          "⚠️ Saved on this device, but couldn't reach the server — it may not sync to other devices yet."
        );
      }
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

  const loadMatchStats =
    async (eventId) => {
      setMatchStatsByEvent((current) => ({
        ...current,
        [eventId]: {
          loading: true,
        },
      }));

      try {
        const response =
          await fetch(
            `${API_BASE}/api/bellingham/stats/${eventId}`
          );

        if (!response.ok) {
          throw new Error("Could not load match stats");
        }

        const data =
          await response.json();

        setMatchStatsByEvent((current) => ({
          ...current,
          [eventId]: {
            data,
          },
        }));
      } catch (error) {
        console.error(
          "Could not load Jude match stats:",
          error
        );

        setMatchStatsByEvent((current) => ({
          ...current,
          [eventId]: {
            error: true,
          },
        }));
      }
    };

  const toggleMatchStats =
    (eventId) => {
      if (expandedStatsMatch === eventId) {
        setExpandedStatsMatch(null);
        return;
      }

      setExpandedStatsMatch(eventId);

      if (!matchStatsByEvent[eventId]) {
        loadMatchStats(eventId);
      }
    };

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
    <div className={`app ${isReady ? "is-ready" : ""}`}>

      {/* =====================================================
          COLLAGE DECORATIONS (desktop only, see collage.css)
      ===================================================== */}

      <div className="collage rise-item rise-1" aria-hidden="true">
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

      <header className="title rise-item rise-2">
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
        className="title-jude rise-item rise-3"
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
        className="crystal-button game-button rise-item rise-4"
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
        className="crystal-button stats-button rise-item rise-4"
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
        className="crystal-button settings-button rise-item rise-4"
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
          BACKGROUND MUSIC
      ===================================================== */}

      <audio
        ref={audioRef}
        src="/moreno.mp3"
        loop
        preload="none"
      />

      <button
        className={`bell-button music-button ${
          musicOn ? "notifications-on" : ""
        }`}
        style={{
          zIndex: 25,
        }}
        onClick={toggleMusic}
        aria-label={
          musicOn ? "Turn music off" : "Turn music on"
        }
      >
        {musicOn ? (
          <Volume2 size={24} />
        ) : (
          <VolumeX size={24} />
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
            className={`popup ${popup === "stats" ? "stats-popup" : ""}`}
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

                                const matchReport =
                                  matchStatsByEvent[
                                    info.eventId
                                  ];

                                const matchStats =
                                  matchReport?.data;

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

                                    <button
                                      type="button"
                                      aria-expanded={
                                        expandedStatsMatch ===
                                        info.eventId
                                      }
                                      onClick={() =>
                                        toggleMatchStats(
                                          info.eventId
                                        )
                                      }
                                      style={{
                                        gridColumn:
                                          "1 / -1",
                                        display:
                                          "flex",
                                        alignItems:
                                          "center",
                                        justifyContent:
                                          "center",
                                        gap:
                                          "8px",
                                        width:
                                          "100%",
                                        padding:
                                          "10px",
                                        border:
                                          "1px solid rgba(255,255,255,0.28)",
                                        borderRadius:
                                          "8px",
                                        background:
                                          "rgba(255,255,255,0.08)",
                                        color:
                                          "#ffffff",
                                        fontFamily:
                                          "Arial, Helvetica, sans-serif",
                                        fontWeight:
                                          800,
                                        cursor:
                                          "pointer",
                                      }}
                                    >
                                      <BarChart3 size={16} />
                                      {expandedStatsMatch ===
                                      info.eventId
                                        ? "HIDE MATCH REPORT"
                                        : "JUDE + TEAM STATS"}
                                    </button>

                                    {expandedStatsMatch ===
                                      info.eventId && (
                                      <div
                                        style={{
                                          gridColumn:
                                            "1 / -1",
                                          padding:
                                            "14px",
                                          borderRadius:
                                            "8px",
                                          background:
                                            "rgba(12, 20, 38, 0.42)",
                                          color:
                                            "#ffffff",
                                          fontFamily:
                                            "Arial, Helvetica, sans-serif",
                                        }}
                                      >
                                        {matchReport?.loading && (
                                          <div>LOADING MATCH REPORT...</div>
                                        )}

                                        {matchReport?.error && (
                                          <div>
                                            <span>Match stats are unavailable right now.</span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                loadMatchStats(
                                                  info.eventId
                                                )
                                              }
                                              style={{
                                                marginLeft:
                                                  "10px",
                                                color:
                                                  "#ffffff",
                                                background:
                                                  "transparent",
                                                border:
                                                  "0",
                                                textDecoration:
                                                  "underline",
                                                cursor:
                                                  "pointer",
                                              }}
                                            >
                                              Retry
                                            </button>
                                          </div>
                                        )}

                                        {matchStats && (
                                          <MatchStatsReport
                                            report={matchStats}
                                          />
                                        )}
                                      </div>
                                    )}

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
                        Match reminders plus live goals, cards, penalties, and substitutions.
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

                  <div
                    className="reminder-options"
                    aria-label="Match reminder times"
                  >
                    {[
                      { hour: 24, label: "24 hours" },
                      { hour: 12, label: "12 hours" },
                      { hour: 1, label: "1 hour" },
                    ].map(({ hour, label }) => (
                      <label
                        className="reminder-option"
                        key={hour}
                      >
                        <input
                          type="checkbox"
                          checked={reminderHours.includes(hour)}
                          onChange={() =>
                            updateReminderHours(hour)
                          }
                        />
                        <span>{label} before</span>
                      </label>
                    ))}
                  </div>

                  {notificationSettingsError && (
                    <p
                      className="reminder-preference-error"
                      role="status"
                    >
                      {notificationSettingsError}
                    </p>
                  )}

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

function MatchStatsReport({ report }) {
  const [activeView, setActiveView] =
    useState("player");

  const playerStats =
    report.player?.stats ?? [];

  const featuredNames = [
    "Total Goals",
    "Assists",
    "Shots",
    "Shots On Goal",
  ];

  const featuredStats =
    featuredNames
      .map((name) =>
        playerStats.find((stat) => stat.name === name)
      )
      .filter(Boolean);

  const otherPlayerStats =
    playerStats.filter(
      (stat) => !featuredNames.includes(stat.name)
    );

  const teams =
    report.teamStats ?? [];

  const homeStats =
    teams[0]?.stats ?? [];

  const awayStats =
    teams[1]?.stats ?? [];

  const events =
    report.matchEvents ?? [];

  const lineups =
    report.lineups ?? [];

  const getLineupRows =
    (team) => {
      const starters =
        [...(team.starters ?? [])].sort(
          (a, b) => a.formationPlace - b.formationPlace
        );

      if (starters.length === 0) {
        return [];
      }

      const formationLines =
        String(team.formation)
          .split("-")
          .map(Number)
          .filter((count) => Number.isInteger(count) && count > 0);

      if (
        formationLines.length === 0 ||
        formationLines.reduce((total, count) => total + count, 1) !== starters.length
      ) {
        return [starters];
      }

      const goalkeepers =
        starters.filter((player) =>
          /goalkeeper|keeper/i.test(player.position)
        );

      const defenders =
        starters.filter((player) =>
          /defender|back/i.test(player.position)
        );

      const forwards =
        starters.filter((player) =>
          /forward|striker/i.test(player.position)
        );

      const midfielders =
        starters.filter((player) =>
          !goalkeepers.includes(player) &&
          !defenders.includes(player) &&
          !forwards.includes(player)
        );

      const midfieldLineCounts =
        formationLines.slice(1, -1);

      if (
        goalkeepers.length === 1 &&
        defenders.length === formationLines[0] &&
        forwards.length === formationLines.at(-1) &&
        midfielders.length === midfieldLineCounts.reduce(
          (total, count) => total + count,
          0
        )
      ) {
        const midfieldRows = [];

        if (midfieldLineCounts.length === 1) {
          midfieldRows.push(midfielders);
        } else {
          const attackingMidfielders =
            midfielders.filter((player) =>
              /attacking midfielder|wing/i.test(player.position)
            );

          const centralMidfielders =
            midfielders.filter(
              (player) => !attackingMidfielders.includes(player)
            );

          if (
            centralMidfielders.length === midfieldLineCounts[0] &&
            attackingMidfielders.length === midfieldLineCounts[1]
          ) {
            midfieldRows.push(
              centralMidfielders,
              attackingMidfielders
            );
          } else {
            let offset = 0;

            midfieldLineCounts.forEach((count) => {
              midfieldRows.push(
                midfielders.slice(offset, offset + count)
              );
              offset += count;
            });
          }
        }

        return [
          goalkeepers,
          defenders,
          ...midfieldRows,
          forwards,
        ];
      }

      const rows = [starters.slice(0, 1)];
      let offset = 1;

      formationLines.forEach((count) => {
        rows.push(starters.slice(offset, offset + count));
        offset += count;
      });

      return rows;
    };

  const renderLineup =
    (team, teamIndex) => {
      const rows =
        getLineupRows(team);

      const visualRows =
        teamIndex === 1
          ? [...rows].reverse()
          : rows;

      return (
        <div
          className={`lineup-team-half ${teamIndex === 1 ? "lineup-team-bottom" : "lineup-team-top"}`}
          key={team.name}
        >
          <div className="lineup-team-heading">
            <div>
              <strong>{team.name}</strong>
              <span>STARTING XI</span>
            </div>
            <b>{team.formation || "LINEUP"}</b>
          </div>
          <div className="lineup-rows">
            {visualRows.map((row, rowIndex) => (
              <div
                className="lineup-player-row"
                key={`${team.name}-${rowIndex}`}
                style={{ "--player-count": row.length }}
              >
                {row.map((player) => (
                  <div
                    className="lineup-player"
                    key={player.id}
                    title={`${player.name}${player.position ? ` · ${player.position}` : ""}`}
                  >
                    <div className="lineup-player-avatar">
                      <span>{player.jersey || player.formationPlace}</span>
                      {player.headshot && (
                        <img
                          src={player.headshot}
                          alt=""
                          loading="lazy"
                        />
                      )}
                    </div>
                    <strong>{player.shortName}</strong>
                    <span>{player.position}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    };

  const toNumber =
    (value) => {
      const number =
        Number.parseFloat(String(value).replace("%", ""));

      return Number.isFinite(number)
        ? Math.max(0, number)
        : 0;
    };

  return (
    <section className="match-report">
      <header className="match-report-heading">
        <div>
          <p className="match-report-eyebrow">THE MATCH FILE</p>
          <h3>Jude + match stats</h3>
          <p className="match-report-subtitle">
            ESPN match data, styled for a closer look.
          </p>
        </div>
        <span className="match-report-source">ESPN DATA</span>
      </header>

      <div
        className="match-report-tabs"
        role="tablist"
        aria-label="Match report views"
      >
        {[
          ["player", "JUDE"],
          ["teams", "TEAM STATS"],
          ["lineups", "LINEUPS"],
          ["flow", "MATCH FLOW"],
        ].map(([view, label]) => (
          <button
            key={view}
            type="button"
            role="tab"
            aria-selected={activeView === view}
            className={activeView === view ? "is-active" : ""}
            onClick={() => setActiveView(view)}
          >
            {label}
          </button>
        ))}
      </div>

      {activeView === "player" && (
        <div role="tabpanel" className="match-report-panel">
          <div className="player-report-intro">
            <div>
              <p className="match-report-eyebrow">PLAYER OF THE MATCH FILE</p>
              <h4>Jude Bellingham</h4>
              <span>
                {report.player
                  ? `${report.player.position || "Player"} · ${report.player.starter ? "STARTED" : "IN SQUAD"}`
                  : "No player report available for this match."}
              </span>
            </div>
            <span className="player-report-mark" aria-hidden="true">JB</span>
          </div>

          {featuredStats.length > 0 ? (
            <div className="player-feature-grid">
              {featuredStats.map((stat, index) => (
                <div
                  className={`player-feature player-feature-${index + 1}`}
                  key={stat.name}
                  title={stat.description}
                >
                  <span>{stat.name}</span>
                  <strong>{stat.value}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p className="match-report-empty">
              ESPN did not provide Jude&apos;s player statistics for this fixture.
            </p>
          )}

          {otherPlayerStats.length > 0 && (
            <div className="player-other-stats">
              <div className="match-report-section-heading">
                <h5>Full player line</h5>
                <span>{playerStats.length} metrics</span>
              </div>
              <div className="player-stat-list">
                {otherPlayerStats.map((stat) => (
                  <div
                    className="player-stat-row"
                    key={stat.name}
                    title={stat.description}
                  >
                    <span>{stat.name}</span>
                    <strong>{stat.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeView === "teams" && (
        <div role="tabpanel" className="match-report-panel">
          {teams.length === 2 ? (
            <>
              <div className="team-stat-legend">
                <span><i className="team-stat-swatch home" />{teams[0].name}</span>
                <span><i className="team-stat-swatch away" />{teams[1].name}</span>
              </div>
              <div className="team-stat-list">
                {homeStats.map((stat) => {
                  const other =
                    awayStats.find((item) => item.name === stat.name);
                  const homeValue = toNumber(stat.value);
                  const awayValue = toNumber(other?.value);
                  const maxValue = Math.max(homeValue, awayValue, 1);

                  return (
                    <div className="team-stat-row" key={stat.name}>
                      <div className="team-stat-labels">
                        <strong>{stat.name}</strong>
                        <span>
                          <b>{stat.value}</b>
                          <span aria-hidden="true"> / </span>
                          <b>{other?.value ?? "-"}</b>
                        </span>
                      </div>
                      <div className="team-stat-bars" aria-hidden="true">
                        <span className="team-stat-bar home">
                          <i style={{ width: `${(homeValue / maxValue) * 100}%` }} />
                        </span>
                        <span className="team-stat-bar away">
                          <i style={{ width: `${(awayValue / maxValue) * 100}%` }} />
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="match-report-empty">
              Team comparison data is unavailable for this fixture.
            </p>
          )}
        </div>
      )}

      {activeView === "lineups" && (
        <div role="tabpanel" className="match-report-panel lineups-panel">
          {lineups.length === 2 && lineups.every((team) => team.starters.length > 0) ? (
            <div className="lineup-pitch">
              {renderLineup(lineups[0], 0)}
              <div className="lineup-midfield" aria-hidden="true">
                <span />
              </div>
              {renderLineup(lineups[1], 1)}
            </div>
          ) : (
            <p className="match-report-empty">
              ESPN hasn&apos;t published the starting lineups for this match.
            </p>
          )}
        </div>
      )}

      {activeView === "flow" && (
        <div role="tabpanel" className="match-report-panel flow-panel">
          <div className="match-report-section-heading">
            <h5>Match flow</h5>
            <span>90 minutes · {events.length} moments</span>
          </div>
          {events.length > 0 ? (
            <>
              <div className="match-flow-track" aria-label="Match event timeline">
                {events.map((event, index) => {
                  const minute =
                    Number.parseInt(event.time, 10);
                  const position =
                    Number.isFinite(minute)
                      ? Math.min(minute, 90) / 90 * 100
                      : 0;
                  const markerPosition =
                    Math.max(
                      0,
                      Math.min(
                        100,
                        position + (index % 2 === 0 ? -0.6 : 0.6)
                      )
                    );

                  return (
                    <span
                      className={`match-flow-marker match-flow-${event.type}`}
                      key={event.id}
                      style={{
                        left: `${markerPosition}%`,
                      }}
                      title={`${event.time || "Match"} · ${event.text}`}
                      aria-label={`${event.time || "Match"}: ${event.text}`}
                    />
                  );
                })}
              </div>
              <div className="match-flow-axis">
                <span>0&apos; · KICKOFF</span>
                <span>45&apos; · HALF</span>
                <span>90&apos; · FULL TIME</span>
              </div>
              <div className="match-flow-legend">
                <span><i className="flow-dot flow-goal" /> GOAL</span>
                <span><i className="flow-dot flow-card" /> CARD</span>
                <span><i className="flow-dot flow-sub" /> SUBSTITUTION</span>
              </div>
              <div className="match-flow-counts">
                <div>
                  <strong>{events.filter((event) => event.type === "goal").length}</strong>
                  <span>GOALS</span>
                </div>
                <div>
                  <strong>
                    {events.filter((event) =>
                      event.type === "yellow-card" || event.type === "red-card"
                    ).length}
                  </strong>
                  <span>CARDS</span>
                </div>
                <div>
                  <strong>{events.filter((event) => event.type === "substitution").length}</strong>
                  <span>SUBS</span>
                </div>
              </div>
              <p className="match-flow-note">
                Each marker represents a recorded ESPN match event.
              </p>
              <div className="match-flow-events">
                <div className="match-report-section-heading">
                  <h5>Play-by-play</h5>
                  <span>{events.length} recorded</span>
                </div>
                <ol className="match-event-timeline">
                  {events.map((event) => (
                    <li className={`match-event match-event-${event.type}`} key={event.id}>
                      <span className="match-event-time">{event.time || "LIVE"}</span>
                      <span className="match-event-dot" aria-hidden="true" />
                      <span className="match-event-text">{event.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          ) : (
            <p className="match-report-empty">
              ESPN has no timeline events recorded for this fixture.
            </p>
          )}
        </div>
      )}
    </section>
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