"""The promise agent: settling, guardrails, running twice, and the model loop."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

import agent
import config
import settle
from tests.conftest import ACCOUNTS, as_user
from tests.test_promises_api import promise_body

NOW = datetime.now(timezone.utc)
PAST = (NOW - timedelta(hours=2)).isoformat()


def locked_promise(client, fake_db, fake_paypal, payer="sam@personal.example.com", **over):
    """A paid, active promise whose deadline has already passed."""
    fake_paypal.payer_email = payer
    c = client.post("/promises", json=promise_body(**over)).json()
    client.post(f"/promises/{c['promise_id']}/capture", json={"order_id": c["order_id"]})
    fake_db.tables["pots"][c["pot_id"]]["deadline"] = PAST
    return c


def count_proofs(fake_db, promise_id, n, **extra):
    for _ in range(n):
        fake_db.insert("proofs", {"promise_id": promise_id, "kind": "photo", "started_at": PAST, "counted": True, **extra})


def add_member(fake_db, pot_id, name="alex", stake=2000, payer="alex@personal.example.com"):
    """A second paid person in the same pot (group pots are joined by link in F7)."""
    user = fake_db.insert("users", {"auth_id": ACCOUNTS[f"tok-{name}"]["id"], "email": f"{name}@example.com", "name": name.title()})
    return fake_db.insert("promises", {
        "pot_id": pot_id, "user_id": user["id"], "raw_text": "x", "activity": "go to the gym", "proof": "photo",
        "target_count": 3, "stake_cents": stake, "recipient": "charity", "summary": "Gym 3 times",
        "status": "active", "paypal_order_id": f"O-{name}", "paypal_capture_id": f"CAP-{name}", "payer_email": payer,
        "gym_lat": None, "gym_lng": None,
    })


def test_kept_promise_is_refunded_to_the_payer(client, fake_db, fake_paypal):
    c = locked_promise(client, fake_db, fake_paypal)
    count_proofs(fake_db, c["promise_id"], 3)

    assert agent.run_due(use_model=False) == {"settled": 1, "held": 0, "failed": 0}

    assert fake_paypal.refunds == [(f"CAP-{c['order_id']}", f"refund-{c['promise_id']}")]
    assert fake_paypal.batches == []
    p = fake_db.tables["promises"][c["promise_id"]]
    assert (p["status"], p["outcome"]) == ("settled", "won")
    assert "back to your PayPal" in p["agent_note"]
    [row] = fake_db.where("payouts", kind="refund")
    assert (row["receiver"], row["amount_cents"]) == ("sam@personal.example.com", 2000)
    assert fake_db.tables["pots"][c["pot_id"]]["settled_at"]


def test_missed_promise_pays_the_friend(client, fake_db, fake_paypal):
    c = locked_promise(client, fake_db, fake_paypal)
    count_proofs(fake_db, c["promise_id"], 2)

    agent.run_due(use_model=False)

    assert fake_paypal.refunds == []
    [(batch_id, items)] = fake_paypal.batches
    assert batch_id == f"pot-{c['pot_id']}"
    assert [(e, cents) for e, cents, _ in items] == [("alex@example.com", 2000)]
    p = fake_db.tables["promises"][c["promise_id"]]
    assert (p["status"], p["outcome"]) == ("settled", "lost")


def test_charity_needs_an_account_and_never_loses_money(client, fake_db, fake_paypal, monkeypatch):
    c = locked_promise(client, fake_db, fake_paypal)
    fake_db.tables["pots"][c["pot_id"]]["recipient"] = "charity"  # a promise from before charity was removed
    monkeypatch.setattr(config, "CHARITY_EMAIL", "")
    assert agent.run_due(use_model=False)["failed"] == 1
    assert not fake_db.tables["pots"][c["pot_id"]].get("settled_at")  # left open, retried later
    assert any(e["kind"] == "error" for e in fake_db.tables["agent_events"].values())

    monkeypatch.setattr(config, "CHARITY_EMAIL", "charity@personal.example.com")
    assert agent.run_due(use_model=False)["settled"] == 1
    [(_, items)] = fake_paypal.batches
    assert items[0][:2] == ("charity@personal.example.com", 2000)


def test_group_pot_splits_losers_money_between_winners(client, fake_db, fake_paypal):
    c = locked_promise(client, fake_db, fake_paypal)
    alex = add_member(fake_db, c["pot_id"], "alex", stake=1000)
    mal = add_member(fake_db, c["pot_id"], "mallory", stake=1001, payer="mal@personal.example.com")
    count_proofs(fake_db, c["promise_id"], 3)
    count_proofs(fake_db, alex["id"], 3)
    count_proofs(fake_db, mal["id"], 1)

    agent.run_due(use_model=False)

    assert len(fake_paypal.refunds) == 2  # Sam and Alex get their own stakes back
    [(_, items)] = fake_paypal.batches
    assert sorted((e, cents) for e, cents, _ in items) == [
        ("alex@personal.example.com", 500),
        ("sam@personal.example.com", 501),
    ]
    out = sum(r["amount_cents"] for r in fake_db.tables["payouts"].values())
    assert out == 2000 + 1000 + 1001  # every cent in goes out exactly once


def test_running_twice_never_pays_twice(client, fake_db, fake_paypal):
    c = locked_promise(client, fake_db, fake_paypal)
    count_proofs(fake_db, c["promise_id"], 1)
    agent.run_due(use_model=False)
    # Pretend the pot never got marked settled (crash after paying): run again.
    fake_db.tables["pots"][c["pot_id"]]["settled_at"] = None
    for p in fake_db.tables["promises"].values():
        p["status"] = "active"
    agent.run_due(use_model=False)

    assert len(fake_paypal.batches) == 1
    assert len(fake_db.where("payouts", kind="payout")) == 1


def test_waits_for_a_proof_under_review_that_could_change_the_result(client, fake_db, fake_paypal):
    c = locked_promise(client, fake_db, fake_paypal)
    count_proofs(fake_db, c["promise_id"], 2)
    count_proofs(fake_db, c["promise_id"], 1, counted=False, ai_verdict="unsure")
    fake_db.tables["pots"][c["pot_id"]]["deadline"] = (NOW - timedelta(minutes=5)).isoformat()

    assert agent.run_due(use_model=False)["held"] == 1
    assert fake_paypal.refunds == [] and fake_paypal.batches == []

    later = NOW + timedelta(minutes=config.AGENT_HOLD_MINUTES + 1)
    assert agent.run_due(now=later, use_model=False)["settled"] == 1


def test_future_deadlines_are_left_alone(client, fake_db, fake_paypal):
    fake_paypal.payer_email = "sam@personal.example.com"
    c = client.post("/promises", json=promise_body()).json()
    client.post(f"/promises/{c['promise_id']}/capture", json={"order_id": c["order_id"]})
    assert agent.run_due(use_model=False) == {"settled": 0, "held": 0, "failed": 0}


def test_unpaid_drafts_are_not_settled_as_money(client, fake_db, fake_paypal):
    c = client.post("/promises", json=promise_body()).json()  # never captured
    fake_db.tables["pots"][c["pot_id"]]["deadline"] = PAST
    agent.run_due(use_model=False)
    assert fake_paypal.refunds == [] and fake_paypal.batches == []
    assert fake_db.tables["promises"][c["promise_id"]]["status"] == "draft"


# ---------- Guardrails: what the model may and may not do ----------

def session_for(fake_db, pot_id):
    return settle.Session(settle.load(fake_db.tables["pots"][pot_id]))


def test_tools_refuse_to_refund_someone_who_missed(client, fake_db, fake_paypal):
    c = locked_promise(client, fake_db, fake_paypal)
    s = session_for(fake_db, c["pot_id"])
    with pytest.raises(settle.ToolError):
        s.refund_stake(c["promise_id"])
    with pytest.raises(settle.ToolError):
        s.refund_stake("not-a-real-id")
    assert fake_paypal.refunds == []


def test_finish_refuses_until_the_money_has_moved(client, fake_db, fake_paypal):
    c = locked_promise(client, fake_db, fake_paypal)
    s = session_for(fake_db, c["pot_id"])
    with pytest.raises(settle.ToolError, match="send_payouts"):
        s.finish("done", {})
    s.send_payouts()
    assert s.finish("done", {c["promise_id"]: "Next time, aim for 2."}) == "Settled."
    assert fake_db.tables["promises"][c["promise_id"]]["agent_note"] == "Next time, aim for 2."


def test_a_bad_paypal_check_blocks_the_refund_message(client, fake_db, fake_paypal):
    c = locked_promise(client, fake_db, fake_paypal)
    count_proofs(fake_db, c["promise_id"], 3)
    fake_paypal.verify_capture = lambda o, cents: {"ok": False, "status": "VOIDED", "amount": "0.00"}
    import paypal

    paypal.verify_capture = fake_paypal.verify_capture
    s = session_for(fake_db, c["pot_id"])
    with pytest.raises(settle.ToolError, match="Do not refund"):
        s.verify_stake(c["promise_id"])


# ---------- The model loop, with a scripted stand-in for Gemini ----------

def call(name, **args):
    return SimpleNamespace(name=name, args=args)


def scripted(steps):
    """Each step is the list of function calls the 'model' makes that turn."""
    it = iter(steps)

    def fake_generate(contents):
        calls = next(it, [])
        return SimpleNamespace(function_calls=calls, candidates=[SimpleNamespace(content="model turn")])

    return fake_generate


def test_model_drives_the_settlement_with_tools(client, fake_db, fake_paypal, monkeypatch):
    c = locked_promise(client, fake_db, fake_paypal)
    pid = c["promise_id"]
    count_proofs(fake_db, pid, 3)
    monkeypatch.setattr(agent, "_generate", scripted([
        [call("get_facts")],
        [call("verify_stake", promise_id=pid)],
        [call("refund_stake", promise_id=pid)],
        [call("finish", summary="Sam kept it.", notes=[{"promise_id": pid, "note": "Three for three. Money's back."}])],
    ]))
    monkeypatch.setattr(agent.types.Part, "from_function_response", staticmethod(lambda name, response: (name, response)))
    monkeypatch.setattr(agent.types, "Content", lambda role, parts: (role, parts))

    assert agent.run_due() == {"settled": 1, "held": 0, "failed": 0}
    assert len(fake_paypal.refunds) == 1
    assert fake_db.tables["promises"][pid]["agent_note"] == "Three for three. Money's back."
    assert fake_db.tables["pots"][c["pot_id"]]["agent_summary"] == "Sam kept it."
    kinds = [e["kind"] for e in fake_db.tables["agent_events"].values()]
    assert kinds == ["check", "verify", "refund", "done"]


def test_model_that_tries_to_cheat_or_stops_early_is_finished_by_code(client, fake_db, fake_paypal, monkeypatch):
    c = locked_promise(client, fake_db, fake_paypal)
    pid = c["promise_id"]  # missed: 0 of 3
    monkeypatch.setattr(agent, "_generate", scripted([
        [call("refund_stake", promise_id=pid)],  # refused: they missed
        [],  # then the model gives up
    ]))
    monkeypatch.setattr(agent.types.Part, "from_function_response", staticmethod(lambda name, response: (name, response)))
    monkeypatch.setattr(agent.types, "Content", lambda role, parts: (role, parts))

    assert agent.run_due()["settled"] == 1
    assert fake_paypal.refunds == []  # the cheat was refused
    assert len(fake_paypal.batches) == 1  # code finished the job: the friend got paid


def test_model_outage_falls_back_to_code(client, fake_db, fake_paypal, monkeypatch):
    c = locked_promise(client, fake_db, fake_paypal)
    count_proofs(fake_db, c["promise_id"], 3)

    def down(contents):
        raise agent.ai.AIError("503")

    monkeypatch.setattr(agent, "_generate", down)
    assert agent.run_due()["settled"] == 1
    assert len(fake_paypal.refunds) == 1


# ---------- API ----------

def test_agent_feed_shows_what_happened_on_my_pots(client, fake_db, fake_paypal, monkeypatch):
    c = locked_promise(client, fake_db, fake_paypal)
    count_proofs(fake_db, c["promise_id"], 3)
    agent.run_due(use_model=False)

    feed = client.get("/me/agent").json()
    assert feed["watching"] == 0
    assert [e["kind"] for e in feed["events"]][0] == "done"
    view = client.get(f"/promises/{c['promise_id']}").json()
    assert view["status"] == "settled" and view["outcome"] == "won"
    assert view["money_moves"][0]["kind"] == "refund"
    assert view["money_moves"][0]["to"] == "sam…@personal.example.com"  # masked, never the full email

    # Someone else's feed doesn't include Sam's pot.
    other = client.get("/me/agent", headers=as_user("mallory")).json()
    assert other["events"] == []


def test_cron_endpoint_needs_the_key(client, fake_db, fake_paypal, monkeypatch):
    monkeypatch.setattr(config, "AGENT_KEY", "")
    assert client.post("/agent/run").status_code == 404
    monkeypatch.setattr(config, "AGENT_KEY", "s3cret")
    assert client.post("/agent/run", headers={"X-Agent-Key": "wrong"}).status_code == 404
    monkeypatch.setattr(agent, "_generate", lambda contents: (_ for _ in ()).throw(agent.ai.AIError("off")))
    assert client.post("/agent/run", headers={"X-Agent-Key": "s3cret"}).json() == {"settled": 0, "held": 0, "failed": 0}
