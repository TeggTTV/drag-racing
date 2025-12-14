import { useEffect, useState, MutableRefObject, useRef } from 'react';
import { getFullUrl } from '../utils/prisma';
import {
	CarState,
	GamePhase,
	InventoryItem,
	Season,
	RaceStatus,
} from '../types';
import { BASE_TUNING } from '../constants';

export const useOnlineRace = (
	phase: GamePhase,
	setPhase: (p: GamePhase) => void,
	party: any,
	token: string | null,
	user: any,
	playerRef: MutableRefObject<CarState>,
	opponentRef: MutableRefObject<CarState>,
	setRaceStatus: (status: RaceStatus) => void,
	setCountdownNum: (num: number | string) => void,
	raceResult: 'WIN' | 'LOSS' | null,
	setRaceResult: (res: 'WIN' | 'LOSS' | null) => void,
	inventory: InventoryItem[],
	setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>,
	missionRef: MutableRefObject<any>,
	setBgTrees: (trees: any[]) => void,
	setWeather: (w: any) => void,
	raceStartTimeRef: MutableRefObject<number>,
	currentWagerRef: MutableRefObject<number>,
	setPlayerFinishTime: (t: number) => void,
	setOpponentFinishTime: (t: number) => void,
	wearResult: Record<string, number> | null,
	setWearResult: (res: Record<string, number> | null) => void
) => {
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
						// console.log('Race Poll:', race.status, race.startTime);

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

	return {
		wearResult,
		setWearResult,
	};
};
