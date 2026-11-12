import uuid

import pytest
from fastapi.testclient import TestClient

import auth
import db
import main
import paypal


class FakeDB:
    """In-memory stand-in for the Supabase helpers in db.py."""

    def __init__(self):
        self.tables = {t: {} for t in db.TABLES}

    def insert(self, table, row):
        row = {"id": str(uuid.uuid4()), **row}
        row.setdefault("created_at", f"2026-11-07T00:00:{len(self.tables[table]):02d}+00:00")
        if table == "promises":
            row.setdefault("paypal_order_id", None)
            row.setdefault("paypal_capture_id", None)
            row.setdefault("outcome", None)
        self.tables[table][row["id"]] = row
        return dict(row)

    def get(self, table, id):
        row = self.tables[table].get(id)
        return dict(row) if row else None

    def where(self, table, order_by=None, **filters):
        rows = [dict(r) for r in self.tables[table].values() if all(r.get(k) == v for k, v in filters.items())]
        return sorted(rows, key=lambda r: r.get(order_by) or "") if order_by else rows

    def update_if_null(self, table, id, fields, null_column):
        row = self.tables[table].get(id)
        if not row or row.get(null_column) is not None:
            return None
        row.update(fields)
        return dict(row)

    def claim_count(self, promise_id, now_iso, cutoff_iso):
        row = self.tables["promises"][promise_id]
        last = row.get("last_counted_at")
        if last is not None and last >= cutoff_iso:
            return False
        row["last_counted_at"] = now_iso
        return True

    def due_pots(self, now_iso):
        rows = [dict(r) for r in self.tables["pots"].values() if r["deadline"] <= now_iso and not r.get("settled_at")]
        return sorted(rows, key=lambda r: r["deadline"])

    def recent_events(self, pot_ids, limit=30):
        rows = [dict(r) for r in self.tables["agent_events"].values() if r["pot_id"] in pot_ids]
        return list(reversed(rows))[:limit]

    def delete(self, table, id):
        self.tables[table].pop(id, None)

    def update(self, table, id, fields):
        self.tables[table][id].update(fields)
        return dict(self.tables[table][id])


class FakePayPal:
    def __init__(self):
        self.capture_status = "COMPLETED"
        self.payer_email = None
        self.orders = []
        self.refunds = []
        self.batches = []

    def create_order(self, cents, promise_id):
        self.orders.append((cents, promise_id))
        return {"id": f"ORDER-{len(self.orders)}", "approve_url": "https://pp"}

    def capture_order(self, order_id):
        return {"id": f"CAP-{order_id}", "status": self.capture_status, "payer_email": self.payer_email}

    # Settling
    def refund_capture(self, capture_id, request_id):
        self.refunds.append((capture_id, request_id))
        return {"id": f"REF-{capture_id}", "status": "COMPLETED"}

    def send_payouts(self, batch_id, items):
        if batch_id in {b for b, _ in self.batches}:
            raise paypal.DuplicateBatch(400, "DUPLICATE_REQUEST_ID")
        self.batches.append((batch_id, items))
        return {"id": f"BATCH-{len(self.batches)}", "status": "PENDING"}

    def verify_capture(self, order_id, expected_cents):
        return {"ok": True, "status": "COMPLETED", "amount": paypal.cents_to_str(expected_cents)}


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeDB()
    for name in ("insert", "get", "where", "update", "update_if_null", "claim_count", "due_pots", "recent_events", "delete"):
        monkeypatch.setattr(db, name, getattr(fake, name))
    return fake


@pytest.fixture
def fake_paypal(monkeypatch):
    fake = FakePayPal()
    monkeypatch.setattr(paypal, "create_order", fake.create_order)
    monkeypatch.setattr(paypal, "capture_order", fake.capture_order)
    monkeypatch.setattr(paypal, "refund_capture", fake.refund_capture)
    monkeypatch.setattr(paypal, "send_payouts", fake.send_payouts)
    monkeypatch.setattr(paypal, "verify_capture", fake.verify_capture)
    return fake


# Fake sign-in: the token "tok-<name>" belongs to <name>@example.com.
ACCOUNTS = {
    f"tok-{n}": {"id": str(uuid.uuid5(uuid.NAMESPACE_DNS, n)), "email": f"{n}@example.com", "name": n.title()}
    for n in ("sam", "alex", "mallory")
}


def as_user(name: str) -> dict:
    return {"Authorization": f"Bearer tok-{name}"}


@pytest.fixture
def fake_auth(monkeypatch):
    monkeypatch.setattr(auth, "verify_token", lambda token: ACCOUNTS.get(token))
    auth._cache.clear()


@pytest.fixture
def client(fake_db, fake_paypal, fake_auth):
    """Signed in as Sam unless a test passes other headers."""
    return TestClient(main.app, headers=as_user("sam"))


@pytest.fixture
def anon(fake_db, fake_paypal, fake_auth):
    return TestClient(main.app)


@pytest.fixture(autouse=True)
def no_real_claude(monkeypatch):
    """Tests never call the real Claude API; tests that want Claude fake it."""
    import config
    monkeypatch.setattr(config, "ANTHROPIC_API_KEY", "")
