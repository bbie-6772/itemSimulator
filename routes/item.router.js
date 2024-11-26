import express from 'express'
import dotenv from 'dotenv'
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
    health = Number.isInteger(+health) ? +health : 0
    power = Number.isInteger(+power) ? +power : 0

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

// 아이템 목록 조회 API
router.get('/items',async (req,res,next) => {
    const items = await prisma.itemTable.findMany({
        select: {
            itemCode: true,
            name: true,
            price: true
        }
    }) 

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
        .json({ errorMessage: `<item_code> ${itemCode}번의 아이템이 존재하지 않습니다` })

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

// 아이템 구매 API
router.patch('/items-buy/:charId', authMiddleware, async (req,res,next) => {
    const {charId} = req.params;
    const user = req.user;
    let resJson = [];
    //캐릭터 존재 확인
    const character = await prisma.characters.findFirst({ where: {charId: +charId}})
    if (!character) return res
        .status(404)
        .json({ errorMessage: `<character_id> ${charId} 에  해당하는 캐릭터가 존재하지 않습니다` })
    // 계정 소속여부 확인
    if (character.accountId !== user.accountId) return res
        .status(401)
        .json({ errorMessage: "본 계정이 소유한 캐릭터가 아닙니다." })
    //입력 값이 확인
    const perchase = req.body;
    if (!perchase) return res
        .status(400)
        .json({ errorMessage: "데이터 형식이 올바르지 않습니다." })
    //배열로 된 값일 시,
    if (Array.isArray(perchase)) {
        // 비용 총합 구하기
        const sum = perchase.reduce(async (acc, cur) => {
            // 아이템 코드 미입력 시,
            if (!cur.item_code) return res
                .status(400)
                .json({ errorMessage:"아이템코드 <item_code>을 입력해주세요" })
            // 아이템이 없을 시
            const item = await prisma.itemTable.findFirst({ where: {itemCode: +cur.item_code}})
            if (!item) return res
                .status(404)
                .json({ errorMessage: `<item_code> ${+cur.item_code}번의 아이템이 존재하지 않습니다` })
            // 수량 미 기입 시
            if (!cur.count) return res
                .status(400)
                .json({ errorMessage: "수량<count> 를 입력해주세요" })
            // 배열마다 값 추가
            acc += item.price * +cur.count
        },0) 
        // 지불할 돈이 없을 시
        if (character.money - sum < 0) return res
            .status(400)
            .json({ errorMessage: "아이템을 구매할 돈이 부족합니다" })
        
        for (const key of perchase) {
            // 구매( 돈 지불 + 아이템 인벤토리 이동) 트랜잭션
            const { updateCharacter, inventory } = await prisma.$transaction(async (tx) => {
                const item = await prisma.itemTable.findFirst({ where: { itemCode: +key.item_code } })
                // 가격 지불
                const updateCharacter = await tx.characters.update({
                    data: {
                        money: { decrement: item.price * +key.count}
                    },
                    where: { charId: +charId }
                })
                // 아이템 저장 (기존 값 유지)
                const items = await prisma.inventory.findFirst({ where: { charId: +charId } })
                let json
                // 기존 값이 있을 시
                if (items.items) {
                    let isExist = false;
                    // 아이템코드가 중복이면 합침
                    json = items.items.filter((val) => {
                        if (val.code === item.itemCode) {
                            val.amount += +key.count
                            isExist = true;
                        }
                        return true
                    })
                    // 아이템코드가 중복이 아닐 시 추가
                    if (!isExist) {
                        json = [...json, { code: item.itemCode, amount: +key.count }]
                    }
                // 처음 저장 시
                } else {
                    json = [{ code: item.itemCode, amount: +key.count }];
                }
                // 최종 저장
                const inventory = await tx.inventory.update({
                    data: {
                        items: json
                    },
                    where: { charId: +charId }
                })
                //출력 값 저장
                resJson = [...resJson, {
                    "message": `${item.name}(을)를 ${+key.count}만큼 구매에 성공하였습니다.`,
                    "total_amount": item.price * +key.count,
                    "balance": updateCharacter.money
                }]
                return {updateCharacter, inventory}
            })
        }
    // 단일 구매
    } else {
        // 아이템 코드 미입력 시,
        if (!perchase.item_code) return res
            .status(400)
            .json({ errorMessage: "아이템코드 <item_code>을 입력해주세요" })
        // 아이템이 없을 시
        const item = await prisma.itemTable.findFirst({ where: { itemCode: +perchase.item_code } })
        if (!item) return res
            .status(404)
            .json({ errorMessage: `<itemCode> ${+perchase.item_code}번의 아이템이 존재하지 않습니다` })
        // 수량 미 기입 시
        if (!perchase.count) return res
            .status(400)
            .json({ errorMessage: "수량<count> 를 입력해주세요" })
        const sum = item.price * +perchase.count
        // 지불할 돈이 없을 시
        if (character.money - sum < 0) return res
            .status(400)
            .json({ errorMessage: "아이템을 구매할 돈이 부족합니다" })
        const { updateCharacter, inventory } = await prisma.$transaction(async (tx) => {
            // 가격 지불
            const updateCharacter = await tx.characters.update({
                data: {
                    money: { decrement: sum }
                },
                where: { charId: +charId }
            })
            // 아이템 저장 (기존 값 유지)
            const items = await prisma.inventory.findFirst({ where: { charId: +charId } })
            let json
            // 기존 값이 있을 시
            if (items.items) {
                let isExist = false;
                // 아이템코드가 중복이면 합침
                json = items.items.filter((val) => {
                    if (val.code === item.itemCode) {
                        val.amount += +perchase.count
                        isExist = true;
                    }
                    return true
                })
                // 아이템코드가 중복이 아닐 시 추가
                if (!isExist) {
                    json = [...json, { code: item.itemCode, amount: +perchase.count }]
                }
                // 처음 저장 시
            } else {
                json = [{ code: item.itemCode, amount: +perchase.count }];
            }
            // 최종 저장
            const inventory = await tx.inventory.update({
                data: {
                    items: json
                },
                where: { charId: +charId }
            })
            //출력 값 저장
            resJson = [...resJson, {
                "message": `${item.name}(을)를 ${+perchase.count}만큼 구매에 성공하였습니다.`,
                "total_amount": sum,
                "balance": updateCharacter.money
            }]
            return { updateCharacter, inventory }
        })
    }
 
    return res
        .status(200)
        .json(resJson)
})

export default router;