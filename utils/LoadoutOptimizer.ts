import { InventoryItem, ItemRarity } from '@/types';

// Rarity weights for scoring
const RARITY_WEIGHTS: Record<ItemRarity, number> = {
	COMMON: 1,
	UNCOMMON: 2,
	RARE: 3,
	EPIC: 4,
	LEGENDARY: 5,
	EXOTIC: 6,
};

/**
 * Calculate a score for an item based on its stats, rarity, and condition
 */
export function calculateItemScore(item: InventoryItem): number {
	let score = 0;

	// Base score from rarity
	score += RARITY_WEIGHTS[item.rarity] * 1000;

	// Condition multiplier (100% condition = 1.0x, 50% = 0.5x)
	const conditionMultiplier = item.condition / 100;

	// Add scores from stats (weighted by their impact on performance)
	const statWeights: Record<string, number> = {
		maxTorque: 5,
		tireGrip: 4,
		turboIntensity: 3,
		mass: -2, // Negative because lower is better
		dragCoefficient: -3, // Negative because lower is better
		redlineRPM: 2,
		finalDriveRatio: 1,
		brakingForce: 2,
		flywheelMass: -1, // Negative because lower is better
	};

	for (const [key, value] of Object.entries(item.stats)) {
		const weight = statWeights[key] || 1;
		const statValue = Number(value) || 0;
		score += statValue * weight * 10;
	}

	// Apply condition multiplier
	score *= conditionMultiplier;

	// Bonus for special items
	if (item.isSpecial) {
		score *= 1.2;
	}

	return score;
}

/**
 * Find the best loadout from available items
 * Returns one best item per type/category
 */
export function findBestLoadout(items: InventoryItem[]): InventoryItem[] {
	// Group items by type
	const itemsByType = new Map<string, InventoryItem[]>();

	for (const item of items) {
		const key = item.category || item.type;
		if (!itemsByType.has(key)) {
			itemsByType.set(key, []);
		}
		itemsByType.get(key)!.push(item);
	}

	// Select the best item from each group
	const bestItems: InventoryItem[] = [];

	for (const [type, typeItems] of itemsByType.entries()) {
		// Sort by score (highest first)
		const sorted = typeItems.sort((a, b) => {
			return calculateItemScore(b) - calculateItemScore(a);
		});

		// Take the best one
		if (sorted.length > 0) {
			bestItems.push(sorted[0]);
		}
	}

	return bestItems;
}
