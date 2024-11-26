import express from 'express'
import dotenv from 'dotenv'
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma/index.js';
import { authMiddleware, decodeMiddlware } from '../middlewares/auth.middleware.js';

dotenv.config();

const router = express.Router();

// 캐릭터 생성 API
router.post('/characters', authMiddleware , async (req,res,next) => {
    //인증 후 사용자 아이디 할당
    const user = req.user;
    const {name} = req.body;
    // 입력값 유효성 검사 
    if (!name) return res
        .status(400)
        .json({ errorMessage: "데이터 형식이 올바르지 않습니다."})
    // 이름 중복 여부 
    const isExitChar = await prisma.characters.findFirst({ where: { name } })
    if (isExitChar) return res
        .status(409)
        .json({ errorMessage: "이미 존재하는 이름입니다" })
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
})

// 캐릭터 삭제 API
router.delete('/characters/:charId', authMiddleware, async (req,res,next) => {
    const {charId} = req.params;
    const user = req.user;
    // 입력 확인
    if (!charId) return res
        .status(400)
        .json({ errorMessage: "데이터 형식이 올바르지 않습니다."})
    const character = await prisma.characters.findFirst({where: { charId: +charId }})
    // 캐릭터 존재여부 확인
    if (!character) return res
        .status(404)
        .json({ errorMessage: `<character_id> ${charId} 에 해당하는 캐릭터가 존재하지 않습니다.` })
    // 계정에 귀속된 캐릭터가 맞는지 확인
    if (character.accountId !== user.accountId) return res
        .status(401)
        .json({ errorMessage: "본 계정이 소유한 캐릭터가 아닙니다."})

    await prisma.characters.delete({ where: { charId: +charId }})
    
    return res
        .status(200)
        .json({ message: `캐릭터 ${character.name}(을)를 삭제하였습니다.`})
})

// 캐릭터 상세 조회 API
router.get('/characters/:charId', decodeMiddlware, async (req,res,next) => {
    const {charId} = req.params;
    const user = req.user;
    // 입력 확인
    if (!charId) return res
        .status(400)
        .json({ errorMessage: "데이터 형식이 올바르지 않습니다." })
    const character = await prisma.characters.findFirst({ where: { charId: +charId } })
    // 캐릭터 존재여부 확인
    if (!character) return res
        .status(404)
        .json({ errorMessage: `<character_id> ${charId} 에 해당하는 캐릭터가 존재하지 않습니다.` })
    // 계정소유자가 맞는지 확인
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


export default router;