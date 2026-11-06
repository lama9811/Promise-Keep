"""Pure money math for settling a pot. No I/O, so it is easy to test.

Rules (PRD F6/F7):
- Every winner gets their own stake refunded.
- The losers' total is split evenly between winners, in whole cents; leftover
  cents go to the first winners in order.
- If nobody won, the whole pot goes to the pot's recipient (friend or charity).
- Every cent that came in goes out exactly once.
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Entry:
    key: str  # promise ID (mapped to the user's PayPal email by the caller)
    stake_cents: int
    won: bool


@dataclass
class SettlementPlan:
    refunds: list[tuple[str, int]] = field(default_factory=list)  # (promise key, cents)
    payouts: list[tuple[str, int]] = field(default_factory=list)  # (winner key or recipient, cents)


def split_pot(entries: list[Entry], recipient: str) -> SettlementPlan:
    if not entries:
        raise ValueError("pot has no promises")
    for e in entries:
        if not isinstance(e.stake_cents, int) or isinstance(e.stake_cents, bool) or e.stake_cents <= 0:
            raise ValueError(f"stake must be a positive int of cents, got {e.stake_cents!r}")

    winners = [e for e in entries if e.won]
    lost_total = sum(e.stake_cents for e in entries if not e.won)
    plan = SettlementPlan(refunds=[(w.key, w.stake_cents) for w in winners])

    if lost_total == 0:
        return plan
    if not winners:
        plan.payouts = [(recipient, lost_total)]
        return plan

    share, leftover = divmod(lost_total, len(winners))
    plan.payouts = [
        (w.key, share + (1 if i < leftover else 0))
        for i, w in enumerate(winners)
        if share + (1 if i < leftover else 0) > 0
    ]
    return plan
