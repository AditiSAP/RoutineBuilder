# Dayframe Routine Builder

Dayframe is a native-first Android and iOS routine planner built with Expo, React Native, and TypeScript. It ships with a complete 6:00 AM–10:00 PM example routine and works locally without an account or backend.

## Run on Android or iOS

Requirements: Node.js 20+, npm, and either the Expo Go app or an Android/iOS simulator.

```bash
npm install
npm start
```

Then scan the QR code with Expo Go, press `a` for Android, or press `i` for the iOS Simulator (macOS/Xcode required). Native notification testing is most reliable on a physical device.

```bash
npm run android
npm run ios
npm run typecheck
npm test
```

For store builds, install and configure EAS CLI, replace the example bundle/package IDs in `app.json`, and run `eas build --platform android` or `eas build --platform ios`.

## Features

- Native phone UI with safe areas, keyboard-aware editing, accessible controls, automatic light/dark appearance, and Android/iOS interactions.
- Create, edit, delete, duplicate, and reorder routines with emoji, start time, optional end time, category, weekdays, reminder lead time, notes, and multiple links.
- Daily checklist and progress. Completion is scoped to each local calendar date, so recurring routines reset on their next applicable day while prior history remains viewable.
- AsyncStorage persistence behind the `RoutineRepository` interface. Routines, links, notes, settings, and completion history stay on the device.
- Reliable local-time recurrence, point-in-time items, and overnight ranges (an end at or before the start means the next day).
- Native workout-link opening through React Native `Linking`; only `http://` and `https://` URLs are accepted.
- Google Calendar recurring-event deep links and shareable `.ics` fallback, including notes and links in event descriptions.

Clearing app data or uninstalling removes local records. AsyncStorage is device-specific and is not a cloud backup.

## Local notifications

Enable **Routine reminders** under Settings. Dayframe:

1. Clearly requests operating-system notification permission.
2. Schedules applicable reminders for the next 14 days using `expo-notifications`.
3. Cancels and rebuilds scheduled notifications whenever a routine changes.
4. Cancels scheduled reminders when the setting is turned off.
5. Offers a direct route to system settings if permission is denied.

Local notifications can fire while the app is closed; they do not require a Dayframe server. Delivery timing is still controlled by iOS/Android and may be affected by Focus/Do Not Disturb, battery optimization, app notification settings, force-stopping the app, or OS scheduling. Expo Go has platform/version limitations; use a development build for production-representative notification testing.

The Android notification channel is configured by the `expo-notifications` plugin in `app.json`. The app intentionally schedules a rolling 14-day horizon rather than an unbounded number of notifications.

## Google Calendar and portable calendars

The **G** action on a routine opens Google's event-template flow with:

- Correct date/time and overnight end date
- Weekly `RRULE` recurrence matching selected days
- Notes and all links in the description

The user reviews and saves the event. No credentials are embedded or stored. **Share calendar file** creates a standards-compliant recurring `.ics` file through the native share sheet for Google Calendar, Apple Calendar, and compatible apps.

### Optional Google Calendar API OAuth

This app intentionally uses deep links and `.ics` because secure cross-platform Google API sync needs an explicitly configured OAuth project. To add full sync:

1. Create a Google Cloud project, enable Google Calendar API, and configure the consent screen.
2. Create separate OAuth client IDs for Android and iOS. Configure the exact Android package/SHA-1 and iOS bundle identifier.
3. Use `expo-auth-session` with platform-specific public client IDs and Authorization Code + PKCE. A mobile OAuth client is public: **never embed a client secret**.
4. Request the narrow `https://www.googleapis.com/auth/calendar.events` scope.
5. For durable refresh/offline sync, send the authorization code to a trusted backend and store refresh tokens encrypted there. Do not put refresh tokens in AsyncStorage.
6. Map routines to Calendar API events with `start`, `end`, `description`, and `recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=..."]`; persist the returned event ID and surface API/re-authentication errors.
7. Add the app scheme/redirect URI to Expo config and each Google OAuth client. Validate redirect URIs for development builds and production binaries separately.

No OAuth environment variables are required for the built-in no-secret flow.

## Architecture

- `App.tsx` — native daily view, builder, settings, editor, links, and sharing
- `src/schedule.ts` — date/time, recurrence, point-in-time, and overnight logic
- `src/notifications.ts` — deterministic notification mapping and Expo scheduling
- `src/calendar.ts` — Google Calendar templates and `.ics` mapping
- `src/storage.ts` — AsyncStorage repository and date-scoped completion updates
- `src/seed.ts` — useful full-day starter schedule

