import React, { useEffect, useState } from 'react';
import { useMusic } from '../contexts/MusicContext';

interface PreloaderProps {
	onComplete: () => void;
}

const ASSETS_TO_LOAD = [
	{ type: 'image', src: '/seasonal-trees.png' },
	// Add other images here if needed
];

export const Preloader: React.FC<PreloaderProps> = ({ onComplete }) => {
	const [progress, setProgress] = useState(0);
	const [loaded, setLoaded] = useState(false);
	const [showProgress, setShowProgress] = useState(true);
	const [showButton, setShowButton] = useState(false); // New state for button fade-in
	// const { play } = useMusic(); // Pre-init music if possible?

	useEffect(() => {
		let loadedCount = 0;
		const total = ASSETS_TO_LOAD.length;

		if (total === 0) {
			setProgress(100);
			setLoaded(true);
			return;
		}

		const handleLoad = async () => {
			loadedCount++;
			setProgress(Math.round((loadedCount / total) * 100));
			if (loadedCount >= total) {
				// Artificial delay to feel "loaded" and smooth
				setTimeout(() => {
					setLoaded(true);
					// Fade out progress bar after short delay (match transition duration)
					setTimeout(() => setShowProgress(false), 600);
				}, 500);
			}
		};

		ASSETS_TO_LOAD.forEach(async (asset) => {
			if (asset.type === 'image') {
				const img = new Image();
				img.src = asset.src;
				img.onload = await handleLoad;
				img.onerror = await handleLoad; // Continue even if error
			}
		});
	}, []);

	// Trigger button fade-in when progress bar is hidden and loading is complete
	useEffect(() => {
		if (loaded && !showProgress) {
			// Slight delay to ensure progress bar fade completes before button appears
			setTimeout(() => setShowButton(true), 200);
		}
	}, [loaded, showProgress]);

	const handleStart = () => {
		// Initialize Audio Contexts on user gesture
		onComplete();
	};

	return (
		<div className="fixed inset-0 bg-black z-[9999] flex flex-col items-center justify-center text-white">
			<div className="text-4xl font-black italic tracking-tighter mb-8 animate-pulse text-indigo-500">
				SHIFT <span className="text-white">DRIFT</span>
			</div>

			{showProgress && (
				<div
					className="w-64 h-2 bg-gray-900 rounded-full overflow-hidden border border-gray-800 mb-4 transition-opacity duration-500 ease-out"
					style={{ opacity: showProgress ? 1 : 0 }}
				>
					<div
						className="h-full bg-indigo-500 transition-all duration-300 ease-out"
						style={{ width: `${progress}%` }}
					></div>
				</div>
			)}

			<div className="h-8">
				{showButton ? (
					<button
						onClick={handleStart}
						className="px-8 py-2 bg-white text-black font-bold font-mono rounded-full hover:bg-indigo-400 hover:text-white transition-opacity duration-500 opacity-100"
					>
						CLICK TO START
					</button>
				) : (
					<span className="text-xs text-gray-500 font-mono">
						LOADING ASSETS... {progress}%
					</span>
				)}
			</div>
		</div>
	);
};
