# BelliGoal ⚽

A matchday tracker for **Real Madrid** and **England**, built around Jude Bellingham. See what's coming up, whether Jude is in the starting XI, final scores, and get phone notifications before kickoff and when a goal goes in.

**Live site:** https://belligoal.onrender.com

> Hosted on Render's free tier, so the first load after a quiet period can take up to ~50 seconds while the server wakes up.

![BelliGoal on desktop](docs/home-desktop.png)
![BelliGoal on mobile](docs/home-mobile.png)

## Why I built it

I follow Real Madrid and Jude Bellingham closely and wanted the fixtures, lineups and scores I care about in one place, with a notification so I never miss kickoff. It's one of my most challenging solo projects: I owned the idea, the design, the API work and the deployment.

## Features

- **Upcoming fixtures** for Real Madrid and England, pulled live from ESPN, grouped by date and shown in Philippine time
- **Jude Bellingham lineup status** for each match: starting XI, not starting, or not announced yet
- **Stats popup** with completed matches and final scores
- **Push notifications** (Web Push): a reminder about an hour before kickoff, and an alert when either team scores <!-- Remove "and an alert when either team scores" if you haven't deployed the live-goal version of server.js yet. -->
- **Installable app**: works as a PWA on phones (web manifest + service worker)
- **Editable game links** (match centre, news sites) saved on the server, so they follow you across devices
- Background music toggle, a rising intro animation, and separate layouts for desktop and mobile

## Tech

| Area | What I used |
| --- | --- |
| Frontend | React + Vite, plain CSS (a fixed design canvas on desktop that scales to the screen, plus a separate mobile layout) |
| Backend | Node.js + Express |
| Data | ESPN's public site API (unofficial and undocumented, not affiliated with ESPN) |
| Notifications | `web-push` with VAPID keys, `node-cron` running every minute |
| Storage | Upstash Redis in production, local JSON files in development |
| Hosting | Render web service, configured in `render.yaml` |
| Uptime | UptimeRobot pings the site so Render's free tier doesn't fall asleep |

## How it works

A cron job runs on the server every minute. It checks ESPN for upcoming matches and sends a reminder to every saved push subscription when kickoff is about an hour away. It also checks live matches and compares scores, so when a score changes it sends a goal alert. The React app talks to the same Express server for fixtures, results, lineup status, notification subscriptions and saved links.

## API

| Endpoint | Purpose |
| --- | --- |
| `GET /api/upcoming` | Upcoming Real Madrid and England fixtures |
| `GET /api/results` | Completed matches with scores |
| `GET /api/bellingham/status/:eventId` | Jude's lineup status for a match |
| `GET /api/notifications/public-key` | VAPID public key for push subscription |
| `POST /api/notifications/subscribe` | Save a push subscription |
| `POST /api/notifications/unsubscribe` | Remove a push subscription |
| `GET` / `POST /api/game-links` | Read and save the custom game links |
| `GET /api/jude` | Health check |

## Run it locally

```bash
git clone https://github.com/iivischii/sports-tracker.git
cd sports-tracker
npm install
```

Create a `.env` file in the project root (it is not committed):

```env
VAPID_SUBJECT=mailto:you@example.com
VAPID_PUBLIC_KEY=your-public-key
VAPID_PRIVATE_KEY=your-private-key

# Optional: permanent storage in production
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Generate your own VAPID keys with:

```bash
npx web-push generate-vapid-keys
```

Then start the backend (port 3001) and the frontend in two terminals:

```bash
npm run server
npm run dev
```

Vite proxies `/api` to the backend, so the app works from your computer and from a phone on the same network. Push notifications need HTTPS, so test them on the deployed site.

## Deploy

The project deploys to Render using `render.yaml`:

- Build command: `npm install && npm run build`
- Start command: `npm start`
- Set the environment variables above in the Render dashboard

## Author

Built by **Cyrene Isabelle Wenceslao**. Portfolio: https://isabelleswebsite.vercel.app
