# Optimization & Feature Implementation Plan

## Phase 1: Core Physics & Settings (High Priority)

-   [ ] **Expanded Game Settings**

    -   [ ] Update `GameSettings` type to include:
        -   `manualClutch` (bool)
        -   `realisticTires` (bool)
        -   `engineDamage` (bool)
        -   `shiftLightRPM` (number)
    -   [ ] Add UI in `GameMenu` (Settings tab) to toggle these.

-   [ ] **1. Manual Clutch**

    -   [ ] Add `clutch` to `InputState`.
    -   [ ] Map Spacebar to `clutch`.
    -   [ ] Update `physics.ts`:
        -   If `manualClutch` is ON: Disconnect engine from wheels when clutch is held.
        -   Implement "bite point" logic or simple on/off for now? User said "clutch keybind", usually implies binary on keyboard unless they have analog. We'll assume binary for keyboard (Spacebar).
    -   [ ] Add +20% payout bonus in `GameCanvas` when this setting is enabled.

-   [ ] **2. Dynamic Tire Temperature**

    -   [ ] Add `tireTemp` (0-100 or similar) to `CarState`.
    -   [ ] Update `physics.ts`:
        -   Burnout (Gas + Brake) increases temp.
        -   Driving normally cools/maintains temp.
        -   Grip curve based on temp (Cold < Optimal > Overheated).
    -   [ ] Add visual indicator for Tire Temp (HUD).

-   [ ] **3. Engine Reliability & Damage**

    -   [ ] Add `engineHealth` (0-100) to `CarState`.
    -   [ ] Update `physics.ts`:
        -   Redlining for too long decreases health.
        -   Money shift (RPM > Max \* 1.2) causes massive damage.
    -   [ ] Effect: Reduced power at lower health, instant loss at 0.

-   [ ] **16. Shift Light Customization**

    -   [ ] Use `shiftLightRPM` setting in `Dashboard` component.

-   [ ] **17. Procedural Engine Sounds**
    -   [ ] Update `AudioEngine.ts` to accept a `seed` or `carId`.
    -   [ ] Randomize oscillator detune/harmonics slightly based on seed.

## Phase 2: Economy & Shop

-   [ ] **7. Used Parts Market (Junkyard)**

    -   [ ] Create `JunkyardParts` section in `Junkyard` tab.
    -   [ ] Generate individual parts with `condition` < 100.
    -   [ ] Use `ItemCard` for display.

-   [ ] **10. Daily Login Streaks**
    -   [ ] Create `LoginStreak` component/modal.
    -   [ ] Track `lastLoginDate` and `streakCount` in user persistence.
    -   [ ] Logic for rewards (Cash, Crate Keys).

## Phase 3: New Modes & Features

-   [ ] **6. Test & Tune Track**

    -   [ ] Add `TEST_DRIVE` phase.
    -   [ ] Simplified HUD (no opponent).
    -   [ ] "Brake" feature (already exists in physics? need to ensure it stops car).
    -   [ ] Instant restart button.

-   [ ] **4. Nitrous Purge**

    -   [ ] Add `Purge` button/keybind.
    -   [ ] Visual particle effect.
    -   [ ] Logic: Buff N2O start time if purged.

-   [ ] **5. Weather Physics & Visuals**
    -   [ ] Ensure `weather` state affects `physics.ts` (grip multiplier).
    -   [ ] Add Rain particle system / overlay in `GameCanvas`.

## Phase 4: UX & Polish

-   [ ] **19. Asset Preloading**

    -   [ ] Create `Preloader` component.
    -   [ ] Load images/audio before `GameCanvas` renders.

-   [ ] **21. Saving Indicator**

    -   [ ] Add UI component listening to `isSaving` state from `useGamePersistence`.

-   [ ] **20. Server-Side Validation**
    -   [ ] Update `/api/race` to validate finish times based on car stats.

## Phase 5: Progression (Requires Visual Confirmation)

-   [ ] **11. Car Mastery**
    -   [ ] **Task**: Propose visual location for Mastery Level.
    -   [ ] Implement tracking in `useGamePersistence`.
    -   [ ] Implement rewards.
