import jwt from 'jsonwebtoken';
import dotenv from 'dotenv'
import { prisma } from '../prisma/index.js'

// .env 정보 가져오기
dotenv.config()


//인증 미들웨어
const authMiddleware = async function (req, res, next) {
    try {
        //세션 키 존재 여부 및 유효성 1차 평가
        const { authorization } = req.headers;
        if (!authorization) throw new Error("요청한 사용자의 토큰이 존재하지 않습니다.");
        const [tokenType, token] = authorization.split(' ');
        if (tokenType !== "Bearer") throw new Error("토큰 타입이 Bearer 형식이 아닙니다.")

        //세션 키 유효성 2차 평가
        const decodedToken = jwt.verify(token, process.env.SESSION_SECRET_KEY)
        const userId = decodedToken.userId;
        if (!userId) throw new Error("로그인이 필요합니다.")
        //사용자가 존재하는지 확인
        const user = await prisma.accounts.findFirst({ where: { userId } })
        if (!user) throw new Error("토큰 사용자가 존재하지 않습니다.")
        //존재 시, req에 값을 저장 후 다음으로 이동
        req.user = user;
        next();
        //던진 오류들 확인해서 반환
    } catch (error) {
        // 경우에 따라 에러메시지를 다르게 적용하여 원인을 구분
        if (error.name === "TokenExpiredError") return res
            .status(401)
            .json({ errorMessage: "토큰이 만료되었습니다." })
        if (error.name === "JsonWebTokenError") return res
            .status(401)
            .json({ errorMessage: "토큰이 조작되었습니다." })
        return res
            .status(400)
            .json({ errorMessage: error.message });
    }
}

//계정정보 확인 미들웨어
const decodeMiddlware = async function (req, res, next) {
    try {
        //세션 키 존재 여부 및 유효성 1차 평가
        const { authorization } = req.headers;
        if (!authorization) throw new Error("요청한 사용자의 토큰이 존재하지 않습니다.");
        const [tokenType, token] = authorization.split(' ');
        if (tokenType !== "Bearer") throw new Error("토큰 타입이 Bearer 형식이 아닙니다.")

        //세션 키 유효성 2차 평가
        const decodedToken = jwt.verify(token, process.env.SESSION_SECRET_KEY)
        const userId = decodedToken.userId;
        if (!userId) throw new Error("로그인이 필요합니다.")
        //사용자가 존재하는지 확인
        const user = await prisma.accounts.findFirst({ where: { userId } })
        if (!user) throw new Error("토큰 사용자가 존재하지 않습니다.")
        //존재 시, req에 값을 저장 후 다음으로 이동
        req.user = user;
        next();
        //오류가 있을 시, 정보 할당 중지
    } catch (error) {
        next();
    }
}

export { authMiddleware, decodeMiddlware }