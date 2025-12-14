import React from 'react';
import { DailyReward, LoginStreak } from '../../types';
import { getRewardForDay } from '../../constants/DailyRewards';

interface DailyRewardsModalProps {
	loginStreak: LoginStreak;
	onClaim: () => void;
	onClose: () => void;
}

export const DailyRewardsModal: React.FC<DailyRewardsModalProps> = ({
	loginStreak,
	onClaim,
	onClose,
}) => {
	const currentDay = loginStreak.currentStreak;
	const canClaim = !loginStreak.rewardsClaimed.includes(currentDay);

	const getRewardIcon = (reward: DailyReward) => {
		switch (reward.type) {
			case 'MONEY':
				return '💰';
			case 'XP':
				return '⭐';
			case 'ITEM':
				return '🔧';
			case 'CRATE':
				return '📦';
			default:
				return '🎁';
		}
	};

	const getRewardDescription = (reward: DailyReward) => {
		switch (reward.type) {
			case 'MONEY':
				return `$${reward.amount?.toLocaleString()}`;
			case 'XP':
				return `${reward.amount} XP`;
			case 'ITEM':
				return reward.itemRarity || 'ITEM';
			case 'CRATE':
				return reward.crateType || 'CRATE';
			default:
				return 'Reward';
		}
	};

	const getRarityColor = (rarity?: string) => {
		switch (rarity) {
			case 'UNCOMMON':
				return 'text-green-400';
			case 'RARE':
				return 'text-blue-400';
			case 'EPIC':
				return 'text-purple-400';
			case 'LEGENDARY':
				return 'text-yellow-400';
			case 'PREMIUM':
				return 'text-blue-400';
			case 'ELITE':
				return 'text-purple-400';
			default:
				return 'text-gray-300';
		}
	};

	const handleDayClick = (day: number) => {
		if (day === currentDay && canClaim) {
			onClaim();
		}
	};

	// Show 14 days: current day and next 13
	const daysToShow = 14;
	const startDay = currentDay;

	return (
		<div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[200] p-4">
			<div className="bg-gradient-to-b from-gray-900 to-black border-2 border-yellow-500/50 rounded-lg max-w-4xl w-full p-6 shadow-2xl">
				{/* Header */}
				<div className="text-center mb-6">
					<h2 className="text-5xl font-black text-yellow-400 mb-2 font-pixel tracking-wider">
						DAILY LOGIN REWARDS
					</h2>
				</div>

				{/* Rewards Grid */}
				<div className="mb-6">
					<div className="grid grid-cols-7 gap-3">
						{[...Array(daysToShow)].map((_, i) => {
							const day = startDay + i;
							const reward = getRewardForDay(day);
							const isClaimed =
								loginStreak.rewardsClaimed.includes(day);
							const isCurrentDay = day === currentDay;
							const isClaimable = isCurrentDay && canClaim;

							return (
								<button
									key={i}
									onClick={() => handleDayClick(day)}
									disabled={!isClaimable}
									className={`
										relative p-4 rounded-lg text-center transition-all
										${
											isClaimable
												? 'bg-gradient-to-br from-yellow-900/50 to-orange-900/50 border-2 border-yellow-400 shadow-lg shadow-yellow-500/50 hover:scale-105 cursor-pointer animate-pulse'
												: isClaimed
												? 'bg-gray-800/30 border border-green-500/50'
												: 'bg-gray-800/50 border border-gray-600'
										}
									`}
								>
									{/* Day Number */}
									<div
										className={`text-xs mb-2 font-pixel ${
											isClaimable
												? 'text-yellow-300'
												: isClaimed
												? 'text-green-400'
												: 'text-gray-500'
										}`}
									>
										Day {day}
									</div>

									{/* Icon */}
									<div className="text-4xl mb-2">
										{getRewardIcon(reward)}
									</div>

									{/* Description */}
									<div
										className={`text-xs font-bold ${
											isClaimable
												? getRarityColor(
														reward.itemRarity ||
															reward.crateType
												  )
												: isClaimed
												? 'text-gray-400'
												: getRarityColor(
														reward.itemRarity ||
															reward.crateType
												  )
										}`}
									>
										{getRewardDescription(reward)}
									</div>

									{/* Claimed Checkmark */}
									{isClaimed && (
										<div className="absolute top-1 right-1 text-green-400 text-lg">
											✓
										</div>
									)}

									{/* Click to Claim indicator */}
									{isClaimable && (
										<div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-xs font-bold px-2 py-1 rounded-full animate-bounce">
											CLAIM!
										</div>
									)}
								</button>
							);
						})}
					</div>
				</div>

				{/* Helper Text */}
				{canClaim && (
					<div className="text-center mb-4">
						<p className="text-yellow-300 font-pixel text-sm animate-pulse">
							Click on Day {currentDay} to claim your reward!
						</p>
					</div>
				)}

				{/* Close Button */}
				<button
					onClick={onClose}
					className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded pixel-btn"
				>
					CLOSE
				</button>
			</div>
		</div>
	);
};
