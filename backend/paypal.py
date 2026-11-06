"""PayPal REST (sandbox) calls: token, orders, capture, refund, payouts.

All amounts come in as whole cents and are only turned into "20.00" strings
right before they are sent to PayPal.
"""
import time

import httpx

import config

_token: str | None = None
_token_expires_at: float = 0.0


class PayPalError(Exception):
    def __init__(self, status: int, body: str):
        super().__init__(f"PayPal {status}: {body}")
        self.status = status
        self.body = body


def cents_to_str(cents: int) -> str:
    """2000 -> '20.00'. Integers only, never floats."""
    if not isinstance(cents, int) or cents < 0:
        raise ValueError(f"cents must be a non-negative int, got {cents!r}")
    dollars, rem = divmod(cents, 100)
    return f"{dollars}.{rem:02d}"


def _check(resp: httpx.Response) -> dict:
    if resp.status_code >= 400:
        raise PayPalError(resp.status_code, resp.text)
    return resp.json() if resp.content else {}


def get_token() -> str:
    """OAuth token, cached until a minute before it expires (~9 hours)."""
    global _token, _token_expires_at
    if _token and time.time() < _token_expires_at:
        return _token
    resp = httpx.post(
        f"{config.PAYPAL_BASE}/v1/oauth2/token",
        auth=(config.PAYPAL_CLIENT_ID, config.PAYPAL_SECRET),
        data={"grant_type": "client_credentials"},
        timeout=20,
    )
    data = _check(resp)
    _token = data["access_token"]
    _token_expires_at = time.time() + int(data.get("expires_in", 3600)) - 60
    return _token


def _headers(request_id: str | None = None) -> dict:
    h = {"Authorization": f"Bearer {get_token()}", "Content-Type": "application/json"}
    if request_id:
        # PayPal ignores a repeat call with the same request ID.
        h["PayPal-Request-Id"] = request_id
    return h


def create_order(amount_cents: int, promise_id: str) -> dict:
    """Create the stake order. Returns {'id': order_id, 'approve_url': ...}."""
    body = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "custom_id": str(promise_id),
                "description": "Promise Keeper stake",
                "amount": {"currency_code": "USD", "value": cents_to_str(amount_cents)},
            }
        ],
    }
    resp = httpx.post(
        f"{config.PAYPAL_BASE}/v2/checkout/orders",
        headers=_headers(f"order-{promise_id}"),
        json=body,
        timeout=20,
    )
    data = _check(resp)
    approve = next(
        (link["href"] for link in data.get("links", []) if link["rel"] in ("approve", "payer-action")),
        None,
    )
    return {"id": data["id"], "approve_url": approve}


def capture_order(order_id: str) -> dict:
    """Take the money after the buyer approves.

    Returns {'id', 'status', 'payer_email'}. payer_email is the PayPal account
    that really paid, so it is trusted over anything typed in the form.
    Only status COMPLETED means the
    money is ours: callers must not mark a promise active on PENDING (that
    needs a PAYMENT.CAPTURE.COMPLETED webhook first).
    """
    resp = httpx.post(
        f"{config.PAYPAL_BASE}/v2/checkout/orders/{order_id}/capture",
        headers=_headers(f"capture-{order_id}"),
        timeout=20,
    )
    data = _check(resp)
    capture = data["purchase_units"][0]["payments"]["captures"][0]
    if capture["status"] not in ("COMPLETED", "PENDING"):
        raise PayPalError(200, f"capture status {capture['status']}")
    payer_email = (data.get("payer") or {}).get("email_address")
    return {"id": capture["id"], "status": capture["status"], "payer_email": payer_email}


def refund_capture(capture_id: str, request_id: str) -> dict:
    """Full refund of a capture. request_id makes repeats safe (e.g. refund-<promise_id>)."""
    resp = httpx.post(
        f"{config.PAYPAL_BASE}/v2/payments/captures/{capture_id}/refund",
        headers=_headers(request_id),
        json={},
        timeout=20,
    )
    data = _check(resp)
    return {"id": data["id"], "status": data["status"]}


def send_payouts(batch_id: str, items: list[tuple[str, int, str]]) -> dict:
    """One payout batch. items = [(email, amount_cents, note), ...].

    batch_id is the sender_batch_id; PayPal rejects a repeat with the same ID,
    which is what keeps /settle from paying twice.
    """
    body = {
        "sender_batch_header": {
            "sender_batch_id": batch_id,
            "email_subject": "You got money from Promise Keeper",
            "email_message": "A promise was broken, so the stake came to you.",
        },
        "items": [
            {
                "recipient_type": "EMAIL",
                "receiver": email,
                "amount": {"currency": "USD", "value": cents_to_str(cents)},
                "note": note,
                "sender_item_id": f"{batch_id}-{i}",
            }
            for i, (email, cents, note) in enumerate(items)
        ],
    }
    resp = httpx.post(
        f"{config.PAYPAL_BASE}/v1/payments/payouts",
        headers=_headers(),
        json=body,
        timeout=30,
    )
    data = _check(resp)
    header = data["batch_header"]
    return {"id": header["payout_batch_id"], "status": header["batch_status"]}
