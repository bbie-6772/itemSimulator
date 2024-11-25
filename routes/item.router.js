import express from 'express'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma/index.js';
import { authMiddleware, decodeMiddlware } from '../middlewares/auth.middleware.js';

dotenv.config();

const router = express.Router();

export default router;