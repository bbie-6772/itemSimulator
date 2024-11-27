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
            .json({ errorMessage: "능력치 <item_stat: {\"스탯이름\":값(숫자)}> 을 입력해주세요" })
    }
    // 스탯 확인 및 없을 시(또는 값이 숫자가 아닐 시) 초기화
    let { health, power } = item_stat
    health = Number.isInteger(+health) ? +health : 0
    power = Number.isInteger(+power) ? +power : 0

    //가격 입력 여부 확인
    if (!(item_price && Number.isInteger(+item_price))) return res
        .status(400)
        .json({ errorMessage: "가격 <item_price> 를 숫자로 입력해주세요" })
    // 코드 여부(숫자 인지도)에 따라 다르게 생성
    if (item_code && Number.isInteger(+item_code)) {
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
    // 인수 확인 및 없을 시(+숫자가 아닐 시) 기본값 유지
    item_stat ? { health, power } = item_stat : 0
    item_name = item_name ? item_name : item.name
    health = Number.isInteger(+health) ? +health : item.health
    power = Number.isInteger(+power) ? +power : item.power

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
    try {
        const {charId} = req.params;
        const user = req.user;
        let resJson = [];

        //캐릭터 존재 확인
        const character = await prisma.characters.findFirst({ where: {charId: +charId}})
        if (!character) return res
            .status(404)
            .json({ errorMessage: `<character_id> ${charId} 에 해당하는 캐릭터가 존재하지 않습니다` })
        // 계정 소속여부 확인
        if (character.accountId !== user.accountId) return res
            .status(401)
            .json({ errorMessage: "본 계정이 소유한 캐릭터가 아닙니다." })
        //입력 값 확인
        const perchase = req.body;
        if (!perchase) return res
            .status(400)
            .json({ errorMessage: "데이터 형식이 올바르지 않습니다." })
        //배열로 된 값일 시,
        if (Array.isArray(perchase)) {
            // 비용 총합 구하기
            const sum = await perchase.reduce(async (acc, cur) => {
                // 아이템 코드 미입력(+숫자가 아닐 시) 시,
                if (!(cur.item_code && Number.isInteger(+cur.item_code))) return res
                    .status(400)
                    .json({ errorMessage:"아이템코드 <item_code> 를 숫자로 입력해주세요" })
                // 아이템이 없을 시
                const item = await prisma.itemTable.findFirst({ where: {itemCode: +cur.item_code}})
                if (!item) return res
                    .status(404)
                    .json({ errorMessage: `<item_code> ${+cur.item_code}번의 아이템이 존재하지 않습니다` })
                // 수량 미 기입 시
                if (!(cur.count && Number.isInteger(+cur.count))) return res
                    .status(400)
                    .json({ errorMessage: "구매할 수량 <count> 를 숫자로 입력해주세요" })
                // 배열마다 값 추가
                return await acc + item.price * +cur.count
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
                    const amonut = item.price * +key.count
                    const updateCharacter = await tx.characters.update({
                        data: {
                            money: { decrement: amonut }
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
                        "total_amount": amonut,
                        "balance": updateCharacter.money
                    }]
                    return {updateCharacter, inventory}
                })
            }
        // 단일 구매
        } else {
            // 아이템 코드 미입력 시,
            if (!(perchase.item_code && Number.isInteger(+perchase.item_code))) return res
                .status(400)
                .json({ errorMessage: "아이템코드 <item_code> 를 숫자로 입력해주세요" })
            // 아이템이 없을 시
            const item = await prisma.itemTable.findFirst({ where: { itemCode: +perchase.item_code } })
            if (!item) return res
                .status(404)
                .json({ errorMessage: `<itemCode> ${+perchase.item_code}번의 아이템이 존재하지 않습니다` })
            // 수량 미 기입 시
            if (!(perchase.count && Number.isInteger(+perchase.count))) return res
                .status(400)
                .json({ errorMessage: "구매할 수량 <count> 를 숫자로 입력해주세요" })
            // 지불할 돈이 없을 시
            const amonut = item.price * +perchase.count
            if (character.money - amonut < 0) return res
                .status(400)
                .json({ errorMessage: "아이템을 구매할 돈이 부족합니다" })
            // 구매( 돈 지불 + 아이템 인벤토리 이동) 트랜잭션
            const { updateCharacter, inventory } = await prisma.$transaction(async (tx) => {
                // 가격 지불
                const updateCharacter = await tx.characters.update({
                    data: {
                        money: { decrement: amonut }
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
                resJson = [{
                    "message": `${item.name}(을)를 ${+perchase.count}만큼 구매에 성공하였습니다.`,
                    "total_amount": amonut,
                    "balance": updateCharacter.money
                }]
                return { updateCharacter, inventory }
            })
        }
    
        return res
            .status(200)
            .json(resJson)
    } catch (err) {
        next(err)
    }
    
})

// 아이템 판매 API
router.patch('/items/:charId', authMiddleware, async (req, res, next) => {
    try {
            
        const { charId } = req.params;
        const user = req.user;
        let resJson = [];

        //캐릭터 존재 확인
        const character = await prisma.characters.findFirst({ where: { charId: +charId } })
        if (!character) return res
            .status(404)
            .json({ errorMessage: `<character_id> ${charId} 에 해당하는 캐릭터가 존재하지 않습니다` })
        // 계정 소속여부 확인
        if (character.accountId !== user.accountId) return res
            .status(401)
            .json({ errorMessage: "본 계정이 소유한 캐릭터가 아닙니다." })
        //입력 값 확인
        const sale = req.body;
        if (!sale) return res
            .status(400)
            .json({ errorMessage: "데이터 형식이 올바르지 않습니다." })
        //배열로 된 값일 시,
        if (Array.isArray(sale)) {
            for (const key of sale) {
                // 아이템 코드 미입력(+숫자가 아닐 시) 시
                if (!(key.item_code && Number.isInteger(+key.item_code))) return res
                    .status(400)
                    .json({ errorMessage: "아이템코드 <item_code> 를 숫자로 입력해주세요" })
                // 아이템이 없을 시
                const item = await prisma.itemTable.findFirst({ where: { itemCode: +key.item_code } })
                if (!item) return res
                    .status(404)
                    .json({ errorMessage: `<item_code> ${+key.item_code}번의 아이템이 존재하지 않습니다` })
                // 수량 미 기입 시
                if (!(key.count && Number.isInteger(+key.count))) return res
                    .status(400)
                    .json({ errorMessage: "판매할 수량 <count> 를 숫자로 입력해주세요" })
                // 판매 할 아이템이 없을 시
                const items = await prisma.inventory.findFirst({ where: { charId: +charId } })
                if (!items.items || items.items.find((val) => val.code === +key.item_code).amount < +key.count) return res
                    .status(400)
                    .json({ errorMessage: "인벤토리에 판매할 아이템이 부족합니다" })

                // 판매( 돈 지급 + 인벤토리 아이템 삭제) 트랜잭션
                const { updateCharacter, inventory } = await prisma.$transaction(async (tx) => {
                    // 돈 지급
                    const amount = Math.round(item.price * 0.6) * +key.count;
                    const updateCharacter = await tx.characters.update({
                        data: {
                            money: { increment: amount }
                        },
                        where: { charId: +charId }
                    })
                    // 아이템 삭제 (기존 값에서 제외)
                    const json = items.items.filter((val) => {
                        if (val.code === item.itemCode) {
                            val.amount -= +key.count
                            if (val.amount <= 0) return false
                        }
                        return true
                    })
                    // 최종 저장
                    const inventory = await tx.inventory.update({
                        data: {
                            items: json
                        },
                        where: { charId: +charId }
                    })
                    //출력 값 저장
                    resJson = [...resJson, {
                        "message": `${item.name}(을)를 ${+key.count}만큼 판매에 성공하였습니다.`,
                        "total_amount": amount,
                        "money": updateCharacter.money
                    }]
                    return { updateCharacter, inventory }
                })
            }
            // 단일 판매
        } else {
            // 아이템 코드 미입력(+숫자가 아닐 시) 시
            if (!(sale.item_code && Number.isInteger(+sale.item_code))) return res
                .status(400)
                .json({ errorMessage: "아이템코드 <item_code> 를 숫자로 입력해주세요" })
            // 아이템이 없을 시
            const item = await prisma.itemTable.findFirst({ where: { itemCode: +sale.item_code } })
            if (!item) return res
                .status(404)
                .json({ errorMessage: `<item_code> ${+sale.item_code}번의 아이템이 존재하지 않습니다` })
            // 수량 미 기입 시
            if (!(sale.count && Number.isInteger(+sale.count))) return res
                .status(400)
                .json({ errorMessage: "판매할 수량 <count> 를 숫자로 입력해주세요" })
            // 판매 할 아이템이 없을 시
            const items = await prisma.inventory.findFirst({ where: { charId: +charId } })
            if (!items.items || items.items.find((val) => val.code === +sale.item_code).amount < +sale.count) return res
                .status(400)
                .json({ errorMessage: "인벤토리에 판매할 아이템이 부족합니다" })
            // 구매( 돈 지불 + 아이템 인벤토리 이동) 트랜잭션
            const { updateCharacter, inventory } = await prisma.$transaction(async (tx) => {
                // 돈 지급
                const amount = Math.round(item.price * 0.6) * +sale.count;
                const updateCharacter = await tx.characters.update({
                    data: {
                        money: { increment: amount }
                    },
                    where: { charId: +charId }
                })
                // 아이템 삭제 (기존 값에서 제외)
                const json = items.items.filter((val) => {
                    if (val.code === item.itemCode) {
                        val.amount -= +sale.count
                        if (val.amount <= 0) return false
                    }
                    return true
                })
                // 최종 저장
                const inventory = await tx.inventory.update({
                    data: {
                        items: json
                    },
                    where: { charId: +charId }
                })
                //출력 값 저장
                resJson = [{
                    "message": `${item.name}(을)를 ${+sale.count}만큼 판매에 성공하였습니다.`,
                    "total_amount": amount,
                    "money": updateCharacter.money
                }]
                return { updateCharacter, inventory }
            })
        }

        return res
            .status(200)
            .json(resJson)
    } catch (err) {
        next(err)
    }
})

// 인벤토리 아이템 조회 API
router.get('/items-inventory/:charId', authMiddleware, async (req,res,next) => {
    const user = req.user
    const {charId} = req.params
    
    //캐릭터 존재 확인
    const character = await prisma.characters.findFirst({ where: { charId: +charId } })
    if (!character) return res
        .status(404)
        .json({ errorMessage: `<character_id> ${charId} 에 해당하는 캐릭터가 존재하지 않습니다` })
    // 계정 소속여부 확인
    if (character.accountId !== user.accountId) return res
        .status(401)
        .json({ errorMessage: "본 계정이 소유한 캐릭터가 아닙니다." })
    // 아이템 확인
    const items = await prisma.inventory.findFirst({ where: { charId: +charId } })
    if (!items.items) return res
        .status(404)
        .json({ errorMessage: "인벤토리에 아이템이 존재하지 않습니다" })
    // 출력값 조회
    const resJson = await Promise.all(items.items.map( async (val) => {  
        const item = await prisma.itemTable.findFirst({ where : {itemCode: +val.code}})
        let json = {}
        json["item_code"] = item.itemCode
        json["item_name"] = item.name
        json["count"] = +val.amount

        return json
    }))

    return res
        .status(200)
        .json(resJson)
})

// 장착 장비 조회 API
router.get('/items-equip/:charId', async(req,res,next) => {
    const {charId} = req.params

    //캐릭터 존재 확인
    const character = await prisma.characters.findFirst({ where: { charId: +charId } })
    if (!character) return res
        .status(404)
        .json({ errorMessage: `<character_id> ${charId} 에  해당하는 캐릭터가 존재하지 않습니다` })
    const items = await prisma.equipment.findFirst({ where: { charId: +charId } })
    // 출력값 조회 (장비가 있을 경우에만)
    if (items.items) {
        const resJson = await Promise.all(items.items.map(async (val) => {
            const item = await prisma.itemTable.findFirst({ where: { itemCode: +val.code } })
            let json = {}
            json["item_code"] = item.itemCode
            json["item_name"] = item.name

            return json
        }))
        return res
            .status(200)
            .json(resJson)
    } else {
        return res
            .status(200)
            .json({})
    }
})

// 장비 장착 API
router.patch('/items-equip/:charId', authMiddleware, async (req,res,next) => {
    const {charId} = req.params
    const user = req.user;
    const equipItem = req.body;
    let resJson = [];

    //캐릭터 존재 확인
    let character = await prisma.characters.findFirst({ where: { charId: +charId } })
    if (!character) return res
        .status(404)
        .json({ errorMessage: `<character_id> ${charId} 에 해당하는 캐릭터가 존재하지 않습니다` })
    // 계정 소속여부 확인
    if (character.accountId !== user.accountId) return res
        .status(401)
        .json({ errorMessage: "본 계정이 소유한 캐릭터가 아닙니다." })
    //배열로 된 값일 시,
    if (Array.isArray(equipItem)) {
        for (const key of equipItem) {
            // 아이템 코드 미입력(+숫자가 아닐 시) 시
            if (!(key.item_code && Number.isInteger(+key.item_code))) return res
                .status(400)
                .json({ errorMessage: "장착할 아이템의 코드 <item_code> 를 숫자로 입력해주세요" })
            // 아이템이 없을 시
            const item = await prisma.itemTable.findFirst({ where: { itemCode: +key.item_code } })
            if (!item) return res
                .status(404)
                .json({ errorMessage: `<item_code> ${+key.item_code}번의 아이템이 존재하지 않습니다` })
            // 장착 할 아이템이 없을 시
            const items = await prisma.inventory.findFirst({ where: { charId: +charId } })
            if (!items.items || !items.items.find((val) => val.code === +key.item_code)) return res
                .status(400)
                .json({ errorMessage: "인벤토리에 아이템이 존재하지 않습니다" })
            // 장착한 아이템과 같을 시,
            const equipItems = await prisma.equipment.findFirst({ where: { charId: +charId } })
            if (equipItems.items ? equipItems.items.find((val) => val.code === +key.item_code) : false) return res
                .status(409)
                .json({ errorMessage: "이미 장착하고 있는 아이템입니다" })

            // 장착(인벤토리 삭제 + 장비창 추가 + 캐릭터 스탯 적용) 트랜잭션
            const { updateCharacter, inventory, equipment } = await prisma.$transaction(async (tx) => {
                // 아이템 삭제 (기존 값에서 제외)
                const json = items.items.filter((val) => {
                    if (val.code === item.itemCode) {
                        val.amount -= 1
                        if (val.amount <= 0) return false
                    }
                    return true
                })
                let equip = {};
                // 장착한 장비가 없을 시,
                if (!equipItems.items) {
                    equip = [{ code: item.itemCode }];
                // 장착한 장비가 있을 때
                } else {
                    equip = [...equipItems.items, { code: item.itemCode }]
                }
                // 인벤토리 삭제 적용
                const inventory = await tx.inventory.update({
                    data: {
                        items: json
                    },
                    where: { charId: +charId }
                })
                // 장비창 아이템 추가 적용
                const equipment = await tx.equipment.update({
                    data: {
                        items: equip
                    },
                    where: { charId: +charId }
                })
                // 캐릭터 스탯적용
                const updateCharacter = await tx.characters.update({
                    data: {
                        health: { increment: item.health },
                        power: { increment: item.power }
                    },
                    where: { charId: +charId }
                })

                //출력 값 저장
                resJson = [...resJson, {
                    "message": `${item.name}(을)를 장착하였습니다.`,
                    "health": `+${item.health}`,
                    "power": `+${item.power}`
                }]
                return { updateCharacter, inventory, equipment }
            })
        }
        // 단일 장착
    } else {
        // 아이템 코드 미입력(+숫자가 아닐 시) 시
        if (!(equipItem.item_code && Number.isInteger(+equipItem.item_code))) return res
            .status(400)
            .json({ errorMessage: "장착할 아이템의 코드 <item_code> 를 숫자로 입력해주세요" })
        // 아이템이 없을 시
        const item = await prisma.itemTable.findFirst({ where: { itemCode: +equipItem.item_code } })
        if (!item) return res
            .status(404)
            .json({ errorMessage: `<item_code> ${+equipItem.item_code}번의 아이템이 존재하지 않습니다` })
        // 장착 할 아이템이 없을 시
        const items = await prisma.inventory.findFirst({ where: { charId: +charId } })
        if (!items.items || !items.items.find((val) => val.code === +equipItem.item_code)) return res
            .status(400)
            .json({ errorMessage: "인벤토리에 아이템이 존재하지 않습니다" })
        // 장착한 아이템과 같을 시,
        const equipItems = await prisma.equipment.findFirst({ where: { charId: +charId } })
        if (equipItems.items ? equipItems.items.find((val) => val.code === +equipItem.item_code) : false) return res
            .status(409)
            .json({ errorMessage: "이미 장착하고 있는 아이템입니다" })

        // 장착(인벤토리 삭제 + 장비창 추가 + 캐릭터 스탯 적용) 트랜잭션
        const { updateCharacter, inventory, equipment } = await prisma.$transaction(async (tx) => {
            // 아이템 삭제 (기존 값에서 제외)
            const json = items.items.filter((val) => {
                if (val.code === item.itemCode) {
                    val.amount -= 1
                    if (val.amount <= 0) return false
                }
                return true
            })
            let equip = {};
            // 장착한 장비가 없을 시,
            if (!equipItems.items) {
                equip = [{ code: item.itemCode }];
                // 장착한 장비가 있을 때
            } else {
                equip = [...equipItems.items, { code: item.itemCode }]
            }
            // 인벤토리 적용
            const inventory = await tx.inventory.update({
                data: {
                    items: json
                },
                where: { charId: +charId }
            })
            // 장비창 적용
            const equipment = await tx.equipment.update({
                data: {
                    items: equip
                },
                where: { charId: +charId }
            })
            // 캐릭터 스탯적용
            const updateCharacter = await tx.characters.update({
                data: {
                    health: { increment: item.health },
                    power: { increment: item.power }
                },
                where: { charId: +charId }
            })

            //출력 값 저장
            resJson = [{
                message: `${item.name}(을)를 장착하였습니다.`,
                health: `+${item.health}`,
                power: `+${item.power}`
            }]
            return { updateCharacter, inventory, equipment }
        })
    }

    character = await prisma.characters.findFirst({ where: { charId: +charId } })

    resJson = [...resJson,{
            name: character.name,
            health: character.health,
            power: character.power
        }]

    return res
        .status(200)
        .json(resJson)

})

export default router;