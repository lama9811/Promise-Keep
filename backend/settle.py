"""Settling a pot after its deadline: the guarded "tools" the promise agent uses.

The agent (agent.py) decides the order of steps and writes the explanations,
but every rule about money lives here, in code:
- who kept their promise is counted from proofs (done >= target), never guessed;
- amounts always come from settle_math.split_pot, never from the AI;
- a refund only goes to a winner, back to the PayPal account that paid;
- each refund has a fixed PayPal-Request-Id and each pot one sender_batch_id,
  and the payouts table remembers what already went out, so running twice
  never pays twice.
"""
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

import config
import db
import paypal
import views
from settle_math import Entry, split_pot

log = logging.getLogger("promise_keeper.settle")


class ToolError(Exception):
    """The agent asked for something the rules don't allow. The message goes back to it."""


def money(cents: int) -> str:
    return f"${cents // 100}.{cents % 100:02d}".replace(".00", "")


@dataclass
class Person:
    promise_id: str
    name: str
    activity: str
    target: int
    done: int
    pending: int  # proofs waiting for a review that could still count
    stake_cents: int
    payer_email: str | None
    order_id: str | None
    capture_id: str | None

    @property
    def won(self) -> bool:
        return self.done >= self.target


@dataclass
class Pot:
    id: str
    name: str
    deadline: datetime
    recipient: str
    people: list[Person] = field(default_factory=list)


def load(pot_row: dict) -> Pot:
    """Everything the agent needs to know about one pot, worked out from the database."""
    pot = Pot(
        id=pot_row["id"],
        name=pot_row.get("name") or "",
        deadline=views.parse_ts(pot_row["deadline"]),
        recipient=pot_row.get("recipient") or "charity",
    )
    for p in db.where("promises", pot_id=pot.id):
        if p["status"] not in ("active", "won", "lost"):
            continue  # unpaid drafts never put money in; settled ones are done
        proofs = db.where("proofs", promise_id=p["id"])
        user = db.get("users", p["user_id"])
        pot.people.append(
            Person(
                promise_id=p["id"],
                name=(user or {}).get("name") or "Someone",
                activity=p["activity"],
                target=p["target_count"],
                done=sum(1 for x in proofs if x.get("counted")),
                pending=sum(1 for x in proofs if x.get("ai_verdict") == "unsure" and not x.get("referee_decision")),
                stake_cents=p["stake_cents"],
                payer_email=(p.get("payer_email") or "").lower() or None,
                order_id=p.get("paypal_order_id"),
                capture_id=p.get("paypal_capture_id"),
            )
        )
    return pot


def hold_reason(pot: Pot, now: datetime) -> str | None:
    """Wait a little if a proof still under review could turn a miss into a win."""
    if now >= pot.deadline + timedelta(minutes=config.AGENT_HOLD_MINUTES):
        return None
    for p in pot.people:
        if not p.won and p.pending and p.done + p.pending >= p.target:
            return f"{p.name} has a proof still being reviewed that could change the result."
    return None


def plan(pot: Pot):
    entries = [Entry(key=p.promise_id, stake_cents=p.stake_cents, won=p.won) for p in pot.people]
    return split_pot(entries, pot.recipient)


def event(pot_id: str, kind: str, message: str, promise_id: str | None = None) -> None:
    db.insert("agent_events", {"pot_id": pot_id, "promise_id": promise_id, "kind": kind, "message": message})


class Session:
    """One agent run over one pot. Methods are the tools the agent may call."""

    def __init__(self, pot: Pot):
        self.pot = pot
        self.plan = plan(pot) if pot.people else None
        self.by_id = {p.promise_id: p for p in pot.people}
        self.verified: set[str] = set()
        self.notes: dict[str, str] = {}  # the agent's note per promise, once it writes them
        self.summary: str | None = None

    # ----- reading -----

    def facts(self) -> dict:
        """What the agent sees. User-written text is cleaned before it reaches the model."""
        return {
            "pot": self.pot.name[:80],
            "deadline": self.pot.deadline.isoformat(),
            "loser_money_goes_to": "charity" if self.pot.recipient == "charity" else "a friend",
            "people": [
                {
                    "promise_id": p.promise_id,
                    "name": p.name[:40],
                    "activity": p.activity[:80],
                    "proofs_counted": p.done,
                    "proofs_needed": p.target,
                    "kept_promise": p.won,
                    "stake": money(p.stake_cents),
                }
                for p in self.pot.people
            ],
            "money_plan": self.plan_text(),
            "steps_left": self.steps_left(),
        }

    def plan_text(self) -> list[str]:
        if not self.plan:
            return []
        lines = [f"refund {money(c)} to {self.by_id[k].name} (promise_id {k})" for k, c in self.plan.refunds]
        for key, cents in self.plan.payouts:
            who = self.by_id[key].name if key in self.by_id else ("charity" if key == "charity" else "the friend")
            lines.append(f"pay {money(cents)} to {who}")
        return lines

    def _done_refunds(self) -> set[str]:
        return {r["promise_id"] for r in db.where("payouts", pot_id=self.pot.id, kind="refund")}

    def _payouts_sent(self) -> bool:
        return bool(db.where("payouts", pot_id=self.pot.id, kind="payout"))

    def steps_left(self) -> list[str]:
        if not self.plan:
            return []
        left = []
        done = self._done_refunds()
        for k, _ in self.plan.refunds:
            if k not in self.verified and k not in done:
                left.append(f"verify_stake {k}")
            if k not in done:
                left.append(f"refund_stake {k}")
        if self.plan.payouts and not self._payouts_sent():
            left.append("send_payouts")
        return left

    # ----- tools -----

    def verify_stake(self, promise_id: str) -> str:
        p = self.by_id.get(promise_id)
        if not p:
            raise ToolError("No promise with that id in this pot.")
        if not p.order_id:
            raise ToolError("This promise has no PayPal order.")
        try:
            r = paypal.verify_capture(p.order_id, p.stake_cents)
        except Exception as e:  # the toolkit raises plain exceptions
            log.warning("verify_stake failed for %s: %s", promise_id, e)
            raise ToolError("PayPal didn't answer the check. Try again or move on.")
        if not r["ok"]:
            event(self.pot.id, "error", f"PayPal says {p.name}'s order is {r['status']} for {r['amount']}, not {money(p.stake_cents)}.", promise_id)
            raise ToolError(f"PayPal shows status {r['status']} and amount {r['amount']}. Do not refund this one.")
        self.verified.add(promise_id)
        event(self.pot.id, "verify", f"Checked with PayPal: {p.name}'s {money(p.stake_cents)} stake was captured.", promise_id)
        return f"Confirmed: {money(p.stake_cents)} was captured for {p.name}."

    def refund_stake(self, promise_id: str) -> str:
        if not self.plan or promise_id not in dict(self.plan.refunds):
            raise ToolError("Refused: only people who kept their promise get a refund.")
        p = self.by_id[promise_id]
        if promise_id in self._done_refunds():
            return f"{p.name} was already refunded."
        if not p.capture_id or not p.payer_email:
            raise ToolError("Missing the PayPal capture or payer for this promise.")
        res = paypal.refund_capture(p.capture_id, f"refund-{promise_id}")
        db.insert("payouts", {
            "pot_id": self.pot.id, "promise_id": promise_id, "kind": "refund",
            "receiver": p.payer_email, "amount_cents": p.stake_cents,
            "paypal_id": res["id"], "status": res["status"].lower(),
            "note": "Promise kept: full stake back",
        })
        event(self.pot.id, "refund", f"Refunded {money(p.stake_cents)} to {p.name}'s PayPal (refund {res['id']}).", promise_id)
        return f"Refunded {money(p.stake_cents)} to {p.name}. PayPal refund id {res['id']}, status {res['status']}."

    def _receiver(self, key: str) -> tuple[str, str, str | None]:
        """(email, display name, promise_id or None) for one payout line."""
        if key in self.by_id:
            p = self.by_id[key]
            if not p.payer_email:
                raise ToolError(f"No PayPal account on file for {p.name}.")
            return p.payer_email, p.name, key
        if key == "charity":
            if not config.CHARITY_EMAIL:
                raise ToolError("No charity PayPal account is set up (CHARITY_EMAIL).")
            return config.CHARITY_EMAIL, "charity", None
        return key, "the friend", None

    def send_payouts(self) -> str:
        if not self.plan or not self.plan.payouts:
            return "Nothing to pay out: nobody missed their promise."
        if self._payouts_sent():
            return "The payouts for this pot were already sent."
        lines = [(*self._receiver(key), cents) for key, cents in self.plan.payouts]
        items = [(email, cents, f"From the pot \"{self.pot.name[:60]}\" on Promise Keeper") for email, _, _, cents in lines]
        batch_id = f"pot-{self.pot.id}"
        try:
            res = paypal.send_payouts(batch_id, items)
            paypal_id, status = res["id"], res["status"].lower()
        except paypal.DuplicateBatch:
            paypal_id, status = None, "sent earlier"  # sent before a crash; don't send again
        for email, name, promise_id, cents in lines:
            db.insert("payouts", {
                "pot_id": self.pot.id, "promise_id": promise_id, "kind": "payout",
                "receiver": email, "amount_cents": cents, "paypal_id": paypal_id, "status": status,
                "note": f"Paid to {name}",
            })
        names = ", ".join(f"{money(c)} to {n}" for _, n, _, c in lines)
        event(self.pot.id, "payout", f"Sent {names} through PayPal Payouts (batch {paypal_id or batch_id}).")
        return f"Sent {names}. PayPal batch {paypal_id or batch_id}, status {status}."

    def finish(self, summary: str, notes: dict[str, str]) -> str:
        left = self.steps_left()
        left = [s for s in left if not s.startswith("verify_stake")]  # a failed check alone doesn't block
        if left:
            raise ToolError("Not finished yet. Still to do: " + "; ".join(left))
        now = datetime.now(timezone.utc).isoformat()
        for p in self.pot.people:
            db.update("promises", p.promise_id, {
                "status": "settled",
                "outcome": "won" if p.won else "lost",
                "agent_note": clean(notes.get(p.promise_id) or default_note(self, p), 400),
            })
        db.update("pots", self.pot.id, {"settled_at": now, "agent_summary": clean(summary, 600)})
        event(self.pot.id, "done", "Settled. Every stake has gone back or out, exactly once.")
        return "Settled."


def clean(text: str, limit: int) -> str:
    text = "".join(ch if ch.isprintable() else " " for ch in (text or ""))
    return " ".join(text.split())[:limit]


def default_note(s: Session, p: Person) -> str:
    if p.won:
        return f"You did it: {p.done} of {p.target}. Your {money(p.stake_cents)} is on its way back to your PayPal."
    where = "to charity" if s.pot.recipient == "charity" else "to the people who kept theirs" if any(x.won for x in s.pot.people) else "to your friend"
    return f"You got {p.done} of {p.target}, so your {money(p.stake_cents)} went {where}. Next time, try a smaller goal and build up."


def finish_by_code(s: Session, summary: str | None = None, notes: dict[str, str] | None = None) -> None:
    """The backstop: do any step the agent didn't, then close the pot. Same rules, same tools."""
    if not s.plan:  # nobody paid in, so nothing to move
        s.finish(summary or "Nobody locked in a stake, so no money moved.", {})
        return
    done = s._done_refunds()
    for k, _ in s.plan.refunds:
        if k not in done:
            s.refund_stake(k)
    if s.plan.payouts and not s._payouts_sent():
        s.send_payouts()
    kept = sum(1 for p in s.pot.people if p.won)
    s.finish(summary or f"{kept} of {len(s.pot.people)} kept their promise. Refunds and payouts are done.", notes or {})
