import React from 'react';

interface TestTrackControlsProps {
	onBack: () => void;
}

export const TestTrackControls: React.FC<TestTrackControlsProps> = ({
	onBack,
}) => {
	return (
		<div className="absolute top-4 left-4 z-50">
			<button
				onClick={onBack}
				className="text-white font-pixel text-xl hover:text-gray-300 flex items-center gap-2"
			>
				<span>&lt;</span> BACK
			</button>
		</div>
	);
};
