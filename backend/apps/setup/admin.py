from django.contrib import admin

from .models import Company, Currency, FiscalYear, UnitOfMeasure

admin.site.register(Company)
admin.site.register(FiscalYear)
admin.site.register(Currency)
admin.site.register(UnitOfMeasure)
