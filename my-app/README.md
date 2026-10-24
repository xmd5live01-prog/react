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

1. Install the Supabase CLI and link this project with `supabase link --project-ref hyxotymypbmkyzghwspj`.
2. Apply the database migration with `supabase db push`.
3. Deploy the rate-limited function with `supabase functions deploy get-water-bill`. It supports the currently deployed app's GET requests as well as POST requests.
4. In Cloudflare, create a Turnstile widget for `xmd5live01-prog.github.io` and any development hostnames you use. Obtain its site key and secret key.
5. Add the Turnstile **site key** as the GitHub Actions repository variable `VITE_TURNSTILE_SITE_KEY`, publish the app, then set `TURNSTILE_SECRET_KEY` in the Supabase project's Edge Function secrets and deploy the function again. This order avoids requiring a challenge before the updated app can send one.
6. The default allowed origin is the production GitHub Pages site; set `ALLOWED_ORIGINS` to a comma-separated list of exact origins when adding other sites or enabling local development (for example, `https://xmd5live01-prog.github.io,http://localhost:5173,http://127.0.0.1:5173`).

The site key is public; never put the Turnstile secret or Supabase service-role key in Vite variables or browser code. Keep Supabase Edge Function JWT verification enabled. The function accepts GET and POST requests from the configured app origins and returns generic errors for missing accounts and backend failures.
