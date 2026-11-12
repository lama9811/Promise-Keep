"""Claude as the main AI: the agent's tool loop and the Gemini backup, with a fake Claude."""
from types import SimpleNamespace

import anthropic
import httpx
import pytest
from pydantic import BaseModel

import agent
import ai
import config
from tests.test_agent import count_proofs, locked_promise


def use(name, **args):
    return SimpleNamespace(type="tool_use", id=f"tu_{name}", name=name, input=args)


@pytest.fixture
def claude_on(monkeypatch):
    monkeypatch.setattr(config, "ANTHROPIC_API_KEY", "test-key")


def scripted_claude(monkeypatch, steps):
    """Each step is the list of tool calls Claude makes that turn; also records what we sent back."""
    it = iter(steps)
    sent = []

    def create(**kw):
        sent.append(kw["messages"][-1])
        return SimpleNamespace(content=next(it, []))

    monkeypatch.setattr(ai, "claude", lambda: SimpleNamespace(messages=SimpleNamespace(create=create)))
    return sent


def test_claude_drives_the_settlement(claude_on, client, fake_db, fake_paypal, monkeypatch):
    c = locked_promise(client, fake_db, fake_paypal)
    pid = c["promise_id"]
    count_proofs(fake_db, pid, 3)
    sent = scripted_claude(monkeypatch, [
        [use("get_facts")],
        [use("verify_stake", promise_id=pid), use("refund_stake", promise_id=pid)],
        [use("finish", summary="Sam kept it.", notes=[{"promise_id": pid, "note": "Three for three."}])],
    ])

    assert agent.run_due() == {"settled": 1, "held": 0, "failed": 0}
    assert len(fake_paypal.refunds) == 1
    assert fake_db.tables["promises"][pid]["agent_note"] == "Three for three."
    # Both results of a turn go back together, each matched to its call.
    both = sent[2]["content"]
    assert [r["tool_use_id"] for r in both] == ["tu_verify_stake", "tu_refund_stake"]


def test_claude_cheat_is_refused_and_code_finishes(claude_on, client, fake_db, fake_paypal, monkeypatch):
    c = locked_promise(client, fake_db, fake_paypal)
    pid = c["promise_id"]  # missed: 0 of 3
    sent = scripted_claude(monkeypatch, [[use("refund_stake", promise_id=pid)], []])

    assert agent.run_due()["settled"] == 1
    assert fake_paypal.refunds == []
    assert sent[1]["content"][0]["is_error"] is True
    assert len(fake_paypal.batches) == 1


def test_claude_outage_still_settles(claude_on, client, fake_db, fake_paypal, monkeypatch):
    c = locked_promise(client, fake_db, fake_paypal)
    count_proofs(fake_db, c["promise_id"], 3)
    req = httpx.Request("POST", "https://api.anthropic.com/v1/messages")

    def down(**kw):
        raise anthropic.APIConnectionError(request=req)

    monkeypatch.setattr(ai, "claude", lambda: SimpleNamespace(messages=SimpleNamespace(create=down)))
    monkeypatch.setattr(agent, "_generate", lambda contents: (_ for _ in ()).throw(ai.AIError("gemini off too")))
    assert agent.run_due()["settled"] == 1
    assert len(fake_paypal.refunds) == 1


class Tiny(BaseModel):
    ok: bool


def test_generate_json_uses_claude_first(claude_on, monkeypatch):
    monkeypatch.setattr(ai, "claude_json", lambda p, s, i=None: {"ok": True})
    monkeypatch.setattr(ai, "gemini_json", lambda p, s, i=None: pytest.fail("Gemini should not run"))
    assert ai.generate_json("hi", Tiny) == {"ok": True}


def test_generate_json_falls_back_to_gemini(claude_on, monkeypatch):
    monkeypatch.setattr(config, "GEMINI_API_KEY", "g")

    def refused(p, s, i=None):
        raise ai.AIError("Claude gave no answer (refusal)")

    monkeypatch.setattr(ai, "claude_json", refused)
    monkeypatch.setattr(ai, "gemini_json", lambda p, s, i=None: {"ok": False})
    assert ai.generate_json("hi", Tiny) == {"ok": False}
