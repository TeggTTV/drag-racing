import { NextApiRequest } from 'next';
import jwt from 'jsonwebtoken';

const JWT_SECRET =
	process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';

export function getUserIdFromRequest(req: NextApiRequest): string | null {
	const authHeader = req.headers.authorization;
	if (!authHeader || !authHeader.startsWith('Bearer ')) {
		return null;
	}
	try {
		const token = authHeader.split(' ')[1];
		const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
		return decoded.userId;
	} catch (e) {
		return null;
	}
}
