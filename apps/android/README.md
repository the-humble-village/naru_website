# android

Home of the native Android app (Kotlin + Jetpack Compose). **The app's code does not live in this repo yet.**

## Status: frozen

Mobile sync is frozen (`docs/SCHEMA_V2.md` §11). `/api/sync` has been removed from the backend, and there is no offline data collection: mountain visits are recorded on paper and entered through the web app.

`localId` columns are kept on every syncable model, so turning sync back on needs no migration. When it returns, records sync in dependency order: subjects → enrollment → visit → details.

## Build

This is a separate Gradle build. pnpm and Turborepo don't manage it: the folder has no `package.json`, so the `apps/*` workspace glob skips it.
