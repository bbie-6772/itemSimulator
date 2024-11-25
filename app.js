import dotenv from 'dotenv'
import express from 'express'
import expSession from 'express-session'
import expSQLSession from 'express-mysql-session'

// .env 정보 가져오기
dotenv.config();

const app = express();
const PORT = 3020

const MySQLStore = expSQLSession(expSession)

const sessionStor = new MySQLStore ({
    user: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    database: process.env.DATABASE_NAME,
    // 만료기한 (=1일)
    expiration: 1000 * 60 * 60 * 24,
    createDatabaseTable: true
})