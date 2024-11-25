import express from 'express'
import bycrpt from 'bcrypt'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma/index.js';

// .env 정보 가져오기
dotenv.config()

const router = express.Router();

// 회원가입 API
router.post(`/sign-up`,async (req, res, next) => {

    const { id, password, passwordCheck } = req.body;

    //유효성 평가 정규식사용으로 id 입력값이 소문자+숫자만 가능하게
    if (!/^[a-z0-9]*$/.test(id)) {
        return res
            .status(412)
            .json({ errorMessage: "아이디는 소문자와 숫자로만 작성해주세요" })
    }
    // 아이디 중복 확인
    const isExitUser = await prisma.accounts.findFirst({
        where: { userId: id }
    })
    if (isExitUser) {
        return res
            .status(409)
            .json({ errorMessage: "이미 존재하는 아이디입니다" })
    }

    // 비밀번호가 6글자 이상인지 확인
    if (!/\b.{6,}/.test(password)) {
        return res
            .status(411)
            .json({ errorMessage: "비밀번호는 6글자 이상으로 작성해주세요" })
    }
    // 비밀번호 확인이 없을 시
    if (!passwordCheck) {
        return res
            .status(412)
            .json({ errorMessage: "비밀번호 확인용 passwordCheck를 입력해주세요" })
    }
    //비밀번호 확인과 일치하는지
    if (!(password === passwordCheck)) {
        return res
            .status(401)
            .json({ errorMessage: "비밀번호가 일치하지 않습니다." })
    }
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
router.post('/sign-in', async (req,res,next) => {
    const {id,password} = req.body;

    const account = await prisma.accounts.findFirst({where: {userId: id}})

    // 아이디가 없을 시
    if (!account) return res
        .status(401)
        .json({ errorMessage: "존재하지 않는 아이디입니다."});

    // 비밀번호 검증
    if (!await bycrpt.compare(password,account.password)) return res
        .status(401)
        .json({ errorMessage: "비밀번호가 일치하지 않습니다."});
    // 세션 토큰 생성
    const token = jwt.sign(
        {userId: account.userId},
        process.env.SESSION_SECRET_KEY,
        { expiresIn: "1m"}
    )
    // 세션 키 할당
    res.header('authorization', `Bearer ${token}`);

    return res
        .status(200)
        .json({ message: "로그인에 성공하였습니다." });
})

export default router;