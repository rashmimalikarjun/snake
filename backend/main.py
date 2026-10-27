"""FastAPI backend for Nokia Snake Xenzia.

Run with:  uvicorn main:app --reload --port 8000
"""
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from database import db_cursor, init_db
from models import (
    GameSummary,
    HealthOut,
    HighestOut,
    HistoryOut,
    LeaderboardOut,
    ScoreIn,
    ScoreRow,
)

app = FastAPI(title="Snake Xenzia API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # dev-friendly; frontend calls via /api proxy or direct URL
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()


def _row_to_score(row) -> ScoreRow:
    return ScoreRow(
        id=row["id"],
        player_name=row["player_name"],
        score=row["score"],
        game_mode=row["game_mode"],
        snake_length=row["snake_length"],
        created_at=row["created_at"],
    )


@app.get("/api/health", response_model=HealthOut)
def health():
    try:
        with db_cursor() as conn:
            conn.execute("SELECT 1")
        return HealthOut(status="ok", database="connected")
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=503, detail=f"database error: {exc}")


@app.post("/api/scores", response_model=ScoreRow, status_code=201)
def save_score(payload: ScoreIn):
    """Save a completed game's score."""
    length = payload.snake_length if payload.snake_length is not None else 3 + payload.score // 9
    with db_cursor() as conn:
        cur = conn.execute(
            "INSERT INTO scores (player_name, score, game_mode, snake_length) VALUES (?, ?, ?, ?)",
            (payload.player_name, payload.score, payload.game_mode, length),
        )
        row = conn.execute("SELECT * FROM scores WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _row_to_score(row)


@app.get("/api/scores", response_model=LeaderboardOut)
def get_scores(
    limit: int = Query(10, ge=1, le=100),
    game_mode: Optional[str] = Query(None),
):
    """Retrieve the leaderboard (highest scores first)."""
    where = ""
    params = []
    if game_mode in ("classic", "relaxed"):
        where = "WHERE game_mode = ?"
        params.append(game_mode)
    params.append(limit)
    with db_cursor() as conn:
        rows = conn.execute(
            f"""SELECT * FROM scores {where}
                ORDER BY score DESC, created_at ASC LIMIT ?""",
            params,
        ).fetchall()
        top = conn.execute(
            "SELECT * FROM scores ORDER BY score DESC, created_at ASC LIMIT 1"
        ).fetchone()
    highest = (
        HighestOut(
            score=top["score"],
            player_name=top["player_name"],
            game_mode=top["game_mode"],
            created_at=top["created_at"],
        )
        if top
        else None
    )
    return LeaderboardOut(scores=[_row_to_score(r) for r in rows], highest=highest)


@app.get("/api/scores/highest", response_model=HighestOut)
def get_highest(game_mode: Optional[str] = Query(None)):
    """Retrieve the single highest recorded score."""
    with db_cursor() as conn:
        if game_mode in ("classic", "relaxed"):
            row = conn.execute(
                "SELECT * FROM scores WHERE game_mode = ? ORDER BY score DESC LIMIT 1",
                (game_mode,),
            ).fetchone()
        else:
            row = conn.execute(
                "SELECT * FROM scores ORDER BY score DESC LIMIT 1"
            ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="no scores recorded yet")
    return HighestOut(
        score=row["score"],
        player_name=row["player_name"],
        game_mode=row["game_mode"],
        created_at=row["created_at"],
    )


@app.get("/api/games/history", response_model=HistoryOut)
def get_history(limit: int = Query(20, ge=1, le=100)):
    """Retrieve recent game sessions (newest first)."""
    with db_cursor() as conn:
        rows = conn.execute(
            "SELECT * FROM scores ORDER BY created_at DESC, id DESC LIMIT ?", (limit,)
        ).fetchall()
        total = conn.execute("SELECT COUNT(*) AS c FROM scores").fetchone()["c"]
    games = [
        GameSummary(
            id=r["id"],
            player_name=r["player_name"],
            score=r["score"],
            game_mode=r["game_mode"],
            snake_length=r["snake_length"],
            created_at=r["created_at"],
        )
        for r in rows
    ]
    return HistoryOut(games=games, total_games=total)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
