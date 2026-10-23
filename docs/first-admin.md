# Creating admin accounts

There is no sign-up page anywhere in the shop. Admin accounts are created by
the shop owner. You create the **first super admin** once in the Supabase
dashboard (below); after that, add staff from **Admin → Settings → Staff & roles**.

## 1. Turn off public sign-ups

Supabase dashboard → **Authentication → Sign In / Providers** → turn off
**Allow new users to sign up**. (Locally, set `enable_signup = false` under
`[auth]` in `supabase/config.toml`.)

Even if this were left on, a new account would not be an admin: every admin
check reads `admin_profiles`, which the app cannot write to.

## 2. Create the user

**Authentication → Users → Add user → Create new user**: your email, a long
unique password, and tick **Auto Confirm User**.

## 3. Make it an admin

**SQL Editor**, replace the email and run:

```sql
insert into public.admin_profiles (user_id, full_name, role)
select id, 'Your Name', 'super_admin'
from auth.users
where email = 'you@example.com';
```

## Roles

| Role | Can do |
|---|---|
| **Super admin** | Everything, including Settings, courier keys, Facebook settings, staff and the role permissions |
| **Manager** (default) | Dashboard, sales/reports, orders (edit items, delete, CSV), courier booking, products, coupons, stock, customers |
| **Support** (default) | Dashboard counts (no money), orders (status, notes, payment, customer details), courier booking, customers |

What Manager and Support can do is a tick-box matrix in **Settings → Staff &
roles**. The database checks the same permission (`has_permission()`) in every
policy and function, so hiding a menu item is never the only protection.

## 4. Sign in and turn on two-factor

Open `/admin/login`, sign in, then **My account → Set up two-factor sign-in**
and scan the QR code with an authenticator app. From then on the database
itself (`is_admin()`) only treats that account as an admin when the session
includes the code — a leaked password alone is not enough.

## Adding and removing staff

**Settings → Staff & roles → Add a staff member**: name, login email, a first
password (10+ characters) and the role. The login is created in Supabase Auth
by the server after the database confirmed you are a super admin.

To remove access, untick **Active** and save — it takes effect on the next
request and their open orders are unassigned. You cannot demote or switch off
your own account (so the shop is never locked out). To remove the person completely,
delete the user under Authentication → Users (their profile row goes with it).

## Lost authenticator

In the dashboard, Authentication → Users → the user → remove the MFA factor,
then they can sign in with the password and enrol again.
