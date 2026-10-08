from rest_framework.routers import DefaultRouter
from . import stock_views

router = DefaultRouter()
router.register(r"items", stock_views.StockItemViewSet, basename="stock-items")
router.register(r"item-groups", stock_views.StockItemGroupViewSet, basename="stock-item-groups")

urlpatterns = router.urls
