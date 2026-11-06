"""Cheap cheat checks that run in code before the AI sees anything (PRD: How the AI checks proof)."""
import io
import math
from datetime import datetime, timezone

import imagehash
from PIL import Image, UnidentifiedImageError

GYM_RADIUS_M = 150
MIN_VISIT_MINUTES = 30
LIVE_WORD_MINUTES = 10
DUPLICATE_MAX_DISTANCE = 6  # phash difference of 6 or less = the same picture

_EARTH_R = 6_371_000


def distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Haversine distance in metres."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * _EARTH_R * math.asin(math.sqrt(a))


def within_radius(gym_lat: float, gym_lng: float, lat: float, lng: float, radius_m: float = GYM_RADIUS_M) -> bool:
    return distance_m(gym_lat, gym_lng, lat, lng) <= radius_m


def _open(data: bytes) -> Image.Image | None:
    try:
        img = Image.open(io.BytesIO(data))
        img.load()
        return img
    except (UnidentifiedImageError, OSError):
        return None


def photo_hash(data: bytes) -> str | None:
    img = _open(data)
    return str(imagehash.phash(img.convert("RGB"))) if img else None


def is_duplicate(new_hash: str, earlier_hashes: list[str]) -> bool:
    new = imagehash.hex_to_hash(new_hash)
    return any(new - imagehash.hex_to_hash(h) <= DUPLICATE_MAX_DISTANCE for h in earlier_hashes if h)


def photo_date_problem(data: bytes, started_at: datetime) -> str | None:
    """Photos from the in-app camera have no date, which is fine. If a photo does
    carry a date and it is from before this check-in started, it is an old photo."""
    img = _open(data)
    if not img:
        return "That file isn't a photo."
    exif = img.getexif()
    raw = exif.get(0x9003) or exif.get(0x0132)  # DateTimeOriginal, DateTime
    if not raw:
        return None
    try:
        taken = datetime.strptime(str(raw), "%Y:%m:%d %H:%M:%S")
    except ValueError:
        return None
    # EXIF has no timezone; allow a day of slack so time zones never cause a false reject.
    started_naive = started_at.astimezone(timezone.utc).replace(tzinfo=None)
    if (started_naive - taken).total_seconds() > 24 * 3600:
        return f"This photo is older than your check-in (taken {taken:%b %d}). Take a new one."
    return None
