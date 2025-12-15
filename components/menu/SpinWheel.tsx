import React, { useRef, useEffect, useState } from 'react';
import { DailyReward } from '../../types';

interface SpinWheelProps {
	rewards: WheelReward[];
	result: WheelReward | null;
	onComplete: () => void;
	spinning: boolean;
}

export interface WheelReward {
	id: string;
	label: string;
	value: number | string;
	type: 'MONEY' | 'XP' | 'ITEM' | 'CRATE';
	color: string;
	probability: number;
	icon?: string;
}

// Easing function: easeOutCubic
const easeOutCubic = (t: number): number => {
	return 1 - Math.pow(1 - t, 3);
};

export const SpinWheel: React.FC<SpinWheelProps> = ({
	rewards,
	result,
	onComplete,
	spinning,
}) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const rotationRef = useRef(0);
	const isSpinningRef = useRef(false);
	const startTimeRef = useRef<number>(0);
	const startRotationRef = useRef(0);
	const finalRotationRef = useRef(0);
	const DURATION = 6000; // 6 seconds

	useEffect(() => {
		if (spinning && !isSpinningRef.current && result) {
			startSpin();
		}
	}, [spinning, result]);

	const startSpin = () => {
		if (!result) return;
		isSpinningRef.current = true;

		// Find index of result
		const index = rewards.findIndex((r) => r.id === result.id);
		if (index === -1) {
			console.error('Spin Result not found in rewards!');
			return;
		}

		// Calculate Target Angle
		// Segment Angle
		const segAngle = 360 / rewards.length;
		// Center of the target segment
		const targetSegCenter = index * segAngle + segAngle / 2;

		// Pointer is at 270 degrees (Top).
		// We want the wheel to be rotated such that targetSegCenter aligns with 270.
		// rotation + targetSegCenter = 270 (mod 360) ? No.
		// Visual Rotation involves standard canvas rotation (CW).
		// If we rotate CW by R, the segment at 0 (Right) moves to R.
		// We want segment at 'targetSegCenter' (initially) to move to 270.
		// So R + targetSegCenter = 270 + 360k
		// R = 270 - targetSegCenter

		// Add random jitter within the segment for realism (+/- 40% of half segment)
		const jitter = (Math.random() - 0.5) * (segAngle * 0.8);

		let targetRotation = 270 - (targetSegCenter + jitter);

		// Ensure positive climbs
		while (targetRotation < 0) targetRotation += 360;

		// Add spins (min 5, max 8)
		const spins = 5 + Math.floor(Math.random() * 3);
		const finalRot = targetRotation + spins * 360;

		startRotationRef.current = rotationRef.current % 360; // Start from current visual
		finalRotationRef.current = finalRot;
		startTimeRef.current = performance.now();

		requestAnimationFrame(animate);
	};

	const animate = (time: number) => {
		if (!isSpinningRef.current) return;

		const elapsed = time - startTimeRef.current;
		const progress = Math.min(elapsed / DURATION, 1);
		const ease = easeOutCubic(progress);

		const newRot =
			startRotationRef.current +
			(finalRotationRef.current - startRotationRef.current) * ease;
		rotationRef.current = newRot;

		drawWheel();

		if (progress < 1) {
			requestAnimationFrame(animate);
		} else {
			isSpinningRef.current = false;
			onComplete();
		}
	};

	const drawWheel = () => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		const CENTER = 250;
		const RADIUS = 240;

		ctx.clearRect(0, 0, 500, 500);

		ctx.save();
		ctx.translate(CENTER, CENTER);
		ctx.rotate((rotationRef.current * Math.PI) / 180);

		const segAngle = (2 * Math.PI) / rewards.length;

		rewards.forEach((reward, i) => {
			const startAngle = i * segAngle;
			const endAngle = (i + 1) * segAngle;

			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.arc(0, 0, RADIUS, startAngle, endAngle);
			ctx.fillStyle = reward.color;
			ctx.fill();
			ctx.lineWidth = 2;
			ctx.strokeStyle = '#1e293b'; // Slate-800
			ctx.stroke();

			// Text / Icon
			ctx.save();
			ctx.rotate(startAngle + segAngle / 2);
			ctx.textAlign = 'right';
			ctx.fillStyle = '#fff';

			// Icon
			if (reward.icon) {
				ctx.font = '32px serif';
				ctx.shadowColor = 'rgba(0,0,0,0.5)';
				ctx.shadowBlur = 4;
				ctx.fillText(reward.icon, RADIUS - 40, 10);
				ctx.shadowBlur = 0;
			}

			// Label
			ctx.font = 'bold 14px "Courier New", monospace';
			ctx.fillText(reward.label, RADIUS - 90, 5);

			ctx.restore();
		});

		ctx.restore();

		// Draw Pointer (Static)
		ctx.save();
		ctx.translate(CENTER, CENTER);

		// Outer Rim
		ctx.beginPath();
		ctx.arc(0, 0, RADIUS, 0, 2 * Math.PI);
		ctx.strokeStyle = '#fbbf24'; // Amber
		ctx.lineWidth = 8;
		ctx.stroke();

		// Triangle at top (270deg)
		// Check local coords: 0,0 is center. Top is 0,-RADIUS.
		ctx.fillStyle = '#ef4444'; // Red-500
		ctx.beginPath();
		ctx.moveTo(0, -RADIUS + 20); // Tip
		ctx.lineTo(-20, -RADIUS - 20); // Left
		ctx.lineTo(20, -RADIUS - 20); // Right
		ctx.closePath();
		ctx.fill();
		ctx.stroke(); // border

		// Center cap
		ctx.beginPath();
		ctx.arc(0, 0, 30, 0, 2 * Math.PI);
		ctx.fillStyle = '#1f2937';
		ctx.fill();
		ctx.lineWidth = 4;
		ctx.strokeStyle = '#fbbf24';
		ctx.stroke();

		// Center text
		ctx.fillStyle = '#fbbf24';
		ctx.font = 'bold 20px sans-serif';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.fillText('SPIN', 0, 1); // rough correction

		ctx.restore();
	};

	// Initial draw
	useEffect(() => {
		// Pre-rotate to random
		if (!spinning && rotationRef.current === 0) {
			rotationRef.current = Math.random() * 360;
		}
		drawWheel();
	}, [rewards]);

	return (
		<div className="relative w-[500px] h-[500px]">
			{/* Glow Effect */}
			<div
				className={`absolute inset-0 rounded-full transition-opacity duration-500 ${
					spinning
						? 'opacity-100 shadow-[0_0_50px_rgba(251,191,36,0.3)]'
						: 'opacity-0'
				}`}
			></div>

			<canvas
				ref={canvasRef}
				width={500}
				height={500}
				className="w-full h-full relative z-10"
			/>
		</div>
	);
};
