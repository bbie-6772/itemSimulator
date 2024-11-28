import { prisma } from '../prisma/index.js'

//account 관련 유효성 평가 미들웨어
const signVaild = async function (req, res, next) {
    try {
        const { id, password } = req.body;

        //유효성 평가 정규식사용으로 id 입력값이 소문자+숫자만 가능하게
        if (!/^[a-z0-9]*$/.test(id)) throw errorWithStatus("아이디는 소문자와 숫자로만 입력해주세요",{ cause: 400 })

        // 비밀번호가 6글자 이상인지 확인
        if (!/\b.{6,}/.test(password)) throw new Error("비밀번호는 6글자 이상으로 작성해주세요", { cause: 400 })

        next()
        //던진 오류들 확인해서 반환
    } catch (err) {
        if (err.cause) return res
            .status(err.cause)
            .json({ errorMessage: err.message })
        console.log(err.message)
        return res
            .status(400)
            .json({ errorMessage: "잘못된 접근입니다." });
    }
}

//character 관련 유효성 평가 미들웨어
const charVaild = async function (req, res, next) {
    try {
        const { charId } = req.params;
        const { user } = req;

        // 캐릭터 아이디 유효성 평가
        if (charId) {
            // 캐릭터 id 확인
            if (!charId) throw new Error("선택할 <캐릭터 ID>를 URL에 숫자로 입력해주세요.", { cause: 409 })
            
            // 캐릭터 존재여부 확인
            const character = await prisma.characters.findFirst({ where: { charId: +charId } })
            if (!character) throw new Error(`<character_id> ${charId} 에 해당하는 캐릭터가 존재하지 않습니다.`, { cause: 404 })
                
            // 계정에 귀속된 캐릭터가 맞는지 확인(user가 있을 경우)
            if (user) {
                if (character.accountId !== user.accountId) throw new Error("본 계정이 소유한 캐릭터가 아닙니다.", { cause: 401 })
            }
        }

        next()
        //던진 오류들 확인해서 반환
    } catch (err) {
        if (err.cause) return res
            .status(err.cause)
            .json({ errorMessage: err.message })
        console.log(err.message)
        return res
            .status(400)
            .json({ errorMessage: "잘못된 접근입니다." });
    }
}
            .status(err.cause)
            .json({ errorMessage: err.message })
    }
}

export { signVaild, charVaild }