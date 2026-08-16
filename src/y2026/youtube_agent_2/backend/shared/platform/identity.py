"""Request identity context shared by authentication and repositories."""

from contextvars import ContextVar, Token


_current_user_id: ContextVar[str | None] = ContextVar(
    "firebase_user_id", default=None
)
_youtube_access_token: ContextVar[str | None] = ContextVar(
    "youtube_access_token", default=None
)


def set_current_user(user_id: str) -> Token:
    return _current_user_id.set(user_id)


def reset_current_user(token: Token) -> None:
    _current_user_id.reset(token)


def current_user_id() -> str | None:
    return _current_user_id.get()


def require_current_user() -> str:
    user_id = current_user_id()
    if not user_id:
        raise RuntimeError("Authenticated Firebase user context required")
    return user_id


def set_youtube_access_token(access_token: str | None) -> Token:
    return _youtube_access_token.set(access_token)


def reset_youtube_access_token(token: Token) -> None:
    _youtube_access_token.reset(token)


def current_youtube_access_token() -> str | None:
    return _youtube_access_token.get()
