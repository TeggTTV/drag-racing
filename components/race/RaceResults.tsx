import React, { useState } from 'react';
import { TopBar } from '@/components/menu/shared/TopBar';
import { MasteryLevelUp } from '../MasteryLevelUp';
import {
	InventoryItem,
	SavedTune,
	Mission,
	TuningState,
	CarState,
	GamePhase,
} from '../../types';

interface RaceResultsProps {
	phase: GamePhase;
	raceResult: 'WIN' | 'LOSS' | null;
	level: number;
	xp: number;
	money: number;
	missionRef: React.MutableRefObject<Mission | null>;
	currentWagerRef: React.MutableRefObject<number>;
	playerFinishTime: number;
	opponentFinishTime: number;
	inventory: InventoryItem[];
	wearResult: Record<string, number> | null;
	opponentRef: React.MutableRefObject<CarState>;
	lastRaceMastery: { level: number; xp: number; gain: number } | null;
	startTestTrack: () => void;
	onExit: () => void;
	startMission: (mission: Mission) => void;
	onLeaveOnlineRace: () => void;
}

export const RaceResults: React.FC<RaceResultsProps> = ({
	phase,
	raceResult,
	level,
	xp,
	money,
	missionRef,
	currentWagerRef,
	playerFinishTime,
	opponentFinishTime,
	inventory,
	wearResult,
	opponentRef,
	lastRaceMastery,
	startTestTrack,
	onExit,
	startMission,
	onLeaveOnlineRace,
}) => {
	const [showConditionTab, setShowConditionTab] = useState(false);

	if (!raceResult) return null;

	return (
		<div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-[100] animate-in fade-in duration-500">
			{/* TopBar for XP/Level Animations (Hide in Test Track) */}
			{phase !== 'TEST_TRACK' && (
				<div className="absolute top-0 left-0 right-0 z-50">
					<TopBar
						level={level}
						xp={xp}
						money={money}
						initialXp={
							raceResult === 'WIN'
								? xp - (missionRef.current?.xpReward || 100)
								: xp
						}
						initialMoney={
							raceResult === 'WIN'
								? money -
								  (missionRef.current?.payout || 0) -
								  currentWagerRef.current
								: raceResult === 'LOSS'
								? money + currentWagerRef.current
								: money
						}
					/>
				</div>
			)}

			<h1
				className={`text-8xl font-black italic mb-4 ${
					raceResult === 'WIN' ? 'text-green-500' : 'text-white'
				}`}
			>
				{phase === 'TEST_TRACK'
					? 'TEST COMPLETE'
					: raceResult === 'WIN'
					? 'VICTORY'
					: 'DEFEAT'}
			</h1>
			<div className="text-4xl font-mono text-white mb-2">
				TIME: {playerFinishTime.toFixed(3)}s
			</div>

			{/* Online Race Results Tabs */}
			{phase === 'ONLINE_RACE' ? (
				<div className="bg-gray-900/90 border-2 border-gray-700 p-6 rounded-lg mb-8 max-w-2xl w-full">
					{/* Tabs Header */}
					<div className="flex border-b border-gray-700 mb-4">
						<button
							className={`flex-1 py-2 text-center font-pixel text-sm ${
								!showConditionTab
									? 'text-white bg-gray-800 border-b-2 border-cyan-500'
									: 'text-gray-400 hover:text-white'
							}`}
							onClick={() => setShowConditionTab(false)}
						>
							SCOREBOARD
						</button>
						<button
							className={`flex-1 py-2 text-center font-pixel text-sm ${
								showConditionTab
									? 'text-white bg-gray-800 border-b-2 border-cyan-500'
									: 'text-gray-400 hover:text-white'
							}`}
							onClick={() => setShowConditionTab(true)}
						>
							PART CONDITION
						</button>
					</div>

					{/* Tab Content */}
					{!showConditionTab ? (
						<div className="space-y-2">
							<div className="flex justify-between text-gray-500 text-xs px-2 mb-2">
								<span>RACER</span>
								<span>TIME</span>
							</div>
							{/* Player */}
							<div className="flex justify-between items-center bg-black/40 p-3 border border-gray-700">
								<div className="flex items-center gap-2">
									<span className="text-yellow-400 font-bold">
										1.
									</span>
									<span className="text-white">YOU</span>
								</div>
								<span className="font-mono text-cyan-400">
									{playerFinishTime.toFixed(3)}s
								</span>
							</div>
							{/* Opponent (Static for now, should be dynamic list) */}
							<div
								className={`flex justify-between items-center p-3 border border-gray-800 ${
									opponentRef.current.finished
										? 'bg-black/40'
										: 'bg-black/20 opacity-50'
								}`}
							>
								<div className="flex items-center gap-2">
									<span className="text-gray-500 font-bold">
										2.
									</span>
									<span className="text-gray-300">
										OPPONENT
									</span>
								</div>
								<span className="font-mono text-gray-400">
									{opponentRef.current.finished
										? `${opponentRef.current.finishTime.toFixed(
												3
										  )}s`
										: '--.--'}
								</span>
							</div>
						</div>
					) : (
						<div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
							{inventory
								.filter(
									(i) =>
										i.equipped &&
										wearResult &&
										wearResult[i.instanceId]
								)
								.map((item) => {
									const damage = wearResult![item.instanceId];
									const current = item.condition || 100;
									const old = current + damage;
									const getColor = (val: number) => {
										if (val > 80) return 'text-green-400';
										if (val > 50) return 'text-yellow-400';
										return 'text-red-500';
									};
									return (
										<div
											key={item.instanceId}
											className="flex justify-between items-center bg-black/40 p-2 rounded border border-gray-800"
										>
											<div className="text-sm text-gray-300 font-bold truncate w-1/2">
												{item.name}
											</div>
											<div className="flex items-center gap-2 font-mono text-xs">
												<span className={getColor(old)}>
													{Math.round(old)}%
												</span>
												<span className="text-gray-600">
													➜
												</span>
												<span
													className={`${getColor(
														current
													)} animate-pulse font-bold`}
												>
													{Math.round(current)}%
												</span>
												<span className="text-red-500 text-[10px]">
													(-{damage.toFixed(1)}%)
												</span>
											</div>
										</div>
									);
								})}
						</div>
					)}

					{/* Navigation Button */}
					<div className="mt-6 flex justify-end">
						{!showConditionTab ? (
							<button
								onClick={() => setShowConditionTab(true)}
								className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 font-pixel text-sm"
							>
								NEXT &gt;
							</button>
						) : (
							<button
								onClick={() => setShowConditionTab(false)}
								className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 font-pixel text-sm mr-auto"
							>
								&lt; BACK
							</button>
						)}
					</div>
				</div>
			) : (
				// Standard Single Player Wear Results
				wearResult &&
				inventory.filter((i) => i.equipped && wearResult[i.instanceId])
					.length > 0 && (
					<div className="bg-gray-900/90 border-2 border-gray-700 p-6 rounded-lg mb-8 max-w-2xl w-full">
						<h3 className="text-xl text-gray-400 pixel-text mb-4 text-center border-b border-gray-700 pb-2">
							PART CONDITION
						</h3>
						<div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto pr-2 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']">
							{inventory
								.filter(
									(i) =>
										i.equipped && wearResult[i.instanceId]
								)
								.map((item) => {
									const damage = wearResult[item.instanceId]; // e.g. 0.5 (points)
									const current = item.condition || 100;
									const old = current + damage;

									// Determine color (using 50/80 scale)
									const getColor = (val: number) => {
										if (val > 80) return 'text-green-400';
										if (val > 50) return 'text-yellow-400';
										return 'text-red-500';
									};

									return (
										<div
											key={item.instanceId}
											className="flex justify-between items-center bg-black/40 p-2 rounded border border-gray-800"
										>
											<div className="text-sm text-gray-300 font-bold truncate w-1/2">
												{item.name}
											</div>
											<div className="flex items-center gap-2 font-mono text-xs">
												<span className={getColor(old)}>
													{Math.round(old)}%
												</span>
												<span className="text-gray-600">
													➜
												</span>
												<span
													className={`${getColor(
														current
													)} animate-pulse font-bold`}
												>
													{Math.round(current)}%
												</span>
												<span className="text-red-500 text-[10px]">
													(-{damage.toFixed(1)}%)
												</span>
											</div>
										</div>
									);
								})}
						</div>
					</div>
				)
			)}
			{raceResult === 'WIN' && (
				<div className="text-2xl text-green-400 font-mono mb-8">
					EARNED $
					{phase === 'ONLINE_RACE'
						? currentWagerRef.current * 2
						: missionRef.current?.payout}
				</div>
			)}
			{/* Mastery Animation */}
			{lastRaceMastery && (
				<div className="w-full max-w-lg mb-4">
					<MasteryLevelUp
						initialLevel={lastRaceMastery.level}
						initialXP={lastRaceMastery.xp}
						xpGain={lastRaceMastery.gain}
					/>
				</div>
			)}
			{raceResult === 'LOSS' && (
				<div className="text-2xl text-red-400 font-mono mb-8">
					{playerFinishTime - opponentFinishTime > 0 ? '+' : ''}
					{(playerFinishTime - opponentFinishTime).toFixed(3)}s
				</div>
			)}
			<div className="flex gap-4 mt-8">
				{phase === 'TEST_TRACK' ? (
					<>
						<button
							onClick={startTestTrack}
							className="px-8 py-4 bg-green-600 text-white font-bold text-xl hover:bg-green-500 uppercase"
						>
							AGAIN
						</button>
						<button
							onClick={onExit}
							className="px-8 py-4 bg-gray-800 text-white font-bold text-xl hover:bg-gray-700 uppercase"
						>
							Back to Garage
						</button>
					</>
				) : (
					<>
						{phase !== 'ONLINE_RACE' && (
							<button
								onClick={() => {
									if (missionRef.current) {
										startMission(missionRef.current);
									} else {
										// Fallback
										onExit(); // Maps to setPhase('MAP') conceptually based on expected usage, but caller needs to handle
									}
								}}
								className="px-8 py-4 bg-green-600 text-white font-bold text-xl hover:bg-green-500 uppercase"
							>
								RACE AGAIN
							</button>
						)}
						<button
							onClick={onLeaveOnlineRace}
							className="px-8 py-4 bg-gray-800 text-white font-bold text-xl hover:bg-gray-700 uppercase"
						>
							BACK TO MENU
						</button>
					</>
				)}
			</div>
		</div>
	);
};
