# Cofounder

Cofounder is a mobile app for people who want to find a cofounder and build something together. Both people are peers: each profile says what they can do and what they are looking for, a full-screen deck is there to browse, and a conversation opens when the interest is mutual.

The app name in the Expo config is `cofounder`. The npm package and Expo slug are `lockin`.

## What the app does

The signed-in experience is three tabs: **Discover**, **Matches**, and **Profile**.

- **Profile.** Name, age, location and time zone, specialties, the specialties they hope to find, starting point, weekly availability, ambition, languages they speak, optional links (GitHub, portfolio, LinkedIn, and others), and one or two short prompts. A profile photo is optional. Photos go to private Storage and are published through the `moderate-avatar` Edge Function.
- **Discover.** A full-screen swipe deck, always in cofounder mode. Specialty and time zone filters are available on the deck; further filters sit behind Premium. Overlapping skills are a visual hint and a ranking signal. A match is still a reciprocal like: `DecisionResult.match` is set only when the other person has liked back, which Postgres enforces in `record_decision()`.
- **Matches and chat.** A match list and a 1:1 thread. A new thread can offer up to three openers written from the two profiles. Those lines are rules in `src/features/chat/icebreakers.ts`, not a language model.
- **Account.** Email and password, with confirmation before the profile is created when Supabase is configured. Google, Apple, and LinkedIn appear only when `EXPO_PUBLIC_AUTH_PROVIDERS` lists them. A confirmed account without a phone number is sent through the phone step. Password reset uses the `cofounder://` redirect.
- **Safety.** From a conversation you can report a message or a person and block them.
- **Premium.** One tier in `src/features/premium`: a higher daily like allowance, Super Likes, Boost, and a short undo window. The numbers live in `src/data/premium-limits.ts` and are repeated in SQL. On a native build, `src/lib/purchases.ts` loads RevenueCat when `EXPO_PUBLIC_REVENUECAT_IOS_KEY` or `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` is set for that platform. Without the key, or where the native SDK cannot load, the paywall reports that purchases are unavailable. The in-memory mock uses stand-in offers so the screen can be walked through. Entitlement snapshots are written by the `sync-entitlement` and `revenuecat-webhook` Edge Functions.

Session, room, video, streak, and partner-agreement modules remain in `src/data` and in `supabase/migrations`. They are outside the current tab flow. The product notes in [`docs/plan/CONCEPTO.md`](docs/plan/CONCEPTO.md) (Spanish) record that scope.

## Stack

| Layer | In this repo |
| --- | --- |
| App | TypeScript (`strict`), React 19.3, React Native 0.88, Expo SDK 58, Expo Router |
| UI | Dark interface. Tokens, type, and motion live in `src/constants/theme.ts`. Inter is loaded from `@expo-google-fonts/inter`. |
| Screens | File routes in `src/app`. Feature code in `src/features`. Screens call the repository interfaces in `src/data/repositories.ts`. |
| Data | `src/data/active.ts` picks the backend. With both public Supabase variables, the app uses `src/data/supabase`. In development without them, it uses the in-memory mock in `src/data/mock`. A release build throws on the first repository call if those variables are missing. |
| Server | Supabase: Postgres, Auth, Realtime, Storage, and Edge Functions (`moderate-avatar`, `moderate-board`, `apple-token`, `sync-entitlement`, `revenuecat-webhook`). |
| Access | Row Level Security and SQL functions in `supabase/migrations`. The anon key is public and ships in the client. The service-role key does not belong in the app. |

Platforms declared in `app.json`:

- **iOS** — bundle id `app.cofounder.mobile`, Sign in with Apple enabled in the config
- **Android** — package `app.cofounder.android`
- **Web** — static export (`npm run web`; CI also runs `npx expo export --platform web`)

Interface languages are Spanish, English, and Catalan (`src/i18n`, plus store-permission strings in `locales/es.json`, `locales/en.json`, and `locales/ca.json`). The app follows the device language, falls back to English, and can be changed in Settings. Languages a person speaks on their profile are a separate field.

## Run it locally

Use **Node.js 22**, the version in [`.github/workflows/ci.yml`](.github/workflows/ci.yml). Install dependencies from the lockfile, then start Expo:

```bash
npm ci
npm start
```

From the CLI you can open an [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/), the [iOS Simulator](https://docs.expo.dev/workflow/ios-simulator/) (macOS), [Expo Go](https://expo.dev/go), or a [development build](https://docs.expo.dev/develop/development-builds/introduction/). Expo Go loads the JavaScript bundle; the RevenueCat SDK is native and is loaded only from a native build (`src/lib/purchases.ts`). Native scripts:

```bash
npm run android
npm run ios
npm run web
```

Edit screens under `src/app`. The `@/` import alias maps to `src/` (`tsconfig.json`). This project targets [Expo SDK 58](https://docs.expo.dev/versions/v58.0.0/) and [Expo Router](https://docs.expo.dev/router/introduction/).

`npm run reset-project` deletes `src/` and writes a blank screen. Leave that script unused.

### Supabase

Copy the template and fill in your own project. `.env*.local` is gitignored.

```bash
cp .env.example .env.local
```

| Variable | Role |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Project root, `https://<ref>.supabase.co`. A `/rest/v1` URL is normalized, and using it raw is a common source of opaque 404s. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public anon key. Real access control is the RLS policies. |
| `EXPO_PUBLIC_AUTH_PROVIDERS` | Optional comma-separated list: `google`, `apple`, `linkedin`. Omitted providers are not shown. |

Without the URL and anon key, `npm start` in development talks to the in-memory mock, so the deck and matches disappear when the JS process restarts. `EXPO_PUBLIC_LOCKIN_ALLOW_MOCK=1` is the explicit release-build override used by the negative end-to-end control. It is not a substitute for credentials.

Local Postgres, as documented in [`supabase/README.md`](supabase/README.md):

```bash
supabase start
supabase db reset
```

Add a new migration file for schema changes. Applied migration files stay as they are; [`supabase/README.md`](supabase/README.md) explains why. The client mapping is in [`src/data/supabase/README.md`](src/data/supabase/README.md).

## Checks

These scripts are defined in `package.json`:

| Command | What it runs |
| --- | --- |
| `npm run lint` | `expo lint` |
| `npm run format:check` | Prettier check (Markdown is ignored) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Jest via `jest-expo` and React Native Testing Library |
| `npm run test:watch` | Jest in watch mode |
| `npm run test:coverage` | Jest with the coverage floors in `jest.config.js` |
| `npm run test:functions` | Edge Function logic with `node --test` (no Deno, no network) |
| `npm run test:schema` | Migrations and RPCs on embedded Postgres (`@electric-sql/pglite`) |
| `npm run test:e2e` | Node tests of the Android runner. This does not boot an emulator. |

The shared repository contract is `src/data/repositories.contract.ts`. The mock half runs inside `npm test`. The Supabase half writes data and stays opt-in:

```bash
LOCKIN_SUPABASE_CONTRACT=1 npx jest src/data/supabase/contract.test.ts
```

Point that command at a database you can reset. Details are in the header of `src/data/supabase/contract.test.ts`.

On pushes and pull requests that change more than `docs/`, [`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs lint, format, types, coverage, the E2E runner tests, Edge Function tests, a static web export, and the embedded SQL tests. Pushes to the default branch also run the Supabase contract against a disposable local stack ([`.github/workflows/contract.yml`](.github/workflows/contract.yml)). [`.github/workflows/schema-drift.yml`](.github/workflows/schema-drift.yml) compares the migration fingerprint with a disposable database. [`.github/workflows/e2e.yml`](.github/workflows/e2e.yml) runs Maestro on an Android emulator; requirements and the local commands are in [`e2e/README.md`](e2e/README.md) (Node.js 22.13 or later on the 22 line, Java 17, Android SDK 36, Docker, Supabase CLI, Maestro).

## More in the repo

- Product concept (Spanish): [`docs/plan/CONCEPTO.md`](docs/plan/CONCEPTO.md)
- Schema and local database: [`supabase/README.md`](supabase/README.md)
- Supabase client and the mock fallback: [`src/data/supabase/README.md`](src/data/supabase/README.md)
- Environment template: [`.env.example`](.env.example)
- Android end-to-end tests: [`e2e/README.md`](e2e/README.md)
- Store and legal drafts (Spanish, English, Catalan): [`docs/tiendas`](docs/tiendas)

## License

MIT. See [LICENSE](LICENSE).
