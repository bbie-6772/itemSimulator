import express from 'express'
import bycrpt from 'bcrypt'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken';
import { signVaild } from '../middlewares/valid.middleware.js'
import { prisma } from '../prisma/index.js';

// .env 정보 가져오기
dotenv.config()

const router = express.Router();

// 회원가입 API
router.post("/sign-up", signVaild, async (req, res, next) => {
    const { id, password} = req.body;

    //비밀번호 해쉬화
    const hashedPassword = await bycrpt.hash(password, 10)
    const account = await prisma.accounts.create({
        data: {
            userId: id,
            password: hashedPassword
        }
    })

    return res
        .status(201)
        .json({ message: "회원가입이 완료되었습니다", id: id })
})

//로그인 API
router.post('/sign-in', signVaild, async (req,res,next) => {
    const {id,password} = req.body;

    const account = await prisma.accounts.findFirst({where: {userId: id}})

    // 비밀번호 검증
    if (!await bycrpt.compare(password,account.password)) return res
        .status(401)
        .json({ errorMessage: "비밀번호가 일치하지 않습니다."});
    // 세션 토큰 생성
    const token = jwt.sign(
        {userId: account.userId},
        process.env.SESSION_SECRET_KEY,
        { expiresIn: "10m"}
    )
    // 세션 키 할당
    res.header('authorization', `Bearer ${token}`);

    return res
        .status(200)
        .json({ message: "로그인에 성공하였습니다." });
})

export default router;