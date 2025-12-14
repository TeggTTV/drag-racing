import React, { useEffect, useState } from 'react';
import { InventoryItem } from '../../../types';
import { ItemCard } from '../../ui/ItemCard';

interface FloatingItemProps {
	item: InventoryItem;
	startX: number;
	startY: number;
	endX: number;
	endY: number;
	onComplete: () => void;
}

export const FloatingItem: React.FC<FloatingItemProps> = ({
	item,
	startX,
	startY,
	endX,
	endY,
	onComplete,
}) => {
	const [style, setStyle] = useState<React.CSSProperties>({
		position: 'fixed',
		left: startX,
		top: startY,
		opacity: 1,
		transform: 'scale(1) translate(-50%, -50%)',
		transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
		zIndex: 150,
		pointerEvents: 'none',
		width: '80px', // Mini card size
	});

	useEffect(() => {
		requestAnimationFrame(() => {
			setStyle((prev) => ({
				...prev,
				left: endX,
				top: endY,
				transform: 'scale(0.5) translate(-50%, -50%)',
				opacity: 0.5,
			}));
		});

		const timer = setTimeout(() => {
			onComplete();
		}, 600);

		return () => clearTimeout(timer);
	}, [endX, endY, onComplete]);

	return (
		<div style={style}>
			<ItemCard
				item={item}
				showCondition={false}
				className="shadow-2xl"
			/>
		</div>
	);
};
