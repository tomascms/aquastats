from types import SimpleNamespace

from app.domain import live_results
from app.domain.models import Competition


def test_slow_site_imports_nothing_and_is_retried_later(monkeypatch):
    index = b'<a href="ResultList_1.pdf">1</a><a href="ResultList_2.pdf">2</a>'
    fetched = []
    monkeypatch.setattr(live_results, "RUN_BUDGET_S", -1.0)  # budget already spent after the index
    monkeypatch.setattr(live_results, "_fetch", lambda _client, url: fetched.append(url) or index)
    monkeypatch.setattr(live_results, "process_lenex", lambda *a, **k: (_ for _ in ()).throw(AssertionError("partial import")))
    row = Competition(extra={"live": {"url": "https://live.swimrankings.net/1/"}})
    out = live_results.sync(SimpleNamespace(flush=lambda: None, scalar=lambda _q: 1), {}, row, None, force=True)
    assert out == {"imported": 0, "status": "slow"}
    assert fetched == ["https://live.swimrankings.net/1/"]  # only the index; no meet file was read


def test_meet_already_being_followed_is_skipped_not_waited_for(monkeypatch):
    monkeypatch.setattr(live_results, "_fetch", lambda *_: (_ for _ in ()).throw(AssertionError("fetched while locked")))
    row = Competition(extra={"live": {"url": "https://live.swimrankings.net/1/", "status": "following"}})
    # SKIP LOCKED returns nothing while another request holds the row.
    out = live_results.sync(SimpleNamespace(flush=lambda: None, scalar=lambda _q: None), {}, row, None, force=True)
    assert out == {"imported": 0, "status": "following"}
