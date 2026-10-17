from django.contrib.auth.models import User
from rest_framework import serializers


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    phone_number = serializers.CharField(required=False, allow_blank=True, default="")

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "password",
            "phone_number",
            "first_name",
            "last_name",
        ]

    def create(self, validated_data):
        phone_number = validated_data.pop("phone_number", "")
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email", ""),
            password=validated_data["password"],
            first_name=validated_data.get("first_name", ""),
            last_name=validated_data.get("last_name", ""),
        )
        if phone_number and hasattr(user, "profile"):
            user.profile.phone_number = phone_number
            user.profile.save()
        return user


class UserSerializer(serializers.ModelSerializer):
    phone_number = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "phone_number",
            "first_name",
            "last_name",
            "is_active",
            "is_staff",
            "date_joined",
        ]
        read_only_fields = ["id", "date_joined"]

    def get_phone_number(self, obj):
        profile = getattr(obj, "profile", None)
        return profile.phone_number if profile else ""


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=6)


class ForgotPasswordRequestSerializer(serializers.Serializer):
    identifier = serializers.CharField(
        help_text="User's email address or registered phone number",
    )


class VerifyResetCodeSerializer(serializers.Serializer):
    code = serializers.CharField()
    token = serializers.CharField(required=False, allow_blank=True, default="")
    identifier = serializers.CharField(required=False, allow_blank=True, default="")


class ResetPasswordConfirmSerializer(serializers.Serializer):
    code = serializers.CharField()
    new_password = serializers.CharField(min_length=6)
    token = serializers.CharField(required=False, allow_blank=True, default="")
    identifier = serializers.CharField(required=False, allow_blank=True, default="")
