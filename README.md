# Walther League website

The site for waltherleague.site, built from the approved Nov 10 mockup (Editorial style). It reads from and writes to the Walther League's own Supabase project. The chapters in the database are still sample data.

## Run it

Double-click `index.html`, or serve the folder (`python -m http.server 8765`) and open http://localhost:8765. No install or build step.

To try the office and chair views without signing in, open `tests/demo.html` the same way. It is a practice copy that runs on made-up data and saves nothing. Sign in there with `office@example.com` or `chair@example.com` and the code `123456`.

## Files

- `index.html`: page shell (top bar, navigation, footer)
- `css/styles.css`: all styling (Playfair Display and Source Sans)
- `js/config.js`: the project URL, the publishable key, and the banner text. The publishable key is safe in public code. Never put the secret or service_role key in the site.
- `js/data.js`: shared constants and the empty lists the pages draw from
- `js/api.js`: the only file that talks to the database
- `js/app.js`: pages, routing, forms, and the office and chair views
- `js/vendor/supabase.js`: the supabase-js library, included so there is no build step
- `supabase/migrations/`: the database changes, in order, matching what is applied to the live project
- `supabase/not_applied/`: an older draft migration that was never run. Kept for reference only.
- `tests/demo.html` and `tests/fake_client.js`: the practice copy

Scripts load in this order: vendor/supabase.js, config.js, data.js, api.js, app.js.

## What the site does

Public pages (no sign-in, no member accounts):

- About, chapter directory with map, chapter pages, events and announcements calendar, help and support
- Interest map: a visitor marks their city and asks for a chapter. The public map shows places and head counts only.
- Start a chapter: the application, including the pastoral sponsor's congregation and city
- Contact a chapter, talk with the pastor, RSVP, and the support form all go to the inquiry log
- Leaders appear by first name and role only. No personal email addresses or member lists.

Office view (people with the `office` role, such as Hanna):

- Overview: metrics, and applications in progress. Each application goes Received, Pastor verified, Recommendations confirmed, Approved, then Publish. The database refuses to publish until the pastor is verified and the application is approved.
- Inquiries: every message, with a flag on anything unanswered after 48 hours
- Interest map: people grouped by place, with a "Ready to connect" flag at 3 or more (change `CLUSTER_MIN` in `js/data.js`)
- Chapters: leader changes to review, status, September 1 renewal, and hide or show. Approving a leader change replaces the chapter's leaders, sends its two email addresses to the new people, and renews the chapter. A new pastoral sponsor must be confirmed first; the database refuses otherwise.
- Calendar: network-wide events and announcements
- Email forwarding: who receives each role address

Chairs and co-chairs: sign in, then edit their own chapter page, post or remove its events, and send a leader change request (new chair, co-chairs, or pastoral sponsor) for the office to approve. One request per chapter can be waiting at a time. The database blocks them from changing leaders, city, status, and other office fields directly.

## Sign-in

Sign-in is by a code sent to the person's email. No passwords.

- A chair or co-chair is linked to their chapter the first time they sign in with the email on their chapter's leader record.
- To make someone office staff: have them sign in once, then in Supabase open Table Editor, `profiles`, and set their `role` to `office`.
- In Supabase, set up custom SMTP (Authentication, Emails) so codes are delivered reliably, and make sure the Magic Link and Confirm signup templates include `{{ .Token }}` so the email shows the code.
- Turn on leaked password protection (Authentication, password settings).

## Database migrations

| File | Live project |
| --- | --- |
| `0001_initial_schema.sql` | applied Nov 20 |
| `0002_interest_map_and_pastor_verification.sql` | applied Nov 23 |
| `0003_public_leaders_first_name_only.sql` | applied Nov 23 |
| `0004_site_connection.sql` | applied Nov 23: application details, chair sign-in link, first names without titles |
| `0005_publish_shared_email.sql` | applied Nov 23: publishing works when the chair and co-chair share one email address |
| `0006_leader_change_requests.sql` | applied Nov 23: chairs propose new leaders, the office approves |

## Not done yet

- Email forwarding itself. The role addresses and their recipients are stored and editable, but no mail is forwarded until the domain moves to Cloudflare and Email Routing is synced from `email_aliases` and `alias_recipients`. Until then, messages sent through the site's forms are saved to the inquiry log only.
- Hosting under League-owned accounts and the custom domain
- Replacing the sample chapters with real ones (see the bottom of `supabase/seed_sample_data.sql`), then clearing the banner text in `js/config.js`
