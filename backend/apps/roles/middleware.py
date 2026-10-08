"""
Middleware for Frappe-style logging:
  - APIRequestLogMiddleware: logs every API request
  - ActivityLogMiddleware: logs login/logout operations
"""

import json
import time

from django.utils.deprecation import MiddlewareMixin


class APIRequestLogMiddleware(MiddlewareMixin):
    """
    Logs every API request to the APIRequestLog model.
    Mirrors Frappe's API Request Log doctype.
    """

    def process_request(self, request):
        request._start_time = time.time()
        request._request_body = ""
        try:
            if request.method in ("POST", "PUT", "PATCH"):
                body = request.body
                if body:
                    request._request_body = body.decode("utf-8", errors="replace")[:10000]
        except Exception:
            pass

    def process_response(self, request, response):
        if not hasattr(request, "_start_time"):
            return response

        # Only log API requests
        path = request.path
        if not path.startswith("/api/"):
            return response

        duration_ms = int((time.time() - getattr(request, "_start_time", time.time())) * 1000)

        try:
            from apps.roles.models import APIRequestLog

            user = None
            if hasattr(request, "user") and request.user.is_authenticated:
                user = request.user

            response_body = ""
            try:
                if hasattr(response, "content"):
                    response_body = response.content.decode("utf-8", errors="replace")[:10000]
            except Exception:
                pass

            # Get client IP
            x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
            if x_forwarded_for:
                ip_address = x_forwarded_for.split(",")[0].strip()
            else:
                ip_address = request.META.get("REMOTE_ADDR")

            APIRequestLog.objects.create(
                path=path[:1024],
                method=request.method,
                user=user,
                status_code=response.status_code,
                request_body=getattr(request, "_request_body", ""),
                response_body=response_body,
                ip_address=ip_address,
                user_agent=request.META.get("HTTP_USER_AGENT", "")[:512],
                duration_ms=duration_ms,
            )
        except Exception:
            # Never break the request cycle due to logging failures
            pass

        return response
