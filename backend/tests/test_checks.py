import io
from datetime import datetime, timedelta, timezone

from PIL import Image

import checks
import words


def jpeg(color=(200, 30, 30), size=(320, 240), pattern=0, exif_date=None):
    img = Image.new("RGB", size, color)
    # Draw a few blocks so perceptual hashes differ between patterns.
    for i in range(6):
        x = (i * 47 + pattern * 31) % (size[0] - 40)
        y = (i * 29 + pattern * 53) % (size[1] - 40)
        img.paste((255 - color[0], 255 - color[1], 255 - color[2]), (x, y, x + 40, y + 40))
    buf = io.BytesIO()
    if exif_date:
        exif = Image.Exif()
        exif[0x0132] = exif_date.strftime("%Y:%m:%d %H:%M:%S")  # DateTime
        img.save(buf, "JPEG", exif=exif)
    else:
        img.save(buf, "JPEG")
    return buf.getvalue()


def test_haversine_known_distances():
    # Same point
    assert checks.distance_m(39.3434, -76.5839, 39.3434, -76.5839) == 0
    # About 111 m per 0.001 degrees of latitude
    d = checks.distance_m(39.3434, -76.5839, 39.3444, -76.5839)
    assert 105 < d < 117
    # About 2 km away is far outside 150 m
    assert checks.distance_m(39.3434, -76.5839, 39.3614, -76.5839) > 1900


def test_within_radius():
    assert checks.within_radius(39.3434, -76.5839, 39.3440, -76.5839)  # ~67 m
    assert not checks.within_radius(39.3434, -76.5839, 39.3614, -76.5839)  # ~2 km


def test_same_photo_is_a_duplicate_even_resaved():
    a = jpeg(pattern=1)
    resaved = io.BytesIO()
    Image.open(io.BytesIO(a)).resize((300, 225)).save(resaved, "JPEG", quality=70)
    h1 = checks.photo_hash(a)
    h2 = checks.photo_hash(resaved.getvalue())
    assert checks.is_duplicate(h2, [h1])


def test_different_photo_is_not_a_duplicate():
    h1 = checks.photo_hash(jpeg(color=(200, 30, 30), pattern=1))
    h2 = checks.photo_hash(jpeg(color=(20, 120, 220), pattern=4))
    assert not checks.is_duplicate(h2, [h1])
    assert not checks.is_duplicate(h2, [])


def test_old_photo_date_is_rejected():
    started = datetime.now(timezone.utc)
    old = jpeg(exif_date=datetime(2026, 10, 1, 12, 0, 0))
    problem = checks.photo_date_problem(old, started)
    assert problem and "older" in problem
    # In-app camera photos carry no date at all, which is fine.
    assert checks.photo_date_problem(jpeg(), started) is None


def test_not_an_image():
    assert checks.photo_hash(b"not a picture") is None


def test_live_words():
    assert len(words.WORDS) >= 200
    assert len(set(words.WORDS)) == len(words.WORDS)
    assert all(w.isalpha() and w.isupper() and 3 <= len(w) <= 8 for w in words.WORDS)
    assert words.pick() in words.WORDS
    # Never repeats the previous word.
    assert all(words.pick(avoid="BANANA") != "BANANA" for _ in range(50))
