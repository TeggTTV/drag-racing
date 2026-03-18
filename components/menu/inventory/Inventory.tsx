import React, { useState, useRef } from 'react';
import { InventoryItem } from '@/types';
import { ItemGenerator } from '@/utils/ItemGenerator';
import { ItemCard } from '@/components/ui/ItemCard';
import { ItemMerge } from '@/utils/ItemMerge';
import { SetProgressItem } from './SetProgressItem';
import { findBestLoadout } from '@/utils/LoadoutOptimizer';

interface InventoryProps {
	items: InventoryItem[]; // Uninstalled items
	installedItems: InventoryItem[]; // Installed on current car
	carName?: string;
	onEquip: (item: InventoryItem, coords: { x: number; y: number }) => void; // Install
	onRemove: (item: InventoryItem) => void; // Uninstall
	onSell: (item: InventoryItem) => void; // For Auction
	onDestroy: (item: InventoryItem) => void;
	onRepair: (item: InventoryItem, cost: number) => void;
	onMerge: (item1: InventoryItem, item2: InventoryItem) => void;
	onRepairAll: (items: InventoryItem[], cost: number) => void;
	onMergeAll: () => void;
	onRemoveAll: () => void;
	money: number;
	installedContainerRef?: React.RefObject<HTMLDivElement>;
}

export const Inventory: React.FC<InventoryProps> = ({
	items,
	installedItems,
	carName,
	onEquip,
	onRemove,
	onSell,
	onDestroy,
	onRepair,
	onMerge,
	onRepairAll,
	onMergeAll,
	onRemoveAll,
	money,
	installedContainerRef,
}) => {
	const [mergeSourceItem, setMergeSourceItem] =
		useState<InventoryItem | null>(null);
	const [mergeTargetItem, setMergeTargetItem] =
		useState<InventoryItem | null>(null);

	const [contextMenu, setContextMenu] = useState<{
		item: InventoryItem;
		isInstalled: boolean;
		x: number;
		y: number;
	} | null>(null);

	const [showRemoveAllConfirm, setShowRemoveAllConfirm] = useState(false);

	const calculateRepairCost = (item: InventoryItem) => {
		if (!item.condition || item.condition >= 100) return 0;
		// Cost = Value * Damage * Multiplier
		// E.g. $1000 item at 50% condition (0.5 damage) = $1000 * 0.5 * 0.5 = $250 to fix?
		// Let's make it relatively cheap to encourage maintenance.
		const damage = 100 - item.condition;

		return Math.floor(item.value * damage * 0.2); // 20% of value to fully repair from 0
	};

	const calculateRepairAllCost = (list?: InventoryItem[]) => {
		const targetList = list || items;
		return targetList.reduce((total, item) => {
			return total + calculateRepairCost(item);
		}, 0);
	};

	const [hoveredItem, setHoveredItem] = useState<InventoryItem | null>(null);
	const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
	const containerRef = useRef<HTMLDivElement>(null);

	// Sorting State
	type SortMethod = 'RECENT' | 'RARITY' | 'VALUE' | 'NAME';
	const [sortMethod, setSortMethod] = useState<SortMethod>('RECENT');
	const [sortDirection, setSortDirection] = useState<'ASC' | 'DESC'>('DESC');

	// Set Filter State
	const [selectedSetFilter, setSelectedSetFilter] = useState<string | null>(
		null
	);

	const COLS = 8;
	const ITEMS_PER_PAGE = 64;
	const [currentPage, setCurrentPage] = useState(1);

	// Auto-equip best configuration
	const handleApplyBest = async () => {
		// Find the best loadout
		const bestItems = findBestLoadout(items);

		if (bestItems.length === 0) return;

		// Equip all items simultaneously
		// The onEquip function returns XP gained, so we can collect them all
		const equipPromises = bestItems.map((item) =>
			onEquip(item, {
				x: window.innerWidth / 2,
				y: window.innerHeight / 2,
			})
		);

		// Wait for all equips to complete
		// This will trigger a combined XP animation in the parent component
		await Promise.all(equipPromises);
	};

	// Helper to sort items
	const sortItems = (items: InventoryItem[]) => {
		return [...items].sort((a, b) => {
			let res = 0;
			switch (sortMethod) {
				case 'RARITY':
					const rarityWeight = {
						COMMON: 1,
						UNCOMMON: 2,
						RARE: 3,
						EPIC: 4,
						LEGENDARY: 5,
						EXOTIC: 6,
					};
					res =
						(rarityWeight[a.rarity] || 0) -
						(rarityWeight[b.rarity] || 0);
					break;
				case 'VALUE':
					res = a.value - b.value;
					break;
				case 'NAME':
					res = a.name.localeCompare(b.name);
					break;
				case 'RECENT':
				default:
					// Assuming items are pushed in chronological order, index is proxy for time?
					// Or we can rely on ID if it has timestamp?
					// For now, let's assume original order is "Recent".
					// So actually, if we want "Recent" (Newest first), we might just reverse?
					// But if we return 0, stable sort preserves it.
					// Let's rely on array index.
					return sortDirection === 'DESC' ? -1 : 1;
			}
			return sortDirection === 'ASC' ? res : -res;
		});
	};

	// Helper to render a grid of items
	const renderGrid = (itemList: InventoryItem[], isInstalled: boolean) => {
		// Only sort uninstalled items if requested? Or both?
		// Usually sorting is most useful for the large uninstalled inventory.
		let sortedList = isInstalled ? itemList : sortItems(itemList);

		// Apply set filter if selected (only for uninstalled inventory)
		if (!isInstalled && selectedSetFilter) {
			const { ITEM_SETS } = require('@/constants');
			const selectedSet = ITEM_SETS.find(
				(s: any) => s.id === selectedSetFilter
			);
			if (selectedSet) {
				sortedList = sortedList.filter((item) =>
					selectedSet.requiredItemIds.includes(item.baseId)
				);
			}
		}

		// Pagination for uninstalled items only
		let displayList = sortedList;
		if (!isInstalled) {
			const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
			displayList = sortedList.slice(
				startIndex,
				startIndex + ITEMS_PER_PAGE
			);
		}

		const displaySlots = Math.max(displayList.length, 48); // Minimum rows
		const slots = Array(displaySlots)
			.fill(null)
			.map((_, i) => displayList[i] || null);

		// Get active sets for visual indicators (only for installed items)
		const { SetBonus } = require('@/utils/SetBonus');
		const activeSets = isInstalled
			? SetBonus.getActiveSets(installedItems)
			: [];

		return (
			<div
				className="grid gap-2"
				style={{
					gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
				}}
			>
				{slots.map((item, index) => {
					const canMerge =
						mergeSourceItem &&
						item &&
						ItemMerge.canMerge(mergeSourceItem, item);
					const isDimmed =
						mergeSourceItem &&
						!canMerge &&
						item !== mergeSourceItem;
					const isMergeSource =
						mergeSourceItem && item && mergeSourceItem === item;

					// Check if this item is part of an active set
					const itemInActiveSet =
						item && isInstalled
							? activeSets.find((set) =>
									set.requiredItemIds.includes(item.baseId)
							  )
							: null;

					return (
						<ItemCard
							key={index}
							item={item}
							onClick={(e) =>
								item && handleItemClick(e, item, isInstalled)
							}
							onMouseEnter={() => item && setHoveredItem(item)}
							onMouseLeave={() => setHoveredItem(null)}
							isSelected={
								contextMenu?.item === item || isMergeSource
							}
							showCondition={true}
							isInActiveSet={!!itemInActiveSet}
							activeSetColor={itemInActiveSet?.color}
							className={
								isDimmed
									? 'opacity-20 grayscale'
									: isMergeSource
									? 'ring-2 ring-yellow-500 animate-pulse'
									: ''
							}
						/>
					);
				})}
			</div>
		);
	};

	const handleItemClick = (
		e: React.MouseEvent,
		item: InventoryItem,
		isInstalled: boolean
	) => {
		e.stopPropagation();

		// Merge Logic
		if (mergeSourceItem) {
			if (item === mergeSourceItem) {
				// Clicked self, cancel? Or ignore?
				setMergeSourceItem(null);
				return;
			}
			if (ItemMerge.canMerge(mergeSourceItem, item) && !isInstalled) {
				// Valid target
				setMergeTargetItem(item);
			} else {
				// Invalid target
				// checking !isInstalled because prompt says "Only allow the player to merge parts in the inventory section"
				// Wait, can source be installed? "Only allow ... in the inventory section".
				// Implies both must be uninstalled.
				// I'll enforce !isInstalled for target.
				// Source selection is likely enforced via context menu availability.
			}
			return; // Don't match context menu if selecting for merge
		}

		setContextMenu({ item, isInstalled, x: e.clientX, y: e.clientY });
	};

	const handleBackgroundClick = () => {
		setContextMenu(null);
	};

	const handleMouseMove = (e: React.MouseEvent) => {
		setMousePos({ x: e.clientX, y: e.clientY });
	};

	return (
		<div
			ref={containerRef}
			onMouseMove={handleMouseMove}
			onClick={handleBackgroundClick}
			className="w-full h-full flex flex-col gap-2"
		>
			{/* Top Panel: Inventory */}
			<div className="flex-1 bg-gray-900/90 p-4 rounded-lg relative flex flex-col overflow-hidden">
				<h2 className="text-xl font-bold text-white pixel-text mb-2 flex justify-between items-center bg-black/40 p-2 rounded">
					<span>INVENTORY</span>
					<span className="text-xs text-gray-500 font-sans tracking-normal">
						{items.length} parts
					</span>
				</h2>

				{/* Sort Controls */}
				<div className="flex gap-2 mb-2 px-2">
					<span className="text-xs text-gray-500 self-center mr-2">
						SORT:
					</span>
					{(
						['RECENT', 'RARITY', 'VALUE', 'NAME'] as SortMethod[]
					).map((method) => (
						<button
							key={method}
							onClick={() => {
								if (sortMethod === method) {
									setSortDirection((prev) =>
										prev === 'ASC' ? 'DESC' : 'ASC'
									);
								} else {
									setSortMethod(method);
									setSortDirection('DESC');
								}
							}}
							className={`
                                px-2 py-1 text-[10px] uppercase font-bold rounded border
                                ${
									sortMethod === method
										? 'bg-indigo-600 border-indigo-400 text-white'
										: 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'
								}
                            `}
						>
							{method}{' '}
							{sortMethod === method &&
								(sortDirection === 'ASC' ? '▲' : '▼')}
						</button>
					))}
				</div>

				{/* Set Filter */}
				{(() => {
					const { ITEM_SETS } = require('@/constants');
					return (
						<div className="flex gap-2 mb-2 px-2 items-center">
							<span className="text-xs text-gray-500">
								SET FILTER:
							</span>
							<select
								value={selectedSetFilter || ''}
								onChange={(e) => {
									setSelectedSetFilter(
										e.target.value || null
									);
									setCurrentPage(1); // Reset to first page
								}}
								className="px-2 py-1 text-[10px] uppercase font-bold rounded border bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700 cursor-pointer"
							>
								<option value="">ALL ITEMS</option>
								{ITEM_SETS.map((set: any) => (
									<option key={set.id} value={set.id}>
										{set.name}
									</option>
								))}
							</select>
							{selectedSetFilter && (
								<button
									onClick={() => {
										setSelectedSetFilter(null);
										setCurrentPage(1);
									}}
									className="px-2 py-1 text-[9px] bg-red-900/50 border border-red-700 text-red-400 rounded hover:bg-red-800 font-bold"
								>
									✕ CLEAR
								</button>
							)}
						</div>
					);
				})()}

				{/* Bulk Operations Buttons - Only for uninstalled inventory */}
				<div className="flex gap-2 mb-2 px-2">
					<button
						onClick={() => {
							const cost = calculateRepairAllCost(items);
							if (cost > 0) {
								onRepairAll(items, cost);
							}
						}}
						disabled={calculateRepairAllCost(items) === 0}
						className={`flex-1 py-2 text-xs font-bold font-pixel border-2 transition-all ${
							calculateRepairAllCost(items) > 0
								? 'bg-green-900/50 border-green-600 text-green-400 hover:bg-green-800 hover:text-white cursor-pointer'
								: 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed'
						}`}
					>
						REPAIR ALL ($
						{calculateRepairAllCost(items).toLocaleString()})
					</button>

					<button
						onClick={() => {
							onMergeAll();
							setCurrentPage(1);
						}}
						className="flex-1 py-2 text-xs font-bold font-pixel border-2 bg-purple-900/50 border-purple-600 text-purple-400 hover:bg-purple-800 hover:text-white transition-all cursor-pointer"
					>
						MERGE ALL (RECURSIVE)
					</button>

					<button
						onClick={handleApplyBest}
						disabled={items.length === 0}
						className={`flex-1 py-2 text-xs font-bold font-pixel border-2 transition-all ${
							items.length > 0
								? 'bg-blue-900/50 border-blue-600 text-blue-400 hover:bg-blue-800 hover:text-white cursor-pointer'
								: 'bg-gray-900 border-gray-800 text-gray-600 cursor-not-allowed'
						}`}
					>
						⚡ AUTO-EQUIP BEST
					</button>
				</div>

				{/* Pagination Controls */}
				{items.length > ITEMS_PER_PAGE && (
					<div className="flex justify-between items-center px-2 mb-2">
						<button
							onClick={() =>
								setCurrentPage((p) => Math.max(1, p - 1))
							}
							disabled={currentPage === 1}
							className="px-2 py-1 text-xs bg-gray-800 text-white rounded disabled:opacity-50 hover:bg-gray-700"
						>
							◀ PREV
						</button>
						<span className="text-xs text-gray-400">
							Page {currentPage} of{' '}
							{Math.ceil(items.length / ITEMS_PER_PAGE)}
						</span>
						<button
							onClick={() =>
								setCurrentPage((p) =>
									Math.min(
										Math.ceil(
											items.length / ITEMS_PER_PAGE
										),
										p + 1
									)
								)
							}
							disabled={
								currentPage >=
								Math.ceil(items.length / ITEMS_PER_PAGE)
							}
							className="px-2 py-1 text-xs bg-gray-800 text-white rounded disabled:opacity-50 hover:bg-gray-700"
						>
							NEXT ▶
						</button>
					</div>
				)}

				<div className="flex-1 overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
					{renderGrid(items, false)}
				</div>
			</div>

			{/* Bottom Panel: Installed Mods */}
			<div
				ref={installedContainerRef}
				className="h-1/2 bg-gray-900/90 p-4 rounded-lg relative flex flex-col overflow-hidden border-t-2 border-indigo-900/50"
			>
				<h2 className="text-lg font-bold text-indigo-400 pixel-text mb-2 flex justify-between items-center bg-indigo-900/20 p-2 rounded">
					<span>
						INSTALLED ON {carName ? carName.toUpperCase() : 'CAR'}
					</span>
					<span className="text-xs text-indigo-300 font-sans tracking-normal">
						{installedItems.length} parts
					</span>
				</h2>

				{/* Installed Repair All */}
				<div className="flex gap-2 mb-2 px-2">
					<button
						onClick={() => {
							const cost = calculateRepairAllCost(installedItems);
							if (cost > 0) {
								onRepairAll(installedItems, cost);
							}
						}}
						disabled={calculateRepairAllCost(installedItems) === 0}
						className={`flex-1 py-1 text-[10px] font-bold font-pixel border transition-all ${
							calculateRepairAllCost(installedItems) > 0
								? 'bg-green-900/30 border-green-700 text-green-400 hover:bg-green-900 hover:text-white cursor-pointer'
								: 'bg-gray-900/30 border-gray-800 text-gray-700 cursor-not-allowed'
						}`}
					>
						REPAIR INSTALLED ($
						{calculateRepairAllCost(
							installedItems
						).toLocaleString()}
						)
					</button>

					<button
						onClick={() => setShowRemoveAllConfirm(true)}
						disabled={installedItems.length === 0}
						className={`flex-1 py-1 text-[10px] font-bold font-pixel border transition-all ${
							installedItems.length > 0
								? 'bg-red-900/30 border-red-700 text-red-400 hover:bg-red-900 hover:text-white cursor-pointer'
								: 'bg-gray-900/30 border-gray-800 text-gray-700 cursor-not-allowed'
						}`}
					>
						REMOVE ALL
					</button>
				</div>

				{/* Set Completion Tracker */}
				{/* {(() => {
					const { SetBonus } = require('@/utils/SetBonus');
					const { ITEM_SETS } = require('@/constants');

					// Get only INSTALLED item IDs (what's equipped on this car)
					// Use Set to ensure unique IDs
					const installedBaseIds = Array.from(
						new Set(installedItems.map((i) => i.baseId))
					);

					// Calculate completion for each set based on installed items only
					const setProgress = ITEM_SETS.map((set: any) => {
						const installedCount = set.requiredItemIds.filter(
							(id: string) => installedBaseIds.includes(id)
						).length;
						const total = set.requiredItemIds.length;
						const percentage = (installedCount / total) * 100;
						const isComplete = installedCount === total;

						return {
							set,
							installedCount,
							total,
							percentage,
							isComplete,
						};
					});

					// Filter to sets with installed items and sort by completion percentage (highest first)
					const setsWithProgress = setProgress
						.filter((sp: any) => sp.installedCount > 0)
						.sort((a: any, b: any) => b.percentage - a.percentage);

					if (setsWithProgress.length === 0) return null;

					return (
						<div className="mb-2 px-2">
							<div className="text-[9px] uppercase font-bold text-gray-500 mb-1 tracking-wider">
								⚡ Set Progress
							</div>
							<div className="flex flex-col gap-1 max-h-24 overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-gray-800 [&::-webkit-scrollbar-thumb]:bg-gray-600 [&::-webkit-scrollbar-thumb]:rounded">
								{setsWithProgress.map((setData: any) => (
									<SetProgressItem
										key={setData.set.id}
										setData={setData}
									/>
								))}
							</div>
						</div>
					);
				})()} */}

				<div className="flex-1 overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
					{renderGrid(installedItems, true)}
				</div>
			</div>

			{contextMenu && (
				<div
					className="fixed z-[110] flex flex-col gap-1 p-1 bg-black/90 border border-gray-500 rounded shadow-xl animate-in fade-in zoom-in-95 duration-100"
					style={{
						left: Math.min(contextMenu.x, window.innerWidth - 180),
						top: Math.min(contextMenu.y, window.innerHeight - 150),
						minWidth: '140px',
					}}
					onClick={(e) => e.stopPropagation()}
				>
					<div
						className="px-2 py-1 text-xs font-bold uppercase border-b border-gray-700 mb-1"
						style={{
							color: ItemGenerator.getRarityColor(
								contextMenu.item.rarity
							),
						}}
					>
						{contextMenu.item.name}
					</div>

					{!contextMenu.isInstalled && (
						<button
							onClick={() => {
								setMergeSourceItem(contextMenu.item);
								setContextMenu(null);
							}}
							// Initial check if there are others? User prompt says "disabled if there are no others".
							// I'll leave enabled for simplicity or check:
							disabled={
								!items.some(
									(i) =>
										i !== contextMenu.item &&
										ItemMerge.canMerge(contextMenu.item, i)
								)
							}
							className={`text-left px-2 py-1.5 text-xs font-bold rounded flex items-center gap-2 ${
								!items.some(
									(i) =>
										i !== contextMenu.item &&
										ItemMerge.canMerge(contextMenu.item, i)
								)
									? 'text-gray-600 cursor-not-allowed'
									: 'hover:bg-purple-600 text-white'
							}`}
						>
							<span>🧬</span> MERGE
						</button>
					)}

					{contextMenu.isInstalled ? (
						<button
							onClick={() => {
								onRemove(contextMenu.item);
								setContextMenu(null);
							}}
							className="text-left px-2 py-1.5 hover:bg-orange-600 text-white text-xs font-bold rounded flex items-center gap-2"
						>
							<span>⬇️</span> REMOVE
						</button>
					) : (
						<button
							onClick={() => {
								onEquip(contextMenu.item, {
									x: contextMenu.x,
									y: contextMenu.y,
								});
								setContextMenu(null);
							}}
							className="text-left px-2 py-1.5 hover:bg-blue-600 text-white text-xs font-bold rounded flex items-center gap-2"
						>
							<span>⬆️</span> INSTALL
						</button>
					)}

					{/* Repair Button */}
					{contextMenu.item.condition !== undefined &&
						contextMenu.item.condition < 100 && (
							<button
								onClick={() => {
									const cost = calculateRepairCost(
										contextMenu.item
									);
									onRepair(contextMenu.item, cost);
									setContextMenu(null);
								}}
								disabled={
									money <
									calculateRepairCost(contextMenu.item)
								}
								className={`text-left px-2 py-1.5 text-xs font-bold rounded flex items-center justify-between gap-2 ${
									money >=
									calculateRepairCost(contextMenu.item)
										? 'hover:bg-green-600 text-white'
										: 'text-gray-500 cursor-not-allowed'
								}`}
							>
								<div className="flex items-center gap-2">
									<span>🔧</span> REPAIR
								</div>
								<span
									className={
										money >=
										calculateRepairCost(contextMenu.item)
											? 'text-green-300'
											: 'text-red-500'
									}
								>
									${calculateRepairCost(contextMenu.item)}
								</span>
							</button>
						)}

					{!contextMenu.isInstalled && (
						<button
							onClick={() => {
								onSell(contextMenu.item);
								setContextMenu(null);
							}}
							className="text-left px-2 py-1.5 hover:bg-yellow-600 text-white text-xs font-bold rounded flex items-center gap-2"
						>
							<span>💰</span> AUCTION
						</button>
					)}
					{!contextMenu.isInstalled && (
						<button
							onClick={() => {
								onDestroy(contextMenu.item);
								setContextMenu(null);
							}}
							className="text-left px-2 py-1.5 hover:bg-red-900 text-red-200 hover:text-white text-xs font-bold rounded flex items-center gap-2"
						>
							<span>🗑️</span> DESTROY
						</button>
					)}
				</div>
			)}

			{hoveredItem && !contextMenu && (
				<div
					className="fixed z-[200] w-80 bg-black/95 border-2 p-5 rounded-lg shadow-2xl pointer-events-none animate-in fade-in duration-75"
					style={{
						left:
							mousePos.x + 280 > window.innerWidth
								? mousePos.x - 270
								: mousePos.x + 15,
						top:
							mousePos.y + 400 > window.innerHeight
								? undefined
								: mousePos.y + 15,
						bottom:
							mousePos.y + 400 > window.innerHeight
								? window.innerHeight - mousePos.y + 15
								: undefined,
						borderColor: ItemGenerator.getRarityColor(
							hoveredItem.rarity
						),
					}}
				>
					<div
						className="text-xl font-bold pixel-text mb-2 tracking-wide"
						style={{
							color: ItemGenerator.getRarityColor(
								hoveredItem.rarity
							),
						}}
					>
						{hoveredItem.name}
					</div>
					<div className="text-xs font-bold uppercase tracking-widest mb-3 text-gray-400">
						{hoveredItem.rarity} {hoveredItem.type} Part
					</div>

					<p className="text-sm text-gray-200 mb-4 leading-relaxed border-b border-gray-700 pb-3 font-medium">
						{hoveredItem.description}
					</p>

					{/* Set Information */}
					{(() => {
						const { SetBonus } = require('@/utils/SetBonus');
						const itemSets = SetBonus.getSetsForItem(
							hoveredItem.baseId
						);

						if (itemSets.length === 0) return null;

						const activeSets = SetBonus.getActiveSets([
							...installedItems,
							...items,
						]);

						return (
							<div className="mb-4 pb-3 border-b border-gray-700">
								<div className="text-xs font-bold uppercase tracking-wider text-purple-400 mb-2">
									⚡ Item Sets
								</div>
								{itemSets.map((set) => {
									const isActive = activeSets.some(
										(s) => s.id === set.id
									);
									const installedCount =
										set.requiredItemIds.filter((id) =>
											[...installedItems, ...items].some(
												(item) => item.baseId === id
											)
										).length;

									return (
										<div
											key={set.id}
											className="mb-2 last:mb-0"
										>
											<div
												className="flex items-center gap-2 mb-1"
												style={{
													color: isActive
														? set.color || '#FFD700'
														: '#666',
												}}
											>
												<span className="text-xs font-bold">
													{isActive && '✓ '}
													{set.name}
												</span>
												<span className="text-[10px] text-gray-500">
													({installedCount}/
													{set.requiredItemIds.length}
													)
												</span>
											</div>
											{isActive && (
												<div className="text-[10px] text-green-400 italic">
													Set Active! Bonuses Applied
												</div>
											)}
											{!isActive && (
												<div className="text-[10px] text-gray-600">
													{set.description}
												</div>
											)}
										</div>
									);
								})}
							</div>
						);
					})()}

					<div className="space-y-1">
						{Object.entries(hoveredItem.stats).map(
							([key, val]: [string, any]) => {
								if (typeof val === 'object') return null;

								const degradableStats = [
									'maxTorque',
									'tireGrip',
									'brakingForce',
									'turboIntensity',
									'dragCoefficient',
								];
								const isDegradable =
									degradableStats.includes(key);
								const rawCondition =
									hoveredItem.condition ?? 100;
								const conditionFactor =
									rawCondition > 1
										? rawCondition / 100
										: rawCondition;

								let displayVal = val;
								let penaltyText = null;

								if (
									isDegradable &&
									conditionFactor < 1 &&
									typeof val === 'number'
								) {
									displayVal = val * conditionFactor;
									// Round logic: integer for large numbers, decimals for small
									if (Math.abs(displayVal) >= 10) {
										displayVal = Math.round(displayVal);
									} else {
										displayVal = parseFloat(
											displayVal.toFixed(2)
										);
									}

									const lostPercent = Math.round(
										(1 - conditionFactor) * 100
									);
									if (lostPercent > 0)
										penaltyText = `(-${lostPercent}%)`;
								}

								return (
									<div
										key={key}
										className="flex justify-between text-sm font-mono py-0.5"
									>
										<span className="text-gray-400 capitalize">
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
										<div className="flex gap-2">
											<span className="text-cyan-400">
												{typeof displayVal ===
													'number' && displayVal > 0
													? '+'
													: ''}
												{displayVal.toFixed(2)}
											</span>
											{penaltyText && (
												<span className="text-red-500">
													{penaltyText}
												</span>
											)}
										</div>
									</div>
								);
							}
						)}
					</div>
					<div className="mt-4 pt-3 border-t border-gray-700 flex justify-between text-sm font-bold font-mono">
						<span className="text-gray-500">Value</span>
						<span className="text-green-400">
							${hoveredItem.value.toLocaleString()}
						</span>
					</div>
				</div>
			)}
			{mergeTargetItem && mergeSourceItem && (
				<div
					className="absolute inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm"
					onClick={() => {
						setMergeTargetItem(null);
						setMergeSourceItem(null);
					}}
				>
					<div
						className="bg-gray-900 border-2 border-yellow-500 rounded p-6 shadow-2xl animate-in zoom-in-95 flex flex-col gap-4 min-w-[350px]"
						onClick={(e) => e.stopPropagation()}
					>
						<div className="text-center">
							<h3 className="text-xl font-bold text-white mb-1 pixel-text">
								MERGE PARTS?
							</h3>
							<div className="text-gray-400 text-xs">
								Merge to create:
								<div className="flex flex-col gap-1 mt-1">
									{ItemMerge.getMergeProbabilities(
										mergeSourceItem.rarity,
										mergeTargetItem.rarity
									).map((p) => (
										<div
											key={p.rarity}
											className="flex items-center justify-center gap-2 text-xs"
										>
											<span
												style={{
													color: ItemGenerator.getRarityColor(
														p.rarity as any
													),
												}}
											>
												{p.rarity}
											</span>
											<span className="text-gray-400">
												{Math.round(p.chance * 100)}%
											</span>
										</div>
									))}
								</div>
							</div>
						</div>

						<div className="flex items-center justify-center gap-4 bg-black/40 p-4 rounded-lg">
							<ItemCard
								item={mergeSourceItem}
								className="w-20 h-20"
								showCondition={true}
								onMouseEnter={() =>
									mergeSourceItem &&
									setHoveredItem(mergeSourceItem)
								}
								onMouseLeave={() => setHoveredItem(null)}
							/>
							<span className="text-2xl font-bold text-yellow-400">
								+
							</span>
							<ItemCard
								item={mergeTargetItem}
								className="w-20 h-20"
								showCondition={true}
								onMouseEnter={() =>
									mergeTargetItem &&
									setHoveredItem(mergeTargetItem)
								}
								onMouseLeave={() => setHoveredItem(null)}
							/>
						</div>

						<div className="text-xs text-gray-500 text-center italic">
							Warning: Both items will be consumed.
						</div>

						<div className="flex gap-2">
							<button
								onClick={() => {
									onMerge(mergeSourceItem, mergeTargetItem);
									setMergeTargetItem(null);
									setMergeSourceItem(null);
								}}
								className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded pixel-text"
							>
								MERGE
							</button>
							<button
								onClick={() => {
									setMergeTargetItem(null);
									setMergeSourceItem(null);
								}}
								className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded pixel-text"
							>
								CANCEL
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Remove All Confirmation Modal */}
			{showRemoveAllConfirm && (
				<div
					className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center p-4 animate-in fade-in duration-200"
					onClick={() => setShowRemoveAllConfirm(false)}
				>
					<div
						className="bg-gray-900 border-2 border-red-600 rounded p-6 shadow-2xl max-w-sm w-full text-center"
						onClick={(e) => e.stopPropagation()}
					>
						<h3 className="text-xl font-bold text-red-500 mb-2 pixel-text">
							REMOVE ALL PARTS?
						</h3>
						<p className="text-gray-300 mb-6 text-sm">
							This will unequip all {installedItems.length} items
							from your car and return them to your inventory.
						</p>
						<p className="text-gray-500 mb-6 text-xs italic">
							Your car tuning stats will drop significantly.
						</p>

						<div className="flex gap-4">
							<button
								onClick={() => {
									onRemoveAll();
									setShowRemoveAllConfirm(false);
								}}
								className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded pixel-text"
							>
								REMOVE ALL
							</button>
							<button
								onClick={() => setShowRemoveAllConfirm(false)}
								className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded pixel-text"
							>
								CANCEL
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};
