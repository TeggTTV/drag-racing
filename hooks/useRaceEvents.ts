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
import { SKILL_TREE } from '../constants';

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
	currentGhostRecording: React.MutableRefObject<any[]>,
	settings: any, // GameSettings
	setSettings: React.Dispatch<React.SetStateAction<any>>
) => {
	// Helper to calculate active bonuses
	// Helper to calculate active bonuses
	const getSkillBonus = useCallback(
		(stat: string) => {
			if (
				!settings ||
				!settings.skills ||
				!Array.isArray(settings.skills.unlocked)
			) {
				return 1;
			}
			let multiplier = 1;
			try {
				settings.skills.unlocked.forEach((id: string) => {
					const node = SKILL_TREE.find((n) => n.id === id);
					if (node && node.stats) {
						// @ts-ignore
						const val = node.stats[stat];
						if (typeof val === 'number' && !isNaN(val)) {
							multiplier *= val;
						}
					}
				});
			} catch (e) {
				console.error('Error calculating skill bonus:', e);
				return 1;
			}
			return isNaN(multiplier) ? 1 : multiplier;
		},
		[settings]
	);

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
				raceFinishedProcessingRef.current = true;
				try {
					setRaceResult('WIN');
					setRaceStatus('FINISHED');
					// --- WEAR LOGIC (0-100 Scale) ---
					const calculatedWear: Record<string, number> = {};
					const wearBase = 0.5; // 0.5% min
					const wearVariance = 1.0; // 1.0% variance
					// Safety check for inventory
					(inventory || []).forEach((item) => {
						if (item && item.equipped) {
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
											calculatedWear[item.instanceId]
									),
								};
							}
							return item;
						})
					);
					setWearResult(calculatedWear);
					// --------------------------------

					// --- Mastery XP Logic ---
					if (garage && garage[currentCarIndex]) {
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

						// Apply Driver Skills
						const xpMult = getSkillBonus('xpGainMultiplier');
						if (xpMult > 1) {
							xpGain = Math.floor(xpGain * xpMult);
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
							// showToast(
							// 	`Car Mastery Level Up! LVL ${mLevel}`,
							// 	'UNLOCK'
							// );

							// Award Skill Point
							setSettings((prev: any) => ({
								...prev,
								skills: {
									...prev.skills,
									points: (prev.skills?.points || 0) + 1,
									unlocked: prev.skills?.unlocked || [],
								},
							}));
							// showToast('Earned 1 Skill Point!', 'w');
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

					// Use the same xpGain calculated above for Player XP if available, else default
					// If garage[currentCarIndex] was null, xpGain needs to be defined
					let playerXpGain = 50;

					// Recalculate if we didn't enter the Mastery block (rare) or want to ensure scope
					let baseXp = 100;
					// console.log('phase', phase); // Debug check
					if (phase === 'ONLINE_RACE') {
						baseXp = 500;
					} else if (missionRef.current) {
						switch (missionRef.current.difficulty) {
							case 'EASY':
								baseXp = 100;
								break;
							case 'MEDIUM':
								baseXp = 150;
								break;
							case 'HARD':
								baseXp = 200;
								break;
							case 'EXTREME':
								baseXp = 300;
								break;
							case 'IMPOSSIBLE':
								baseXp = 400;
								break;
							case 'BOSS':
								baseXp = 500;
								break;
							case 'UNDERGROUND':
								baseXp = 300;
								break;
							default:
								baseXp = 100;
						}
					}

					const xpMult = getSkillBonus('xpGainMultiplier');
					playerXpGain = Math.floor(
						baseXp * (xpMult > 0 ? xpMult : 1)
					);

					if (isNaN(playerXpGain)) playerXpGain = 50;

					// Store final gain to be used by UI (Hack: piggyback on lastRaceMastery or add new state?
					// lastRaceMastery.gain holds this val if mastery updated)
					if (!garage[currentCarIndex]) {
						setLastRaceMastery({
							level: 0,
							xp: 0,
							gain: playerXpGain,
						});
					}

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
									setMoney((prev) => prev + onlinePayout);
								});
						} else {
							setMoney((prev) => prev + onlinePayout);
						}

						const finalXp = (xp || 0) + playerXpGain;
						setXp(finalXp);
						saveGame({ xp: finalXp }); // Note: closure 'xp' might be stale in immediate save if rapid updates, but usually fine here
					} else {
						const m = missionRef.current;
						// Calculate Wager Winnings based on difficulty
						if (m) {
							// ... Money Logic ...
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
							let totalPayout =
								m.payout + currentWager + wagerWinnings;

							// Apply Tycoon Skills
							const moneyMult = getSkillBonus(
								'racePayoutMultiplier'
							);
							if (moneyMult > 1) {
								totalPayout = Math.floor(
									totalPayout * moneyMult
								);
							}

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
										setMoney((prev) => prev + totalPayout);
									});
							} else {
								// Offline mode: update local state only
								setMoney((prev) => prev + totalPayout);
							}

							// Use the unified playerXpGain
							const finalXp = (xp || 0) + playerXpGain;
							setXp(finalXp);
							saveGame({ xp: finalXp });

							// Reward Car Logic
							if (m.rewardCar) {
								setGarage((prev) => {
									return [...prev, m.rewardCar!];
								});
							}

							// Underground Progression
							if (m.difficulty === 'UNDERGROUND') {
								setUndergroundLevel((prev) => prev + 1);
								// showToast(
								// 	'UNDERGROUND RANK INCREASED!',
								// 	'UNLOCK'
								// );
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
									// showToast(
									// 	`RIVAL DEFEATED: ${m.opponent.name}`,
									// 	'UNLOCK'
									// );
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

					// Audio Cleanup
					try {
						if (
							audioRef.current &&
							typeof audioRef.current.stop === 'function'
						) {
							audioRef.current.stop();
						}
						if (
							opponentAudioRef.current &&
							typeof opponentAudioRef.current.stop === 'function'
						) {
							opponentAudioRef.current.stop();
						}
					} catch (audioErr) {
						console.warn('Audio stop error:', audioErr);
					}
				} catch (error) {
					console.error(
						'CRITICAL ERROR IN PROCESS RACE FINISH:',
						error
					);
					// showToast('Race Finish Error - check console', 'ERROR');
					// Force finish to stop loop
					setRaceResult('WIN');
					setRaceStatus('FINISHED');
				}
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
			currentGhostRecording,
			getSkillBonus,
			setSettings,
		]
	);

	return { processRaceFinish };
};
