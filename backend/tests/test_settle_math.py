import pytest

from settle_math import Entry, split_pot


def total_out(plan):
    return sum(c for _, c in plan.refunds) + sum(c for _, c in plan.payouts)


def test_five_people_two_losers():
    entries = [
        Entry("sam", 1000, won=False),
        Entry("alex", 1000, won=True),
        Entry("priya", 1000, won=True),
        Entry("jordan", 1000, won=False),
        Entry("mingma", 1000, won=True),
    ]
    plan = split_pot(entries, recipient="charity")
    assert plan.refunds == [("alex", 1000), ("priya", 1000), ("mingma", 1000)]
    # $20 split 3 ways; leftover cent goes to the first winners.
    assert plan.payouts == [("alex", 667), ("priya", 667), ("mingma", 666)]
    assert total_out(plan) == 5000


def test_solo_promise_lost_pays_recipient():
    plan = split_pot([Entry("sam", 2000, won=False)], recipient="alex@example.com")
    assert plan.refunds == []
    assert plan.payouts == [("alex@example.com", 2000)]


def test_everyone_won_only_refunds():
    entries = [Entry("a", 1000, True), Entry("b", 500, True), Entry("c", 2500, True)]
    plan = split_pot(entries, recipient="charity")
    assert plan.refunds == [("a", 1000), ("b", 500), ("c", 2500)]
    assert plan.payouts == []


def test_nobody_won_total_to_recipient():
    entries = [Entry("a", 1000, False), Entry("b", 1000, False), Entry("c", 1000, False)]
    plan = split_pot(entries, recipient="charity")
    assert plan.refunds == []
    assert plan.payouts == [("charity", 3000)]


def test_uneven_stakes_split_evenly_and_conserve_money():
    entries = [Entry("a", 700, True), Entry("b", 1000, False), Entry("c", 333, False), Entry("d", 100, True)]
    plan = split_pot(entries, recipient="charity")
    assert plan.refunds == [("a", 700), ("d", 100)]
    assert plan.payouts == [("a", 667), ("d", 666)]
    assert total_out(plan) == 2133


def test_rejects_float_cents():
    with pytest.raises(ValueError):
        split_pot([Entry("a", 10.5, True)], recipient="charity")


def test_rejects_empty_pot():
    with pytest.raises(ValueError):
        split_pot([], recipient="charity")
