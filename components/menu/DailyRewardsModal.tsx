import React, { useState } from 'react';
import { LoginStreak } from '../../types';
import { SpinWheel, WheelReward } from './SpinWheel';
import { WHEEL_REWARDS, pickWeightedReward } from '../../constants/WheelData';

interface DailyRewardsModalProps {
	loginStreak: LoginStreak;
	onClaim: (reward?: WheelReward) => void;
	onClose: () => void;
}

export const DailyRewardsModal: React.FC<DailyRewardsModalProps> = ({
	loginStreak,
	onClaim,
	onClose,
}) => {
	const [spinning, setSpinning] = useState(false);
	const [result, setResult] = useState<WheelReward | null>(null);
	const [claimed, setClaimed] = useState(false);

	const handleSpin = () => {
		if (spinning || claimed) return;

		const reward = pickWeightedReward();
		setResult(reward);
		setSpinning(true);
	};

	const handleSpinComplete = () => {
		setSpinning(false);
		setClaimed(true);
		// Wait a moment for the user to see the result
		setTimeout(() => {
			onClaim(result!);
			onClose();
		}, 1500);
	};

	return (
		<div className="fixed inset-0 bg-black/95 flex items-center justify-center z-[200] p-4 backdrop-blur-md">
			{/* Close Button (Top Right) */}
			<button
				onClick={onClose}
				className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors"
			>
				<svg
					className="w-8 h-8"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						strokeWidth="2"
						d="M6 18L18 6M6 6l12 12"
					/>
				</svg>
			</button>

			<div className="flex flex-col items-center justify-center space-y-8 max-w-4xl w-full">
				{/* Header */}
				<div className="text-center space-y-2">
					<h2 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 font-pixel tracking-wider drop-shadow-[0_4px_0_rgba(0,0,0,0.5)]">
						DAILY SPIN
					</h2>
					<p className="text-xl text-yellow-100/80 font-mono">
						Current Streak:{' '}
						<span className="text-yellow-400 font-bold">
							{loginStreak.currentStreak} Days
						</span>
					</p>
				</div>

				{/* The Wheel */}
				<div className="relative transform scale-90 md:scale-100">
					<SpinWheel
						rewards={WHEEL_REWARDS}
						onComplete={handleSpinComplete}
						spinning={spinning}
						result={result}
					/>

					{/* Result Overlay (Post-Spin) */}
					{claimed && result && (
						<div className="absolute inset-0 flex items-center justify-center z-50 animate-bounce-in">
							<div className="bg-black/90 p-8 rounded-2xl border-4 border-yellow-500 shadow-[0_0_50px_rgba(251,191,36,0.5)] text-center">
								<div className="text-sm text-slate-400 uppercase tracking-widest mb-2">
									You Won
								</div>
								<div className="text-5xl font-black text-white mb-2">
									{result.label}
								</div>
								{result.icon && (
									<div className="text-6xl my-4">
										{result.icon}
									</div>
								)}
							</div>
						</div>
					)}
				</div>

				{/* Controls */}
				{!spinning && !claimed && (
					<button
						onClick={handleSpin}
						className="group relative px-12 py-6 bg-gradient-to-b from-red-500 to-red-700 text-white font-black text-3xl rounded-full shadow-[0_10px_0_rgb(153,27,27)] active:shadow-none active:translate-y-2 transition-all hover:scale-105 uppercase tracking-widest"
					>
						<span className="drop-shadow-md">SPIN!</span>

						{/* Button Glow */}
						<div className="absolute inset-0 rounded-full bg-red-500 blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
					</button>
				)}

				{/* Spinning Status */}
				{spinning && (
					<div className="text-2xl font-bold text-yellow-400 animate-pulse">
						SPINNING...
					</div>
				)}

				{/* Reward List (Mini) */}
				{!spinning && !claimed && (
					<div className="flex gap-4 opacity-50 text-xs">
						{WHEEL_REWARDS.map((r) => (
							<div
								key={r.id}
								className="flex flex-col items-center"
							>
								<div
									className="w-3 h-3 rounded-full mb-1"
									style={{ backgroundColor: r.color }}
								></div>
								<span className="text-slate-400">
									{r.label}
								</span>
							</div>
						)).slice(0, 5)}
						{/* Show first 5 or so */}
					</div>
				)}
			</div>
		</div>
	);
};
