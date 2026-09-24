"""`ApiException` and FastAPI handlers that answer every error with the `ApiError` shape."""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from nova_contracts import ApiError, ApiErrorBody, ApiErrorCode
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("nova.errors")


class ApiException(Exception):
    def __init__(self, status: int, code: ApiErrorCode, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.code: ApiErrorCode = code
        self.message = message


def error_response(status: int, code: ApiErrorCode, message: str) -> JSONResponse:
    body = ApiError(error=ApiErrorBody(code=code, message=message))
    return JSONResponse(status_code=status, content=body.model_dump(mode="json"))


async def _api_exception(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, ApiException)
    return error_response(exc.status, exc.code, exc.message)


async def _validation(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    first = exc.errors()[0] if exc.errors() else {}
    where = ".".join(str(part) for part in first.get("loc", ()))
    message = f"{where}: {first.get('msg', 'invalid')}" if where else "Invalid request"
    return error_response(400, "invalid_request", message)


async def _http(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, StarletteHTTPException)
    if exc.status_code == 404:
        return error_response(404, "not_found", "Not found")
    if exc.status_code >= 500:
        return error_response(exc.status_code, "internal", "Internal error")
    detail = exc.detail if isinstance(exc.detail, str) and exc.detail else "Invalid request"
    return error_response(exc.status_code, "invalid_request", detail)


async def _unexpected(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return error_response(500, "internal", "Internal error")


def install_error_handlers(app: FastAPI) -> None:
    app.add_exception_handler(ApiException, _api_exception)
    app.add_exception_handler(RequestValidationError, _validation)
    app.add_exception_handler(StarletteHTTPException, _http)
    app.add_exception_handler(Exception, _unexpected)
