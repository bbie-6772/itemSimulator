import { prisma } from '../prisma/index.js'

//account router 유효성 평가 미들웨어
const signVaild = async function (req, res, next) {
    try {
        const { id, password, passwordCheck } = req.body;
        const path = req.path;

        //유효성 평가 정규식사용으로 id 입력값이 소문자+숫자만 가능하게
        if (!/^[a-z0-9]*$/.test(id)) throw errorWithStatus("아이디는 소문자와 숫자로만 입력해주세요",{ cause: 400 })

        // 비밀번호가 6글자 이상인지 확인
        if (!/\b.{6,}/.test(password)) throw new Error("비밀번호는 6글자 이상으로 작성해주세요", { cause: 400 })

        // 회원가입
        if (path === "/sign-up") {
            // 아이디 중복 확인
            const isExitUser = await prisma.accounts.findFirst({ where: { userId: id } })
            if (isExitUser) throw new Error("이미 존재하는 아이디입니다", { cause: 409 })

            // 비밀번호 확인이 없을 시
            if (!passwordCheck) throw new Error("비밀번호 확인용 <passwordCheck>를 입력해주세요", { cause: 400 })

            //비밀번호 확인과 일치하는지
            if (!(password === passwordCheck)) throw new Error("비밀번호가 일치하지 않습니다", { cause: 401 })
        // 로그인
        } else if (path === "/sign-in") {
            // 아이디가 없을 시
            const account = await prisma.accounts.findFirst({ where: { userId: id } })
            if (!account) throw new Error("존재하지 않는 아이디입니다.", { cause: 404 })
        }

        next()
        //던진 오류들 확인해서 반환
    } catch (err) {
        return res
            .status(err.cause)
            .json({ errorMessage: err.message })
    }
}

//character router 유효성 평가 미들웨어
const charVaild = async function (req, res, next) {
    try {
        const { name } = req.body;
        const { charId } = req.params;
        const { path, user, method} = req;

        // 캐릭터 생성 
        if (path === "/characters") {
            // 이름 존재 유무
            if (!name) throw new Error("캐릭터 이름 <name>을 입력해주세요", { cause: 400 })
            // 이름 중복 여부 
            const isExitChar = await prisma.characters.findFirst({ where: { name } })
            if (isExitChar) throw new Error("이미 존재하는 이름입니다", { cause: 409 })
        // 캐릭터 삭제/조회
        } else if (path === `/characters/${charId}`) {
            // 캐릭터 id 확인
            if (!charId) throw new Error("선택할 <캐릭터 ID>를 URL에 숫자로 입력해주세요.", { cause: 409 })
            
            // 캐릭터 존재여부 확인
            const character = await prisma.characters.findFirst({ where: { charId: +charId } })
            if (!character) throw new Error(`<character_id> ${charId} 에 해당하는 캐릭터가 존재하지 않습니다.`, { cause: 404 })
                
            // 계정에 귀속된 캐릭터가 맞는지 확인(삭제의 경우만)
            if (method === "DELETE" && character.accountId !== user.accountId) throw new Error("본 계정이 소유한 캐릭터가 아닙니다.", { cause: 401 })
        }
        next()
        //던진 오류들 확인해서 반환
    } catch (err) {
        return res
            .status(err.cause)
            .json({ errorMessage: err.message })
    }
}

export { signVaild, charVaild }