# Tellus Ignota

Welcome to **Tellus Ignota**, a permanent, community-owned game built for Reddit's Games with a Hook (Devvit Web + Phaser). This is an interactive post where the entire subreddit uncovers a massive, shared map—one tile at a time, forever. 

## 🗺️ The Complete Game Logic

The core loop of Tellus Ignota is built around community collaboration, scarcity, and permanent attribution.

1. **The Shared Map:** The game features an infinite tile grid initially shrouded in the fog of war.
2. **One Action Per Day:** Every user gets exactly one move per UTC day. 
3. **Frontier Expansion:** You can only reveal a "frontier tile"—a fog tile adjacent to an already-revealed tile.
4. **Permanent Attribution:** When you reveal a tile, your Reddit username and a timestamp are permanently stamped on it. 
5. **Artifact Discovery & Clues:** If the revealed tile contains an artifact, an automatic clue is posted in the Reddit comment thread.
6. **Scavenger Hunt:** When an artifact clue is posted, players can reply to the comment with the exact word **Claim** to receive a copy of the artifact in their personal gallery.

## 🚀 Walkthrough & How to Play

1. **Open the Post:** Launch the Devvit interactive post on the subreddit.
2. **Survey the Map:** Pan and zoom to view the current state of the world, checking out terrain and newly revealed tiles.
3. **Pick Your Move:** Find a highlighted "frontier tile" at the edge of the fog.
4. **Reveal:** Tap or click to spend your daily action and reveal the tile.
5. **Daily Games:** Play a daily mini-game (Anagrams, Trivia, Pattern matching, etc.) for extra engagement!
6. **Join the Hunt:** Check the comments section for new clues about artifacts and claim them.

## 🔍 What's Under the Tiles?

When you clear the fog, you uncover:

* **Terrains:** The map features procedurally generated biomes:
  * 🌊 **Shallow Water**
  * 🌲 **Ancient Forest**
  * 🌿 **Open Plains**
  * 🏜️ **Scorched Desert**
  * ⛰️ **Craggy Mountain**
  * 🏛️ **Lost Ruins**
* **Artifacts:** Rare items (Common, Rare, Legendary) like the *Broken Compass*, *Resonance Stone*, or *Star Chart of the Unmapped Sky*. Their spawn locations are determined dynamically by the live post karma (Score * 31 + Comment Count). Furthermore, artifacts often dynamically name themselves after trending Reddit posts!

## ⛏️ The Golden Age (Clicker Mechanics)

Periodically, the **Golden Age Excavation** clicker event can be triggered. 
* **Community Goal:** The entire community pools their clicks together to reach a massive goal (e.g., 100,000 clicks).
* **Personal Contribution:** You must contribute a minimum amount of personal clicks (e.g., 100) to qualify for the loot.
* **The Reward:** When the community goal is reached, a **Golden Age Reveal** is triggered. A 5x5 chunk of frontier tiles is instantly revealed by "The Community", automatically dropping clues for any artifacts discovered in that massive blast.

## 🧩 Daily Games

To keep the community engaged, a new randomly generated minigame appears daily. Game types include:
* **Anagrams, Riddles, and Trivia**
* **Math & Pattern Recognition**
* **Memory & Reaction Tests**
* **Prediction & Community Questions** (e.g., predicting tomorrow's comment count)

## 🏅 Global Rank System & Progression

* **Leaderboards:** The game tracks and displays a global leaderboard ranking users by their score and contributions.
* **Profiles:** Players have a personal profile displaying their current rank, total score, and a gallery of their collected **Artifacts**.

---

## 🛠️ Technical POV

### The Stack
* **Frontend:** Phaser 3 (TypeScript) running inside a Devvit Web iframe.
* **Backend:** Devvit Server Functions (Node/Hono) + TypeScript.
* **Persistence:** Devvit's built-in Redis-backed KV store.
* **Integration:** Native Reddit API (via Devvit) for grabbing live karma/comment data and posting clues.

### Architecture & Implementation Logic
The game operates on a robust **Client-Server model** entirely contained within the Devvit ecosystem:
1. **Client (Phaser 3):** Handles camera controls (CameraController), dynamic terrain rendering (TerrainPainter), and chunk management (ChunkManager). 
2. **Devvit Web Bridge (`shared/api.ts`):** Defines the strictly typed contracts for fetching chunks (`/api/tiles`) and revealing tiles (`/api/reveal`).
3. **Devvit Server Functions:** Validates the daily limits and adjacency constraints. Generates terrain deterministically on the fly. Dynamically calculates artifact spawns based on live post engagement and dispatches automatic clue comments to the thread.
4. **Redis KV Store:** Efficiently stores tile data (`tile:{x}:{y}`), tracks the active `frontier` set using sorted sets, handles daily game state (`daily_game:{date}`), and coordinates the global clicker counts.
5. **Infinite Map Generation:** The world is NOT pre-generated. Terrain is evaluated deterministically using seeded Simplex Noise functions. This ensures that storage costs scale strictly with explored tiles, making the map practically infinite.

---
*Built for the Reddit "Games with a Hook" Hackathon.*

## Contributors
* Mohammed Ayaan Adil Ahmed
* Asmae Serji
