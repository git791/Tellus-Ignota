# The Last Cartographer
### PRD + Technical Design Doc
**Hackathon:** Reddit's Games with a Hook (Devvit Web + Phaser)
**Status:** Draft v2 — updated with judging-criteria mapping, tilemap/chunking architecture, and team tooling decisions. Ready to hand to a coding agent (Antigravity / Claude Code) or build manually.

---

## 0. Critical platform correction

This hackathon requires submissions to be built as **Devvit apps running as Interactive Posts** on Reddit's Developer Platform, using **Devvit Web** — you can build the client in Phaser, but it must run inside Reddit's post iframe, not as a standalone hosted site. Judging happens by playing your live demo post inside a subreddit.

This is good for your concept:
- "Live Reddit data" (post karma, comment counts, timestamps) is available **natively** through Devvit's server-side Reddit API — no external OAuth/API keys needed.
- Persistence (the shared map) is handled by **Devvit's built-in Redis-backed key-value store**, scoped per-installation. You don't need to stand up your own database or backend server.
- "One action per user per day," "username permanently attached to a tile," and "everyone sees reveals forever" map directly onto Devvit's server functions + Redis + the post's own comment thread.

Judging categories to explicitly build toward: **Polish**, **Reddit-y** (community identity), **Hook-y** (daily return mechanic), and **Best Use of Phaser** (special award).

---

## 1. Product Requirements

### 1.1 One-line pitch
A single, permanent, community-owned map that the whole subreddit uncovers one tile at a time — forever — while decoding live Reddit-data clues in the comments to find buried artifacts.

### 1.2 Core loop (per user, per day)
1. Open the post → see the current state of the shared map (revealed tiles + fog).
2. Pick one **frontier tile** (a fog tile adjacent to an already-revealed tile).
3. Spend your one daily action to reveal it.
4. Your Reddit username is stamped on that tile forever (hover/tap shows who found it and when).
5. If the revealed tile contains an artifact, a clue is posted (auto-comment) and the community races to interpret it using live Reddit signals from that day's post/comments.
6. Come back tomorrow — you get exactly one more move.

### 1.3 Retention Mechanism (explicit judging-category mapping)

This is one of the hackathon's named judging axes — rewarding apps that give people a real reason to come back day after day, via progression, daily challenges, or anticipation of what happens next. This game's core loop is built entirely around that idea, not bolted on:

| Mechanism | How the game does it |
|---|---|
| Hard scarcity | One action per day per user, enforced server-side — same psychological hook as Wordle/Connections |
| Loss aversion / FOMO | The map moves without you. Skip a day and someone else claims the frontier tile you wanted |
| Anticipation | "What did the community reveal overnight?" is a reason to check back even without acting yourself |
| Long-horizon progression | Seasons — the map never resets to zero, it archives and grows, so there's always a "current state of the world" to check |
| Unpredictable payoff | Artifact spawns tied to live post karma/comment count mean today could be the day something rare surfaces |
| Permanent attribution | Your name is carved into a shared, growing artifact — a strong ego-investment hook (see: r/place effect) |

This is arguably the strongest category for this concept — name it explicitly in the Devpost submission writeup rather than leaving judges to infer it.

### 1.4 User Contribution (explicit judging-category mapping)

The hackathon also rewards apps where **user-generated content actively drives engagement** — comments, drawings, puzzles, community-authored content. The base design covers this (username stamping, comment-based clue decoding), but two additions meaningfully sharpen it without adding new systems — they extend the artifact/comment loop already in the MVP:

- **Named landmarks**: the discoverer of a rare tile (mountain peak, ruin, artifact site) gets to *name* it via a text field. That name becomes permanent, visible map lore for everyone. Cheap to build (one input + Devvit's built-in content-filter/moderation tools for text safety), high perceived ownership.
- **Comment-sourced lore**: when an artifact is found and a clue is posted, the top-voted community reply to that clue comment becomes canon — baked into the map's permanent lore/history rather than just staying a comment. This makes the comment thread itself part of the persistent artifact, not just a discussion around it.

Both are listed as stretch goals in the MVP scope below — they extend the existing comment/clue system rather than requiring new infrastructure.

### 1.5 MVP scope (hackathon-realistic, ~1–2 weeks)
Must-have:
- [ ] Shared persistent tile grid (fog + revealed) rendered in Phaser
- [ ] One-reveal-per-user-per-day, enforced server-side
- [ ] Reveal must be adjacent to existing revealed land
- [ ] Username + timestamp stored per tile, shown on tap/hover
- [ ] At least 1 artifact type, whose spawn tile is derived from live Reddit data (e.g. today's post score or comment count)
- [ ] A clue auto-posted as a comment when an artifact is uncovered
- [ ] Mobile-friendly touch controls (pinch/pan/tap)

Nice-to-have (only if time remains):
- [ ] Multiple artifact rarities / lore snippets unlocked progressively
- [ ] Leaderboard (most tiles revealed, first-artifact-finder wall of fame)
- [ ] "Season" archive view of previous map states
- [ ] Sound/music, particle glow effects on artifact reveal
- [ ] **Named landmarks** — discoverer names rare tiles; name becomes permanent map lore (strengthens User Contribution)
- [ ] **Comment-sourced lore** — top-voted reply to a clue comment becomes canon lore text on the map (strengthens User Contribution)

Explicitly **out of scope** for hackathon submission: user-vs-user combat, real-money payments, procedurally generated quests beyond the clue/artifact loop.

### 1.6 Success criteria for judging
| Judging axis | How this idea satisfies it |
|---|---|
| Polish | Small tile-based scope keeps quality high within the time budget; single core loop, no half-built features |
| Reddit-y | Map is literally co-authored by the subreddit; artifacts are decoded via comments; usernames permanently visible |
| Hook-y / Retention | Hard daily action cap + collective FOMO + permanent attribution + seasonal progression — see §1.3 |
| User Contribution | Username stamping, comment-based clue decoding, named landmarks, comment-sourced canon lore — see §1.4 |
| Phaser Innovation | Chunked, infinite runtime tilemap; two-layer fog-of-war via tile layers (not sprites); procedural terrain generation; particle effects on artifact reveal — see §2.4 |

---

## 2. Technical Design

### 2.1 High-level architecture

```
┌─────────────────────────────────────────────┐
│  Reddit Post (Interactive Post / Devvit Web) │
│                                               │
│  ┌─────────────────────────────────────┐    │
│  │  Client (webview) — Phaser 3 + TS    │    │
│  │  - Camera/pan/zoom over tile grid    │    │
│  │  - Renders revealed tiles + fog      │    │
│  │  - Sends reveal requests             │    │
│  └───────────────┬───────────────────────┘    │
│                  │  devvit web bridge (fetch)  │
│  ┌───────────────▼───────────────────────┐    │
│  │  Devvit Server Functions (Node/TS)    │    │
│  │  - validate one-action-per-day rule   │    │
│  │  - validate adjacency                 │    │
│  │  - write tile to Redis                │    │
│  │  - read live Reddit data (score, etc) │    │
│  │  - post clue comment via Reddit API   │    │
│  └───────────────┬───────────────────────┘    │
│                  │                              │
│  ┌───────────────▼───────────────────────┐    │
│  │  Devvit Redis KV store (persistence)  │    │
│  │  - tiles:{x}:{y} → {terrain, user,    │    │
│  │    ts, artifactId?}                   │    │
│  │  - lastAction:{userId} → date         │    │
│  │  - frontier set (revealed tile coords)│    │
│  └────────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### 2.2 Data model (Redis)

| Key pattern | Value | Purpose |
|---|---|---|
| `tile:{x}:{y}` | `{ terrain, revealedBy, revealedAt, artifactId? }` (JSON) | One record per revealed tile. Undiscovered tiles simply have no key — this is what makes the map "infinite": storage cost is proportional only to tiles actually revealed. |
| `frontier` | Redis Set of `"x:y"` strings | All currently-revealed tiles that have at least one unrevealed neighbor. Used to validate "adjacent to discovered land" cheaply without scanning the whole map. |
| `lastAction:{userId}` | ISO date string (day granularity) | Enforces one action per user per UTC day. |
| `artifactSpawns:{seasonId}` | list of `{x,y,triggerRule}` | Precomputed or lazily-derived artifact locations for the current season. |
| `season:{id}:meta` | `{ startedAt, endedAt, archiveSnapshot }` | Supports the "season" reset/archive feature. |

### 2.3 Terrain generation (infinite map, deterministic)

Do **not** pre-generate the world. Generate terrain type on-demand, the first time a tile is revealed, using a seeded noise function so results are reproducible and require no storage until revealed:

```ts
import { createNoise2D } from 'simplex-noise';
import alea from 'alea';

const noise2D = createNoise2D(alea(WORLD_SEED)); // WORLD_SEED fixed per season

function terrainForTile(x: number, y: number): TerrainType {
  const n = noise2D(x * 0.05, y * 0.05); // -1..1
  if (n < -0.4) return 'water';
  if (n < -0.1) return 'forest';
  if (n < 0.2) return 'desert';
  if (n < 0.5) return 'mountain';
  return 'ruins'; // rare band, tune threshold for rarity
}
```

This single function is the entire "infinite map" system. The map is bounded only by integer range — practically infinite.

### 2.4 Rendering: Phaser dynamic tilemaps + chunking + two-layer fog

No external map-design tool (e.g. Tiled) is needed — the map is entirely data-driven, generated at runtime rather than hand-authored. This is a deliberate architectural choice worth calling out for the Phaser Innovation judging category.

**Tilemap, not sprite-per-tile.** Use Phaser's `Tilemaps` API to create blank tilemap layers in code and place tiles programmatically as the server tells the client what's revealed, rather than instantiating individual sprite GameObjects per tile (which doesn't scale to a growing, potentially thousands-of-tiles map):

```ts
const map = this.make.tilemap({ tileWidth: 32, tileHeight: 32, width: CHUNK_SIZE, height: CHUNK_SIZE });
const tileset = map.addTilesetImage('craftpix-tileset', 'terrainAtlas');
const terrainLayer = map.createBlankLayer('terrain', tileset);
const fogLayer = map.createBlankLayer('fog', tileset);

// terrain layer: populate as tiles are revealed
terrainLayer.putTileAt(tileIndexForTerrain(terrain), tileX, tileY);

// fog layer: filled with the fog tile index by default;
// clear it when a tile is revealed instead of managing separate fog sprites
fogLayer.removeTileAt(tileX, tileY);
```

Two-layer approach (terrain underneath, fog on top) is simpler and far more performant than tracking fog as individual sprite objects — Phaser's tilemap renderer batches tile draws efficiently regardless of how many are on screen.

**Chunking for "infinite."** Don't build one giant tilemap object for the whole world. Divide the world into fixed-size chunks (e.g. 32×32 tiles each):
- Only instantiate/render chunks near the camera viewport and the current frontier.
- Destroy or recycle chunks that scroll far out of view (standard technique for infinite-scroll Phaser games).
- The server's `GET /tiles?minX&minY&maxX&maxY` endpoint (below) naturally maps to "give me the chunks visible in this viewport" — client requests by chunk, not by individual tile, to keep request counts low as the map grows.

**Fog logic stays server-authoritative, client-rendered.** The server is the only source of truth for what's revealed; the client never decides this on its own:
1. Client requests all chunks within the current camera viewport.
2. Fog layer starts fully filled (opaque) for every chunk by default.
3. Client clears fog tiles only where the server response says a tile is revealed.
4. Frontier tiles (from the `frontier` Redis set) get a subtle highlight/glow overlay so players see where they're allowed to click.

No fog "reveal animation" logic needs to live server-side — it's purely a client draw-order concern layered on top of server truth.

### 2.5 Asset integration (sprite sheets + tileset)

Downloaded asset packs (Elthen archaeologist sprites, CraftPix terrain tileset, hand-made fog tile) go into the client's static asset folder — for a Vite-based Devvit Phaser template this is typically `src/client/public/assets/...` (confirm the exact path against the scaffolded template, since exact folder names can vary by template version). Anything under `public/` is served automatically; no server-side handling needed for static images.

Loading them in a Phaser scene's `preload()`:

```ts
this.load.spritesheet('archaeologist', 'assets/sprites/archaeologist.png', {
  frameWidth: 32, frameHeight: 32 // must match the pack's actual tile size — check the asset's own docs
});
this.load.image('craftpix-tileset', 'assets/tiles/craftpix-tileset.png');
```

If handing this off to a coding agent: explicitly point it at the asset folder path first (e.g. "list `src/client/public/assets/` and use what's there for terrain/character sprites") — an agent won't automatically notice newly-added binary asset files without being told to look.

### 2.6 One-action-per-day enforcement (server function)

```ts
async function revealTile(userId: string, x: number, y: number) {
  const today = new Date().toISOString().slice(0, 10); // UTC day
  const last = await redis.get(`lastAction:${userId}`);
  if (last === today) throw new Error('Already acted today');

  const isFrontier = await redis.sismember('frontier', `${x}:${y}`);
  if (!isFrontier) throw new Error('Tile not adjacent to revealed land');

  const terrain = terrainForTile(x, y);
  const artifactId = await checkArtifactSpawn(x, y); // see 2.6

  await redis.set(`tile:${x}:${y}`, JSON.stringify({
    terrain, revealedBy: userId, revealedAt: Date.now(), artifactId,
  }));
  await redis.srem('frontier', `${x}:${y}`);
  await updateFrontierNeighbors(x, y); // add newly-adjacent fog tiles to frontier set
  await redis.set(`lastAction:${userId}`, today);

  if (artifactId) await postClueComment(artifactId, x, y);

  return { terrain, artifactId };
}
```

### 2.7 Artifact placement from live Reddit data

This is the "hook" that ties gameplay to Reddit itself. Devvit gives your server function direct, authenticated access to the current post/subreddit via `reddit.getPostById()`, `reddit.getComments()`, etc. — no external Reddit API app needed.

Example rule: an artifact spawns on the tile whose coordinate hash matches a value derived from **today's post score modulo N**, recalculated once per day:

```ts
async function getTodaysArtifactCoordinate(postId: string) {
  const post = await reddit.getPostById(postId);
  const score = post.score;              // live karma
  const commentCount = post.numberOfComments; // live comment count
  const seed = score * 31 + commentCount;
  // Map seed deterministically onto a frontier tile using a hash function
  return pickFrontierTileFromSeed(seed);
}
```

Because `score` and `commentCount` change throughout the day, you can present this to players as "the map shifts with the community's activity" — the clue-decoding metagame is literally: *watch the post's karma/comments, predict where the artifact will land next.*

When an artifact tile is revealed, auto-post a comment (via `reddit.submitComment()`) containing the next clue — this both documents the find and drives comment-thread engagement, which judges will see directly in your demo post.

### 2.8 Frontend stack

- **Phaser 3** (TypeScript) for the map/camera/sprite layer — chunked runtime tilemap rendering (§2.4), camera pan/zoom/pinch, particle emitter for artifact glow.
- **Devvit Web client bridge** for calling your server functions from inside the webview.
- Sprites: Elthen's archaeologist pack (character), CraftPix free top-down tileset (terrain), hand-made fog tile, Phaser `ParticleEmitter` for glow (no asset needed).

### 2.9 Suggested repo structure

```
/src
  /client        (Phaser game, TS)
    /scenes
      MapScene.ts
      UIScene.ts
    /systems
      FogRenderer.ts
      CameraController.ts
    main.ts
  /server         (Devvit server functions)
    revealTile.ts
    getTiles.ts
    artifacts.ts
    terrain.ts
  devvit.json
/assets
  /sprites
  /tiles
  /fog
```

---

## 3. Tooling and team workflow

### 3.1 Project scaffold
Use the official **Devvit Phaser Starter Template**, found under the **"Game Engines" tab** (not "Web") at `developers.reddit.com/new/template`, or via `npm create devvit@latest`. It ships with Phaser, Devvit, Vite, Hono (backend), and TypeScript pre-wired — client/server split and Redis access already configured. Don't start from the "Vibe Coding" or "Bare" web templates; the Phaser-specific one already solves the asset-loading and Devvit-bridge wiring this doc assumes.

### 3.2 Team collaboration
- The codebase is a normal git repo — share it on GitHub, work in feature branches, use PRs like any other project. Nothing Devvit-specific changes about this part.
- Each teammate can run `npm run dev` from their own clone; this spins up an **independent dev subreddit + test post** tied to their own Reddit account, so early iteration doesn't require a shared live instance.
- For a **shared demo post** before submission, one person needs to install/publish the app, and teammates need to be **moderators of that same test subreddit** to have install/config rights on it. Confirm the exact collaborator/permission model against the current Devvit docs or the r/devvit community if this needs finer-grained control — it wasn't fully verifiable at doc-writing time.

### 3.3 AI coding agent
Antigravity (Google's free, public-preview agentic IDE, supports Claude Sonnet models) is a reasonable choice if avoiding paid tooling — every teammate can run their own agent session against their own clone without a shared seat cost. Two notes:
- You lose the Cursor-specific pre-configured `devvit-mcp` integration that ships with the template's Cursor setup; check whether Antigravity supports adding a custom MCP server manually, or let the agent work directly against Devvit's CLI/docs instead.
- When handing this document to an agent, explicitly instruct it to **read the existing `src/client`, `src/server`, and `src/shared` folders first** and propose an implementation plan before writing code — this avoids it re-scaffolding things the template already provides.

---

## 4. Build Plan (suggested day-by-day for a short hackathon window)

| Day | Goal |
|---|---|
| 1 | Devvit Phaser template running as an Interactive Post; confirm asset folder path; Phaser canvas rendering a static chunk of fog tiles via the tilemap API |
| 2 | Redis-backed tile storage; `revealTile` + `getTiles` (chunk-based) server functions; adjacency/frontier logic |
| 3 | One-action-per-day enforcement; username stamping; hover/tap tile info card |
| 4 | Terrain generation via seeded noise; sprite/tileset mapping per terrain type; chunk load/unload as camera moves |
| 5 | Artifact spawn logic tied to live post score/comment count; auto-comment clue posting |
| 6 | Camera pan/zoom, mobile touch controls, polish pass |
| 7 | Particle glow effects, leaderboard/attribution UI, named-landmark + comment-sourced-lore stretch goals if time allows, playtest with a real subreddit post, submission writeup mapping features to judging criteria |

---

## 5. Open decisions to make early
- **UTC day boundary vs. rolling 24h** for the daily action reset (UTC day is simpler and more "Reddit native" — Reddit itself uses UTC-based daily resets for similar mechanics).
- **Artifact rarity curve** — how many artifacts per season, and whether locations are precomputed or fully live-derived each day.
- **Season length** — weekly vs. monthly resets, and what "archiving" a completed map looks like (read-only atlas view, linked from a pinned post).
- **Chunk size** — tune tile-chunk dimensions against expected map size and Redis/network request volume; 32×32 is a reasonable starting point, not a fixed requirement.

---

*This document is meant to be handed to a coding agent (e.g. Google Antigravity or Claude Code) as the spec to scaffold from, or used as a manual build checklist.*
