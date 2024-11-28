import express from 'express'
import dotenv from 'dotenv'
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma/index.js';
import { charVaild } from '../middlewares/valid.middleware.js'
import { authMiddleware, decodeMiddlware } from '../middlewares/auth.middleware.js';

dotenv.config();

const router = express.Router();

// 캐릭터 생성 API
router.post('/characters', authMiddleware, charVaild , async (req,res,next) => {
    try {
        //인증 후 사용자 아이디 할당
        const user = req.user;
        const {name} = req.body;

        // 이름 존재 유무
        if (!name) throw new Error("캐릭터 이름 <name>을 입력해주세요", { cause: 400 })

        // 이름 중복 여부 
        const isExitChar = await prisma.characters.findFirst({ where: { name } })
        if (isExitChar) throw new Error("이미 존재하는 이름입니다", { cause: 409 })

        //트랜잭션 사용으로 캐릭터/인벤토리/장비 동시 생성
        const [character, inventory, equipment] = await prisma.$transaction( async (tx) => {
            //캐릭터 생성
            const character = await tx.characters.create({
                data: {
                    accountId: +user.accountId,
                    name
                }
            })
            //인벤토리 생성 
            const inventory = await tx.inventory.create({
                data: {
                    charId: +character.charId
                }
            })
            //장비창 생성
            const equipment = await tx.equipment.create({
                data: {
                    charId: +character.charId
                }
            })
            
            return [character, inventory, equipment]
        }, {
            // 격리 수준 지정 (= commit 이후 읽기가능)
            isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted
        })

        return res
            .status(201)
            .json({ 
                message: `새로운 캐릭터 ${name}(을)를 생성하셨습니다.`,
                data: { 
                    "character_id": character.charId
                }
            })
    } catch (err) {
        if (err.cause) return res
            .status(err.cause)
            .json({ errorMessage: err.message })
        console.log(err.message)
        return res
            .status(400)
            .json({ errorMessage: "잘못된 접근입니다." });
    }
    
})

// 캐릭터 삭제 API
router.delete('/characters/:charId', authMiddleware, charVaild, async (req,res,next) => {
    const {charId} = req.params
    // 미들웨어에서 인증된 캐릭터 가져오기
    const { character } = req

    // 캐릭터 삭제
    await prisma.characters.delete({ where: { charId: +charId }})
    
    return res
        .status(200)
        .json({ message: `캐릭터 ${character.name}(을)를 삭제하였습니다.`})
})

// 캐릭터 상세 조회 API
router.get('/characters/:charId', decodeMiddlware, charVaild, async (req,res,next) => {
    const {charId} = req.params;
    // 미들웨어에서 인증된 캐릭터 가져오기
    const { character } = req
    const user = req.tempUser;

    if (character.accountId === (user ? +user.accountId : 0)) {
        return res
            .status(200)
            .json({
                data: {
                    name: character.name, 
                    health: character.health,
                    power: character.power,
                    money: character.money
                }
            })
    // 아닐경우 화면에서 money 제외
    } else return res
        .status(200)
        .json({
            data: {
                name: character.name,
                health: character.health,
                power: character.power
            }
        })
})

// 동전줍기 API
router.get('/money/:charId', authMiddleware, charVaild, async (req,res,next) => {
    const {charId} = req.params

    //돈 랜덤 획득
    const amonut = Math.round(Math.random() * 10) * 100
    const updateCharacter = await prisma.characters.update({
        data: {
            money: {increment: amonut}
        },
        where: { charId: +charId }
    })

    const resJson = [{
        "message": `동전을 주웠습니다`,
        "amount": amonut,
        "balance": updateCharacter.money
    }]

    return res 
        .status(200)
        .json(resJson)
})

export default router;