from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    nickname: str = Field(min_length=2, max_length=30)

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


class UserOut(BaseModel):
    id: int
    email: str
    nickname: str
    role: str
    identity_verified: bool
