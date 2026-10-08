from django.contrib.contenttypes.fields import GenericForeignKey
from django.db import models


class BaseModel(models.Model):
    """Base model with common fields for all ERP models."""

    creation = models.DateTimeField(auto_now_add=True, db_index=True)
    modified = models.DateTimeField(auto_now=True, db_index=True)
    modified_by = models.CharField(max_length=140, blank=True, default="")
    owner = models.CharField(max_length=140, blank=True, default="")

    class Meta:
        abstract = True
        ordering = ["-creation"]


class DocType(BaseModel):
    """Represents a document type / module entity."""

    name = models.CharField(max_length=140, unique=True)
    module = models.CharField(max_length=140, blank=True, default="")

    class Meta:
        abstract = True
