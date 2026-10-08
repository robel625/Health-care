"""
Healthcare Real-Time Notification & SSE Module
=============================================
Provides Redis Pub/Sub broadcast and Server-Sent Events (SSE) streaming,
mirroring Frappe's realtime socketio system in Django + React.
"""

import json
import logging
import time
import redis
from django.conf import settings
from django.http import StreamingHttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.http import require_GET
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth import get_user_model

User = get_user_model()
logger = logging.getLogger(__name__)

CHANNEL_GLOBAL = "healthcare_events"


def get_redis_client():
    """Return a redis client connected to configured REDIS_URL."""
    redis_url = getattr(settings, "REDIS_URL", "redis://127.0.0.1:6379/0")
    return redis.from_url(redis_url, decode_responses=True)


def publish_realtime_event(event_type: str, data: dict, user_id=None):
    """
    Publish an event to Redis pub/sub.
    - event_type: e.g. 'lab_order_created', 'lab_result_approved', 'order_status_updated'
    - data: event payload dict
    - user_id: optional target user ID for directed notification
    """
    try:
        client = get_redis_client()
        payload = {
            "event": event_type,
            "data": data,
            "user_id": user_id,
            "timestamp": timezone.now().isoformat(),
        }
        msg = json.dumps(payload)

        # Publish to global healthcare channel
        client.publish(CHANNEL_GLOBAL, msg)

        # Publish to user-specific channel if specified
        if user_id:
            client.publish(f"user_{user_id}", msg)

        logger.info(f"Published realtime event '{event_type}' to Redis (user_id={user_id})")
        return True
    except Exception as e:
        logger.warning(f"Failed to publish realtime event to Redis: {e}")
        return False


def _authenticate_sse_request(request):
    """Authenticate user via query parameter token or Authorization header."""
    token_str = request.GET.get("token")
    if not token_str and "HTTP_AUTHORIZATION" in request.META:
        auth_header = request.META["HTTP_AUTHORIZATION"]
        if auth_header.startswith("Bearer "):
            token_str = auth_header.split(" ")[1]

    if not token_str:
        return None

    try:
        access_token = AccessToken(token_str)
        user_id = access_token.get("user_id")
        if user_id:
            return User.objects.filter(id=user_id, is_active=True).first()
    except Exception as e:
        logger.debug(f"SSE token auth failed: {e}")
    return None


@require_GET
def realtime_event_stream(request):
    """
    Server-Sent Events (SSE) streaming endpoint.
    Frontend connects using native `new EventSource('/api/healthcare/realtime/stream/?token=...')`.
    Streams live notifications pushed to Redis.
    Uses standard Django view to avoid DRF content negotiation (406 Not Acceptable) errors with EventSource.
    """
    user = _authenticate_sse_request(request)
    user_id = user.id if user else None

    def event_generator():
        client = None
        pubsub = None
        redis_available = False

        try:
            client = get_redis_client()
            client.ping()
            pubsub = client.pubsub()
            pubsub.subscribe(CHANNEL_GLOBAL)
            if user_id:
                pubsub.subscribe(f"user_{user_id}")
            redis_available = True
        except Exception as e:
            logger.info(f"Redis unavailable for SSE ({e}), starting in standby heartbeat mode.")

        # Send initial connection acknowledgment
        connect_data = {
            "status": "connected" if redis_available else "standby",
            "user_id": user_id,
            "server_time": timezone.now().isoformat(),
        }
        yield f"event: connect\ndata: {json.dumps(connect_data)}\n\n"

        last_ping = time.time()

        try:
            while True:
                if redis_available and pubsub:
                    try:
                        message = pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                        if message and message.get("type") == "message":
                            raw_data = message.get("data")
                            if raw_data:
                                try:
                                    payload = json.loads(raw_data)
                                    event_name = payload.get("event", "message")
                                    yield f"event: {event_name}\ndata: {json.dumps(payload)}\n\n"
                                except Exception:
                                    yield f"data: {raw_data}\n\n"
                    except Exception as e:
                        logger.warning(f"Error reading from pubsub: {e}")
                        redis_available = False
                else:
                    time.sleep(1.0)

                # Send heartbeat every 20 seconds to prevent connection timeout
                now = time.time()
                if now - last_ping >= 20:
                    yield ": heartbeat\n\n"
                    last_ping = now

        except GeneratorExit:
            logger.debug(f"SSE client disconnected (user_id={user_id})")
        except Exception as e:
            logger.error(f"Error in SSE event stream: {e}")
            yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"
        finally:
            if pubsub:
                try:
                    pubsub.close()
                except Exception:
                    pass

    response = StreamingHttpResponse(event_generator(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache, no-transform"
    response["X-Accel-Buffering"] = "no"
    response["Access-Control-Allow-Origin"] = "*"
    return response


@api_view(["POST"])
def broadcast_test_notification(request):
    """Helper endpoint to manually trigger a test notification."""
    title = request.data.get("title", "Test Notification")
    message = request.data.get("message", "This is a real-time notification from Celery/Redis.")
    event_type = request.data.get("event", "test_alert")

    publish_realtime_event(
        event_type=event_type,
        data={"title": title, "message": message},
        user_id=request.user.id if request.user.is_authenticated else None,
    )
    return JsonResponse({"status": "broadcasted", "title": title, "message": message})
