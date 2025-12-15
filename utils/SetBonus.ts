import { ITEM_SETS } from '../constants';
import { InventoryItem, ItemSet } from '../types';

/**
 * Set bonus utilities
 */
export class SetBonus {
	/**
	 * Get all sets an item belongs to based on its baseId
	 */
	static getSetsForItem(baseId: string): ItemSet[] {
		return ITEM_SETS.filter((set) => set.requiredItemIds.includes(baseId));
	}

	/**
	 * Get active (complete) sets from installed items
	 */
	static getActiveSets(installedItems: InventoryItem[]): ItemSet[] {
		const installedBaseIds = installedItems.map((item) => item.baseId);

		return ITEM_SETS.filter((set) => {
			// Check if all required items are installed
			return set.requiredItemIds.every((requiredId) =>
				installedBaseIds.includes(requiredId)
			);
		});
	}

	/**
	 * Check if an item is part of an active set
	 */
	static isItemInActiveSet(
		item: InventoryItem,
		installedItems: InventoryItem[]
	): boolean {
		const activeSets = this.getActiveSets(installedItems);
		return activeSets.some((set) =>
			set.requiredItemIds.includes(item.baseId)
		);
	}

	/**
	 * Get XP multiplier from active sets
	 */
	static getXPMultiplier(installedItems: InventoryItem[]): number {
		const activeSets = this.getActiveSets(installedItems);
		let totalMultiplier = 1.0;

		activeSets.forEach((set) => {
			if (set.bonusMultipliers?.xpGain) {
				totalMultiplier *= set.bonusMultipliers.xpGain;
			}
		});

		return totalMultiplier;
	}
}
