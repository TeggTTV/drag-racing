import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../../lib/prisma';
import type { ApiResponse } from '../../../types/api';

const JWT_SECRET =
	process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';

export default async function POST(
	req: NextApiRequest,
	res: NextApiResponse<ApiResponse>
) {
	if (req.method !== 'POST') {
		res.setHeader('Allow', ['POST']);
		return res.status(405).json({ message: 'Method not allowed' });
	}
	const { email, password } = req.body; // Can accept username too if needed

	if (!email || !password) {
		return res.status(400).json({ message: 'Missing required fields' });
	}

	try {
		const user = await prisma.user.findUnique({
			where: { email },
		});

		if (!user) {
			return res.status(401).json({ message: 'Invalid credentials' });
		}

		const isValid = await bcrypt.compare(password, user.password);

		if (!isValid) {
			return res.status(401).json({ message: 'Invalid credentials' });
		}

		// Update last login
		await prisma.user.update({
			where: { id: user.id },
			data: { lastLogin: new Date() },
		});

		// Generate Token
		const token = jwt.sign(
			{ userId: user.id, username: user.username },
			JWT_SECRET,
			{ expiresIn: '7d' }
		);

		const { password: _, ...userWithoutPassword } = user;

		return res.status(200).json({ user: userWithoutPassword, token });
	} catch (error) {
		console.error('Login error:', error);
		return res.status(500).json({ message: 'Internal server error' });
	}
}
