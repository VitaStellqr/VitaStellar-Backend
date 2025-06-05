# Uzima Backend

This is the backend service for Uzima, built with Express and MongoDB.

## Features
- RESTful API for user authentication, records, appointments, and Stellar integration
- Swagger UI documentation at `/docs`
- Cron jobs for scheduled reminders
- **Sentry integration** for real-time error monitoring and performance tracing

## Prerequisites
- Node.js v16 or higher
- npm v8 or higher
- A Sentry project and DSN (Data Source Name)

## Installation
1. Clone the repo:
   ```bash
   git clone https://github.com/Stellar-Uzima/Uzima-Backend.git
   cd Uzima-Backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

## Environment Variables
Create a `.env` file in the project root (you can copy from `.env.example`) and set:

```dotenv
MONGO_URI=<your MongoDB URI>
PORT=5000
JWT_SECRET=<your JWT secret>
SMTP_HOST=<smtp host>
SMTP_PORT=<smtp port>
SMTP_USER=<smtp user>
SMTP_PASS=<smtp password>
MAIL_FROM="Telemed Support <support@yourdomain.com>"
SENTRY_DSN=<your Sentry DSN>
```

## Running the App
Start in development mode (with nodemon):
```bash
npm run dev
```
Start in production mode:
```bash
npm start
```
The API is now available at `http://localhost:<PORT>` and Swagger UI at `http://localhost:<PORT>/docs`.

## Sentry Integration
Uzima Backend is configured to report runtime errors and performance traces to Sentry.

### Testing Error Reporting
1. Ensure `SENTRY_DSN` is set in `.env`.
2. Run the app.
3. Open your browser and visit:
   ```
   http://localhost:<PORT>/debug-sentry
   ```
   This will throw a test error.
4. Verify the error appears in your Sentry project under **Issues**.

### Viewing Performance Metrics
Sentry captures performance traces for all incoming requests (sampling rate = 100%).
1. Call any endpoint (e.g., `/api`).
2. In Sentry Dashboard, go to **Performance → Transactions** to inspect traces and response times.

## Monitoring and Alerts
- Configure alerts and dashboards in Sentry for proactive notifications.

## License
ISC
