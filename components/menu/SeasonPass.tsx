import React, { useRef, useEffect } from 'react';
import { UserSeasonProgress, DailyReward } from '../../types';
import { SEASON_REWARDS, MAX_SEASON_XP } from '../../constants/SeasonData';
import { ItemCard } from '../ui/ItemCard';

interface SeasonPassProps {
	progress: UserSeasonProgress;
	onClaim: (tier: number, isPremium: boolean) => void;
	onClose: () => void;
	onBuyPremium: () => void;
}

export const SeasonPass: React.FC<SeasonPassProps> = ({
	progress,
	onClaim,
	onClose,
	onBuyPremium,
}) => {
	const scrollRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to current tier on open
	useEffect(() => {
		if (scrollRef.current) {
			// Find first unclaimed tier or current level
			const currentLevelXP = progress.xp;
			const currentTier = SEASON_REWARDS.find(
				(r) => r.requiredXP > currentLevelXP
			);
			const index = currentTier
				? SEASON_REWARDS.indexOf(currentTier)
				: SEASON_REWARDS.length - 1;

			// Scroll roughly to that position
			// specialized logic: 320px per card
			scrollRef.current.scrollLeft = Math.max(0, (index - 1) * 320);
		}
	}, []);

	// Helper to get crate visuals (from CrateShop)
	const getCrateSpriteIndex = (crateType: string | undefined) => {
		if (!crateType) return 0;
		if (crateType === 'BASIC') return 0;
		if (crateType === 'PREMIUM') return 2; // Blue
		if (crateType === 'ELITE') return 4; // Gold
		return 0;
	};

	const renderReward = (
		reward: DailyReward | undefined,
		isPremium: boolean,
		tier: number
	) => {
		if (!reward)
			return (
				<div className="w-24 h-24 flex items-center justify-center bg-gray-900/50 rounded-lg border-2 border-gray-800 border-dashed opacity-50">
					<span className="text-gray-600 text-xs">EMPTY</span>
				</div>
			);

		if (reward.type === 'MONEY') {
			return (
				<div className="flex flex-col items-center justify-center gap-2 w-24 h-24 bg-green-900/20 border-2 border-green-800 rounded-lg shadow-[0_0_10px_rgba(22,163,74,0.2)]">
					<div className="text-3xl filter drop-shadow animate-pulse text-green-400">
						$
					</div>
					<div className="text-sm font-bold text-green-400">
						${(reward.amount || 0).toLocaleString()}
					</div>
				</div>
			);
		}

		if (reward.type === 'XP') {
			return (
				<div className="flex flex-col items-center justify-center gap-2 w-24 h-24 bg-blue-900/20 border-2 border-blue-800 rounded-lg shadow-[0_0_10px_rgba(37,99,235,0.2)]">
					<div className="text-xl font-bold text-blue-400">XP</div>
					<div className="text-sm font-bold text-blue-300">
						+{reward.amount}
					</div>
				</div>
			);
		}

		if (reward.type === 'CRATE') {
			const spriteIndex = getCrateSpriteIndex(reward.crateType);
			return (
				<div className="flex flex-col items-center justify-center gap-2 w-24 h-24 bg-purple-900/20 border-2 border-purple-800 rounded-lg shadow-[0_0_15px_rgba(147,51,234,0.3)] group relative overflow-hidden">
					<div
						className="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity"
						style={{
							backgroundColor:
								spriteIndex === 0
									? '#9ca3af'
									: spriteIndex === 2
									? '#3b82f6'
									: '#fbbf24',
						}}
					/>
					<div
						className="pixel-art transform group-hover:scale-110 transition-transform duration-200"
						style={{
							width: 64,
							height: 64,
							backgroundImage: 'url(/crates_tileset.png)',
							backgroundPosition: `-${spriteIndex * 64}px 0px`,
							backgroundSize: `${384}px ${64}px`,
							imageRendering: 'pixelated',
						}}
					/>
					<div className="text-[10px] font-bold text-gray-300 z-10 bg-black/50 px-1 rounded">
						{reward.crateType}
					</div>
				</div>
			);
		}

		if (reward.type === 'ITEM' && reward.itemId) {
			// Construct a fake item for visually rendering the card
			const fakeItem = {
				instanceId: 'preview',
				baseId: reward.itemId,
				name: 'Reward', // ItemCard will look up real name via baseId
				description: '',
				type: 'ENGINE' as any, // Dummy
				rarity: reward.itemRarity || 'COMMON',
				condition: 100,
				stats: {},
				value: 0,
			};

			return (
				<div className="w-24 h-24 transform hover:scale-105 transition-transform">
					<ItemCard
						item={fakeItem}
						showCondition={false}
						className="w-full h-full text-xs"
					/>
				</div>
			);
		}

		return (
			<div className="w-24 h-24 flex items-center justify-center bg-gray-800 rounded-lg">
				?
			</div>
		);
	};

	return (
		<div className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white font-pixel">
			{/* Header */}
			<div className="flex justify-between items-center p-6 border-b-2 border-gray-800 bg-gray-900">
				<div>
					<h2 className="text-4xl font-bold text-yellow-400 mb-1 pixel-text">
						STREET KINGS <span className="text-white">PASS</span>
					</h2>
					<p className="text-gray-400 text-sm">
						season 1 // earn rewards by racing
					</p>
				</div>
				<div className="flex items-center gap-6">
					<div className="text-right">
						<div className="text-xs text-gray-500 uppercase font-bold">
							Season XP
						</div>
						<div className="text-2xl font-bold text-blue-400 pixel-text">
							{progress.xp.toLocaleString()} /{' '}
							{MAX_SEASON_XP.toLocaleString()}
						</div>
					</div>
					<button
						onClick={onClose}
						className="p-2 hover:bg-gray-800 rounded border border-gray-700"
					>
						✕
					</button>
				</div>
			</div>

			{/* Main Content (Horizontal Scroll) */}
			<div className="flex-1 overflow-hidden relative flex flex-col">
				{/* Premium Buy Banner */}
				{!progress.isPremium && (
					<div className="absolute top-4 right-4 z-20 animate-bounce cursor-pointer">
						<button
							onClick={onBuyPremium}
							className="bg-gradient-to-r from-yellow-600 to-yellow-500 text-black font-bold px-6 py-3 rounded border-2 border-yellow-300 shadow-lg hover:brightness-110 active:translate-y-1 pixel-text"
						>
							UNLOCK PREMIUM PASS ($10,000)
						</button>
					</div>
				)}

				<div
					ref={scrollRef}
					className="flex-1 overflow-x-auto overflow-y-hidden flex items-center px-10 gap-0 pb-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
				>
					{/* Progress Line Background */}
					<div className="absolute left-0 right-0 top-1/2 h-4 bg-gray-800 -z-10 transform -translate-y-1/2" />
					<div
						className="absolute left-0 top-1/2 h-4 bg-blue-600 -z-10 transform -translate-y-1/2 transition-all duration-1000"
						style={{
							width: `${Math.min(
								100,
								(progress.xp / MAX_SEASON_XP) * 100
							)}%`,
						}}
					/>

					{SEASON_REWARDS.map((tier, idx) => {
						const isUnlocked = progress.xp >= tier.requiredXP;
						const isClaimedFree =
							progress.claimedFreeTiers.includes(tier.tier);
						const isClaimedPremium =
							progress.claimedPremiumTiers.includes(tier.tier);

						return (
							<div
								key={tier.tier}
								className={`
                                    relative flex-shrink-0 w-80 h-[450px] flex flex-col justify-between items-center z-10 group
                                    transition-all duration-300
                                    ${
										isUnlocked
											? 'opacity-100'
											: 'opacity-50 grayscale hover:grayscale-0'
									}
                                `}
							>
								{/* Tier Number / Connector */}
								<div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-gray-900 border-4 border-gray-700 rounded-full flex items-center justify-center z-20 shadow-xl">
									<div
										className={`text-lg font-bold ${
											isUnlocked
												? 'text-white'
												: 'text-gray-500'
										}`}
									>
										{tier.tier}
									</div>
								</div>

								{/* Top: Free Track */}
								<div className="flex-1 w-full flex flex-col items-center justify-end pb-12 relative">
									<div className="mb-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
										Free
									</div>
									<div
										className={`
                                        p-4 rounded-xl border-2 transition-all duration-300 bg-gray-900
                                        ${
											isClaimedFree
												? 'border-green-500/50 opacity-50 scale-95'
												: isUnlocked
												? 'border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.5)] scale-105'
												: 'border-gray-700'
										}
                                    `}
									>
										{renderReward(
											tier.freeReward,
											false,
											tier.tier
										)}
									</div>
									{isUnlocked && !isClaimedFree && (
										<button
											onClick={() =>
												onClaim(tier.tier, false)
											}
											className="mt-4 px-4 py-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded animate-bounce shadow-lg border-b-2 border-green-800 active:border-b-0 active:translate-y-0.5"
										>
											CLAIM
										</button>
									)}
									{isClaimedFree && (
										<div className="mt-4 text-green-500 text-xs font-bold flex items-center gap-1">
											✓ CLAIMED
										</div>
									)}
								</div>

								{/* Bottom: Premium Track */}
								<div className="flex-1 w-full flex flex-col items-center justify-start pt-12 relative bg-gradient-to-b from-transparent via-yellow-900/10 to-transparent">
									<div className="mt-2 text-xs font-bold text-yellow-600 uppercase tracking-widest mb-2">
										Premium
									</div>
									<div
										className={`
                                        p-4 rounded-xl border-2 transition-all duration-300 bg-gray-900 relative
                                        ${
											isClaimedPremium
												? 'border-green-500/50 opacity-50 scale-95'
												: isUnlocked &&
												  progress.isPremium
												? 'border-yellow-500 shadow-[0_0_20px_rgba(234,179,8,0.5)] scale-105'
												: 'border-yellow-900/50 opacity-75'
										}
                                    `}
									>
										{!progress.isPremium && (
											<div className="absolute inset-0 bg-black/60 z-10 flex items-center justify-center rounded-lg backdrop-blur-[1px]">
												<span className="text-2xl">
													🔒
												</span>
											</div>
										)}
										{renderReward(
											tier.premiumReward,
											true,
											tier.tier
										)}
									</div>
									{isUnlocked &&
										progress.isPremium &&
										!isClaimedPremium && (
											<button
												onClick={() =>
													onClaim(tier.tier, true)
												}
												className="mt-4 px-4 py-1 bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold rounded animate-bounce shadow-lg border-b-2 border-yellow-800 active:border-b-0 active:translate-y-0.5"
											>
												CLAIM
											</button>
										)}
									{isClaimedPremium && (
										<div className="mt-4 text-green-500 text-xs font-bold flex items-center gap-1">
											✓ CLAIMED
										</div>
									)}
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
};
