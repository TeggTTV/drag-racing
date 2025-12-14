import { Season } from '../types';

export interface Tree {
	x: number;
	y: number;
	scale: number;
}

export class TestTrackUtils {
	static generateInitialTrees(): Tree[] {
		const newTrees: Tree[] = [];
		// Generate initial 500m of trees
		for (let i = 0; i < 100; i++) {
			const side = Math.random() > 0.5 ? 1 : -1;
			const x = side * (5 + Math.random() * 30);
			const y = -20 + Math.random() * 500;
			const scale = 0.8;
			newTrees.push({ x, y, scale });
		}
		newTrees.sort((a, b) => b.y - a.y);
		return newTrees;
	}

	static generateProceduralTrees(currentMaxY: number): {
		trees: Tree[];
		newMaxY: number;
	} {
		const startY = currentMaxY;
		const endY = startY + 200; // Generate 200m chunks
		const newTrees: Tree[] = [];
		const density = 0.2; // Trees per meter
		const count = Math.floor((endY - startY) * density);

		for (let i = 0; i < count; i++) {
			const side = Math.random() > 0.5 ? 1 : -1;
			const x = side * (5 + Math.random() * 30);
			const y = startY + Math.random() * (endY - startY);
			const scale = 0.8;
			newTrees.push({ x, y, scale });
		}
		return { trees: newTrees, newMaxY: endY };
	}
}
