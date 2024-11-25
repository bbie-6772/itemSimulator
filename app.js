import dotenv from 'dotenv'
import express from 'express'
import accountRouter from './routes/account.router.js'

// .env 정보 가져오기
dotenv.config();

const app = express();
const PORT = 3030

//json 형태의 요청 body 인식
app.use(express.json());

app.use('/api', accountRouter)

app.listen(PORT, () => {
    console.log(PORT, '포트로 서버가 열렸어요!');
});