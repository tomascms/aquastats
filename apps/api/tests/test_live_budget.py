from types import SimpleNamespace

from app.domain import live_results
from app.domain.live_results import live_files
from app.domain.models import Competition


def test_slow_site_imports_nothing_and_is_retried_later(monkeypatch):
    index = b'<a href="ResultList_1.pdf">1</a><a href="ResultList_2.pdf">2</a>'
    fetched = []
    monkeypatch.setattr(live_results, "RUN_BUDGET_S", -1.0)  # budget already spent after the index
    monkeypatch.setattr(live_results, "_fetch", lambda _client, url: fetched.append(url) or index)
    monkeypatch.setattr(live_results, "process_lenex", lambda *a, **k: (_ for _ in ()).throw(AssertionError("partial import")))
    row = Competition(extra={"live": {"url": "https://live.swimrankings.net/1/"}})
    out = live_results.sync(SimpleNamespace(flush=lambda: None, scalar=lambda _q: 1, scalars=lambda _q: []), {}, row, None, force=True)
    assert out == {"imported": 0, "status": "slow"}
    assert fetched == ["https://live.swimrankings.net/1/"]  # only the index; no meet file was read


def test_meet_already_being_followed_is_skipped_not_waited_for(monkeypatch):
    monkeypatch.setattr(live_results, "_fetch", lambda *_: (_ for _ in ()).throw(AssertionError("fetched while locked")))
    row = Competition(extra={"live": {"url": "https://live.swimrankings.net/1/", "status": "following"}})
    # SKIP LOCKED returns nothing while another request holds the row.
    out = live_results.sync(SimpleNamespace(flush=lambda: None, scalar=lambda _q: None), {}, row, None, force=True)
    assert out == {"imported": 0, "status": "following"}


def test_live_files_whatever_the_organiser_calls_them():
    index = '<a href="RESULTADOS.lxf">a</a><a href="ENTRY LIST.pdf">b</a><a href="StartList_2.pdf">c</a><a href="ResultList_2.pdf">d</a>'
    assert live_files(index) == ["RESULTADOS.lxf", "StartList_2.pdf", "ResultList_2.pdf"]
    # No per-event lists: the full results PDF is followed instead.
    assert live_files('<a href="RESULTADOS COMPLETOS.pdf">r</a><a href="HORARIO.pdf">h</a>') == ["RESULTADOS COMPLETOS.pdf"]


def test_unknown_layout_naming_our_swimmer_goes_to_the_ai_reader(monkeypatch):
    from app.domain import meet_files_ai, splash_pdf

    asked = []
    monkeypatch.setattr(splash_pdf, "parse_splash_pdf", lambda _d: (_ for _ in ()).throw(live_results.LenexError("x")))
    monkeypatch.setattr(live_results, "parse_splash_pdf", splash_pdf.parse_splash_pdf)
    monkeypatch.setattr(splash_pdf, "extract_pages", lambda _d: ["Resultados\n4. Tomas SOUSA Vitoria 34.48"])
    monkeypatch.setattr(meet_files_ai, "read_meet", lambda pages, athletes, header, course, kind=None: asked.append(course) or "AI meet")
    assert live_results._read_file("ResultList_9.pdf", b"%PDF", [object()], "scm") == "AI meet"
    assert asked == ["scm"]
