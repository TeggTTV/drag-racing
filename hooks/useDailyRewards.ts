import { useCallback, useEffect } from 'react';
import { LoginStreak, InventoryItem } from '../types';
import { processMoneyTransaction } from '../utils/transactions';
import { ItemGenerator } from '../utils/ItemGenerator';

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
	}, [
		isGameLoaded,
		loginStreak,
		saveGame,
		setLoginStreak,
		setShowDailyRewards,
	]);

	return { handleClaimDailyReward };
};
