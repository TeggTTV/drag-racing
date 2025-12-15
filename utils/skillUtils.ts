import { SKILL_TREE } from '../constants';
import { GameSettings } from '../contexts/GameContext';

export const getSkillBonus = (
	stat: string,
	settings?: GameSettings
): number => {
	// Determine initial value based on type implied by name
	let value = stat.toLowerCase().includes('multiplier') ? 1 : 0;

	if (
		!settings ||
		!settings.skills ||
		!Array.isArray(settings.skills.unlocked)
	) {
		return value;
	}

	try {
		settings.skills.unlocked.forEach((id: string) => {
			const node = SKILL_TREE.find((n) => n.id === id);
			if (node && node.stats) {
				// @ts-ignore
				const val = node.stats[stat];
				if (typeof val === 'number' && !isNaN(val)) {
					if (stat.toLowerCase().includes('multiplier')) {
						value *= val;
					} else {
						value += val;
					}
				}
			}
		});
	} catch (e) {
		console.error('Error calculating skill bonus:', e);
		return value;
	}
	return value;
};
