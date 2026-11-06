import uuid

import pytest
from fastapi.testclient import TestClient

import db
import main
import paypal


class FakeDB:
    """In-memory stand-in for the Supabase helpers in db.py."""

    def __init__(self):
        self.tables = {t: {} for t in db.TABLES}

    def insert(self, table, row):
        row = {"id": str(uuid.uuid4()), **row}
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

    def update(self, table, id, fields):
        self.tables[table][id].update(fields)
        return dict(self.tables[table][id])


class FakePayPal:
    def __init__(self):
        self.capture_status = "COMPLETED"
        self.payer_email = None
        self.orders = []

    def create_order(self, cents, promise_id):
        self.orders.append((cents, promise_id))
        return {"id": f"ORDER-{len(self.orders)}", "approve_url": "https://pp"}

    def capture_order(self, order_id):
        return {"id": f"CAP-{order_id}", "status": self.capture_status, "payer_email": self.payer_email}


@pytest.fixture
def fake_db(monkeypatch):
    fake = FakeDB()
    for name in ("insert", "get", "where", "update", "update_if_null", "claim_count"):
        monkeypatch.setattr(db, name, getattr(fake, name))
    return fake


@pytest.fixture
def fake_paypal(monkeypatch):
    fake = FakePayPal()
    monkeypatch.setattr(paypal, "create_order", fake.create_order)
    monkeypatch.setattr(paypal, "capture_order", fake.capture_order)
    return fake


@pytest.fixture
def client(fake_db, fake_paypal):
    return TestClient(main.app)
