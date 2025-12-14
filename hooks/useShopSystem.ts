import { useState, useCallback, useEffect } from 'react';
import { JunkyardCar, JunkyardItem, InventoryItem, SavedTune } from '../types';
import { CarGenerator } from '../utils/CarGenerator';
import { ItemGenerator } from '../utils/ItemGenerator';
import { processMoneyTransaction } from '../utils/transactions';
import { getFullUrl } from '../utils/prisma';

export const useShopSystem = (
	money: number,
	setMoney: React.Dispatch<React.SetStateAction<number>>,
	inventory: InventoryItem[],
	setInventory: React.Dispatch<React.SetStateAction<InventoryItem[]>>,
	garage: SavedTune[],
	setGarage: React.Dispatch<React.SetStateAction<SavedTune[]>>,
	saveGame: (data: any) => void,
	showToast: (msg: string, type: any) => void,
	token: string | null
) => {
	const [junkyardCars, setJunkyardCars] = useState<JunkyardCar[]>([]);
	const [junkyardParts, setJunkyardParts] = useState<JunkyardItem[]>([]);
	const [dealershipCars, setDealershipCars] = useState<JunkyardCar[]>([]);
	const [refreshCount, setRefreshCount] = useState(0);

	// Daily Shop State
	const [dailyShopItems, setDailyShopItems] = useState<InventoryItem[]>([]);
	const [lastDailyRefresh, setLastDailyRefresh] = useState<number>(0);

	const generateJunkyardCars = useCallback(() => {
		const cars: JunkyardCar[] = [];
		// Generate more cars since it's the only source now
		for (let i = 0; i < 6; i++) {
			cars.push(
				CarGenerator.generateJunkyardCar(`junk_${Date.now()}_${i}`)
			);
		}
		setJunkyardCars(cars);

		// Generate Parts
		const parts: JunkyardItem[] = [];
		for (let i = 0; i < 12; i++) {
			const item = ItemGenerator.generateJunkyardItem();
			// Price is based on value but heavily discounted due to junkyard status
			const price = Math.max(50, Math.floor(item.value * 0.8));
			parts.push({ ...item, price });
		}
		setJunkyardParts(parts);
	}, []);

	// Dealership Logic
	const generateDealershipCars = useCallback(() => {
		const cars: JunkyardCar[] = [];
		for (let i = 0; i < 6; i++) {
			cars.push(
				CarGenerator.generateDealershipCar(`dealer_${Date.now()}_${i}`)
			);
		}
		setDealershipCars(cars);
	}, []);

	useEffect(() => {
		if (junkyardCars.length === 0) {
			generateJunkyardCars();
		}
		if (dealershipCars.length === 0) {
			generateDealershipCars();
		}
	}, []);

	const buyJunkyardPart = useCallback(
		(part: JunkyardItem) => {
			if (money >= part.price) {
				if (token) {
					processMoneyTransaction(
						token,
						'SHOP_PURCHASE',
						-part.price,
						{ itemId: part.instanceId }
					)
						.then((res) => setMoney(res.newBalance))
						.catch((e) => {
							console.error(e);
							setMoney((m) => m - part.price); // Fallback
						});
				} else {
					setMoney((m) => m - part.price);
				}

				const newInventory = [...inventory, part];
				setInventory(newInventory);
				setJunkyardParts((prev) =>
					prev.filter((p) => p.instanceId !== part.instanceId)
				);
				showToast(`Bought ${part.name}`, 'SUCCESS');

				// Persist inventory change
				saveGame({ inventory: newInventory });
			} else {
				showToast('Not enough money!', 'ERROR');
			}
		},
		[money, showToast, token, saveGame, inventory, setMoney, setInventory]
	);

	const buyJunkyardCar = useCallback(
		(car: JunkyardCar) => {
			if (money >= car.price) {
				setMoney((m) => m - car.price);
				const newGarage = [
					...garage,
					{
						id: car.id,
						name: car.name,
						date: Date.now(),
						ownedMods: car.ownedMods,
						disabledMods: [],
						modSettings: {},
						manualTuning: car.manualTuning || {},
						condition: car.condition,
						originalPrice: car.originalPrice,
						rarity: car.rarity,
						rarityMultiplier: car.rarityMultiplier,
						installedItems: car.installedItems || [],
					},
				];
				setGarage(newGarage);
				saveGame({ money: money - car.price, garage: newGarage }); // Immediate Save
				setJunkyardCars((prev) => prev.filter((c) => c.id !== car.id));
				showToast(`Bought ${car.name} for $${car.price}`, 'SUCCESS');
			} else {
				showToast('Not enough money!', 'ERROR');
			}
		},
		[money, showToast, garage, setMoney, setGarage, saveGame]
	);

	const refreshJunkyard = useCallback(() => {
		const cost = 100 + refreshCount * 50;
		if (money >= cost) {
			setMoney((m) => m - cost);
			setRefreshCount((c) => c + 1);
			generateJunkyardCars();
		}
	}, [money, refreshCount, generateJunkyardCars, setMoney]);

	const buyDealershipCar = useCallback(
		(car: JunkyardCar) => {
			if (money >= car.price) {
				setMoney((m) => m - car.price);
				const newGarage = [
					...garage,
					{
						...car, // Already formatted by generator
						date: Date.now(),
					},
				];
				setGarage(newGarage);
				saveGame({ money: money - car.price, garage: newGarage }); // Immediate Save
				// Remove bought car from stock
				setDealershipCars((prev) =>
					prev.filter((c) => c.id !== car.id)
				);
				showToast(
					`Bought ${car.name} for $${car.price.toLocaleString()}`,
					'SUCCESS'
				);
			} else {
				showToast('Not enough money!', 'ERROR');
			}
		},
		[money, showToast, garage, setMoney, setGarage, saveGame]
	);

	const refreshDealership = useCallback(() => {
		generateDealershipCars();
		showToast('Dealership Inventory Refreshed', 'INFO');
	}, [generateDealershipCars, showToast]);

	const buyShopItem = useCallback(
		(item: InventoryItem) => {
			const price = item.value; // Shop price = estimated value
			if (money >= price) {
				setMoney((m) => m - price);
				const newInventory = [...inventory, item];
				setInventory(newInventory);
				setDailyShopItems((prev) =>
					prev.filter((i) => i.instanceId !== item.instanceId)
				);
				saveGame({ money: money - price, inventory: newInventory }); // Immediate Save
				showToast(`Bought ${item.name}!`, 'SUCCESS');
			} else {
				showToast('Not enough money!', 'ERROR');
			}
		},
		[money, showToast, inventory, setMoney, setInventory, saveGame]
	);

	// Daily Shop Logic
	const refreshDailyShop = useCallback(() => {
		const items: InventoryItem[] = [];
		// Generate 3 special daily items
		for (let i = 0; i < 3; i++) {
			items.push(ItemGenerator.generateDailySpecial());
		}
		setDailyShopItems(items);
		setLastDailyRefresh(Date.now());
	}, []);

	useEffect(() => {
		// Check for daily refresh
		const ONE_DAY = 24 * 60 * 60 * 1000;
		if (
			Date.now() > lastDailyRefresh + ONE_DAY ||
			dailyShopItems.length === 0
		) {
			refreshDailyShop();
		}
	}, [lastDailyRefresh, dailyShopItems.length, refreshDailyShop]);

	return {
		junkyardCars,
		junkyardParts,
		dealershipCars,
		dailyShopItems,
		buyJunkyardCar,
		buyJunkyardPart,
		refreshJunkyard,
		buyDealershipCar,
		refreshDealership,
		buyShopItem,
		refreshDailyShop,
	};
};
