import { useEffect, useRef, MutableRefObject } from 'react';
import { CONTROLS } from '../constants';
import { InputState, GamePhase } from '../types';

export const useGameInput = (
	phase: GamePhase,
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

	const keysPressed = useRef<Set<string>>(new Set());

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Audio Init on first interaction
			if (!audioInitializedRef.current) {
				audioRef.current.init();
				opponentAudioRef.current.init();
				audioInitializedRef.current = true;
			}

			if (phase !== 'RACE') return;

			// Prevent repeated keydown events when key is held
			if (keysPressed.current.has(e.key)) return;
			keysPressed.current.add(e.key);

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
	}, [phase, audioInitializedRef, audioRef, opponentAudioRef]);

	return inputsRef;
};
