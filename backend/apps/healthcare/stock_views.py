from rest_framework import serializers, viewsets, permissions, filters, status
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend
from .models import PharmacyStock, PharmacyWarehouse


class StockItemSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True, default="")
    standard_rate = serializers.DecimalField(source="valuation_rate", max_digits=12, decimal_places=2, read_only=True)
    is_stock_item = serializers.BooleanField(default=True, read_only=True)
    item_group_name = serializers.CharField(source="item_group", read_only=True)

    class Meta:
        model = PharmacyStock
        fields = [
            "id",
            "item_code",
            "item_name",
            "item_group",
            "item_group_name",
            "stock_uom",
            "actual_qty",
            "valuation_rate",
            "standard_rate",
            "reorder_level",
            "batch_no",
            "expiry_date",
            "warehouse",
            "warehouse_name",
            "medication",
            "is_stock_item",
        ]

    def create(self, validated_data):
        if not validated_data.get("warehouse"):
            wh = PharmacyWarehouse.objects.filter(is_active=True).first() or PharmacyWarehouse.objects.first()
            if wh:
                validated_data["warehouse"] = wh
            else:
                wh = PharmacyWarehouse.objects.create(
                    warehouse_name="Main Pharmacy",
                    is_active=True,
                )
                validated_data["warehouse"] = wh
        if not validated_data.get("item_code") and validated_data.get("item_name"):
            validated_data["item_code"] = validated_data["item_name"]
        return super().create(validated_data)


class StockItemViewSet(viewsets.ModelViewSet):
    """
    Provides stock items endpoint at /api/stock/items/.
    Serves inventory items / drug codes from PharmacyStock with full search, filtering, and pagination.
    """
    queryset = PharmacyStock.objects.select_related("warehouse", "medication").all().order_by("item_name")
    serializer_class = StockItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["item_code", "item_name", "item_group", "batch_no"]
    filterset_fields = ["warehouse", "item_group", "stock_uom"]
    ordering_fields = ["item_name", "item_code", "actual_qty", "valuation_rate"]


class StockItemGroupViewSet(viewsets.ViewSet):
    """
    Provides item groups endpoint at /api/stock/item-groups/.
    """
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        groups = list(
            PharmacyStock.objects.exclude(item_group="")
            .values_list("item_group", flat=True)
            .distinct()
        )
        standard = ["Pharmaceuticals", "Medical Supplies", "Biochemistry", "Consumables", "Equipments"]
        all_groups = []
        seen = set()
        for g in list(groups) + standard:
            if g and g not in seen:
                seen.add(g)
                all_groups.append({
                    "id": len(all_groups) + 1,
                    "item_group_name": g,
                    "name": g,
                    "is_group": False,
                })
        return Response({
            "count": len(all_groups),
            "results": all_groups,
        })

    def create(self, request):
        name = request.data.get("item_group_name") or request.data.get("name") or "New Group"
        return Response({
            "id": 999,
            "item_group_name": name,
            "name": name,
            "is_group": False,
        }, status=status.HTTP_201_CREATED)
