import React from 'react';

interface CountdownOverlayProps {
	countdownNum: number | string;
}

export const CountdownOverlay: React.FC<CountdownOverlayProps> = ({
	countdownNum,
}) => {
	if (countdownNum === '') return null;

	return (
		<div className="absolute inset-0 flex items-center justify-center z-50 pointer-events-none">
			<div
				className={`font-black italic tracking-tighter ${
					countdownNum === 'GO!'
						? 'text-9xl text-green-500 scale-150'
						: typeof countdownNum === 'string'
						? 'text-4xl text-yellow-400 animate-pulse' // Waiting text
						: 'text-9xl text-white'
				} transition-all duration-300 drop-shadow-2xl`}
			>
				{countdownNum}
			</div>
		</div>
	);
};
