# Wearabouts — Build Plan

**Name:** Wearabouts  
**Submotto:** outfit forecaster  
**Hero one-liner:** Fit in anywhere with style recs based on place and weather

---

## 1) Architecture (monorepo)

```
wearabouts/
  apps/
    web/            # React + shadcn + Vite
    api/            # Express (Node 20) + Vercel AI SDK server routes
  packages/
    shared/         # shared ts types + utils
  infra/
    supabase/       # SQL, RLS policies, seed
```

**Tech Stack:**
- Auth & data: Supabase (Auth + Postgres)
- LLM: Vercel AI SDK (OpenAI key)
- Weather: Open-Meteo (forecast + geocoding)
- Images: Google Programmable Search (CSE Image) + domain whitelist
- Hosting: Vercel (web + api) or Render/Fly for api/ if you prefer

### Required Environment Variables

```
OPENAI_API_KEY=
GOOGLE_CSE_KEY=
GOOGLE_CSE_CX=             # Custom Search Engine ID
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY= # api only
RETAILER_WHITELIST=uniqlo.com,everlane.com,jcrew.com,cos.com,rei.com,patagonia.com,arcteryx.com,llbean.com
```

---

## 2) Data Model (Supabase)

```sql
-- users come from supabase.auth.users

create table public.searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  query text not null,                 -- raw user text
  resolved_place jsonb not null,       -- {name, admin1, country, lat, lon}
  forecast jsonb not null,             -- normalized 7-day summary used to generate outfits
  outfits jsonb not null,              -- array<DayAdvice> (see types)
  created_at timestamptz default now()
);

-- RLS
alter table public.searches enable row level security;
create policy "own rows read" on public.searches for select
  using (auth.uid() = user_id);
create policy "own rows write" on public.searches for insert
  with check (auth.uid() = user_id);
```

### Shared Types (packages/shared/types.ts)

```typescript
export type ResolvedPlace = {
    name: string
    admin1?: string
    country?: string
    lat: number
    lon: number
    confidence: number
    altCandidates?: ResolvedPlace[]
}

export type DayForecast = {
    date: string
    highF: number
    lowF: number
    precipChance: number
    windMph: number
    uvIndex: number
    condition: 'sun' | 'clouds' | 'rain' | 'snow' | 'mixed'
}

export type DayAdvice = {
    date: string
    outfit: string[]        // "merino base", "light shell", "waterproof shoes"
    notes?: string
    images?: ImageCard[]    // from CSE
}

export type ImageCard = {
    id: string
    title: string
    src: string
    href: string
    source: string
    width?: number
    height?: number
}

export type SearchRecord = {
    id: string
    query: string
    resolved_place: ResolvedPlace
    forecast: DayForecast[]
    outfits: DayAdvice[]
    created_at: string
}
```

---

## 3) API Contracts (apps/api)

All endpoints expect a Supabase access token in `Authorization: Bearer <jwt>` if the user is logged in. Guests allowed for generate; save is auth-gated.

### Endpoints

```
POST /api/resolve
body: { query: string }
res:  { place: ResolvedPlace, candidates?: ResolvedPlace[] }

POST /api/forecast
body: { lat: number, lon: number }
res:  { days: DayForecast[] }    // 7 days

POST /api/generate-outfits
body: { place: ResolvedPlace, days: DayForecast[], persona?: 'minimal'|'outdoorsy'|'street'|'business' }
res:  { outfits: DayAdvice[] }

GET  /api/images
query: ?q=<item>
res:  { images: ImageCard[] }

POST /api/save
body: { query: string, place: ResolvedPlace, days: DayForecast[], outfits: DayAdvice[] }
res:  { id: string }

GET  /api/history
res:  { searches: SearchRecord[] }
```

---

## 4) LLM Workflows

### 4a) Location Resolver (colloquial text → candidates)

**Pipeline:**
1. LLM extracts likely places from the user phrase (nicknames, rivalries, stadiums)
2. Open-Meteo Geocoding for each candidate → lat/lon + locality
3. Score & pick top, keep alternates

**Prompt (system):**
```
You extract place candidates from colloquial hints.
Return 3-5 city-level candidates max with country and state/region if known.
Prefer US cities when hints reference Ivy League or MLB/NFL/NBA teams.
Output as JSON array with fields: name, admin1, country.
No prose.
```

**Call:** `extractCandidates(query)` → list of `{ name, admin1?, country? }`  
Then `GET https://geocoding-api.open-meteo.com/v1/search?name=<name>&count=3&language=en&format=json` per candidate.

### 4b) Outfit Generator (rule-first + LLM seasoning)

- Compute base items via deterministic rules (below)
- Ask LLM to refine notes only, not core items, for tone/clarity

**Rules (pseudo):**

```javascript
const bands = [
    { max: 40, add: ['insulated coat', 'thermal base', 'beanie', 'warm socks'] },
    { max: 55, add: ['sweater', 'medium jacket'] },
    { max: 72, add: ['tee or long-sleeve', 'light layer'] },
    { max: 84, add: ['breathable tee', 'light pants or shorts'] },
    { max: 200, add: ['ultra-light top', 'linen or tech shorts'] }
]

export const outfitFor = (d: DayForecast): string[] => {
    const core = bands.find(b => d.highF <= b.max)!.add
    const add: string[] = []
    if (d.precipChance >= 40) add.push('waterproof shell', 'non-absorbent shoes')
    if (d.windMph >= 18) add.push('windbreaker')
    if (d.uvIndex >= 7) add.push('hat', 'sunglasses')
    if (d.lowF <= 38) add.push('gloves')
    return Array.from(new Set([...core, ...add]))
}
```

**Prompt (system):**
```
You write one-sentence outfit notes for daily weather.
Do not change the item list provided. No brand names. Friendly, concise.
Return array of strings, one per input day.
```

**Prompt (user):**
```
Days:
1) 74/58F, rain 60%, wind 10 mph, UV 5 → items: ["breathable tee","light pants","waterproof shell"]
2) ...
```

---

## 5) Image Search Adapter (Google CSE)

**Server util (api/src/providers/cse.ts):**

```javascript
import { ImageCard } from '@shared/types'

const wl = (process.env.RETAILER_WHITELIST ?? '').split(',').map(s => s.trim()).filter(Boolean)

export const searchImages = async (item: string, max = 6): Promise<ImageCard[]> => {
    const q = `${item} site:${wl.join(' OR site:')}`
    const url = new URL('https://www.googleapis.com/customsearch/v1')
    url.searchParams.set('searchType', 'image')
    url.searchParams.set('imgType', 'photo')
    url.searchParams.set('imgSize', 'large')
    url.searchParams.set('num', String(Math.min(max, 10)))
    url.searchParams.set('q', q)
    url.searchParams.set('key', process.env.GOOGLE_CSE_KEY!)
    url.searchParams.set('cx', process.env.GOOGLE_CSE_CX!)
    const res = await fetch(url.toString())
    const json = await res.json()
    return (json.items ?? []).map((it: any) => ({
        id: it.cacheId ?? it.link,
        title: it.title,
        src: it.link,
        href: it.image?.contextLink ?? it.link,
        source: new URL(it.image?.contextLink ?? it.link).hostname,
        width: it.image?.width,
        height: it.image?.height
    }))
}
```

---

## 6) UI Spec (apps/web)

### Pages
- `/` landing + search
- `/results/:id?` anonymous view (after generate); if authed and saved, id loads from DB
- `/history` requires auth (Supabase) → list of past searches (cards)

### Core Components
- `LocationInput` (single field, playful placeholder)
- `CandidateChip` (if resolver found alternates)
- `WeekGrid` (7 cards)
- `DayCard` (emoji weather, hi/lo, outfit chips, 2–3 images)
- `PackListBar` (unique items across the week)
- `SaveButton` (disabled for guests → opens login)
- `AuthButton` (supabase oauth: Google/Apple/email magic link)

### shadcn/UI & Styling
- Card, Badge, Button, Input, Skeleton, Tabs
- Cards use `aspect-[4/5]` for images, `object-cover`, soft gradient overlay
- Palette: off-white bg, charcoal text, muted weather accents per day

### Flow
1. User types colloquial text → optimistic skeleton → `/api/resolve`
2. Auto-fetch `/api/forecast` + `/api/generate-outfits`
3. For each `DayAdvice.outfit` item, lazy-fetch `/api/images?q=<item>` and display top 1–3 images
4. Pack list aggregates unique items; copy button for week summary
5. If authed, Save persists to Supabase; show "View history" CTA

---

## 7) Supabase Auth & RLS

- Client: `@supabase/supabase-js` in web app
- On save/history calls, include `Authorization: Bearer <sb access token>`
- In api/, verify JWT with Supabase JWKS or use `@supabase/auth-helpers-remix` pattern to parse claims
- Keep service role key server-only for DB inserts that need bypass, but prefer row-owner inserts from client with RLS

---

## 8) Implementation Steps (checklist)

### MVP (core)
- [ ] Setup monorepo, Tailwind + shadcn in web/
- [ ] Supabase project, run SQL above, enable RLS
- [ ] POST /resolve → LLM extract + Open-Meteo geocode
- [ ] POST /forecast → Open-Meteo 7-day daily
- [ ] POST /generate-outfits → rule engine + LLM notes
- [ ] GET /images → Google CSE adapter (whitelist env)
- [ ] Landing + WeekGrid UI with skeletons
- [ ] Supabase auth (Google + magic link)
- [ ] POST /save, GET /history wired, RLS verified

### Polish
- [ ] Alternate-candidate picker ("Not quite? Try Cambridge, UK")
- [ ] Pack list + copy/share
- [ ] Image scoring (prefer higher res + simpler backgrounds)
- [ ] Error/empty states (quota exceeded, no images, etc.)

### Performance
- [ ] Cache resolved place + forecast by query (edge cache 1h)
- [ ] Cache image search by item (2–6h)
- [ ] Stream LLM notes with Vercel AI SDK

---

## 9) Key Implementation Snippets

### Forecast Normalizer (api)

```javascript
export const toF = (c: number) => Math.round(c * 9/5 + 32)

export const normalizeDays = (raw: any): DayForecast[] => {
    const out: DayForecast[] = []
    const n = raw.daily.time.length
    for (let i = 0; i < n; i++) {
        out.push({
            date: raw.daily.time[i],
            highF: toF(raw.daily.temperature_2m_max[i]),
            lowF: toF(raw.daily.temperature_2m_min[i]),
            precipChance: Math.round((raw.daily.precipitation_probability_max?.[i] ?? 0)),
            windMph: Math.round((raw.daily.wind_speed_10m_max?.[i] ?? 0) * 0.621371),
            uvIndex: Math.round(raw.daily.uv_index_max?.[i] ?? 0),
            condition: mapToCondition(raw.daily.weather_code?.[i])
        })
    }
    return out
}
```

### Day Card Item → Images (web)

```javascript
const useItemImages = (item: string) => {
    const [imgs, setImgs] = useState<ImageCard[]>([])
    useEffect(() => {
        let done = false
        fetch(`/api/images?q=${encodeURIComponent(item)}`)
            .then(r => r.json())
            .then(j => { if (!done) setImgs(j.images?.slice(0, 3) ?? []) })
        return () => { done = true }
    }, [item])
    return imgs
}
```

---

## 10) Testing & Acceptance

### Acceptance Criteria
- [ ] User can type colloquial location text and get a correct place (with alternate selector)
- [ ] Shows 7 day cards with hi/lo, precip, wind, UV
- [ ] Each day shows 3–5 outfit items + a one-line note
- [ ] Each day renders at least one image per 1–3 items
- [ ] UI looks premium (consistent crops, spacing, hover, skeletons)
- [ ] Logged-in user can save and see history
- [ ] No secrets exposed client-side; all external API calls go through api/

### Tests
- [ ] Unit: rule engine (temp bands, precip/wind/uv add-ons)
- [ ] Integration: resolve→forecast→generate flow, DB insert with RLS
- [ ] E2E: guest flow and authed save/history via Playwright

---

## 11) Deployment Notes

- [ ] Create Google CSE with "Search the entire web" and site: whitelist in queries (we build it in code)
- [ ] Add env vars in Vercel for both projects (web, api)
- [ ] Set Supabase URL + anon key in web; service role key only in api
- [ ] Configure CORS on api/ to allow web origin

---

## 12) Stretch (optional, time-boxed)

- [ ] Personas: minimal | outdoorsy | street | business — tweak rule outputs
- [ ] Shareable link: `?id=<searchId>` for read-only public view
- [ ] Pack list export: print-style sheet or PDF
- [ ] Style tuning: optionally parse a Pinterest board URL to infer palette/fabrics (later)

---

*If you want, I can turn this into a /tasks.md for the repo and a /api.http collection for quick testing.*