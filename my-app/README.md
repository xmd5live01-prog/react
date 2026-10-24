# Hinunangan Water Billing System

The landing page is the app's home screen. Select **Search Bill** to open the existing water-bill lookup portal, or choose **Main page** in the portal header to return.

Bill lookup uses the Customer ID and first two letters of the last name. A successful lookup stays in the current browser tab for up to 15 minutes; **Log out** clears the saved lookup session immediately. This is not Supabase Auth and does not independently verify that the visitor owns the customer account.

## Local development

```sh
npm ci
npm run dev
```

From the `my-app` directory, use `npm run build` to create a production build and `npm run lint` to run ESLint.

## Protecting bill lookups from bots

The lookup function enforces server-side limits of 30 requests per IP and 5 requests per IP/account combination per 10 minutes. Cloudflare Turnstile verification is enabled when `TURNSTILE_SECRET_KEY` is configured; add the matching public site key to the app build before enabling the secret.

1. From the repository root, run the CLI with `npx supabase` (no global install required). Sign in and link the project:

   ```powershell
   npx supabase login
   npx supabase link --project-ref hyxotymypbmkyzghwspj
   ```

2. Apply the database migration with `npx supabase db push`.
3. Deploy the rate-limited function with `npx supabase functions deploy get-water-bill`. It supports the currently deployed app's GET requests as well as POST requests.
4. In Cloudflare, create a Turnstile widget for `xmd5live01-prog.github.io` and any development hostnames you use. Obtain its site key and secret key.
5. Add the Turnstile **site key** as the GitHub Actions repository variable `VITE_TURNSTILE_SITE_KEY`, publish the app, then set `TURNSTILE_SECRET_KEY` in the Supabase project's Edge Function secrets and deploy the function again. This order avoids requiring a challenge before the updated app can send one.
6. The default allowed origin is the production GitHub Pages site; set `ALLOWED_ORIGINS` to a comma-separated list of exact origins when adding other sites or enabling local development (for example, `https://xmd5live01-prog.github.io,http://localhost:5173,http://127.0.0.1:5173`).

The site key is public; never put the Turnstile secret or Supabase service-role key in Vite variables or browser code. Keep Supabase Edge Function JWT verification enabled. The function accepts GET and POST requests from the configured app origins and returns generic errors for missing accounts and backend failures.

## Website content management

The invite-only CMS is available at `https://xmd5live01-prog.github.io/wbs/#/admin` (or by choosing **Admin** in the landing-page navigation). It uses Supabase Auth and the public anon key already supplied to the GitHub Pages build. The approved administrator emails are `xmd5live01@gmail.com` and `mangjapli30@gmail.com`; no passwords are stored in this repository.

Before signing in for the first time:

1. From the repository root, link the Supabase project with `npx supabase link --project-ref hyxotymypbmkyzghwspj` if it is not linked already, then apply the migration with `npx supabase db push`.
2. In the Supabase dashboard, invite each approved administrator under **Authentication → Users** and finish password setup using Supabase's invite flow.
3. Confirm the GitHub Actions secret `VITE_SUPABASE_ANON_KEY` is configured, then deploy the app.

Administrators can edit the hero slides, announcements, services, payment providers, steps, shared page headings, and site branding. In **Site settings**, select the current landing-page layout or one of three alternatives: **Modern Minimal**, **Warm Community**, or **Elegant Water**. Templates rearrange the existing sections and adjust presentation while retaining the same editable content, images, and color palette. Upload a logo and hero background (JPEG, PNG, or WebP, up to 5 MB each) and customize the site's primary, accent, background, surface, text, and muted text colors. **Reset branding** restores the default palette and removes the images from the draft; uploaded files are retained so published revisions that use them continue to work. Image uploads use the public `cms-media` Supabase Storage bucket, so apply the storage migration in `supabase/migrations/` before using uploads. Entries can be reordered or deactivated without being deleted. **Save draft** stores unpublished edits, **Preview** displays the draft in the current browser session, and **Publish** makes the saved content live while recording a revision. Restoring a revision only replaces the draft; publish it separately to make it public. Public visitors can read only the published version.

If you do not have an administrator password yet, choose **Forgot password?** on the CMS sign-in page and follow the reset email to set one. In **Authentication → URL Configuration** in the Supabase dashboard, set the **Site URL** to `https://xmd5live01-prog.github.io/wbs/` and add `https://xmd5live01-prog.github.io/wbs/?cms-recovery=1` to **Redirect URLs**. The CMS always sends recovery links to this production callback, including when a reset is requested from a local development server.

The CMS also supports **Continue with Google**, which avoids password-reset email limits. Configure a Google OAuth client with application type **Web application** in Google Cloud. Add `https://xmd5live01-prog.github.io` as an authorized JavaScript origin and `https://hyxotymypbmkyzghwspj.supabase.co/auth/v1/callback` as its authorized redirect URI. In Supabase **Authentication → Sign In / Providers → Google**, enable Google and enter the Client ID and Client Secret from that same Google OAuth client. In Supabase **Authentication → URL Configuration**, set the Site URL to `https://xmd5live01-prog.github.io/wbs/` and add `https://xmd5live01-prog.github.io/wbs/?cms-oauth=1` to Redirect URLs. If Google's consent screen is in testing mode, add the administrator Gmail address as a test user. Sign in using the Google account for an email in `public.cms_admins`; other Google accounts are denied CMS authorization.

If Google returns `Unable to exchange external code`, the OAuth callback could not redeem Google's short-lived sign-in code. Verify the matching Client ID and Client Secret, the exact Supabase callback URI above, and that the OAuth code is not being reused from an old tab. The CMS displays this setup guidance on the sign-in page when that callback fails.

The CMS schema and administrator allowlist are managed by the migrations in `supabase/migrations/`. Add administrators by creating a migration that inserts their lowercase email into `public.cms_admins`, then invite them separately through **Authentication → Users**. Do not expose a Supabase service-role key in the browser or GitHub Pages build; all administrator operations use the authenticated session and row-level security.
