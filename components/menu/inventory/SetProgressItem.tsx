import React, { useState } from 'react';

// This is a helper component for the set progress section
export const SetProgressItem = ({ setData }: { setData: any }) => {
	const [showTooltip, setShowTooltip] = useState(false);

	return (
		<div
			className="relative"
			onMouseEnter={() => setShowTooltip(true)}
			onMouseLeave={() => setShowTooltip(false)}
		>
			<div
				className="bg-black/40 border rounded px-2 py-1 transition-all hover:bg-black/60 cursor-pointer"
				style={{
					borderColor: setData.set.color || '#666',
				}}
			>
				<div className="flex items-center justify-between">
					<span
						className="text-[10px] font-bold truncate flex-1"
						style={{
							color: setData.set.color || '#888',
						}}
					>
						{setData.isComplete && <span className="mr-1">✓</span>}
						{setData.set.name}
					</span>
					<span className="text-[9px] text-gray-500 font-mono ml-2">
						{setData.installedCount}/{setData.total}
					</span>
				</div>

				{/* Progress Bar */}
				<div className="w-full bg-gray-800 rounded-full h-1 mt-1 overflow-hidden">
					<div
						className="h-full transition-all duration-300 rounded-full"
						style={{
							width: `${setData.percentage}%`,
							backgroundColor: setData.set.color || '#666',
							boxShadow: `0 0 4px ${setData.set.color}80`,
						}}
					/>
				</div>
			</div>

			{/* Tooltip with bonuses - Only show if complete and hovered */}
			{setData.isComplete && showTooltip && (
				<div
					className="absolute left-full ml-2 top-0 z-50 bg-black/95 border-2 rounded-lg p-2 shadow-2xl pointer-events-none min-w-[200px]"
					style={{
						borderColor: setData.set.color || '#666',
					}}
				>
					<div
						className="text-[10px] font-bold mb-1.5 pb-1 border-b"
						style={{
							color: setData.set.color || '#888',
							borderColor: `${setData.set.color}40`,
						}}
					>
						✓ ACTIVE BONUSES
					</div>
					<div className="flex flex-col gap-0.5">
						{/* Bonus Stats */}
						{Object.entries(setData.set.bonusStats || {}).map(
							([stat, value]: [string, any]) => {
								const statName = stat
									.replace(/([A-Z])/g, ' $1')
									.trim()
									.toUpperCase();

								return (
									<div
										key={stat}
										className="text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1"
										style={{
											backgroundColor: `${setData.set.color}15`,
											borderLeft: `2px solid ${setData.set.color}`,
										}}
									>
										<span
											className="font-bold"
											style={{
												color: setData.set.color,
											}}
										>
											{value > 0 ? '+' : ''}
											{value}
										</span>
										<span className="text-gray-300">
											{statName}
										</span>
									</div>
								);
							}
						)}
						{/* Bonus Multipliers */}
						{Object.entries(setData.set.bonusMultipliers || {}).map(
							([stat, value]: [string, any]) => {
								const statName = stat
									.replace(/([A-Z])/g, ' $1')
									.trim()
									.toUpperCase();

								const percentChange = (
									(value - 1) *
									100
								).toFixed(0);

								return (
									<div
										key={stat}
										className="text-[9px] px-1.5 py-0.5 rounded flex items-center gap-1"
										style={{
											backgroundColor: `${setData.set.color}20`,
											borderLeft: `2px solid ${setData.set.color}`,
										}}
									>
										<span
											className="font-bold"
											style={{
												color: setData.set.color,
											}}
										>
											+{percentChange}%
										</span>
										<span className="text-gray-300">
											{statName}
										</span>
									</div>
								);
							}
						)}
					</div>
				</div>
			)}
		</div>
	);
};
