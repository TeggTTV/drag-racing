import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';
import { getUserIdFromRequest } from '../../../lib/auth';
import { ItemMerge } from '../../../utils/ItemMerge';
import { InventoryItem, SavedTune } from '../../../types';
import type { ApiResponse } from '../../../types/api';

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse<ApiResponse>
) {
	if (req.method !== 'POST') {
		res.setHeader('Allow', ['POST']);
		return res.status(405).json({ message: 'Method not allowed' });
	}

	const userId = getUserIdFromRequest(req);
	if (!userId) {
		return res.status(401).json({ message: 'Unauthorized' });
	}

	const { action, item1Id, item2Id, itemId } = req.body;

	if (!action) {
		return res.status(400).json({ message: 'Missing action' });
	}

	try {
		// Fetch current user inventory
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { inventory: true, garage: true },
		});

		if (!user) {
			return res.status(404).json({ message: 'User not found' });
		}

		let inventory = (user.inventory as unknown as InventoryItem[]) || [];

		if (action === 'MERGE') {
			if (!item1Id || !item2Id) {
				return res.status(400).json({ message: 'Missing item IDs' });
			}

			const item1 = inventory.find((i) => i.instanceId === item1Id);
			const item2 = inventory.find((i) => i.instanceId === item2Id);

			if (!item1 || !item2) {
				return res.status(404).json({ message: 'Items not found' });
			}

			const newItem = ItemMerge.mergeItems(item1, item2);

			if (!newItem) {
				return res.status(400).json({ message: 'Merge failed' });
			}

			// Remove old items, add new item
			inventory = inventory.filter(
				(i) => i.instanceId !== item1Id && i.instanceId !== item2Id
			);
			inventory.push(newItem);

			// Update DB
			await prisma.user.update({
				where: { id: userId },
				data: { inventory: inventory as any },
			});

			return res.status(200).json({ inventory, newItem });
		}

		if (action === 'EQUIP') {
			if (!itemId) {
				return res.status(400).json({ message: 'Missing item ID' });
			}

			const { currentCarIndex } = req.body;

			const item = inventory.find((i) => i.instanceId === itemId);
			if (!item) {
				return res.status(404).json({ message: 'Item not found' });
			}

			// Conflict logic (simplified from client)
			const isConflict = (
				existing: InventoryItem,
				newOne: InventoryItem
			) => {
				if (newOne.category && existing.category) {
					return newOne.category === existing.category;
				}
				if (newOne.category) {
					return newOne.category === existing.category;
				}
				return newOne.type === existing.type;
			};

			// Mastery XP Logic
			let xpGained = 0;
			if (!item.masteryGiven) {
				const baseXP = 50;
				const rarityMult: Record<string, number> = {
					COMMON: 1,
					UNCOMMON: 1.5,
					RARE: 2,
					EPIC: 3,
					LEGENDARY: 5,
					EXOTIC: 10,
				};
				const mult = rarityMult[item.rarity] || 1;
				const conditionFactor = (item.condition || 100) / 100;
				xpGained = Math.floor(baseXP * mult * conditionFactor);
			}

			inventory = inventory.map((i) => {
				if (i.instanceId === itemId) {
					return { ...i, equipped: true, masteryGiven: true };
				}
				if (i.equipped && isConflict(i, item)) {
					return { ...i, equipped: false };
				}
				return i;
			});

			// Update Garage if XP gained
			let garage = (user.garage as unknown as SavedTune[]) || [];
			if (
				xpGained > 0 &&
				typeof currentCarIndex === 'number' &&
				garage[currentCarIndex]
			) {
				const updatedCar = { ...garage[currentCarIndex] };
				let currentXP = (updatedCar.masteryXP || 0) + xpGained;
				let currentLevel = updatedCar.masteryLevel || 0;

				let threshold = (currentLevel || 1) * 1000;
				while (currentXP >= threshold) {
					currentXP -= threshold;
					currentLevel++;
					threshold = (currentLevel || 1) * 1000;
				}

				updatedCar.masteryXP = currentXP;
				updatedCar.masteryLevel = currentLevel;
				garage[currentCarIndex] = updatedCar;
			}

			// Update DB
			await prisma.user.update({
				where: { id: userId },
				data: {
					inventory: inventory as any,
					garage: garage as any,
				},
			});

			return res.status(200).json({ inventory, xpGained, garage });
		}

		return res.status(400).json({ message: 'Invalid action' });
	} catch (e) {
		console.error('Inventory action error:', e);
		return res.status(500).json({ message: 'Internal server error' });
	}
}
