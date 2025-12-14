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
import { ItemMerge } from '../utils/ItemMerge';
import { getFullUrl } from '../utils/prisma';
import { ItemGenerator } from '../utils/ItemGenerator';
import { TestTrackUtils } from '../utils/TestTrackUtils';
import { TopBar } from '@/components/menu/shared/TopBar';
import Dashboard from './Dashboard';
import { SoundProvider } from '../contexts/SoundContext';
import { DailyRewardsModal } from './menu/DailyRewardsModal';
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
} from '../types';
import { GameSettings } from '../contexts/GameContext';
import { GameMenu } from './GameMenu';

const PPM = 40; // Pixels Per Meter - Visual Scale

type RaceStatus = 'IDLE' | 'COUNTDOWN' | 'RACING' | 'FINISHED';

const MasteryLevelUp: React.FC<{
	initialLevel: number;
	initialXP: number;
	xpGain: number;
}> = ({ initialLevel, initialXP, xpGain }) => {
	const [level, setLevel] = useState(initialLevel);
	const [xp, setXp] = useState(initialXP);
	const [showGain, setShowGain] = useState(false);

	useEffect(() => {
		// 1. Initial Delay (1s)
		const startDelay = setTimeout(() => {
			setShowGain(true);

			// Calculate targets
			let currentLevel = initialLevel;
			let currentXP = initialXP;
			let remainingGain = xpGain;

			const animate = () => {
				const threshold = (currentLevel + 1) * 1000;
				const space = threshold - currentXP;

				if (remainingGain >= space) {
					// Level Up
					setXp(threshold); // Fill bar
					setTimeout(() => {
						// Reset and increment
						remainingGain -= space;
						currentLevel++;
						currentXP = 0;
						setLevel(currentLevel);
						setXp(0);

						// Continue animation if more gain
						if (remainingGain > 0) {
							setTimeout(animate, 500);
						}
					}, 1000); // Wait at full bar
				} else {
					// Simple fill
					setXp(currentXP + remainingGain);
				}
			};

			animate();
		}, 1000);

		return () => clearTimeout(startDelay);
	}, [initialLevel, initialXP, xpGain]);

	const threshold = (level + 1) * 1000;
	const progress = Math.min(100, (xp / threshold) * 100);

	return (
		<div className="bg-gray-900/80 p-4 rounded border border-indigo-500/30 mb-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
			<div className="flex justify-between items-end mb-2">
				<div className="text-indigo-400 font-bold pixel-text text-sm">
					CAR MASTERY
				</div>
				<div className="text-white font-mono text-xs transition-all duration-300">
					LVL {level}
				</div>
			</div>
			<div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden relative">
				<div
					className="h-full bg-indigo-500 transition-all duration-1000 ease-out"
					style={{ width: `${progress}%` }}
				/>
				<div className="absolute inset-0 flex items-center justify-center text-[8px] text-white font-bold shadow-black drop-shadow-md">
					{Math.floor(xp)} / {threshold} XP
				</div>
			</div>
			<div
				className={`text-center text-xs text-green-400 mt-1 font-mono transition-opacity duration-500 ${
					showGain ? 'opacity-100' : 'opacity-0'
				}`}
			>
				+{xpGain} XP
			</div>
		</div>
	);
};

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

	useEffect(() => {
		const img = new Image();
		img.src = '/seasonal-trees.png';
		img.onload = () => setSeasonalTreesImg(img);
	}, []);

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

	// Junkyard State
	const [junkyardCars, setJunkyardCars] = useState<JunkyardCar[]>([]);
	const [junkyardParts, setJunkyardParts] = useState<JunkyardItem[]>([]);
	const [dealershipCars, setDealershipCars] = useState<JunkyardCar[]>([]);
	const [refreshCount, setRefreshCount] = useState(0);

	// Daily Shop State
	const [dailyShopItems, setDailyShopItems] = useState<InventoryItem[]>([]);
	const [lastDailyRefresh, setLastDailyRefresh] = useState<number>(0);

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
	const [showDailyRewards, setShowDailyRewards] = useState(false);

	// Persistence Hook
	const {
		loaded: isGameLoaded,
		notifyMoneyUpdate,
		saveGame,
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
		setLoginStreak
	);

	const setMoney = useCallback(
		(value: React.SetStateAction<number>) => {
			setRawMoney(value);
			notifyMoneyUpdate();
		},
		[notifyMoneyUpdate]
	);

	const generateJunkyardCars = useCallback(() => {
		const cars: JunkyardCar[] = [];
		// Generate more cars since it's the only source now
		for (let i = 0; i < 6; i++) {
			cars.push(
				CarGenerator.generateJunkyardCar(`junk_${Date.now()}_${i}`)
			);
		}
		setJunkyardCars(cars);

		// Generate Parts
		const parts: JunkyardItem[] = [];
		for (let i = 0; i < 12; i++) {
			const item = ItemGenerator.generateJunkyardItem();
			// Price is based on value but heavily discounted due to junkyard status
			const price = Math.max(50, Math.floor(item.value * 0.8));
			parts.push({ ...item, price });
		}
		setJunkyardParts(parts);
	}, []);

	// Dealership Logic
	const generateDealershipCars = useCallback(() => {
		const cars: JunkyardCar[] = [];
		for (let i = 0; i < 6; i++) {
			cars.push(
				CarGenerator.generateDealershipCar(`dealer_${Date.now()}_${i}`)
			);
		}
		setDealershipCars(cars);
	}, []);

	const buyJunkyardPart = useCallback(
		(part: JunkyardItem) => {
			if (money >= part.price) {
				if (token) {
					processMoneyTransaction(
						token,
						'SHOP_PURCHASE',
						-part.price,
						{ itemId: part.instanceId }
					)
						.then((res) => setMoney(res.newBalance))
						.catch((e) => {
							console.error(e);
							setMoney((m) => m - part.price); // Fallback
						});
				} else {
					setMoney((m) => m - part.price);
				}

				const newInventory = [...inventory, part];
				setInventory(newInventory);
				setJunkyardParts((prev) =>
					prev.filter((p) => p.instanceId !== part.instanceId)
				);
				showToast(`Bought ${part.name}`, 'SUCCESS');
				audioRef.current.playUISound('purchase');

				// Persist inventory change
				saveGame({ inventory: newInventory });
			} else {
				showToast('Not enough money!', 'ERROR');
				audioRef.current.playUISound('error');
			}
		},
		[money, showToast, token, saveGame] // Removed inventory from dependency to avoid stale closure issues if we don't use it directly in saveGame
	);

	useEffect(() => {
		if (junkyardCars.length === 0) {
			generateJunkyardCars();
		}
		if (dealershipCars.length === 0) {
			generateDealershipCars();
		}
	}, []);

	// Daily Shop Logic
	const refreshDailyShop = useCallback(() => {
		const items: InventoryItem[] = [];
		// Generate 3 special daily items
		for (let i = 0; i < 3; i++) {
			items.push(ItemGenerator.generateDailySpecial());
		}
		setDailyShopItems(items);
		setLastDailyRefresh(Date.now());
		// showToast('Daily Special Parts Refreshed!', 'INFO');
	}, []);

	useEffect(() => {
		// Check for daily refresh
		const ONE_DAY = 24 * 60 * 60 * 1000;
		if (
			Date.now() > lastDailyRefresh + ONE_DAY ||
			dailyShopItems.length === 0
		) {
			refreshDailyShop();
		}
	}, [lastDailyRefresh, dailyShopItems.length, refreshDailyShop]);

	// Online Race Trigger
	useEffect(() => {
		if (party?.activeRaceId && phase !== 'ONLINE_RACE') {
			console.log('🏎️ Starting Online Race!');
			setPhase('ONLINE_RACE');

			// Setup dummy mission for renderer
			missionRef.current = {
				id: party.activeRaceId,
				name: 'ONLINE RACE',
				description: 'PvP Drag Race',
				payout: 500, // Small participation reward?
				difficulty: 'HARD',
				distance: 400, // Standard 1/4 mile
				opponent: {
					name: 'Opponent',
					difficulty: 5,
					color: '#ff0000',
					tuning: BASE_TUNING,
				},
			};

			// Reset Cars
			playerRef.current = {
				y: 0,
				velocity: 0,
				rpm: 1000,
				gear: 0,
				finished: false,
				finishTime: 0,
			};
			opponentRef.current = {
				y: 0,
				velocity: 0,
				rpm: 1000,
				gear: 0,
				finished: false,
				finishTime: 0,
			};

			// Set Dummy Mission for Online Race (Required for Physics/HUD)
			missionRef.current = {
				id: 'online_race',
				name: 'Online Race',
				description: 'Multiplayer Drag Race',
				payout: 0, // Handled by betting
				difficulty: 'HARD',
				distance: 402, // 1/4 mile
				opponent: {
					name: 'Opponent',
					difficulty: 5,
					color: '#ff0000',
					tuning: BASE_TUNING,
				},
			};

			// --- Setup Environment for Online Race (Same as missions) ---
			const onlineRaceDistance = 402; // 1/4 mile
			const seasons: Season[] = ['SPRING', 'SUMMER', 'FALL', 'WINTER'];
			const randomSeason =
				seasons[Math.floor(Math.random() * seasons.length)];

			// Weather Logic
			const isRain = Math.random() < 0.2 && randomSeason !== 'WINTER';
			setWeather({
				type: isRain ? 'RAIN' : 'SUNNY',
				intensity: isRain ? 0.5 + Math.random() * 0.5 : 0,
				season: randomSeason,
			});

			// Generate Trees
			const newTrees: { x: number; y: number; scale: number }[] = [];
			const treeCount = Math.floor(onlineRaceDistance * 8); // High density: ~1 tree per 2m
			for (let i = 0; i < treeCount; i++) {
				const side = Math.random() > 0.5 ? 1 : -1;
				const x = side * (5 + Math.random() * 30);
				const y = -20 + Math.random() * (onlineRaceDistance + 100);
				const scale = 0.8;
				newTrees.push({ x, y, scale });
			}
			newTrees.sort((a, b) => b.y - a.y);
			setBgTrees(newTrees);
			// Wait for server start time
			const checkStart = setInterval(async () => {
				if (
					(phase as string) !== 'ONLINE_RACE' ||
					!party?.activeRaceId
				) {
					clearInterval(checkStart);
					return;
				}
				try {
					// 1. Send Ready Signal (Auto-ready on load)
					// We only do this once, but polling is fine as it's idempotent-ish or we can check status
					// Actually, let's just poll status. If status is WAITING, we send ready.

					const res = await fetch(
						getFullUrl('/api/race', `partyId=${party.id}`),
						{
							headers: { Authorization: `Bearer ${token}` },
						}
					);
					if (res.ok) {
						const race = await res.json();
						console.log('Race Poll:', race.status, race.startTime);

						if (race.status === 'WAITING_FOR_PLAYERS') {
							setRaceStatus('IDLE'); // Or a new local status 'WAITING'
							setCountdownNum('WAITING FOR PLAYERS...');

							// Send Ready Signal
							await fetch(
								getFullUrl('/api/race', 'action=ready'),
								{
									method: 'POST',
									headers: {
										'Content-Type': 'application/json',
										Authorization: `Bearer ${token}`,
									},
									body: JSON.stringify({ raceId: race.id }),
								}
							);
						} else if (
							race.status === 'COUNTDOWN' &&
							race.startTime
						) {
							const serverStartTime = new Date(
								race.startTime
							).getTime();
							const now = Date.now();
							const diff = serverStartTime - now;
							// console.log('Countdown Diff:', diff);

							// Sync race start time to local performance.now()
							// raceStartTimeRef will be the FUTURE time when race starts
							raceStartTimeRef.current = performance.now() + diff;

							if (diff > 0) {
								setRaceStatus('COUNTDOWN');
								// Render loop will handle the countdown update
							} else {
								// Race already started
								setRaceStatus('RACING');
								setCountdownNum('GO!');
								setTimeout(() => setCountdownNum(''), 1000);
							}
						}
					}
				} catch (e) {}
			}, 500); // Poll faster for responsiveness

			// Reset Player State explicitly when entering ONLINE_RACE
			playerRef.current = {
				y: 0,
				velocity: 0,
				rpm: 1000,
				gear: 0,
				finished: false,
				finishTime: 0,
			};
			opponentRef.current = {
				y: 0,
				velocity: 0,
				rpm: 1000,
				gear: 0,
				finished: false,
				finishTime: 0,
			};
			setPlayerFinishTime(0);
			setOpponentFinishTime(0);

			return () => clearInterval(checkStart);
		} else if (!party?.activeRaceId && phase === 'ONLINE_RACE') {
			// Only exit if we don't have results yet
			if (!raceResult) {
				setPhase('MAP');
				setRaceStatus('IDLE');
			}
		}
	}, [party?.activeRaceId, phase, raceResult]);

	// Online Sync
	useEffect(() => {
		if (
			phase !== 'ONLINE_RACE' ||
			!party?.activeRaceId ||
			!token ||
			!party?.id
		)
			return;

		const sync = async () => {
			const p = playerRef.current;
			try {
				// 1. Send State
				const postRes = await fetch(
					getFullUrl('/api/race', 'action=sync'),
					{
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${token}`,
						},
						body: JSON.stringify({
							raceId: party.activeRaceId,
							progress: p.y,
							speed: p.velocity,
							finished: p.finished,
							time: p.finishTime,
						}),
					}
				);

				if (postRes.ok) {
					const data = await postRes.json();
					// Check if race finished via POST response (it might be deleted now)
					if (data.status === 'FINISHED' && !raceResult) {
						if (data.winnerId === user?.id) {
							setRaceResult('WIN');
						} else {
							setRaceResult('LOSS');
						}
						setRaceStatus('FINISHED');

						// Trigger Wear Logic
						if (!wearResult) {
							const calculatedWear: Record<string, number> = {};
							const wearBase = 0.5;
							const wearVariance = 1.0;
							inventory.forEach((item) => {
								if (item.equipped) {
									const wear =
										wearBase + Math.random() * wearVariance;
									calculatedWear[item.instanceId] = wear;
								}
							});
							setInventory((prev) =>
								prev.map((item) => {
									if (calculatedWear[item.instanceId]) {
										const current =
											item.condition !== undefined
												? item.condition
												: 100;
										return {
											...item,
											condition: Math.max(
												0,
												current -
													calculatedWear[
														item.instanceId
													]
											),
										};
									}
									return item;
								})
							);
							setWearResult(calculatedWear);
						}
						// Return early since race is likely deleted
						return;
					}
				}

				// 2. Get State (Only if not finished/deleted)
				const res = await fetch(
					getFullUrl('/api/race', `partyId=${party.id}`),
					{
						headers: { Authorization: `Bearer ${token}` },
					}
				);
				if (res.ok) {
					const race = await res.json();
					if (race) {
						if (race.betAmount !== undefined) {
							currentWagerRef.current = race.betAmount;
						}

						// Check for race finish (Global or Local)
						const isRaceOver =
							race.status === 'FINISHED' ||
							(race.winnerId && p.finished);

						if (isRaceOver && !raceResult) {
							// Determine winner
							if (race.winnerId === user?.id) {
								setRaceResult('WIN');
							} else {
								setRaceResult('LOSS');
							}
							if (race.status === 'FINISHED') {
								setRaceStatus('FINISHED');
							}

							// Trigger Wear Logic locally if not already done
							if (!wearResult) {
								const calculatedWear: Record<string, number> =
									{};
								const wearBase = 0.5;
								const wearVariance = 1.0;
								inventory.forEach((item) => {
									if (item.equipped) {
										const wear =
											wearBase +
											Math.random() * wearVariance;
										calculatedWear[item.instanceId] = wear;
									}
								});
								setInventory((prev) =>
									prev.map((item) => {
										if (calculatedWear[item.instanceId]) {
											const current =
												item.condition !== undefined
													? item.condition
													: 100;
											return {
												...item,
												condition: Math.max(
													0,
													current -
														calculatedWear[
															item.instanceId
														]
												),
											};
										}
										return item;
									})
								);
								setWearResult(calculatedWear);
							}
						}

						if (race.playerStates) {
							// Find opponent
							const opponentState = race.playerStates.find(
								(s: any) => s.userId !== user?.id
							);
							if (opponentState) {
								// Update Opponent Ref
								opponentRef.current.y = opponentState.progress;
								opponentRef.current.velocity =
									opponentState.speed;
								opponentRef.current.finished =
									opponentState.finished;
								opponentRef.current.finishTime =
									opponentState.time;
							}
						}
					}
				}
			} catch (e) {
				console.error('Sync error', e);
			}
		};

		const interval = setInterval(sync, 1000);
		sync(); // Initial call
		return () => clearInterval(interval);
	}, [
		phase,
		party?.activeRaceId,
		token,
		user?.id,
		party?.id,
		raceResult,
		wearResult,
		inventory,
	]);

	const buyJunkyardCar = useCallback(
		(car: JunkyardCar) => {
			if (money >= car.price) {
				setMoney((m) => m - car.price);
				const newGarage = [
					...garage,
					{
						id: car.id,
						name: car.name,
						date: Date.now(),
						ownedMods: car.ownedMods, // Include pre-installed mods
						disabledMods: [],
						modSettings: {},
						manualTuning: car.manualTuning || {},
						condition: car.condition,
						originalPrice: car.originalPrice,
						rarity: car.rarity,
						rarityMultiplier: car.rarityMultiplier,
						installedItems: car.installedItems || [],
					},
				];
				setGarage(newGarage);
				saveGame({ money: money - car.price, garage: newGarage }); // Immediate Save
				setJunkyardCars((prev) => prev.filter((c) => c.id !== car.id));
				showToast(`Bought ${car.name} for $${car.price}`, 'SUCCESS');
			} else {
				showToast('Not enough money!', 'ERROR');
			}
		},
		[money, showToast]
	);

	const refreshJunkyard = useCallback(() => {
		const cost = 100 + refreshCount * 50;
		if (money >= cost) {
			setMoney((m) => m - cost);
			setRefreshCount((c) => c + 1);
			generateJunkyardCars();
			// showToast(`Junkyard stock refreshed! (-$${cost})`, 'INFO');
		}
		// else {
		// 	showToast(`Not enough money! Need $${cost}`, 'ERROR');
		// }
	}, [money, refreshCount, generateJunkyardCars, showToast]);

	const buyDealershipCar = useCallback(
		(car: JunkyardCar) => {
			if (money >= car.price) {
				setMoney((m) => m - car.price);
				const newGarage = [
					...garage,
					{
						...car, // Already formatted by generator
						date: Date.now(),
					},
				];
				setGarage(newGarage);
				saveGame({ money: money - car.price, garage: newGarage }); // Immediate Save
				// Remove bought car from stock
				setDealershipCars((prev) =>
					prev.filter((c) => c.id !== car.id)
				);
				showToast(
					`Bought ${car.name} for $${car.price.toLocaleString()}`,
					'SUCCESS'
				);
			} else {
				showToast('Not enough money!', 'ERROR');
			}
		},
		[money, showToast]
	);

	const refreshDealership = useCallback(() => {
		generateDealershipCars();
		showToast('Dealership Inventory Refreshed', 'INFO');
	}, [generateDealershipCars, showToast]);

	const buyShopItem = useCallback(
		(item: InventoryItem) => {
			const price = item.value; // Shop price = estimated value
			if (money >= price) {
				setMoney((m) => m - price);
				const newInventory = [...inventory, item];
				setInventory(newInventory);
				setDailyShopItems((prev) =>
					prev.filter((i) => i.instanceId !== item.instanceId)
				);
				saveGame({ money: money - price, inventory: newInventory }); // Immediate Save
				showToast(`Bought ${item.name}!`, 'SUCCESS');
			} else {
				showToast('Not enough money!', 'ERROR');
			}
		},
		[money, showToast]
	);

	const restoreCar = useCallback(
		(carIndex: number) => {
			const car = garage[carIndex];
			if (!car) return;

			const currentCondition = car.condition || 100;
			if (currentCondition >= 100) {
				showToast('Car is already in perfect condition!', 'INFO');
				return;
			}

			const missing = 100 - currentCondition;
			// Cost is proportional to the car's original value
			// Default value fallback: $10,000
			const baseValue = car.originalPrice || 10000;

			// Restoration Cost Formula:
			// Full restore costs ~50% of the car's value
			const cost = Math.floor((missing / 100) * baseValue * 0.5);

			if (money >= cost) {
				setMoney((m) => m - cost);
				const newGarage = [...garage];
				newGarage[carIndex] = {
					...newGarage[carIndex],
					condition: 100,
				};
				setGarage(newGarage);
				saveGame({ money: money - cost, garage: newGarage }); // Immediate Save
				showToast(`Restored ${car.name} for $${cost}`, 'SUCCESS');
			} else {
				showToast(`Need $${cost} to restore!`, 'ERROR');
			}
		},
		[garage, money, showToast]
	);

	const scrapCar = useCallback(
		(carIndex: number) => {
			if (carIndex === currentCarIndex) {
				showToast('Cannot scrap the currently active car!', 'ERROR');
				return;
			}
			const car = garage[carIndex];
			if (!car) return;

			// Calculate Value (Chassis + Installed Items)
			let itemValue = 0;
			const items = car.installedItems || [];
			items.forEach(
				(i) =>
					(itemValue +=
						(i.value || 0) * (i.condition ? i.condition / 100 : 1))
			);

			const baseValue = car.originalPrice || 10000;
			const condition = car.condition || 1;

			// Scrap Value: ~40% of chassis + 50% of items
			const scrapValue = Math.floor(
				baseValue * (condition / 100) * 0.4 + itemValue * 0.5
			);

			// Add Money
			setMoney((m) => m + scrapValue);
			// Remove from Garage
			const newGarage = garage.filter((_, i) => i !== carIndex);
			setGarage(newGarage);
			saveGame({ money: money + scrapValue, garage: newGarage }); // Immediate Save

			// Adjust current index if needed (if we removed a car before the current one)
			if (carIndex < currentCarIndex) {
				setCurrentCarIndex((c) => c - 1);
				// Update ref to match the shift, ensuring sync logic remains valid
				if (previousCarIndexRef.current > carIndex) {
					previousCarIndexRef.current -= 1;
				}
			}

			showToast(`Scrapped ${car.name} for $${scrapValue}`, 'SUCCESS');
		},
		[garage, currentCarIndex, setMoney, setGarage, showToast]
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

	const inputsRef = useRef<InputState>({
		gas: false,
		shiftUp: false,
		shiftDown: false,
		clutch: false,
		brake: false,
		purge: false,
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

	// --- Input Handling ---
	// Track which keys are currently pressed to prevent repeat firing
	const keysPressed = useRef<Set<string>>(new Set());

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Audio Init on first interaction
			if (!audioInitializedRef.current) {
				audioRef.current.init();
				opponentAudioRef.current.init();
				audioInitializedRef.current = true;
			}

			if (
				phase !== 'RACE' &&
				phase !== 'ONLINE_RACE' &&
				phase !== 'TEST_TRACK'
			)
				return;

			// Prevent repeated keydown events when key is held
			if (keysPressed.current.has(e.key)) return;
			keysPressed.current.add(e.key);

			if (e.key === 'Escape') {
				if (phase === 'TEST_TRACK') {
					// Exit Test Track
					audioRef.current.stop();
					setRaceResult(null);
					setPhase('GARAGE');
					return;
				}
			}

			switch (e.key) {
				case CONTROLS.GAS:
					inputsRef.current.gas = true;
					break;
				case CONTROLS.SHIFT_UP:
					inputsRef.current.shiftUp = true;
					break;
				case CONTROLS.SHIFT_DOWN:
					inputsRef.current.shiftDown = true;
					break;
				case CONTROLS.CLUTCH:
					inputsRef.current.clutch = true;
					break;
				case CONTROLS.BRAKE:
					inputsRef.current.brake = true;
					break;
				case CONTROLS.PURGE:
					inputsRef.current.purge = true;
					break;
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			// Remove from pressed keys set
			keysPressed.current.delete(e.key);

			switch (e.key) {
				case CONTROLS.GAS:
					inputsRef.current.gas = false;
					break;
				case CONTROLS.SHIFT_UP:
					inputsRef.current.shiftUp = false;
					break;
				case CONTROLS.SHIFT_DOWN:
					inputsRef.current.shiftDown = false;
					break;
				case CONTROLS.CLUTCH:
					inputsRef.current.clutch = false;
					break;
				case CONTROLS.BRAKE:
					inputsRef.current.brake = false;
					break;
				case CONTROLS.PURGE:
					inputsRef.current.purge = false;
					break;
			}
		};

		const handleInteraction = () => {
			if (!audioInitializedRef.current) {
				audioRef.current.init();
				opponentAudioRef.current.init();
				audioInitializedRef.current = true;
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);
		window.addEventListener('click', handleInteraction);
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
			window.removeEventListener('click', handleInteraction);
		};
	}, [phase]);

	// Stop audio when leaving race phase
	useEffect(() => {
		if (phase !== 'RACE' && phase !== 'ONLINE_RACE') {
			audioRef.current.stop();
			opponentAudioRef.current.stop();
		} else {
			audioRef.current.start();
			opponentAudioRef.current.start();
		}
	}, [phase]);

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
			[], // safeOwnedMods (Legacy Disabled)
			[], // safeDisabledMods (Legacy Disabled)
			{}, // safeModSettings (Legacy Disabled)
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

	const startMission = (mission: Mission) => {
		missionRef.current = mission;
		confirmStartRace();
	};

	const confirmStartRace = (wager: number = 0) => {
		const mission = missionRef.current;
		if (!mission) return;

		currentWagerRef.current = wager;
		setRaceResult(null); // Reset result

		// Deduct wager
		if (wager > 0) {
			if (money < wager) {
				showToast('Not enough money!', 'WARNING');
				return;
			}
			setMoney((m) => m - wager);
		}

		audioRef.current.setConfiguration(
			playerTuning.cylinders,
			playerTuning.exhaustOpenness,
			playerTuning.backfireAggression,
			playerTuning.turboIntensity
		);
		audioRef.current.setVolume(0); // Start muted
		// Reset spatial
		audioRef.current.setSpatial(0, 0, 0);

		opponentAudioRef.current.setConfiguration(
			mission.opponent.tuning.cylinders,
			mission.opponent.tuning.exhaustOpenness,
			mission.opponent.tuning.backfireAggression,
			mission.opponent.tuning.turboIntensity
		);
		opponentAudioRef.current.setVolume(0); // Start muted
		opponentAudioRef.current.setSpatial(0, 0, 0.5); // Opponent slightly right

		// Start Countdown
		setPhase('RACE');
		setRaceStatus('COUNTDOWN');
		setCountdownNum(3);
		setCountdownNum(3);
		countdownStartRef.current = performance.now();
		raceStartTimeRef.current = 0;
		currentGhostRecording.current = [];
		raceFinishedProcessingRef.current = false;

		// --- Setup Environment ---
		const seasons: Season[] = ['SPRING', 'SUMMER', 'FALL', 'WINTER'];
		const randomSeason =
			seasons[Math.floor(Math.random() * seasons.length)];

		// Weather Logic
		const isRain = Math.random() < 0.2 && randomSeason !== 'WINTER';
		setWeather({
			type: isRain ? 'RAIN' : 'SUNNY',
			intensity: isRain ? 0.5 + Math.random() * 0.5 : 0,
			season: randomSeason,
		});

		// Generate Trees
		const newTrees: { x: number; y: number; scale: number }[] = [];
		const treeCount = Math.floor(mission.distance * 8); // High density: ~1 tree per 2m
		// Place trees widely
		for (let i = 0; i < treeCount; i++) {
			const side = Math.random() > 0.5 ? 1 : -1;
			// 10m to 40m from center
			const x = side * (5 + Math.random() * 30);
			const y = -20 + Math.random() * (mission.distance + 100);
			const scale = 0.8; // Smaller trees: 0.3 - 0.6
			newTrees.push({ x, y, scale });
		}
		// Sort trees by Y (descending) so they render back-to-front
		newTrees.sort((a, b) => b.y - a.y);
		setBgTrees(newTrees);

		// Reset Car States
		playerRef.current = {
			y: 0,
			velocity: 0,
			rpm: 1000,
			gear: 0,
			finished: false,
			finishTime: 0,
		};
		opponentRef.current = {
			y: 0,
			velocity: 0,
			rpm: 1000,
			gear: 0,
			finished: false,
			finishTime: 0,
		};
		inputsRef.current = {
			gas: false,
			shiftUp: false,
			shiftDown: false,
			clutch: false,
			brake: false,
			purge: false,
		};
		lastGearRef.current = 0;
		shiftDebounce.current = false;
	};

	// Level Up Logic
	useEffect(() => {
		const nextLevelThreshold = calculateNextLevelXp(level);
		if (xp >= nextLevelThreshold) {
			setLevel((l) => l + 1);
			const newXp = Math.max(0, xp - nextLevelThreshold);
			setXp(newXp);
			saveGame({ level: level + 1, xp: newXp }); // Immediate Save
			showToast(`LEVEL UP! You are now Level ${level + 1}`, 'SUCCESS');
		}
	}, [xp, level, showToast, saveGame]);

	const startTestTrack = useCallback(() => {
		setPhase('TEST_TRACK');
		setRaceStatus('COUNTDOWN');
		setCountdownNum(3);
		setRaceResult(null);
		setMissedGearAlert(false);

		// Reset Car States
		setUiState({
			player: {
				y: 0,
				velocity: 0,
				rpm: effectiveTuning.idleRPM,
				gear: 0,
				finished: false,
				finishTime: 0,
				tireTemp: 20,
				engineHealth: 100,
			},
			opponent: {
				y: 0,
				velocity: 0,
				rpm: 1000,
				gear: 0,
				finished: false,
				finishTime: 0,
			},
		});

		// Reset Inputs
		inputsRef.current = {
			gas: false,
			shiftUp: false,
			shiftDown: false,
			clutch: false,
			brake: false,
			purge: false,
		};
		lastGearRef.current = 0;
		shiftDebounce.current = false;
		raceStartTimeRef.current = 0; // Will set when countdown ends
		quarterMileTimeRef.current = null;
		mileTimeRef.current = null;

		// Audio
		audioRef.current.startEngine(effectiveTuning);
		// No opponent audio for test track

		// --- Setup Environment (Random Season/Weather) ---
		const seasons: Season[] = ['SPRING', 'SUMMER', 'FALL', 'WINTER'];
		const randomSeason =
			seasons[Math.floor(Math.random() * seasons.length)];
		const isRain = Math.random() < 0.2 && randomSeason !== 'WINTER';
		setWeather({
			type: isRain ? 'RAIN' : 'SUNNY',
			intensity: isRain ? 0.5 + Math.random() * 0.5 : 0,
			season: randomSeason,
		});

		// Initial Trees
		const newTrees = TestTrackUtils.generateInitialTrees();
		setBgTrees(newTrees);
		maxTreeYRef.current = 500;
	}, [effectiveTuning]);

	// Daily Rewards Handler
	const handleClaimDailyReward = useCallback(async () => {
		const { getRewardForDay } = require('../constants/DailyRewards');
		const currentDay = loginStreak.currentStreak;
		const reward = getRewardForDay(currentDay);

		// Apply reward
		switch (reward.type) {
			case 'MONEY':
				// Use secure transaction system for online users
				if (token) {
					try {
						const result = await processMoneyTransaction(
							token,
							'DAILY_REWARD',
							reward.amount || 0,
							{ day: currentDay }
						);
						setMoney(result.newBalance);
						showToast(
							`Claimed $${reward.amount?.toLocaleString()}!`,
							'SUCCESS'
						);
					} catch (e) {
						console.error('Failed to process daily reward:', e);
						showToast('Failed to claim reward', 'ERROR');
						return; // Don't mark as claimed if transaction failed
					}
				} else {
					// Offline users: update locally
					setRawMoney((prev) => prev + (reward.amount || 0));
					notifyMoneyUpdate();
					showToast(
						`Claimed $${reward.amount?.toLocaleString()}!`,
						'SUCCESS'
					);
				}
				break;
			case 'XP':
				setXp((prev) => prev + (reward.amount || 0));
				showToast(`Claimed ${reward.amount} XP!`, 'SUCCESS');
				break;
			case 'ITEM':
				// Generate random item of specified rarity
				const newItem = ItemGenerator.generateItem(
					reward.itemRarity || 'COMMON'
				);
				const newInventory = [...inventory, newItem];
				setInventory(newInventory);
				showToast(`Claimed ${reward.itemRarity} Part!`, 'SUCCESS');
				// Save inventory for online users
				if (token) {
					saveGame({ inventory: newInventory });
				}
				break;
			case 'CRATE':
				// TODO: Implement crate system
				showToast(`Claimed ${reward.crateType} Crate!`, 'SUCCESS');
				break;
		}

		// Update streak
		const updatedStreak = {
			...loginStreak,
			rewardsClaimed: [...loginStreak.rewardsClaimed, currentDay],
		};
		setLoginStreak(updatedStreak);

		// Save game with updated streak
		saveGame({ loginStreak: updatedStreak });
	}, [
		loginStreak,
		notifyMoneyUpdate,
		saveGame,
		showToast,
		token,
		inventory,
		setMoney,
	]);

	// Check Login Streak on Load
	useEffect(() => {
		if (!isGameLoaded) return;

		const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
		const lastLogin = loginStreak.lastLoginDate;

		if (lastLogin === today) {
			// Already logged in today
			return;
		}

		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const yesterdayStr = yesterday.toISOString().split('T')[0];

		let newStreak = 1;
		if (lastLogin === yesterdayStr) {
			// Consecutive day
			newStreak = loginStreak.currentStreak + 1;
		} else if (lastLogin) {
			// Streak broken
			newStreak = 1;
		}

		const newLoginStreak: LoginStreak = {
			currentStreak: newStreak,
			lastLoginDate: today,
			longestStreak: Math.max(loginStreak.longestStreak, newStreak),
			totalLogins: loginStreak.totalLogins + 1,
			rewardsClaimed: loginStreak.rewardsClaimed,
		};

		setLoginStreak(newLoginStreak);
		saveGame({ loginStreak: newLoginStreak });

		// Show rewards modal
		setTimeout(() => {
			setShowDailyRewards(true);
		}, 1000); // Delay to let game load
	}, [isGameLoaded, loginStreak, saveGame]);

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
					if (
						p.y >= raceDistance &&
						phase !== 'TEST_TRACK'
						// raceStartTimeRef.current > 0
						// &&
						// !p.finished
					) {
						console.log('✅ FINISH LINE CROSSED!');
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
							if (raceFinishedProcessingRef.current) return;
							raceFinishedProcessingRef.current = true;

							// --- WEAR LOGIC (0-100 Scale) ---
							const calculatedWear: Record<string, number> = {};
							const wearBase = 0.5; // 0.5% min
							const wearVariance = 1.0; // 1.0% variance
							inventory.forEach((item) => {
								if (item.equipped) {
									const wear =
										wearBase + Math.random() * wearVariance;
									calculatedWear[item.instanceId] = wear;
								}
							});
							setInventory((prev) =>
								prev.map((item) => {
									if (calculatedWear[item.instanceId]) {
										const current =
											item.condition !== undefined
												? item.condition
												: 100;
										return {
											...item,
											condition: Math.max(
												0,
												current -
													calculatedWear[
														item.instanceId
													]
											),
										};
									}
									return item;
								})
							);
							setWearResult(calculatedWear);
							// --------------------------------

							// --- Mastery XP Logic ---
							if (garage[currentCarIndex]) {
								const car = garage[currentCarIndex];
								let mLevel = car.masteryLevel || 0;
								let mXP = car.masteryXP || 0;

								// Dynamic XP Calculation
								let xpGain = 100;
								if (phase === 'ONLINE_RACE') {
									xpGain = 500;
								} else if (missionRef.current) {
									switch (missionRef.current.difficulty) {
										case 'EASY':
											xpGain = 100;
											break;
										case 'MEDIUM':
											xpGain = 150;
											break;
										case 'HARD':
											xpGain = 200;
											break;
										case 'EXTREME':
											xpGain = 300;
											break;
										case 'IMPOSSIBLE':
											xpGain = 400;
											break;
										case 'BOSS':
											xpGain = 500;
											break;
										case 'UNDERGROUND':
											xpGain = 300;
											break;
										default:
											xpGain = 100;
									}
								}

								// Store for animation
								setLastRaceMastery({
									level: mLevel,
									xp: mXP,
									gain: xpGain,
								});

								mXP += xpGain;

								// Level Up Logic
								let nextLevelThreshold = (mLevel + 1) * 1000;
								while (mXP >= nextLevelThreshold) {
									mXP -= nextLevelThreshold;
									mLevel++;
									nextLevelThreshold = (mLevel + 1) * 1000;
									showToast(
										`Car Mastery Level Up! LVL ${mLevel}`,
										'UNLOCK'
									);
									audioRef.current.playUISound('levelup');
								}

								// Update Car
								const updatedCar = {
									...car,
									masteryLevel: mLevel,
									masteryXP: mXP,
								};

								// Update Garage
								setGarage((prev) => {
									const newGarage = [...prev];
									newGarage[currentCarIndex] = updatedCar;
									return newGarage;
								});
							}
							// ------------------------

							setRaceResult('WIN');
							setRaceStatus('FINISHED');

							if (phase === 'ONLINE_RACE') {
								// Online Payout: Pot = 2 * wager using secure API
								// Online Payout: Pot = 2 * wager using secure API
								const onlinePayout =
									currentWagerRef.current * 2;

								if (token) {
									// Use secure transaction API
									processMoneyTransaction(
										token,
										'RACE_WIN',
										onlinePayout,
										{
											raceType: 'ONLINE',
											wager: currentWagerRef.current,
										}
									)
										.then((result) => {
											setMoney(result.newBalance);
										})
										.catch((err) => {
											console.error(
												'Transaction failed:',
												err
											);
											showToast(
												'Failed to process race payout',
												'ERROR'
											);
											setMoney(
												(prev) => prev + onlinePayout
											);
										});
								} else {
									setMoney((prev) => prev + onlinePayout);
								}
								const newXp = xp + 200;
								setXp(newXp);
								saveGame({ xp: newXp }); // Immediate Save
							} else {
								// Calculate Wager Winnings based on difficulty
								const difficultyMultiplier =
									m.difficulty === 'EASY'
										? 0.5
										: m.difficulty === 'MEDIUM'
										? 1.0
										: m.difficulty === 'HARD'
										? 2.0
										: m.difficulty === 'EXTREME'
										? 4.0
										: m.difficulty === 'IMPOSSIBLE'
										? 4.0
										: m.difficulty === 'BOSS'
										? 3.0
										: 1.0;

								const wagerWinnings = Math.floor(
									currentWagerRef.current *
										difficultyMultiplier
								);
								const totalPayout =
									m.payout +
									currentWagerRef.current +
									wagerWinnings;

								// Use API to update money if user is logged in
								if (token) {
									processMoneyTransaction(
										token,
										'RACE_WIN',
										totalPayout,
										{
											raceType: 'MISSION',
											missionId: m.id,
											difficulty: m.difficulty,
											wager: currentWagerRef.current,
										}
									)
										.then((result) => {
											setMoney(result.newBalance);
										})
										.catch((err) => {
											console.error(
												'Transaction failed:',
												err
											);
											showToast(
												'Failed to process race payout',
												'ERROR'
											);
											// Fallback to local update
											setMoney(
												(prev) => prev + totalPayout
											);
										});
								} else {
									// Offline mode: update local state only
									setMoney((prev) => prev + totalPayout);
								}
								const newXp = xp + 50;
								setXp(newXp); // Grant XP for offline race win
								saveGame({ xp: newXp }); // Immediate Save (Money saved by processMoneyTransaction or local update needs separate handling if not using saveGame there, but processMoneyTransaction might not save other stats)

								// Reward Car Logic
								if (m.rewardCar) {
									setGarage((prev) => {
										return [...prev, m.rewardCar!];
									});

									// Check current state for toast (approximation)
									const alreadyOwned = garage.some(
										(c) => c.id === m.rewardCar!.id
									);

									if (!alreadyOwned) {
										showToast(
											`YOU WON A NEW CAR: ${
												m.rewardCar!.name
											}!`,
											'UNLOCK'
										);
									} else {
										showToast(
											`You already own the ${
												m.rewardCar!.name
											}.`,
											'INFO'
										);
									}
								}
							}

							// Underground Progression
							if (m.difficulty === 'UNDERGROUND') {
								setUndergroundLevel((prev) => prev + 1);
								showToast(
									'UNDERGROUND RANK INCREASED!',
									'UNLOCK'
								);
							}

							// Rival Progression
							if (
								typeof m.id === 'string' &&
								m.id.startsWith('rival_')
							) {
								const rivalId = m.id.replace('rival_', '');
								if (!defeatedRivals.includes(rivalId)) {
									setDefeatedRivals((prev) => [
										...prev,
										rivalId,
									]);
									showToast(
										`RIVAL DEFEATED: ${m.opponent.name}`,
										'UNLOCK'
									);
								}
							}

							// Update Best Time
							const currentMissions = [...missions];
							const missionIndex = currentMissions.findIndex(
								(mis) => mis.id === m.id
							);
							if (missionIndex !== -1) {
								const oldBest =
									currentMissions[missionIndex].bestTime;
								if (!oldBest || p.finishTime < oldBest) {
									currentMissions[missionIndex].bestTime =
										p.finishTime;
									// Save Ghost Data
									currentMissions[missionIndex].bestGhost = [
										...currentGhostRecording.current,
									];
									setMissions(currentMissions);
								}
							}

							audioRef.current.stop();
							opponentAudioRef.current.stop();
						} else if (
							o.finished &&
							(!p.finished || o.finishTime < p.finishTime)
						) {
							setRaceResult('LOSS');
							setRaceStatus('FINISHED');

							// Use API to deduct wager if user is logged in
							if (token && currentWagerRef.current > 0) {
								processMoneyTransaction(
									token,
									'RACE_LOSS',
									-currentWagerRef.current, // Negative for loss
									{
										raceType: 'MISSION',
										missionId: m.id,
										wager: currentWagerRef.current,
									}
								)
									.then((result) => {
										setMoney(result.newBalance);
									})
									.catch((err) => {
										console.error(
											'Transaction failed:',
											err
										);
										showToast(
											'Failed to process race loss',
											'ERROR'
										);
										// Fallback to local update
										setMoney((prev) =>
											Math.max(
												0,
												prev - currentWagerRef.current
											)
										);
									});
							} else {
								// Offline mode or no wager
								setMoney((prev) =>
									Math.max(0, prev - currentWagerRef.current)
								);
							}
							audioRef.current.stop();
							opponentAudioRef.current.stop();
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

				// --- DRAWING ---

				const carVisualY = -p.y * PPM;
				const screenOffset = canvas.height * 0.75; // Player sits 75% down the screen

				const camTransY = screenOffset + p.y * PPM;

				ctx.fillStyle = '#1e1e1e';
				ctx.fillRect(0, 0, canvas.width, canvas.height);

				ctx.save();

				ctx.translate(canvas.width / 2, 0);
				ctx.translate(0, camTransY);

				const trackWidth = 300;

				// Draw Track
				const finishVisualY = -raceDistance * PPM;
				const trackStartVisualY = 200 * PPM;
				const trackEndVisualY = finishVisualY - 500 * PPM;

				// Infinite Track Logic for Test Track
				let drawStartY = trackStartVisualY;
				let drawEndY = trackEndVisualY;

				if (phase === 'TEST_TRACK') {
					// Draw from behind camera to well ahead
					// Camera Y is camTransY. World Y is p.y.
					// We want to draw from p.y - 50 to p.y + 1000
					const worldStart = p.y - 50;
					const worldEnd = p.y + 1000;
					drawStartY = -worldStart * PPM;
					drawEndY = -worldEnd * PPM;
				}

				const totalHeight = drawStartY - drawEndY;

				// --- BACKGROUND RENDERING ---
				let groundColor = '#3CB371';
				if (weather.season === 'SPRING') groundColor = '#4ade80'; // Bright Green
				if (weather.season === 'SUMMER') groundColor = '#15803d'; // Deep Green
				if (weather.season === 'FALL') groundColor = '#d97706'; // Orange/Brown
				if (weather.season === 'WINTER') groundColor = '#f3f4f6'; // Snow White

				// Fill Full Background
				ctx.fillStyle = groundColor;
				// Draw a huge rect to cover visible area
				// Since we are translated, we need to cover the viewport relative to camera
				// Viewport top in world space: -camTransY
				// Viewport height: canvas.height
				// Easier: just fill a huge area around the track that is guaranteed to cover screen
				ctx.fillRect(
					-canvas.width * 2,
					drawEndY - 2000,
					canvas.width * 4,
					Math.abs(drawStartY - drawEndY) + 4000
				);

				// Draw Trees (Background Layer)
				if (seasonalTreesImg) {
					// Select source X based on season
					let srcX = 0;
					if (weather.season === 'SUMMER') srcX = 256;
					if (weather.season === 'FALL') srcX = 512;
					if (weather.season === 'WINTER') srcX = 768;

					bgTrees.forEach((tree) => {
						const treeVisualY = -tree.y * PPM;
						// Cull if off screen
						if (
							treeVisualY + camTransY < -500 ||
							treeVisualY + camTransY > canvas.height + 500
						)
							return;

						const w = 256 * tree.scale * 0.5; // Scale down a bit, 256 is huge
						const h = 1024 * tree.scale * 0.5;

						// Shadow
						ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
						ctx.beginPath();
						ctx.ellipse(
							tree.x * PPM, // Center X
							treeVisualY + 10, // Center Y (slightly below anchor)
							w * 0.3, // Radius X
							w * 0.1, // Radius Y (flattened)
							0,
							0,
							Math.PI * 2
						);
						ctx.fill();

						ctx.drawImage(
							seasonalTreesImg,
							srcX,
							0,
							256,
							1024,
							tree.x * PPM - w / 2,
							treeVisualY - h + 20, // Anchor at bottom (approx)
							w,
							h
						);
					});
				}

				// Old Grass Strip (Removed/Replaced by Ground Color)
				// ctx.fillStyle = '#14532d';
				// ctx.fillRect(...);

				// Asphalt
				ctx.fillStyle = '#333';
				ctx.fillRect(
					-trackWidth / 2,
					drawEndY,
					trackWidth,
					totalHeight
				);

				// Start Line (Only if near start)
				if (p.y < 100) {
					const checkSize = 20;
					for (let r = 0; r < 2; r++) {
						for (let c = 0; c < trackWidth / checkSize; c++) {
							ctx.fillStyle = (r + c) % 2 === 0 ? '#fff' : '#000';
							ctx.fillRect(
								-trackWidth / 2 + c * checkSize,
								-r * checkSize,
								checkSize,
								checkSize
							);
						}
					}
				}

				// Finish Line (Only if NOT Test Track)
				if (phase !== 'TEST_TRACK') {
					const checkSize = 20;
					for (let r = 0; r < 3; r++) {
						for (let c = 0; c < trackWidth / checkSize; c++) {
							ctx.fillStyle = (r + c) % 2 === 0 ? '#fff' : '#000';
							ctx.fillRect(
								-trackWidth / 2 + c * checkSize,
								finishVisualY + r * checkSize,
								checkSize,
								checkSize
							);
						}
					}
				}

				// Lane Lines
				ctx.beginPath();
				ctx.strokeStyle = '#555';
				ctx.lineWidth = 4;
				ctx.setLineDash([40, 40]);
				// Fix dash movement by offsetting based on world position
				// We use negative offset because Y increases as we go forward
				ctx.lineDashOffset = -(p.y * PPM) % 80;
				ctx.moveTo(0, drawStartY);
				ctx.lineTo(0, drawEndY);
				ctx.stroke();
				ctx.setLineDash([]);
				ctx.lineDashOffset = 0;

				// Draw Cars
				if ((phase as string) !== 'TEST_TRACK') {
					drawCar(ctx, o, m.opponent.color, -trackWidth / 4);
				}
				const hasSpoiler = ownedMods.some((id) =>
					id.includes('spoiler')
				);
				drawCar(
					ctx,
					p,
					tuningRef.current.color,
					trackWidth / 4,
					hasSpoiler
				);

				// Draw Ghost
				if (activeGhost.current && raceStatus === 'RACING') {
					const raceTime = time - raceStartTimeRef.current;
					// Find frame with closest time
					const ghostFrame = activeGhost.current.find(
						(f) => f.time >= raceTime
					);

					if (ghostFrame) {
						ctx.globalAlpha = 0.3;
						drawCar(
							ctx,
							{
								y: ghostFrame.y,
								velocity: ghostFrame.velocity,
								rpm: ghostFrame.rpm,
								gear: ghostFrame.gear,
								finished: false,
								finishTime: 0,
							},
							'#ffffff', // Ghost color
							trackWidth / 4 // Same lane as player
						);
						ctx.globalAlpha = 1.0;
					}
				}

				// Update and Draw Particles
				particleSystemRef.current.update(dt);
				particleSystemRef.current.draw(ctx, 0); // Camera Y is handled by context transform

				// Emit Particles Logic
				// Tire Smoke (Burnout or Launch)
				// Simple logic: If high RPM and low speed (burnout)
				if (p.rpm > 4000 && p.velocity < 5 && inputsRef.current.gas) {
					// Burnout smoke
					particleSystemRef.current.emit(
						trackWidth / 4 / PPM - 0.5, // Left tire (meters)
						p.y,
						2,
						'SMOKE',
						{
							size: 5,
							life: 1.5,
							speed: 2,
							angle: Math.PI / 2,
							spread: 0.5,
							color: '#eeeeee',
						}
					);
				}

				// Nitrous Purge Visuals
				if (inputsRef.current.purge) {
					// Left and Right Vents
					[-0.3, 0.3].forEach((side) => {
						particleSystemRef.current.emit(
							trackWidth / 4 / PPM + side, // Offset from center
							p.y + 1.2, // Near windshield/cowl
							3,
							'SMOKE',
							{
								size: 4,
								life: 0.4,
								speed: 6,
								angle: side > 0 ? Math.PI * 0.2 : Math.PI * 0.8, // Shoot up and out
								spread: 0.1,
								color: '#ffffff',
							}
						);
					});
				}

				// Engine Smoke (Damage)
				const currentCar = garage[currentCarIndex];
				if (
					currentCar &&
					currentCar.condition !== undefined &&
					currentCar.condition < 0.8
				) {
					// More smoke for worse condition
					const damageSeverity = 0.8 - currentCar.condition; // 0.0 to 0.8
					const smokeChance = damageSeverity * 0.5; // Up to 40% chance per frame

					if (Math.random() < smokeChance) {
						// Randomize X position to simulate smoke coming from different parts of the engine/hood
						const xOffset = (Math.random() - 0.5) * 1.5;

						particleSystemRef.current.emit(
							trackWidth / 4 / PPM + xOffset, // Center of car + random spread
							p.y, // Front of car (user adjusted)
							1,
							'SMOKE',
							{
								size: 5 + damageSeverity * 10, // Bigger smoke
								life: 1.2,
								speed: 1 + p.velocity * 0.1,
								angle: Math.PI * 1.5,
								spread: 1.5, // Much wider spread
								color: '#555555',
							}
						);
					}
				}

				// Exhaust Flames (Shift) - DISABLED
				// if (p.gear > lastGearRef.current && p.rpm > 5000) {
				// 	// Backfire / Flame
				// 	particleSystemRef.current.emit(
				// 		trackWidth / 4 / PPM, // Center of car (approx exhaust location)
				// 		p.y - 1.5, // Behind car (approx)
				// 		10,
				// 		'FLAME',
				// 		{
				// 			size: 8,
				// 			life: 0.5,
				// 			speed: 5,
				// 			angle: Math.PI * 1.5,
				// 			spread: 0.5,
				// 			color: '#ff5500',
				// 		}
				// 	);
				// }

				// Rain Visuals
				if (weather.type === 'RAIN') {
					ctx.save();
					ctx.strokeStyle = 'rgba(170, 190, 255, 0.5)';
					ctx.lineWidth = 1;
					ctx.beginPath();
					const rainCount = 100;
					const timeOffset = time * 1000; // Speed
					for (let i = 0; i < rainCount; i++) {
						// Random positions that loop
						const x =
							(((Math.sin(i) * 10000) % canvas.width) +
								canvas.width) %
							canvas.width;
						const y =
							(((Math.cos(i) * 10000 + timeOffset) %
								canvas.height) +
								canvas.height) %
							canvas.height;
						const len = 10 + (i % 10);

						ctx.moveTo(x, y);
						ctx.lineTo(x - 2, y + len); // Slanted rain
					}
					ctx.stroke();
					ctx.restore();
				}

				// Restore canvas transform
				ctx.restore();

				setUiState({ player: { ...p }, opponent: { ...o } });
			} else {
				// Menu Background renderer
				ctx.fillStyle = '#111';
				ctx.fillRect(0, 0, canvas.width, canvas.height);
				ctx.strokeStyle = '#222';
				ctx.lineWidth = 2;
				const timeOffset = (time / 50) % 50;
				for (let i = 0; i < canvas.height; i += 50) {
					ctx.beginPath();
					ctx.moveTo(0, i + timeOffset);
					ctx.lineTo(canvas.width, i + timeOffset);
					ctx.stroke();
				}
			}

			animId = requestAnimationFrame(render);
		};

		animId = requestAnimationFrame(render);
		return () => cancelAnimationFrame(animId);
	}, [phase, raceStatus, missions, garage]);

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

	return (
		<div className="relative w-full h-full bg-black overflow-hidden font-sans select-none">
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
					/>
					{/* Countdown Overlay */}
					{countdownNum !== '' && (
						<div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
							<div
								className={`font-black italic tracking-tighter ${
									countdownNum === 'GO!'
										? 'text-9xl text-green-500 scale-150'
										: typeof countdownNum === 'string'
										? 'text-4xl text-yellow-400 animate-pulse' // Waiting text
										: 'text-9xl text-white'
								} transition-all duration-300 drop-shadow-2xl`}
							>
								{countdownNum}
							</div>
						</div>
					)}

					{/* Test Track Back Button */}
					{phase === 'TEST_TRACK' && (
						<div className="absolute top-4 left-4 z-50">
							<button
								onClick={() => {
									audioRef.current.stop();
									setRaceResult(null);
									setPhase('GARAGE');
								}}
								className="text-white font-pixel text-xl hover:text-gray-300 flex items-center gap-2"
							>
								<span>&lt;</span> BACK
							</button>
						</div>
					)}
				</>
			)}

			{/* Race Results Overlay */}
			{(phase === 'RACE' ||
				phase === 'ONLINE_RACE' ||
				phase === 'TEST_TRACK') &&
				raceResult && (
					<div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-[100] animate-in fade-in duration-500">
						{/* TopBar for XP/Level Animations (Hide in Test Track) */}
						{phase !== 'TEST_TRACK' && (
							<div className="absolute top-0 left-0 right-0 z-50">
								<TopBar
									level={level}
									xp={xp}
									money={money}
									initialXp={
										raceResult === 'WIN'
											? xp -
											  (missionRef.current?.xpReward ||
													100)
											: xp
									}
									initialMoney={
										raceResult === 'WIN'
											? money -
											  (missionRef.current?.payout ||
													0) -
											  currentWagerRef.current
											: raceResult === 'LOSS'
											? money + currentWagerRef.current
											: money
									}
								/>
							</div>
						)}

						<h1
							className={`text-8xl font-black italic mb-4 ${
								raceResult === 'WIN'
									? 'text-green-500'
									: 'text-white'
							}`}
						>
							{phase === 'TEST_TRACK'
								? 'TEST COMPLETE'
								: raceResult === 'WIN'
								? 'VICTORY'
								: 'DEFEAT'}
						</h1>
						<div className="text-4xl font-mono text-white mb-2">
							TIME: {playerFinishTime.toFixed(3)}s
						</div>

						{/* Online Race Results Tabs */}
						{phase === 'ONLINE_RACE' ? (
							<div className="bg-gray-900/90 border-2 border-gray-700 p-6 rounded-lg mb-8 max-w-2xl w-full">
								{/* Tabs Header */}
								<div className="flex border-b border-gray-700 mb-4">
									<button
										className={`flex-1 py-2 text-center font-pixel text-sm ${
											!showConditionTab
												? 'text-white bg-gray-800 border-b-2 border-cyan-500'
												: 'text-gray-400 hover:text-white'
										}`}
										onClick={() =>
											setShowConditionTab(false)
										}
									>
										SCOREBOARD
									</button>
									<button
										className={`flex-1 py-2 text-center font-pixel text-sm ${
											showConditionTab
												? 'text-white bg-gray-800 border-b-2 border-cyan-500'
												: 'text-gray-400 hover:text-white'
										}`}
										onClick={() =>
											setShowConditionTab(true)
										}
									>
										PART CONDITION
									</button>
								</div>

								{/* Tab Content */}
								{!showConditionTab ? (
									<div className="space-y-2">
										<div className="flex justify-between text-gray-500 text-xs px-2 mb-2">
											<span>RACER</span>
											<span>TIME</span>
										</div>
										{/* Player */}
										<div className="flex justify-between items-center bg-black/40 p-3 border border-gray-700">
											<div className="flex items-center gap-2">
												<span className="text-yellow-400 font-bold">
													1.
												</span>
												<span className="text-white">
													YOU
												</span>
											</div>
											<span className="font-mono text-cyan-400">
												{playerFinishTime.toFixed(3)}s
											</span>
										</div>
										{/* Opponent (Static for now, should be dynamic list) */}
										<div
											className={`flex justify-between items-center p-3 border border-gray-800 ${
												opponentRef.current.finished
													? 'bg-black/40'
													: 'bg-black/20 opacity-50'
											}`}
										>
											<div className="flex items-center gap-2">
												<span className="text-gray-500 font-bold">
													2.
												</span>
												<span className="text-gray-300">
													OPPONENT
												</span>
											</div>
											<span className="font-mono text-gray-400">
												{opponentRef.current.finished
													? `${opponentRef.current.finishTime.toFixed(
															3
													  )}s`
													: '--.--'}
											</span>
										</div>
									</div>
								) : (
									<div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
										{inventory
											.filter(
												(i) =>
													i.equipped &&
													wearResult &&
													wearResult[i.instanceId]
											)
											.map((item) => {
												const damage =
													wearResult![
														item.instanceId
													];
												const current =
													item.condition || 100;
												const old = current + damage;
												const getColor = (
													val: number
												) => {
													if (val > 80)
														return 'text-green-400';
													if (val > 50)
														return 'text-yellow-400';
													return 'text-red-500';
												};
												return (
													<div
														key={item.instanceId}
														className="flex justify-between items-center bg-black/40 p-2 rounded border border-gray-800"
													>
														<div className="text-sm text-gray-300 font-bold truncate w-1/2">
															{item.name}
														</div>
														<div className="flex items-center gap-2 font-mono text-xs">
															<span
																className={getColor(
																	old
																)}
															>
																{Math.round(
																	old
																)}
																%
															</span>
															<span className="text-gray-600">
																➜
															</span>
															<span
																className={`${getColor(
																	current
																)} animate-pulse font-bold`}
															>
																{Math.round(
																	current
																)}
																%
															</span>
															<span className="text-red-500 text-[10px]">
																(-
																{damage.toFixed(
																	1
																)}
																%)
															</span>
														</div>
													</div>
												);
											})}
									</div>
								)}

								{/* Navigation Button */}
								<div className="mt-6 flex justify-end">
									{!showConditionTab ? (
										<button
											onClick={() =>
												setShowConditionTab(true)
											}
											className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 font-pixel text-sm"
										>
											NEXT &gt;
										</button>
									) : (
										<button
											onClick={() =>
												setShowConditionTab(false)
											}
											className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 font-pixel text-sm mr-auto"
										>
											&lt; BACK
										</button>
									)}
								</div>
							</div>
						) : (
							// Standard Single Player Wear Results
							wearResult &&
							inventory.filter(
								(i) => i.equipped && wearResult[i.instanceId]
							).length > 0 && (
								<div className="bg-gray-900/90 border-2 border-gray-700 p-6 rounded-lg mb-8 max-w-2xl w-full">
									<h3 className="text-xl text-gray-400 pixel-text mb-4 text-center border-b border-gray-700 pb-2">
										PART CONDITION
									</h3>
									<div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
										{inventory
											.filter(
												(i) =>
													i.equipped &&
													wearResult[i.instanceId]
											)
											.map((item) => {
												const damage =
													wearResult[item.instanceId]; // e.g. 0.5 (points)
												const current =
													item.condition || 100;
												const old = current + damage;

												// Determine color (using 50/80 scale)
												const getColor = (
													val: number
												) => {
													if (val > 80)
														return 'text-green-400';
													if (val > 50)
														return 'text-yellow-400';
													return 'text-red-500';
												};

												return (
													<div
														key={item.instanceId}
														className="flex justify-between items-center bg-black/40 p-2 rounded border border-gray-800"
													>
														<div className="text-sm text-gray-300 font-bold truncate w-1/2">
															{item.name}
														</div>
														<div className="flex items-center gap-2 font-mono text-xs">
															<span
																className={getColor(
																	old
																)}
															>
																{Math.round(
																	old
																)}
																%
															</span>
															<span className="text-gray-600">
																➜
															</span>
															<span
																className={`${getColor(
																	current
																)} animate-pulse font-bold`}
															>
																{Math.round(
																	current
																)}
																%
															</span>
															<span className="text-red-500 text-[10px]">
																(-
																{damage.toFixed(
																	1
																)}
																%)
															</span>
														</div>
													</div>
												);
											})}
									</div>
								</div>
							)
						)}
						{raceResult === 'WIN' && (
							<div className="text-2xl text-green-400 font-mono mb-8">
								EARNED $
								{phase === 'ONLINE_RACE'
									? currentWagerRef.current * 2
									: missionRef.current?.payout}
							</div>
						)}
						{/* Mastery Animation */}
						{lastRaceMastery && (
							<div className="w-full max-w-lg mb-4">
								<MasteryLevelUp
									initialLevel={lastRaceMastery.level}
									initialXP={lastRaceMastery.xp}
									xpGain={lastRaceMastery.gain}
								/>
							</div>
						)}
						{raceResult === 'LOSS' && (
							<div className="text-2xl text-red-400 font-mono mb-8">
								{playerFinishTime - opponentFinishTime > 0
									? '+'
									: ''}
								{(
									playerFinishTime - opponentFinishTime
								).toFixed(3)}
								s
							</div>
						)}
						<div className="flex gap-4 mt-8">
							{phase === 'TEST_TRACK' ? (
								<>
									<button
										onClick={startTestTrack}
										className="px-8 py-4 bg-green-600 text-white font-bold text-xl hover:bg-green-500 uppercase"
									>
										AGAIN
									</button>
									<button
										onClick={() => {
											audioRef.current.stop();
											setRaceResult(null);
											setPhase('GARAGE');
										}}
										className="px-8 py-4 bg-gray-800 text-white font-bold text-xl hover:bg-gray-700 uppercase"
									>
										Back to Garage
									</button>
								</>
							) : (
								<>
									{phase !== 'ONLINE_RACE' && (
										<button
											onClick={() => {
												if (missionRef.current) {
													startMission(
														missionRef.current
													);
												} else {
													// Fallback
													setPhase('MAP');
												}
											}}
											className="px-8 py-4 bg-green-600 text-white font-bold text-xl hover:bg-green-500 uppercase"
										>
											RACE AGAIN
										</button>
									)}
									<button
										onClick={() => {
											audioRef.current.stop();
											opponentAudioRef.current.stop();
											setRaceResult(null);
											if (phase === 'ONLINE_RACE') {
												// Leave race (and delete if host/last)
												fetch(
													getFullUrl(
														'/api/race',
														`partyId=${party?.id}`
													),
													{
														method: 'DELETE',
														headers: {
															Authorization: `Bearer ${token}`,
														},
													}
												).then(() => {
													setPhase('MAP');
													setRaceStatus('IDLE');
												});
											} else {
												setPhase('MAP');
											}
										}}
										className="px-8 py-4 bg-gray-800 text-white font-bold text-xl hover:bg-gray-700 uppercase"
									>
										BACK TO MENU
									</button>
								</>
							)}
						</div>
					</div>
				)}

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
					<GameProvider
						value={{
							phase,
							setPhase,
							money,
							setMoney,
							playerTuning,
							effectiveTuning,
							setPlayerTuning,
							ownedMods,
							setOwnedMods: (mod) => {
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
							setCurrentCarIndex: setCurrentCarIndex,
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
							// onChallengeRival: handleChallengeRival, // Removed
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
							onManualTuningChange: (tuning) => {
								if (garage[currentCarIndex]) {
									const updatedCar = {
										...garage[currentCarIndex],
										manualTuning: {
											...garage[currentCarIndex]
												.manualTuning,
											...tuning,
										},
									};
									const newGarage = [...garage];
									newGarage[currentCarIndex] = updatedCar;
									setGarage(newGarage);
									// Pending tuning ref update handled by effect
								}
							},
							settings,
							setSettings,
							saveGame,
						}}
					>
						<GameMenu />
					</GameProvider>
				</SoundProvider>
			)}

			{/* Daily Rewards Modal */}
			{showDailyRewards && (
				<DailyRewardsModal
					loginStreak={loginStreak}
					onClaim={handleClaimDailyReward}
					onClose={() => setShowDailyRewards(false)}
				/>
			)}
		</div>
	);
};

export default GameCanvas;
