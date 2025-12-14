import { useCallback } from 'react';
import { drawCar } from '../utils/renderUtils';
import { CarState, GamePhase, RaceStatus, Season } from '../types';

export const useRaceRenderer = () => {
	const PPM = 40; // Pixels Per Meter - Visual Scale

	const drawFrame = useCallback(
		(
			ctx: CanvasRenderingContext2D,
			canvas: HTMLCanvasElement,
			phase: GamePhase,
			p: CarState,
			o: CarState,
			raceDistance: number,
			weather: {
				type: 'SUNNY' | 'RAIN';
				season: Season;
				intensity: number;
			},
			bgTrees: { x: number; y: number; scale: number }[],
			seasonalTreesImg: HTMLImageElement | null,
			ownedMods: string[],
			playerColor: string,
			opponentColor: string,
			activeGhost: any[],
			raceStatus: RaceStatus,
			raceStartTime: number,
			time: number,
			particleSystem: any,
			dt: number,
			garage: any[],
			currentCarIndex: number,
			inputs: any
		) => {
			const carVisualY = -p.y * PPM;
			const screenOffset = canvas.height * 0.75; // Player sits 75% down the screen

			const camTransY = screenOffset + p.y * PPM;

			ctx.fillStyle = '#1e1e1e';
			ctx.fillRect(0, 0, canvas.width, canvas.height);

			ctx.save();

			ctx.translate(canvas.width / 2, 0);
			ctx.translate(0, camTransY);

			const trackWidth = 300;

			// Draw Track
			const finishVisualY = -raceDistance * PPM;
			const trackStartVisualY = 200 * PPM;
			const trackEndVisualY = finishVisualY - 500 * PPM;

			// Infinite Track Logic for Test Track
			let drawStartY = trackStartVisualY;
			let drawEndY = trackEndVisualY;

			if (phase === 'TEST_TRACK') {
				// Draw from behind camera to well ahead
				// Camera Y is camTransY. World Y is p.y.
				// We want to draw from p.y - 50 to p.y + 1000
				const worldStart = p.y - 50;
				const worldEnd = p.y + 1000;
				drawStartY = -worldStart * PPM;
				drawEndY = -worldEnd * PPM;
			}

			const totalHeight = drawStartY - drawEndY;

			// --- BACKGROUND RENDERING ---
			let groundColor = '#3CB371';
			if (weather.season === 'SPRING') groundColor = '#4ade80'; // Bright Green
			if (weather.season === 'SUMMER') groundColor = '#15803d'; // Deep Green
			if (weather.season === 'FALL') groundColor = '#d97706'; // Orange/Brown
			if (weather.season === 'WINTER') groundColor = '#f3f4f6'; // Snow White

			// Fill Full Background
			ctx.fillStyle = groundColor;
			ctx.fillRect(
				-canvas.width * 2,
				drawEndY - 2000,
				canvas.width * 4,
				Math.abs(drawStartY - drawEndY) + 4000
			);

			// Draw Trees (Background Layer)
			if (seasonalTreesImg) {
				// Select source X based on season
				let srcX = 0;
				if (weather.season === 'SUMMER') srcX = 256;
				if (weather.season === 'FALL') srcX = 512;
				if (weather.season === 'WINTER') srcX = 768;

				bgTrees.forEach((tree) => {
					const treeVisualY = -tree.y * PPM;
					// Cull if off screen
					if (
						treeVisualY + camTransY < -500 ||
						treeVisualY + camTransY > canvas.height + 500
					)
						return;

					const w = 256 * tree.scale * 0.5; // Scale down a bit, 256 is huge
					const h = 1024 * tree.scale * 0.5;

					// Shadow
					ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
					ctx.beginPath();
					ctx.ellipse(
						tree.x * PPM, // Center X
						treeVisualY + 10, // Center Y (slightly below anchor)
						w * 0.3, // Radius X
						w * 0.1, // Radius Y (flattened)
						0,
						0,
						Math.PI * 2
					);
					ctx.fill();

					ctx.drawImage(
						seasonalTreesImg,
						srcX,
						0,
						256,
						1024,
						tree.x * PPM - w / 2,
						treeVisualY - h + 20, // Anchor at bottom (approx)
						w,
						h
					);
				});
			}

			// Asphalt
			ctx.fillStyle = '#333';
			ctx.fillRect(-trackWidth / 2, drawEndY, trackWidth, totalHeight);

			// Start Line (Only if near start)
			if (p.y < 100) {
				const checkSize = 20;
				for (let r = 0; r < 2; r++) {
					for (let c = 0; c < trackWidth / checkSize; c++) {
						ctx.fillStyle = (r + c) % 2 === 0 ? '#fff' : '#000';
						ctx.fillRect(
							-trackWidth / 2 + c * checkSize,
							-r * checkSize,
							checkSize,
							checkSize
						);
					}
				}
			}

			// Finish Line (Only if NOT Test Track)
			if (phase !== 'TEST_TRACK') {
				const checkSize = 20;
				for (let r = 0; r < 3; r++) {
					for (let c = 0; c < trackWidth / checkSize; c++) {
						ctx.fillStyle = (r + c) % 2 === 0 ? '#fff' : '#000';
						ctx.fillRect(
							-trackWidth / 2 + c * checkSize,
							finishVisualY + r * checkSize,
							checkSize,
							checkSize
						);
					}
				}
			}

			// Lane Lines
			ctx.beginPath();
			ctx.strokeStyle = '#555';
			ctx.lineWidth = 4;
			ctx.setLineDash([40, 40]);
			// Fix dash movement by offsetting based on world position
			// We use negative offset because Y increases as we go forward
			ctx.lineDashOffset = -(p.y * PPM) % 80;
			ctx.moveTo(0, drawStartY);
			ctx.lineTo(0, drawEndY);
			ctx.stroke();
			ctx.setLineDash([]);
			ctx.lineDashOffset = 0;

			// Draw Cars
			if ((phase as string) !== 'TEST_TRACK') {
				drawCar(ctx, o, opponentColor, -trackWidth / 4);
			}
			const hasSpoiler = ownedMods.some((id) => id.includes('spoiler'));
			drawCar(ctx, p, playerColor, trackWidth / 4, hasSpoiler);

			// Draw Ghost
			if (activeGhost && raceStatus === 'RACING') {
				const raceTime = time - raceStartTime;
				// Find frame with closest time
				const ghostFrame = activeGhost.find((f) => f.time >= raceTime);

				if (ghostFrame) {
					ctx.globalAlpha = 0.3;
					drawCar(
						ctx,
						{
							y: ghostFrame.y,
							velocity: ghostFrame.velocity,
							rpm: ghostFrame.rpm,
							gear: ghostFrame.gear,
							finished: false,
							finishTime: 0,
						},
						'#ffffff', // Ghost color
						trackWidth / 4 // Same lane as player
					);
					ctx.globalAlpha = 1.0;
				}
			}

			// Update and Draw Particles
			particleSystem.update(dt);
			particleSystem.draw(ctx, 0); // Camera Y is handled by context transform

			// Emit Particles Logic
			// Tire Smoke (Burnout or Launch)
			// Simple logic: If high RPM and low speed (burnout)
			if (p.rpm > 4000 && p.velocity < 5 && inputs.gas) {
				// Burnout smoke
				particleSystem.emit(
					trackWidth / 4 / PPM - 0.5, // Left tire (meters)
					p.y,
					2,
					'SMOKE',
					{
						size: 5,
						life: 1.5,
						speed: 2,
						angle: Math.PI / 2,
						spread: 0.5,
						color: '#eeeeee',
					}
				);
			}

			// Nitrous Purge Visuals
			if (inputs.purge) {
				// Left and Right Vents
				[-0.3, 0.3].forEach((side) => {
					particleSystem.emit(
						trackWidth / 4 / PPM + side, // Offset from center
						p.y + 1.2, // Near windshield/cowl
						3,
						'SMOKE',
						{
							size: 4,
							life: 0.4,
							speed: 6,
							angle: side > 0 ? Math.PI * 0.2 : Math.PI * 0.8, // Shoot up and out
							spread: 0.1,
							color: '#ffffff',
						}
					);
				});
			}

			// Engine Smoke (Damage)
			const currentCar = garage[currentCarIndex];
			if (
				currentCar &&
				currentCar.condition !== undefined &&
				currentCar.condition < 0.8
			) {
				// More smoke for worse condition
				const damageSeverity = 0.8 - currentCar.condition; // 0.0 to 0.8
				const smokeChance = damageSeverity * 0.5; // Up to 40% chance per frame

				if (Math.random() < smokeChance) {
					// Randomize X position to simulate smoke coming from different parts of the engine/hood
					const xOffset = (Math.random() - 0.5) * 1.5;

					particleSystem.emit(
						trackWidth / 4 / PPM + xOffset, // Center of car + random spread
						p.y, // Front of car (user adjusted)
						1,
						'SMOKE',
						{
							size: 5 + damageSeverity * 10, // Bigger smoke
							life: 1.2,
							speed: 1 + p.velocity * 0.1,
							angle: Math.PI * 1.5,
							spread: 1.5, // Much wider spread
							color: '#555555',
						}
					);
				}
			}

			// Rain Visuals
			if (weather.type === 'RAIN') {
				ctx.save();
				ctx.strokeStyle = 'rgba(170, 190, 255, 0.5)';
				ctx.lineWidth = 1;
				ctx.beginPath();
				const rainCount = 100;
				const timeOffset = time * 1000; // Speed
				for (let i = 0; i < rainCount; i++) {
					// Random positions that loop
					const x =
						(((Math.sin(i) * 10000) % canvas.width) +
							canvas.width) %
						canvas.width;
					const y =
						(((Math.cos(i) * 10000 + timeOffset) % canvas.height) +
							canvas.height) %
						canvas.height;
					const len = 10 + (i % 10);

					ctx.moveTo(x, y);
					ctx.lineTo(x - 2, y + len); // Slanted rain
				}
				ctx.stroke();
				ctx.restore();
			}

			// Restore canvas transform
			ctx.restore();
		},
		[]
	);

	// Helper to draw menu background
	const drawMenuBackground = useCallback(
		(
			ctx: CanvasRenderingContext2D,
			canvas: HTMLCanvasElement,
			time: number
		) => {
			ctx.fillStyle = '#111';
			ctx.fillRect(0, 0, canvas.width, canvas.height);
			ctx.strokeStyle = '#222';
			ctx.lineWidth = 2;
			const timeOffset = (time / 50) % 50;
			for (let i = 0; i < canvas.height; i += 50) {
				ctx.beginPath();
				ctx.moveTo(0, i + timeOffset);
				ctx.lineTo(canvas.width, i + timeOffset);
				ctx.stroke();
			}
		},
		[]
	);

	return { drawFrame, drawMenuBackground };
};
