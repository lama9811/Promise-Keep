"""Step 2 smoke test: prove PayPal sandbox can take, refund and pay out money.

Run from backend/:
    .venv/bin/python scripts/paypal_smoke.py <second-sandbox-email>

1. Creates a $20 order and prints the approval link.
2. You open the link, log in as a sandbox PERSONAL account (e.g. Sam), approve,
   then press Enter here.
3. Captures it, refunds it, then sends a $5 payout to the email you passed.
"""
import sys
import time
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import config  # noqa: E402
import paypal  # noqa: E402


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("usage: python scripts/paypal_smoke.py <payout-receiver-sandbox-email>")
    receiver = sys.argv[1]
    if not config.PAYPAL_CLIENT_ID or not config.PAYPAL_SECRET:
        sys.exit("PAYPAL_CLIENT_ID / PAYPAL_SECRET missing from backend/.env")

    run = uuid.uuid4().hex[:8]
    print(f"Base URL: {config.PAYPAL_BASE}")
    paypal.get_token()
    print("Token: ok")

    order = paypal.create_order(2000, f"smoke-{run}")
    print(f"Order ID: {order['id']}")
    print(f"\nApprove here as a sandbox personal account:\n  {order['approve_url']}\n")
    input("Press Enter after approving... ")

    capture = paypal.capture_order(order["id"])
    capture_id = capture["id"]
    print(f"Capture ID: {capture_id} ({capture['status']})")
    if capture["status"] != "COMPLETED":
        sys.exit("Capture is not COMPLETED, so the money is not settled yet. Stopping before refund.")

    refund = paypal.refund_capture(capture_id, f"refund-smoke-{run}")
    print(f"Refund ID: {refund['id']} ({refund['status']})")

    payout = paypal.send_payouts(
        f"smoke-{run}-{int(time.time())}",
        [(receiver, 500, "Promise Keeper smoke test")],
    )
    print(f"Payout batch ID: {payout['id']} ({payout['status']})")
    print("\nAll PayPal calls worked. Check sandbox.paypal.com as the business account.")


if __name__ == "__main__":
    try:
        main()
    except paypal.PayPalError as e:
        hint = ""
        if e.status == 401:
            hint = "\nHint: 401 = wrong Client ID or Secret."
        elif "AUTHORIZATION_ERROR" in e.body or "not enabled" in e.body.lower():
            hint = "\nHint: tick 'Payouts' in the sandbox app's features."
        sys.exit(f"FAILED: {e}{hint}")
