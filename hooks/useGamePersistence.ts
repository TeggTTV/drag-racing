import React, { useState, useEffect } from 'react';
import {
	Mission,
	TuningState,
	SavedTune,
	DailyChallenge,
	LoginStreak,
	UserSeasonProgress,
} from '../types';
import { MISSIONS, BASE_TUNING } from '../constants';
import { generateDailyChallenges } from '../utils/dailyChallengeUtils';
import { useAuth } from '../contexts/AuthContext';
import { getFullUrl } from '../lib/api-config';
import { CURRENT_SEASON_ID } from '../constants/SeasonData';

export const useGamePersistence = (
	money: number,
	setMoney: (m: number) => void,
	ownedMods: string[],
	setOwnedMods: (mods: string[]) => void,
	disabledMods: string[],
	setDisabledMods: (mods: string[]) => void,
	modSettings: Record<string, Record<string, number>>,
	setModSettings: (settings: Record<string, Record<string, number>>) => void,
	missions: Mission[],
	setMissions: (missions: Mission[]) => void,
	dailyChallenges: DailyChallenge[],
	setDailyChallenges: (challenges: DailyChallenge[]) => void,
	playerTuning: TuningState,
	setPlayerTuning: React.Dispatch<React.SetStateAction<TuningState>>,
	dynoHistory: { rpm: number; torque: number; hp: number }[],
	setDynoHistory: (
		history: { rpm: number; torque: number; hp: number }[]
	) => void,
	previousDynoHistory: { rpm: number; torque: number; hp: number }[],
	setPreviousDynoHistory: (
		history: { rpm: number; torque: number; hp: number }[]
	) => void,
	garage: SavedTune[],
	setGarage: (garage: SavedTune[]) => void,
	currentCarIndex: number,
	setCurrentCarIndex: (index: number) => void,
	undergroundLevel: number,
	setUndergroundLevel: (level: number) => void,
	xp: number,
	setXp: (xp: number) => void,
	level: number,
	setLevel: (level: number) => void,
	inventory: any[], // using any[] to avoid circular dependency if InventoryItem is not exported from types
	setInventory: (items: any[]) => void,
	phase: string, // Add phase to control sync behavior
	settings: any, // GameSettings
	setSettings: (s: any) => void,
	loginStreak: LoginStreak,
	setLoginStreak: (streak: LoginStreak) => void,
	seasonProgress: UserSeasonProgress,
	setSeasonProgress: (progress: UserSeasonProgress) => void
) => {
	const [loaded, setLoaded] = useState(false);
	const [isSyncing, setIsSyncing] = useState(false);
	const { token, user } = useAuth();
	const lastMoneyUpdateRef = React.useRef(0);

	const notifyMoneyUpdate = React.useCallback(() => {
		lastMoneyUpdateRef.current = Date.now();
	}, []);

	// Load on mount
	// Load on mount or auth change
	useEffect(() => {
		const loadFromLocalStorage = () => {
			try {
				const savedMoney = localStorage.getItem('shift_drift_money');
				if (savedMoney && savedMoney !== 'undefined')
					setMoney(parseInt(savedMoney));

				const savedMissions = localStorage.getItem(
					'shift_drift_missions'
				);
				if (savedMissions && savedMissions !== 'undefined') {
					const parsedSavedMissions: Mission[] =
						JSON.parse(savedMissions);
					// Merge saved progress with current mission definitions
					const mergedMissions = MISSIONS.map((m) => {
						const saved = parsedSavedMissions.find(
							(sm) => sm.id === m.id
						);
						if (saved) {
							return {
								...m,
								bestTime: saved.bestTime,
								bestGhost: saved.bestGhost,
							};
						}
						return m;
					});
					setMissions(mergedMissions);
				}

				const savedDynoHistory = localStorage.getItem(
					'shift_drift_dynoHistory'
				);
				if (savedDynoHistory && savedDynoHistory !== 'undefined')
					setDynoHistory(JSON.parse(savedDynoHistory));

				const savedPreviousDynoHistory = localStorage.getItem(
					'shift_drift_previousDynoHistory'
				);
				if (
					savedPreviousDynoHistory &&
					savedPreviousDynoHistory !== 'undefined'
				)
					setPreviousDynoHistory(
						JSON.parse(savedPreviousDynoHistory)
					);

				// Underground Level
				const savedUndergroundLevel = localStorage.getItem(
					'shift_drift_undergroundLevel'
				);
				if (
					savedUndergroundLevel &&
					savedUndergroundLevel !== 'undefined'
				) {
					setUndergroundLevel(parseInt(savedUndergroundLevel));
				}

				// XP & Level
				const savedXp = localStorage.getItem('shift_drift_xp');
				if (savedXp && savedXp !== 'undefined') {
					const parsed = parseInt(savedXp);
					if (!isNaN(parsed)) setXp(parsed);
				}

				const savedLevel = localStorage.getItem('shift_drift_level');
				if (savedLevel && savedLevel !== 'undefined') {
					const parsed = parseInt(savedLevel);
					if (!isNaN(parsed)) setLevel(parsed);
				}

				// Inventory
				const savedInventory = localStorage.getItem(
					'shift_drift_inventory'
				);
				if (savedInventory && savedInventory !== 'undefined') {
					setInventory(JSON.parse(savedInventory));
				}

				// Daily Challenges
				const savedDaily = localStorage.getItem(
					'shift_drift_dailyChallenges'
				);
				if (savedDaily && savedDaily !== 'undefined') {
					const parsedDaily: DailyChallenge[] =
						JSON.parse(savedDaily);
					// Check if expired (all expire at same time)
					if (
						parsedDaily.length > 0 &&
						parsedDaily[0].expiresAt > Date.now()
					) {
						setDailyChallenges(parsedDaily);
					} else {
						const newChallenges = generateDailyChallenges();
						setDailyChallenges(newChallenges);
					}
				} else {
					const newChallenges = generateDailyChallenges();
					setDailyChallenges(newChallenges);
				}

				// Settings
				const savedSettings = localStorage.getItem(
					'shift_drift_settings'
				);
				if (savedSettings && savedSettings !== 'undefined') {
					setSettings(JSON.parse(savedSettings));
				}

				// Login Streak
				const savedLoginStreak = localStorage.getItem(
					'shift_drift_loginStreak'
				);
				if (savedLoginStreak && savedLoginStreak !== 'undefined') {
					setLoginStreak(JSON.parse(savedLoginStreak));
				}

				// Season Progress
				const savedSeason = localStorage.getItem(
					'shift_drift_seasonProgress'
				);
				if (savedSeason && savedSeason !== 'undefined') {
					setSeasonProgress(JSON.parse(savedSeason));
				} else {
					setSeasonProgress({
						seasonId: CURRENT_SEASON_ID,
						xp: 0,
						claimedFreeTiers: [],
						claimedPremiumTiers: [],
						isPremium: false,
					});
				}

				// Garage & Current Car Logic
				const savedGarage = localStorage.getItem('shift_drift_garage');
				const savedCarIndex = localStorage.getItem(
					'shift_drift_currentCarIndex'
				);

				// Legacy variables
				const savedOwnedMods = localStorage.getItem(
					'shift_drift_ownedMods'
				);
				const savedDisabledMods = localStorage.getItem(
					'shift_drift_disabledMods'
				);
				const savedModSettings = localStorage.getItem(
					'shift_drift_modSettings'
				);
				const savedManualTuning = localStorage.getItem(
					'shift_drift_manual_tuning'
				);

				if (savedGarage && savedGarage !== 'undefined') {
					// Load Garage
					const parsedGarage = JSON.parse(savedGarage);

					if (parsedGarage.length === 0) {
						// Empty Garage -> Create Starter
						const starterCar: SavedTune = {
							id: 'starter_car',
							name: 'Civic 99 (Starter)',
							date: Date.now(),
							ownedMods: [],
							disabledMods: [],
							modSettings: {},
							manualTuning: BASE_TUNING,
							condition: 100,
							installedItems: [],
							originalPrice: 5000,
							rarity: 'COMMON',
						};
						setGarage([starterCar]);
						setCurrentCarIndex(0);
						// Reset active state
						setOwnedMods([]);
						setDisabledMods([]);
						setModSettings({});
						setPlayerTuning(BASE_TUNING);
					} else {
						setGarage(parsedGarage);

						let activeIndex = 0;
						if (savedCarIndex && savedCarIndex !== 'undefined') {
							activeIndex = parseInt(savedCarIndex);
						}

						// Safety Check: Ensure index is valid
						if (
							activeIndex < 0 ||
							activeIndex >= parsedGarage.length
						) {
							console.warn(
								'Invalid car index loaded, defaulting to 0'
							);
							activeIndex = 0;
						}
						setCurrentCarIndex(activeIndex);

						// Load active car state immediately
						const activeCar =
							parsedGarage[activeIndex] || parsedGarage[0];
						if (activeCar) {
							setOwnedMods(activeCar.ownedMods);
							setDisabledMods(activeCar.disabledMods);
							setModSettings(activeCar.modSettings);
							setPlayerTuning((prev) => ({
								...prev,
								...activeCar.manualTuning,
							}));
						}
					}
				} else {
					// Migration: Check for legacy single-car save
					if (savedOwnedMods && savedOwnedMods !== 'undefined') {
						// Create initial car from legacy data
						const initialCar: SavedTune = {
							id: 'starter_car',
							name: 'My First Ride',
							date: Date.now(),
							ownedMods: JSON.parse(savedOwnedMods),
							disabledMods: savedDisabledMods
								? JSON.parse(savedDisabledMods)
								: [],
							modSettings: savedModSettings
								? JSON.parse(savedModSettings)
								: {},
							manualTuning: savedManualTuning
								? JSON.parse(savedManualTuning)
								: {},
							condition: 100,
							installedItems: [],
							originalPrice: 5000,
							rarity: 'COMMON',
						};

						setGarage([initialCar]);
						setCurrentCarIndex(0);

						// Also set the active state immediately for seamless transition
						setOwnedMods(initialCar.ownedMods);
						setDisabledMods(initialCar.disabledMods);
						setModSettings(initialCar.modSettings);
					} else {
						// New Game
						setGarage([]);
						setCurrentCarIndex(0);
					}
				}

				setLoaded(true);
			} catch (e) {
				console.error('Failed to load game state', e);
			}
		};

		const loadFromServer = async () => {
			if (!user || !token) return;

			// prevent overwriting optimistic updates if we just saved
			if (Date.now() - lastSyncRef.current < 5000) {
				// console.log('Skipping server load due to recent save');
				return;
			}

			try {
				const res = await fetch(
					getFullUrl('/api/users/:id').replace(':id', user.id) +
						`?t=${Date.now()}`,
					{
						headers: {
							Authorization: `Bearer ${token}`,
							'Cache-Control':
								'no-cache, no-store, must-revalidate',
							Pragma: 'no-cache',
							Expires: '0',
						},
					}
				);
				if (res.ok) {
					const data = await res.json();

					// Set Money
					if (data.money !== undefined) setMoney(data.money);

					// Set XP & Level
					if (data.xp !== undefined) setXp(data.xp);
					if (data.level !== undefined) setLevel(data.level);

					// Set Inventory
					if (data.inventory) setInventory(data.inventory);

					// Set Garage
					if (data.garage) {
						setGarage(data.garage);
						// Default to first car if garage exists
						if (data.garage.length > 0) {
							setCurrentCarIndex(0);
							const activeCar = data.garage[0];
							setOwnedMods(activeCar.ownedMods || []);
							setDisabledMods(activeCar.disabledMods || []);
							setModSettings(activeCar.modSettings || {});
							setPlayerTuning((prev) => ({
								...prev,
								...(activeCar.manualTuning || {}),
							}));
						} else {
							// Handle empty garage on server (shouldn't happen for established players but possible for new ones)
							setGarage([]);
							setCurrentCarIndex(0);
						}
					}

					// Set Settings
					if (data.settings) setSettings(data.settings);

					// Set Login Streak
					if (data.loginStreak) setLoginStreak(data.loginStreak);

					// Set Season Progress
					if (data.seasonProgress)
						setSeasonProgress(data.seasonProgress);

					// Initialize Daily Challenges (Client-side generation for now, could be server-side later)
					const newChallenges = generateDailyChallenges();
					setDailyChallenges(newChallenges);

					setLoaded(true);
				}
			} catch (e) {
				console.error('Failed to load from server', e);
				// Fallback? Or just stay in loading state?
			}
		};

		if (user) {
			loadFromServer();
		} else {
			loadFromLocalStorage();
		}
	}, [user?.id, token]);

	// Auto-save effects
	useEffect(() => {
		if (!loaded || user) return;
		localStorage.setItem('shift_drift_money', money.toString());
	}, [money, loaded]);

	useEffect(() => {
		if (!loaded || user) return;
		localStorage.setItem('shift_drift_missions', JSON.stringify(missions));
	}, [missions, loaded]);

	useEffect(() => {
		if (!loaded || user) return;
		localStorage.setItem(
			'shift_drift_dynoHistory',
			JSON.stringify(dynoHistory)
		);
	}, [dynoHistory, loaded]);

	useEffect(() => {
		if (!loaded || user) return;
		localStorage.setItem(
			'shift_drift_previousDynoHistory',
			JSON.stringify(previousDynoHistory)
		);
	}, [previousDynoHistory, loaded]);

	// Save Garage & Current Index
	useEffect(() => {
		if (!loaded || user) return;
		localStorage.setItem('shift_drift_garage', JSON.stringify(garage));
	}, [garage, loaded]);

	useEffect(() => {
		if (!loaded || user) return;
		localStorage.setItem(
			'shift_drift_currentCarIndex',
			currentCarIndex.toString()
		);
	}, [currentCarIndex, loaded]);

	useEffect(() => {
		if (!loaded || user) return;
		localStorage.setItem(
			'shift_drift_undergroundLevel',
			undergroundLevel.toString()
		);
	}, [undergroundLevel, loaded]);

	useEffect(() => {
		if (!loaded || user) return;
		localStorage.setItem(
			'shift_drift_dailyChallenges',
			JSON.stringify(dailyChallenges)
		);
	}, [dailyChallenges, loaded]);

	useEffect(() => {
		if (!loaded || user) return;
		localStorage.setItem('shift_drift_xp', xp.toString());
	}, [xp, loaded]);

	useEffect(() => {
		if (!loaded || user) return;
		localStorage.setItem('shift_drift_level', level.toString());
	}, [level, loaded]);

	useEffect(() => {
		if (!loaded || user) return;
		localStorage.setItem(
			'shift_drift_inventory',
			JSON.stringify(inventory)
		);
	}, [inventory, loaded]);

	useEffect(() => {
		if (!loaded || user) return;
		localStorage.setItem('shift_drift_settings', JSON.stringify(settings));
	}, [settings, loaded]);

	useEffect(() => {
		if (!loaded || user) return;
		localStorage.setItem(
			'shift_drift_loginStreak',
			JSON.stringify(loginStreak)
		);
	}, [loginStreak, loaded]);

	useEffect(() => {
		if (!loaded || user) return;
		localStorage.setItem(
			'shift_drift_seasonProgress',
			JSON.stringify(seasonProgress)
		);
	}, [seasonProgress, loaded]);

	// --- Server Sync Logic ---
	// SECURITY NOTE: Money is NOT synced automatically from localStorage to prevent manipulation
	// Money updates should only happen via secure API endpoints when earned through legitimate gameplay
	const lastSyncRef = React.useRef<number>(0);
	const syncTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

	// Fetch money from server for online users (server is source of truth)
	useEffect(() => {
		if (!loaded || !token || !user) return;

		// Don't fetch during active gameplay
		if (phase === 'RACE' || phase === 'ONLINE_RACE') return;

		const fetchServerMoney = async () => {
			try {
				const res = await fetch(
					getFullUrl('/api/users/:id').replace(':id', user.id) +
						`?t=${Date.now()}`,
					{
						headers: {
							Authorization: `Bearer ${token}`,
							'Cache-Control':
								'no-cache, no-store, must-revalidate',
							Pragma: 'no-cache',
							Expires: '0',
						},
					}
				);
				if (res.ok) {
					const data = await res.json();
					if (data.money !== undefined) {
						// Server money is the source of truth for online users
						// BUT: If we just updated money locally (e.g. bought something), ignore stale server data
						// Increased window to 5s to be safe against latency/caching
						const timeDiff =
							Date.now() - lastMoneyUpdateRef.current;

						if (timeDiff > 5000) {
							setMoney(data.money);
						}
					}
				}
			} catch (e) {
				console.error('Failed to fetch money from server', e);
			}
		};

		// Only fetch money when entering specific menu phases where balance matters
		// or when returning to the map.
		// We do NOT fetch periodically to avoid overwriting local optimistic updates.
		if (
			phase === 'MAP' ||
			phase === 'GARAGE' ||
			phase === 'AUCTION' ||
			phase === 'SHOP'
		) {
			fetchServerMoney();
		}
	}, [loaded, token, user, setMoney, phase]);

	// Consolidated state object for sync comparison (EXCLUDING money for security)
	const currentState = React.useMemo(
		() => ({
			garage,
			inventory,
			level,
			xp,
			settings,
			loginStreak,
			seasonProgress,
		}),
		[garage, inventory, level, xp, settings, loginStreak, seasonProgress]
	);

	// Immediate Save Function
	const saveGame = React.useCallback(
		async (
			overrides?: Partial<{
				garage: SavedTune[];
				inventory: any[];
				level: number;
				xp: number;
				money: number;
				settings: any;
				loginStreak: LoginStreak;
			}>
		) => {
			if (!token || !user) return;

			const body = {
				garage,
				// inventory, // DO NOT include inventory by default. It overwrites server state with potentially stale local state.
				level,
				xp,
				settings,
				loginStreak,
				seasonProgress,
				// money, // DO NOT include money by default. It overwrites server state with potentially stale local state.
				...overrides,
			};

			try {
				setIsSyncing(true);
				lastSyncRef.current = Date.now();
				await fetch(
					getFullUrl('/api/users/:id').replace(':id', user.id),
					{
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${token}`,
						},
						body: JSON.stringify(body),
					}
				);
				// console.log('Game saved immediately');
			} catch (e) {
				console.error('Failed to save game', e);
			} finally {
				setIsSyncing(false);
			}
		},
		[
			garage,
			inventory,
			level,
			xp,
			money,
			token,
			user,
			settings,
			loginStreak,
			seasonProgress,
		]
	);

	// Periodic Sync (Debounced) - Only when NOT racing
	useEffect(() => {
		if (!loaded || !token || !user) return;

		// Don't sync during active gameplay to prevent stutter or conflicts
		// Don't sync during active gameplay to prevent stutter or conflicts
		if (phase === 'RACE' || phase === 'ONLINE_RACE') return;

		// Debounce sync
		if (syncTimeoutRef.current) {
			clearTimeout(syncTimeoutRef.current);
		}

		syncTimeoutRef.current = setTimeout(async () => {
			try {
				setIsSyncing(true);
				// Sync only statistical/progress data (NOT money)
				await fetch(
					getFullUrl('/api/users/:id').replace(':id', user.id),
					{
						method: 'PUT',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${token}`,
						},
						body: JSON.stringify({
							garage,
							inventory,
							level,
							xp,
							settings,
							loginStreak,
							seasonProgress,
						}),
					}
				);
				lastSyncRef.current = Date.now();
			} catch (e) {
				console.error('Failed to sync to server', e);
			} finally {
				setIsSyncing(false);
			}
		}, 2000); // 2 second debounce

		return () => {
			if (syncTimeoutRef.current) {
				clearTimeout(syncTimeoutRef.current);
			}
		};
	}, [currentState, loaded, token, user, phase]);

	return { loaded, notifyMoneyUpdate, saveGame, isSyncing };
};
