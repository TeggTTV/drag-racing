import { DailyReward } from '../types';

export const DAILY_REWARDS: DailyReward[] = [
	// Day 1
	{ day: 1, type: 'MONEY', amount: 500 },
	// Day 2
	{ day: 2, type: 'XP', amount: 100 },
	// Day 3
	{ day: 3, type: 'MONEY', amount: 1000 },
	// Day 4
	{ day: 4, type: 'ITEM', itemRarity: 'UNCOMMON' },
	// Day 5
	{ day: 5, type: 'MONEY', amount: 2000 },
	// Day 6
	{ day: 6, type: 'XP', amount: 250 },
	// Day 7 - Weekly Bonus
	{ day: 7, type: 'CRATE', crateType: 'PREMIUM' },
	// Day 8
	{ day: 8, type: 'MONEY', amount: 1500 },
	// Day 9
	{ day: 9, type: 'XP', amount: 150 },
	// Day 10
	{ day: 10, type: 'MONEY', amount: 2500 },
	// Day 11
	{ day: 11, type: 'ITEM', itemRarity: 'RARE' },
	// Day 12
	{ day: 12, type: 'MONEY', amount: 3000 },
	// Day 13
	{ day: 13, type: 'XP', amount: 300 },
	// Day 14 - Bi-Weekly Bonus
	{ day: 14, type: 'CRATE', crateType: 'ELITE' },
	// Day 15
	{ day: 15, type: 'MONEY', amount: 4000 },
	// Day 16
	{ day: 16, type: 'XP', amount: 200 },
	// Day 17
	{ day: 17, type: 'MONEY', amount: 3500 },
	// Day 18
	{ day: 18, type: 'ITEM', itemRarity: 'EPIC' },
	// Day 19
	{ day: 19, type: 'MONEY', amount: 4500 },
	// Day 20
	{ day: 20, type: 'XP', amount: 400 },
	// Day 21 - Three Week Bonus
	{ day: 21, type: 'CRATE', crateType: 'ELITE' },
	// Day 22
	{ day: 22, type: 'MONEY', amount: 5000 },
	// Day 23
	{ day: 23, type: 'XP', amount: 300 },
	// Day 24
	{ day: 24, type: 'MONEY', amount: 5500 },
	// Day 25
	{ day: 25, type: 'ITEM', itemRarity: 'EPIC' },
	// Day 26
	{ day: 26, type: 'MONEY', amount: 6000 },
	// Day 27
	{ day: 27, type: 'XP', amount: 500 },
	// Day 28 - Four Week Bonus
	{ day: 28, type: 'CRATE', crateType: 'ELITE' },
	// Day 29
	{ day: 29, type: 'MONEY', amount: 7000 },
	// Day 30 - Monthly Mega Bonus
	{ day: 30, type: 'ITEM', itemRarity: 'LEGENDARY' },
];

export function getRewardForDay(day: number): DailyReward {
	// Cycle through rewards if beyond day 30
	const cycleDay = ((day - 1) % 30) + 1;
	return DAILY_REWARDS.find((r) => r.day === cycleDay) || DAILY_REWARDS[0];
}
