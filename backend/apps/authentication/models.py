import secrets
import uuid
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


class UserProfile(models.Model):
    """
    Extended user profile for contact information such as phone number.
    """
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="profile")
    phone_number = models.CharField(
        max_length=40,
        blank=True,
        default="",
        db_index=True,
        help_text="Primary phone or mobile number",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "User Profile"
        verbose_name_plural = "User Profiles"

    def __str__(self):
        return f"{self.user.username} ({self.phone_number or 'No phone'})"


def default_expiry():
    return timezone.now() + timedelta(minutes=15)


def generate_otp():
    """Generate a secure 6-digit numeric OTP."""
    return f"{secrets.randbelow(900000) + 100000:06d}"


class PasswordResetCode(models.Model):
    """
    Stores 6-digit verification codes and session tokens for password reset.
    Works with either email address or phone number.
    """
    CHANNEL_EMAIL = "email"
    CHANNEL_PHONE = "phone"
    CHANNEL_CHOICES = (
        (CHANNEL_EMAIL, "Email"),
        (CHANNEL_PHONE, "Phone"),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="password_reset_codes",
    )
    code = models.CharField(max_length=10, default=generate_otp)
    delivery_channel = models.CharField(
        max_length=10,
        choices=CHANNEL_CHOICES,
        default=CHANNEL_EMAIL,
    )
    delivery_destination = models.CharField(
        max_length=255,
        default="",
        help_text="Masked or recorded email or phone number destination",
    )
    is_used = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(default=default_expiry)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Password Reset Code"
        verbose_name_plural = "Password Reset Codes"

    def is_valid(self):
        return not self.is_used and timezone.now() <= self.expires_at

    def __str__(self):
        return f"Code for {self.user.username} via {self.delivery_channel} ({self.code})"
