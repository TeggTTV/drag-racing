import { CarState, TuningState } from '../types';
import { GameSettings } from '../contexts/GameContext';

interface DashboardProps {
	carState: CarState;
	tuning: TuningState;
	opponentState?: CarState;
	raceDistance: number;
	missedGear?: boolean;
	settings?: GameSettings;
	inputs?: any; // InputState
}

const Dashboard: React.FC<DashboardProps> = ({
	carState,
	tuning,
	opponentState,
	raceDistance,
	missedGear,
	settings,
	inputs,
}) => {
	const speedKmh = Math.floor(carState.velocity * 3.6);
	const rpm = Math.round(carState.rpm);
	const gearLabel = carState.gear === 0 ? 'N' : carState.gear;

	// Ensure valid calculation even if redline is weird, default to 7000 if 0
	const redline = tuning.redlineRPM || 7000;
	const rpmPercent = Math.min((carState.rpm / redline) * 100, 100);

	// Shift Light Logic
	let isShiftPoint = false;
	if (settings?.shiftLightRPM && settings.shiftLightRPM > 0) {
		isShiftPoint = carState.rpm >= settings.shiftLightRPM;
	} else {
		isShiftPoint = rpmPercent > 90;
	}

	const isRedline = rpmPercent >= 98;

	// Progress Bar
	const safeDistance = raceDistance || 400;
	const userProgress = Math.max(
		0,
		Math.min((carState.y / safeDistance) * 100, 100)
	);
	const oppProgress = opponentState
		? Math.max(0, Math.min((opponentState.y / safeDistance) * 100, 100))
		: 0;

	return (
		<div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col justify-between p-4 z-50">
			{/* Race Progress Top Bar */}
			<div className="w-full max-w-2xl mx-auto mt-4 bg-gray-900/90 rounded-full h-6 border-2 border-white/20 relative">
				{/* Finish Line Marker */}
				<div className="absolute right-0 top-0 h-full w-4 bg-white/10 z-0 flex items-center justify-center border-l border-white/30"></div>

				{/* Opponent Dot */}
				{opponentState && (
					<div
						className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,1)] border border-white/50 z-10 transition-none"
						style={{ left: `calc(${oppProgress}% - 8px)` }}
					></div>
				)}

				{/* Player Dot */}
				<div
					className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-blue-500 border-2 border-white rounded-full shadow-[0_0_15px_rgba(59,130,246,1)] z-20 transition-none"
					style={{ left: `calc(${userProgress}% - 10px)` }}
				></div>

				{/* Labels */}
				<div className="absolute -bottom-6 left-0 text-[10px] text-gray-400 font-mono">
					START
				</div>
				<div className="absolute -bottom-6 right-0 text-[10px] text-gray-400 font-mono">
					FINISH
				</div>
			</div>

			{/* Bottom Cluster - More compact */}
			<div className="flex justify-center items-end w-full mb-2">
				<div className="bg-black/80 p-3 rounded-xl border border-gray-800 shadow-2xl flex items-center gap-4 relative overflow-hidden">
					{/* Shift Light Glow Background */}
					<div
						className={`absolute inset-0 transition-opacity duration-100 ${
							isRedline
								? 'bg-red-600/30 animate-pulse'
								: isShiftPoint
								? 'bg-yellow-500/10'
								: 'opacity-0'
						}`}
					></div>

					{/* Gear Display */}
					<div className="text-center relative z-10 flex flex-col items-center">
						<div className="text-[10px] text-gray-500 font-mono mb-0.5">
							GEAR
						</div>
						<div
							className={`text-4xl font-black font-mono w-16 h-16 flex items-center justify-center rounded-lg border-2 ${
								isShiftPoint
									? 'border-yellow-500 text-yellow-500'
									: 'border-gray-700 text-white'
							} bg-gray-900`}
						>
							{gearLabel}
						</div>

						{/* Clutch Indicator (if manual) */}
						{settings?.manualClutch && (
							<div className="w-16 h-1 bg-gray-800 mt-1 rounded overflow-hidden">
								<div
									className={`h-full bg-blue-500 transition-all duration-75`}
									style={{
										width: inputs?.clutch ? '100%' : '0%',
									}}
								></div>
								<div
									className={`text-[8px] text-center mt-0.5 ${
										inputs?.clutch
											? 'text-blue-400 font-bold'
											: 'text-gray-600'
									}`}
								>
									CLUTCH
								</div>
							</div>
						)}
					</div>

					{/* Center Tacho */}
					<div className="relative z-10 w-64">
						<div className="flex justify-between text-[10px] font-mono text-gray-400 mb-0.5">
							<span>RPM</span>
							<span className="text-white">{rpm}</span>
						</div>
						{/* RPM Bar */}
						<div className="h-6 bg-gray-800 rounded-lg overflow-hidden border border-gray-700 relative">
							{/* Tick Marks */}
							<div className="absolute top-0 left-[25%] bottom-0 w-0.5 bg-gray-700 z-0"></div>
							<div className="absolute top-0 left-[50%] bottom-0 w-0.5 bg-gray-700 z-0"></div>
							<div className="absolute top-0 left-[75%] bottom-0 w-0.5 bg-gray-700 z-0"></div>

							{/* Redline Marker */}
							<div className="absolute top-0 left-[90%] bottom-0 w-full bg-red-900/30 z-0"></div>

							<div
								className={`h-full ease-out ${
									isRedline
										? 'bg-red-500'
										: isShiftPoint
										? 'bg-yellow-400'
										: 'bg-gradient-to-r from-blue-600 to-blue-400'
								}`}
								style={{ width: `${rpmPercent}%` }}
							></div>
						</div>

						{/* Tire Temp & Brake (Right Side) */}
						{settings?.realisticTires && (
							<div className="absolute -right-16 top-0 bottom-0 w-12 flex flex-col justify-center gap-2">
								{/* Tire Temp */}
								<div className="flex flex-col items-center">
									<div className="text-[8px] text-gray-500 mb-0.5">
										TIRE
									</div>
									<div className="w-2 h-16 bg-gray-800 rounded-full overflow-hidden relative border border-gray-700">
										<div
											className={`absolute bottom-0 left-0 right-0 transition-all duration-300 ${
												(carState.tireTemp || 20) > 90
													? 'bg-red-500'
													: (carState.tireTemp ||
															20) < 40
													? 'bg-blue-500'
													: 'bg-green-500'
											}`}
											style={{
												height: `${Math.min(
													100,
													carState.tireTemp || 20
												)}%`,
											}}
										></div>
									</div>
									<div className="text-[8px] text-gray-400 mt-0.5">
										{(carState.tireTemp || 20).toFixed(0)}°
									</div>
								</div>

								{/* Brake Indicator */}
								<div className="flex flex-col items-center mt-2">
									<div
										className={`text-[8px] font-bold mb-0.5 ${
											inputs?.brake
												? 'text-red-500'
												: 'text-gray-700'
										}`}
									>
										BRAKE
									</div>
									<div
										className={`w-3 h-3 rounded-full border border-gray-700 ${
											inputs?.brake
												? 'bg-red-600 shadow-[0_0_8px_rgba(220,38,38,1)]'
												: 'bg-gray-900'
										}`}
									></div>
								</div>
							</div>
						)}
						<div className="flex justify-between text-[9px] text-gray-600 mt-0.5 font-mono">
							<span>0</span>
							<span>{Math.round(redline / 2)}</span>
							<span className="text-red-500">
								{redline.toFixed(0)}
							</span>
						</div>
					</div>

					{/* Speed & Stats */}
					<div className="text-right relative z-10 w-24 flex flex-col items-end">
						<div className="text-5xl font-bold italic tracking-tighter text-white leading-none">
							{speedKmh}
						</div>
						<div className="text-sm font-bold text-gray-500 mb-1">
							KM/H
						</div>

						<div className="flex items-center gap-1 text-[10px] font-mono text-gray-400 border-t border-gray-800 pt-1 w-full justify-end">
							<span>DIST</span>
							<span className="text-white">
								{Math.floor(carState.y)}m
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* Shift Hint */}
			{isShiftPoint && !isRedline && !missedGear && (
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-yellow-400 font-black text-6xl italic animate-pulse tracking-widest pointer-events-none drop-shadow-lg opacity-80">
					SHIFT!
				</div>
			)}

			{/* Missed Gear Alert */}
			{missedGear && (
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center pointer-events-none z-[100]">
					<div className="text-red-600 font-black text-7xl italic animate-bounce tracking-widest drop-shadow-[0_0_20px_rgba(220,38,38,0.8)]">
						GRIND!
					</div>
					<div className="text-white font-bold text-2xl mt-2 bg-red-900/80 px-4 py-1 rounded">
						MISSED SHIFT
					</div>
				</div>
			)}
		</div>
	);
};

export default Dashboard;
