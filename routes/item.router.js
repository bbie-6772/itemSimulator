import express from 'express';
import { prisma } from '../prisma/index.js';
import {
    itemVaild,
    charVaild
} from '../middlewares/valid.middleware.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';

const router = express.Router();

// 아이템 생성 API
router.post('/items', async (req, res, next) => {
    try {
        const { item_code, item_name, item_stat, item_price } = req.body;
        //아이템 생성용 변수
        let item;

        //이름 유효성 검사 확인
        if (!item_name)
            throw new Error('아이템 이름 <item_name> 을 입력해주세요', {
                cause: 400,
            });

        //이름 중복 여부
        const isExitItem = await prisma.itemTable.findFirst({
            where: { name: item_name },
        });
        if (isExitItem)
            throw new Error('이미 존재하는 아이템입니다', { cause: 409 });

        //능력치 입력 여부 확인
        if (!item_stat)
            throw new Error(
                `능력치 <item_stat>: {'스탯이름':값(숫자)} 을 입력해주세요`,
                { cause: 400 }
            );

        //가격 입력 여부 확인
        if (!(item_price && Number.isInteger(+item_price)))
            throw new Error('가격 <item_price> 를 숫자로 입력해주세요', {
                cause: 400,
            });

        //아이템 코드 중복 여부
        if (item_code && Number.isInteger(+item_code)) {
            const isExitCode = await prisma.itemTable.findFirst({
                where: { itemCode: item_code },
            });
            if (isExitCode)
                throw new Error('아이템 코드가 동일한 아이템이 있습니다', {
                    cause: 409,
                });
        }

        // 스탯 확인 및 없을 시(또는 값이 숫자가 아닐 시) 초기화
        let { health, power } = item_stat;
        health = Number.isInteger(+health) ? +health : 0;
        power = Number.isInteger(+power) ? +power : 0;

        // 아이템 코드 여부에 따라 다르게 생성
        if (item_code) {
            item = await prisma.itemTable.create({
                data: {
                    itemCode: +item_code,
                    price: +item_price,
                    name: item_name,
                    health,
                    power,
                },
            });
        } else {
            item = await prisma.itemTable.create({
                data: {
                    price: +item_price,
                    name: item_name,
                    health,
                    power,
                },
            });
        }
        return res.status(201).json({
            message: `새로운 아이템 ${item.name}(을)를 생성하셨습니다.`,
            data: {
                item_code: item.itemCode,
                item_stat: { health: item.health, power: item.power },
                item_price: item.price,
            },
        });
    } catch (err) {
        if (err.cause) next(err);
        else {
            console.error(err);
            next(new Error('<router> 잘못된 접근입니다.', { cause: 400 }));
        }
    }
});

// 아이템 목록 조회 API
router.get('/items', async (req, res, next) => {
    const items = await prisma.itemTable.findMany({
        select: {
            itemCode: true,
            name: true,
            price: true,
        },
    });

    return res.status(200).json({ itemList: items });
});

// 아이템 상세 조회 API
router.get('/items/:itemCode', itemVaild, async (req, res, next) => {
    const { item } = req;

    return res.status(200).json({
        item_code: item.itemCode,
        item_name: item.name,
        item_stat: { health: item.health, power: item.power },
        item_price: item.price,
    });
});

// 아이템 수정 API
router.patch('/items/:itemCode', itemVaild, async (req, res, next) => {
    try {
        const { itemCode } = req.params;
        let { item_name, item_stat } = req.body;
        let health, power;

        if (!(item_name || item_stat))
            throw new Error('아이템에 변경사항이 존재하지 않습니다', {
                cause: 400,
            });

        // 인수 확인 및 없을 시(+숫자가 아닐 시) 기본값 유지
        item_stat ? ({ health, power } = item_stat) : 0;
        item_name = item_name ? item_name : item.name;
        health = Number.isInteger(+health) ? +health : item.health;
        power = Number.isInteger(+power) ? +power : item.power;

        // 아이템 수정
        await prisma.itemTable.update({
            data: {
                name: item_name,
                health,
                power,
            },
            where: { itemCode: +itemCode },
        });
        // 수정된 아이템 정보
        const newItem = await prisma.itemTable.findFirst({
            where: { itemCode: +itemCode },
        });

        return res.status(201).json({
            message: `아이템 ${item.name}(이)가 수정되었습니다.`,
            data: {
                item_code: newItem.itemCode,
                item_name: newItem.name,
                item_stat: { health: newItem.health, power: newItem.power },
                item_price: newItem.price,
            },
        });
    } catch (err) {
        if (err.cause) next(err);
        else {
            console.error(err);
            next(new Error('<router> 잘못된 접근입니다.', { cause: 400 }));
        }
    }
});

// 아이템 구매 API
router.patch(
    '/items-buy/:charId',
    authMiddleware,
    charVaild,
    itemVaild,
    async (req, res, next) => {
        try {
            const { charId } = req.params;
            const { character } = req;
            let resJson = [];
            //입력 값 확인
            const perchase = req.body;

            //배열로 된 값일 시,
            if (Array.isArray(perchase)) {
                // 비용 총합 구하기
                const sum = await perchase.reduce(async (acc, cur) => {
                    const item = await prisma.itemTable.findFirst({
                        where: { itemCode: +cur.item_code },
                    });
                    // 수량 미 기입 시
                    if (!(cur.count && Number.isInteger(+cur.count)))
                        throw new Error(
                            '구매할 수량 <count> 를 숫자로 입력해주세요',
                            { cause: 400 }
                        );
                    // 배열마다 값 추가
                    return (await acc) + item.price * +cur.count;
                }, 0);
                // 지불할 돈이 없을 시
                if (character.money - sum < 0)
                    throw new Error('아이템을 구매할 돈이 부족합니다', {
                        cause: 400,
                    });

                for (const key of perchase) {
                    // 구매( 돈 지불 + 아이템 인벤토리 이동) 트랜잭션
                    const { updateCharacter, inventory } =
                        await prisma.$transaction(async (tx) => {
                            const item = await prisma.itemTable.findFirst({
                                where: { itemCode: +key.item_code },
                            });
                            // 가격 지불
                            const amonut = item.price * +key.count;
                            const updateCharacter = await tx.characters.update({
                                data: {
                                    money: { decrement: amonut },
                                },
                                where: { charId: +charId },
                            });
                            // 아이템 저장 (기존 값 유지)
                            const items = await prisma.inventory.findFirst({
                                where: { charId: +charId },
                            });
                            let json;
                            // 기존 값이 있을 시
                            if (items.items) {
                                let isExist = false;
                                // 아이템코드가 중복이면 합침
                                json = items.items.filter((val) => {
                                    if (val.code === item.itemCode) {
                                        val.amount += +key.count;
                                        isExist = true;
                                    }
                                    return true;
                                });
                                // 아이템코드가 중복이 아닐 시 추가
                                if (!isExist) {
                                    json = [
                                        ...json,
                                        {
                                            code: item.itemCode,
                                            amount: +key.count,
                                        },
                                    ];
                                }
                                // 처음 저장 시
                            } else {
                                json = [
                                    { code: item.itemCode, amount: +key.count },
                                ];
                            }
                            // 최종 저장
                            const inventory = await tx.inventory.update({
                                data: {
                                    items: json,
                                },
                                where: { charId: +charId },
                            });
                            //출력 값 저장
                            resJson = [
                                ...resJson,
                                {
                                    message: `${item.name}(을)를 ${+key.count}만큼 구매에 성공하였습니다.`,
                                    total_amount: amonut,
                                    balance: updateCharacter.money,
                                },
                            ];
                            return { updateCharacter, inventory };
                        });
                }
                // 단일 구매
            } else {
                const { item } = req;
                // 지불할 돈이 없을 시
                const amonut = item.price * +perchase.count;
                if (character.money - amonut < 0)
                    throw new Error('아이템을 구매할 돈이 부족합니다', {
                        cause: 400,
                    });
                // 구매( 돈 지불 + 아이템 인벤토리 이동) 트랜잭션
                const { updateCharacter, inventory } =
                    await prisma.$transaction(async (tx) => {
                        // 가격 지불
                        const updateCharacter = await tx.characters.update({
                            data: {
                                money: { decrement: amonut },
                            },
                            where: { charId: +charId },
                        });
                        // 아이템 저장 (기존 값 유지charId)
                        const items = await prisma.inventory.findFirst({
                            where: { charId: +charId },
                        });
                        let json;
                        // 기존 값이 있을 시
                        if (items.items) {
                            let isExist = false;
                            // 아이템코드가 중복이면 합침
                            json = items.items.filter((val) => {
                                if (val.code === item.itemCode) {
                                    val.amount += +perchase.count;
                                    isExist = true;
                                }
                                return true;
                            });
                            // 아이템코드가 중복이 아닐 시 추가
                            if (!isExist) {
                                json = [
                                    ...json,
                                    {
                                        code: item.itemCode,
                                        amount: +perchase.count,
                                    },
                                ];
                            }
                            // 처음 저장 시
                        } else {
                            json = [
                                {
                                    code: item.itemCode,
                                    amount: +perchase.count,
                                },
                            ];
                        }
                        // 최종 저장
                        const inventory = await tx.inventory.update({
                            data: {
                                items: json,
                            },
                            where: { charId: +charId },
                        });
                        //출력 값 저장
                        resJson = [
                            {
                                message: `${item.name}(을)를 ${+perchase.count}만큼 구매에 성공하였습니다.`,
                                total_amount: amonut,
                                balance: updateCharacter.money,
                            },
                        ];
                        return { updateCharacter, inventory };
                    });
            }

            return res.status(200).json(resJson);
        } catch (err) {
            if (err.cause) next(err);
            else {
                console.error(err);
                next(new Error('<router> 잘못된 접근입니다.', { cause: 400 }));
            }
        }
    }
);

// 아이템 판매 API
router.patch(
    '/items-sell/:charId',
    authMiddleware,
    charVaild,
    itemVaild,
    async (req, res, next) => {
        try {
            const { charId } = req.params;
            let resJson = [];

            const sale = req.body;

            //배열로 된 값일 시,
            if (Array.isArray(sale)) {
                for (const key of sale) {
                    // 아이템이 없을 시
                    const item = await prisma.itemTable.findFirst({
                        where: { itemCode: +key.item_code },
                    });
                    // 수량 미 기입 시
                    if (!(key.count && Number.isInteger(+key.count)))
                        throw new Error(
                            '판매할 수량 <count> 를 숫자로 입력해주세요',
                            { cause: 400 }
                        );
                    // 판매 할 아이템이 없을 시
                    const items = await prisma.inventory.findFirst({
                        where: { charId: +charId },
                    });
                    if (
                        !items.items ||
                        items.items.find((val) => val.code === +key.item_code)
                            .amount < +key.count
                    )
                        throw new Error(
                            '인벤토리에 판매할 아이템이 부족합니다',
                            { cause: 400 }
                        );

                    // 판매( 돈 지급 + 인벤토리 아이템 삭제) 트랜잭션
                    const { updateCharacter, inventory } =
                        await prisma.$transaction(async (tx) => {
                            // 돈 지급
                            const amount =
                                Math.round(item.price * 0.6) * +key.count;
                            const updateCharacter = await tx.characters.update({
                                data: {
                                    money: { increment: amount },
                                },
                                where: { charId: +charId },
                            });
                            // 아이템 삭제 (기존 값에서 제외)
                            const json = items.items.filter((val) => {
                                if (val.code === item.itemCode) {
                                    val.amount -= +key.count;
                                    if (val.amount <= 0) return false;
                                }
                                return true;
                            });
                            // 최종 저장
                            const inventory = await tx.inventory.update({
                                data: {
                                    items: json,
                                },
                                where: { charId: +charId },
                            });
                            //출력 값 저장
                            resJson = [
                                ...resJson,
                                {
                                    message: `${item.name}(을)를 ${+key.count}만큼 판매에 성공하였습니다.`,
                                    total_amount: amount,
                                    money: updateCharacter.money,
                                },
                            ];
                            return { updateCharacter, inventory };
                        });
                }
                // 단일 판매
            } else {
                const { item } = req;
                // 수량 미 기입 시
                if (!(sale.count && Number.isInteger(+sale.count)))
                    throw new Error(
                        '판매할 수량 <count> 를 숫자로 입력해주세요',
                        { cause: 400 }
                    );
                // 판매 할 아이템이 없을 시
                const items = await prisma.inventory.findFirst({
                    where: { charId: +charId },
                });
                if (
                    !items.items ||
                    items.items.find((val) => val.code === +sale.item_code)
                        .amount < +sale.count
                )
                    throw new Error('인벤토리에 판매할 아이템이 부족합니다', {
                        cause: 400,
                    });
                // 구매( 돈 지불 + 아이템 인벤토리 이동) 트랜잭션
                const { updateCharacter, inventory } =
                    await prisma.$transaction(async (tx) => {
                        // 돈 지급
                        const amount =
                            Math.round(item.price * 0.6) * +sale.count;
                        const updateCharacter = await tx.characters.update({
                            data: {
                                money: { increment: amount },
                            },
                            where: { charId: +charId },
                        });
                        // 아이템 삭제 (기존 값에서 제외)
                        const json = items.items.filter((val) => {
                            if (val.code === item.itemCode) {
                                val.amount -= +sale.count;
                                if (val.amount <= 0) return false;
                            }
                            return true;
                        });
                        // 최종 저장
                        const inventory = await tx.inventory.update({
                            data: {
                                items: json,
                            },
                            where: { charId: +charId },
                        });
                        //출력 값 저장
                        resJson = [
                            {
                                message: `${item.name}(을)를 ${+sale.count}만큼 판매에 성공하였습니다.`,
                                total_amount: amount,
                                money: updateCharacter.money,
                            },
                        ];
                        return { updateCharacter, inventory };
                    });
            }

            return res.status(200).json(resJson);
        } catch (err) {
            if (err.cause) next(err);
            else {
                console.error(err);
                next(new Error('<router> 잘못된 접근입니다.', { cause: 400 }));
            }
        }
    }
);

// 인벤토리 아이템 조회 API
router.get(
    '/items-inventory/:charId',
    authMiddleware,
    charVaild,
    async (req, res, next) => {
        const { charId } = req.params;

        // 아이템 확인
        const items = await prisma.inventory.findFirst({
            where: { charId: +charId },
        });
        if (!items.items)
            return res
                .status(404)
                .json({
                    errorMessage: '인벤토리에 아이템이 존재하지 않습니다',
                });
        // 출력값 조회
        const resJson = await Promise.all(
            items.items.map(async (val) => {
                const item = await prisma.itemTable.findFirst({
                    where: { itemCode: +val.code },
                });
                let json = {};
                json['item_code'] = item.itemCode;
                json['item_name'] = item.name;
                json['count'] = +val.amount;

                return json;
            })
        );

        return res.status(200).json(resJson);
    }
);

// 장착 장비 조회 API
router.get('/items-equip/:charId', charVaild, async (req, res, next) => {
    const { charId } = req.params;

    const items = await prisma.equipment.findFirst({
        where: { charId: +charId },
    });
    // 출력값 조회 (장비가 있을 경우에만)
    if (items.items) {
        const resJson = await Promise.all(
            items.items.map(async (val) => {
                const item = await prisma.itemTable.findFirst({
                    where: { itemCode: +val.code },
                });
                let json = {};
                json['item_code'] = item.itemCode;
                json['item_name'] = item.name;

                return json;
            })
        );
        return res.status(200).json(resJson);
    } else {
        return res.status(200).json([]);
    }
});

// 장비 장착 API
router.patch(
    '/items-equip/:charId',
    authMiddleware,
    charVaild,
    itemVaild,
    async (req, res, next) => {
        try {
            const { charId } = req.params;
            const equipItem = req.body;
            let resJson = [];

            //배열로 된 값일 시,
            if (Array.isArray(equipItem)) {
                for (const key of equipItem) {
                    // 장착 할 아이템이 없을 시
                    const items = await prisma.inventory.findFirst({
                        where: { charId: +charId },
                    });
                    if (
                        !items.items ||
                        !items.items.find((val) => val.code === +key.item_code)
                    )
                        throw new Error(
                            '인벤토리에 아이템이 존재하지 않습니다',
                            { cause: 400 }
                        );
                    // 장착한 아이템과 같을 시,
                    const equipItems = await prisma.equipment.findFirst({
                        where: { charId: +charId },
                    });
                    if (
                        equipItems.items
                            ? equipItems.items.find(
                                  (val) => val.code === +key.item_code
                              )
                            : false
                    )
                        throw new Error('이미 장착하고 있는 아이템입니다', {
                            cause: 409,
                        });

                    // 장착(인벤토리 삭제 + 장비창 추가 + 캐릭터 스탯 적용) 트랜잭션
                    const { updateCharacter, inventory, equipment } =
                        await prisma.$transaction(async (tx) => {
                            const item = await prisma.itemTable.findFirst({
                                where: { itemCode: +key.item_code },
                            });
                            // 아이템 삭제 (기존 값에서 제외)
                            const json = items.items.filter((val) => {
                                if (val.code === item.itemCode) {
                                    val.amount -= 1;
                                    if (val.amount <= 0) return false;
                                }
                                return true;
                            });
                            let equip = {};
                            // 장착한 장비가 없을 시,
                            if (!equipItems.items) {
                                equip = [{ code: item.itemCode }];
                                // 장착한 장비가 있을 때
                            } else {
                                equip = [
                                    ...equipItems.items,
                                    { code: item.itemCode },
                                ];
                            }
                            // 인벤토리 삭제 적용
                            const inventory = await tx.inventory.update({
                                data: {
                                    items: json,
                                },
                                where: { charId: +charId },
                            });
                            // 장비창 아이템 추가 적용
                            const equipment = await tx.equipment.update({
                                data: {
                                    items: equip,
                                },
                                where: { charId: +charId },
                            });
                            // 캐릭터 스탯적용
                            const updateCharacter = await tx.characters.update({
                                data: {
                                    health: { increment: item.health },
                                    power: { increment: item.power },
                                },
                                where: { charId: +charId },
                            });

                            //출력 값 저장
                            resJson = [
                                ...resJson,
                                {
                                    message: `${item.name}(을)를 장착하였습니다.`,
                                    health: `+${item.health}`,
                                    power: `+${item.power}`,
                                },
                            ];
                            return { updateCharacter, inventory, equipment };
                        });
                }
                // 단일 장착
            } else {
                const { item } = req;
                // 장착 할 아이템이 없을 시
                const items = await prisma.inventory.findFirst({
                    where: { charId: +charId },
                });
                if (
                    !items.items ||
                    !items.items.find(
                        (val) => val.code === +equipItem.item_code
                    )
                )
                    throw new Error('인벤토리에 아이템이 존재하지 않습니다', {
                        cause: 400,
                    });
                // 장착한 아이템과 같을 시,
                const equipItems = await prisma.equipment.findFirst({
                    where: { charId: +charId },
                });
                if (
                    equipItems.items
                        ? equipItems.items.find(
                              (val) => val.code === +equipItem.item_code
                          )
                        : false
                )
                    throw new Error('이미 장착하고 있는 아이템입니다', {
                        cause: 409,
                    });

                // 장착(인벤토리 삭제 + 장비창 추가 + 캐릭터 스탯 적용) 트랜잭션
                const { updateCharacter, inventory, equipment } =
                    await prisma.$transaction(async (tx) => {
                        // 아이템 삭제 (기존 값에서 제외)
                        const json = items.items.filter((val) => {
                            if (val.code === item.itemCode) {
                                val.amount -= 1;
                                if (val.amount <= 0) return false;
                            }
                            return true;
                        });
                        let equip = {};
                        // 장착한 장비가 없을 시,
                        if (!equipItems.items) {
                            equip = [{ code: item.itemCode }];
                            // 장착한 장비가 있을 때
                        } else {
                            equip = [
                                ...equipItems.items,
                                { code: item.itemCode },
                            ];
                        }
                        // 인벤토리 적용
                        const inventory = await tx.inventory.update({
                            data: {
                                items: json,
                            },
                            where: { charId: +charId },
                        });
                        // 장비창 적용
                        const equipment = await tx.equipment.update({
                            data: {
                                items: equip,
                            },
                            where: { charId: +charId },
                        });
                        // 캐릭터 스탯적용
                        const updateCharacter = await tx.characters.update({
                            data: {
                                health: { increment: item.health },
                                power: { increment: item.power },
                            },
                            where: { charId: +charId },
                        });

                        //출력 값 저장
                        resJson = [
                            {
                                message: `${item.name}(을)를 장착하였습니다.`,
                                health: `+${item.health}`,
                                power: `+${item.power}`,
                            },
                        ];
                        return { updateCharacter, inventory, equipment };
                    });
            }

            const character = await prisma.characters.findFirst({
                where: { charId: +charId },
            });

            resJson = [
                ...resJson,
                {
                    name: character.name,
                    health: character.health,
                    power: character.power,
                },
            ];

            return res.status(200).json(resJson);
        } catch (err) {
            if (err.cause) next(err);
            else {
                console.error(err);
                next(new Error('<router> 잘못된 접근입니다.', { cause: 400 }));
            }
        }
    }
);

// 장비 탈착 API
router.patch(
    '/items-takeOff/:charId',
    authMiddleware,
    charVaild,
    itemVaild,
    async (req, res, next) => {
        try {
            const { charId } = req.params;
            const takeOffItem = req.body;
            let resJson = [];

            //배열로 된 값일 시,
            if (Array.isArray(takeOffItem)) {
                for (const key of takeOffItem) {
                    // 장착한 아이템에 없을 시,
                    const equipitems = await prisma.equipment.findFirst({
                        where: { charId: +charId },
                    });
                    if (
                        equipitems.items
                            ? !equipitems.items.find(
                                  (val) => val.code === +key.item_code
                              )
                            : true
                    )
                        throw new Error('장착하고 있는 아이템이 아닙니다', {
                            cause: 409,
                        });
                    const items = await prisma.inventory.findFirst({
                        where: { charId: +charId },
                    });

                    // 탈착(인벤토리 추가 + 장비창 삭제 + 캐릭터 스탯 적용) 트랜잭션
                    const { updateCharacter, inventory, equipment } =
                        await prisma.$transaction(async (tx) => {
                            const item = await prisma.itemTable.findFirst({
                                where: { itemCode: +key.item_code },
                            });
                            // 아이템 추가
                            let json = {};
                            // 기존 값이 있을 시
                            if (items.items) {
                                let isExist = false;
                                // 아이템코드가 중복이면 합침
                                json = items.items.filter((val) => {
                                    if (val.code === item.itemCode) {
                                        val.amount += 1;
                                        isExist = true;
                                    }
                                    return true;
                                });
                                // 아이템코드가 중복이 아닐 시 추가
                                if (!isExist) {
                                    json = [
                                        ...json,
                                        { code: item.itemCode, amount: 1 },
                                    ];
                                }
                                // 인벤토리가 텅 비어있을 시
                            } else {
                                json = [{ code: item.itemCode, amount: 1 }];
                            }
                            // 아이템 삭제
                            const equip = equipitems.items.filter(
                                (val) => +val.code !== item.itemCode
                            );

                            // 인벤토리 적용
                            const inventory = await tx.inventory.update({
                                data: {
                                    items: json,
                                },
                                where: { charId: +charId },
                            });
                            // 장비창 적용
                            const equipment = await tx.equipment.update({
                                data: {
                                    items: equip,
                                },
                                where: { charId: +charId },
                            });
                            // 캐릭터 스탯적용
                            const updateCharacter = await tx.characters.update({
                                data: {
                                    health: { decrement: item.health },
                                    power: { decrement: item.power },
                                },
                                where: { charId: +charId },
                            });

                            //출력 값 저장
                            resJson = [
                                ...resJson,
                                {
                                    message: `${item.name}(을)를 해제하였습니다.`,
                                    health: `-${item.health}`,
                                    power: `-${item.power}`,
                                },
                            ];
                            return { updateCharacter, inventory, equipment };
                        });
                }
                // 단일 탈착
            } else {
                const { item } = req;
                // 장착한 아이템에 없을 시,
                const equipitems = await prisma.equipment.findFirst({
                    where: { charId: +charId },
                });
                if (
                    equipitems.items
                        ? !equipitems.items.find(
                              (val) => val.code === +takeOffItem.item_code
                          )
                        : true
                )
                    throw new Error('장착하고 있는 아이템이 아닙니다', {
                        cause: 409,
                    });
                const items = await prisma.inventory.findFirst({
                    where: { charId: +charId },
                });

                // 탈착(인벤토리 추가 + 장비창 삭제 + 캐릭터 스탯 적용) 트랜잭션
                const { updateCharacter, inventory, equipment } =
                    await prisma.$transaction(async (tx) => {
                        // 아이템 추가
                        let json = {};
                        // 기존 값이 있을 시
                        if (items.items) {
                            let isExist = false;
                            // 아이템코드가 중복이면 합침
                            json = items.items.filter((val) => {
                                if (val.code === item.itemCode) {
                                    val.amount += 1;
                                    isExist = true;
                                }
                                return true;
                            });
                            // 아이템코드가 중복이 아닐 시 추가
                            if (!isExist) {
                                json = [
                                    ...json,
                                    { code: item.itemCode, amount: 1 },
                                ];
                            }
                            // 인벤토리가 텅 비어있을 시
                        } else {
                            json = [{ code: item.itemCode, amount: 1 }];
                        }
                        // 아이템 삭제
                        const equip = equipitems.items.filter(
                            (val) => +val.code !== item.itemCode
                        );

                        // 인벤토리 적용
                        const inventory = await tx.inventory.update({
                            data: {
                                items: json,
                            },
                            where: { charId: +charId },
                        });
                        // 장비창 적용
                        const equipment = await tx.equipment.update({
                            data: {
                                items: equip,
                            },
                            where: { charId: +charId },
                        });
                        // 캐릭터 스탯적용
                        const updateCharacter = await tx.characters.update({
                            data: {
                                health: { decrement: item.health },
                                power: { decrement: item.power },
                            },
                            where: { charId: +charId },
                        });

                        //출력 값 저장
                        resJson = [
                            {
                                message: `${item.name}(을)를 해제하였습니다.`,
                                health: `-${item.health}`,
                                power: `-${item.power}`,
                            },
                        ];
                        return { updateCharacter, inventory, equipment };
                    });
            }

            const character = await prisma.characters.findFirst({
                where: { charId: +charId },
            });

            resJson = [
                ...resJson,
                {
                    name: character.name,
                    health: character.health,
                    power: character.power,
                },
            ];

            return res.status(200).json(resJson);
        } catch (err) {
            if (err.cause) next(err);
            else {
                console.error(err);
                next(new Error('<router> 잘못된 접근입니다.', { cause: 400 }));
            }
        }
    }
);

export default router;
