import React from 'react';

export const SavingIndicator: React.FC = () => {
	return (
		<div className="absolute bottom-4 left-4 z-[9999] flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-sm pointer-events-none transition-all duration-300 animate-pulse">
			{/* Floppy Disk Icon (Simple CSS Art or Unicode) */}
			<div className="w-3 h-3 border-2 border-white/70 rounded-sm relative">
				<div className="absolute top-0 right-0 w-1 h-1.5 bg-white/70"></div>
			</div>
			<span className="text-[10px] font-mono text-white/90 tracking-wider">
				SAVING...
			</span>
		</div>
	);
};
