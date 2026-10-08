"""
Standard pagination for the ERP API.

Honors the `page_size` query parameter so list endpoints can be
requested with larger page sizes (e.g. dropdowns use page_size=100).
"""

from rest_framework.pagination import PageNumberPagination


class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 500