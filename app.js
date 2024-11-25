import express from 'express'
import accountRouter from './routes/account.router.js'
import characterRouter from './routes/character.router.js'

const app = express();
const PORT = 3030

//json 형태의 요청 body 인식
app.use(express.json());

//router 연결
app.use('/api', [accountRouter, characterRouter])

//서버 열기
app.listen(PORT, () => {
    console.log(PORT, '포트로 서버가 열렸어요!');
});