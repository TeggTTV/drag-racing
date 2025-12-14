import { useEffect, useRef, MutableRefObject } from 'react';
import { CONTROLS } from '../constants';
import { InputState, GamePhase } from '../types';

export const useGameInput = (
	phase: GamePhase,
	setPhase: (phase: GamePhase) => void,
	setRaceResult: (result: any) => void,
	audioInitializedRef: MutableRefObject<boolean>,
	audioRef: MutableRefObject<any>,
	opponentAudioRef: MutableRefObject<any>
) => {
	const inputsRef = useRef<InputState>({
		gas: false,
		shiftUp: false,
		shiftDown: false,
		clutch: false,
		brake: false,
		purge: false,
	});

	// Track which keys are currently pressed to prevent repeat firing
	const keysPressed = useRef<Set<string>>(new Set());

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Audio Init on first interaction
			if (!audioInitializedRef.current) {
				audioRef.current.init();
				opponentAudioRef.current.init();
				audioInitializedRef.current = true;
			}

			if (
				phase !== 'RACE' &&
				phase !== 'ONLINE_RACE' &&
				phase !== 'TEST_TRACK'
			)
				return;

			// Prevent repeated keydown events when key is held
			if (keysPressed.current.has(e.key)) return;
			keysPressed.current.add(e.key);

			if (e.key === 'Escape') {
				if (phase === 'TEST_TRACK') {
					// Exit Test Track
					audioRef.current.stop();
					setRaceResult(null);
					setPhase('GARAGE');
					return;
				}
			}

			switch (e.key) {
				case CONTROLS.GAS:
					inputsRef.current.gas = true;
					break;
				case CONTROLS.SHIFT_UP:
					inputsRef.current.shiftUp = true;
					break;
				case CONTROLS.SHIFT_DOWN:
					inputsRef.current.shiftDown = true;
					break;
				case CONTROLS.CLUTCH:
					inputsRef.current.clutch = true;
					break;
				case CONTROLS.BRAKE:
					inputsRef.current.brake = true;
					break;
				case CONTROLS.PURGE:
					inputsRef.current.purge = true;
					break;
			}
		};

		const handleKeyUp = (e: KeyboardEvent) => {
			// Remove from pressed keys set
			keysPressed.current.delete(e.key);

			switch (e.key) {
				case CONTROLS.GAS:
					inputsRef.current.gas = false;
					break;
				case CONTROLS.SHIFT_UP:
					inputsRef.current.shiftUp = false;
					break;
				case CONTROLS.SHIFT_DOWN:
					inputsRef.current.shiftDown = false;
					break;
				case CONTROLS.CLUTCH:
					inputsRef.current.clutch = false;
					break;
				case CONTROLS.BRAKE:
					inputsRef.current.brake = false;
					break;
				case CONTROLS.PURGE:
					inputsRef.current.purge = false;
					break;
			}
		};

		const handleInteraction = () => {
			if (!audioInitializedRef.current) {
				audioRef.current.init();
				opponentAudioRef.current.init();
				audioInitializedRef.current = true;
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('keyup', handleKeyUp);
		window.addEventListener('click', handleInteraction);
		window.addEventListener('touchstart', handleInteraction);

		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('keyup', handleKeyUp);
			window.removeEventListener('click', handleInteraction);
			window.removeEventListener('touchstart', handleInteraction);
		};
	}, [
		phase,
		setPhase,
		setRaceResult,
		audioInitializedRef,
		audioRef,
		opponentAudioRef,
	]);

	return inputsRef;
};
