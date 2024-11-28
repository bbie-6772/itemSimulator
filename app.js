import express from 'express'
import itemRouter from './routes/item.router.js'
import accountRouter from './routes/account.router.js'
import characterRouter from './routes/character.router.js'

const app = express();
const PORT = 3030

//json 형태의 요청 body 인식
app.use(express.json());

//router 연결
app.use('/api', [accountRouter, characterRouter, itemRouter])

//서버 열기
app.listen(PORT, () => {
    console.log(PORT, '포트로 서버가 열렸어요!');
});

app.use(function (err, req, res, next) {
    console.error(err.stack);
    if(err.cause) res
        .status(err.cause)
        .json({errorMessage : err.message})
    else res.status(500).json({ errorMessage: "문제가 생겼습니다!관리자에게 문의해주세요."})
});