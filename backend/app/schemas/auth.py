from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    nickname: str = Field(min_length=2, max_length=30)
    # 셋 다 필수 동의. 화면의 체크박스와 별개로 서버에서도 확인한다(동의 없이 API 로 바로 가입하는 것 방지).
    agree_terms: bool = False
    agree_privacy: bool = False
    age_over_14: bool = False
    terms_version: str = Field(default="", max_length=20)

    @model_validator(mode="after")
    def _consents(self):
        if not (self.agree_terms and self.agree_privacy):
            raise ValueError("이용약관과 개인정보 수집·이용에 동의해 주세요.")
        if not self.age_over_14:
            raise ValueError("만 14세 이상만 가입할 수 있습니다.")
        return self

    @field_validator("password")
    @classmethod
    def _bcrypt_limit(cls, v: str) -> str:
        # bcrypt 는 72바이트까지만 해시한다. 한글은 글자당 3바이트라 글자 수만으로는 부족하다.
        if len(v.encode()) > 72:
            raise ValueError("비밀번호가 너무 깁니다(72바이트 이하).")
        return v

    @field_validator("nickname")
    @classmethod
    def _strip(cls, v: str) -> str:
        return v.strip()


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=200)


class DeleteAccountIn(BaseModel):
    """탈퇴는 세션 탈취 등으로 실수·악의적으로 눌려도 되돌릴 수 없으니, 로그인 상태와
    별개로 비밀번호를 한 번 더 받아 확인한다(로그아웃과 달리 되돌릴 수 없는 조치라서)."""
    password: str = Field(max_length=200)


class UserOut(BaseModel):
    id: int
    email: str
    nickname: str
    role: str
    identity_verified: bool
    # 경찰관 인증(OfficerVerification 승인) 결과. station_id 가 있어야 그 경찰서 리뷰에 해명 가능.
    officer_station_id: int | None = None
    officer_station_name: str | None = None
    officer_rank: str | None = None
