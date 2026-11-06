import httpx
import pytest

import paypal


def test_cents_to_str():
    assert paypal.cents_to_str(2000) == "20.00"
    assert paypal.cents_to_str(667) == "6.67"
    assert paypal.cents_to_str(5) == "0.05"
    assert paypal.cents_to_str(0) == "0.00"
    with pytest.raises(ValueError):
        paypal.cents_to_str(20.0)
    with pytest.raises(ValueError):
        paypal.cents_to_str(-1)


@pytest.fixture
def fake_paypal(monkeypatch):
    """Record every POST and answer like PayPal would."""
    calls = []

    def fake_post(url, **kwargs):
        calls.append((url, kwargs))
        req = httpx.Request("POST", url)
        if url.endswith("/v1/oauth2/token"):
            return httpx.Response(200, json={"access_token": "T", "expires_in": 32400}, request=req)
        if url.endswith("/v2/checkout/orders"):
            return httpx.Response(201, json={"id": "ORDER1", "links": [{"rel": "approve", "href": "https://pp/approve"}]}, request=req)
        if url.endswith("/capture"):
            return httpx.Response(201, json={"purchase_units": [{"payments": {"captures": [{"id": "CAP1", "status": "COMPLETED"}]}}]}, request=req)
        if url.endswith("/refund"):
            return httpx.Response(201, json={"id": "REF1", "status": "COMPLETED"}, request=req)
        if url.endswith("/v1/payments/payouts"):
            return httpx.Response(201, json={"batch_header": {"payout_batch_id": "BATCH1", "batch_status": "PENDING"}}, request=req)
        return httpx.Response(404, text="nope", request=req)

    monkeypatch.setattr(paypal.httpx, "post", fake_post)
    monkeypatch.setattr(paypal, "_token", None)
    monkeypatch.setattr(paypal, "_token_expires_at", 0.0)
    return calls


def test_order_capture_refund_payout_flow(fake_paypal):
    order = paypal.create_order(2000, "p1")
    assert order == {"id": "ORDER1", "approve_url": "https://pp/approve"}
    assert paypal.capture_order("ORDER1") == {"id": "CAP1", "status": "COMPLETED"}
    assert paypal.refund_capture("CAP1", "refund-p1") == {"id": "REF1", "status": "COMPLETED"}
    assert paypal.send_payouts("pot-9", [("a@x.com", 667, "hi"), ("b@x.com", 666, "hi")]) == {"id": "BATCH1", "status": "PENDING"}

    urls = [u for u, _ in fake_paypal]
    # Token fetched once and cached.
    assert sum(u.endswith("/oauth2/token") for u in urls) == 1

    _, order_kw = fake_paypal[1]
    unit = order_kw["json"]["purchase_units"][0]
    assert unit["amount"] == {"currency_code": "USD", "value": "20.00"}
    assert unit["custom_id"] == "p1"

    _, refund_kw = next(c for c in fake_paypal if c[0].endswith("/refund"))
    assert refund_kw["headers"]["PayPal-Request-Id"] == "refund-p1"

    _, payout_kw = fake_paypal[-1]
    body = payout_kw["json"]
    assert body["sender_batch_header"]["sender_batch_id"] == "pot-9"
    assert [i["amount"]["value"] for i in body["items"]] == ["6.67", "6.66"]


def test_error_raises_paypal_error(fake_paypal, monkeypatch):
    def deny(url, **kwargs):
        return httpx.Response(401, text="invalid_client", request=httpx.Request("POST", url))

    monkeypatch.setattr(paypal.httpx, "post", deny)
    with pytest.raises(paypal.PayPalError) as e:
        paypal.get_token()
    assert e.value.status == 401
