import React, { useState, useMemo, useRef } from 'react';
import { XPFloatingText } from '../shared/XPFloatingText';
import { FloatingItem } from '../shared/FloatingItem';
import DynoGraph from './DynoGraph';
import DynoTab from './DynoTab';
// import UpgradesTab from './UpgradesTab';
import TuningTab from './TuningTab';
import { Inventory } from '../inventory/Inventory';
import {
	calculatePerformanceRating,
	getRatingClass,
} from '../../../utils/PerformanceRating';
import { CarBuilder } from '../../../utils/CarBuilder';
import { BASE_TUNING } from '../../../constants';
import {
	ModNode,
	TuningState,
	SavedTune,
	InventoryItem,
	ModSettings,
	GamePhase,
} from '../../../types';

interface GarageProps {
	money: number;
	garage: SavedTune[];
	currentCarIndex: number;
	setCurrentCarIndex: (index: number) => void;
	playerTuning: TuningState;
	setPlayerTuning: React.Dispatch<React.SetStateAction<TuningState>>;
	effectiveTuning: TuningState;
	ownedMods: string[];
	setOwnedMods: React.Dispatch<React.SetStateAction<string[]>>;
	disabledMods: string[];
	setDisabledMods: React.Dispatch<React.SetStateAction<string[]>>;
	modSettings: ModSettings;
	setModSettings: (settings: ModSettings) => void;
	dynoHistory: any[];
	setDynoHistory: React.Dispatch<React.SetStateAction<any[]>>;
	previousDynoHistory: any[];
	onDynoRunStart: () => void;
	onLoadTune: (tune: SavedTune) => void;
	onBuyMods: (mods: ModNode[]) => void;
	onBack: () => void;
	userInventory: InventoryItem[];
	onEquip: (item: InventoryItem) => Promise<number>;
	onRemove: (item: InventoryItem) => void;
	onSell: (item: InventoryItem) => void;
	onDestroy: (item: InventoryItem) => void;
	onRestoreCar: (index: number) => void;
	onRepair: (item: InventoryItem, cost: number) => void;
	onScrapCar: (index: number) => void;
	onMerge: (item1: InventoryItem, item2: InventoryItem) => void;
	onRepairAll: (items: InventoryItem[], cost: number) => void;
	onMergeAll: () => void;
	onRemoveAll: () => void;
	onTestTrack: () => void;
}

export const Garage: React.FC<GarageProps> = ({
	money,
	garage,
	currentCarIndex,
	setCurrentCarIndex,
	playerTuning,
	setPlayerTuning,
	effectiveTuning,
	ownedMods,
	setOwnedMods,
	disabledMods,
	setDisabledMods,
	modSettings,
	setModSettings,
	dynoHistory,
	setDynoHistory,
	previousDynoHistory,
	onDynoRunStart,
	onLoadTune,
	onBuyMods,
	onBack,
	userInventory,
	onEquip,
	onRemove,
	onSell,
	onDestroy,
	onRestoreCar,
	onScrapCar,
	onRepair,
	onMerge,
	onRepairAll,
	onMergeAll,
	onRemoveAll,
	onTestTrack,
}) => {
	const [activeTab, setActiveTab] = useState<'TUNING' | 'DYNO' | 'CARS'>(
		'TUNING'
	);
	const [hoveredMod, setHoveredMod] = useState<ModNode | null>(null);
	const [contextMenu, setContextMenu] = useState<{
		index: number;
		x: number;
		y: number;
	} | null>(null);

	const [xpAnimations, setXpAnimations] = useState<
		{
			id: string;
			startX: number;
			startY: number;
			endX: number;
			endY: number;
			amount: number;
		}[]
	>([]);

	const masteryBarRef = useRef<HTMLDivElement>(null);
	const installedContainerRef = useRef<HTMLDivElement>(null);

	const [partAnimations, setPartAnimations] = useState<
		{
			id: string;
			item: InventoryItem;
			startX: number;
			startY: number;
			endX: number;
			endY: number;
		}[]
	>([]);

	// Pending XP accumulator for batch processing
	const xpBatchTimerRef = useRef<NodeJS.Timeout | null>(null);
	const pendingXpRef = useRef<number>(0);
	const batchCoordsRef = useRef<{ x: number; y: number } | null>(null);

	const handleEquipWrapper = async (
		item: InventoryItem,
		coords?: { x: number; y: number }
	) => {
		const xp = await onEquip(item);
		if (coords) {
			// Part Animation
			if (installedContainerRef.current) {
				const containerRect =
					installedContainerRef.current.getBoundingClientRect();
				const id = Math.random().toString(36).substr(2, 9);
				setPartAnimations((prev) => [
					...prev,
					{
						id,
						item,
						startX: coords.x,
						startY: coords.y,
						endX: containerRect.left + containerRect.width / 2,
						endY: containerRect.top + 40,
					},
				]);
			}

			// Batched XP Animation
			if (xp > 0 && masteryBarRef.current) {
				// Accumulate XP for batching
				pendingXpRef.current += xp;
				batchCoordsRef.current = coords;

				// Clear existing timer
				if (xpBatchTimerRef.current) {
					clearTimeout(xpBatchTimerRef.current);
				}

				// Set a new timer to flush the batch
				xpBatchTimerRef.current = setTimeout(() => {
					const totalXp = pendingXpRef.current;
					const batchCoords = batchCoordsRef.current;

					if (totalXp > 0 && batchCoords && masteryBarRef.current) {
						const barRect =
							masteryBarRef.current.getBoundingClientRect();
						const id = Math.random().toString(36).substr(2, 9);
						setXpAnimations((prev) => [
							...prev,
							{
								id,
								startX: batchCoords.x,
								startY: batchCoords.y,
								endX: barRect.left + barRect.width / 2,
								endY: barRect.top + barRect.height / 2,
								amount: totalXp,
							},
						]);
					}

					// Reset batch state
					pendingXpRef.current = 0;
					batchCoordsRef.current = null;
					xpBatchTimerRef.current = null;
				}, 150); // 150ms batch window - allows multiple equips to be grouped
			}
		}
	};

	// Calculate preview tuning for hover
	const previewTuning = useMemo(() => {
		if (!hoveredMod) return null;

		const previewOwnedMods = [...ownedMods];
		if (!previewOwnedMods.includes(hoveredMod.id)) {
			previewOwnedMods.push(hoveredMod.id);
		}

		// Prepare base tuning from current car
		let baseTuning = BASE_TUNING;
		if (garage[currentCarIndex]) {
			baseTuning = {
				...BASE_TUNING,
				...garage[currentCarIndex].manualTuning,
			};
		}

		return CarBuilder.calculateTuning(
			baseTuning,
			previewOwnedMods,
			disabledMods,
			modSettings,
			garage[currentCarIndex]?.installedItems || [],
			garage[currentCarIndex]?.masteryLevel || 0
		);
	}, [
		hoveredMod,
		ownedMods,
		disabledMods,
		modSettings,
		garage,
		currentCarIndex,
	]);

	const renderParticles = (rarity: string) => {
		if (rarity !== 'LEGENDARY' && rarity !== 'EXOTIC') return null;

		const particleCount = rarity === 'EXOTIC' ? 16 : 12;
		const particles = [];

		for (let i = 0; i < particleCount; i++) {
			let style: React.CSSProperties = {};
			const delay = Math.random() * 2;
			const duration = 1.5 + Math.random();

			const side = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
			const pos = Math.random() * 100;
			const size = 3 + Math.random() * 3;

			switch (side) {
				case 0: // Top
					style = { top: '-6px', left: `${pos}%` };
					break;
				case 1: // Right
					style = { right: '-6px', top: `${pos}%` };
					break;
				case 2: // Bottom
					style = { bottom: '-6px', left: `${pos}%` };
					break;
				case 3: // Left
					style = { left: '-6px', top: `${pos}%` };
					break;
			}

			if (rarity === 'EXOTIC') {
				style = {
					...style,
					width: `${size}px`,
					height: `${size}px`,
					backgroundColor: '#f472b6', // Pink-400
					animationName: 'twinkle',
					animationDuration: `${duration}s`,
					animationDelay: `${delay}s`,
					boxShadow: '0 0 4px #ec4899',
				};
			} else {
				// Legendary (Gold)
				style = {
					...style,
					width: `${size}px`,
					height: `${size}px`,
					backgroundColor: '#fbbf24', // Gold
					animationName: 'twinkle',
					animationDuration: `${duration}s`,
					animationDelay: `${delay}s`,
					boxShadow: '0 0 4px #d97706',
				};
			}

			particles.push(
				<div key={i} className="pixel-particle" style={style} />
			);
		}

		return <>{particles}</>;
	};

	return (
		<div className="w-full h-full flex flex-col">
			{/* Garage Header */}
			<div className="w-full bg-gray-900/50 border-b border-gray-800 p-2 text-center">
				<h2 className="text-xl text-gray-400 pixel-text tracking-widest">
					MOD SHOP
				</h2>
			</div>
			<div className="flex-1 flex overflow-hidden">
				<div className="w-1/3 bg-black/30 p-6 border-r-4 border-gray-800 overflow-y-auto no-scrollbar">
					<h3 className="text-sm text-gray-300 mb-4 pixel-text">
						DYNO GRAPH
					</h3>
					<div className="h-[280px] w-full bg-black/50 mb-6 pixel-panel p-2">
						<DynoGraph
							tuning={effectiveTuning} // Use effective tuning for Dyno
							previewTuning={previewTuning}
							liveData={dynoHistory}
							previousData={previousDynoHistory}
						/>
					</div>

					{/* Test Track Button */}
					<button
						onClick={onTestTrack}
						disabled
						className="w-full py-3 mb-6 bg-indigo-900/80 hover:bg-indigo-700 text-indigo-100 font-bold pixel-btn border border-indigo-500/50 flex items-center justify-center gap-2"
					>
						<span>🏁</span> TEST & TUNE TRACK
					</button>

					<div className="flex gap-2 mb-4">
						<button
							onClick={() => setActiveTab('TUNING')}
							className={`flex-1 py-3 text-[10px] pixel-btn ${
								activeTab === 'TUNING'
									? ''
									: 'bg-gray-700 opacity-50'
							}`}
							style={{
								backgroundColor:
									activeTab === 'TUNING'
										? undefined
										: '#374151',
							}}
						>
							TUNE
						</button>
						<button
							onClick={() => setActiveTab('DYNO')}
							className={`flex-1 py-3 text-[10px] pixel-btn ${
								activeTab === 'DYNO'
									? ''
									: 'bg-gray-700 opacity-50'
							}`}
							style={{
								backgroundColor:
									activeTab === 'DYNO'
										? undefined
										: '#374151',
							}}
						>
							DYNO
						</button>
						<button
							onClick={() => setActiveTab('CARS')}
							className={`flex-1 py-3 text-[10px] pixel-btn ${
								activeTab === 'CARS'
									? ''
									: 'bg-gray-700 opacity-50'
							}`}
							style={{
								backgroundColor:
									activeTab === 'CARS'
										? undefined
										: '#374151',
							}}
						>
							CARS
						</button>
					</div>

					{activeTab === 'TUNING' ? (
						<TuningTab
							ownedMods={ownedMods}
							disabledMods={disabledMods}
							modSettings={modSettings}
							setModSettings={setModSettings}
							playerTuning={playerTuning}
							setPlayerTuning={setPlayerTuning}
							onLoadTune={onLoadTune}
							onBuyMods={onBuyMods}
							money={money}
							baseTuning={
								garage[currentCarIndex]
									? {
											...BASE_TUNING,
											...garage[currentCarIndex]
												.manualTuning,
									  }
									: BASE_TUNING
							}
						/>
					) : activeTab === 'DYNO' ? (
						<DynoTab
							playerTuning={effectiveTuning}
							onUpdateHistory={setDynoHistory}
							onRunStart={onDynoRunStart}
						/>
					) : (
						<div className="flex flex-col gap-4">
							{garage.map((car, index) => {
								const rarity = car.rarity || 'COMMON';
								let borderColor =
									index === currentCarIndex
										? 'border-indigo-500'
										: 'border-gray-800 hover:border-gray-500';
								let rarityColor = 'text-white';
								let badgeBg = 'bg-gray-800 text-gray-300';

								// Override border for special rarities if not active
								if (index !== currentCarIndex) {
									switch (rarity) {
										case 'UNCOMMON':
											borderColor =
												'border-green-900/50 hover:border-green-500';
											rarityColor = 'text-green-400';
											badgeBg =
												'bg-green-900/80 text-green-200';
											break;
										case 'RARE':
											borderColor =
												'border-blue-900/50 hover:border-blue-500';
											rarityColor = 'text-blue-400';
											badgeBg =
												'bg-blue-900/80 text-blue-200';
											break;
										case 'EPIC':
											borderColor =
												'border-purple-900/50 hover:border-purple-500';
											rarityColor = 'text-purple-400';
											badgeBg =
												'bg-purple-900/80 text-purple-200';
											break;
										case 'LEGENDARY':
											borderColor =
												'rarity-legendary border-transparent';
											rarityColor = 'text-yellow-400';
											badgeBg =
												'bg-yellow-900/80 text-yellow-200 animate-pulse';
											break;
										case 'EXOTIC':
											borderColor =
												'rarity-exotic border-transparent';
											rarityColor = 'text-pink-400';
											badgeBg =
												'bg-pink-900/80 text-pink-200 animate-pulse font-bold tracking-wider';
											break;
									}
								}

								// Calculate Rating
								const tuning = CarBuilder.calculateTuning(
									{ ...BASE_TUNING, ...car.manualTuning },
									car.ownedMods,
									car.disabledMods,
									car.modSettings,
									car.installedItems,
									car.masteryLevel || 0
								);
								const rating =
									calculatePerformanceRating(tuning);
								const ratingClass = getRatingClass(rating);
								const ratingColor =
									{
										D: 'text-gray-400',
										C: 'text-green-400',
										B: 'text-blue-400',
										A: 'text-purple-400',
										S: 'text-yellow-400',
										R: 'text-red-500',
										X: 'text-pink-500',
									}[ratingClass] || 'text-gray-400';

								return (
									<div
										key={index}
										onClick={(e) => {
											e.stopPropagation();
											setContextMenu({
												index,
												x: e.clientX,
												y: e.clientY,
											});
										}}
										className={`pixel-panel p-4 cursor-pointer transition-all relative overflow-hidden ${borderColor} ${
											index === currentCarIndex
												? 'bg-gray-800'
												: 'bg-black/40 hover:bg-gray-900'
										}`}
									>
										{/* Rarity Glow */}
										{(rarity === 'LEGENDARY' ||
											rarity === 'EXOTIC') && (
											<div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shine pointer-events-none" />
										)}

										<div className="flex justify-between items-start mb-2">
											<div>
												<div className="flex items-center gap-2 mb-1">
													<span
														className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${badgeBg}`}
													>
														{rarity}
													</span>
													{index ===
														currentCarIndex && (
														<span className="text-[10px] text-indigo-400 font-bold">
															ACTIVE
														</span>
													)}
													{/* Mastery Badge */}
													{(car.masteryLevel || 0) >
														0 && (
														<span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-indigo-900/80 text-indigo-200 border border-indigo-500/30">
															LVL{' '}
															{car.masteryLevel}
														</span>
													)}
												</div>
												<div
													className={`font-bold text-sm ${rarityColor}`}
												>
													{car.name}
													{/* Master Title */}
													{(car.masteryLevel || 0) >=
														50 && (
														<span className="ml-2 text-[10px] text-yellow-500 font-bold border border-yellow-500/30 px-1 rounded bg-yellow-900/20">
															MASTER
														</span>
													)}
												</div>
												{/* Mastery Progress Bar */}
												{(car.masteryLevel || 0) >=
													0 && (
													<div
														ref={
															index ===
															currentCarIndex
																? masteryBarRef
																: null
														}
														className="w-full h-1 bg-gray-800 rounded-full mt-1 overflow-hidden"
													>
														<div
															className="h-full bg-indigo-500"
															style={{
																width: `${
																	((car.masteryXP ||
																		0) /
																		((car.masteryLevel ||
																			1) *
																			1000)) *
																	100
																}%`,
															}}
														/>
													</div>
												)}
											</div>
											<div className="text-right">
												<div className="text-xs text-gray-400">
													Rating
												</div>
												<div
													className={`text-lg font-bold ${ratingColor}`}
												>
													{rating}
												</div>
											</div>
										</div>

										{/* Particles for high rarity */}
										{renderParticles(rarity)}

										{/* Condition Bar */}
										{(car.condition ?? 100) < 100 && (
											<div className="mt-3 bg-black/40 p-1.5 rounded border border-white/5">
												<div className="flex justify-between text-[9px] mb-1 uppercase tracking-wider">
													<span className="text-gray-500">
														Structure
													</span>
													<span
														className={
															(car.condition ||
																0) > 70
																? 'text-green-500'
																: (car.condition ||
																		0) > 40
																? 'text-yellow-500'
																: 'text-red-500'
														}
													>
														{(
															car.condition || 0
														).toFixed(0)}
														%
													</span>
												</div>
												<div className="w-full h-1 bg-gray-900 rounded-full overflow-hidden">
													<div
														className={`h-full transition-all duration-500 ${
															(car.condition ||
																0) > 70
																? 'bg-green-500'
																: (car.condition ||
																		0) > 40
																? 'bg-yellow-500'
																: 'bg-red-500'
														}`}
														style={{
															width: `${
																car.condition ||
																0
															}%`,
														}}
													/>
												</div>
											</div>
										)}

										{/* Expanded Stats Grid */}
										<div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] mt-3 bg-black/20 p-2 rounded border border-white/5">
											<div className="flex justify-between items-center border-b border-white/5 pb-1">
												<span className="text-gray-500">
													PWR
												</span>
												<span className="text-white font-mono font-bold">
													{Math.round(
														(tuning.maxTorque *
															tuning.redlineRPM) /
															5252
													)}{' '}
													<span className="text-[8px] text-gray-600">
														HP
													</span>
												</span>
											</div>
											<div className="flex justify-between items-center border-b border-white/5 pb-1">
												<span className="text-gray-500">
													TRQ
												</span>
												<span className="text-white font-mono font-bold">
													{Math.round(
														tuning.maxTorque
													)}{' '}
													<span className="text-[8px] text-gray-600">
														NM
													</span>
												</span>
											</div>
											<div className="flex justify-between items-center pt-1">
												<span className="text-gray-500">
													WGT
												</span>
												<span className="text-white font-mono">
													{tuning.mass.toFixed(0)}{' '}
													<span className="text-[8px] text-gray-600">
														KG
													</span>
												</span>
											</div>
											<div className="flex justify-between items-center pt-1">
												<span className="text-gray-500">
													GRP
												</span>
												<span className="text-white font-mono">
													{tuning.tireGrip.toFixed(2)}
												</span>
											</div>
										</div>
									</div>
								);
							})}
							<button
								onClick={() => onRestoreCar(-1)}
								className="pixel-btn bg-gray-800 text-gray-400 hover:text-white py-4 border-dashed border-gray-600"
							>
								+ RESTORE NEW CAR
							</button>
						</div>
					)}
				</div>

				{/* Car Visual / Main Content Area (Mod Tree Replaced) */}
				<div className="flex-1 bg-gray-900/50 relative overflow-hidden flex flex-col">
					{/* Inventory (Always Visible) */}
					<div className="absolute inset-0 p-2 overflow-hidden">
						<Inventory
							items={userInventory.filter((i) => !i.equipped)}
							installedItems={userInventory.filter(
								(i) => i.equipped
							)}
							carName={garage[currentCarIndex]?.name}
							onEquip={handleEquipWrapper}
							onRemove={onRemove}
							onSell={onSell}
							onDestroy={onDestroy}
							onRepair={onRepair}
							onMerge={onMerge}
							onRepairAll={onRepairAll}
							onMergeAll={onMergeAll}
							onRemoveAll={onRemoveAll}
							money={money}
							installedContainerRef={installedContainerRef}
						/>
					</div>

					{/* Hover Info Panel (Bottom Right) */}
					{hoveredMod && (
						<div className="absolute bottom-4 right-4 w-64 bg-black/90 border-2 border-indigo-500 p-4 shadow-2xl z-20 animate-in fade-in slide-in-from-bottom-4 duration-200">
							<h4 className="text-indigo-400 font-bold text-lg mb-1 pixel-text">
								{hoveredMod.name}
							</h4>
							<div className="text-xs text-indigo-300 mb-2 font-mono">
								{hoveredMod.type}
							</div>
							<p className="text-gray-300 text-xs mb-3 leading-relaxed">
								{hoveredMod.description}
							</p>
							<div className="border-t border-gray-800 pt-2">
								<div className="flex justify-between text-xs mb-1">
									<span className="text-gray-500">COST</span>
									<span className="text-yellow-400 font-mono">
										${hoveredMod.cost.toLocaleString()}
									</span>
								</div>
								{previewTuning && (
									<div className="mt-2">
										<div className="text-[10px] text-gray-500 uppercase mb-1">
											Estimated Gains
										</div>
										<div className="grid grid-cols-2 gap-2 text-xs font-mono">
											<div className="text-green-400">
												+
												{(
													(previewTuning.maxTorque -
														effectiveTuning.maxTorque) *
													0.8
												).toFixed(0)}{' '}
												HP
											</div>
											<div className="text-green-400">
												+
												{(
													previewTuning.maxTorque -
													effectiveTuning.maxTorque
												).toFixed(0)}{' '}
												TQ
											</div>
										</div>
									</div>
								)}
							</div>
						</div>
					)}
				</div>
			</div>
			{/* Context Menu Backdrop */}
			{contextMenu && (
				<div
					className="fixed inset-0 z-[100]"
					onClick={() => setContextMenu(null)}
				/>
			)}

			{/* Car Context Menu */}
			{contextMenu && garage[contextMenu.index] && (
				<div
					className="fixed z-[110] flex flex-col gap-1 p-1 bg-black/90 border border-gray-500 rounded shadow-xl animate-in fade-in zoom-in-95 duration-100"
					style={{
						left: Math.min(contextMenu.x, window.innerWidth - 180),
						top: Math.min(contextMenu.y, window.innerHeight - 150),
						minWidth: '140px',
					}}
					onClick={(e) => e.stopPropagation()}
				>
					<div className="px-2 py-1 text-xs font-bold uppercase border-b border-gray-700 mb-1 text-white">
						{garage[contextMenu.index].name}
					</div>

					<button
						onClick={() => {
							setCurrentCarIndex(contextMenu.index);
							setContextMenu(null);
						}}
						className="text-left px-2 py-1.5 hover:bg-blue-600 text-white text-xs font-bold rounded flex items-center gap-2"
					>
						<span>🚗</span> SELECT
					</button>

					{(garage[contextMenu.index].condition || 0) < 100 && (
						<button
							onClick={() => {
								onRestoreCar(contextMenu.index);
								setContextMenu(null);
							}}
							disabled={
								money <
								Math.floor(
									((100 -
										(garage[contextMenu.index].condition ||
											0)) /
										100) *
										(garage[contextMenu.index]
											.originalPrice || 10000) *
										0.5
								)
							}
							className={`text-left px-2 py-1.5 text-xs font-bold rounded flex items-center justify-between gap-2 ${
								money >=
								Math.floor(
									((100 -
										(garage[contextMenu.index].condition ||
											0)) /
										100) *
										(garage[contextMenu.index]
											.originalPrice || 10000) *
										0.5
								)
									? 'hover:bg-green-600 text-white'
									: 'text-gray-500 cursor-not-allowed'
							}`}
						>
							<div className="flex items-center gap-2">
								<span>🔧</span> RESTORE
							</div>
							<span
								className={
									money >=
									Math.floor(
										((100 -
											(garage[contextMenu.index]
												.condition || 0)) /
											100) *
											(garage[contextMenu.index]
												.originalPrice || 10000) *
											0.5
									)
										? 'text-green-300'
										: 'text-red-500'
								}
							>
								$
								{Math.floor(
									((100 -
										(garage[contextMenu.index].condition ||
											0)) /
										100) *
										(garage[contextMenu.index]
											.originalPrice || 10000) *
										0.5
								).toLocaleString()}
							</span>
						</button>
					)}

					<button
						onClick={() => {
							onScrapCar(contextMenu.index);
							setContextMenu(null);
						}}
						className="text-left px-2 py-1.5 hover:bg-red-900 text-red-100 hover:text-white text-xs font-bold rounded flex items-center gap-2"
					>
						<span>♻️</span> SCRAP
					</button>
				</div>
			)}

			{partAnimations.map((anim) => (
				<FloatingItem
					key={anim.id}
					item={anim.item}
					startX={anim.startX}
					startY={anim.startY}
					endX={anim.endX}
					endY={anim.endY}
					onComplete={() =>
						setPartAnimations((prev) =>
							prev.filter((a) => a.id !== anim.id)
						)
					}
				/>
			))}

			{xpAnimations.map((anim) => (
				<XPFloatingText
					key={anim.id}
					startX={anim.startX}
					startY={anim.startY}
					endX={anim.endX}
					endY={anim.endY}
					amount={anim.amount}
					onComplete={() =>
						setXpAnimations((prev) =>
							prev.filter((a) => a.id !== anim.id)
						)
					}
				/>
			))}
		</div>
	);
};
