import {
	calculatePerformanceRating,
	getRatingClass,
} from '../utils/PerformanceRating';
import { useSound } from '../contexts/SoundContext';
import {
	DailyChallenge,
	GamePhase,
	Mission,
	ModNode,
	SavedTune,
	TuningState,
	JunkyardCar,
	Rival,
	AuctionListing,
} from '../types';
import { MOD_TREE, BASE_TUNING } from '../constants';
import MissionSelect from './menu/race/MissionSelect';
import Junkyard from './menu/junkyard/Junkyard';
// VersusScreen removed
import SettingsModal from './menu/settings/SettingsModal';
import { CarBuilder } from '../utils/CarBuilder';
import { CarGenerator } from '../utils/CarGenerator';
import React, { useState, useMemo, useEffect } from 'react';
import { TopBar } from './menu/shared/TopBar';
import { LevelBadge } from './menu/shared/LevelBadge';
import { Inventory } from './menu/inventory/Inventory';
import { CrateShop } from './menu/shop/CrateShop'; // Import CrateShop

import { AuctionHouse } from './menu/auction/AuctionHouse';
import { Garage } from './menu/garage/Garage';
import { SkillTree } from './menu/SkillTree';
import { InventoryItem, Crate } from '../types';
import { ItemGenerator } from '../utils/ItemGenerator';
import { ItemMerge } from '../utils/ItemMerge';

import { useGame } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';
import { getFullUrl } from '../lib/api-config';
import { processMoneyTransaction } from '../utils/transactions';
import { getSkillBonus } from '../utils/skillUtils';

export const GameMenu = () => {
	const {
		phase,
		setPhase,
		money,
		setMoney,
		playerTuning,
		effectiveTuning,
		setPlayerTuning,
		missions,
		dailyChallenges,
		onStartMission,
		modSettings,
		setModSettings,
		onLoadTune,
		showToast,
		dynoHistory,
		setDynoHistory,
		previousDynoHistory,
		onDynoRunStart,
		garage,
		currentCarIndex,
		setCurrentCarIndex,
		undergroundLevel,
		onBuyMods,
		junkyardCars,
		onBuyJunkyardCar,
		onRefreshJunkyard,
		onRestoreCar,
		onScrapCar,
		missionSelectTab,
		setMissionSelectTab,
		xp,
		level,
		defeatedRivals,
		userInventory,
		setUserInventory,
		onMerge,
		saveGame,
		onTestTrack,
		junkyardParts,
		onBuyJunkyardPart,
		setShowSeasonPass,
		setGarage,
		settings,
	} = useGame();

	const { token, user } = useAuth();
	const { play } = useSound();
	const [showSettings, setShowSettings] = useState(false);
	const [showSkills, setShowSkills] = useState(false);
	const [activeListings, setActiveListings] = useState<AuctionListing[]>([]);

	const handleBuyCrate = async (crate: Crate, amount: number) => {
		const cost = crate.price * amount;
		if (money < cost) {
			play('error');
			return;
		}

		if (token) {
			try {
				const result = await processMoneyTransaction(
					token,
					'SHOP_PURCHASE',
					-cost,
					{ crateId: crate.id, count: amount }
				);
				setMoney(result.newBalance);
				play('purchase');
			} catch (e) {
				console.error('Crate purchase failed:', e);
				showToast('Transaction failed', 'ERROR');
			}
		} else {
			// Offline fallback
			setMoney((prev) => prev - cost);
			saveGame({ money: money - cost });
			play('purchase');
		}
	};

	const handleItemReveal = (item: InventoryItem) => {
		setUserInventory((prev) => [...prev, item]);
	};

	const handleEquipItem = async (item: InventoryItem): Promise<number> => {
		// Conflict Check Logic
		const isConflict = (existing: InventoryItem, newOne: InventoryItem) => {
			if (newOne.category && existing.category) {
				return newOne.category === existing.category;
			}
			if (newOne.category) {
				return newOne.category === existing.category;
			}
			return newOne.type === existing.type;
		};

		// Helper to adjust stats
		const adjustStats = (
			tuning: TuningState,
			stats: Partial<TuningState>,
			factor: 1 | -1
		) => {
			const next = { ...tuning };
			Object.entries(stats).forEach(([key, val]) => {
				if (typeof val === 'number') {
					(next as any)[key] =
						((next as any)[key] || 0) + val * factor;
				} else if (factor === 1) {
					(next as any)[key] = val;
				}
			});
			return next;
		};

		// Optimistic Update (for immediate UI feedback)
		const currentEquipped = userInventory.find(
			(i) => i.equipped && isConflict(i, item)
		);

		setPlayerTuning((prev) => {
			let next = { ...prev };
			if (currentEquipped) {
				next = adjustStats(next, currentEquipped.stats, -1);
			}
			next = adjustStats(next, item.stats, 1);
			return next;
		});

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
		} else {
			showToast('Mastery XP already earned for this item', 'INFO');
		}

		if (!token) {
			// Offline Fallback
			setUserInventory((prev) => {
				const newInventory = prev.map((i) => {
					if (i.instanceId === item.instanceId) {
						return { ...i, equipped: true, masteryGiven: true };
					}
					if (i.equipped && isConflict(i, item)) {
						return { ...i, equipped: false };
					}
					return i;
				});

				// Update Garage Mastery XP
				if (xpGained > 0 && garage[currentCarIndex]) {
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

					const newGarage = [...garage];
					newGarage[currentCarIndex] = updatedCar;
					// Delay UI update to sync with animation (1.1s total duration)
					setTimeout(() => setGarage(newGarage), 1100);
					saveGame({ inventory: newInventory, garage: newGarage });
				} else {
					saveGame({ inventory: newInventory });
				}

				return newInventory;
			});

			// showToast(`Equipped ${item.name}`, 'SUCCESS');
			return xpGained;
		}

		// Server Action
		try {
			const res = await fetch(getFullUrl('/api/actions/inventory'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					action: 'EQUIP',
					itemId: item.instanceId,
					currentCarIndex,
				}),
			});

			if (res.ok) {
				const data = await res.json();
				setUserInventory(data.inventory);
				if (data.garage) {
					// Delay UI update to sync with animation (1.1s total duration)
					setTimeout(() => setGarage(data.garage), 1100);
				}
				// showToast(`Equipped ${item.name}`, 'SUCCESS');
				return data.xpGained || 0;
			} else {
				const err = await res.json();
				showToast(err.message || 'Equip failed', 'ERROR');
				return 0;
			}
		} catch (e) {
			console.error('Equip error:', e);
			showToast('Equip failed', 'ERROR');
			return 0;
		}
	};

	// Fetch Listings on Mount/Phase Change and Poll
	useEffect(() => {
		let interval: NodeJS.Timeout;

		const fetchListings = () => {
			fetch(getFullUrl('/api/auction'))
				.then((res) => res.json())
				.then((data) => {
					if (Array.isArray(data)) {
						setActiveListings(data);
					}
				})
				.catch((e) => console.error('Failed to fetch listings', e));
		};

		if (phase === 'AUCTION') {
			fetchListings(); // Initial fetch
			interval = setInterval(fetchListings, 1000); // Poll every 1 second
		}

		return () => {
			if (interval) clearInterval(interval);
		};
	}, [phase]);

	const handleListItem = async (item: InventoryItem, price: number) => {
		if (!token) return;
		try {
			const res = await fetch(getFullUrl('/api/auction?action=create'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ item, price }),
			});

			if (res.ok) {
				const newListing = await res.json();
				setActiveListings((prev) => [newListing, ...prev]);
				// Remove from local inventory immediately (optimistic)
				setUserInventory((prev) =>
					prev.filter((i) => i.instanceId !== item.instanceId)
				);
				showToast(`Listed ${item.name} for $${price}`, 'SUCCESS');
			} else {
				showToast('Failed to list item', 'ERROR');
			}
		} catch (e) {
			console.error(e);
			showToast('Error listing item', 'ERROR');
		}
	};

	const handleBuyItem = async (item: InventoryItem, price: number) => {
		// Note: item here is from the listing, price is listing price
		// We need the listing ID, but the current AuctionHouse interface passes item & price.
		// We might need to adjust AuctionHouse to pass the listing object or ID.
		// For now, let's find the listing in activeListings that matches this item instanceId
		const listing = activeListings.find(
			(l) => l.item.instanceId === item.instanceId
		);

		if (!listing) {
			showToast('Listing not found', 'ERROR');
			return;
		}

		if (money < price) {
			showToast('Not enough money!', 'ERROR');
			return;
		}

		if (!token) return;

		try {
			const res = await fetch(getFullUrl('/api/auction?action=buy'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ listingId: listing.id }),
			});

			if (res.ok) {
				setMoney((m) => m - price);
				setUserInventory((prev) => [...prev, item]);
				setActiveListings((prev) =>
					prev.filter((l) => l.id !== listing.id)
				);
				showToast(`Bought ${item.name}!`, 'SUCCESS');
			} else {
				const err = await res.json();
				showToast(err.message || 'Purchase failed', 'ERROR');
			}
		} catch (e) {
			console.error(e);
			showToast('Transaction failed', 'ERROR');
		}
	};

	const handleCancelListing = async (listingId: string) => {
		if (!token) return;
		try {
			const res = await fetch(getFullUrl('/api/auction'), {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ listingId }),
			});

			if (res.ok) {
				// Find item to add back
				const listing = activeListings.find((l) => l.id === listingId);
				if (listing) {
					setUserInventory((prev) => [...prev, listing.item]);
				}
				setActiveListings((prev) =>
					prev.filter((l) => l.id !== listingId)
				);
				showToast('Listing cancelled', 'INFO');
			} else {
				showToast('Failed to cancel', 'ERROR');
			}
		} catch (e) {
			showToast('Error cancelling', 'ERROR');
		}
	};

	const handleCollectListing = async (listingId: string) => {
		if (!token) return;
		try {
			const res = await fetch(getFullUrl('/api/auction?action=claim'), {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ listingId }),
			});

			if (res.ok) {
				// Find the listing to get the price for toast
				const listing = activeListings.find((l) => l.id === listingId);
				if (listing) {
					// Apply Market Fee (Base 10%)
					const feeMultiplier = getSkillBonus(
						'marketFeeMultiplier',
						settings
					);
					const baseFeeRate = 0.1;
					const fee = Math.floor(
						listing.price * baseFeeRate * feeMultiplier
					);
					const netAmount = listing.price - fee;

					setMoney((m) => m + netAmount);
					showToast(
						`Collected $${netAmount.toLocaleString()} (Fee: $${fee.toLocaleString()})`,
						'SUCCESS'
					);
					play('cash');
				}
				// Remove from listings
				setActiveListings((prev) =>
					prev.filter((l) => l.id !== listingId)
				);
			} else {
				const err = await res.json();
				showToast(err.message || 'Failed to collect', 'ERROR');
			}
		} catch (e) {
			showToast('Error collecting funds', 'ERROR');
		}
	};

	const handleDestroyItem = (item: InventoryItem) => {
		setUserInventory((prev) =>
			prev.filter((i) => i.instanceId !== item.instanceId)
		);
		showToast(`Destroyed ${item.name}`, 'ERROR'); // Red toast
	};

	const handleRepairItem = async (item: InventoryItem, cost: number) => {
		if (money < cost) {
			showToast('Not enough money!', 'ERROR');
			return;
		}

		if (token) {
			try {
				const result = await processMoneyTransaction(
					token,
					'REPAIR_COST',
					-cost,
					{ itemId: item.instanceId }
				);
				setMoney(result.newBalance);

				// Update Inventory
				setUserInventory((prev) => {
					const newInventory = prev.map((i) =>
						i.instanceId === item.instanceId
							? { ...i, condition: 100 }
							: i
					);
					saveGame({ inventory: newInventory });
					return newInventory;
				});

				// Track Stat
				fetch('/api/stats', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ key: 'item_repairs', amount: 1 }),
				}).catch(() => {});

				showToast(`Repaired ${item.name} for $${cost}`, 'SUCCESS');
			} catch (e) {
				console.error('Repair failed:', e);
				showToast('Transaction failed', 'ERROR');
			}
		} else {
			// Offline
			setMoney((m) => m - cost);
			setUserInventory((prev) => {
				const newInventory = prev.map((i) =>
					i.instanceId === item.instanceId
						? { ...i, condition: 100 }
						: i
				);
				saveGame({ money: money - cost, inventory: newInventory });
				return newInventory;
			});
			showToast(`Repaired ${item.name} for $${cost}`, 'SUCCESS');
		}
	};

	const handleRepairAll = async (items: InventoryItem[], cost: number) => {
		if (money < cost) {
			showToast('Not enough money!', 'ERROR');
			return;
		}

		if (token) {
			try {
				const result = await processMoneyTransaction(
					token,
					'REPAIR_COST',
					-cost,
					{ count: items.length }
				);
				setMoney(result.newBalance);

				// Get IDs of items to repair for efficient lookup
				const itemIds = new Set(items.map((i) => i.instanceId));

				setUserInventory((prev) => {
					const newInventory = prev.map((i) =>
						itemIds.has(i.instanceId) ? { ...i, condition: 100 } : i
					);
					saveGame({ inventory: newInventory });
					return newInventory;
				});

				showToast(
					`Repaired ${
						items.length
					} items for $${cost.toLocaleString()}`,
					'SUCCESS'
				);
			} catch (e) {
				console.error('Repair All failed:', e);
				showToast('Transaction failed', 'ERROR');
			}
		} else {
			// Offline
			setMoney((m) => m - cost);
			const itemIds = new Set(items.map((i) => i.instanceId));
			setUserInventory((prev) => {
				const newInventory = prev.map((i) =>
					itemIds.has(i.instanceId) ? { ...i, condition: 100 } : i
				);
				saveGame({ money: money - cost, inventory: newInventory });
				return newInventory;
			});
			showToast(
				`Repaired ${items.length} items for $${cost.toLocaleString()}`,
				'SUCCESS'
			);
		}
	};

	const handleMergeAll = () => {
		const unequippedItems = userInventory.filter((i) => !i.equipped);
		const equippedItems = userInventory.filter((i) => i.equipped);

		// Deep merge logic
		let mergedCount = 0;
		let initialCount = unequippedItems.length;

		// Group by baseId
		const groups: Record<string, InventoryItem[]> = {};
		unequippedItems.forEach((item) => {
			if (!groups[item.baseId]) groups[item.baseId] = [];
			groups[item.baseId].push(item);
		});

		const finalItems: InventoryItem[] = [];

		Object.values(groups).forEach((group) => {
			// Sorting might help deterministic behavior, e.g. best items first?
			// Actually ItemMerge.mergeItems is logic heavy.
			const stack = [...group];

			// Iteratively merge
			// While we have at least 2 items, try to merge
			const processedStack: InventoryItem[] = [];

			while (stack.length > 0) {
				const current = stack.pop();
				if (!current) break;

				// Try to find a match in the remaining stack
				let merged = false;
				for (let i = stack.length - 1; i >= 0; i--) {
					const other = stack[i];
					const result = ItemMerge.mergeItems(current, other);
					if (result) {
						// Success! Remove 'other' and push 'result' back to stack to be potentially merged again
						stack.splice(i, 1);
						stack.push(result);
						mergedCount++;
						merged = true;
						break;
					}
				}

				if (!merged) {
					// No match found for 'current', it is finalized
					processedStack.push(current);
				}
			}
			finalItems.push(...processedStack);
		});

		if (mergedCount > 0) {
			setUserInventory([...equippedItems, ...finalItems]);
			showToast(
				`Merged ${mergedCount} times! Inventory reduced from ${initialCount} to ${finalItems.length}`,
				'SUCCESS'
			);
			play('upgrade'); // Reuse upgrade sound
		} else {
			showToast('No items could be merged.', 'INFO');
		}
	};

	const handleRemoveAll = () => {
		const equippedItems = userInventory.filter((i) => i.equipped);
		if (equippedItems.length === 0) return;

		// We need to reverse the stats of all equipped items from playerTuning.
		// Re-using the adjustStats logic from handleEquipItem would be ideal, but it's inside that function.
		// Let's duplicate the adjust helper for now or move it out if used more.
		// Actually, let's just implement the loop here.

		setPlayerTuning((prev) => {
			let next = { ...prev };
			equippedItems.forEach((item) => {
				// Reverse stats: factor -1
				if (item.stats) {
					Object.entries(item.stats).forEach(([key, val]) => {
						if (typeof val === 'number') {
							(next as any)[key] =
								((next as any)[key] || 0) - val;
						}
						// If precise value was set (factor 1 logic in adjustStats says: if not number, set value)
						// But for Removal, we only care about subtracting numeric bonuses.
						// Non-numeric stats might need reset to base?
						// Assuming stats are additive numbers for now based on typical RPG logic here.
					});
				}
			});
			return next;
		});

		// Update Inventory: Set all to equipped=false
		setUserInventory((prev) =>
			prev.map((i) => (i.equipped ? { ...i, equipped: false } : i))
		);

		showToast(
			`Removed all ${equippedItems.length} installed parts`,
			'INFO'
		);
		play('unequip'); // Assuming 'unequip' sound exists, or fallback
	};

	// Escape key navigation
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				if (
					phase === 'GARAGE' ||
					phase === 'MISSION_SELECT' ||
					phase === 'SHOP' ||
					phase === 'AUCTION'
				) {
					// play('back');
					setPhase('MAP');
				}
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [phase, setPhase, play]);

	// Persistent TopBar for Menu Phases
	const isMenuPhase = [
		'MAP',
		'GARAGE',
		'MISSION_SELECT',
		'JUNKYARD',
		'SHOP',
		'AUCTION',
	].includes(phase);

	if (isMenuPhase) {
		let onBack = undefined;

		if (phase === 'GARAGE') {
			onBack = () => setPhase('MAP');
		} else if (phase === 'MISSION_SELECT') {
			onBack = () => setPhase('MAP');
		} else if (phase === 'JUNKYARD') {
			onBack = () => setPhase('MAP');
		} else if (phase === 'SHOP') {
			onBack = () => setPhase('MAP');
		} else if (phase === 'AUCTION') {
			onBack = () => setPhase('MAP');
		}

		return (
			<div className="absolute inset-0 bg-neutral-900 flex flex-col font-pixel">
				<TopBar level={level} xp={xp} money={money} onBack={onBack} />
				<div className="flex-1 relative w-full h-full overflow-hidden">
					{phase === 'MAP' && (
						<div className="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center text-white z-50">
							<h1 className="text-4xl md:text-6xl text-indigo-500 mb-4 pixel-text tracking-widest">
								DRAG
							</h1>
							<p className="text-gray-400 mb-12 text-xs md:text-sm">
								VERTICAL DRAG RACING SIMULATOR
							</p>

							<div className="grid grid-cols-2 gap-6">
								<button
									onClick={() => {
										// play('click');
										setPhase('MISSION_SELECT');
									}}
									className="pixel-btn text-center py-4 text-lg"
								>
									RACE
								</button>
								<button
									onClick={() => {
										// play('click');
										setPhase('GARAGE');
									}}
									className="pixel-btn text-center py-4 text-lg bg-gray-700"
									style={{ backgroundColor: '#4b5563' }}
								>
									GARAGE
								</button>

								<button
									onClick={() => {
										// play('click');
										setPhase('JUNKYARD');
									}}
									className="pixel-btn text-center py-4 text-lg bg-orange-900 border-orange-700 text-orange-500 hover:bg-orange-800"
									style={{
										backgroundColor: '#7c2d12',
									}}
								>
									JUNKYARD
								</button>

								<button
									onClick={() => {
										setPhase('SHOP');
									}}
									className="pixel-btn text-center py-4 text-lg bg-indigo-900 border-indigo-700 text-indigo-400 hover:bg-indigo-800"
									style={{
										backgroundColor: '#312e81', // indigo-900
										borderColor: '#4338ca', // indigo-700
									}}
								>
									SHOP
								</button>
								{/* <button
									onClick={() => {
										setShowSeasonPass(true);
									}}
									className="pixel-btn text-center py-4 text-lg bg-yellow-600 border-yellow-400 text-yellow-100 hover:bg-yellow-500"
									style={{
										backgroundColor: '#ca8a04', // yellow-600
										borderColor: '#facc15', // yellow-400
									}}
								>
									SEASON PASS
								</button> */}
								<button
									onClick={() => {
										setPhase('AUCTION');
									}}
									className="pixel-btn text-center py-4 text-lg bg-yellow-900 border-yellow-700 text-yellow-500 hover:bg-yellow-800"
									style={{
										backgroundColor: '#713f12', // yellow-900 (approx)
										borderColor: '#a16207', // yellow-700
									}}
								>
									AUCTION
								</button>
								{/* <button
									onClick={() => {
										setShowDailyRewards(true);
									}}
									className="pixel-btn text-center py-4 text-lg bg-green-900 border-green-700 text-green-400 hover:bg-green-800"
									style={{
										backgroundColor: '#14532d', // green-900
										borderColor: '#15803d', // green-700
									}}
								>
									DAILY REWARDS
								</button> */}
								<button
									onClick={() => setShowSkills(true)}
									className="pixel-btn text-center py-2 text-lg bg-teal-900 border-teal-700 text-teal-400 hover:bg-teal-800"
									style={{
										backgroundColor: '#134e4a', // teal-900
										borderColor: '#0f766e', // teal-700
									}}
								>
									SKILLS
								</button>
								<button
									onClick={() => setShowSettings(true)}
									className="pixel-btn text-center py-2 text-lg bg-gray-800 border-gray-600 text-slate-400"
								>
									SETTINGS
								</button>
							</div>

							<SettingsModal
								isOpen={showSettings}
								onClose={() => setShowSettings(false)}
							/>
							{showSkills && (
								<SkillTree
									onClose={() => setShowSkills(false)}
								/>
							)}
						</div>
					)}

					{phase === 'MISSION_SELECT' && (
						<MissionSelect
							missions={missions}
							dailyChallenges={dailyChallenges}
							onStartMission={onStartMission}
							onBack={() => setPhase('MAP')}
							undergroundLevel={undergroundLevel}
							money={money}
							garage={garage}
							activeTab={missionSelectTab}
							setActiveTab={setMissionSelectTab}
							defeatedRivals={defeatedRivals}
							level={level}
							onChallengeRival={(r) => {}} // No-op
						/>
					)}

					{phase === 'JUNKYARD' && (
						<Junkyard
							cars={junkyardCars}
							money={money}
							onBuyCar={onBuyJunkyardCar}
							onBack={() => setPhase('MAP')}
							onRefresh={onRefreshJunkyard}
							parts={junkyardParts}
							onBuyPart={onBuyJunkyardPart}
						/>
					)}

					{phase === 'SHOP' && (
						<div className="absolute inset-0 z-10 bg-black/90 pt-16">
							<CrateShop
								money={money}
								onBuyCrate={handleBuyCrate}
								onItemReveal={(items) => {
									const newInventory = [
										...userInventory,
										...items,
									];
									setUserInventory(newInventory);
									saveGame({ inventory: newInventory });
								}}
							/>
						</div>
					)}

					{phase === 'AUCTION' && (
						<div className="absolute inset-0 bg-neutral-900 flex flex-col z-50">
							<div className="p-4 bg-gray-900 border-b border-gray-800 flex justify-between items-center">
								<h2 className="text-xl text-yellow-400 pixel-text">
									AUCTION HOUSE
								</h2>
							</div>
							<div className="flex-1 overflow-hidden p-4">
								<AuctionHouse
									inventory={userInventory}
									onSellItem={handleListItem}
									money={money}
									onBuyItem={handleBuyItem}
									listings={activeListings}
									onCancelListing={handleCancelListing}
									onCollectListing={handleCollectListing}
									playerTuning={effectiveTuning}
									ownedMods={[]}
									currentUserId={user?.id}
								/>
							</div>
						</div>
					)}

					{phase === 'GARAGE' && (
						<Garage
							money={money}
							garage={garage}
							currentCarIndex={currentCarIndex}
							setCurrentCarIndex={setCurrentCarIndex}
							playerTuning={playerTuning}
							setPlayerTuning={setPlayerTuning}
							effectiveTuning={effectiveTuning}
							ownedMods={[]}
							setOwnedMods={() => {}}
							disabledMods={[]}
							setDisabledMods={() => {}}
							modSettings={modSettings}
							setModSettings={setModSettings}
							dynoHistory={dynoHistory}
							setDynoHistory={setDynoHistory}
							previousDynoHistory={previousDynoHistory}
							onDynoRunStart={onDynoRunStart}
							onLoadTune={onLoadTune}
							onBuyMods={onBuyMods}
							onBack={() => setPhase('MAP')}
							userInventory={userInventory}
							onEquip={handleEquipItem}
							onRemove={(item) => {
								setUserInventory((prev) =>
									prev.map((i) =>
										i.instanceId === item.instanceId
											? { ...i, equipped: false }
											: i
									)
								);
								showToast(`Removed ${item.name}`, 'INFO');
							}}
							onSell={(item) => setPhase('AUCTION')}
							onDestroy={handleDestroyItem}
							onRestoreCar={onRestoreCar}
							onScrapCar={onScrapCar}
							onRepair={handleRepairItem}
							onMerge={onMerge}
							onRepairAll={handleRepairAll}
							onMergeAll={handleMergeAll}
							onRemoveAll={handleRemoveAll}
							onTestTrack={onTestTrack}
						/>
					)}
				</div>
			</div>
		);
	}

	return null;
};
