from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    path("api/auth/", include("apps.authentication.urls")),
    path("api/roles/", include("apps.roles.urls")),
    path("api/setup/", include("apps.setup.urls")),
    path("api/healthcare/", include("apps.healthcare.urls")),
    path("api/stock/", include("apps.healthcare.stock_urls")),
    path("api/", include("apps.core.urls")),
]

if settings.MEDIA_ROOT:
    urlpatterns += static("/media/", document_root=settings.MEDIA_ROOT)

