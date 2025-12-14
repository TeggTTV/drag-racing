import {
	Crate,
	InventoryItem,
	ItemRarity,
	ModType,
	TuningState,
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import { MOD_TREE } from '../constants'; // Access to MOD_TREE definitions for base stats

// Rarity Multipliers (for value and potential stat variance)
const RARITY_MULTIPLIERS: Record<ItemRarity, number> = {
	COMMON: 1.0,
	UNCOMMON: 1.2,
	RARE: 1.5,
	EPIC: 2.0,
	LEGENDARY: 3.0,
	EXOTIC: 5.0,
};

const RARITY_COLORS: Record<ItemRarity, string> = {
	COMMON: '#9ca3af', // Gray
	UNCOMMON: '#22c55e', // Green
	RARE: '#3b82f6', // Blue
	EPIC: '#a855f7', // Purple
	LEGENDARY: '#fbbf24', // Gold
	EXOTIC: '#ec4899', // Pink
};

export const CRATES: Crate[] = [
	{
		id: 'crate_basic',
		name: 'Junkyard Crate',
		description: 'Old parts, mostly rust.',
		price: 500,
		dropRates: {
			COMMON: 0.7,
			UNCOMMON: 0.25,
			RARE: 0.05,
			EPIC: 0.0,
			LEGENDARY: 0.0,
		},
	},
	{
		id: 'crate_standard',
		name: 'Standard Crate',
		description: 'Decent parts for street builds.',
		price: 2000,
		dropRates: {
			COMMON: 0.4,
			UNCOMMON: 0.4,
			RARE: 0.15,
			EPIC: 0.05,
			LEGENDARY: 0.0,
		},
	},
	{
		id: 'crate_premium',
		name: 'Premium Crate',
		description: 'High performance parts guaranteed.',
		price: 5000,
		dropRates: {
			COMMON: 0.1,
			UNCOMMON: 0.3,
			RARE: 0.4,
			EPIC: 0.15,
			LEGENDARY: 0.05,
		},
	},
	{
		id: 'crate_legendary',
		name: 'Black Market Crate',
		description: 'Illegal goods. High risk, high reward.',
		price: 20000,
		dropRates: {
			COMMON: 0.0,
			UNCOMMON: 0.1,
			RARE: 0.3,
			EPIC: 0.4,
			LEGENDARY: 0.2,
		},
	},
];

import { GAME_ITEMS, ItemDefinition } from '../data/GameItems'; // Import the new DB

export class ItemGenerator {
	static generateItem(input: ItemRarity | ItemDefinition): InventoryItem {
		let baseItem: ItemDefinition;
		let rarity: ItemRarity;

		if (typeof input === 'string') {
			rarity = input;
			// 1. Filter GAME_ITEMS by the requested rarity
			let candidates = GAME_ITEMS.filter(
				(item) => item.rarity === rarity
			);

			// Fallback: If no items of this rarity exist, try to find *any* item
			if (candidates.length === 0) {
				candidates = GAME_ITEMS;
				if (candidates.length === 0) {
					throw new Error('Game Items Database is empty!');
				}
			}

			// 2. Pick a random item from candidates
			baseItem =
				candidates[Math.floor(Math.random() * candidates.length)];
		} else {
			// Direct definition passed
			baseItem = input;
			rarity = baseItem.rarity;
		}

		// 3. Generate Condition
		// Higher rarity -> likely better condition?
		// Or keep it random. Let's say better crates (which drop better rarity) imply better condition.
		let minCond = 50;
		if (rarity === 'COMMON') minCond = 20;
		if (rarity === 'LEGENDARY') minCond = 90;
		const condition = Math.floor(minCond + Math.random() * (100 - minCond));

		// 4. Stats Variance
		// We use the base stats from the definition.
		// We can apply condition scaling: poor condition = reduced effectiveness?
		// Or just small random variance.
		// Let's apply a small "Quality" variance regardless of condition,
		// and maybe condition affects value/reliability later.
		const variance = 0.9 + Math.random() * 0.2; // +/- 10%

		const finalStats: Partial<TuningState> = {};
		for (const key in baseItem.stats) {
			const k = key as keyof TuningState;
			const val = baseItem.stats[k];
			if (typeof val === 'number') {
				// Round to 1 decimal
				(finalStats as any)[k] = Math.round(val * variance * 10) / 10;
			} else {
				// Copy non-numeric exactly
				(finalStats as any)[k] = val;
			}
		}

		// 5. Calculate Resale Value
		// Base value * condition factor * variance
		const value = Math.floor(baseItem.value * (condition / 100) * variance);

		return {
			instanceId: uuidv4(),
			baseId: baseItem.id,
			name: baseItem.name,
			description: baseItem.description,
			type: baseItem.type,
			rarity: baseItem.rarity, // Keep the item's intrinsic rarity
			condition,
			stats: finalStats,
			value,
			icon: (baseItem as any).icon, // Pass icon if exists
			parentCategory: baseItem.parentCategory,
			category: baseItem.category,
			spriteIndex: (baseItem as any).spriteIndex,
		};
	}

	static openCrate(crate: Crate): InventoryItem {
		const rand = Math.random();
		let cumulative = 0;
		let selectedRarity: ItemRarity = 'COMMON';

		const rates = crate.dropRates;
		// Determine target rarity based on crate probabilities
		if (rand < (cumulative += rates.COMMON)) selectedRarity = 'COMMON';
		else if (rand < (cumulative += rates.UNCOMMON))
			selectedRarity = 'UNCOMMON';
		else if (rand < (cumulative += rates.RARE)) selectedRarity = 'RARE';
		else if (rand < (cumulative += rates.EPIC)) selectedRarity = 'EPIC';
		else selectedRarity = 'LEGENDARY';

		// Now find items that MATCH this rarity.
		// Note: IF the crate says "Legendary" but we have no Legendary items, generateItem logic will fallback.
		// However, standard design is that the crate roll determines the tier, then we pick from that tier.
		return this.generateItem(selectedRarity);
	}

	static getRarityColor(rarity: ItemRarity): string {
		return RARITY_COLORS[rarity];
	}

	static generateDailySpecial(): InventoryItem {
		// 1. Pick a random base item, preferring higher tiers (Uncommon+)
		const highTierItems = GAME_ITEMS.filter((i) => i.rarity !== 'COMMON');
		const baseItem =
			highTierItems[Math.floor(Math.random() * highTierItems.length)];

		// 2. Generate standard item
		const item = this.generateItem(baseItem);

		// 3. Make it SPECIAL
		item.isSpecial = true;
		item.condition = 100; // Daily specials are always pristine
		item.rarity = 'LEGENDARY'; // Force display as Legendary (or keep base and add glowing border?) -> Let's bump rarity

		// Boost stats slightly for "Special" status
		for (const key in item.stats) {
			const k = key as keyof TuningState;
			if (typeof item.stats[k] === 'number') {
				(item.stats as any)[k] = (item.stats as any)[k] * 1.15; // 15% boost
				(item.stats as any)[k] =
					Math.round((item.stats as any)[k] * 10) / 10;
			}
		}

		// 4. Give it a cool name
		const prefixes = [
			'Midnight',
			'Ghost',
			'Viper',
			'Storm',
			'Rocket',
			'Apex',
			'Drift',
			'Outlaw',
			'Neon',
			'Cyber',
		];
		const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
		item.specialName = `${prefix} ${item.name}`;
		item.name = item.specialName; // Override name for easier display

		// 5. Increase Value
		item.value = Math.floor(item.value * 2.5);

		return item;
	}

	static generateJunkyardItem(): InventoryItem {
		// Weighted rarity for junkyard (Mostly trash)
		const rand = Math.random();
		let rarity: ItemRarity = 'COMMON';
		if (rand > 0.98) rarity = 'LEGENDARY';
		else if (rand > 0.9) rarity = 'EPIC';
		else if (rand > 0.75) rarity = 'RARE';
		else if (rand > 0.5) rarity = 'UNCOMMON';

		const item = this.generateItem(rarity);

		// Junkyard items have typically lower condition
		// But occasionally you find a gem (high condition)
		if (Math.random() > 0.9) {
			// Hidden Gem!
			item.condition = Math.floor(80 + Math.random() * 20);
		} else {
			// Standard Junk
			item.condition = Math.floor(10 + Math.random() * 50); // 10% - 60%
		}

		// Recalculate value based on poor condition
		// Base generateItem already factors in condition somewhat, but let's be explicit for Junkyard pricing
		// Actually, generateItem sets value based on condition.
		// But we want Junkyard PRICE to be cheap.
		// We will handle price setting in the GameCanvas logic where we wrap it in JunkyardItem.

		return item;
	}
}
