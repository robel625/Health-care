from django.urls import include, path
from rest_framework.routers import DefaultRouter

from . import views

router = DefaultRouter()
router.register(r"companies", views.CompanyViewSet)
router.register(r"fiscal-years", views.FiscalYearViewSet)
router.register(r"currencies", views.CurrencyViewSet)
router.register(r"uom", views.UnitOfMeasureViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
