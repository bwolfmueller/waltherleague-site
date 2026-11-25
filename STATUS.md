# Where things stand (Nov 25, 2026)

Paused for two weeks. Pick up at "Next, in order".

## Working

- Test site: https://bwolfmueller.github.io/waltherleague-site/
- Practice copy with made-up data: https://bwolfmueller.github.io/waltherleague-site/tests/demo.html (sign in with `office@example.com` or `chair@example.com`, code `123456`)
- Public pages, the application, contact, and interest forms, and the interest map, all on the live League database
- Office view, chair tools, and leader change requests (built and tested on the practice copy and against the live access rules)
- Six database migrations applied; the `supabase/migrations` folder matches the live project
- `admin@waltherleague.site` is a working Google Workspace mailbox. The domain's mail records now point only to Google.

## Not working yet

**Sign-in on the real site.** Supabase is set to send codes through Google as `admin@waltherleague.site`, but Google rejects the login ("535 Username and Password not accepted"). Until this is fixed, nobody can sign in, so the office and chair views are reachable only on the practice copy.

## Next, in order

1. **Fix the sign-in mail password.**
   - Signed in to Google as `admin@waltherleague.site`, turn on 2-Step Verification, then create an app password at https://myaccount.google.com/apppasswords
   - Paste it, without spaces, into the Password field at https://supabase.com/dashboard/project/lujdmcwvowhwjfgnwksa/auth/smtp and save
2. **Check both email templates** at https://supabase.com/dashboard/project/lujdmcwvowhwjfgnwksa/auth/templates. Magic Link and Confirm signup must each contain `{{ .Token }}` so the email shows a code and not a link. Not yet confirmed.
3. **Test sign-in** on the test site with the office email.
4. **Office users.** The only office user is Bryan's personal email. Decide whether `admin@waltherleague.site` should be one (it has an account with no access). Hanna signs in once, then her `role` is set to `office` in the `profiles` table.
5. **Role addresses.** Make `help@`, `info@`, and each chapter's two addresses Google Groups in Workspace. Cloudflare Email Routing is no longer the plan, because Google Workspace handles the domain's mail.
6. **Real address.** Point waltherleague.site at the site and set the Supabase Site URL to match.
7. **Real chapters.** Remove the sample data (see the bottom of `supabase/seed_sample_data.sql`), enter the real chapters, clear the banner in `js/config.js`.
8. Turn on leaked password protection in Supabase.

## Ownership

Everything is under Bryan's accounts for now, by choice: the Bluehost account (domain, DNS, Google Workspace billing), this GitHub repository, and the test site. The Supabase project is in the League's own organization. Moving the rest to the League later is a GitHub "Transfer ownership", new contact and billing details at Bluehost, and a second owner on Supabase and Workspace.

## Worth knowing while it sits

- The test site is public but unlisted, and its forms write to the live database. Anything submitted shows up in the office view. Sample chapters and the "Preview" banner are still showing.
- Messages sent through the site's forms are saved to the inquiry log only. No email is forwarded to chapters yet.
