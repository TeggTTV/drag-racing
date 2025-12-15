import React, { useState } from 'react';
import { useGame } from '@/contexts/GameContext';
import { useAuth } from '@/contexts/AuthContext';
import { CrateShop } from './CrateShop';
import { DailyPartsShop } from './DailyPartsShop';
import Dealership from './Dealership';
import { Crate, InventoryItem } from '@/types';
import { getFullUrl } from '@/utils/prisma';

type ShopTab = 'CRATES' | 'DAILY' | 'CARS';

export const ShopHub: React.FC = () => {
	const {
		money,
		setMoney,
		setUserInventory,
		dealershipCars,
		onBuyDealershipCar,
		onRefreshDealership,
		dailyShopItems,
		onBuyShopItem,
		onRefreshDailyShop,
		setPhase,
		showToast,
	} = useGame();

	const { token } = useAuth();

	const [activeTab, setActiveTab] = useState<ShopTab>('CRATES');
	const [isPurchasing, setIsPurchasing] = useState(false);

	// Crate Handlers
	const handleBuyCrate = async (crate: Crate, amount: number) => {
		// Validation check
		if (money < crate.price * amount) {
			showToast?.('Not enough money!', 'ERROR');
			return;
		}

		if (!token) {
			showToast?.('Please log in to make purchases', 'ERROR');
			return;
		}

		// Prevent double purchases
		if (isPurchasing) return;

		setIsPurchasing(true);

		try {
			const response = await fetch(getFullUrl('/api/shop/crates'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					crateId: crate.id,
					crateName: crate.name,
					cratePrice: crate.price,
					quantity: amount,
				}),
			});

			const data = await response.json();
			if (response.ok) {
				// Update local money state with the new balance from the server
				setMoney(data.newBalance);
			} else {
				showToast?.(data.message || 'Purchase failed', 'ERROR');
			}
		} catch (error) {
			showToast?.('Network error. Please try again.', 'ERROR');
		} finally {
			setIsPurchasing(false);
		}
	};

	const handleItemsReveal = (items: InventoryItem[]) => {
		setUserInventory((prev) => [...prev, ...items]);
	};

	return (
		<div className="absolute inset-0 bg-neutral-900 flex flex-col z-50 font-pixel">
			{/* Header / Tabs */}
			<div className="bg-gray-900 border-b border-gray-800 p-4">
				<div className="flex justify-center gap-8">
					<button
						onClick={() => setActiveTab('CRATES')}
						className={`text-xl px-4 py-2 border-b-4 transition-colors ${
							activeTab === 'CRATES'
								? 'text-white border-blue-500 bg-blue-500/10'
								: 'text-gray-500 border-transparent hover:text-gray-300'
						}`}
					>
						SUPPLY CRATES
					</button>
					<button
						onClick={() => setActiveTab('DAILY')}
						className={`text-xl px-4 py-2 border-b-4 transition-colors ${
							activeTab === 'DAILY'
								? 'text-yellow-400 border-yellow-500 bg-yellow-500/10'
								: 'text-gray-500 border-transparent hover:text-gray-300'
						}`}
					>
						DAILY SPECIALS
					</button>
					<button
						onClick={() => setActiveTab('CARS')}
						className={`text-xl px-4 py-2 border-b-4 transition-colors ${
							activeTab === 'CARS'
								? 'text-indigo-400 border-indigo-500 bg-indigo-500/10'
								: 'text-gray-500 border-transparent hover:text-gray-300'
						}`}
					>
						DEALERSHIP
					</button>
				</div>
			</div>

			{/* Content Area */}
			<div className="flex-1 overflow-hidden relative">
				{activeTab === 'CRATES' && (
					<CrateShop
						money={money}
						onBuyCrate={handleBuyCrate}
						onItemReveal={handleItemsReveal}
					/>
				)}

				{activeTab === 'DAILY' && (
					<DailyPartsShop
						items={dailyShopItems}
						money={money}
						onBuy={onBuyShopItem}
						onRefresh={onRefreshDailyShop}
					/>
				)}

				{activeTab === 'CARS' && (
					<Dealership
						cars={dealershipCars}
						money={money}
						onBuyCar={onBuyDealershipCar}
						onBack={() => setPhase('MAP')} // Not strictly needed if TopBar exists
						onRefresh={onRefreshDealership}
					/>
				)}
			</div>
		</div>
	);
};
