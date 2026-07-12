# The Last Cartographer

Welcome to **The Last Cartographer**, a permanent, community-owned game built for Reddit's Games with a Hook (Devvit Web + Phaser). This is an interactive post where the entire subreddit uncovers a massive, shared map—one tile at a time, forever. 

## 🗺️ The Complete Game Logic

The core loop of The Last Cartographer is built around community collaboration, scarcity, and permanent attribution.

1. **The Shared Map:** The game features an infinite tile grid initially shrouded in the fog of war.
2. **One Action Per Day:** Every user gets exactly one move per UTC day. 
3. **Frontier Expansion:** You can only reveal a "frontier tile"—a fog tile adjacent to an already-revealed tile.
4. **Permanent Attribution:** When you reveal a tile, your Reddit username and a timestamp are permanently stamped on it. Anyone can tap/hover on the tile to see who discovered it.
5. **Artifact Discovery & Clues:** If the revealed tile contains an artifact, an automatic clue is posted in the Reddit comment thread. The community then races to decode the clue.
6. **Seasons:** The map never resets to zero; instead, it's archived into seasons, providing long-horizon progression.

## 🚀 Walkthrough & How to Play

1. **Open the Post:** Launch the Devvit interactive post on the subreddit.
2. **Survey the Map:** Pan and zoom to view the current state of the world, checking out terrain and newly revealed tiles.
3. **Pick Your Move:** Find a highlighted "frontier tile" at the edge of the fog.
4. **Reveal:** Tap or click to spend your daily action and reveal the tile.
5. **Join the Hunt:** Check the comments section for new clues about artifacts. If your tile triggered an artifact, interact with the community to decipher the clue.
6. **Return Daily:** Come back the next day for your next move! Skip a day, and someone else might claim the tile you had your eye on.

## 🔍 What's Under the Tiles?

When you clear the fog, you might uncover:

* **Terrains:** The map features procedurally generated biomes.
  * 🌊 **Water**
  * 🌲 **Forest**
  * 🏜️ **Desert**
  * ⛰️ **Mountain**
  * 🏛️ **Ruins** (Rare biome with a higher chance for artifacts)
* **Obstacles (Hazards):** Some tiles may reveal natural obstacles like deep chasms or cursed grounds that require the community to spend extra actions (or work together) to bypass.
* **Artifacts:** Rare items whose spawn locations are tied to live Reddit data (like the post's karma or comment count).
* **Bonus Tiles (The Clicker Mechanic):** Occasionally, a "Resonance Tile" is uncovered. These tiles introduce a mini-game *clicker* element. The community can click these tiles rapidly to pool points, unlocking temporary boosts like allowing a second action for the day or revealing a 3x3 radius of fog instantly.

## 🏆 Game Modes

While the core game is a persistent daily exploration, there are different active layers:
* **The Grand Expedition (Main Mode):** The standard daily reveal mechanics.
* **Artifact Rush:** Time-limited events where the spawn rate of artifacts is boosted based on subreddit activity (upvotes and comments).
* **Clicker / Resonance Mode:** Triggered by Bonus Tiles, shifting gameplay temporarily to rapid, collective tapping to achieve a community goal.

## 🏅 Global Rank System & Leaderboards

* **Tile Barons:** Ranks users by the total number of tiles they have personally revealed across all seasons.
* **First Finders:** A wall of fame for players who made the initial discovery of rare artifacts or unique biomes.
* **Named Landmarks:** Players who discover ultra-rare tiles (like a Mountain Peak or major Ruin) get to permanently *name* it, cementing their legacy in the map's lore.
* **Loremasters:** Players whose Reddit comments are upvoted to become the "canon lore" for a discovered artifact.

---

## 🛠️ Technical POV

### The Stack
* **Frontend:** Phaser 3 (TypeScript) running inside a Devvit Web iframe.
* **Backend:** Devvit Server Functions (Node/TypeScript).
* **Persistence:** Devvit's built-in Redis-backed KV store.
* **Integration:** Native Reddit API (via Devvit) for grabbing live karma/comment data.

### Architecture
The game uses a **Client-Server model** entirely contained within the Devvit ecosystem:
1. **Client (Phaser 3):** Handles the camera pan/zoom/pinch over the tile grid. Renders the revealed tiles and a dynamic fog layer. Sends reveal requests to the backend.
2. **Devvit Web Bridge:** Passes fetch requests between the webview and the Devvit server.
3. **Devvit Server Functions:** Validates the one-action-per-day rule and adjacency requirements. Generates terrain on the fly and writes to Redis. Reads live Reddit stats to determine artifact spawns and auto-posts clues.
4. **Redis KV Store:** Stores tile data `tile:{x}:{y}`, the current `frontier` set, daily action trackers `lastAction:{userId}`, and season metadata.

### Implementation Details & Logic
* **Infinite Map Generation:** The world is NOT pre-generated. Terrain is created deterministically on-demand using a seeded Simplex Noise function (e.g., `noise2D`). This means storage costs scale only with explored tiles, making the map practically infinite.
* **Phaser Chunking:** To handle an infinitely expanding map, Phaser divides the world into chunks (e.g., 32x32 tiles). Only chunks within the camera's viewport are rendered, maintaining high performance regardless of the map's total size.
* **Two-Layer Fog of War:** Fog isn't managed via individual sprites. Instead, a blank `Tilemap` layer is filled with fog tiles. When a tile is revealed, the client simply removes the tile at `(x, y)` from the fog layer, exposing the underlying terrain layer.
* **Live-Data Spawns:** Artifact locations are derived from the live post score and comment count. A hash function takes the current karma/comments as a seed to pick a random frontier tile for an artifact to spawn.

---
*Built for the Reddit "Games with a Hook" Hackathon.*
