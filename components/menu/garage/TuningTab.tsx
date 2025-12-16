import React, { useState, useEffect } from 'react';
import { ModNode, SavedTune, TuningState } from '@/types';
import { MOD_TREE } from '@/constants';
import { useSound } from '@/contexts/SoundContext';
import { useGame } from '@/contexts/GameContext';
import PixelSlider from '@/components/ui/PixelSlider';

interface TuningTabProps {
	ownedMods: string[];
	disabledMods: string[];
	modSettings: Record<string, Record<string, number>>;
	setModSettings: (settings: Record<string, Record<string, number>>) => void;
	playerTuning: TuningState;
	setPlayerTuning: React.Dispatch<React.SetStateAction<TuningState>>;
	onLoadTune: (tune: SavedTune) => void;
	onBuyMods: (mods: ModNode[]) => void;
	money: number;
	baseTuning: TuningState;
}

const TuningTab: React.FC<TuningTabProps> = ({
	ownedMods,
	disabledMods,
	modSettings,
	setModSettings,
	playerTuning,
	setPlayerTuning,
	onLoadTune,
	onBuyMods,
	money,
	baseTuning,
}) => {
	const { play } = useSound();
	const { onManualTuningChange } = useGame();
	// Saved Tunes State
	const [savedTunes, setSavedTunes] = useState<SavedTune[]>([]);
	const [tuneName, setTuneName] = useState('');

	// Load tunes from localStorage on mount
	useEffect(() => {
		const saved = localStorage.getItem('shift_drift_tunes');
		if (saved) {
			try {
				setSavedTunes(JSON.parse(saved));
			} catch (e) {
				console.error('Failed to parse saved tunes', e);
			}
		}
	}, []);

	const handleSaveTune = () => {
		play('confirm');
		if (!tuneName.trim()) return;

		const newTune: SavedTune = {
			id: crypto.randomUUID(),
			name: tuneName.trim(),
			date: Date.now(),
			ownedMods,
			disabledMods,
			modSettings,
			manualTuning: {
				finalDriveRatio: playerTuning.finalDriveRatio,
				gearRatios: playerTuning.gearRatios,
				torqueCurve: playerTuning.torqueCurve,
			},
		};

		const updatedTunes = [...savedTunes, newTune];
		setSavedTunes(updatedTunes);
		localStorage.setItem('shift_drift_tunes', JSON.stringify(updatedTunes));
		setTuneName('');
	};

	const handleDeleteTune = (id: string) => {
		play('click');
		const updatedTunes = savedTunes.filter((t) => t.id !== id);
		setSavedTunes(updatedTunes);
		localStorage.setItem('shift_drift_tunes', JSON.stringify(updatedTunes));
	};

	const handleBuyMissing = (missingIds: string[]) => {
		// Find mod objects
		const missingMods = missingIds
			.map((id) => MOD_TREE.find((m) => m.id === id))
			.filter((m): m is ModNode => !!m);

		// Sort by X (left to right), then Y
		missingMods.sort((a, b) => {
			if (a.x !== b.x) return a.x - b.x;
			return a.y - b.y;
		});

		// Calculate affordable subset
		let currentMoney = money;
		const affordableMods: ModNode[] = [];

		for (const mod of missingMods) {
			if (currentMoney >= mod.cost) {
				affordableMods.push(mod);
				currentMoney -= mod.cost;
			} else {
				break; // Stop if we can't afford the next one in order
			}
		}

		if (affordableMods.length > 0) {
			play('purchase');
			onBuyMods(affordableMods);
		} else {
			play('error');
		}
	};

	return (
		<div className="space-y-6 font-pixel">
			{ownedMods.some(
				(id) =>
					!disabledMods.includes(id) &&
					MOD_TREE.find((m) => m.id === id)?.tuningOptions
			) && (
				<h3 className="text-sm font-bold text-indigo-400 uppercase border-b border-indigo-900/50 pb-2 mb-4 pixel-text">
					Mod Tuning
				</h3>
			)}
			{ownedMods
				.filter((id) => !disabledMods.includes(id))
				.map((modId) => {
					const mod = MOD_TREE.find((m) => m.id === modId);
					if (!mod || !mod.tuningOptions) return null;

					return (
						<div
							key={mod.id}
							className="bg-black/40 p-4 rounded border border-gray-800 pixel-panel"
						>
							<h4 className="text-indigo-400 font-bold mb-3 text-sm uppercase pixel-text">
								{mod.name}
							</h4>
							<div className="space-y-4">
								{mod.tuningOptions.map((option) => {
									const currentValue =
										modSettings[mod.id]?.[option.id] ??
										option.defaultValue;

									return (
										<div key={option.id}>
											<div className="flex justify-between text-xs text-gray-400 mb-1">
												<span>{option.name}</span>
												<span className="text-white font-mono">
													{currentValue} {option.unit}
												</span>
											</div>
											<PixelSlider
												min={option.min}
												max={option.max}
												step={option.step}
												value={currentValue}
												onChange={(val) => {
													setModSettings({
														...modSettings,
														[mod.id]: {
															...(modSettings[
																mod.id
															] || {}),
															[option.id]: val,
														},
													});
												}}
												color="indigo"
											/>
										</div>
									);
								})}
							</div>
						</div>
					);
				})}

			<h3 className="text-sm font-bold text-gray-400 uppercase border-b border-gray-800 pb-2 mb-4 mt-8 pixel-text">
				General Tuning
			</h3>

			<div className="space-y-4">
				{/* Statistics Overview */}
				<div className="mt-6">
					<label className="text-xs text-gray-500 block mb-3 font-bold">
						STATISTICS OVERVIEW
					</label>
					<div className="bg-black/40 p-4 rounded border border-gray-800 pixel-panel">
						<div className="grid grid-cols-2 gap-3">
							{/* Engine Stats */}
							<div className="space-y-1">
								<div className="text-[10px] text-cyan-400 font-bold uppercase mb-2">
									Engine
								</div>
								<div className="text-xs text-gray-300 font-mono">
									Max Torque:{' '}
									{playerTuning.maxTorque.toFixed(0)}{' '}
									{playerTuning.maxTorque !==
										baseTuning.maxTorque && (
										<span
											className={
												playerTuning.maxTorque >
												baseTuning.maxTorque
													? 'text-green-400'
													: 'text-red-400'
											}
										>
											(
											{playerTuning.maxTorque >
											baseTuning.maxTorque
												? '+'
												: ''}
											{(
												playerTuning.maxTorque -
												baseTuning.maxTorque
											).toFixed(0)}
											)
										</span>
									)}
								</div>
								<div className="text-xs text-gray-300 font-mono">
									Redline RPM:{' '}
									{playerTuning.redlineRPM.toFixed(0)}{' '}
									{playerTuning.redlineRPM !==
										baseTuning.redlineRPM && (
										<span
											className={
												playerTuning.redlineRPM >
												baseTuning.redlineRPM
													? 'text-green-400'
													: 'text-red-400'
											}
										>
											(
											{playerTuning.redlineRPM >
											baseTuning.redlineRPM
												? '+'
												: ''}
											{(
												playerTuning.redlineRPM -
												baseTuning.redlineRPM
											).toFixed(0)}
											)
										</span>
									)}
								</div>
								<div className="text-xs text-gray-300 font-mono">
									Idle RPM: {playerTuning.idleRPM.toFixed(0)}{' '}
									{playerTuning.idleRPM !==
										baseTuning.idleRPM && (
										<span
											className={
												playerTuning.idleRPM >
												baseTuning.idleRPM
													? 'text-yellow-400'
													: 'text-cyan-400'
											}
										>
											(
											{playerTuning.idleRPM >
											baseTuning.idleRPM
												? '+'
												: ''}
											{(
												playerTuning.idleRPM -
												baseTuning.idleRPM
											).toFixed(0)}
											)
										</span>
									)}
								</div>
								<div className="text-xs text-gray-300 font-mono">
									Flywheel Mass:{' '}
									{playerTuning.flywheelMass.toFixed(1)}{' '}
									{playerTuning.flywheelMass !==
										baseTuning.flywheelMass && (
										<span
											className={
												playerTuning.flywheelMass <
												baseTuning.flywheelMass
													? 'text-green-400'
													: 'text-red-400'
											}
										>
											(
											{playerTuning.flywheelMass >
											baseTuning.flywheelMass
												? '+'
												: ''}
											{(
												playerTuning.flywheelMass -
												baseTuning.flywheelMass
											).toFixed(1)}
											)
										</span>
									)}
								</div>
							</div>

							{/* Physics Stats */}
							<div className="space-y-1">
								<div className="text-[10px] text-purple-400 font-bold uppercase mb-2">
									Physics
								</div>
								<div className="text-xs text-gray-300 font-mono">
									Mass: {playerTuning.mass.toFixed(0)}{' '}
									{playerTuning.mass !== baseTuning.mass && (
										<span
											className={
												playerTuning.mass <
												baseTuning.mass
													? 'text-green-400'
													: 'text-red-400'
											}
										>
											(
											{playerTuning.mass > baseTuning.mass
												? '+'
												: ''}
											{(
												playerTuning.mass -
												baseTuning.mass
											).toFixed(0)}
											)
										</span>
									)}
								</div>
								<div className="text-xs text-gray-300 font-mono">
									Drag Coeff:{' '}
									{playerTuning.dragCoefficient.toFixed(2)}{' '}
									{playerTuning.dragCoefficient !==
										baseTuning.dragCoefficient && (
										<span
											className={
												playerTuning.dragCoefficient <
												baseTuning.dragCoefficient
													? 'text-green-400'
													: 'text-red-400'
											}
										>
											(
											{playerTuning.dragCoefficient >
											baseTuning.dragCoefficient
												? '+'
												: ''}
											{(
												playerTuning.dragCoefficient -
												baseTuning.dragCoefficient
											).toFixed(2)}
											)
										</span>
									)}
								</div>
								<div className="text-xs text-gray-300 font-mono">
									Tire Grip:{' '}
									{playerTuning.tireGrip.toFixed(1)}{' '}
									{playerTuning.tireGrip !==
										baseTuning.tireGrip && (
										<span
											className={
												playerTuning.tireGrip >
												baseTuning.tireGrip
													? 'text-green-400'
													: 'text-red-400'
											}
										>
											(
											{playerTuning.tireGrip >
											baseTuning.tireGrip
												? '+'
												: ''}
											{(
												playerTuning.tireGrip -
												baseTuning.tireGrip
											).toFixed(1)}
											)
										</span>
									)}
								</div>
								<div className="text-xs text-gray-300 font-mono">
									Braking Force:{' '}
									{playerTuning.brakingForce.toFixed(0)}{' '}
									{playerTuning.brakingForce !==
										baseTuning.brakingForce && (
										<span
											className={
												playerTuning.brakingForce >
												baseTuning.brakingForce
													? 'text-green-400'
													: 'text-red-400'
											}
										>
											(
											{playerTuning.brakingForce >
											baseTuning.brakingForce
												? '+'
												: ''}
											{(
												playerTuning.brakingForce -
												baseTuning.brakingForce
											).toFixed(0)}
											)
										</span>
									)}
								</div>
							</div>

							{/* Audio Stats */}
							<div className="space-y-1">
								<div className="text-[10px] text-orange-400 font-bold uppercase mb-2">
									Audio
								</div>
								<div className="text-xs text-gray-300 font-mono">
									Cylinders:{' '}
									{playerTuning.cylinders.toFixed(0)}{' '}
									{playerTuning.cylinders !==
										baseTuning.cylinders && (
										<span
											className={
												playerTuning.cylinders >
												baseTuning.cylinders
													? 'text-green-400'
													: 'text-red-400'
											}
										>
											(
											{playerTuning.cylinders >
											baseTuning.cylinders
												? '+'
												: ''}
											{(
												playerTuning.cylinders -
												baseTuning.cylinders
											).toFixed(0)}
											)
										</span>
									)}
								</div>
								<div className="text-xs text-gray-300 font-mono">
									Exhaust Open:{' '}
									{playerTuning.exhaustOpenness.toFixed(1)}{' '}
									{playerTuning.exhaustOpenness !==
										baseTuning.exhaustOpenness && (
										<span
											className={
												playerTuning.exhaustOpenness >
												baseTuning.exhaustOpenness
													? 'text-yellow-400'
													: 'text-cyan-400'
											}
										>
											(
											{playerTuning.exhaustOpenness >
											baseTuning.exhaustOpenness
												? '+'
												: ''}
											{(
												playerTuning.exhaustOpenness -
												baseTuning.exhaustOpenness
											).toFixed(1)}
											)
										</span>
									)}
								</div>
								<div className="text-xs text-gray-300 font-mono">
									Turbo Intensity:{' '}
									{playerTuning.turboIntensity.toFixed(1)}{' '}
									{playerTuning.turboIntensity !==
										baseTuning.turboIntensity && (
										<span
											className={
												playerTuning.turboIntensity >
												baseTuning.turboIntensity
													? 'text-green-400'
													: 'text-red-400'
											}
										>
											(
											{playerTuning.turboIntensity >
											baseTuning.turboIntensity
												? '+'
												: ''}
											{(
												playerTuning.turboIntensity -
												baseTuning.turboIntensity
											).toFixed(1)}
											)
										</span>
									)}
								</div>
								<div className="text-xs text-gray-300 font-mono">
									Backfire Aggr.:{' '}
									{playerTuning.backfireAggression.toFixed(1)}{' '}
									{playerTuning.backfireAggression !==
										baseTuning.backfireAggression && (
										<span
											className={
												playerTuning.backfireAggression >
												baseTuning.backfireAggression
													? 'text-yellow-400'
													: 'text-cyan-400'
											}
										>
											(
											{playerTuning.backfireAggression >
											baseTuning.backfireAggression
												? '+'
												: ''}
											{(
												playerTuning.backfireAggression -
												baseTuning.backfireAggression
											).toFixed(1)}
											)
										</span>
									)}
								</div>
							</div>

							{/* Transmission Stats */}
							<div className="space-y-1">
								<div className="text-[10px] text-indigo-400 font-bold uppercase mb-2">
									Transmission
								</div>
								<div className="text-xs text-gray-300 font-mono">
									Compression:{' '}
									{playerTuning.compressionRatio.toFixed(1)}{' '}
									{playerTuning.compressionRatio !==
										baseTuning.compressionRatio && (
										<span
											className={
												playerTuning.compressionRatio >
												baseTuning.compressionRatio
													? 'text-green-400'
													: 'text-red-400'
											}
										>
											(
											{playerTuning.compressionRatio >
											baseTuning.compressionRatio
												? '+'
												: ''}
											{(
												playerTuning.compressionRatio -
												baseTuning.compressionRatio
											).toFixed(1)}
											)
										</span>
									)}
								</div>
								<div className="text-xs text-gray-300 font-mono">
									Final Drive:{' '}
									{playerTuning.finalDriveRatio.toFixed(1)}{' '}
									{playerTuning.finalDriveRatio !==
										baseTuning.finalDriveRatio && (
										<span
											className={
												playerTuning.finalDriveRatio >
												baseTuning.finalDriveRatio
													? 'text-yellow-400'
													: 'text-cyan-400'
											}
										>
											(
											{playerTuning.finalDriveRatio >
											baseTuning.finalDriveRatio
												? '+'
												: ''}
											{(
												playerTuning.finalDriveRatio -
												baseTuning.finalDriveRatio
											).toFixed(1)}
											)
										</span>
									)}
								</div>
							</div>
						</div>
						<div className="text-[10px] text-gray-600 mt-3 pt-3 border-t border-gray-800">
							Stats show base value with +/- changes from
							installed mods and tuning
						</div>
					</div>
				</div>
				<div>
					<label className="text-xs text-gray-500 block mb-1">
						FINAL DRIVE RATIO ({playerTuning.finalDriveRatio})
					</label>
					<div className="relative">
						<PixelSlider
							min={2.0}
							max={5.0}
							step={0.1}
							value={playerTuning.finalDriveRatio}
							onChange={(val) =>
								onManualTuningChange({
									finalDriveRatio: val,
								})
							}
							color="cyan"
						/>
					</div>
					<div className="flex justify-between text-[10px] text-gray-600 mt-1">
						<span className="text-green-400">TOP SPEED</span>
						<span className="text-yellow-400">BALANCED</span>
						<span className="text-red-400">ACCEL</span>
					</div>
					<div className="mt-3 p-2 bg-black/50 rounded border border-gray-800">
						<div className="flex justify-between items-center">
							<div className="flex items-center gap-2">
								<div
									className={`w-2 h-2 rounded-full ${
										playerTuning.finalDriveRatio < 3.0
											? 'bg-green-500 animate-pulse'
											: 'bg-gray-700'
									}`}
								></div>
								<span className="text-[10px] text-gray-500">
									High Speed
								</span>
							</div>
							<div className="flex items-center gap-2">
								<div
									className={`w-2 h-2 rounded-full ${
										playerTuning.finalDriveRatio >= 3.0 &&
										playerTuning.finalDriveRatio <= 4.0
											? 'bg-yellow-500 animate-pulse'
											: 'bg-gray-700'
									}`}
								></div>
								<span className="text-[10px] text-gray-500">
									Balanced
								</span>
							</div>
							<div className="flex items-center gap-2">
								<div
									className={`w-2 h-2 rounded-full ${
										playerTuning.finalDriveRatio > 4.0
											? 'bg-red-500 animate-pulse'
											: 'bg-gray-700'
									}`}
								></div>
								<span className="text-[10px] text-gray-500">
									Quick Accel
								</span>
							</div>
						</div>
					</div>
				</div>

				{/* Gear Ratios */}
				<div className="mt-6">
					<label className="text-xs text-gray-500 block mb-3 font-bold">
						GEAR RATIOS
					</label>
					<div className="space-y-2">
						{[1, 2, 3, 4, 5, 6].map((gear) => (
							<div key={gear} className="flex items-center gap-3">
								<span className="text-xs text-gray-400 w-12">
									Gear {gear}:
								</span>
								<div className="flex-1">
									<PixelSlider
										min={0.5}
										max={4.0}
										step={0.05}
										value={playerTuning.gearRatios[gear]}
										onChange={(val) => {
											const newRatios = {
												...playerTuning.gearRatios,
											};
											newRatios[gear] = val;
											onManualTuningChange({
												gearRatios: newRatios,
											});
										}}
										color="purple"
									/>
								</div>
								<span className="text-xs text-white font-mono w-12 text-right">
									{playerTuning.gearRatios[gear].toFixed(2)}
								</span>
							</div>
						))}
					</div>
				</div>

				{/* Manage Tunes */}
				<div className="mt-8 pt-8 border-t border-gray-800">
					<h3 className="text-sm font-bold text-indigo-400 uppercase mb-4 pixel-text">
						Manage Tunes
					</h3>

					<div className="flex gap-2 mb-6">
						<input
							type="text"
							value={tuneName}
							onChange={(e) =>
								setTuneName(
									(e.target as HTMLInputElement).value
								)
							}
							placeholder="Tune Name..."
							className="flex-1 bg-black/50 border border-gray-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none font-pixel"
						/>
						<button
							onClick={handleSaveTune}
							disabled={!tuneName.trim()}
							className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold uppercase rounded hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed pixel-btn"
						>
							Save
						</button>
					</div>

					<div className="space-y-2 max-h-48 overflow-y-auto pr-2">
						{savedTunes.length === 0 ? (
							<div className="text-xs text-gray-600 italic text-center py-4">
								No saved tunes
							</div>
						) : (
							savedTunes.map((tune) => {
								const missingMods = (
									tune.ownedMods || []
								).filter((id) => !ownedMods.includes(id));
								const isLoadable = missingMods.length === 0;
								const missingCost = missingMods.reduce(
									(sum, id) =>
										sum +
										(MOD_TREE.find((m) => m.id === id)
											?.cost || 0),
									0
								);

								return (
									<div
										key={tune.id}
										className="flex items-center justify-between bg-gray-900/50 p-2 rounded border border-gray-800"
									>
										<div className="flex-1">
											<div className="text-xs font-bold text-gray-300">
												{tune.name}
											</div>
											<div className="text-[10px] text-gray-600">
												{new Date(
													tune.date
												).toLocaleDateString()}
											</div>
											{!isLoadable && (
												<div className="text-[10px] text-red-500 mt-1">
													Missing:{' '}
													{missingMods
														.map(
															(id) =>
																MOD_TREE.find(
																	(m) =>
																		m.id ===
																		id
																)?.name || id
														)
														.join(', ')}
													<div className="text-yellow-500 font-bold">
														Cost: ${missingCost}
													</div>
												</div>
											)}
										</div>
										<div className="flex gap-2">
											{isLoadable ? (
												<button
													onClick={() => {
														play('confirm');
														onLoadTune(tune);
													}}
													className="px-2 py-1 text-[10px] uppercase rounded border bg-green-900/50 text-green-400 border-green-900 hover:bg-green-900 pixel-btn"
												>
													Load
												</button>
											) : (
												<button
													onClick={() =>
														handleBuyMissing(
															missingMods
														)
													}
													className="px-2 py-1 text-[10px] uppercase rounded border bg-yellow-900/50 text-yellow-400 border-yellow-900 hover:bg-yellow-900 pixel-btn"
												>
													Buy Parts
												</button>
											)}
											<button
												onClick={() =>
													handleDeleteTune(tune.id)
												}
												className="px-2 py-1 bg-red-900/50 text-red-400 text-[10px] uppercase rounded border border-red-900 hover:bg-red-900 pixel-btn"
											>
												Del
											</button>
										</div>
									</div>
								);
							})
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default TuningTab;
