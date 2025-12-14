import React, { useEffect, useState } from 'react';

interface XPFloatingTextProps {
	startX: number;
	startY: number;
	endX: number;
	endY: number;
	amount: number;
	onComplete: () => void;
}

export const XPFloatingText: React.FC<XPFloatingTextProps> = ({
	startX,
	startY,
	endX,
	endY,
	amount,
	onComplete,
}) => {
	const [style, setStyle] = useState<React.CSSProperties>({
		position: 'fixed',
		left: startX,
		top: startY,
		opacity: 1,
		transform: 'scale(1)',
		transition: 'all 1s cubic-bezier(0.4, 0, 0.2, 1)',
		zIndex: 100,
		pointerEvents: 'none',
	});

	useEffect(() => {
		// Stage 1: Pop In (Start)
		requestAnimationFrame(() => {
			setStyle((prev) => ({
				...prev,
				opacity: 1,
				transform: 'scale(1.2)',
				transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)', // Speed up transition
			}));
		});

		// Stage 2: Settle (Start)
		const t1 = setTimeout(() => {
			setStyle((prev) => ({
				...prev,
				transform: 'scale(1)',
			}));
		}, 100);

		// Stage 3: Move to Target
		const t2 = setTimeout(() => {
			setStyle((prev) => ({
				...prev,
				left: endX,
				top: endY,
				transform: 'scale(0.8)',
			}));
		}, 400); // Read for 0.5s

		// Stage 4: Fade Out (Arrives at 600+500 = 1100ms)
		const t3 = setTimeout(() => {
			setStyle((prev) => ({
				...prev,
				opacity: 0,
				transform: 'scale(0.5)',
			}));
		}, 600);

		// Complete
		const t4 = setTimeout(() => {
			onComplete();
		}, 800);

		return () => {
			clearTimeout(t1);
			clearTimeout(t2);
			clearTimeout(t3);
			clearTimeout(t4);
		};
	}, [endX, endY, onComplete]);

	return (
		<div
			style={style}
			className="text-cyan-400 font-bold font-mono text-xl shadow-black drop-shadow-md"
		>
			+{amount} XP
		</div>
	);
};
