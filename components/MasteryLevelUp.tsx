import React, { useState, useEffect } from 'react';

export const MasteryLevelUp: React.FC<{
	initialLevel: number;
	initialXP: number;
	xpGain: number;
}> = ({ initialLevel, initialXP, xpGain }) => {
	const [level, setLevel] = useState(initialLevel);
	const [xp, setXp] = useState(initialXP);
	const [showGain, setShowGain] = useState(false);

	useEffect(() => {
		// 1. Initial Delay (1s)
		const startDelay = setTimeout(() => {
			setShowGain(true);

			// Calculate targets
			let currentLevel = initialLevel;
			let currentXP = initialXP;
			let remainingGain = xpGain;

			const animate = () => {
				const threshold = (currentLevel + 1) * 1000;
				const space = threshold - currentXP;

				if (remainingGain >= space) {
					// Level Up
					setXp(threshold); // Fill bar
					setTimeout(() => {
						// Reset and increment
						remainingGain -= space;
						currentLevel++;
						currentXP = 0;
						setLevel(currentLevel);
						setXp(0);

						// Continue animation if more gain
						if (remainingGain > 0) {
							setTimeout(animate, 500);
						}
					}, 1000); // Wait at full bar
				} else {
					// Simple fill
					setXp(currentXP + remainingGain);
				}
			};

			animate();
		}, 1000);

		return () => clearTimeout(startDelay);
	}, [initialLevel, initialXP, xpGain]);

	const threshold = (level + 1) * 1000;
	const progress = Math.min(100, (xp / threshold) * 100);

	return (
		<div className="bg-gray-900/80 p-4 rounded border border-indigo-500/30 mb-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
			<div className="flex justify-between items-end mb-2">
				<div className="text-indigo-400 font-bold pixel-text text-sm">
					CAR MASTERY
				</div>
				<div className="text-white font-mono text-xs transition-all duration-300">
					LVL {level}
				</div>
			</div>
			<div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden relative">
				<div
					className="h-full bg-indigo-500 transition-all duration-1000 ease-out"
					style={{ width: `${progress}%` }}
				/>
				<div className="absolute inset-0 flex items-center justify-center text-[8px] text-white font-bold shadow-black drop-shadow-md">
					{Math.floor(xp)} / {threshold} XP
				</div>
			</div>
			<div
				className={`text-center text-xs text-green-400 mt-1 font-mono transition-opacity duration-500 ${
					showGain ? 'opacity-100' : 'opacity-0'
				}`}
			>
				+{xpGain} XP
			</div>
		</div>
	);
};
