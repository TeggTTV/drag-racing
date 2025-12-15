import React, {
	useRef,
	useEffect,
	useState,
	useCallback,
	useMemo,
} from 'react';
import { useMusic } from '../contexts/MusicContext';
import { AudioEngine } from './AudioEngine';
import { ParticleSystem } from '../utils/ParticleSystem';
import { updateCarPhysics } from '../utils/physics';
import { drawCar } from '../utils/renderUtils';
import { CarBuilder } from '../utils/CarBuilder';
import { CarGenerator } from '../utils/CarGenerator';
import { calculateNextLevelXp } from '../utils/progression';
import { useGamePersistence } from '../hooks/useGamePersistence';
import { useGameInput } from '../hooks/useGameInput';
import { useShopSystem } from '../hooks/useShopSystem';
import { useOnlineRace } from '../hooks/useOnlineRace';
import { useGarageManager } from '../hooks/useGarageManager';
import { useDailyRewards } from '../hooks/useDailyRewards';
import { useRaceEvents } from '../hooks/useRaceEvents';
import { useRaceRenderer } from '../hooks/useRaceRenderer';
import { useRaceSetup } from '../hooks/useRaceSetup';
import { ItemMerge } from '../utils/ItemMerge';
import { getFullUrl } from '../utils/prisma';
import { ItemGenerator } from '../utils/ItemGenerator';
import { GAME_ITEMS } from '../data/GameItems';
import { TestTrackUtils } from '../utils/TestTrackUtils';
import Dashboard from './Dashboard';
import { SoundProvider } from '../contexts/SoundContext';
import { DailyRewardsModal } from './menu/DailyRewardsModal';
import { SeasonPass } from './menu/SeasonPass';
import { SEASON_REWARDS } from '../constants/SeasonData';
import { Preloader } from './Preloader';
import { SavingIndicator } from './SavingIndicator';
import { CountdownOverlay } from './race/CountdownOverlay';
import { TestTrackControls } from './race/TestTrackControls';
import { RaceResults } from './race/RaceResults';
import { GameProvider } from '../contexts/GameContext';
import { useToast } from '../contexts/ToastContext';
import { useParty } from '../contexts/PartyContext';
import { useAuth } from '../contexts/AuthContext';
import { processMoneyTransaction } from '../utils/transactions';
import {
	BASE_TUNING,
	INITIAL_MONEY,
	MISSIONS,
	RIVALS,
	MOD_TREE,
	CONTROLS,
} from '../constants';
import {
	CarState,
	TuningState,
	GhostFrame,
	Mission,
	SavedTune,
	ModNode,
	DailyChallenge,
	GamePhase,
	Rival,
	InputState,
	JunkyardCar,
	JunkyardItem,
	InventoryItem,
	Season,
	LoginStreak,
	RaceStatus,
	UserSeasonProgress,
} from '../types';
import { GameSettings } from '../contexts/GameContext';
import { GameMenu } from './GameMenu';
import { CURRENT_SEASON_ID } from '../constants/SeasonData';

const PPM = 40; // Pixels Per Meter - Visual Scale

const GameCanvas: React.FC = () => {
	const { showToast } = useToast();
	const music = useMusic();
	const { party, leaveParty } = useParty();
	const { token, user } = useAuth();
	const canvasRef = useRef<HTMLCanvasElement>(null);

	// Audio Refs
	const audioRef = useRef<AudioEngine>(new AudioEngine());
	const opponentAudioRef = useRef<AudioEngine>(new AudioEngine());
	const audioInitializedRef = useRef(false);

	// Particle System
	const particleSystemRef = useRef<ParticleSystem>(new ParticleSystem());

	// Asset Preloading State
	const [assetsLoaded, setAssetsLoaded] = useState(false);

	// Game Persistence State
	const [money, setRawMoney] = useState(0);
	const [phase, setPhase] = useState<GamePhase>('MAP');

	// New Inventory System (Array of owned Mod IDs)
	const [ownedMods, setOwnedMods] = useState<string[]>([]);
	const [disabledMods, setDisabledMods] = useState<string[]>([]);
	const [modSettings, setModSettings] = useState<
		Record<string, Record<string, number>>
	>({});
	// Missions state to track best times
	const [missions, setMissions] = useState<Mission[]>(MISSIONS);
	const [dailyChallenges, setDailyChallenges] = useState<DailyChallenge[]>(
		[]
	);
	// Mission Select Tab Persistence
	const [missionSelectTab, setMissionSelectTab] = useState<
		'CAMPAIGN' | 'UNDERGROUND' | 'DAILY' | 'RIVALS'
	>('CAMPAIGN');

	// Game Settings
	const [settings, setSettings] = useState<GameSettings>({
		particles: true,
		manualClutch: false,
		realisticTires: false,
		engineDamage: false,
		shiftLightRPM: 0,
	});

	// Weather State
	const [weather, setWeather] = useState<{
		type: 'SUNNY' | 'RAIN';
		intensity: number;
		season: Season;
	}>({
		type: 'SUNNY',
		intensity: 0,
		season: 'SUMMER',
	});

	// Background Decor State
	const [bgTrees, setBgTrees] = useState<
		{ x: number; y: number; scale: number }[]
	>([]);
	const [seasonalTreesImg, setSeasonalTreesImg] =
		useState<HTMLImageElement | null>(null);

	// Image loading is now handled by Preloader (cached), but we still need to set state
	useEffect(() => {
		if (assetsLoaded) {
			const img = new Image();
			img.src = '/seasonal-trees.png';
			img.onload = () => setSeasonalTreesImg(img);
		}
	}, [assetsLoaded]);

	// Music Logic handled in the phased delay effect below

	// State declarations moved up to fix ReferenceError
	const [raceResult, setRaceResult] = useState<'WIN' | 'LOSS' | null>(null);
	const [wearResult, setWearResult] = useState<Record<string, number> | null>(
		null
	);
	const [showConditionTab, setShowConditionTab] = useState(false);
	const [lastRaceMastery, setLastRaceMastery] = useState<{
		level: number;
		xp: number;
		gain: number;
	} | null>(null);
	const [inventory, setInventory] = useState<InventoryItem[]>([]);

	// Dyno History State
	const [dynoHistory, setDynoHistory] = useState<
		{ rpm: number; torque: number; hp: number }[]
	>([]);
	const [previousDynoHistory, setPreviousDynoHistory] = useState<
		{ rpm: number; torque: number; hp: number }[]
	>([]);

	const handleDynoRunStart = useCallback(() => {
		if (dynoHistory.length > 0) {
			setPreviousDynoHistory(dynoHistory);
		}
	}, [dynoHistory]);

	// Current Tuning (Calculated from Base + Mods)
	const [playerTuning, setPlayerTuning] = useState<TuningState>(BASE_TUNING);
	const tuningRef = useRef<TuningState>(BASE_TUNING);
	const pendingTuningRef = useRef<Partial<TuningState> | null>(null);
	const previousCarIndexRef = useRef(0);

	// Garage State
	const [garage, setGarage] = useState<SavedTune[]>([]);
	const [currentCarIndex, setCurrentCarIndex] = useState(0);

	// Underground State
	const [undergroundLevel, setUndergroundLevel] = useState(1);
	const [defeatedRivals, setDefeatedRivals] = useState<string[]>([]);
	const [xp, setXp] = useState(0);
	const [level, setLevel] = useState(1);

	// Daily Rewards State
	const [loginStreak, setLoginStreak] = useState<LoginStreak>({
		currentStreak: 0,
		lastLoginDate: '',
		longestStreak: 0,
		totalLogins: 0,
		rewardsClaimed: [],
	});

	// Season Progress State
	const [seasonProgress, setSeasonProgress] = useState<UserSeasonProgress>({
		seasonId: CURRENT_SEASON_ID,
		xp: 0,
		claimedFreeTiers: [],
		claimedPremiumTiers: [],
		isPremium: false,
	});

	const [showDailyRewards, setShowDailyRewards] = useState(false);
	const [showSeasonPass, setShowSeasonPass] = useState(false);

	// Persistence Hook
	const {
		loaded: isGameLoaded,
		notifyMoneyUpdate,
		saveGame,
		isSyncing,
	} = useGamePersistence(
		money,
		setRawMoney,
		ownedMods,
		setOwnedMods,
		disabledMods,
		setDisabledMods,
		modSettings,
		setModSettings,
		missions,
		setMissions,
		dailyChallenges,
		setDailyChallenges,
		playerTuning,
		setPlayerTuning,
		dynoHistory,
		setDynoHistory,
		previousDynoHistory,
		setPreviousDynoHistory,
		garage,
		setGarage,
		currentCarIndex,
		setCurrentCarIndex,
		undergroundLevel,
		setUndergroundLevel,
		xp,
		setXp,
		level,
		setLevel,
		inventory,
		setInventory,
		phase,
		settings,
		setSettings,
		loginStreak,
		setLoginStreak,
		seasonProgress,
		setSeasonProgress
	);

	const {
		junkyardCars,
		junkyardParts,
		dealershipCars,
		dailyShopItems,
		buyJunkyardCar,
		buyJunkyardPart,
		refreshJunkyard,
		buyDealershipCar,
		refreshDealership,
		buyShopItem,
		refreshDailyShop,
	} = useShopSystem(
		money,
		setRawMoney,
		inventory,
		setInventory,
		garage,
		setGarage,
		saveGame,
		showToast,
		token
	);

	const setMoney = useCallback(
		(value: React.SetStateAction<number>) => {
			setRawMoney(value);
			notifyMoneyUpdate();
		},
		[notifyMoneyUpdate]
	);

	// Online Race Trigger & Sync

	// Garage Manager
	const { restoreCar, scrapCar } = useGarageManager(
		garage,
		setGarage,
		money,
		setMoney,
		currentCarIndex,
		setCurrentCarIndex,
		saveGame,
		showToast,
		previousCarIndexRef
	);

	const handleMerge = useCallback(
		async (item1: InventoryItem, item2: InventoryItem) => {
			if (!token) {
				// Offline Fallback
				const newItem = ItemMerge.mergeItems(item1, item2);
				if (newItem) {
					setInventory((prev) => {
						const filtered = prev.filter(
							(i) =>
								i.instanceId !== item1.instanceId &&
								i.instanceId !== item2.instanceId
						);
						const newInventory = [...filtered, newItem];
						saveGame({ inventory: newInventory });
						return newInventory;
					});
					showToast(
						`Merged for ${newItem.rarity} ${newItem.name}!`,
						'SUCCESS'
					);
				} else {
					showToast('Failed to merge items.', 'ERROR');
				}
				return;
			}

			// Server Action
			try {
				const res = await fetch(getFullUrl('/api/actions/inventory'), {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({
						action: 'MERGE',
						item1Id: item1.instanceId,
						item2Id: item2.instanceId,
					}),
				});

				if (res.ok) {
					const data = await res.json();
					setInventory(data.inventory);
					showToast(
						`Merged for ${data.newItem.rarity} ${data.newItem.name}!`,
						'SUCCESS'
					);
				} else {
					const err = await res.json();
					showToast(err.message || 'Merge failed', 'ERROR');
				}
			} catch (e) {
				console.error('Merge error:', e);
				showToast('Merge failed', 'ERROR');
			}
		},
		[token, showToast, saveGame]
	);

	// Inventory State moved up

	// Sync active car state to garage whenever it changes
	useEffect(() => {
		if (!isGameLoaded) return;

		// Handle Car Switch: Save Old -> Load New
		if (previousCarIndexRef.current !== currentCarIndex) {
			const oldIndex = previousCarIndexRef.current;
			// console.log(`Switching Car: ${oldIndex} -> ${currentCarIndex}`);

			// 1. Save Old Car's Equipped Items
			setGarage((prevGarage) => {
				const newGarage = [...prevGarage];
				if (newGarage[oldIndex]) {
					newGarage[oldIndex] = {
						...newGarage[oldIndex],
						installedItems: inventory.filter((i) => i.equipped),
					};
				}
				return newGarage;
			});

			// 2. Load New Car's Items
			const newCar = garage[currentCarIndex];
			// Ensure loaded items are marked as equipped
			const newItems = (newCar?.installedItems || []).map((i) => ({
				...i,
				equipped: true,
			}));

			// 3. Update Active Inventory (Loose + New Equipped)
			const looseItems = inventory.filter((i) => !i.equipped);
			setInventory([...looseItems, ...newItems]);

			previousCarIndexRef.current = currentCarIndex;
			return;
		}

		setGarage((prevGarage) => {
			if (prevGarage.length === 0) return prevGarage;

			const currentCar = prevGarage[currentCarIndex];
			if (!currentCar) return prevGarage;

			// Check if active state differs from saved state
			const currentInstalled = inventory.filter((i) => i.equipped);
			const hasChanged =
				JSON.stringify(currentCar.ownedMods) !==
					JSON.stringify(ownedMods) ||
				JSON.stringify(currentCar.disabledMods) !==
					JSON.stringify(disabledMods) ||
				JSON.stringify(currentCar.modSettings) !==
					JSON.stringify(modSettings) ||
				JSON.stringify(currentCar.installedItems || []) !==
					JSON.stringify(currentInstalled) ||
				JSON.stringify(currentCar.modSettings) !==
					JSON.stringify(modSettings) ||
				JSON.stringify(currentCar.installedItems || []) !==
					JSON.stringify(currentInstalled);

			if (hasChanged) {
				const updatedGarage = [...prevGarage];
				updatedGarage[currentCarIndex] = {
					...currentCar,
					ownedMods,
					disabledMods,
					modSettings,
					installedItems: currentInstalled,
					// Do NOT auto-save manualTuning from playerTuning here to avoid loops.
					// Manual tuning changes should be saved explicitly by the UI controls.
				};
				return updatedGarage;
			}

			return prevGarage;
		});
	}, [
		isGameLoaded,
		inventory,
		ownedMods,
		disabledMods,
		modSettings,
		modSettings,
		currentCarIndex,
	]);

	// Load active car when index changes
	useEffect(() => {
		if (!isGameLoaded) return;
		if (garage.length === 0) return;
		const car = garage[currentCarIndex];
		if (car) {
			// console.log('🚗 Switching to car:', car.name);
			setOwnedMods(car.ownedMods);
			setDisabledMods(car.disabledMods);
			setModSettings(car.modSettings);
			pendingTuningRef.current = car.manualTuning;
		}
	}, [currentCarIndex, isGameLoaded, garage.length]); // eslint-disable-line react-hooks/exhaustive-deps

	// Current Mission
	const missionRef = useRef<Mission | null>(null);

	// Ghost Racing Refs
	const playerRef = useRef<CarState>({
		y: 0,
		velocity: 0,
		rpm: 1000,
		gear: 0,
		finished: false,
		finishTime: 0,
	});

	const opponentRef = useRef<CarState>({
		y: 0,
		velocity: 0,
		rpm: 1000,
		gear: 0,
		finished: false,
		finishTime: 0,
	});

	// Logic Refs
	const shiftDebounce = useRef(false);
	const lastTimeRef = useRef<number>(0);
	const lastGearRef = useRef<number>(0);
	const currentWagerRef = useRef(0);
	const countdownStartRef = useRef(0);
	const raceStartTimeRef = useRef(0);
	const activeGhost = useRef<GhostFrame[] | null>(null);
	const currentGhostRecording = useRef<GhostFrame[]>([]);
	const raceFinishedProcessingRef = useRef(false);
	const maxTreeYRef = useRef(0); // For procedural generation
	const quarterMileTimeRef = useRef<number | null>(null);
	const mileTimeRef = useRef<number | null>(null);

	// State for React UI
	const [uiState, setUiState] = useState<{
		player: CarState;
		opponent: CarState;
	}>({
		player: playerRef.current,
		opponent: opponentRef.current,
	});
	const [raceStatus, setRaceStatus] = useState<RaceStatus>('IDLE');
	// raceResult moved up
	const [playerFinishTime, setPlayerFinishTime] = useState<number>(0);
	const [opponentFinishTime, setOpponentFinishTime] = useState<number>(0);
	const [countdownNum, setCountdownNum] = useState<number | string>('');
	const [missedGearAlert, setMissedGearAlert] = useState(false);

	// --- SAFETY FALLBACK: Ensure Race Result is set if Physics is Finished ---
	useEffect(() => {
		if (uiState.player.finished && !raceResult && raceStatus === 'RACING') {
			// console.log(
			// 	'🚑 Fallback: Physics finished but no result. Forcing WIN.'
			// );
			// Determine win/loss basics (simplified)
			if (
				uiState.opponent.finished &&
				uiState.opponent.finishTime < uiState.player.finishTime
			) {
				setRaceResult('LOSS');
			} else {
				setRaceResult('WIN');
			}
			setRaceStatus('FINISHED');
		}
	}, [
		uiState.player.finished,
		uiState.opponent.finished,
		raceResult,
		raceStatus,
	]);

	// --- Input Handling ---
	const inputsRef = useGameInput(
		phase,
		setPhase,
		setRaceResult,
		audioInitializedRef,
		audioRef,
		opponentAudioRef
	);

	// Touch Controls Handler
	const handleTouchControl = useCallback(
		(action: string, pressed: boolean) => {
			if (!inputsRef.current) return;
			switch (action) {
				case 'GAS':
					inputsRef.current.gas = pressed;
					break;
				case 'BRAKE':
					inputsRef.current.brake = pressed;
					break;
				case 'CLUTCH':
					inputsRef.current.clutch = pressed;
					break;
				case 'SHIFT_UP':
					inputsRef.current.shiftUp = pressed;
					break;
				case 'SHIFT_DOWN':
					inputsRef.current.shiftDown = pressed;
					break;
				case 'PURGE':
					inputsRef.current.purge = pressed;
					break;
			}
		},
		[]
	);

	// Online Race Trigger & Sync
	useOnlineRace(
		phase,
		setPhase,
		party,
		token,
		user,
		playerRef,
		opponentRef,
		setRaceStatus,
		setCountdownNum,
		raceResult,
		setRaceResult,
		inventory,
		setInventory,
		missionRef,
		setBgTrees,
		setWeather,
		raceStartTimeRef,
		currentWagerRef,
		setPlayerFinishTime,
		setOpponentFinishTime,
		wearResult,
		setWearResult
	);

	const { processRaceFinish } = useRaceEvents(
		inventory,
		setInventory,
		setWearResult,
		garage,
		setGarage,
		currentCarIndex,
		missionRef,
		setLastRaceMastery,
		setRaceResult,
		setRaceStatus,
		token,
		setMoney,
		xp,
		setXp,
		saveGame,
		showToast,
		setUndergroundLevel,
		defeatedRivals,
		setDefeatedRivals,
		missions,
		setMissions,
		audioRef,
		opponentAudioRef,
		raceFinishedProcessingRef,
		currentGhostRecording,
		settings
	);

	const { drawFrame, drawMenuBackground } = useRaceRenderer();

	// Stop audio when leaving race phase
	useEffect(() => {
		if (phase !== 'RACE' && phase !== 'ONLINE_RACE') {
			audioRef.current.stop();
			opponentAudioRef.current.stop();
		} else {
			audioRef.current.start();
			opponentAudioRef.current.start();
		}

		// Hard reset of race processing flag when status becomes RACING
		if (raceStatus === 'RACING') {
			// console.log(
			// 	'🏎️ GameCanvas: Hard reset of raceFinishedProcessingRef to false'
			// );
			raceFinishedProcessingRef.current = false;
		}
	}, [phase, raceStatus]);

	// Music Phase Switching
	useEffect(() => {
		// Small delay to ensure music context is initialized and prevent rapid switching
		const timer = setTimeout(() => {
			if (
				phase === 'MAP' ||
				phase === 'GARAGE' ||
				phase === 'JUNKYARD' ||
				phase === 'SHOP' ||
				phase === 'AUCTION' ||
				phase === 'MISSION_SELECT'
			) {
				// console.log('[GameCanvas] Starting menu music');
				music.play('menu', 2.0);
			} else if (phase === 'RACE' || phase === 'ONLINE_RACE') {
				// console.log('[GameCanvas] Starting race music');
				music.play('race', 1.5);
			}
			// Victory/defeat music handled separately in race result logic
		}, 100);

		return () => clearTimeout(timer);
	}, [phase, music]);

	// --- Helpers ---
	// Sync ref is now handled below with effectiveTuning

	// Sync ref is now handled below with effectiveTuning

	// Recalculate playerTuning when owned mods change

	useEffect(() => {
		// console.log('🔧 Recalculating tuning for mods:', ownedMods);

		// Preserve manual tuning parameters before recalculating
		// Use ref to avoid dependency loop
		const currentTuning = tuningRef.current;
		const manualParams = {
			finalDriveRatio: currentTuning.finalDriveRatio,
			gearRatios: currentTuning.gearRatios,
			torqueCurve: currentTuning.torqueCurve,
		};

		// Safety check: ensure arrays/objects are defined
		const safeOwnedMods = Array.isArray(ownedMods) ? ownedMods : [];
		const safeDisabledMods = Array.isArray(disabledMods)
			? disabledMods
			: [];
		const safeModSettings = modSettings || {};

		// Determine Base Tuning from active car (preserves unique stats)
		let baseTuning = BASE_TUNING;
		if (garage.length > 0 && garage[currentCarIndex]) {
			baseTuning = {
				...BASE_TUNING,
				...garage[currentCarIndex].manualTuning,
			};
		}

		const newTuning = CarBuilder.calculateTuning(
			baseTuning,
			safeOwnedMods,
			safeDisabledMods,
			safeModSettings,
			inventory.filter((i) => i.equipped)
		);

		// Re-apply user's manual tuning (sliders) to override mod defaults
		// This ensures that if I have a transmission mod, my custom gears aren't overwritten by the mod's default gears
		if (garage.length > 0 && garage[currentCarIndex]) {
			const saved = garage[currentCarIndex].manualTuning;
			if (saved.gearRatios) newTuning.gearRatios = saved.gearRatios;
			if (saved.finalDriveRatio)
				newTuning.finalDriveRatio = saved.finalDriveRatio;
			if (saved.torqueCurve) newTuning.torqueCurve = saved.torqueCurve;
		}

		// If we have pending manual tuning (from loading a preset), apply it
		if (pendingTuningRef.current) {
			Object.assign(newTuning, pendingTuningRef.current);
			pendingTuningRef.current = null;
		}

		setPlayerTuning(newTuning);
	}, [
		ownedMods,
		disabledMods,
		modSettings,
		garage,
		currentCarIndex,
		inventory,
	]);

	// Calculate Effective Tuning (including Condition Penalty)
	const effectiveTuning = useMemo(() => {
		const currentCar = garage[currentCarIndex];
		if (!currentCar || currentCar.condition === undefined)
			return playerTuning;

		const rawCondition = currentCar.condition;
		const condition = rawCondition > 1 ? rawCondition / 100 : rawCondition;
		// Penalty: Reduce torque/power by up to 50% based on condition
		const penaltyFactor = 0.5 + 0.5 * condition;

		// Deep copy to avoid mutating state
		const newTuning = JSON.parse(JSON.stringify(playerTuning));
		newTuning.maxTorque *= penaltyFactor;
		// torqueCurve factors are relative to maxTorque, so they scale automatically.

		return newTuning;
	}, [playerTuning, garage, currentCarIndex]);

	// Sync ref with EFFECTIVE tuning for physics
	useEffect(() => {
		tuningRef.current = effectiveTuning;
	}, [effectiveTuning]);

	const handleLoadTune = useCallback(
		(tune: SavedTune) => {
			pendingTuningRef.current = tune.manualTuning;
			setOwnedMods(Array.isArray(tune.ownedMods) ? tune.ownedMods : []);
			setDisabledMods(
				Array.isArray(tune.disabledMods) ? tune.disabledMods : []
			);
			setModSettings(tune.modSettings || {});
		},
		[setOwnedMods, setDisabledMods, setModSettings]
	);

	const buyMods = useCallback(
		(modsToBuy: ModNode[]) => {
			let totalCost = 0;
			const newModIds: string[] = [];
			const conflictsToRemove: string[] = [];

			modsToBuy.forEach((mod) => {
				if (!ownedMods.includes(mod.id)) {
					totalCost += mod.cost;
					newModIds.push(mod.id);

					// Check for conflicts
					if (mod.conflictsWith) {
						mod.conflictsWith.forEach((conflictId) => {
							if (ownedMods.includes(conflictId)) {
								conflictsToRemove.push(conflictId);
							}
						});
					}
				}
			});

			if (money >= totalCost && newModIds.length > 0) {
				setMoney((m) => m - totalCost);

				// Calculate new owned mods
				const currentOwned = [...ownedMods];
				const filtered = currentOwned.filter(
					(id) => !conflictsToRemove.includes(id)
				);
				const finalOwnedMods = [...filtered, ...newModIds];

				setOwnedMods(finalOwnedMods);

				// Update Garage immediately for save
				const newGarage = [...garage];
				if (newGarage[currentCarIndex]) {
					newGarage[currentCarIndex] = {
						...newGarage[currentCarIndex],
						ownedMods: finalOwnedMods,
					};
				}
				setGarage(newGarage);
				saveGame({ money: money - totalCost, garage: newGarage }); // Immediate Save

				if (conflictsToRemove.length > 0) {
					showToast(
						`Purchased ${newModIds.length} parts. Removed ${conflictsToRemove.length} conflicting parts.`,
						'SUCCESS'
					);
				} else {
					showToast(
						`Purchased ${newModIds.length} parts for $${totalCost}`,
						'SUCCESS'
					);
				}
			} else if (newModIds.length === 0) {
				// Already owned
			} else {
				showToast('Not enough money to buy parts!', 'ERROR');
			}
		},
		[money, ownedMods, showToast, garage, currentCarIndex, saveGame]
	);

	// --- Toast Logic ---
	const prevMoneyRef = useRef(money);
	const prevOwnedModsRef = useRef(ownedMods);
	const initialLoadHandled = useRef(false);
	const [seenAffordableMods, setSeenAffordableMods] = useState<Set<string>>(
		() => {
			const saved = localStorage.getItem('seenAffordableMods');
			return saved ? new Set(JSON.parse(saved)) : new Set();
		}
	);

	// useEffect(() => {
	// 	if (!isGameLoaded) return;

	// 	if (!initialLoadHandled.current) {
	// 		initialLoadHandled.current = true;
	// 		prevOwnedModsRef.current = ownedMods;
	// 		prevMoneyRef.current = money;
	// 		return;
	// 	}

	// 	// Check for money thresholds
	// 	if (money > prevMoneyRef.current) {
	// 		// Find mods that were not affordable before but are now
	// 		const newlyAffordable = MOD_TREE.filter(
	// 			(mod) =>
	// 				!ownedMods.includes(mod.id) &&
	// 				mod.cost <= money &&
	// 				(!mod.parentId || ownedMods.includes(mod.parentId)) &&
	// 				!seenAffordableMods.has(mod.id)
	// 		);

	// 		if (newlyAffordable.length > 0) {
	// 			// Show toast for all newly affordable items
	// 			newlyAffordable.forEach((mod) => {
	// 				showToast(
	// 					`${mod.name} is now available for purchase in the shop`,
	// 					mod.type as any
	// 				);
	// 			});

	// 			// Mark as seen
	// 			setSeenAffordableMods((prev) => {
	// 				const next = new Set(prev);
	// 				newlyAffordable.forEach((m) => next.add(m.id));
	// 				localStorage.setItem(
	// 					'seenAffordableMods',
	// 					JSON.stringify(Array.from(next))
	// 				);
	// 				return next;
	// 			});
	// 		}
	// 	}
	// 	prevMoneyRef.current = money;

	// 	// Check for new unlocks/purchases
	// 	if (ownedMods.length > prevOwnedModsRef.current.length) {
	// 		const newModId = ownedMods.find(
	// 			(id) => !prevOwnedModsRef.current.includes(id)
	// 		);
	// 		const mod = MOD_TREE.find((m) => m.id === newModId);
	// 		if (mod) {
	// 			showToast(`Purchased ${mod.name}!`, mod.type as any);
	// 		}
	// 	}
	// 	prevOwnedModsRef.current = ownedMods;
	// }, [money, ownedMods, showToast, isGameLoaded, seenAffordableMods]);

	// Challenge Logic Removed
	// const handleChallengeRival = ...

	const { startMission, confirmStartRace, startTestTrack } = useRaceSetup(
		missionRef,
		currentWagerRef,
		setRaceResult,
		money,
		setMoney,
		showToast,
		audioRef,
		opponentAudioRef,
		playerTuning,
		effectiveTuning,
		setPhase,
		setRaceStatus,
		setCountdownNum,
		countdownStartRef,
		raceStartTimeRef,
		currentGhostRecording,
		raceFinishedProcessingRef,
		setWeather,
		setBgTrees,
		maxTreeYRef,
		playerRef,
		opponentRef,
		inputsRef,
		lastGearRef,
		shiftDebounce,
		setUiState,
		setMissedGearAlert,
		quarterMileTimeRef,
		mileTimeRef
	);

	// Level Up Logic
	useEffect(() => {
		const nextLevelThreshold = calculateNextLevelXp(level);
		if (xp >= nextLevelThreshold) {
			setLevel((l) => l + 1);
			const newXp = Math.max(0, xp - nextLevelThreshold);
			setXp(newXp);
			saveGame({ level: level + 1, xp: newXp }); // Immediate Save
			// showToast(`LEVEL UP! You are now Level ${level + 1}`, 'SUCCESS');
		}
	}, [xp, level, showToast, saveGame]);

	// Daily Rewards
	const { handleClaimDailyReward } = useDailyRewards(
		isGameLoaded,
		loginStreak,
		setLoginStreak,
		token,
		setMoney,
		setRawMoney,
		notifyMoneyUpdate,
		setXp,
		inventory,
		setInventory,
		saveGame,
		showToast,
		setShowDailyRewards
	);

	// --- Main Loop ---
	useEffect(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		let animId: number;
		lastTimeRef.current = performance.now();

		const render = (time: number) => {
			const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05);
			lastTimeRef.current = time;

			if (
				((phase === 'RACE' || phase === 'ONLINE_RACE') &&
					missionRef.current) ||
				phase === 'TEST_TRACK'
			) {
				const p = playerRef.current;
				const o = opponentRef.current;
				const m = missionRef.current;
				const raceDistance =
					phase === 'TEST_TRACK' ? 402 : m?.distance || 402;

				// Countdown Logic
				if (phase === 'ONLINE_RACE' && raceStatus === 'COUNTDOWN') {
					// Online: raceStartTimeRef is the Target Start Time
					const remaining = raceStartTimeRef.current - time;
					if (remaining <= 0) {
						setRaceStatus('RACING');
						setCountdownNum('GO!');
						setTimeout(() => setCountdownNum(''), 1000);

						// Unmute audio
						audioRef.current.setVolume(0.4);
						opponentAudioRef.current.setVolume(0.4);
					} else {
						setCountdownNum(Math.ceil(remaining / 1000));
					}
				} else if (raceStatus === 'COUNTDOWN') {
					// Local: countdownStartRef is Start of Countdown (3s duration)
					const elapsed = time - countdownStartRef.current;
					const remaining = 3000 - elapsed;
					if (remaining <= 0) {
						setRaceStatus('RACING');
						setCountdownNum('GO!');
						raceStartTimeRef.current = time;
						setTimeout(() => setCountdownNum(''), 1000);

						// Unmute audio when race actually starts
						audioRef.current.setVolume(0.4);
						opponentAudioRef.current.setVolume(0.4);
					} else {
						setCountdownNum(Math.ceil(remaining / 1000));
					}
				}

				// Update Physics
				if (!p.finished) {
					// Mechanical Failure Logic (Missed Gears)
					const currentCar = garage[currentCarIndex];
					if (
						currentCar &&
						currentCar.condition !== undefined &&
						currentCar.condition < 0.9
					) {
						if (
							inputsRef.current.shiftUp ||
							inputsRef.current.shiftDown
						) {
							// Chance to miss gear: 0% at 0.9 condition, up to 30% at 0 condition
							const failureChance =
								(0.9 - currentCar.condition) * 0.3;
							if (Math.random() < failureChance) {
								inputsRef.current.shiftUp = false;
								inputsRef.current.shiftDown = false;

								// Trigger HUD Alert
								setMissedGearAlert(true);
								setTimeout(
									() => setMissedGearAlert(false),
									1000
								);

								// Optional: Play grind sound here if available
							}
						}
					}
					if (p.y >= raceDistance && phase !== 'TEST_TRACK') {
						p.finished = true;
						p.finishTime = (time - raceStartTimeRef.current) / 1000;
						setPlayerFinishTime(p.finishTime);
						p.velocity = 0;
						p.rpm = 1000;
					}
					// Only update physics if not finished
					if (!p.finished) {
						updateCarPhysics(
							p,
							tuningRef.current,
							inputsRef.current,
							dt,
							false,
							audioRef.current,
							raceStatus,
							raceStartTimeRef.current,
							currentGhostRecording,
							undefined,
							weather.type === 'RAIN' ? 0.6 : 1.0,
							settings
						);

						// Reset shift inputs after processing
						inputsRef.current.shiftUp = false;
						inputsRef.current.shiftDown = false;
					} else {
						// Keep car stopped at finish line
						p.y = Math.min(p.y, raceDistance);
						p.velocity = 0;
						audioRef.current.setVolume(0);
					}
				} else {
					audioRef.current.setVolume(0);
				}

				// --- Procedural Tree Generation (Test Track) ---
				if (phase === 'TEST_TRACK') {
					const viewDistance = 500; // Generate 500m ahead
					if (p.y + viewDistance > maxTreeYRef.current) {
						const { trees: newTrees, newMaxY } =
							TestTrackUtils.generateProceduralTrees(
								maxTreeYRef.current
							);

						setBgTrees((prev) => {
							// Filter old trees behind player to save memory
							const keep = prev.filter((t) => t.y > p.y - 100);
							const combined = [...keep, ...newTrees];
							combined.sort((a, b) => b.y - a.y);
							return combined;
						});
						maxTreeYRef.current = newMaxY;
					}

					// Test Track Timestamps
					if (raceStartTimeRef.current > 0) {
						const currentTime =
							(time - raceStartTimeRef.current) / 1000;
						if (p.y >= 402 && !quarterMileTimeRef.current) {
							quarterMileTimeRef.current = currentTime;
							showToast(
								`1/4 Mile: ${currentTime.toFixed(3)}s`,
								'INFO'
							);
						}
						if (p.y >= 1609 && !mileTimeRef.current) {
							mileTimeRef.current = currentTime;
							showToast(
								`1 Mile: ${currentTime.toFixed(3)}s`,
								'INFO'
							);
						}
					}
				}

				if (!o.finished && phase !== 'TEST_TRACK') {
					if (phase === 'ONLINE_RACE') {
						// TODO: Update from network/socket
						// For now, opponent is static or controlled by external events
					} else if (m) {
						updateCarPhysics(
							o,
							m.opponent.tuning,
							{
								gas: true,
								shiftUp: false,
								shiftDown: false,
								clutch: false,
								brake: false,
								purge: false,
							},
							dt,
							true,
							opponentAudioRef.current,
							raceStatus,
							raceStartTimeRef.current,
							undefined,
							m.opponent,
							weather.type === 'RAIN' ? 0.6 : 1.0
						);
					}
					if (o.y >= raceDistance) {
						o.finished = true;
						o.finishTime = (time - raceStartTimeRef.current) / 1000;
					}
				} else {
					opponentAudioRef.current.setVolume(0);
				}

				// --- Audio Spatialization ---
				if (raceStatus === 'RACING') {
					const distance = o.y - p.y; // Positive if opponent ahead
					const relVel = o.velocity - p.velocity;

					// Player audio is static center
					// Opponent audio moves
					opponentAudioRef.current.setSpatial(distance, relVel, 0.5); // Pan slightly right
				}

				// Check Win Condition
				if (raceStatus === 'RACING') {
					// Test Track Finish
					if (phase === 'TEST_TRACK' && p.finished) {
						setRaceStatus('FINISHED');
						setRaceResult('WIN'); // Use WIN to show results modal
						setPlayerFinishTime(p.finishTime);
						return;
					}

					// Normal Race Finish
					if (p.finished || o.finished) {
						if (
							p.finished &&
							(!o.finished || p.finishTime < o.finishTime)
						) {
							processRaceFinish(
								p,
								o,
								phase,
								currentWagerRef.current,
								p.finishTime,
								o.finishTime
							);
						} else if (
							o.finished &&
							(!p.finished || o.finishTime < p.finishTime)
						) {
							processRaceFinish(
								p,
								o,
								phase,
								currentWagerRef.current,
								p.finishTime,
								o.finishTime
							);
						}
					}
				}

				// Update finish times for UI
				if (p.finished && playerFinishTime === 0) {
					setPlayerFinishTime(p.finishTime);
				}
				if (o.finished && opponentFinishTime === 0) {
					setOpponentFinishTime(o.finishTime);
				}

				drawFrame(
					ctx,
					canvas,
					phase,
					p,
					o,
					raceDistance,
					weather,
					bgTrees,
					seasonalTreesImg,
					ownedMods,
					tuningRef.current.color,
					missionRef.current?.opponent.color || '#ff0000',
					activeGhost.current || [],
					raceStatus,
					raceStartTimeRef.current,
					time,
					particleSystemRef.current,
					dt,
					garage,
					currentCarIndex,
					inputsRef.current
				);

				setUiState({ player: { ...p }, opponent: { ...o } });
			} else {
				drawMenuBackground(ctx, canvas, time);
			}

			animId = requestAnimationFrame(render);
		};

		animId = requestAnimationFrame(render);
		return () => cancelAnimationFrame(animId);
	}, [phase, raceStatus, missions, garage, processRaceFinish]); // eslint-disable-line react-hooks/exhaustive-deps
	const onManualTuningChange = useCallback(
		(tuningUpdates: Partial<TuningState>) => {
			setPlayerTuning((prev) => ({ ...prev, ...tuningUpdates }));
			setGarage((prevGarage) => {
				const newGarage = [...prevGarage];
				const currentCar = newGarage[currentCarIndex];
				if (currentCar) {
					newGarage[currentCarIndex] = {
						...currentCar,
						manualTuning: {
							...currentCar.manualTuning,
							...tuningUpdates,
						},
					};
				}
				return newGarage;
			});
		},
		[currentCarIndex]
	);

	// Game Context Value (Extracted for use in Modals)
	const gameContextValue = {
		phase,
		setPhase,
		money,
		setMoney,
		playerTuning,
		effectiveTuning,
		setPlayerTuning,
		ownedMods,
		setOwnedMods: (mod: any) => {
			if (!ownedMods.includes(mod.id)) {
				setOwnedMods((prev) => [...prev, mod.id]);
			}
		},
		missions,
		dailyChallenges,
		onStartMission: startMission,
		onConfirmRace: confirmStartRace,
		selectedMission: missionRef.current,
		disabledMods,
		setDisabledMods,
		modSettings,
		setModSettings,
		onLoadTune: handleLoadTune,
		weather,
		setWeather,
		showToast,
		dynoHistory,
		setDynoHistory,
		previousDynoHistory,
		onDynoRunStart: handleDynoRunStart,
		garage,
		setGarage,
		currentCarIndex,
		setCurrentCarIndex,
		undergroundLevel,
		setUndergroundLevel,
		onBuyMods: buyMods,
		junkyardCars,
		onBuyJunkyardCar: buyJunkyardCar,
		onRefreshJunkyard: refreshJunkyard,
		junkyardParts,
		onBuyJunkyardPart: buyJunkyardPart,
		onRestoreCar: restoreCar,
		onScrapCar: scrapCar,
		missionSelectTab,
		setMissionSelectTab,
		xp,
		level,
		defeatedRivals,
		userInventory: inventory,
		setUserInventory: setInventory,
		onMerge: handleMerge,
		dealershipCars,
		onBuyDealershipCar: buyDealershipCar,
		onRefreshDealership: refreshDealership,
		onBuyShopItem: buyShopItem,
		onRefreshDailyShop: refreshDailyShop,
		dailyShopItems,
		onTestTrack: startTestTrack,
		showDailyRewards,
		setShowDailyRewards,
		onManualTuningChange,
		settings,
		setSettings,
		saveGame,
		showSeasonPass,
		setShowSeasonPass,
	};

	return (
		<div className="relative w-full h-full bg-black overflow-hidden font-sans select-none">
			{!assetsLoaded && (
				<Preloader
					onComplete={() => {
						// Initialize audio contexts on user interaction
						audioRef.current.init();
						opponentAudioRef.current.init();
						audioInitializedRef.current = true;
						setAssetsLoaded(true);
					}}
				/>
			)}

			<canvas
				ref={canvasRef}
				width={window.innerWidth}
				height={window.innerHeight}
				className="block"
			/>

			{/* HUD only in Race */}
			{(phase === 'RACE' ||
				phase === 'ONLINE_RACE' ||
				phase === 'TEST_TRACK') && (
				<>
					<Dashboard
						carState={uiState.player}
						tuning={playerTuning}
						opponentState={uiState.opponent}
						raceDistance={
							phase === 'TEST_TRACK'
								? 402
								: missionRef.current?.distance || 402
						}
						missedGear={missedGearAlert}
						settings={settings}
						isTestTrack={phase === 'TEST_TRACK'}
						onTouchControl={handleTouchControl}
					/>
					<CountdownOverlay countdownNum={countdownNum} />
					{phase === 'TEST_TRACK' && (
						<TestTrackControls
							onBack={() => {
								audioRef.current.stop();
								setRaceResult(null);
								setPhase('GARAGE');
							}}
						/>
					)}
				</>
			)}

			<RaceResults
				phase={phase}
				raceResult={raceResult}
				level={level}
				xp={xp}
				money={money}
				missionRef={missionRef}
				currentWagerRef={currentWagerRef}
				playerFinishTime={playerFinishTime}
				opponentFinishTime={opponentFinishTime}
				inventory={inventory}
				wearResult={wearResult}
				opponentRef={opponentRef}
				lastRaceMastery={lastRaceMastery}
				startTestTrack={startTestTrack}
				onExit={() => {
					audioRef.current.stop();
					setRaceResult(null);
					setPhase('GARAGE');
				}}
				startMission={startMission}
				onLeaveOnlineRace={() => {
					audioRef.current.stop();
					opponentAudioRef.current.stop();
					setRaceResult(null);
					if (phase === 'ONLINE_RACE') {
						fetch(getFullUrl('/api/race', `partyId=${party?.id}`), {
							method: 'DELETE',
							headers: {
								Authorization: `Bearer ${token}`,
							},
						}).then(() => {
							setPhase('MAP');
							setRaceStatus('IDLE');
						});
					} else {
						setPhase('MAP');
					}
				}}
			/>

			{/* Menu UI */}
			{(phase === 'MENU' ||
				phase === 'GARAGE' ||
				phase === 'MAP' ||
				phase === 'MISSION_SELECT' ||
				phase === 'JUNKYARD' ||
				phase === 'SHOP' ||
				phase === 'AUCTION') && (
				<SoundProvider
					play={(type) => audioRef.current.playUISound(type)}
				>
					<GameProvider value={gameContextValue}>
						<GameMenu />
					</GameProvider>
				</SoundProvider>
			)}

			{/* Daily Rewards Modal */}
			{/* Season Pass Modal */}
			{showSeasonPass && (
				<GameProvider value={gameContextValue}>
					<SeasonPass
						progress={seasonProgress}
						onClaim={(tier, isPremium) => {
							// Logic to claim reward
							const rewardList = SEASON_REWARDS.find(
								(r) => r.tier === tier
							);
							if (!rewardList) return;

							const reward = isPremium
								? rewardList.premiumReward
								: rewardList.freeReward;
							if (!reward) return;

							// Add reward to player
							if (reward.type === 'MONEY') {
								setMoney((m) => m + (reward.amount || 0));
							} else if (reward.type === 'XP') {
								setXp((x) => x + (reward.amount || 0));
							} else if (
								reward.type === 'ITEM' &&
								reward.itemId
							) {
								const itemDef = GAME_ITEMS.find(
									(i) => i.id === reward.itemId
								);
								if (itemDef) {
									const newItem =
										ItemGenerator.generateItem(itemDef);
									if (reward.itemRarity) {
										newItem.rarity = reward.itemRarity;
									}
									setInventory((prev) => [...prev, newItem]);
									showToast(
										`Claimed ${newItem.name}!`,
										'SUCCESS'
									);
								} else {
									showToast(`Item not found, +$1000`, 'INFO');
									setMoney((m) => m + 1000);
								}
							} else if (reward.type === 'CRATE') {
								showToast(
									`Claimed ${reward.crateType} Crate!`,
									'INFO'
								);
								// Logic to add crate
							}

							// Update progress
							setSeasonProgress((prev) => ({
								...prev,
								claimedFreeTiers: isPremium
									? prev.claimedFreeTiers
									: [...prev.claimedFreeTiers, tier],
								claimedPremiumTiers: isPremium
									? [...prev.claimedPremiumTiers, tier]
									: prev.claimedPremiumTiers,
							}));

							showToast('Reward Claimed!', 'SUCCESS');
						}}
						onClose={() => setShowSeasonPass(false)}
						onBuyPremium={() => {
							if (money >= 10000) {
								setMoney((m) => m - 10000);
								setSeasonProgress((prev) => ({
									...prev,
									isPremium: true,
								}));
								showToast('Premium Pass Activated!', 'SUCCESS');
								// play('purchase');
							} else {
								showToast(
									'Need $10,000 for Premium Pass',
									'ERROR'
								);
							}
						}}
					/>
				</GameProvider>
			)}

			{showDailyRewards && (
				<DailyRewardsModal
					loginStreak={loginStreak}
					onClaim={handleClaimDailyReward}
					onClose={() => setShowDailyRewards(false)}
				/>
			)}

			{isSyncing && <SavingIndicator />}
		</div>
	);
};

export default GameCanvas;
