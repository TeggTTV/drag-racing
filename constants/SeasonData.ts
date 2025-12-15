import { SeasonPassReward } from '../types';

export const CURRENT_SEASON_ID = 'season_1_street_kings';

export const SEASON_REWARDS: SeasonPassReward[] = [
	// Tier 1
	{
		tier: 1,
		requiredXP: 0,
		freeReward: { day: 0, type: 'MONEY', amount: 1000 },
		premiumReward: {
			day: 0,
			type: 'ITEM',
			itemId: 'ecu1',
			itemRarity: 'RARE',
		}, // Sport ECU
	},
	// Tier 2
	{
		tier: 2,
		requiredXP: 500,
		freeReward: { day: 0, type: 'XP', amount: 200 },
		premiumReward: { day: 0, type: 'MONEY', amount: 5000 },
	},
	// Tier 3
	{
		tier: 3,
		requiredXP: 1500,
		freeReward: {
			day: 0,
			type: 'ITEM',
			itemId: 'tires1',
			itemRarity: 'UNCOMMON',
		}, // Sport Tires
		premiumReward: { day: 0, type: 'CRATE', crateType: 'PREMIUM' },
	},
	// Tier 4
	{
		tier: 4,
		requiredXP: 3000,
		freeReward: { day: 0, type: 'MONEY', amount: 2500 },
		premiumReward: { day: 0, type: 'XP', amount: 1000 },
	},
	// Tier 5
	{
		tier: 5,
		requiredXP: 5000,
		freeReward: { day: 0, type: 'CRATE', crateType: 'BASIC' },
		premiumReward: {
			day: 0,
			type: 'ITEM',
			itemId: 'spoiler',
			itemRarity: 'EPIC',
		}, // Rear Spoiler
	},
	// Tier 6
	{
		tier: 6,
		requiredXP: 7500,
		freeReward: { day: 0, type: 'XP', amount: 500 },
		premiumReward: { day: 0, type: 'MONEY', amount: 10000 },
	},
	// Tier 7
	{
		tier: 7,
		requiredXP: 10500,
		freeReward: { day: 0, type: 'MONEY', amount: 5000 },
		premiumReward: { day: 0, type: 'CRATE', crateType: 'ELITE' }, // Fixed typo in previous step logic if ELITE doesn't exist? CrateShop has Logic for names but types in types.ts are BASIC | PREMIUM | ELITE. ItemGenerator has CRATES array. crate_legendary is Black Market. Let's use 'ELITE' to map to Premium or Legendary? DailyReward type allows ELITE.
	},
	// Tier 8
	{
		tier: 8,
		requiredXP: 14000,
		freeReward: {
			day: 0,
			type: 'ITEM',
			itemId: 'nitrous_50',
			itemRarity: 'RARE',
		}, // 50 shot
		premiumReward: {
			day: 0,
			type: 'ITEM',
			itemId: 'turbo_kit',
			itemRarity: 'LEGENDARY',
		}, // Turbo Kit
	},
	// Tier 9
	{
		tier: 9,
		requiredXP: 18000,
		freeReward: { day: 0, type: 'XP', amount: 1000 },
		premiumReward: { day: 0, type: 'MONEY', amount: 25000 },
	},
	// Tier 10 (Max for now)
	{
		tier: 10,
		requiredXP: 22500,
		freeReward: { day: 0, type: 'CRATE', crateType: 'PREMIUM' },
		premiumReward: {
			day: 0,
			type: 'ITEM',
			itemId: 'drag_slicks',
			itemRarity: 'EXOTIC',
		}, // Full Drag Slicks
	},
];

export const MAX_SEASON_XP =
	SEASON_REWARDS[SEASON_REWARDS.length - 1].requiredXP;
