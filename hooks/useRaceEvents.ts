import { useCallback } from 'react';
import {
	CarState,
	InventoryItem,
	Mission,
	SavedTune,
	GamePhase,
} from '../types';
import { processMoneyTransaction } from '../utils/transactions';
import { calculateNextLevelXp } from '../utils/progression';

export const useRaceEvents = (
	inventory: InventoryItem[],
	setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>,
	setWearResult: React.Dispatch<
		React.SetStateAction<Record<string, number> | null>
	>,
	garage: SavedTune[],
	setGarage: React.Dispatch<React.SetStateAction<SavedTune[]>>,
	currentCarIndex: number,
	missionRef: React.MutableRefObject<Mission | null>,
	setLastRaceMastery: React.Dispatch<React.SetStateAction<any>>,
	setRaceResult: React.Dispatch<React.SetStateAction<'WIN' | 'LOSS' | null>>,
	setRaceStatus: React.Dispatch<React.SetStateAction<any>>,
	token: string | null,
	setMoney: React.Dispatch<React.SetStateAction<number>>,
	xp: number,
	setXp: React.Dispatch<React.SetStateAction<number>>,
	saveGame: (data: any) => void,
	showToast: (msg: string, type: any) => void,
	setUndergroundLevel: React.Dispatch<React.SetStateAction<number>>,
	defeatedRivals: string[],
	setDefeatedRivals: React.Dispatch<React.SetStateAction<string[]>>,
	missions: Mission[],
	setMissions: React.Dispatch<React.SetStateAction<Mission[]>>,
	audioRef: React.MutableRefObject<any>,
	opponentAudioRef: React.MutableRefObject<any>,
	raceFinishedProcessingRef: React.MutableRefObject<boolean>,
	currentGhostRecording: React.MutableRefObject<any[]>
) => {
	const processRaceFinish = useCallback(
		(
			p: CarState,
			o: CarState,
			phase: GamePhase,
			currentWager: number,
			playerFinishTime: number,
			opponentFinishTime: number
		) => {
			if (
				p.finished &&
				(!o.finished || playerFinishTime < opponentFinishTime)
			) {
				if (raceFinishedProcessingRef.current) return;
				raceFinishedProcessingRef.current = true;

				// --- WEAR LOGIC (0-100 Scale) ---
				const calculatedWear: Record<string, number> = {};
				const wearBase = 0.5; // 0.5% min
				const wearVariance = 1.0; // 1.0% variance
				inventory.forEach((item) => {
					if (item.equipped) {
						const wear = wearBase + Math.random() * wearVariance;
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
									current - calculatedWear[item.instanceId]
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
						// audioRef.current.playUISound('levelup');
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
					const onlinePayout = currentWager * 2;

					if (token) {
						// Use secure transaction API
						processMoneyTransaction(
							token,
							'RACE_WIN',
							onlinePayout,
							{
								raceType: 'ONLINE',
								wager: currentWager,
							}
						)
							.then((result) => {
								setMoney(result.newBalance);
							})
							.catch((err) => {
								console.error('Transaction failed:', err);
								showToast(
									'Failed to process race payout',
									'ERROR'
								);
								setMoney((prev) => prev + onlinePayout);
							});
					} else {
						setMoney((prev) => prev + onlinePayout);
					}
					const newXp = xp + 200;
					setXp(newXp);
					saveGame({ xp: newXp }); // Immediate Save
				} else {
					const m = missionRef.current;
					// Calculate Wager Winnings based on difficulty
					if (m) {
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
							currentWager * difficultyMultiplier
						);
						const totalPayout =
							m.payout + currentWager + wagerWinnings;

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
									wager: currentWager,
								}
							)
								.then((result) => {
									setMoney(result.newBalance);
								})
								.catch((err) => {
									console.error('Transaction failed:', err);
									showToast(
										'Failed to process race payout',
										'ERROR'
									);
									// Fallback to local update
									setMoney((prev) => prev + totalPayout);
								});
						} else {
							// Offline mode: update local state only
							setMoney((prev) => prev + totalPayout);
						}
						const newXp = xp + 50;
						setXp(newXp); // Grant XP for offline race win
						saveGame({ xp: newXp });

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
									`YOU WON A NEW CAR: ${m.rewardCar!.name}!`,
									'UNLOCK'
								);
							} else {
								showToast(
									`You already own the ${m.rewardCar!.name}.`,
									'INFO'
								);
							}
						}

						// Underground Progression
						if (m.difficulty === 'UNDERGROUND') {
							setUndergroundLevel((prev) => prev + 1);
							showToast('UNDERGROUND RANK INCREASED!', 'UNLOCK');
						}

						// Rival Progression
						if (
							typeof m.id === 'string' &&
							m.id.startsWith('rival_')
						) {
							const rivalId = m.id.replace('rival_', '');
							if (!defeatedRivals.includes(rivalId)) {
								setDefeatedRivals((prev) => [...prev, rivalId]);
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
							if (!oldBest || playerFinishTime < oldBest) {
								currentMissions[missionIndex].bestTime =
									playerFinishTime;
								// Save Ghost Data
								currentMissions[missionIndex].bestGhost = [
									...currentGhostRecording.current,
								];
								setMissions(currentMissions);
							}
						}
					}
				}

				audioRef.current.stop();
				opponentAudioRef.current.stop();
			} else if (
				o.finished &&
				(!p.finished || opponentFinishTime < playerFinishTime)
			) {
				setRaceResult('LOSS');
				setRaceStatus('FINISHED');

				// Use API to deduct wager if user is logged in
				if (token && currentWager > 0) {
					const m = missionRef.current;
					processMoneyTransaction(
						token,
						'RACE_LOSS',
						-currentWager, // Negative for loss
						{
							raceType: 'MISSION',
							missionId: m?.id,
							wager: currentWager,
						}
					)
						.then((result) => {
							setMoney(result.newBalance);
						})
						.catch((err) => {
							console.error('Transaction failed:', err);
							showToast('Failed to process race loss', 'ERROR');
							// Fallback to local update
							setMoney((prev) =>
								Math.max(0, prev - currentWager)
							);
						});
				} else {
					// Offline mode or no wager
					setMoney((prev) => Math.max(0, prev - currentWager));
				}
				audioRef.current.stop();
				opponentAudioRef.current.stop();
			}
		},
		[
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
		]
	);

	return { processRaceFinish };
};
