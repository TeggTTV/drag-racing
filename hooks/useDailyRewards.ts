import { useCallback, useEffect } from 'react';
import { LoginStreak, InventoryItem } from '../types';
import { processMoneyTransaction } from '../utils/transactions';
import { ItemGenerator } from '../utils/ItemGenerator';
import { WheelReward } from '../components/menu/SpinWheel';

export const useDailyRewards = (
	isGameLoaded: boolean,
	loginStreak: LoginStreak,
	setLoginStreak: React.Dispatch<React.SetStateAction<LoginStreak>>,
	token: string | null,
	setMoney: (value: React.SetStateAction<number>) => void,
	setRawMoney: React.Dispatch<React.SetStateAction<number>>,
	notifyMoneyUpdate: () => void,
	setXp: React.Dispatch<React.SetStateAction<number>>,
	inventory: InventoryItem[],
	setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>,
	saveGame: (data: any) => void,
	showToast: (msg: string, type: any) => void,
	setShowDailyRewards: React.Dispatch<React.SetStateAction<boolean>>
) => {
	// Daily Rewards Handler
	const handleClaimDailyReward = useCallback(
		async (overrideReward?: WheelReward) => {
			const currentDay = loginStreak.currentStreak;
			let reward: any = {};

			if (overrideReward) {
				reward = {
					type: overrideReward.type,
					amount:
						typeof overrideReward.value === 'number'
							? overrideReward.value
							: 0,
					itemRarity:
						typeof overrideReward.value === 'string' &&
						overrideReward.type === 'ITEM'
							? overrideReward.value
							: undefined,
					crateType:
						typeof overrideReward.value === 'string' &&
						overrideReward.type === 'CRATE'
							? overrideReward.value
							: undefined,
				};
			} else {
				const {
					getRewardForDay,
				} = require('../constants/DailyRewards');
				reward = getRewardForDay(currentDay);
			}

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
								{
									day: currentDay,
									source: overrideReward
										? 'WHEEL'
										: 'SCHEDULE',
								}
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
		},
		[
			loginStreak,
			token,
			setMoney,
			setRawMoney,
			notifyMoneyUpdate,
			setXp,
			inventory,
			setInventory,
			saveGame,
			showToast,
			setLoginStreak,
		]
	);

	// Check Login Streak on Load
	useEffect(() => {
		if (!isGameLoaded) return;

		const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
		const lastLogin = loginStreak.lastLoginDate;

		// 1. Handle Streak Update
		if (lastLogin !== today) {
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);
			const yesterdayStr = yesterday.toISOString().split('T')[0];

			let newStreak = 1;
			let newRewardsClaimed = loginStreak.rewardsClaimed;

			if (lastLogin === yesterdayStr) {
				// Consecutive day
				newStreak = loginStreak.currentStreak + 1;
			} else {
				// Streak broken or first login
				newStreak = 1;
				newRewardsClaimed = []; // Reset claimed rewards on streak break
			}

			const newLoginStreak: LoginStreak = {
				currentStreak: newStreak,
				lastLoginDate: today,
				longestStreak: Math.max(loginStreak.longestStreak, newStreak),
				totalLogins: loginStreak.totalLogins + 1,
				rewardsClaimed: newRewardsClaimed,
			};

			setLoginStreak(newLoginStreak);
			saveGame({ loginStreak: newLoginStreak });
			return; // Allow state to update before checking rewards
		}

		// 2. Show Modal if Reward Not Claimed
		const currentStreakDay = loginStreak.currentStreak;
		const hasClaimedToday =
			loginStreak.rewardsClaimed.includes(currentStreakDay);

		if (!hasClaimedToday) {
			// const timer = setTimeout(() => {
			// 	setShowDailyRewards(true);
			// }, 1000);
			// return () => clearTimeout(timer);
			// Disabled for now as per user request (Visuals pending update)
		}
	}, [
		isGameLoaded,
		loginStreak,
		saveGame,
		setLoginStreak,
		setShowDailyRewards,
	]);

	return { handleClaimDailyReward };
};
