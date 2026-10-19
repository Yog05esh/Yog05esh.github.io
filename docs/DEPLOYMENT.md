# Deploy STRATA static demo

This guide deploys the static replay at `https://strata-ai.me`. The site exports from `apps/web/out`; it does not host the FastAPI engine or expose any secret.

## 1. GitHub Pages and custom domain

1. In the repository, open **Settings > Pages** and select **GitHub Actions** as the build source.
2. In **Custom domain**, enter `strata-ai.me` and save it before changing DNS. Verify the domain in GitHub if prompted.
3. At the DNS provider, create these apex `A` records for `strata-ai.me`:

   | Host | Type | Value |
   | --- | --- | --- |
   | `@` | `A` | `185.199.108.153` |
   | `@` | `A` | `185.199.109.153` |
   | `@` | `A` | `185.199.110.153` |
   | `@` | `A` | `185.199.111.153` |

   An `ALIAS` or `ANAME` to the repository's GitHub Pages hostname is an alternative when the DNS provider supports it. Do not use wildcard records.
4. Add `www` as a `CNAME` pointing to the GitHub Pages hostname for this repository, for example `your-account.github.io`. Do not use the apex domain as the CNAME target.
5. Wait for DNS propagation, then return to **Settings > Pages** and enable **Enforce HTTPS** as soon as GitHub makes it available.
6. Verify both `https://strata-ai.me` and `https://www.strata-ai.me`. The static export contains `CNAME` and `404.html` in `apps/web/public` so both are copied to the Pages artifact.

GitHub's current custom-domain record values and HTTPS guidance are documented in [GitHub Pages custom domains](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

## 2. Supabase

1. Create a Supabase project.
2. In the SQL Editor, paste and run [`supabase/schema.sql`](../supabase/schema.sql). This creates Altygen Biopharm, demo join codes, the redemption function, and RLS policies.
3. In **Authentication > Providers**, enable Google. Paste the Google OAuth client ID and client secret created in the next section.
4. In **Authentication > URL Configuration**, set **Site URL** to `https://strata-ai.me` and add these exact **Redirect URLs**:

   ```text
   https://strata-ai.me/google
   https://www.strata-ai.me/google
   http://localhost:3000/google
   ```

   The app passes `/google` as `redirectTo`, so it must be on Supabase's allow list.
5. In **Project Settings > API**, copy the project URL and the publishable key. Never copy a service-role key into this repository, GitHub Variables, or the browser.

No demo users must be created manually in Supabase Auth. One-click roles stay local to each browser. Google users are created by Google OAuth on their first successful login and then select a demo role or redeem a demo code.

## 3. Google Cloud OAuth

1. In Google Cloud, create or select a project and configure the OAuth consent screen and publishing audience.
2. Create an OAuth client of type **Web application**.
3. Add these **Authorized JavaScript origins**:

   ```text
   https://strata-ai.me
   https://www.strata-ai.me
   http://localhost:3000
   ```

4. Add this **Authorized redirect URI**, replacing `<project-ref>` with the Supabase project reference:

   ```text
   https://<project-ref>.supabase.co/auth/v1/callback
   ```

   Google redirects to Supabase first. Supabase then redirects the browser to `/google` on STRATA.
5. Copy the Google client ID and secret only into the Supabase Google provider settings. Do not put the secret in GitHub, `.env.example`, or client code.

See [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google) and [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls) for the current provider flow.

## 4. GitHub repository variables

In **Settings > Secrets and variables > Actions > Variables**, create only these two repository variables:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key |

The Pages workflow reads these as `vars.*`, uses Node 20, builds with `NEXT_PUBLIC_DEMO=1`, and uploads `apps/web/out`. It does not require a GitHub Actions secret for this static demo.

## 5. Verification checklist

- `npm ci` and `NEXT_PUBLIC_DEMO=1 npm run build` succeed in `apps/web`.
- `apps/web/out/CNAME` contains `strata-ai.me`.
- `apps/web/out/404.html` exists after export.
- Google sign-in opens the provider and returns to `https://strata-ai.me/google`.
- A Google user can redeem one valid code, while invalid, expired, exhausted, and repeated codes are rejected.
- A demo user can reset only their own saved demo records.
