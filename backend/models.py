"""Pydantic models for request/response validation."""
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class ScoreIn(BaseModel):
    player_name: str = Field(..., min_length=1, max_length=20)
    score: int = Field(..., ge=0, le=1_000_000)
    game_mode: str = Field("classic")
    snake_length: Optional[int] = Field(None, ge=1, le=10_000)
    duration_seconds: Optional[int] = Field(None, ge=0, le=86_400)

    @field_validator("player_name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("player_name must not be blank")
        # keep it simple/safe: letters, digits, spaces, underscore, dash, dot
        allowed = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 _-.")
        if not all(c in allowed for c in v):
            raise ValueError("player_name contains invalid characters")
        return v

    @field_validator("game_mode")
    @classmethod
    def check_mode(cls, v: str) -> str:
        v = v.strip().lower()
        if v not in {"classic", "relaxed"}:
            raise ValueError("game_mode must be 'classic' or 'relaxed'")
        return v


class ScoreRow(BaseModel):
    id: int
    player_name: str
    score: int
    game_mode: str
    snake_length: int
    created_at: str


class HighestOut(BaseModel):
    score: int
    player_name: str
    game_mode: str
    created_at: str


class LeaderboardOut(BaseModel):
    scores: List[ScoreRow]
    highest: Optional[HighestOut] = None


class GameSummary(BaseModel):
    id: int
    player_name: str
    score: int
    game_mode: str
    snake_length: int
    created_at: str


class HistoryOut(BaseModel):
    games: List[GameSummary]
    total_games: int


class HealthOut(BaseModel):
    status: str
    database: str
