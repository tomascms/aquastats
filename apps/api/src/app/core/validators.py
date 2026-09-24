"""Extreme input validation with Pydantic v2."""
from pydantic import BaseModel, Field, field_validator, EmailStr
import re
from typing import Optional
import bleach


class SwimTimeValidator(BaseModel):
    """Validação extrema de tempos de natação."""
    mm: int = Field(..., ge=0, le=59, description="Minutos (0-59)")
    ss: int = Field(..., ge=0, le=59, description="Segundos (0-59)")
    cc: int = Field(..., ge=0, le=99, description="Centésimos (0-99)")

    @field_validator('mm', 'ss')
    def validate_not_large(cls, v):
        if v > 59:
            raise ValueError('Valor inválido para tempo')
        return v

    @field_validator('cc')
    def validate_hundredths(cls, v):
        if v > 99:
            raise ValueError('Centésimos devem estar entre 0-99')
        return v


class PhoneValidator(BaseModel):
    """Validação de número de telefone."""
    phone: str = Field(..., min_length=9, max_length=15)

    @field_validator('phone')
    def validate_phone(cls, v):
        # Remove espaços e caracteres comuns
        cleaned = re.sub(r'[\s\-\(\)\+]', '', v)
        if not re.match(r'^\d{9,15}$', cleaned):
            raise ValueError('Número de telefone inválido')
        return cleaned


class SanitizedStr(BaseModel):
    """String com sanitização HTML extrema."""
    content: str = Field(..., max_length=5000)

    @field_validator('content')
    def sanitize_html(cls, v):
        # Allow only basic tags
        allowed_tags = ['b', 'i', 'u', 'br', 'p']
        allowed_attrs = {}

        # Bleach sanitization
        sanitized = bleach.clean(
            v,
            tags=allowed_tags,
            attributes=allowed_attrs,
            strip=True
        )

        # Block common XSS patterns
        xss_patterns = [
            r'<script',
            r'javascript:',
            r'on\w+\s*=',  # onload=, onclick=, etc
            r'<iframe',
            r'<object',
            r'<embed',
        ]

        for pattern in xss_patterns:
            if re.search(pattern, sanitized, re.IGNORECASE):
                raise ValueError('Conteúdo contém padrões suspeitos')

        return sanitized


class EmailDomainValidator(BaseModel):
    """Validação de email com verificação de domínio."""
    email: EmailStr

    @field_validator('email')
    def validate_domain(cls, v):
        # Bloquear domínios descartáveis comuns
        disposable_domains = [
            'tempmail.com', '10minutemail.com', 'guerrillamail.com',
            'throwaway.email', 'temp-mail.org'
        ]

        domain = v.split('@')[1].lower()
        if domain in disposable_domains:
            raise ValueError('Email descartável não permitido')

        return v


class NameValidator(BaseModel):
    """Validação de nomes."""
    name: str = Field(..., min_length=2, max_length=100)

    @field_validator('name')
    def validate_name(cls, v):
        # Remove extra spaces
        cleaned = ' '.join(v.split())

        # Only allow letters, spaces, and basic punctuation
        if not re.match(r'^[a-zA-ZáéíóúãõçÁÉÍÓÚÃÕÇ\s\-\'\.]+$', cleaned):
            raise ValueError('Nome contém caracteres inválidos')

        return cleaned


class DistanceValidator(BaseModel):
    """Validação de distância em metros."""
    distance_m: int = Field(..., ge=25, le=10000)

    @field_validator('distance_m')
    def validate_distance(cls, v):
        # Apenas distâncias padronizadas
        allowed = [25, 50, 100, 200, 400, 800, 1500, 3000, 5000, 10000]
        if v not in allowed:
            raise ValueError(f'Distância {v}m não é padrão. Distâncias: {allowed}')
        return v


class StrokeValidator(BaseModel):
    """Validação de estilos de natação."""
    stroke: str

    @field_validator('stroke')
    def validate_stroke(cls, v):
        allowed = ['free', 'back', 'breast', 'fly', 'im']
        if v.lower() not in allowed:
            raise ValueError(f'Estilo inválido. Permitidos: {allowed}')
        return v.lower()


class DateOfBirthValidator(BaseModel):
    """Validação de data de nascimento."""
    date_of_birth: str  # ISO format: 2010-05-15
    min_age: int = 8  # Minimum age for swimming
    max_age: int = 120

    @field_validator('date_of_birth')
    def validate_dob(cls, v):
        from datetime import datetime, date

        try:
            dob = datetime.fromisoformat(v).date()
        except ValueError:
            raise ValueError('Data inválida. Use formato ISO: YYYY-MM-DD')

        today = date.today()
        age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

        if age < 8:
            raise ValueError('Atleta deve ter pelo menos 8 anos')
        if age > 120:
            raise ValueError('Data de nascimento inválida')

        return v


class UUIDValidator(BaseModel):
    """Validação de UUIDs."""
    id: str

    @field_validator('id')
    def validate_uuid(cls, v):
        import uuid
        try:
            uuid.UUID(v)
            return v
        except ValueError:
            raise ValueError(f'UUID inválido: {v}')
