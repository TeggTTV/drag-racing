import React, { useState, useEffect, useRef } from 'react';
import { CRATES, ItemGenerator } from '@/utils/ItemGenerator';
import { Crate, InventoryItem } from '@/types';
import { ItemCard } from '@/components/ui/ItemCard';

interface CrateShopProps {
	money: number;
	onBuyCrate: (crate: Crate, amount: number) => void;
	onItemReveal: (items: InventoryItem[]) => void;
}

export const CrateShop: React.FC<CrateShopProps> = ({
	money,
	onBuyCrate,
	onItemReveal,
}) => {
	const [openingCrate, setOpeningCrate] = useState<Crate | null>(null);
	const [revealedItems, setRevealedItems] = useState<InventoryItem[]>([]);
	const [buyAmount, setBuyAmount] = useState(1);
	const [revealedCount, setRevealedCount] = useState(0);
	const [autoOpen, setAutoOpen] = useState(false);

	const autoOpenInterval = useRef<NodeJS.Timeout | null>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);

	// Tooltip State
	const [hoveredItem, setHoveredItem] = useState<InventoryItem | null>(null);
	const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

	const handleMouseMove = (e: React.MouseEvent) => {
		setMousePos({ x: e.clientX, y: e.clientY });
	};

	// Stop auto-open if money runs out
	useEffect(() => {
		if (autoOpen && !openingCrate) {
			// Find random crate or just stop? Let's just stop if no context.
			// Ideally auto-open should target a specific crate.
			// For simplicity, let's make the "Auto Open" toggle global but it only acts when a crate is selected?
			// Actually, better UI: "Auto Open" toggle on each crate card? Or a global toggle that affects the "Buy" button behavior?
			// Let's do: Global switch "DEV: AUTO-OPEN". If ON, clicking "Buy" starts a loop.
		}
	}, [money, autoOpen]);

	useEffect(() => {
		return () => {
			if (autoOpenInterval.current)
				clearInterval(autoOpenInterval.current);
		};
	}, []);

	const handleBuy = (crate: Crate) => {
		if (money < crate.price * buyAmount) return;

		// If Auto-Open is enabled, start the loop
		if (autoOpen) {
			if (autoOpenInterval.current) {
				clearInterval(autoOpenInterval.current);
				autoOpenInterval.current = null;
				return; // Toggle off if clicking again?
			}

			autoOpenInterval.current = setInterval(() => {
				// Stop if out of money
				if (moneyRef.current < crate.price * buyAmount) {
					if (autoOpenInterval.current)
						clearInterval(autoOpenInterval.current);
					autoOpenInterval.current = null;
					return;
				}

				// Instant buy, skip animation screen
				onBuyCrate(crate, buyAmount);

				// Generate items instantly
				const newItems: InventoryItem[] = [];
				for (let i = 0; i < buyAmount; i++) {
					newItems.push(ItemGenerator.openCrate(crate));
				}

				onItemReveal(newItems);
			}, 200);
		} else {
			// Normal Buy (with staggered animation)
			const newItems: InventoryItem[] = [];
			for (let i = 0; i < buyAmount; i++) {
				newItems.push(ItemGenerator.openCrate(crate));
			}

			// Deduct money & Grant items immediately
			onBuyCrate(crate, buyAmount);
			onItemReveal(newItems);

			// Start Animation
			setRevealedItems(newItems);
			setRevealedCount(0);
			setOpeningCrate(crate);
		}
	};

	// Staggered Reveal Effect
	// Staggered Reveal Effect
	useEffect(() => {
		if (!openingCrate || revealedCount >= revealedItems.length || autoOpen)
			return;

		// Fixed 1s delay per user request
		const delay = 500;

		const timer = setTimeout(() => {
			setRevealedCount((prev) => prev + 1);
		}, delay);

		return () => clearTimeout(timer);
	}, [revealedCount, openingCrate, revealedItems.length, autoOpen]);

	// Auto-scroll effect
	useEffect(() => {
		if (scrollContainerRef.current) {
			const activeElement = document.getElementById(
				`crate-slot-${revealedCount}`
			);
			if (activeElement) {
				activeElement.scrollIntoView({
					behavior: 'smooth',
					block: 'center',
				});
			}
		}
	}, [revealedCount]);

	// Ref to track money for the auto-buyer interval
	const moneyRef = useRef(money);
	useEffect(() => {
		moneyRef.current = money;
	}, [money]);

	const toggleAutoOpenLoop = (crate: Crate) => {
		if (autoOpenInterval.current) {
			clearInterval(autoOpenInterval.current);
			autoOpenInterval.current = null;
			return; // Stop
		}

		autoOpenInterval.current = setInterval(() => {
			if (moneyRef.current < crate.price * buyAmount) {
				if (autoOpenInterval.current)
					clearInterval(autoOpenInterval.current);
				autoOpenInterval.current = null;
				return;
			}

			// Instant buy, skip animation screen
			onBuyCrate(crate, buyAmount);

			// Generate items instantly
			const newItems: InventoryItem[] = [];
			for (let i = 0; i < buyAmount; i++) {
				newItems.push(ItemGenerator.openCrate(crate));
			}
			onItemReveal(newItems);
		}, 200);
	};

	const closeReveal = () => {
		setOpeningCrate(null);
		setRevealedItems([]);
		setRevealedCount(0);
	};

	// Tileset Colors/Styles based on crate type/name keyword
	// Mapping to sprite index (0-5)
	const getCrateSpriteIndex = (crate: Crate) => {
		if (crate.id === 'crate_basic') return 0; // Common (Gray)
		if (crate.id === 'crate_standard') return 1; // Uncommon (Green)
		if (crate.id === 'crate_premium') return 2; // Rare (Blue)
		if (crate.id === 'crate_legendary') return 4; // Legendary (Gold) - skip Epic for now?
		// Fallback
		if (crate.name.includes('Basic')) return 0;
		if (crate.name.includes('Standard')) return 1;
		if (crate.name.includes('Premium')) return 2;
		if (crate.name.includes('Elite')) return 3;
		if (crate.name.includes('Legendary')) return 4;
		if (crate.name.includes('Exotic')) return 5;
		return 0;
	};

	// Visual Styles per Crate Tier
	const getCrateVisuals = (crate: Crate) => {
		const index = getCrateSpriteIndex(crate);
		switch (index) {
			case 1: // Uncommon (Green)
				return {
					border: 'border-green-800',
					bg: 'bg-green-900/20',
					shadow: 'shadow-[0_0_15px_rgba(22,163,74,0.3)]',
					animation: 'animate-bounce',
				};
			case 2: // Rare (Blue)
				return {
					border: 'border-blue-600',
					bg: 'bg-blue-900/30',
					shadow: 'shadow-[0_0_20px_rgba(37,99,235,0.5)]',
					animation: 'animate-bounce duration-700',
				};
			case 3: // Epic (Purple)
				return {
					border: 'border-purple-600',
					bg: 'bg-purple-900/30',
					shadow: 'shadow-[0_0_25px_rgba(147,51,234,0.6)]',
					animation: 'animate-bounce duration-500',
				};
			case 4: // Legendary (Gold)
				return {
					border: 'border-yellow-500',
					bg: 'bg-yellow-900/40',
					shadow: 'shadow-[0_0_35px_rgba(234,179,8,0.7)]',
					animation: 'animate-pulse duration-100', // Intense pulse
				};
			case 5: // Exotic (Pink/Red)
				return {
					border: 'border-rose-500',
					bg: 'bg-rose-900/40',
					shadow: 'shadow-[0_0_40px_rgba(244,63,94,0.8)]',
					animation: 'animate-ping duration-300', // Very intense
				};
			default: // Common (Gray)
				return {
					border: 'border-gray-700',
					bg: 'bg-gray-800',
					shadow: '',
					animation: 'animate-bounce',
				};
		}
	};

	const [cratesImg, setCratesImg] = useState<HTMLImageElement | null>(null);
	useEffect(() => {
		const img = new Image();
		img.src = '/crates_tileset.png';
		img.onload = () => setCratesImg(img);
	}, []);

	if (openingCrate && !autoOpen) {
		return (
			<div
				className="w-full h-full flex flex-col items-center justify-center bg-black/95 absolute inset-0 z-50 p-8 font-pixel overflow-y-auto"
				onMouseMove={handleMouseMove}
			>
				<div className="flex flex-col items-center animate-in zoom-in duration-300 w-full max-w-6xl my-auto">
					<div className="text-yellow-400 font-bold text-3xl mb-8 pixel-text flex items-center gap-4">
						{revealedCount < revealedItems.length ? (
							<span className="animate-pulse">
								OPENING CRATES... ({revealedCount}/
								{revealedItems.length})
							</span>
						) : (
							<span>
								{revealedItems.length} NEW ITEM
								{revealedItems.length === 1 ? '' : 'S'}{' '}
								ACQUIRED!
							</span>
						)}
					</div>

					<div
						ref={scrollContainerRef}
						className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8 w-full max-h-[60vh] overflow-y-auto pr-2 rounded p-4 bg-gray-900/50 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
					>
						{revealedItems.map((item, idx) => {
							const isRevealed = idx < revealedCount;

							if (!isRevealed) {
								// Unrevealed Crate
								const isCurrent = idx === revealedCount;
								const visuals = getCrateVisuals(openingCrate);

								return (
									<div
										id={`crate-slot-${idx}`}
										key={idx}
										className={`w-full aspect-square flex items-center justify-center rounded border-2 transition-all duration-300 ${
											visuals.border
										} ${visuals.bg} ${visuals.shadow} ${
											isCurrent ? 'scale-110 z-10' : ''
										}`}
									>
										<div
											className={`pixel-art opacity-90 ${
												isCurrent
													? visuals.animation
													: ''
											}`}
											style={{
												width: 64 * 2,
												height: 64 * 2,
												backgroundImage:
													'url(/crates_tileset.png)',
												backgroundPosition: `-${
													getCrateSpriteIndex(
														openingCrate
													) *
													64 *
													2
												}px 0px`,
												backgroundSize: `${384 * 2}px ${
													64 * 2
												}px`,
												imageRendering: 'pixelated',
											}}
										/>
									</div>
								);
							}

							return (
								<div
									id={`crate-slot-${idx}`}
									key={idx}
									className="flex flex-col gap-2 items-center animate-in fade-in zoom-in duration-1000"
								>
									<ItemCard
										item={item}
										className="w-full"
										showCondition={true}
										onMouseEnter={() =>
											setHoveredItem(item)
										}
										onMouseLeave={() =>
											setHoveredItem(null)
										}
									/>
								</div>
							);
						})}
					</div>

					{revealedCount >= revealedItems.length && (
						<button
							onClick={closeReveal}
							className="px-12 py-4 bg-blue-600 text-white font-bold rounded hover:bg-blue-500 pixel-text text-xl shadow-lg border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 animate-in fade-in slide-in-from-bottom-4"
						>
							CONTINUE TO SHOP
						</button>
					)}
				</div>

				{hoveredItem && (
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
														'number' &&
													displayVal > 0
														? '+'
														: ''}
													{typeof displayVal ===
													'number'
														? displayVal.toFixed(2)
														: displayVal}
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
			</div>
		);
	}

	return (
		<div
			className="w-full h-full p-6 overflow-y-auto font-pixel bg-neutral-900"
			onMouseMove={handleMouseMove}
		>
			{/* Header */}
			<div className="flex justify-between items-end mb-8 border-b-2 border-gray-800 pb-4">
				<div>
					<h2 className="text-4xl font-bold text-white pixel-text mb-2 tracking-wide">
						SUPPLY CENTER
					</h2>
					<p className="text-gray-400 text-sm">
						Acquire parts for your build.
					</p>
				</div>

				<div className="flex flex-col items-end gap-2">
					<div className="flex items-center gap-4 bg-black/40 p-2 rounded border border-gray-700">
						<span className="text-gray-400 text-xs uppercase font-bold">
							Quantity: {buyAmount}
						</span>
						<input
							type="range"
							min="1"
							max="50"
							value={buyAmount}
							onChange={(e) =>
								setBuyAmount(parseInt(e.target.value))
							}
							className="w-32 accent-indigo-500 cursor-pointer"
						/>
					</div>

					{hoveredItem && (
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

							<div className="space-y-1">
								{Object.entries(hoveredItem.stats).map(
									([key, val]: [string, any]) => {
										if (typeof val === 'object')
											return null;

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
												displayVal =
													Math.round(displayVal);
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
															'number' &&
														displayVal > 0
															? '+'
															: ''}
														{typeof displayVal ===
														'number'
															? displayVal.toFixed(
																	2
															  )
															: displayVal}
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

					<label className="flex items-center gap-2 cursor-pointer group">
						<span
							className={`text-xs font-bold transition-colors ${
								autoOpen
									? 'text-red-400'
									: 'text-gray-500 group-hover:text-gray-300'
							}`}
						>
							DEV: AUTO-OPEN
						</span>
						<div
							className={`w-10 h-5 rounded-full p-0.5 transition-colors border-2 ${
								autoOpen
									? 'bg-red-900 border-red-600'
									: 'bg-gray-800 border-gray-600'
							}`}
							onClick={() => setAutoOpen(!autoOpen)}
						>
							<div
								className={`w-3.5 h-3.5 rounded-full bg-white transition-transform ${
									autoOpen ? 'translate-x-[18px]' : ''
								}`}
							/>
						</div>
					</label>
				</div>
			</div>

			<div className="grid grid-cols-1 gap-6 max-w-6xl mx-auto pb-20">
				{CRATES.map((crate) => {
					return (
						<div
							key={crate.id}
							className={`relative overflow-hidden rounded-xl border-2 transition-all group hover:border-white ${
								getCrateSpriteIndex(crate) === 0
									? 'bg-gray-900/60 border-gray-700'
									: getCrateSpriteIndex(crate) === 1
									? 'bg-green-900/40 border-green-800'
									: getCrateSpriteIndex(crate) === 2
									? 'bg-blue-900/40 border-blue-800'
									: getCrateSpriteIndex(crate) === 3
									? 'bg-purple-900/40 border-purple-800'
									: getCrateSpriteIndex(crate) === 4
									? 'bg-yellow-900/40 border-yellow-800'
									: 'bg-pink-900/40 border-pink-800'
							}`}
						>
							<div
								className="absolute top-0 right-0 p-4 opacity-10 font-bold select-none pointer-events-none"
								style={{
									width: 64 * 3,
									height: 64 * 3,
									backgroundImage: 'url(/crates_tileset.png)',
									backgroundPosition: `-${
										getCrateSpriteIndex(crate) * 64 * 3
									}px 0px`,
									backgroundSize: `${384 * 3}px ${64 * 3}px`,
									imageRendering: 'pixelated',
								}}
							/>

							<div className="p-6 relative z-10 flex flex-col md:flex-row gap-6 items-center">
								{/* Left: Icon & Name */}
								<div className="flex flex-col items-center md:items-start text-center md:text-left min-w-[150px]">
									<div
										className="mb-4 drop-shadow-lg transform group-hover:scale-110 transition-transform duration-300 pixel-art"
										style={{
											width: 64 * 1.5,
											height: 64 * 1.5,
											backgroundImage:
												'url(/crates_tileset.png)',
											backgroundPosition: `-${
												getCrateSpriteIndex(crate) *
												64 *
												1.5
											}px 0px`,
											backgroundSize: `${384 * 1.5}px ${
												64 * 1.5
											}px`,
											imageRendering: 'pixelated',
										}}
									/>
									<h3
										className={`text-2xl font-bold mb-1 ${
											getCrateSpriteIndex(crate) === 0
												? 'text-gray-400'
												: getCrateSpriteIndex(crate) ===
												  1
												? 'text-green-400'
												: getCrateSpriteIndex(crate) ===
												  2
												? 'text-blue-400'
												: getCrateSpriteIndex(crate) ===
												  3
												? 'text-purple-400'
												: getCrateSpriteIndex(crate) ===
												  4
												? 'text-yellow-400'
												: 'text-pink-400'
										}`}
									>
										{crate.name}
									</h3>
									<div className="text-white font-mono bg-black/50 px-3 py-1 rounded text-lg">
										${crate.price.toLocaleString()}
										<span className="text-xs text-gray-500 ml-1">
											ea
										</span>
									</div>
								</div>

								{/* Middle: Drops */}
								<div className="flex-1 w-full">
									<div className="flex flex-wrap gap-2 justify-center md:justify-start">
										{Object.entries(crate.dropRates).map(
											([rarity, rate]) => {
												if (rate <= 0) return null;
												const rColor =
													ItemGenerator.getRarityColor(
														rarity as any
													);
												return (
													<div
														key={rarity}
														className="flex items-center gap-2 bg-black/40 px-3 py-2 rounded border border-white/5"
														title={rarity}
													>
														<div
															className="w-3 h-3 rounded-full shadow-[0_0_8px_currentColor]"
															style={{
																backgroundColor:
																	rColor,
																color: rColor,
															}}
														/>
														<div className="flex flex-col leading-none">
															<span className="text-sm font-bold text-white">
																{(
																	rate * 100
																).toFixed(0)}
																%
															</span>
															<span
																className="text-[10px] opacity-60 uppercase"
																style={{
																	color: rColor,
																}}
															>
																{rarity}
															</span>
														</div>
													</div>
												);
											}
										)}
									</div>

									<p className="text-gray-400 text-xs mt-4 leading-relaxed max-w-md">
										{crate.description}
									</p>
								</div>

								{/* Right: Action */}
								<div className="flex flex-col items-stretch gap-2 min-w-[160px]">
									<button
										onClick={() =>
											autoOpen
												? toggleAutoOpenLoop(crate)
												: handleBuy(crate)
										}
										disabled={
											!autoOpen &&
											money < crate.price * buyAmount
										}
										className={`
											relative py-4 px-6 font-bold rounded pixel-text text-xl shadow-xl transition-all
											flex items-center justify-center gap-2
											${
												autoOpen
													? 'bg-red-700 hover:bg-red-600 text-white border-b-4 border-red-900 animate-pulse'
													: money >=
													  crate.price * buyAmount
													? 'bg-blue-600 hover:bg-blue-500 text-white border-b-4 border-blue-800 active:border-b-0 active:translate-y-1'
													: 'bg-gray-700 text-gray-500 border-b-4 border-gray-800 cursor-not-allowed opacity-50'
											}
										`}
									>
										{autoOpen
											? autoOpenInterval.current
												? 'STOP LOOP'
												: 'START LOOP'
											: `BUY x${buyAmount}`}
									</button>

									<div className="text-center text-xs font-mono text-gray-500">
										Total:{' '}
										<span
											className={
												money >= crate.price * buyAmount
													? 'text-white'
													: 'text-red-500'
											}
										>
											$
											{(
												crate.price * buyAmount
											).toLocaleString()}
										</span>
									</div>
								</div>
							</div>
						</div>
					);
				})}
			</div>
		</div>
	);
};
