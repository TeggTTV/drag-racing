# Game Feature Roadmap

This document outlines the detailed implementation plans for the selected new features.

## 1. RPG & Progression Features

### 11. Driver Skills Tree (IMPLEMENTED)

**Concept:**
A persistent progression system tied to the player, not the car. Leveling up the _driver_ earns Skill Points to unlock passive buffs.

**Status:**

-   [x] UI Component created (`SkillTree.tsx`).
-   [x] Integrated into Game Menu.
-   [x] Persistence via `user.settings`.
-   [x] XP and Money Logic applied in `useRaceEvents`.
-   [ ] Repair discount logic (Pending UI update).

**Mechanics:**

-   **XP Source:** Winning races, performing perfect shifts, reaction times < 0.100s.
-   **Skill Tree Structure:**
    -   _Mechanic Branch:_ Reduces repair costs, increases salvage yield.
    -   _Racer Branch:_ Increases connection consistency, reduces "missed gear" penalty window.
    -   _Tycoon Branch:_ Increases race payouts, market fees reduction.
-   **Persistence:** Stored in `User` model, separate from `Garage`.

**Implementation:**

-   New `SkillTree` component in `GameMenu`.
-   Update `User` schema to include `skillPoints` and `unlockedSkills` array.
-   Create `SkillNode` type with `id`, `cost`, `effect`, `parentId`.

### 12. Mastery Prestige

**Concept:**
Allows players to reset a car's "Mastery Level" once it hits Max Level (e.g., Lvl 10) to gain a permanent, stacking bonus.

**Mechanics:**

-   **Trigger:** Button available only at Max Mastery.
-   **Cost:** Reset Mastery Level to 1, loss of current Mastery bonuses.
-   **Reward:** +1 "Prestige Level". Each level grants a permanent generic buff to that chassis (e.g., +1% Grip Cap, +1% Power Cap) or a cosmetic "Gold/Platinum" border in menus.
-   **Cap:** Max 5 or 10 prestige levels.

**Implementation:**

-   Update `GarageCar` type to include `prestigeLevel`.
-   UI: "Prestige" button in `MasteryLevelUp` modal with warning prompt.
-   Function `prestigeCar()` in `useGarageManager`.

### 17. Set Bonuses

**Concept:**
Encourage collecting matching brand or type parts by granting extra stats when they are equipped together.

**Mechanics:**

-   **Sets:** Defined in `constants.ts`. Example: "Street King Set" (Street Tires + Sport Exhaust + ECU 1).
-   **Application:** Checked during `calculateTuning`. If all set IDs are in `ownedMods` and `equipped` (or implied active), apply `bonusStats`.
-   **Bonuses:** Unique multipliers (e.g., `xpGain: 1.1x`) or raw stats (`maxTorque: +10`).
-   Add visual display to the hovercard whcih shows what set it is a part of
    **Implementation:**

-   New constant `ITEM_SETS`.
-   Update `CarBuilder.calculateTuning` to iterate through active sets and apply bonuses.
-   UI: Highlight equipped items in the inventory with a "Set Glow" if the set is active.

### 19. Daily Login "Spin"

**Concept:**
Replace or enhance the static daily reward popup with a visual "Wheel of Fortune" or Slot Machine animation.

**Mechanics:**

-   **Visual:** A Canvas or CSS animation spinning through potential rewards (Cash, Parts, Crates).
-   **Weights:** Server-determined result, but client spins to land on it.
-   **Animation:** Accelerate -> Constant Speed -> Decelerate -> Snap to target.

**Implementation:**

-   `DailyRewardsModal.tsx`: Replace list view with `<SpinWheel />` component.
-   Logic: Fetch reward _result_ from API first, then play animation to match that result.

### 20. Season Pass

**Concept:**
A seasonal progression track resetting every ~30 days.

**Mechanics:**

-   **Tiers:** 1-50 levels.
-   **XP:** "Season XP" gained from Daily Challenges and Online Races.
-   **Rewards:** Cash, Crates, Unique Cosmetics (Skins/Decals), Titles.
-   **Premium vs Free:** (Currently only Free requested).

**Implementation:**

-   Backend: `Season` model with start/end dates. `UserSeasonProgress` model.
-   Frontend: "Season" tab in Menu showing a horizontal scrollable track of rewards.
-   Auto-claim or manual claim logic.

---

## 2. World, Atmosphere & Visuals

### 31. Dynamic Time of Day

**Concept:**
The background sky and lighting change based on real-world time or a simulated game clock.

**Mechanics:**

-   **States:** Dawn, Day, Dusk, Night.
-   **Effect on Physics:**
    -   _Day:_ Standard.
    -   _Night:_ Air Temp lower (+Density = +Power), Track Temp lower (-Grip).
-   **Visuals:** CSS Filters (brightness/contrast) overlaying the canvas or different sky assets.

**Implementation:**

-   `GameCanvas`: Add `timeOfDay` state.
-   `RaceRenderer`: Draw different sky gradients/images based on state.
-   `physics.ts`: Add `tempCorrection` factor to engine power calc.

### 32. Weather Effects

**Concept:**
Random chance of rain affecting gameplay.

**Mechanics:**

-   **Rain State:** Visual rain particles.
-   **Physics:** `friction` coefficient multiplied by 0.6 (Slicks) or 0.9 (Street Tires). This forces tire swaps.
-   **Audio:** Rain ambience loop.

**Implementation:**

-   `ParticleSystem`: Add `RainDrop` emitter.
-   `useRaceSetup`: Randomize weather on race start.
-   UI: Weather icon in lobby/race screen.

### 33. Parallax Backgrounds

**Concept:**
Create depth by having multiple background layers moving at different speeds.

**Mechanics:**

-   **Layers:**
    1. Sky (Static or very slow).
    2. Distant City/Mountains (0.1x car speed).
    3. Mid-ground Trees/Buildings (0.5x car speed).
    4. Foreground Fence/Guardrail (1.0x car speed).
    5. Foreground Post-FX (Blur).
-   **Looping:** Seamless image textures.

**Implementation:**

-   `RaceRenderer`: Split background drawing into layers.
-   Track `cameraX` and offset layers: `imageX = (cameraX * speedFactor) % imageWidth`.

### 34. Interactive Dashboard

**Concept:**
The on-screen gauge cluster reacts to car state beyond just needle movement.

**Mechanics:**

-   **Indicators:** CEL (Check Engine), Oil Temp warning, Battery light.
-   **Animations:** Needle "sweep" on startup. Shift light flashing intensity.
-   **Damage:** Cracks in glass if engine health is low or race lost badly (flavor).

**Implementation:**

-   `Dashboard.tsx`: Add states for warning lights.
-   Bind to `carState.health` or similar variables.

### 35. Exhaust Flame Colors

**Concept:**
Visual feedback for modifications and tuning via exhaust particles.

**Mechanics:**

-   **Rich Fuel/Turbo:** Orange/Yellow flames + black smoke.
-   **Nitrous:** Blue/Purple sharp flames.
-   **Anti-Lag:** Rapid popping small yellow bursts.

**Implementation:**

-   `ParticleSystem`: Update `createFire` to accept `color` argument.
-   Trigger: In `GameCanvas` loop, check `carState.isNitrousActive` -> Blue, else -> Orange.

### 36. Camera Shake

**Concept:**
Visceral feedback for high torque and speed.

**Mechanics:**

-   **Triggers:** Launch (high G-force), Gear Shift (clutch kick), Nitrous activation, Top Speed buffeting.
-   **Math:** `canvasOffset = (Math.random() - 0.5) * magnitude`.
-   **Decay:** Linearly decrease magnitude back to 0.

**Implementation:**

-   `GameCanvas` render loop: specific `ctx.translate(shakeX, shakeY)` before drawing world, `restore` after.

---

## 3. Social & Online Features

### 39. Crew System

**Concept:**
Persistent player groups (Guilds/Clans).

**Mechanics:**

-   **Tag:** 3-4 character prefix in names.
-   **Roster:** Leader, Officers, Members.
-   **Crew Garage:** A shared inventory space (limit 5 items) for donating parts to new members.

**Implementation:**

-   Database: `Crew` model (Name, Tag, OwnerId). `User` has `crewId`.
-   UI: "Social" tab -> "My Crew".

### 42. Car Meets

**Concept:**
A passive lobby where cars are parked side-by-side.

**Mechanics:**

-   **Mode:** "Showroom". No racing physics.
-   **Visuals:** Players can click other cars to specific "Inspect" view (see their mods).
-   **Chat:** Text chat overlay.

**Implementation:**

-   `GamePhase`: 'MEET'.
-   Render multiple static `Car` sprites at fixed positions.
-   Logic: Fetch `party` member specific visual data (paint, body kit).

### 44. Global Market (Auction House)

**Concept:**
Peer-to-peer trading of parts and cars.

**Mechanics:**

-   **Listing:** Player puts item up -> removed from their inventory -> stored in `MarketListing`.
-   **Bidding:** Real-time or static buyout.
-   **Tax:** 10% server cut to drain economy.

**Implementation:**

-   _Note: Already partially in codebase._
-   Needs `MarketListing` schema updates for full cars vs parts.
-   Filter system (Sort by Rarity, Type, Price).

---

## 4. Quality of Life & UI/UX

### 45. Telemetry Analysis

**Concept:**
Post-race data visualization to help players tune gearing.

**Mechanics:**

-   **Data Recording:** Every 100ms during race, record `{ time, rpm, speed, gear, wheelSlip }`.
-   **Graph:** Line chart of RPM vs Time.
-   **Insights:** Highlight "Wheelspin detected" zones or "Short shift" moments.

**Implementation:**

-   `RaceResults`: Add "Details" tab.
-   Use a lightweight charting lib (e.g. Recharts) or custom canvas drawer.

### 46. Compare Tool

**Concept:**
Tooltip or side-by-side view when buying/equipping parts.

**Mechanics:**

-   **Visual:** "Equipped" (Left) vs "Selected" (Right).
-   **Diff:** Green text for positive changes (+20 Nm), Red for negative (+5kg).

**Implementation:**

-   `ModNode` tooltip component.
-   Helper function `getStatDiff(itemA, itemB)`.

### 48. Bulk Actions

**Concept:**
Reduce clicks for inventory management.

**Mechanics:**

-   **Select Mode:** Checkboxes on inventory items.
-   **Actions:** "Sell Selected", "Scrap Selected".
-   **Safety:** Confirmation modal for high-rarity items.

**Implementation:**

-   `Inventory` component state `selectedIds: string[]`.

### 49. Music Player

**Concept:**
In-game control over the BGM.

**Mechanics:**

-   **UI:** Small widget (Play/Pause, Next, Volume slider).
-   **Tracks:** Display name of current song.
-   **Playlists:** "Menu" vs "Race" playlists toggle.

**Implementation:**

-   Connect to `MusicContext`.
-   Widget UI in corner of screen or inside Settings menu.
