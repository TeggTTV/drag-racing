import { WheelReward } from '../components/menu/SpinWheel';

export const WHEEL_REWARDS: WheelReward[] = [
	{
		id: 'money_small',
		label: '$500',
		value: 500,
		type: 'MONEY',
		color: '#4ade80', // Green-400
		probability: 0.3,
		icon: '💵',
	},
	{
		id: 'xp_small',
		label: '100 XP',
		value: 100,
		type: 'XP',
		color: '#60a5fa', // Blue-400
		probability: 0.3,
		icon: '⭐',
	},
	{
		id: 'money_medium',
		label: '$2,000',
		value: 2000,
		type: 'MONEY',
		color: '#22c55e', // Green-500
		probability: 0.15,
		icon: '💰',
	},
	{
		id: 'xp_medium',
		label: '500 XP',
		value: 500,
		type: 'XP',
		color: '#3b82f6', // Blue-500
		probability: 0.15,
		icon: '🌟',
	},
	{
		id: 'item_rare',
		label: 'RARE PART',
		value: 'RARE',
		type: 'ITEM',
		color: '#a855f7', // Purple-500
		probability: 0.08,
		icon: '🔧',
	},
	{
		id: 'money_jackpot',
		label: '$10,000',
		value: 10000,
		type: 'MONEY',
		color: '#facc15', // Yellow-400
		probability: 0.015,
		icon: '💎',
	},
	{
		id: 'crate_premium',
		label: 'PREMIUM CRATE',
		value: 'PREMIUM',
		type: 'CRATE',
		color: '#f43f5e', // Rose-500
		probability: 0.005,
		icon: '📦',
	},
];

// Helper to pick a weighted random reward
export const pickWeightedReward = (): WheelReward => {
	const totalWeight = WHEEL_REWARDS.reduce(
		(sum, r) => sum + r.probability,
		0
	);
	let random = Math.random() * totalWeight;

	for (const reward of WHEEL_REWARDS) {
		if (random < reward.probability) {
			return reward;
		}
		random -= reward.probability;
	}
	return WHEEL_REWARDS[0];
};
