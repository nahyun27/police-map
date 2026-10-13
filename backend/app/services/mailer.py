"""운영자 알림 메일. SMTP 설정(SMTP_HOST, INQUIRY_NOTIFY_TO)이 없으면 아무것도 하지 않는다 —
문의는 어차피 DB 에 저장되고 관리자 콘솔에서 볼 수 있으므로, 메일은 "빨리 알아채기 위한" 보조 수단이다.
요청 응답을 붙잡지 않도록 BackgroundTasks 로 호출한다."""
import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger(__name__)


def mail_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.INQUIRY_NOTIFY_TO)


def send_notification(subject: str, body: str) -> bool:
    if not mail_configured():
        return False
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_FROM or settings.SMTP_USER
    msg["To"] = settings.INQUIRY_NOTIFY_TO
    msg.set_content(body)
    try:
        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as s:
            s.starttls()
            if settings.SMTP_USER:
                s.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            s.send_message(msg)
        return True
    except Exception:  # 메일 실패가 문의 접수를 막으면 안 된다 — 로그만 남긴다.
        logger.exception("문의 알림 메일 발송 실패")
        return False
