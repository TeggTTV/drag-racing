import React, { useState, useEffect } from 'react';
import { SKILL_TREE } from '../../constants';
import { useAuth } from '../../contexts/AuthContext';
import { useGame } from '../../contexts/GameContext';
import { SkillNode } from '../../types';

interface SkillTreeProps {
	onClose: () => void;
}

export const SkillTree: React.FC<SkillTreeProps> = ({ onClose }) => {
	const { settings, setSettings, saveGame, showToast } = useGame();
	const [points, setPoints] = useState(0);
	const [unlocked, setUnlocked] = useState<string[]>([]);
	const [hoverNode, setHoverNode] = useState<SkillNode | null>(null);

	// Load settings
	useEffect(() => {
		if (settings?.skills) {
			setPoints(settings.skills.points);
			setUnlocked(settings.skills.unlocked);
		} else {
			setPoints(1);
			setUnlocked([]);
		}
	}, [settings]);

	const handleUnlock = (node: SkillNode) => {
		if (unlocked.includes(node.id)) return;

		if (points < node.cost) {
			showToast('Not enough Skill Points!', 'ERROR');
			return;
		}

		if (node.parentId && !unlocked.includes(node.parentId)) {
			showToast('Must unlock parent skill first!', 'ERROR');
			return;
		}

		const newPoints = points - node.cost;
		const newUnlocked = [...unlocked, node.id];

		setPoints(newPoints);
		setUnlocked(newUnlocked);

		const newSettings = {
			...settings,
			skills: {
				points: newPoints,
				unlocked: newUnlocked,
			},
		};
		setSettings(newSettings);
		saveGame({ settings: newSettings });
		showToast(`Unlocked ${node.name}!`, 'SUCCESS');
	};

	// Determine node position / scale
	const SCALE_X = 140;
	const SCALE_Y = 140;
	const CENTER_X = 600;
	const CENTER_Y = 650;

	// Helper: Check unlock status
	const isUnlocked = (id: string) => unlocked.includes(id);
	const canUnlock = (node: SkillNode) => {
		return (
			!isUnlocked(node.id) &&
			points >= node.cost &&
			(!node.parentId || isUnlocked(node.parentId))
		);
	};

	const renderConnection = (node: SkillNode) => {
		if (!node.parentId) return null;
		const parent = SKILL_TREE.find((n) => n.id === node.parentId);
		if (!parent) return null;

		const x1 = parent.x * SCALE_X + CENTER_X;
		const y1 = parent.y * SCALE_Y + CENTER_Y;
		const x2 = node.x * SCALE_X + CENTER_X;
		const y2 = node.y * SCALE_Y + CENTER_Y;

		const active = isUnlocked(node.id);
		const parentActive = isUnlocked(parent.id);
		const reachable = !active && parentActive;

		return (
			<g key={`line-${node.id}`}>
				{/* Background Line */}
				<line
					x1={x1}
					y1={y1}
					x2={x2}
					y2={y2}
					stroke="#1f2937"
					strokeWidth="6"
					strokeLinecap="round"
				/>
				{/* Active/Progress Line */}
				<line
					x1={x1}
					y1={y1}
					x2={x2}
					y2={y2}
					stroke={
						active
							? '#fbbf24'
							: reachable
							? '#4b5563'
							: 'transparent'
					}
					strokeWidth="2"
					strokeDasharray={reachable ? '5,5' : 'none'}
					className={
						active
							? 'drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
							: ''
					}
				/>
				{/* Moving Pulse for Reachable */}
				{reachable && (
					<circle r="3" fill="#34d399">
						<animateMotion
							dur="2s"
							repeatCount="indefinite"
							path={`M${x1},${y1} L${x2},${y2}`}
						/>
					</circle>
				)}
			</g>
		);
	};

	return (
		<div className="fixed inset-0 bg-black/90 z-[150] flex flex-col items-center justify-center backdrop-blur-md">
			<div className="relative w-full max-w-6xl h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl flex flex-row font-sans">
				{/* --- LEFT SIDEBAR (Info) --- */}
				<div className="w-[350px] bg-slate-800/80 border-r border-slate-700 p-8 flex flex-col relative z-20 backdrop-blur-md shadow-xl">
					<div className="mb-8">
						<h2 className="text-4xl font-black text-white italic tracking-tighter uppercase mb-2 drop-shadow-lg">
							Driver Skills
						</h2>
						<div className="h-1 w-20 bg-yellow-500 rounded-full mb-4"></div>
						<div className="flex items-center space-x-2 text-gray-300 font-mono text-sm">
							<span className="text-yellow-400 font-bold text-xl">
								{points}
							</span>
							<span>SKILL POINTS AVAILABLE</span>
						</div>
					</div>

					{/* Hover Details Card */}
					<div className="flex-1 overflow-y-auto">
						{hoverNode ? (
							<div className="animate-slide-up space-y-4">
								<div
									className={`w-16 h-16 rounded-xl flex items-center justify-center text-3xl mb-4 border-2 shadow-lg
                                    ${
										hoverNode.branch === 'DRIVER'
											? 'bg-red-900/50 border-red-500 text-red-100'
											: hoverNode.branch === 'MECHANIC'
											? 'bg-blue-900/50 border-blue-500 text-blue-100'
											: 'bg-purple-900/50 border-purple-500 text-purple-100'
									}
                                `}
								>
									{hoverNode.branch === 'DRIVER'
										? '🏎️'
										: hoverNode.branch === 'MECHANIC'
										? '🔧'
										: '💎'}
								</div>

								<div className="pixel-text">
									<h3 className="text-2xl font-bold text-white leading-none mb-1">
										{hoverNode.name}
									</h3>
									<span
										className={`text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wider
                                        ${
											hoverNode.branch === 'DRIVER'
												? 'bg-red-500/20 text-red-400'
												: hoverNode.branch ===
												  'MECHANIC'
												? 'bg-blue-500/20 text-blue-400'
												: 'bg-purple-500/20 text-purple-400'
										}
                                    `}
									>
										{hoverNode.branch} BRANCH
									</span>
								</div>

								<p className="text-slate-300 text-base leading-relaxed border-l-2 border-slate-600 pl-4 py-1">
									{hoverNode.description}
								</p>

								<div className="bg-slate-900/50 rounded-lg p-4 space-y-2 border border-slate-700/50 mt-4">
									<div className="flex justify-between text-sm">
										<span className="text-slate-400">
											Unlock Cost
										</span>
										<span className="font-bold text-yellow-400">
											{hoverNode.cost} SP
										</span>
									</div>
									<div className="flex justify-between text-sm">
										<span className="text-slate-400">
											Status
										</span>
										<span
											className={`font-bold ${
												isUnlocked(hoverNode.id)
													? 'text-green-400'
													: canUnlock(hoverNode)
													? 'text-blue-400'
													: 'text-slate-500'
											}`}
										>
											{isUnlocked(hoverNode.id)
												? 'ACQUIRED'
												: canUnlock(hoverNode)
												? 'AVAILABLE'
												: 'LOCKED'}
										</span>
									</div>
								</div>

								{canUnlock(hoverNode) && (
									<div className="text-xs text-center text-green-300 animate-pulse mt-4">
										CLICK TO UNLOCK
									</div>
								)}
							</div>
						) : (
							<div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-50">
								<svg
									className="w-16 h-16 mb-4"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										strokeLinecap="round"
										strokeLinejoin="round"
										strokeWidth="1.5"
										d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
									></path>
								</svg>
								<p className="text-sm font-medium">
									Select a node to view details
								</p>
							</div>
						)}
					</div>

					<button
						onClick={onClose}
						className="mt-6 w-full py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded shadow-lg transform active:scale-95 transition-all text-sm uppercase tracking-widest border-b-4 border-red-800"
					>
						Close
					</button>
				</div>

				{/* --- MAIN CONTENT (Grid) --- */}
				<div className="flex-1 relative overflow-hidden bg-slate-900 perspective-1000">
					{/* Animated Grid Background */}
					<div
						className="absolute inset-0 opacity-20"
						style={{
							backgroundImage: `linear-gradient(#334155 1px, transparent 1px), linear-gradient(90deg, #334155 1px, transparent 1px)`,
							backgroundSize: '40px 40px',
							backgroundPosition: 'center center',
						}}
					></div>
					<div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-transparent to-slate-900 pointer-events-none"></div>

					<svg className="absolute inset-0 w-full h-full z-0">
						{SKILL_TREE.map(renderConnection)}
					</svg>

					<div className="absolute inset-0 z-10 w-full h-full">
						{SKILL_TREE.map((node) => {
							const active = isUnlocked(node.id);
							const available = canUnlock(node);

							const left = node.x * SCALE_X + CENTER_X;
							const top = node.y * SCALE_Y + CENTER_Y;
							const size = 64; // w-16

							return (
								<div
									key={node.id}
									onMouseEnter={() => setHoverNode(node)}
									// onMouseLeave={() => setHoverNode(null)} // Keep selected for better UX
									onClick={() => handleUnlock(node)}
									className={`absolute flex items-center justify-center rounded-full cursor-pointer transition-all duration-300
                                        ${
											active
												? 'w-20 h-20 -m-10 z-20 shadow-[0_0_30px_rgba(251,191,36,0.4)]'
												: 'w-16 h-16 -m-8 z-10 grayscale hover:grayscale-0'
										}
                                    `}
									style={{
										left: `${left}px`,
										top: `${top}px`,
									}}
								>
									{/* Outer Ring */}
									<div
										className={`absolute inset-0 rounded-full border-2 
                                        ${
											active
												? 'border-yellow-400 bg-yellow-900/80 animate-pulse-slow'
												: available
												? 'border-green-400 bg-slate-800/80 shadow-[0_0_15px_rgba(52,211,153,0.4)] animate-bounce-subtle'
												: 'border-slate-700 bg-slate-900/80'
										}
                                    `}
									></div>

									{/* Inner Icon */}
									<div className="relative z-10 text-2xl filter drop-shadow-md">
										{node.branch === 'DRIVER'
											? '🏎️'
											: node.branch === 'MECHANIC'
											? '🔧'
											: '💎'}
									</div>

									{/* Checkmark Badge */}
									{active && (
										<div className="absolute -bottom-1 -right-1 bg-yellow-500 text-black text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold shadow-sm z-30 border border-yellow-300">
											✓
										</div>
									)}

									{/* Cost Badge (if not unlocked) */}
									{!active && (
										<div
											className={`absolute -bottom-2 w-full text-center text-[10px] font-bold py-0.5 rounded-full 
                                            ${
												available
													? 'bg-green-500/90 text-black'
													: 'bg-slate-700 text-slate-400'
											}
                                        `}
										>
											{node.cost} SP
										</div>
									)}
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
};
