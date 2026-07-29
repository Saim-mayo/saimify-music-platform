# Spotify Clone Backend API

A production-quality backend API for a Spotify-like music streaming app.
This service provides user authentication, streaming metadata, playlist
management, subscription payments, admin controls, notifications, and
Stripe-powered plan management.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Requirements](#requirements)
- [Environment Variables](#environment-variables)
- [Installation](#installation)
- [Development](#development)
- [Production](#production)
- [Testing](#testing)
- [Scripts](#scripts)
- [API Documentation](#api-documentation)
- [Routes Summary](#routes-summary)
- [Stripe & Plan Sync](#stripe--plan-sync)
- [Google OAuth](#google-oauth)
- [Admin & Webhook Notes](#admin--webhook-notes)
- [Useful Files](#useful-files)

## Features

- Email/password authentication with JWT access and refresh tokens
- Google OAuth login
- Role-based access control (`user`, `artist`, `admin`)
- Music upload, streaming, and play tracking
- Playlist management and queue controls
- Likes, history, notifications, and user profiles
- Stripe subscription billing and plan catalog sync
- ImageKit avatar uploads
- Rate limiting, CORS, Helmet security headers
- Swagger/OpenAPI documentation
- Graceful shutdown and MongoDB connection observability

## Tech Stack

- Node.js v20+
- Express.js
- MongoDB + Mongoose
- Passport.js + passport-google-oauth20
- JWT + cookies
- Stripe billing
- ImageKit uploads
- Multer file handling
- Express Validator
- Jest + Supertest + mongodb-memory-server

## Requirements

- Node.js >= 20.0.0
- npm
- MongoDB connection string
- Stripe account with webhook endpoint configured
- Google OAuth credentials
- ImageKit account for avatar storage
- SMTP credentials for email delivery (optional, but recommended)

## Environment Variables

Create a `.env` file in the project root with the following values:

```env
NODE_ENV=development
PORT=3000

MONGO_URI=
CLIENT_URL=
ALLOWED_ORIGINS=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
REFRESH_TOKEN_HMAC_SECRET=
ACCESS_TOKEN_EXPIRES=15m
REFRESH_TOKEN_EXPIRES=7d

STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_SUCCESS_URL=
STRIPE_CANCEL_URL=
STRIPE_AUTOMATIC_TAX=false

IMAGE_KIT_PUBLIC_KEY=
IMAGE_KIT_PRIVATE_KEY=
IMAGE_KIT_URL_ENDPOINT=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=

ADMIN_SEED_EMAIL=
ADMIN_SEED_PASSWORD=

EMAIL_FROM=
SMTP_HOST=
SMTP_PORT=
SMTP_SECURE=
SMTP_USER=
SMTP_PASS=
```

### Required at boot

The server will refuse to start if any of these are missing:

- `PORT`
- `MONGO_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `REFRESH_TOKEN_HMAC_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `IMAGE_KIT_PUBLIC_KEY`
- `IMAGE_KIT_PRIVATE_KEY`
- `IMAGE_KIT_URL_ENDPOINT`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `ADMIN_SEED_EMAIL`
- `ADMIN_SEED_PASSWORD`
- `CLIENT_URL`

### Optional but recommended

- `ALLOWED_ORIGINS` — comma-separated list of allowed origins for CORS
- `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` — email delivery

### Test environment

A safe `.env.test` file is included and is used during test execution.
It contains dummy values and does not require real Stripe, ImageKit, or
SMTP credentials.

## Installation

```bash
npm install
```

## Development

Use the development server with nodemon:

```bash
npm run dev
```

Then open:

- `http://localhost:3000/health` — health check
- `http://localhost:3000/api-docs` — Swagger UI (development only)

## Production

Build and run the production server:

```bash
npm start
```

For production deployments, set `NODE_ENV=production` and ensure your
`ALLOWED_ORIGINS` is configured correctly.

## Testing

Run the full test suite:

```bash
npm test
```

Watch mode:

```bash
npm run test:watch
```

Coverage:

```bash
npm run test:coverage
```

## Scripts

- `npm run dev` — start server with nodemon
- `npm start` — start server normally
- `npm test` — run Jest tests in-band
- `npm run test:watch` — run tests in watch mode
- `npm run test:coverage` — run tests with coverage report
- `npm run lint` — run ESLint

## API Documentation

Base API path:

```bash
http://localhost:3000/api
```

Health endpoint:

```bash
http://localhost:3000/health
```

Swagger docs (development only):

```bash
http://localhost:3000/api-docs
```

## Routes Summary

### Auth

- `POST /api/auth/register` — register new user
- `POST /api/auth/login` — login with email/username + password
- `GET /api/auth/google` — start Google OAuth login
- `GET /api/auth/google/callback` — Google OAuth callback
- `POST /api/auth/forgot-password` — request password reset email
- `POST /api/auth/reset-password` — reset password with token
- `POST /api/auth/refresh-token` — refresh access token
- `POST /api/auth/logout` — logout

### Music

Public:

- `GET /api/music/all-songs` — list public songs
- `GET /api/music/all-albums` — list public albums
- `GET /api/music/albums/:albumId` — get album details
- `GET /api/music/search/songs?q=` — search songs
- `GET /api/music/search/artists?q=` — search artists
- `GET /api/music/trending` — trending songs

Authenticated:

- `POST /api/music/play/:songId` — register a play
- `GET /api/music/stream/:songId` — stream audio
- `GET /api/music/history` — get play history

### Users

- `GET /api/users/me` — get current profile
- `GET /api/users/me/features` — get current plan feature flags
- `PATCH /api/users/me` — update profile
- `POST /api/users/me/avatar` — upload avatar image
- `PATCH /api/users/set-password` — set password for Google-only account
- `POST /api/users/artist/request` — request verified artist access

### Playlists

- `POST /api/playlists` — create playlist
- `POST /api/playlists/add-song` — add song to playlist
- `POST /api/playlists/remove-song` — remove song from playlist
- `GET /api/playlists/user` — get current user playlists
- `GET /api/playlists/:playlistId` — get playlist details
- `DELETE /api/playlists/:playlistId` — delete playlist

### Queue

- `POST /api/queue/add` — add song to queue
- `POST /api/queue/shuffle` — toggle shuffle
- `POST /api/queue/repeat` — toggle repeat
- `GET /api/queue/current` — get current queue song
- `POST /api/queue/next` — skip to next song
- `POST /api/queue/prev` — previous song
- `GET /api/queue/all` — get all queue songs
- `DELETE /api/queue/clear` — clear queue

### Likes

- `POST /api/likes/like` — like a song
- `POST /api/likes/unlike` — unlike a song
- `GET /api/likes/likes/:songId` — get like count and user like status

### Notifications

- `GET /api/notifications` — list user notifications
- `GET /api/notifications/unread-count` — unread count
- `PATCH /api/notifications/:id/read` — mark one read
- `PATCH /api/notifications/read-all` — mark all read
- `POST /api/notifications/announce` — admin broadcast announcement

### Payment

- `GET /api/payment/plans` — list available subscription plans
- `POST /api/payment/checkout` — create Stripe Checkout session
- `POST /api/payment/change-plan` — upgrade/downgrade subscription
- `GET /api/payment/subscription/status` — current subscription status
- `GET /api/payment/history` — payment history
- `POST /api/payment/billing-portal` — open Stripe Billing Portal
- `DELETE /api/payment/subscription` — cancel subscription
- `POST /api/payment/subscription/resume` — resume a cancelled subscription

### Admin

- `GET /api/admin/artists/pending` — list pending artist requests
- `PATCH /api/admin/artists/:userId/approve` — approve artist request
- `PATCH /api/admin/artists/:userId/reject` — reject artist request
- `PATCH /api/admin/users/:userId/ban` — ban user
- `PATCH /api/admin/users/:userId/unban` — unban user
- `GET /api/admin/plans/cache` — inspect plan cache status
- `POST /api/admin/plans/resync` — resync one Stripe product
- `POST /api/admin/plans/resync-all` — resync all Stripe products
- `POST /api/admin/announcements` — send global announcement

### Webhook

- `POST /api/webhook` — Stripe webhook endpoint

> Note: `/api/webhook` uses `express.raw()` and must receive Stripe's
> raw request body for signature verification.

## Stripe & Plan Sync

- Plans are stored in MongoDB and synced from Stripe via webhooks.
- The free plan is hard-coded in the app and does not require Stripe.
- A one-time bootstrap script exists to populate Stripe products into
  the plan catalog from Stripe:

```bash
node src/scripts/syncPlans.js
```

- Webhooks for Stripe product and price changes keep the plan catalog
  up to date automatically.
- If a webhook is missed, use the admin endpoints or rerun the script.

## Google OAuth

- Google login is handled through `passport-google-oauth20`.
- The callback URL must match the `GOOGLE_CALLBACK_URL` env var.
- The app uses a short-lived `oauth_state` cookie to protect against
  CSRF during OAuth flow.

## Admin & Webhook Notes

- `src/config/env.js` validates required boot-time environment variables.
- `src/config/db.js` loads the Stripe-backed plan cache before the app
  accepts traffic.
- `src/app.js` enables CORS, helmet security headers, rate limiting in
  production, and request logging.
- `server.js` handles uncaught exceptions, unhandled promise rejections,
  and graceful shutdown.

## Useful Files

- `server.js` — application entry point
- `src/app.js` — Express app setup
- `src/config/env.js` — environment validation
- `src/config/db.js` — MongoDB connection + plan cache boot
- `src/config/swagger.js` — OpenAPI / swagger setup
- `src/routes/*.js` — API route definitions
- `src/controllers/*.js` — business logic
- `src/models/*.js` — Mongoose schemas
- `src/middlewares/*.js` — auth, validation, rate limiting, access control
- `src/scripts/syncPlans.js` — one-time Stripe plan bootstrap
- `src/scripts/seedAdmin.js` — local admin seeding utility
- `.env.test` — safe test environment values

## License

ISC