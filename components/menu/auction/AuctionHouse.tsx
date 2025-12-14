import React, { useState, useEffect, useMemo } from 'react';
import { InventoryItem, ItemRarity, TuningState, ModNode } from '@/types';
import { ItemGenerator } from '@/utils/ItemGenerator';
import { CarBuilder } from '@/utils/CarBuilder';
import { BASE_TUNING, MOD_TREE } from '@/constants';
import { ItemCard } from '@/components/ui/ItemCard';

interface AuctionHouseProps {
	inventory: InventoryItem[];
	onSellItem: (item: InventoryItem, price: number) => void;
	money: number;
	onBuyItem: (item: InventoryItem, price: number) => void;
	listings: import('@/types').AuctionListing[];
	onCancelListing: (id: string) => void;
	onCollectListing: (id: string) => void;
	playerTuning: TuningState;
	ownedMods: string[];
	currentUserId?: string;
}

export const AuctionHouse: React.FC<AuctionHouseProps> = ({
	inventory,
	onSellItem,
	money,
	onBuyItem,
	listings,
	onCancelListing,
	onCollectListing,
	playerTuning,
	ownedMods,
	currentUserId,
}) => {
	const [marketItems, setMarketItems] = useState<InventoryItem[]>([]);

	// Shared State
	const [hoveredMarketItem, setHoveredMarketItem] =
		useState<InventoryItem | null>(null);
	const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

	// Sell State
	const [selectedSellItem, setSelectedSellItem] =
		useState<InventoryItem | null>(null);
	const [listPrice, setListPrice] = useState<string>('');
	const [lastSoldPrice, setLastSoldPrice] = useState<number | null>(null);
	const [showListingDetails, setShowListingDetails] = useState(false);

	// Buy State
	const [selectedBuyItem, setSelectedBuyItem] =
		useState<InventoryItem | null>(null);
	const [searchQuery, setSearchQuery] = useState('');
	const [rarityFilter, setRarityFilter] = useState<'ALL' | ItemRarity>('ALL');

	const handleMouseMove = (e: React.MouseEvent) => {
		setMousePos({ x: e.clientX, y: e.clientY });
	};

	// Helper for Stat Color
	const getStatColor = (key: string, val: number) => {
		if (key === 'weight' || key === 'drag') {
			return val < 0
				? 'text-green-400'
				: val > 0
				? 'text-red-400'
				: 'text-gray-400';
		}
		return val > 0
			? 'text-green-400'
			: val < 0
			? 'text-red-400'
			: 'text-gray-400';
	};

	const formatStatValue = (val: number) => {
		return (val > 0 ? '+' : '') + val;
	};

	// Use listings prop for Market Items
	useEffect(() => {
		// Filter out my own listings? Or show all?
		// For now, show all active listings that are NOT mine (handled by parent or API?)
		// Actually, the parent passes 'listings' which are ALL active listings.
		// We should probably filter out our own listings in the 'Buy' view if we want,
		// but usually you can see your own listings too.
		// However, for the "Market Items" view (Buy Tab), we want to see what others are selling.
		// The 'listings' prop contains AuctionListing objects.
		// We need to map them to InventoryItems but keep the price from the listing.
		// Wait, the UI expects InventoryItem for display, but we need the price.
		// Let's map listings to a structure that works.
		// Actually, let's just use the listings directly for the Buy view instead of 'marketItems'.
		// But 'marketItems' is currently InventoryItem[].
		// Let's update 'marketItems' to be derived from 'listings'.

		const items = listings
			.filter((l) => l.status === 'ACTIVE')
			.map((l) => ({
				...l.item,
				value: l.price, // Override value with listing price for display
				sellerId: l.sellerId,
			}));
		setMarketItems(items);
	}, [listings]);

	// Helper for Icons
	const getItemIcon = (type: string) => {
		switch (type) {
			case 'ENGINE_BLOCK':
				return '🔧';
			case 'TURBO':
				return '🐌';
			case 'INTAKE':
				return '💨';
			case 'EXHAUST':
				return '🔥';
			case 'TIRES':
				return '🍩';
			case 'ECU':
				return '💻';
			case 'PISTONS':
				return '🔩';
			default:
				return '📦';
		}
	};

	// Filtered Market Items
	const filteredMarketItems = marketItems.filter((item) => {
		const matchesSearch = item.name
			.toLowerCase()
			.includes(searchQuery.toLowerCase());
		const matchesRarity =
			rarityFilter === 'ALL' || item.rarity === rarityFilter;
		return matchesSearch && matchesRarity;
	});

	// --- SELL LOGIC ---
	const handleSelectSellItem = (item: InventoryItem) => {
		setSelectedSellItem(item);
		setListPrice(Math.floor(item.value * 1.1).toString());
		const variance = 0.8 + Math.random() * 0.4;
		setLastSoldPrice(Math.floor(item.value * variance));
	};

	const handleSell = () => {
		if (!selectedSellItem || !listPrice) return;
		const price = parseInt(listPrice);
		if (isNaN(price) || price <= 0) return;

		onSellItem(selectedSellItem, price);
		setSelectedSellItem(null);
		setListPrice('');
	};

	const markupPercent =
		lastSoldPrice && listPrice
			? Math.round(
					((parseInt(listPrice) - lastSoldPrice) / lastSoldPrice) *
						100
			  )
			: 0;

	// --- BUY LOGIC ---
	const handleSelectBuyItem = (item: InventoryItem) => {
		setSelectedBuyItem(item);
	};

	const handleBuy = () => {
		if (!selectedBuyItem) return;
		onBuyItem(selectedBuyItem, selectedBuyItem.value);
		setMarketItems((prev) =>
			prev.filter((i) => i.instanceId !== selectedBuyItem.instanceId)
		);
		setSelectedBuyItem(null);
	};

	// --- PREVIEW LOGIC (Updated to use hoveredMarketItem) ---
	const hoverPreviewData = useMemo(() => {
		// Only show preview comparison if we are hovering a MARKET item (Buy)
		const isMarketItem = marketItems.some(
			(i) => i.instanceId === hoveredMarketItem?.instanceId
		);
		if (!hoveredMarketItem || !isMarketItem) return null;

		const item = hoveredMarketItem;
		const newItemModId = item.baseId;
		const newItemMod = MOD_TREE.find((m) => m.id === newItemModId);
		let conflictingModId: string | null = null;
		let conflictName: string | null = null;
		let diffStats: Record<
			string,
			{ current: number; new: number; diff: number }
		> = {};

		if (newItemMod) {
			if (newItemMod.conflictsWith) {
				const found = newItemMod.conflictsWith.find((cId) =>
					ownedMods.includes(cId)
				);
				if (found) conflictingModId = found;
			}
		}

		if (conflictingModId) {
			const conflictMod = MOD_TREE.find((m) => m.id === conflictingModId);
			conflictName = conflictMod ? conflictMod.name : 'Unknown Part';

			// Calculate Diffs against conflicting part
			if (conflictMod && conflictMod.stats) {
				Object.entries(item.stats).forEach(([key, newVal]) => {
					if (typeof newVal !== 'number') return;
					const oldVal = (conflictMod.stats as any)[key] || 0;
					if (typeof oldVal !== 'number') return;

					diffStats[key] = {
						current: oldVal,
						new: newVal,
						diff: newVal - oldVal,
					};
				});
			}
		} else {
			// No conflict, all gain
			Object.entries(item.stats).forEach(([key, newVal]) => {
				if (typeof newVal !== 'number') return;
				diffStats[key] = {
					current: 0,
					new: newVal,
					diff: newVal,
				};
			});
		}

		return {
			conflictName,
			diffStats,
		};
	}, [hoveredMarketItem, ownedMods, marketItems]);

	// Mock Market Data for Sell Modal
	const marketStats = useMemo(() => {
		if (!selectedSellItem) return null;
		const base = selectedSellItem.value;
		return {
			average: Math.floor(base * (0.95 + Math.random() * 0.1)),
			low: Math.floor(base * 0.8),
			high: Math.floor(base * 1.25),
		};
	}, [selectedSellItem]);

	return (
		<div
			className="w-full h-full flex flex-col p-4 bg-gray-900/50"
			onMouseMove={handleMouseMove}
		>
			{/* Header / Search */}
			<div className="flex gap-4 mb-2 pb-2 justify-between items-center border-b border-gray-700">
				<div className="text-xl font-bold text-white pixel-text">
					MARKETPLACE
				</div>
				<div className="flex gap-2">
					<input
						type="text"
						placeholder="Search parts..."
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm text-white focus:border-yellow-500 outline-none"
					/>
					<select
						value={rarityFilter}
						onChange={(e) => setRarityFilter(e.target.value as any)}
						className="bg-gray-800 border border-gray-600 rounded px-3 py-1 text-sm text-white focus:border-yellow-500 outline-none"
					>
						<option value="ALL">All Rarities</option>
						<option value="COMMON">Common</option>
						<option value="UNCOMMON">Uncommon</option>
						<option value="RARE">Rare</option>
						<option value="EPIC">Epic</option>
						<option value="LEGENDARY">Legendary</option>
					</select>
				</div>
			</div>

			<div className="flex-1 flex flex-col gap-4 overflow-hidden relative">
				{/* TOP HALF: BUY (MARKET) */}
				<div className="flex-1 flex flex-col gap-2 min-h-0">
					<div className="flex justify-between items-center px-1">
						<div className="text-xs font-bold text-yellow-500 tracking-widest">
							ITEMS FOR SALE
						</div>
						<div className="text-xs text-gray-500">
							Live Listings
						</div>
					</div>
					<div
						className="flex-1 overflow-hidden bg-gray-900/80 rounded-lg p-3 grid gap-2 content-start border border-gray-700"
						style={{
							gridTemplateColumns: `repeat(auto-fill, minmax(130px, 1fr))`,
						}}
					>
						{filteredMarketItems.map((item) => {
							const isMine =
								currentUserId &&
								(item as any).sellerId === currentUserId;
							return (
								<div
									key={item.instanceId}
									className={`relative rounded ${
										isMine
											? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-gray-900'
											: ''
									}`}
								>
									<ItemCard
										item={item}
										onClick={() =>
											item && setSelectedBuyItem(item)
										}
										onMouseEnter={() =>
											item && setHoveredMarketItem(item)
										}
										onMouseLeave={() =>
											setHoveredMarketItem(null)
										}
										isSelected={selectedBuyItem === item}
										showCondition={true}
									/>
									{isMine && (
										<div className="absolute -top-2 -right-2 bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold shadow-sm z-10 pointer-events-none">
											YOU
										</div>
									)}
								</div>
							);
						})}
						{filteredMarketItems.length === 0 && (
							<div className="col-span-full text-center text-gray-500 py-10">
								No items match your search.
							</div>
						)}
					</div>
				</div>

				{/* BUY MODAL */}
				{selectedBuyItem && (
					<div
						className="absolute inset-0 z-[50] flex items-center justify-center bg-black/50"
						onClick={() => setSelectedBuyItem(null)}
					>
						<div
							className="bg-gray-900 border-2 border-yellow-500 rounded p-6 shadow-2xl animate-in zoom-in-95 flex flex-col gap-4 min-w-[300px]"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="text-center">
								<h3 className="text-xl font-bold text-white mb-1">
									{currentUserId &&
									(selectedBuyItem as any).sellerId ===
										currentUserId
										? 'Manage Listing'
										: 'Buy Item?'}
								</h3>
								<div className="text-gray-400 text-sm">
									{selectedBuyItem.name}
								</div>
							</div>

							<div className="bg-black/40 rounded p-2 text-center">
								<div className="text-xs text-gray-500 mb-1">
									{currentUserId &&
									(selectedBuyItem as any).sellerId ===
										currentUserId
										? 'LISTED PRICE'
										: 'COST'}
								</div>
								<div className="text-yellow-400 font-mono text-2xl font-bold">
									${selectedBuyItem.value.toLocaleString()}
								</div>
							</div>

							<div className="flex gap-2">
								{currentUserId &&
								(selectedBuyItem as any).sellerId ===
									currentUserId ? (
									<button
										onClick={() => {
											// Find the listing ID for this item
											const listing = listings.find(
												(l) =>
													l.item.instanceId ===
													selectedBuyItem.instanceId
											);
											if (listing) {
												onCancelListing(listing.id);
												setSelectedBuyItem(null);
											}
										}}
										className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded pixel-text"
									>
										CANCEL LISTING
									</button>
								) : (
									<button
										onClick={handleBuy}
										disabled={money < selectedBuyItem.value}
										className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded pixel-text"
									>
										CONFIRM
									</button>
								)}

								<button
									onClick={() => setSelectedBuyItem(null)}
									className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded pixel-text"
								>
									CLOSE
								</button>
							</div>
							{!currentUserId ||
								((selectedBuyItem as any).sellerId !==
									currentUserId &&
									money < selectedBuyItem.value && (
										<div className="text-red-500 text-xs text-center font-bold animate-pulse">
											Insufficient Funds!
										</div>
									))}
						</div>
					</div>
				)}

				{/* DIVIDER */}
				<div className="h-px bg-gray-700 w-full" />

				{/* BOTTOM HALF: SPLIT VIEW (INVENTORY + LISTINGS) */}
				<div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-2 gap-4">
					{/* LEFT: INVENTORY (LIST ITEM) */}
					<div className="flex flex-col gap-2 min-h-0">
						<div className="flex justify-between items-center px-1">
							<div className="text-xs font-bold text-green-500 tracking-widest">
								YOUR INVENTORY
							</div>
							<div className="text-xs text-gray-500">
								Select to List
							</div>
						</div>
						<div
							className="flex-1 bg-gray-900/80 rounded-lg p-3 grid gap-3 overflow-y-auto content-start border border-gray-700 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
							style={{
								gridTemplateColumns: `repeat(auto-fill, minmax(130px, 1fr))`,
							}}
						>
							{inventory.map((item) => (
								<ItemCard
									key={item.instanceId}
									item={item}
									onClick={() =>
										item && setSelectedSellItem(item)
									}
									onMouseEnter={() =>
										item && setHoveredMarketItem(item)
									}
									onMouseLeave={() =>
										setHoveredMarketItem(null)
									}
								/>
							))}
							{inventory.length === 0 && (
								<div className="col-span-full text-center text-gray-500 py-10">
									Inventory Empty
								</div>
							)}
						</div>
					</div>

					{/* RIGHT: ACTIVE LISTINGS */}
					<div className="flex flex-col gap-2 min-h-0">
						<div className="flex justify-between items-center px-1">
							<div className="text-xs font-bold text-blue-500 tracking-widest">
								MY LISTINGS
							</div>
							<div className="text-xs text-gray-500">
								Manage Auctions
							</div>
						</div>
						<div className="flex-1 bg-gray-900/80 rounded-lg p-3 flex flex-col gap-2 overflow-y-auto border border-gray-700 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
							{listings
								.filter(
									(l) =>
										currentUserId &&
										l.sellerId === currentUserId
								)
								.map((listing) => (
									<div
										key={listing.id}
										className={`flex items-center gap-3 p-2 rounded border bg-gray-800 ${
											listing.status === 'SOLD'
												? 'border-green-500/50'
												: 'border-gray-600'
										}`}
									>
										{/* Mini Item Preview */}
										<div className="w-12 h-12 relative shrink-0">
											<ItemCard
												item={listing.item}
												className="w-full h-full text-[8px]" // Tiny card?
												showCondition={false}
												onClick={() => {}} // No action
											/>
										</div>

										<div className="flex-1 min-w-0">
											<div className="font-bold text-white truncate text-sm">
												{listing.item.name}
											</div>
											<div className="text-xs font-mono text-gray-400">
												Listed: $
												{listing.price.toLocaleString()}
											</div>
										</div>

										{/* Status / Action */}
										<div className="shrink-0">
											{listing.status === 'SOLD' ? (
												<button
													onClick={() =>
														onCollectListing(
															listing.id
														)
													}
													className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white font-bold text-xs rounded pixel-text animate-pulse"
												>
													COLLECT $
													{listing.price.toLocaleString()}
												</button>
											) : (
												<button
													onClick={() =>
														onCancelListing(
															listing.id
														)
													}
													className="px-3 py-1 bg-red-900/50 hover:bg-red-800 text-red-200 border border-red-800 font-bold text-xs rounded pixel-text"
												>
													CANCEL
												</button>
											)}
										</div>
									</div>
								))}
							{listings.length === 0 && (
								<div className="text-center text-gray-500 py-10">
									No active listings.
								</div>
							)}
						</div>
					</div>
				</div>

				{/* SELL MODALS */}
				{/* 1. SELECTION MENU */}
				{selectedSellItem && !showListingDetails && (
					<div
						className="absolute inset-0 z-[50] flex items-center justify-center bg-black/50"
						onClick={() => setSelectedSellItem(null)}
					>
						<div
							className="bg-gray-900 border-2 border-white rounded shadow-2xl p-4 flex flex-col gap-2 min-w-[200px] animate-in zoom-in-95"
							onClick={(e) => e.stopPropagation()}
						>
							<div className="text-center font-bold text-white border-b border-gray-700 pb-2 mb-2">
								{selectedSellItem.name}
							</div>
							<button
								onClick={() => {
									// Initialize listing
									setListPrice(
										Math.floor(
											selectedSellItem.value * 1.0
										).toString()
									); // Default to flat price
									// setLastSoldPrice calculated in effect or logic?
									const variance = 0.8 + Math.random() * 0.4;
									setLastSoldPrice(
										Math.floor(
											selectedSellItem.value * variance
										)
									);
									setShowListingDetails(true);
								}}
								className="py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-bold rounded pixel-text text-sm"
							>
								LIST FOR SALE
							</button>
							<button
								onClick={() => setSelectedSellItem(null)}
								className="text-xs text-gray-500 hover:text-white mt-1 text-center"
							>
								CANCEL
							</button>
						</div>
					</div>
				)}

				{/* 2. LISTING DETAILS */}
				{selectedSellItem && showListingDetails && (
					<div
						className="absolute inset-0 z-[60] flex items-center justify-center bg-black/60"
						onClick={() => {
							setSelectedSellItem(null);
							setListPrice('');
							setShowListingDetails(false);
						}}
					>
						<div
							className="bg-gray-900 border-2 border-white w-96 rounded-lg p-6 shadow-2xl animate-in zoom-in-95"
							onClick={(e) => e.stopPropagation()}
						>
							<h3 className="text-xl font-bold text-white mb-4 border-b border-gray-700 pb-2">
								CREATE LISTING
							</h3>
							<div className="mb-4 text-center">
								<div
									className="text-lg font-bold"
									style={{
										color: ItemGenerator.getRarityColor(
											selectedSellItem.rarity
										),
									}}
								>
									{selectedSellItem.name}
								</div>
							</div>

							{/* MARKET ANALYTICS */}
							{marketStats && (
								<div className="grid grid-cols-3 gap-2 mb-6 bg-black/30 p-2 rounded">
									<div className="text-center">
										<div className="text-[10px] text-gray-500 uppercase">
											Low
										</div>
										<div className="text-green-400 font-mono text-sm">
											${marketStats.low}
										</div>
									</div>
									<div className="text-center border-x border-gray-700">
										<div className="text-[10px] text-gray-500 uppercase">
											Avg
										</div>
										<div className="text-yellow-400 font-mono text-sm">
											${marketStats.average}
										</div>
									</div>
									<div className="text-center">
										<div className="text-[10px] text-gray-500 uppercase">
											High
										</div>
										<div className="text-red-400 font-mono text-sm">
											${marketStats.high}
										</div>
									</div>
								</div>
							)}

							<div className="mb-8">
								<label className="text-gray-300 text-sm font-bold mb-2 block">
									Listing Price
								</label>
								<div className="relative">
									<span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
										$
									</span>
									<input
										type="number"
										value={listPrice}
										onChange={(e) =>
											setListPrice(e.target.value)
										}
										className="w-full bg-gray-800 text-white pl-8 pr-4 py-3 rounded border border-gray-600 focus:border-yellow-500 focus:outline-none font-mono text-lg"
										placeholder="0"
									/>
								</div>
								{markupPercent !== 0 && (
									<div
										className={`text-right text-xs mt-1 ${
											markupPercent > 0
												? 'text-green-400'
												: 'text-red-400'
										}`}
									>
										{markupPercent > 0 ? '+' : ''}
										{markupPercent}% vs Avg
									</div>
								)}
							</div>
							<div className="flex gap-2">
								<button
									onClick={handleSell}
									className="flex-1 py-4 bg-green-600 hover:bg-green-500 text-white font-bold rounded text-lg pixel-text transition-all active:scale-95"
								>
									LIST ITEM
								</button>
								<button
									onClick={() => {
										setListPrice('');
										setSelectedSellItem(null);
									}} // Changed to Cancel/Close
									className="px-4 py-4 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded text-lg pixel-text"
								>
									CANCEL
								</button>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* FLOATING HOVER TOOLTIP (Shared for Buy & Sell) */}
			{hoveredMarketItem && !selectedSellItem && !selectedBuyItem && (
				<div
					className="fixed z-[100] w-72 bg-black/95 border-2 p-4 rounded shadow-2xl pointer-events-none animate-in fade-in duration-75"
					style={{
						left: Math.min(
							mousePos.x + 20,
							window.innerWidth - 320
						), // Prevent overflow
						top: Math.min(
							mousePos.y + 20,
							window.innerHeight - 300
						),
						borderColor: ItemGenerator.getRarityColor(
							hoveredMarketItem.rarity
						),
					}}
				>
					<div
						className="text-lg font-bold pixel-text mb-1"
						style={{
							color: ItemGenerator.getRarityColor(
								hoveredMarketItem.rarity
							),
						}}
					>
						{hoveredMarketItem.name}
					</div>
					<div className="text-[10px] uppercase tracking-wider mb-2 text-gray-500">
						{hoveredMarketItem.rarity} {hoveredMarketItem.type}
					</div>

					{hoverPreviewData ? (
						<>
							{/* Comparison View for BUY */}
							{hoverPreviewData.conflictName && (
								<div className="text-red-400 text-xs mb-2">
									Replaces: {hoverPreviewData.conflictName}
								</div>
							)}
							<div className="space-y-1">
								{Object.entries(hoverPreviewData.diffStats).map(
									([key, stats]) => {
										// Type check stats to avoid 'unknown' error
										const typedStats = stats as {
											current: number;
											new: number;
											diff: number;
										};
										return (
											<div
												key={key}
												className="flex justify-between items-center text-xs font-mono"
											>
												<span className="text-gray-400 capitalize w-20 truncate">
													{key
														.replace(
															/([A-Z]+)([A-Z][a-z])/g,
															'$1 $2'
														)
														.replace(
															/([a-z\d])([A-Z])/g,
															'$1 $2'
														)}
												</span>
												<div className="flex gap-2 text-right flex-1 justify-end">
													<span className="text-white">
														{typedStats.new}
													</span>
													<span
														className={`
                                                ${getStatColor(
													key,
													typedStats.diff
												)}
                                            `}
													>
														(
														{typedStats.diff > 0
															? '+'
															: ''}
														{typedStats.diff})
													</span>
												</div>
											</div>
										);
									}
								)}
							</div>
						</>
					) : (
						/* Simple View for SELL (or non-comparable) */
						<div className="space-y-1">
							{Object.entries(hoveredMarketItem.stats).map(
								([key, val]) => {
									if (typeof val !== 'number') return null;
									return (
										<div
											key={key}
											className="flex justify-between text-xs font-mono"
										>
											<span className="text-gray-400 capitalize">
												{key.replace(/([A-Z])/g, ' $1')}
											</span>
											<span
												className={getStatColor(
													key,
													val
												)}
											>
												{formatStatValue(
													Number(val.toFixed(0))
												)}
												{key === 'weight' ? 'kg' : ''}
											</span>
										</div>
									);
								}
							)}
						</div>
					)}

					<div className="mt-3 pt-2 border-t border-gray-800 flex justify-between text-xs font-mono">
						<span className="text-gray-500">Value</span>
						<span className="text-green-400">
							${hoveredMarketItem.value.toLocaleString()}
						</span>
					</div>
				</div>
			)}
		</div>
	);
};
