import { prisma } from '../prisma/index.js'

//account 관련 유효성 평가 미들웨어
const signVaild = async function (req, res, next) {
    try {
        const { id, password } = req.body;

        //유효성 평가 정규식사용으로 id 입력값이 소문자+숫자만 가능하게
        if (!/^[a-z0-9]*$/.test(id)) throw new Error("아이디는 소문자와 숫자로만 입력해주세요",{ cause: 400 })

        // 비밀번호가 6글자 이상인지 확인
        if (!/\b.{6,}/.test(password)) throw new Error("비밀번호는 6글자 이상으로 작성해주세요", { cause: 400 })

        next()
        //던진 오류들 반환
    } catch (err) {
        if (err.cause) next(err)
        else {
            console.error(err)
            next(new Error("<middleware> : signVaild 잘못된 접근입니다.", { cause: 400 }))
        }
    }
}

//character 관련 유효성 평가 미들웨어
const charVaild = async function (req, res, next) {
    try {
        const { charId } = req.params;
        const { user } = req;

        // 캐릭터 id 확인
        if (!charId || !Number.isInteger(+charId)) throw new Error("선택할 <character_id>를 URL에 숫자로 입력해주세요.", { cause: 400 })
        
        // 캐릭터 존재여부 확인
        const character = await prisma.characters.findFirst({ where: { charId: +charId } })
        if (!character) throw new Error(`<character_id> ${charId} 에 해당하는 캐릭터가 존재하지 않습니다.`, { cause: 404 })
        req.character = character

        // 계정에 귀속된 캐릭터가 맞는지 확인(user가 있을 경우)
        if (user) {
            if (character.accountId !== user.accountId) throw new Error("본 계정이 소유한 캐릭터가 아닙니다.", { cause: 401 })
        }

        next()
        //던진 오류들 반환
    } catch (err) {
        if (err.cause) next(err)
        else {
            console.error(err) 
            next(new Error("<middleware> : charVaild 잘못된 접근입니다.", { cause: 400 }))
        }
    }
}

//item 관련 유효성 평가 미들웨어
const itemVaild = async function (req, res, next) {
    try {
        const { itemCode } = req.params;
        const { body } = req;
        const { item_code } = body
        const reqItemCode = itemCode ?? item_code

        // 아이템 id 확인
        if (!reqItemCode || !Number.isInteger(+reqItemCode)) {
            if (reqItemCode === itemCode ) {
                throw new Error("선택할 <item_code> 를 URL에 숫자로 입력해주세요.", { cause: 400 })
            } else if (reqItemCode === item_code)
                throw new Error("선택할 <item_code> 를 숫자로 입력해주세요.", { cause: 400 })
        }

        // 아이템 유효성 평가
        const item = await prisma.itemTable.findFirst({ where: { itemCode: +reqItemCode } })
        if (!item) throw new Error(`<item_code> ${reqItemCode}번의 아이템이 존재하지 않습니다`, { cause: 404 })
        req.item = item

        next()
        //던진 오류들 반환
    } catch (err) {
        if (err.cause) next(err)
        else  {
            console.error(err)
            next(new Error("<middleware> : itemVaild 잘못된 접근입니다.", { cause: 400 }))
        }
        
    }
}

//복수형(배열) 아이템 유효성 평가 미들웨어
const pluralResponse = async function (req, res, next) {
    try {
        const {body} = req

        if (!body) throw new Error("데이터 형식이 올바르지 않습니다", { cause: 400 })

        if (Array.isArray(body)) {
            for (const itemInfo of body) {
                // 아이템 id 확인
                if (!itemInfo.item_code || !Number.isInteger(+itemInfo.item_code)) throw new Error("선택할 <item_code> 를 숫자로 입력해주세요.", { cause: 400 })

                // 아이템 유효성 평가
                const item = await prisma.itemTable.findFirst({ where: { itemCode: +itemInfo.item_code } })
                if (!item) throw new Error(`<item_code> ${itemInfo.item_code}번의 아이템이 존재하지 않습니다`, { cause: 404 })
            }
            next()
        } else {
            return itemVaild(req,res,next)
        }
        //던진 오류들 반환
    } catch (err) {
        if (err.cause) next(err)
        else {
            console.error(err)
            next(new Error("<middleware> : pluralResponse 잘못된 접근입니다.", { cause: 400 }))
        }
    }
}

export { signVaild, charVaild, itemVaild, pluralResponse }