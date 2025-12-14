import { useCallback } from 'react';
import { SavedTune, InventoryItem } from '../types';

export const useGarageManager = (
	garage: SavedTune[],
	setGarage: React.Dispatch<React.SetStateAction<SavedTune[]>>,
	money: number,
	setMoney: React.Dispatch<React.SetStateAction<number>>,
	currentCarIndex: number,
	setCurrentCarIndex: React.Dispatch<React.SetStateAction<number>>,
	saveGame: (data: any) => void,
	showToast: (msg: string, type: any) => void,
	previousCarIndexRef: React.MutableRefObject<number>
) => {
	const restoreCar = useCallback(
		(carIndex: number) => {
			const car = garage[carIndex];
			if (!car) return;

			const currentCondition = car.condition || 100;
			if (currentCondition >= 100) {
				showToast('Car is already in perfect condition!', 'INFO');
				return;
			}

			const missing = 100 - currentCondition;
			// Cost is proportional to the car's original value
			// Default value fallback: $10,000
			const baseValue = car.originalPrice || 10000;

			// Restoration Cost Formula:
			// Full restore costs ~50% of the car's value
			const cost = Math.floor((missing / 100) * baseValue * 0.5);

			if (money >= cost) {
				setMoney((m) => m - cost);
				const newGarage = [...garage];
				newGarage[carIndex] = {
					...newGarage[carIndex],
					condition: 100,
				};
				setGarage(newGarage);
				saveGame({ money: money - cost, garage: newGarage }); // Immediate Save
				showToast(`Restored ${car.name} for $${cost}`, 'SUCCESS');
			} else {
				showToast(`Need $${cost} to restore!`, 'ERROR');
			}
		},
		[garage, money, showToast, setMoney, setGarage, saveGame]
	);

	const scrapCar = useCallback(
		(carIndex: number) => {
			if (carIndex === currentCarIndex) {
				showToast('Cannot scrap the currently active car!', 'ERROR');
				return;
			}
			const car = garage[carIndex];
			if (!car) return;

			// Calculate Value (Chassis + Installed Items)
			let itemValue = 0;
			const items = car.installedItems || [];
			items.forEach(
				(i) =>
					(itemValue +=
						(i.value || 0) * (i.condition ? i.condition / 100 : 1))
			);

			const baseValue = car.originalPrice || 10000;
			const condition = car.condition || 1;

			// Scrap Value: ~40% of chassis + 50% of items
			const scrapValue = Math.floor(
				baseValue * (condition / 100) * 0.4 + itemValue * 0.5
			);

			// Add Money
			setMoney((m) => m + scrapValue);
			// Remove from Garage
			const newGarage = garage.filter((_, i) => i !== carIndex);
			setGarage(newGarage);
			saveGame({ money: money + scrapValue, garage: newGarage }); // Immediate Save

			// Adjust current index if needed (if we removed a car before the current one)
			if (carIndex < currentCarIndex) {
				setCurrentCarIndex((c) => c - 1);
				// Update ref to match the shift, ensuring sync logic remains valid
				if (previousCarIndexRef.current > carIndex) {
					previousCarIndexRef.current -= 1;
				}
			}

			showToast(`Scrapped ${car.name} for $${scrapValue}`, 'SUCCESS');
		},
		[
			garage,
			currentCarIndex,
			setMoney,
			setGarage,
			showToast,
			saveGame,
			setCurrentCarIndex,
			previousCarIndexRef,
		]
	);

	return { restoreCar, scrapCar };
};
