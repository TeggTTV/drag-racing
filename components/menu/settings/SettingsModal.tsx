import React, { useState, useEffect } from 'react';
import { useMusic } from '@/contexts/MusicContext';
import { useSound } from '@/contexts/SoundContext';
import { useGame } from '@/contexts/GameContext';
import PixelSlider from '@/components/ui/PixelSlider';

interface SettingsModalProps {
	isOpen: boolean;
	onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
	const music = useMusic();
	const { play } = useSound();
	const { settings, setSettings } = useGame();

	const [musicVolume, setMusicVolume] = useState(music.getVolume() * 100);
	const [sfxVolume, setSfxVolume] = useState(100);
	const [isMusicEnabled, setIsMusicEnabled] = useState(true);
	const [isEngineSoundEnabled, setIsEngineSoundEnabled] = useState(true);
	const [isUISoundEnabled, setIsUISoundEnabled] = useState(true);

	useEffect(() => {
		// Load initial volume
		setMusicVolume(music.getVolume() * 100);

		// Load saved preferences from localStorage
		const savedSfxVolume = localStorage.getItem('sfxVolume');
		const savedMusicEnabled = localStorage.getItem('musicEnabled');
		const savedEngineSound = localStorage.getItem('engineSoundEnabled');
		const savedUISound = localStorage.getItem('uiSoundEnabled');

		if (savedSfxVolume) setSfxVolume(parseFloat(savedSfxVolume));
		if (savedMusicEnabled) setIsMusicEnabled(savedMusicEnabled === 'true');
		if (savedEngineSound)
			setIsEngineSoundEnabled(savedEngineSound === 'true');
		if (savedUISound) setIsUISoundEnabled(savedUISound === 'true');
	}, [music]);

	const handleMusicVolumeChange = (value: number) => {
		setMusicVolume(value);
		music.setVolume(value / 100);
	};

	const handleSfxVolumeChange = (value: number) => {
		setSfxVolume(value);
		localStorage.setItem('sfxVolume', value.toString());
		// TODO: Apply to AudioEngine when integrated
	};

	const toggleMusicEnabled = () => {
		const newValue = !isMusicEnabled;
		setIsMusicEnabled(newValue);
		localStorage.setItem('musicEnabled', newValue.toString());

		if (newValue) {
			music.unmute();
		} else {
			music.mute();
		}
	};

	const toggleEngineSound = () => {
		const newValue = !isEngineSoundEnabled;
		setIsEngineSoundEnabled(newValue);
		localStorage.setItem('engineSoundEnabled', newValue.toString());
		// TODO: Apply to AudioEngine when integrated
	};

	const toggleUISound = () => {
		const newValue = !isUISoundEnabled;
		setIsUISoundEnabled(newValue);
		localStorage.setItem('uiSoundEnabled', newValue.toString());
		// TODO: Apply to SoundContext when integrated
	};

	const toggleParticles = () => {
		setSettings((prev) => ({ ...prev, particles: !prev.particles }));
	};

	if (!isOpen) return null;

	return (
		<div className="absolute inset-0 bg-black/80 flex items-center justify-center z-[100] font-pixel">
			<div className="pixel-panel bg-neutral-900 p-8 w-full max-w-md">
				<div className="flex justify-between items-center mb-6">
					<h2 className="text-2xl text-white pixel-text">SETTINGS</h2>
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-white text-xl transition-colors"
					>
						✕
					</button>
				</div>

				<div className="space-y-6">
					{/* Music Section */}
					<div className="border-b border-gray-700 pb-6">
						<h3 className="text-sm text-indigo-400 mb-4 pixel-text">
							🎵 MUSIC
						</h3>

						{/* Disable Music Checkbox */}
						<div className="flex items-center justify-between mb-4">
							<label className="text-sm text-gray-300">
								Enable Music
							</label>
							<button
								onClick={toggleMusicEnabled}
								className={`pixel-btn px-4 py-2 text-xs transition-all ${
									isMusicEnabled
										? 'bg-green-900/50 border-green-500 text-green-400'
										: 'bg-gray-800 border-gray-600 text-gray-400'
								}`}
							>
								{isMusicEnabled ? '✓ ON' : '✕ OFF'}
							</button>
						</div>

						{/* Music Volume */}
						<div
							className={
								isMusicEnabled
									? ''
									: 'opacity-50 pointer-events-none'
							}
						>
							<div className="flex justify-between items-center mb-2">
								<label className="text-sm text-gray-300">
									Music Volume
								</label>
								<span className="text-xs text-gray-400 w-12 text-right">
									{Math.round(musicVolume)}%
								</span>
							</div>
							<PixelSlider
								value={musicVolume}
								onChange={handleMusicVolumeChange}
								min={0}
								max={100}
								disabled={!isMusicEnabled}
							/>
						</div>

						{/* Current Track Info */}
						<div className="mt-4 pt-4 border-t border-gray-800">
							<div className="text-xs text-gray-500 mb-1">
								Currently Playing
							</div>
							<div className="text-sm text-indigo-400">
								{music.getCurrentTrack()?.toUpperCase() ||
									'NONE'}
							</div>
							<div className="text-[10px] text-gray-600 mt-1">
								{music.getIsPlaying()
									? '▶ Playing'
									: '⏸ Paused'}
							</div>
						</div>
					</div>

					{/* Gameplay Section */}
					<div className="border-b border-gray-700 pb-6">
						<h3 className="text-sm text-indigo-400 mb-4 pixel-text">
							🎮 GAMEPLAY
						</h3>

						{/* Manual Clutch */}
						<div className="flex items-center justify-between mb-3">
							<div className="flex flex-col">
								<label className="text-sm text-gray-300">
									Manual Clutch
								</label>
								<span className="text-[10px] text-gray-500">
									Harder difficulty. +20% Payouts.
								</span>
							</div>
							<button
								onClick={() =>
									setSettings((prev) => ({
										...prev,
										manualClutch: !prev.manualClutch,
									}))
								}
								className={`pixel-btn px-4 py-2 text-xs transition-all ${
									settings.manualClutch
										? 'bg-green-900/50 border-green-500 text-green-400'
										: 'bg-gray-800 border-gray-600 text-gray-400'
								}`}
							>
								{settings.manualClutch ? '✓ ON' : '✕ OFF'}
							</button>
						</div>

						{/* Realistic Tires */}
						<div className="flex items-center justify-between mb-3">
							<div className="flex flex-col">
								<label className="text-sm text-gray-300">
									Realistic Tires
								</label>
								<span className="text-[10px] text-gray-500">
									Tire temp affects grip.
								</span>
							</div>
							<button
								onClick={() =>
									setSettings((prev) => ({
										...prev,
										realisticTires: !prev.realisticTires,
									}))
								}
								className={`pixel-btn px-4 py-2 text-xs transition-all ${
									settings.realisticTires
										? 'bg-green-900/50 border-green-500 text-green-400'
										: 'bg-gray-800 border-gray-600 text-gray-400'
								}`}
							>
								{settings.realisticTires ? '✓ ON' : '✕ OFF'}
							</button>
						</div>

						{/* Engine Damage */}
						<div className="flex items-center justify-between mb-3">
							<div className="flex flex-col">
								<label className="text-sm text-gray-300">
									Engine Damage
								</label>
								<span className="text-[10px] text-gray-500">
									Over-revving causes damage.
								</span>
							</div>
							<button
								onClick={() =>
									setSettings((prev) => ({
										...prev,
										engineDamage: !prev.engineDamage,
									}))
								}
								className={`pixel-btn px-4 py-2 text-xs transition-all ${
									settings.engineDamage
										? 'bg-green-900/50 border-green-500 text-green-400'
										: 'bg-gray-800 border-gray-600 text-gray-400'
								}`}
							>
								{settings.engineDamage ? '✓ ON' : '✕ OFF'}
							</button>
						</div>

						{/* Shift Light RPM */}
						<div className="mb-3">
							<div className="flex justify-between items-center mb-2">
								<label className="text-sm text-gray-300">
									Shift Light RPM
								</label>
								<span className="text-xs text-gray-400 w-12 text-right">
									{settings.shiftLightRPM > 0
										? settings.shiftLightRPM
										: 'AUTO'}
								</span>
							</div>
							<PixelSlider
								value={settings.shiftLightRPM}
								onChange={(val) =>
									setSettings((prev) => ({
										...prev,
										shiftLightRPM: val,
									}))
								}
								min={0}
								max={12000}
								step={100}
							/>
							<div className="text-[10px] text-gray-500 mt-1">
								Set to 0 for automatic (90% of redline).
							</div>
						</div>
					</div>

					{/* Visuals Section */}
					<div className="border-b border-gray-700 pb-6">
						<h3 className="text-sm text-indigo-400 mb-4 pixel-text">
							👁️ VISUALS
						</h3>

						{/* Particle FX Toggle */}
						<div className="flex items-center justify-between mb-3">
							<label className="text-sm text-gray-300">
								Particle FX
							</label>
							<button
								onClick={toggleParticles}
								className={`pixel-btn px-4 py-2 text-xs transition-all ${
									settings.particles
										? 'bg-green-900/50 border-green-500 text-green-400'
										: 'bg-gray-800 border-gray-600 text-gray-400'
								}`}
							>
								{settings.particles ? '✓ ON' : '✕ OFF'}
							</button>
						</div>
					</div>

					{/* Sound Effects Section */}
					<div className="border-b border-gray-700 pb-6">
						<h3 className="text-sm text-indigo-400 mb-4 pixel-text">
							🔊 SOUND EFFECTS
						</h3>

						{/* SFX Volume */}
						<div className="mb-4">
							<div className="flex justify-between items-center mb-2">
								<label className="text-sm text-gray-300">
									SFX Volume
								</label>
								<span className="text-xs text-gray-400 w-12 text-right">
									{Math.round(sfxVolume)}%
								</span>
							</div>
							<PixelSlider
								value={sfxVolume}
								onChange={handleSfxVolumeChange}
								min={0}
								max={100}
							/>
						</div>

						{/* Engine Sound Toggle */}
						<div className="flex items-center justify-between mb-3">
							<label className="text-sm text-gray-300">
								Engine Sounds
							</label>
							<button
								onClick={toggleEngineSound}
								className={`pixel-btn px-4 py-2 text-xs transition-all ${
									isEngineSoundEnabled
										? 'bg-green-900/50 border-green-500 text-green-400'
										: 'bg-gray-800 border-gray-600 text-gray-400'
								}`}
							>
								{isEngineSoundEnabled ? '✓ ON' : '✕ OFF'}
							</button>
						</div>

						{/* UI Sound Toggle */}
						<div className="flex items-center justify-between">
							<label className="text-sm text-gray-300">
								UI Sounds
							</label>
							<button
								onClick={toggleUISound}
								className={`pixel-btn px-4 py-2 text-xs transition-all ${
									isUISoundEnabled
										? 'bg-green-900/50 border-green-500 text-green-400'
										: 'bg-gray-800 border-gray-600 text-gray-400'
								}`}
							>
								{isUISoundEnabled ? '✓ ON' : '✕ OFF'}
							</button>
						</div>
					</div>
				</div>

				<button
					onClick={() => {
						if (isUISoundEnabled) play('ui_click');
						onClose();
					}}
					className="w-full pixel-btn mt-6 py-3 hover:bg-indigo-900/50 hover:border-indigo-500 transition-all"
				>
					CLOSE
				</button>
			</div>
		</div>
	);
};

export default SettingsModal;
