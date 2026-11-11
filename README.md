# MedTeds

A blogging platform for stories about medicine and health. Anyone can sign up, write and publish; readers can clap, respond, follow writers and save stories; editors run the site from an admin area.

![Home page](docs/screenshots/home.png)

## Stack

| Part | Choice |
|---|---|
| Framework | Next.js 16 (App Router) with TypeScript |
| Styling | Tailwind CSS 4 with MedTeds design tokens |
| Components | Own component library in `src/components/ui` (shadcn-style, built with `class-variance-authority`) |
| Database | PostgreSQL with Drizzle ORM (works with Supabase, Neon or any Postgres) |
| Sign-in | Better Auth: email and password, plus optional Google |
| Editor | Tiptap |
| Images | Stored in Postgres by default, or in Supabase Storage when configured |

## Pages

**Readers**

| Page | Path |
|---|---|
| Home feed (For you, Following, topic tabs) | `/` |
| Story | `/p/[slug]` |
| Writer profile | `/@username` |
| Topic | `/tag/[slug]` |
| All topics | `/topics` |
| Search (stories, people, topics) | `/search?q=` |
| Reading list | `/reading-list` |
| Sign in / Sign up | `/signin`, `/signup` |
| About, Privacy, Terms | `/about`, `/privacy`, `/terms` |
| Design system | `/design` |

**Writer CMS**

| Page | Path |
|---|---|
| New story | `/write` (opens a new draft) |
| Editor (autosave, images, topics, cover, publish) | `/editor/[id]` |
| Your stories (drafts and published) | `/me/stories` |
| Settings (profile, photo, theme) | `/settings` |

**Admin CMS** (accounts with the `admin` role)

| Page | Path |
|---|---|
| Overview | `/admin` |
| Stories: publish, unpublish, Editor's picks, delete | `/admin/stories` |
| Members: grant admin, suspend | `/admin/users` |
| Topics: add, edit, delete | `/admin/topics` |
| Responses: moderate | `/admin/comments` |

## Run it locally

You need Node.js 20+ and a PostgreSQL database.

1. Install packages:

   ```bash
   npm install
   ```

2. Copy the settings file and fill it in:

   ```bash
   cp .env.example .env
   ```

   Set `DATABASE_URL` to your database and `BETTER_AUTH_SECRET` to a random string (`openssl rand -base64 32`).

3. Create the tables:

   ```bash
   npm run db:migrate
   ```

4. Optional: add sample topics, writers and stories:

   ```bash
   npm run db:seed
   ```

   Sample accounts use the password `medteds-demo`. `admin@medteds.local` is an admin; writers include `amara@medteds.local`.

5. Start the app at http://localhost:3000:

   ```bash
   npm run dev
   ```

### Making someone an admin

Emails listed in `ADMIN_EMAILS` get the admin role when they sign up. After that, admins can promote other members from **Admin → Members**.

## Deploy (Vercel + Supabase)

1. Create a Supabase project. Copy its database connection string (Project Settings → Database → Session pooler URI).
2. Run the migrations against it once: `DATABASE_URL="<supabase uri>" npm run db:migrate`.
3. Optional: create a public Storage bucket called `media` and set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` so uploaded images go to Supabase Storage instead of the database.
4. Import the repository in Vercel and add the variables from `.env.example`. Set `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` to your site's address.
5. For Google sign-in, create OAuth credentials in Google Cloud with the redirect URL `https://<your-site>/api/auth/callback/google`, then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

## Design system

All colours, fonts, sizes, corner rounding and shadows are tokens in `src/app/globals.css`, with light and dark values. Tailwind classes use the token names, for example `bg-surface`, `text-muted`, `border-line`, `bg-accent`, `rounded-pill`, `shadow-card`. Change the brand colour by editing `--accent`.

| Folder | What's in it |
|---|---|
| `src/components/ui` | Building blocks: Button, Input, Textarea, Select, Field, Chip, Badge, Avatar, Cover, Tabs, EmptyState, Logo |
| `src/components/blog` | Reader features: TopBar, StoryCard, Sidebar, ClapButton, BookmarkButton, FollowButton, Comments, ThemeToggle |
| `src/components/cms` | Writer tools: StoryEditor, ProfileForm, upload helper |
| `src/components/admin` | Admin navigation, tables and actions |

Open `/design` in the running app to see every component in light and dark.

## Project layout

```
src/
  app/            Pages and API routes
  components/     UI, blog, CMS and admin components
  db/             Drizzle schema and database client
  lib/            Auth, queries (reads), actions (writes), content rendering, storage
  proxy.ts        Sends signed-out visitors to sign in before private pages
drizzle/          SQL migrations
scripts/seed.ts   Sample data
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` / `npm run typecheck` | Code checks |
| `npm run db:generate` | Create a migration after changing `src/db/schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Add sample data to an empty database |
| `npm run db:studio` | Browse the database in Drizzle Studio |

## Known issue

In production builds, opening `/design` or `/settings` by typing the address, straight after another page in the same tab, can log a React hydration warning (#418) in the browser console. React recovers on its own and the page works normally. The cause hasn't been pinned down yet.
