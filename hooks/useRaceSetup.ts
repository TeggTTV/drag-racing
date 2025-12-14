import { useCallback } from 'react';
import { CarState, Mission, Season } from '../types';
import { TestTrackUtils } from '../utils/TestTrackUtils';

export const useRaceSetup = (
	missionRef: React.MutableRefObject<Mission | null>,
	currentWagerRef: React.MutableRefObject<number>,
	setRaceResult: React.Dispatch<React.SetStateAction<'WIN' | 'LOSS' | null>>,
	money: number,
	setMoney: React.Dispatch<React.SetStateAction<number>>,
	showToast: (msg: string, type: any) => void,
	audioRef: React.MutableRefObject<any>,
	opponentAudioRef: React.MutableRefObject<any>,
	playerTuning: any,
	effectiveTuning: any,
	setPhase: React.Dispatch<React.SetStateAction<any>>,
	setRaceStatus: React.Dispatch<React.SetStateAction<any>>,
	setCountdownNum: React.Dispatch<React.SetStateAction<number | string>>,
	countdownStartRef: React.MutableRefObject<number>,
	raceStartTimeRef: React.MutableRefObject<number>,
	currentGhostRecording: React.MutableRefObject<any[]>,
	raceFinishedProcessingRef: React.MutableRefObject<boolean>,
	setWeather: React.Dispatch<React.SetStateAction<any>>,
	setBgTrees: React.Dispatch<React.SetStateAction<any[]>>,
	maxTreeYRef: React.MutableRefObject<number>,
	playerRef: React.MutableRefObject<CarState>,
	opponentRef: React.MutableRefObject<CarState>,
	inputsRef: React.MutableRefObject<any>,
	lastGearRef: React.MutableRefObject<number>,
	shiftDebounce: React.MutableRefObject<boolean>,
	setUiState: React.Dispatch<React.SetStateAction<any>>,
	setMissedGearAlert: React.Dispatch<React.SetStateAction<boolean>>,
	quarterMileTimeRef: React.MutableRefObject<number | null>,
	mileTimeRef: React.MutableRefObject<number | null>
) => {
	const confirmStartRace = useCallback(
		(wager: number = 0) => {
			const mission = missionRef.current;
			if (!mission) return;

			currentWagerRef.current = wager;
			setRaceResult(null); // Reset result

			// Deduct wager
			if (wager > 0) {
				if (money < wager) {
					showToast('Not enough money!', 'WARNING');
					return;
				}
				setMoney((m) => m - wager);
			}

			audioRef.current.setConfiguration(
				playerTuning.cylinders,
				playerTuning.exhaustOpenness,
				playerTuning.backfireAggression,
				playerTuning.turboIntensity
			);
			audioRef.current.setVolume(0); // Start muted
			// Reset spatial
			audioRef.current.setSpatial(0, 0, 0);

			opponentAudioRef.current.setConfiguration(
				mission.opponent.tuning.cylinders,
				mission.opponent.tuning.exhaustOpenness,
				mission.opponent.tuning.backfireAggression,
				mission.opponent.tuning.turboIntensity
			);
			opponentAudioRef.current.setVolume(0); // Start muted
			opponentAudioRef.current.setSpatial(0, 0, 0.5); // Opponent slightly right

			// Start Countdown
			setPhase('RACE');
			setRaceStatus('COUNTDOWN');
			setCountdownNum(3);
			countdownStartRef.current = performance.now();
			raceStartTimeRef.current = 0;
			currentGhostRecording.current = [];
			raceFinishedProcessingRef.current = false;

			// --- Setup Environment ---
			const seasons: Season[] = ['SPRING', 'SUMMER', 'FALL', 'WINTER'];
			const randomSeason =
				seasons[Math.floor(Math.random() * seasons.length)];

			// Weather Logic
			const isRain = Math.random() < 0.2 && randomSeason !== 'WINTER';
			setWeather({
				type: isRain ? 'RAIN' : 'SUNNY',
				intensity: isRain ? 0.5 + Math.random() * 0.5 : 0,
				season: randomSeason,
			});

			// Generate Trees
			const newTrees: { x: number; y: number; scale: number }[] = [];
			const treeCount = Math.floor(mission.distance * 8); // High density: ~1 tree per 2m
			// Place trees widely
			for (let i = 0; i < treeCount; i++) {
				const side = Math.random() > 0.5 ? 1 : -1;
				// 10m to 40m from center
				const x = side * (5 + Math.random() * 30);
				const y = -20 + Math.random() * (mission.distance + 100);
				const scale = 0.8; // Smaller trees: 0.3 - 0.6
				newTrees.push({ x, y, scale });
			}
			// Sort trees by Y (descending) so they render back-to-front
			newTrees.sort((a, b) => b.y - a.y);
			setBgTrees(newTrees);

			// Reset Car States
			playerRef.current = {
				y: 0,
				velocity: 0,
				rpm: 1000,
				gear: 0,
				finished: false,
				finishTime: 0,
			};
			opponentRef.current = {
				y: 0,
				velocity: 0,
				rpm: 1000,
				gear: 0,
				finished: false,
				finishTime: 0,
			};
			inputsRef.current = {
				gas: false,
				shiftUp: false,
				shiftDown: false,
				clutch: false,
				brake: false,
				purge: false,
			};
			lastGearRef.current = 0;
			shiftDebounce.current = false;
		},
		[
			missionRef,
			currentWagerRef,
			setRaceResult,
			money,
			showToast,
			setMoney,
			audioRef,
			playerTuning,
			opponentAudioRef,
			setPhase,
			setRaceStatus,
			setCountdownNum,
			countdownStartRef,
			raceStartTimeRef,
			currentGhostRecording,
			raceFinishedProcessingRef,
			setWeather,
			setBgTrees,
			playerRef,
			opponentRef,
			inputsRef,
			lastGearRef,
			shiftDebounce,
		]
	);

	const startMission = useCallback(
		(mission: Mission) => {
			missionRef.current = mission;
			confirmStartRace();
		},
		[confirmStartRace, missionRef]
	);

	const startTestTrack = useCallback(() => {
		setPhase('TEST_TRACK');
		setRaceStatus('COUNTDOWN');
		setCountdownNum(3);
		setRaceResult(null);
		setMissedGearAlert(false);

		// Reset Car States
		setUiState({
			player: {
				y: 0,
				velocity: 0,
				rpm: effectiveTuning.idleRPM,
				gear: 0,
				finished: false,
				finishTime: 0,
				tireTemp: 20,
				engineHealth: 100,
			},
			opponent: {
				y: 0,
				velocity: 0,
				rpm: 1000,
				gear: 0,
				finished: false,
				finishTime: 0,
			},
		});

		// Reset Inputs
		inputsRef.current = {
			gas: false,
			shiftUp: false,
			shiftDown: false,
			clutch: false,
			brake: false,
			purge: false,
		};
		lastGearRef.current = 0;
		shiftDebounce.current = false;
		raceStartTimeRef.current = 0; // Will set when countdown ends
		quarterMileTimeRef.current = null;
		mileTimeRef.current = null;

		// Audio
		audioRef.current.startEngine(effectiveTuning);
		// No opponent audio for test track

		// --- Setup Environment (Random Season/Weather) ---
		const seasons: Season[] = ['SPRING', 'SUMMER', 'FALL', 'WINTER'];
		const randomSeason =
			seasons[Math.floor(Math.random() * seasons.length)];
		const isRain = Math.random() < 0.2 && randomSeason !== 'WINTER';
		setWeather({
			type: isRain ? 'RAIN' : 'SUNNY',
			intensity: isRain ? 0.5 + Math.random() * 0.5 : 0,
			season: randomSeason,
		});

		// Initial Trees
		const newTrees = TestTrackUtils.generateInitialTrees();
		setBgTrees(newTrees);
		maxTreeYRef.current = 500;
	}, [
		effectiveTuning,
		setPhase,
		setRaceStatus,
		setCountdownNum,
		setRaceResult,
		setMissedGearAlert,
		setUiState,
		inputsRef,
		lastGearRef,
		shiftDebounce,
		raceStartTimeRef,
		quarterMileTimeRef,
		mileTimeRef,
		audioRef,
		setWeather,
		setBgTrees,
		maxTreeYRef,
	]);

	return { startMission, confirmStartRace, startTestTrack };
};
