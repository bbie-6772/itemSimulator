import express from 'express'
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma/index.js';
import { authMiddleware, decodeMiddlware } from '../middlewares/auth.middleware.js';

dotenv.config();

const router = express.Router();

// 아이템 생성 API
router.post('/items', async (req,res,next) => { 
    //입력값 확인
    const {item_code, item_name, item_stat, item_price} = req.body;
    //아이템 생성용 변수
    let item
    //이름 유효성 검사 확인
    if (!item_name) return res
        .status(400)
        .json({ errorMessage: "아이템 이름 <item_name>을 입력해주세요" })
    const isExitItem = await prisma.itemTable.findFirst({ where: {name: item_name}})
    if (isExitItem) return res
        .status(409)
        .json({ errorMessage: "이미 존재하는 아이템입니다" })
    //능력치 입력 여부 확인
    if (!item_stat) {
        return res
            .status(400)
            .json({ errorMessage: "능력치 <item_stat: {\"스탯이름\":값}> 을 입력해주세요" })
    }
    // 스탯 확인 및 없을 시 초기화
    let { health, power } = item_stat
    health = health ? +health : 0
    power = power ? +power : 0

    //가격 입력 여부 확인
    if(!item_price) return res
        .status(400)
        .json({ errorMessage: "가격 <item_price> 을 입력해주세요" })
    // 코드 여부에 따라 다르게 생성
    if (item_code) {
        //코드 중복여부 확인
        const isExitCode = await prisma.itemTable.findFirst({ where: { itemCode: item_code } })
        if (isExitCode) return res
            .status(409)
            .json({ errorMessage: "아이템 코드가 동일한 아이템이 있습니다" })

        item = await prisma.itemTable.create({
            data: {
                itemCode: +item_code,
                price: +item_price,
                name: item_name,
                health,
                power
            }
        })
    } else {
        item = await prisma.itemTable.create({
            data: {
                price: +item_price,
                name: item_name,
                health,
                power
            }
        })
    }
    return res
        .status(201)
        .json({
                message: `새로운 아이템 ${item.name}(을)를 생성하셨습니다.`,
                data: {
                    item_code: item.itemCode,
                    item_stat:  { health: item.health, power: item.power },
                    item_price: item.price
              }
        })
})

// 아이템 조회 API
router.get('/items',async (req,res,next) => {
    const items = await prisma.itemTable.findMany({
        select: {
            itemCode: true,
            name: true,
            price: true
        }
    }) 
    // 아이템이 아에 존재하지 않을 시
    if (!items) return res
        .status(404)
        .json({ errorMessage: "아이템이 존재하지 않습니다" })

    return res
        .status(200)
        .json({ itemList: items })
})

// 아이템 상세 조회 API
router.get('/items/:itemCode', async (req,res,next) => {
    const {itemCode} = req.params;

    const item = await prisma.itemTable.findFirst({ 
        where: { itemCode: +itemCode }
    })
    if (!item) return res
        .status(404)
        .json({ errorMessage: `<itemCode> ${itemCode}번의 아이템이 존재하지 않습니다` })

    return res
        .status(200)
        .json({
            "item_code" : item.itemCode,
            "item_name" : item.name,
            "item_stat" : { "health":item.health,"power":item.power},
            "item_price": item.price
        })

})

// 아이템 수정 API
router.patch('/items/:itemCode', async (req,res,next) => {
    const {itemCode} = req.params;
    let {item_name,item_stat} = req.body;
    let health, power
    // 변경사항이 없을 시(입력이 없을 시)
    if (!(item_name || item_stat)) return res
        .status(404)
        .json({ errorMessage: "아이템에 변경사항이 존재하지 않습니다" })
    // 아이템 존재 확인
    const item = await prisma.itemTable.findFirst({ where: { itemCode: +itemCode } })
    if (!item) return res
        .status(404)
        .json({ errorMessage: `<itemCode> ${itemCode}번의 아이템이 존재하지 않습니다` })
    // 인수 확인 및 없을 시 기본값 유지
    item_stat ? { health, power } = item_stat : 0
    item_name = item_name ? item_name : item.name
    health = health ? +health : item.health
    power = power ? +power : item.power

    // 아이템 수정
    await prisma.itemTable.update({
        data: {
            name: item_name,
            health,
            power
        },  
        where : { itemCode: +itemCode }
    })
    // 수정된 아이템 정보
    const newItem = await prisma.itemTable.findFirst({ where: { itemCode: +itemCode } })
    
    return res
        .status(201)
        .json({
            message: `아이템 ${item.name}(이)가 수정되었습니다.`,
            data: {
                item_code: newItem.itemCode,
                item_name: newItem.name,
                item_stat: { health: newItem.health, power: newItem.power },
                item_price: newItem.price
            }
        })
})

export default router;