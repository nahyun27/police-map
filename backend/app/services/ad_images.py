"""광고 배너 이미지 저장. 관리자만 올릴 수 있지만, 그래도 받은 파일을 그대로 두지 않고
Pillow 로 열어 이미지인지 확인한 뒤 크기를 제한하고 WebP 로 다시 인코딩한다(메타데이터 제거,
용량 정규화, 이미지로 위장한 다른 파일 차단)."""
import secrets
from io import BytesIO
from pathlib import Path

from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from app.core.config import settings

MAX_BYTES = 5 * 1024 * 1024
MAX_SIZE = {"wide": (1600, 600), "side": (400, 1200)}  # (최대 가로, 최대 세로)


def ads_dir() -> Path:
    d = Path(settings.UPLOAD_DIR) / "ads"
    d.mkdir(parents=True, exist_ok=True)
    return d


def save_ad_image(upload: UploadFile, kind: str) -> str:
    data = upload.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "이미지는 5MB 이하만 올릴 수 있습니다.")
    try:
        im = Image.open(BytesIO(data))
        im.load()
    except Image.DecompressionBombError:
        raise HTTPException(422, "이미지 해상도가 너무 큽니다. 2000px 안팎으로 줄여서 올려 주세요.")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(422, "이미지 파일(PNG·JPG·WebP)만 올릴 수 있습니다.")
    if im.format not in ("PNG", "JPEG", "WEBP", "GIF"):
        raise HTTPException(422, "이미지 파일(PNG·JPG·WebP)만 올릴 수 있습니다.")
    im = im.convert("RGBA") if im.mode in ("RGBA", "LA", "P") else im.convert("RGB")
    im.thumbnail(MAX_SIZE[kind], Image.LANCZOS)
    name = f"{kind}-{secrets.token_hex(10)}.webp"
    im.save(ads_dir() / name, "WEBP", quality=85, method=6)
    return name


def delete_ad_image(name: str | None) -> None:
    if name and "/" not in name and ".." not in name:
        (ads_dir() / name).unlink(missing_ok=True)
