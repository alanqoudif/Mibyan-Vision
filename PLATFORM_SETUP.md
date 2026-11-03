# Mibyan Vision platform setup

The Expo application is in `app/`, the Next.js site is in `web/`, shared plugin types and validation are in `packages/shared/`, and database/Edge Function source remains in `supabase/`.

## Local setup

1. Copy `app/.env.example` to `app/.env.local` and `web/.env.example` to `web/.env.local`. Fill in the existing Supabase project URL and publishable/anon key in both. Never put a service-role key in either client.
2. Install the workspace dependencies with `npm install`.
3. Run the app with `npm run dev:app` or the site with `npm run dev:web`.

The web camera and browser speech recognition require a secure HTTPS origin (localhost is allowed by browsers). The site reports when camera or microphone access is unavailable and keeps text input available.

## Supabase deployment

Apply the plugin-platform migration in `supabase/migrations/`, then deploy the updated `mata-assist` and new `mata-link-device` Edge Functions. Existing app history remains keyed by its installation ID; signing in claims that ID once, attaches its prior records to the account, and later requests store authenticated sessions against that account. Settings are copied from the device on first sign-in and then synchronized. Each account's plugin and pharmacy rows are protected by RLS.

After signing in to the Supabase CLI and confirming the project reference, the commands are `npx supabase link --project-ref <project-ref>`, `npx supabase db push --remote`, and `npx supabase functions deploy mata-assist mata-link-device`. These commands change the linked Supabase project; use only the project's verified reference.

The Supabase Edge Function must keep its existing `SUPABASE_URL`, service-role key, and OpenRouter Vault setup. The function uses service role only on the server, verifies the caller's access token before loading private plugins/catalog rows, and checks requested capabilities.

Supabase now requires explicit table access grants and API exposure for newly created tables. The migration grants only the roles used by the clients; also confirm `public` is enabled in Project Settings → API → Exposed schemas. RLS remains the row-level ownership boundary.

## Apple and Google sign-in

Enable Apple and Google under Supabase Authentication → Providers. Configure each provider's client credentials and redirect URIs using the current Supabase setup pages:

- [Google provider setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-google)
- [Apple provider setup](https://supabase.com/docs/guides/auth/social-sign-in/auth-apple)

For web, allow `https://YOUR_SITE/auth/callback` and the local development callback in Supabase's redirect URL list. For the mobile OAuth browser flow, allow the `mata://auth/callback` URI; Google OAuth also needs the Supabase callback URL shown in its provider setup. Native iOS Apple sign-in additionally requires the Apple Sign In capability for the configured App ID and matching Supabase Apple credentials. Expo config now enables `usesAppleSignIn`; regenerate/rebuild the native app after enabling it.

Do not enable the providers until valid Apple/Google credentials and redirect domains are configured. The UI reports provider configuration failures without claiming that sign-in succeeded.

## Pharmacy CSV

The web catalog accepts up to 500 rows per import. CSV columns can be named in Arabic or English, in this order: name, strength, shelf, row, position, barcode. Name, shelf, and row are required. Verify imported locations with pharmacy staff; the assistant reports only catalog locations and asks for confirmation when a match is uncertain.
