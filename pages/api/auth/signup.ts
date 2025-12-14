import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const JWT_SECRET =
	process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';

export default async function POST(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'POST') {
		return res.status(405).json({ message: 'Method not allowed' });
	}
	const prisma = new PrismaClient();

	const { username, email, password } = req.body;

	if (!username || !email || !password) {
		return res.status(400).json({ message: 'Missing required fields' });
	}

	try {
		// Check if user exists
		const existingUser = await prisma.user.findFirst({
			where: {
				OR: [{ email }, { username }],
			},
		});

		if (existingUser) {
			return res.status(409).json({ message: 'User already exists' });
		}

		// Hash password
		const hashedPassword = await bcrypt.hash(password, 10);

		// Create user
		const user = await prisma.user.create({
			data: {
				username,
				email,
				password: hashedPassword,
				// Initialize with basic defaults
				money: 1000,
				level: 1,
				xp: 0,
				inventory: [],
				garage: [],
			},
		});

		// Generate Token
		const token = jwt.sign(
			{ userId: user.id, username: user.username },
			JWT_SECRET,
			{ expiresIn: '7d' } // 1 week
		);

		// Return user without password
		const { password: _, ...userWithoutPassword } = user;

		return res.status(201).json({ user: userWithoutPassword, token });
	} catch (error) {
		console.error('Signup error:', error);
		return res.status(500).json({ message: 'Internal server error' });
	}
}
