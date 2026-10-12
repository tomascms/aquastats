# Race-analysis presentation: competitive research for Aquastats

Researched 2026-10-12. Sources: product sites, help centres, sample reports and PDFs, federation booklets and media write-ups. Every claim has a URL.

**About quotes.** Copyright limits apply, so report sentences are **paraphrased**: their structure, tone, length and numbers are kept, but not the exact wording. UI labels, section headings and metric names appear as names, because they are labels rather than prose. The aim was to capture the *pattern* of each product's feedback, which is the part a template can reuse.

---

## 0. Access log (what could NOT be verified)

| Target | Status |
|---|---|
| SwimInsights sample report (`swiminsightsappvideo.onrender.com/test-role-report`) | Redirects to the app landing page now. **The actual swimmer, coach and parent report versions were not visible.** Only marketing copy, the pricing page and blog posts were read. |
| Swimcloud swimmer profiles | Behind a Cloudflare bot check that I did not bypass. One swim page loaded, plus the help centre and the Swimcloud+ page. |
| SwimRankings athlete pages | Cloudflare bot check, so not read. Only the wiki was read. |
| Lapsly | Returned 403. |
| SwimSwam via WebFetch | 402/tollbit. Read in the browser instead. |
| Swimmetrix sample PDF | Read in full with pdftotext. |
| FFN Paris 2026 finals booklet (70 pp) | Read with pdftotext, so layout came through as text. **Colours were not seen.** |
| RFEN (Spain) Gwangju 2019 report | Restricted or confidential, and the download failed. |
| World Aquatics or Swiss Timing per-race "Race Analysis" PDFs | **No public per-race analysis sheet found.** World Aquatics publishes a *Results Report* with aggregate statistics only. |
| USA Swimming (Russell Mark's tool) | Internal only. Nothing public. |
| Gophin | Only the landing page, which is JS. The blog returns 404. No split screens seen. |
| PRSVision | The site's dashboard mock was read. Demo videos were not watched. |
| "Swim Analytics by SPIKE", "schoolfish" | **Not found.** The closest "Swim Analytics" is a coach service with Hellenic Aquatics, known only from LinkedIn snippets. |
| Dartfish x British Swimming | Known only from search snippets of a Dartfish blog, which now redirects. |

---

## 1. Product-by-product findings

### 1.1 FFN (French Federation): "Analyses de course". The federation gold standard
Sources: https://www.ffnatation.fr/centre-de-support-la-performance-analyses · booklet https://www.ffnatation.fr/sites/default/files/2026-08/Livret%20analyses%20finales%20CE%20Paris%202026.pdf · services catalogue https://www.ffnatation.fr/sites/default/files/2023-10/catalogue_services_performance.pdf

1. **Metrics and units.**
   - Reaction ("temps sur le plot", s) and flight time (s).
   - Breakout distance (m), defined as the end of the first arm stroke and **not** head surfacing.
   - Breakout time (s), time to 15 m (s) together with speed (m/s), and cumulative splits.
   - Section times measured at 5/15/25/45 m in each length for 50–200 m events, and at 5/25/45 m for 400–1500 m.
   - Stroke rate (cycles/min, averaged per 25 m), DPS (m/cycle = 60 × v / SR), tempo (s/cycle) and stroke counts ("CB").
   - Finish: last-5 m time plus "approche mur", the time and distance from the last stroke to the wall.
2. **Visual form.** One page per final. **There is one column per swimmer, in finishing order**, and the sections read down the page:
   - **RÉCAP**: swim time, stroke count, underwater time and distance.
   - **LAPS**: cumulative split with the 50 m section split beside it.
   - **PARTIES NAGÉES**: clean swim, excluding 0–15 m and 5 m either side of each wall.
   - **PARTIES NON NAGÉES**: START / VIRAGE n / FIN.
   - **COUPS DE BRAS**.
   - **MOUVEMENTS**: fréquence / tempo / amplitude per 25 m plus the mean.

   Final times show the gap to the winner (+0,24 and so on). A one-page **glossary** opens the booklet.
3. **Phrasing.** Numbers only, with no prose verdicts. Interpretation is left to the coach, who receives the PDF and an Excel file that can be compared within one swimmer or across swimmers (catalogue).
4. **Comparisons.** Against the other finalists (column layout) and against the winner (+Δ). Excel supports the same swimmer over time.
5. **Coach vs athlete.** The output is for coaches and national-team staff. Analyses are also viewable on Dartfish.
6. **Mobile.** None. It is a print/PDF format.
7. **Next steps.** None in the booklet.
- **Lesson from media reuse.** SwimSwam turned this booklet into **per-segment rankings**, ranking swimmers on 15–45 m swim time and on (0–15 m + last 5 m), to show "where the race was won". It also had to explain that a "sortie de coulée" of 15.47 m is legal, because the definition differs from head surfacing. https://swimswam.com/2024-olympics-race-data-breakdown-womens-50-free/

### 1.2 Australian Institute of Sport / Swimming Australia (competition analysis, Sparta, Lane Four)
Sources: Mason, Loschner & Fowlie, ISBS paper https://ojs.ub.uni-konstanz.de/cpa/article/view/2922/2763 · AWS case study https://www.aboutamazon.com.au/news/aws/how-swimming-australia-is-leveraging-aws-and-artificial-intelligence-for-olympic-success · https://itwire.com/guest-articles/guest-opinion/swimming-australia-continues-to-innovate-with-aws-taking-its-world-leading-technology-to-the-training-pool.html

1. **Metrics.**
   - Start time to 15 m.
   - For each half-lap of free swimming: stroke length, stroke frequency, velocity and **efficiency index**.
   - Turn time as 7.5 m in plus 7.5 m out (15 m total).
   - Finish time over the last 5 m.
   - Race averages for each parameter.
2. **Visual form.** A **spreadsheet with swimmers in columns**. The paper says the coach works down the page, comparing swimmers to see where and why each one succeeded or failed. This is the same design FFN still uses.
3. **Phrasing.** Statistical. The paper notes that a correlation focuses the coach's attention on the variables where *their* swimmer was relatively worse than the field.
4. **Comparisons.** Against every other A and B finalist. The Sparta models are trained on World Champs footage so that results can be benchmarked.
5. **Coach vs athlete.** Lane Four (Amazon QuickSight dashboards) lets coaches filter by swimmer, stroke and distance. It covers athlete progression, competition summaries, event profiling and benchmarking reports. Athletes and staff watch race video **with the metrics overlaid** to connect the numbers to what they felt.
6. **Mobile.** Lane Four is accessed across devices. Data reaches the deck instead of arriving up to 24 h later.
7. **Next steps.** A natural-language query mode (Amazon Q) is planned. Swimmers ask benchmark questions such as the fastest turn in the 100 free.
- **Turnaround.** An 8-lane 100 m race takes about 20–30 min to process.

### 1.3 World Aquatics / Omega / Swiss Timing
Sources: https://resources.fina.org/fina/document/2024/10/03/fbd120cc-9c34-4a55-ac29-ad778d159b0e/Paris-2024-Swimming-Results-Report.pdf · https://www.sportsvideo.org/2024/08/05/live-from-paris-2024-swimming-production-photo-gallery/ · https://www.fhs.swiss/eng/2024_02_22_05_Omega.html

1. **Official results.** Reaction time (RT) and 50 m splits only.
2. **Results Report.** Aggregate tables per event: fastest, slowest, average and median per round, plus **% deviation from the qualifying times (OQT/OCT)** (for example −2.06% OQT). There is also a records summary and the evolution across four Games.
3. **Broadcast.** Omega cameras capture live position, speed, acceleration, the distance between swimmers and stroke counts. Graphics show swimmers relative to each other and to WR/OR pace.
4. **Per-race analysis.** No public "Race Analysis" PDF with 15 m, stroke rate, DPS and turn times was found. National federations such as FFN fill that gap.

### 1.4 British Swimming (Dartfish plus Power BI)
Source: Dartfish blog via search snippet (https://blog.dartfish.com/2023/03/20/british-swimming-performance-analysis/, now redirecting) · https://www.techuk.org/resource/how-british-swimming-dives-into-data-analysis-with-intel.html

- Each race record in the database is linked to its video in Dartfish.
- **First evaluation:** the swimmer watches the video and sees objectively how the race went.
- **Second evaluation:** Power BI dashboards let coaches compare many indicators, including time, splits, stroke rate, stroke count, breath timing, and technical judgements on starts, turns, finishes and pacing.
- This is a **two-tier** design: video and simple facts for the athlete, an interactive dashboard for the coach.

### 1.5 PRSVision (PR Sport Science)
Source: https://www.prsportscience.com (read in browser)

1. **Metrics.**
   - Header tiles: SPLIT (s), STRK (count), DPS (m), TEMPO (s/stk).
   - Per-length table with columns LENGTH, SPLIT, TEMPO, COUNT, KICKS, TIME TO 15.
   - VELOCITY OVER RACE line chart.
   - Sub-splits such as 0–15 m and 15–35 m.
2. **Visuals.** Dashboard tabs are RACE TIMELINE (sub-split visualisation), STROKE HEATMAP (tempo per lap) and COMPARISON MODE.
3. **Phrasing.** No prose at all.
4. **Comparisons.** Every cell shows the value with an **inline delta in brackets**, such as 11.08 (+0.06). The reference is named in the header ("Compared to PR: <meet> (<date>)"). The legend reads "Green = faster/better than PR"; red means slower.
5. **Coach vs athlete.** Coach roster dashboard only.
6. **Mobile.** Claims results on any device in under 5 min.
7. **Next steps.** None.
- **Flaw in the mock.** Nearly every delta is 0.00, and "TIME TO 15" is filled in for every length. Unlabelled or ambiguous columns weaken trust.

### 1.6 MakoSwim / MakoVision
Sources: https://www.makoswim.io · https://www.makoswim.io/makovision/ · https://www.makoswim.io/how-the-1500-freestyle-world-record-was-broken/

1. **Metrics** (the home-page race card for a 50 fly):
   - Total time, START 15M (s), **FES** and **BES** (front-end and back-end speed, meaning the first and second 25 m times).
   - SPLIT ANALYSIS table with columns SEG, 15M, 15-20, 5M IN, TOTAL, M/S, and a **Diff +2.15** row.
   - STROKE EFFICIENCY: SPM, DPS (m) and stroke count.
   - SKILLS: Breakout s and m, Turn (s, with underwater s), Finish 5m (s).
2. **Visuals.**
   - Split cards, a velocity chart and an SR-vs-DPS chart.
   - Video player with a race **HUD overlay** (clock, splits and stroke data over the picture), drawings pinned to frames, and up to 5 min of **voice-over**.
   - One-page printable PDF. Print Studio uses drag-and-drop blocks.
3. **Phrasing.** Coach-voice blog writing that is short, comparative and causal. The 1500 WR piece:
   - pairs two swimmers per 100 m with stroke counts;
   - draws a cumulative-delta line (below zero means ahead);
   - breaks the final margin into phase contributions;
   - makes a one-line mechanism claim (the same speed on fewer strokes means more water per stroke).
4. **Comparisons.** Against a previous WR or rival, and front-end vs back-end within one race.
5. **Coach vs athlete.** The analysis lands on the swimmer's profile, next to training and times. Athletes watch their races, download their own PDF, and can draw and reply. Mako AI drafts per-athlete reports and **parent emails**.
6. **Mobile.** Tap, scrub and pinch gestures. The HUD needs the phone held sideways.
7. **Next steps.** Not in the race card. Mako AI answers pacing questions against an elite benchmark.
- **Design stance.** Tagging is deliberately **not automatic**: the coach confirms every mark. Stroke rate is taken "at the points that matter" rather than as one number for the whole swim.

### 1.7 Swimmetrix: StrokeLab plus OmniCoach (LLM)
Sources: https://swimmetrix.net · https://strokelab.swimmetrix.net · sample https://swimmetrix.net/report.pdf

1. **Metrics (StrokeLab).**
   - Race time, 15 m off the start, length splits, pace per 100, average SR (spm, with a **CPM/SPM toggle**), cycle period (s), DPS, strokes per length.
   - Underwater plus breakout time per length, turn time per length (definitions differ by stroke), time to 15 m per length.
   - A **"Technical Efficiency Score" out of 100**.
2. **Visuals.** Dashboard, an SR chart over the race, split breakdown and charts per length. Export to CSV or PDF.
3. **Phrasing (OmniCoach sample).** Fixed headings: Race Overview → What's Going Well (3 numbered items) → Areas for Improvement (each with "Why this happened" and "This suggests") → Recommendations for Next Time (sets) → Bottom Line. A typical sentence pattern:
   - state the segment drop as seconds and %;
   - give the cause, for example stroke count rising from 9 to 11 so DPS fell;
   - prescribe a set.

   The tone is enthusiastic, with exclamation marks.
4. **Comparisons.** Race comparison of two swims by pacing, turns and rhythm, "not just time". No PB or benchmark.
5. **Coach vs athlete.** A coach-review workflow ("Ask coach to review", "Mark review finished"). A disclaimer says AI guidance can be wrong.
6. **Mobile.** Not stated.
7. **Next steps.** Strong: numbered sets, a strategy for the next swim and deck-ready coach notes.
- **Cautionary errors in the "unedited" sample:**
  - the race is 50 yards but DPS is in metres;
  - average SR is 52 SPM while the text says SR ranged 84–126;
  - the turn produces a "9.84 SPM" artefact that is read as technique;
  - a generic "freshman 50" label.

  These are classic LLM narrative errors. **Validate the numbers before generating prose.**

### 1.8 SwimInsights ("one report, three versions")
Sources: https://www.swiminsights.com · /about · /pricing · blog (for example https://www.swiminsights.com/post/case-study-how-cam-mcevoy-is-redefining-sprint-freestyle-a-0-84-second-drop-from-heats-to-finals-a) · app landing https://swiminsightsappvideo.onrender.com/

1. **Metrics.**
   - Segment breakdown: start → breakout/underwater → turns → finish, plus pacing.
   - Splits, stroke tempo, velocity (m/s), SR (spm), DPS (m) and stroke count per segment (0–15, 15–25, 25–35, 35–50 m in the McEvoy case).
2. **Visuals.** Heat and final side by side with a speed-over-distance graph. Segment labels carry short verdict titles. The actual app screens were not visible.
3. **Phrasing.** Marketing promises "what went well, what to improve, how to swim faster next time". The blog comparison pattern:
   - give the headline gain (0.84 s, about 3.8%);
   - give per-segment deltas (SR 51.9 → 58.9 spm, DPS 1.13 → 1.06 m);
   - name the trade-off (shorter strokes, more speed);
   - **reframe the weakness as the next marginal gain** rather than a flaw.
4. **Comparisons.** Comparison reports put two races head to head, framed as what made the PB or caused the slip. The app adds age and event benchmarks, race history and PBs, side-by-side compare, and a "what moved since the last meet" view. About/pricing also lists projected times, target-time analysis ("Are you on track?") and **split recommendations for the next race**.
5. **Three versions.** Swimmers get simple action steps, coaches get technical detail and parents get clear progress updates. The app adds a **parent summary after every race**, a shared coach-and-family view per swimmer, and the coach's current focus. The **contents of each version could not be verified**.
6. **Mobile.** App based. Not detailed.
7. **Next steps.** Explicit: "the 1–2 fixes" for the next PB, goal splits, training-zone paces and what to work on between meets.
- **Error seen.** The McEvoy post gives the final time as both 21.70 and 21.38.

### 1.9 MyRaceData / MyRaceDataAnalyst
Sources: https://myracedata.net · https://myracedata.net/myracedata-analyst · https://myracedata.net/blog/8962fe27-baef-4b26-9b23-850c01cfc574 · https://myracedata.net/blog/636bf070-2646-48db-b8d0-7ae2fd87b806

1. **Metrics.**
   - Splits, segment times (user-placed markers at 15 m, breakouts, 25 m points and the finish), average velocity, SR, stroke count.
   - Dive-start data and per-turn timing (0–10 m out, underwater s and breakout m), plus a comparison with the official time.
2. **Visuals.** Graphs and tables, and a velocity plot. **Side-by-side comparison with synced tabs** (splits / strokes / dive / turns) and **delta badges**. Exports to PDF, CSV or ZIP. A custom race builder covers any distance or pool. Read-only share links.
3. **Phrasing (blog).** Sections run Start & Pullout → Turns & Pullouts → Stroke Count & Rhythm → Velocity Control → Why This Race Works → **Coaching Takeaways** (three short imperative maxims) → Final Thoughts. The style is aphoristic, principle-first and short.
4. **Comparisons.** Previous races, the official time, and elite benchmarks (claimed).
5. **Coach vs athlete.** Coaches use it between heats and across a season. Swimmers use it to see which part of the race (start, mid-pool or finish) needs attention. The contact form segments swimmers, coaches, parents and clubs.
6. **Mobile.** Cloud based and mobile friendly.
7. **Next steps.** "Clear recommendations and next steps" (the expert service, 48 h).

### 1.10 Swimcloud
Sources: swim page (browser) https://www.swimcloud.com/times/164466672/ · https://support.swimcloud.com/hc/en-us/articles/360008576693-Analyzing-the-Data · https://www.swimcloud.com/swimmers/plus/ · https://support.swimcloud.com/hc/en-us/articles/115005920128-Calculating-Your-Power-Index-Recruiting-Score · https://support.swimcloud.com/hc/en-us/articles/360052519314-How-are-performance-rankings-calculated · https://support.swimcloud.com/hc/en-us/articles/53882057150355-Understanding-Improvement-Calculations · https://support.swimcloud.com/hc/en-us/articles/38549380336275-Crowdsourcing-Race-Analysis-Empowering-Swimmers-to-Learn-Improve · https://support.swimcloud.com/hc/en-us/community/posts/47236641078931-Anna-Moesch-200-Freestyle · progress-graph rules https://support.swimcloud.com/hc/en-us/articles/115007502687-Why-don-t-I-have-a-progress-graph-on-my-profile

1. **Swim page (mobile-width).**
   - Header card: event plus time with a blue **PB** badge, then Place / Swimcloud Points / **Improvement** (−1.17, in green).
   - **Race Metrics**: a list of rows per 25, with a **Cumulative Time ↔ Subtracted Time** dropdown.
   - Each row expands to subtracted and cumulative time, stroke cycles, breakout time (s) and breakout distance (m).
   - Missing splits stay blank rather than being invented.
2. **Swimcloud+ analytics.**
   - Stroke count, breakouts and stroke rate per length; surface vs underwater velocity; "where time is won and lost".
   - **Race comparison of any two races** (vs your previous PB, or a competitor's pacing), swimmer-vs-swimmer comparison.
   - Race models, goals with **target splits built for you**, and standards showing every cut achieved plus how close the next one is.
   - Time progressions (1/3/5-year filters).
3. **Phrasing.**
   - The help guide gives benchmarks in plain coach language: world-class reaches 15 m in under 6 s and senior age-groupers should aim for 6–7 s; turns around 1.0–1.2 s or less; stroke tempo should rise into the walls.
   - It flags approximations (breakout distance, DPS).
   - Community analyses combine a number, a comparison and a tactical reading (for example, underwater 2.89 vs surface 1.76 m/s means "free speed").
4. **Comparisons.**
   - PB/SB per entry. Improvement rates count per *entry*, not per swim, to avoid double counting.
   - **Points**: base time = 1000 from the WR or NAG record, giving a cross-event comparison.
   - **Power Index** (recruiting): a weighted average of the top events against the NCAA base time, framed as a "GPA for swimming".
5. **Coach vs athlete.** Video defaults to visible to "My Coach". The coach-team guide recommends that swimmers analyse their own races. It says to focus on a few key improvements per race to prevent overload, have swimmers submit **one key takeaway**, and rotate the focus weekly (turns one week, stroke rate the next).
6. **Mobile.** The responsive list layout works at phone width.
7. **Next steps.** Goals → race plan → target splits. Standards → the next cut.
- **Progress graph rules.** It only appears with **4 or more swims in an event**, and **updates only after the season ends**, so early-season slow swims do not distort the trend.

### 1.11 Gophin
Source: https://gophin.app (browser)

- Official results are imported automatically (USA Swimming, Swim Canada). It shows PBs, progression charts, standards ("see exactly what you need to qualify"), following any swimmer, and filters by stroke, distance and pool.
- **Explicit per-audience value statements:**
  - Parents: finally understand what the times mean, with no spreadsheets.
  - Swimmers: PBs, standing against standards, improvement across seasons.
  - Coaches: whole-team dashboard, side-by-side progression charts, and a **"Performance Radar"** to spot strengths and weaknesses.
- Installable PWA. Split screens were not seen.

### 1.12 SwimRankings / swimstats.net (results databases)
Sources: https://wiki.swimrankings.net/index.php/swimrankings:FINA_Points · https://swimstats.net/help

- Points tables with base times reset yearly from the WR, so results compare across events. The athlete pages could not be read (bot check).
- swimstats.net plots **points against age** with reference bands (national-level curves, rank-equivalent curves, 60% and 90% percentile bands). Its help text warns that high early-age scores do not predict future elite level, which is a responsible framing for juniors.

### 1.13 Swimlab (iPhone)
Sources: https://swimlab.io · https://apps.apple.com/app/swimlab-swim-race-camera/id6792801981

- Phone race camera. Marks gun, reaction, breakout, turns and wall, timed to the hundredth with **"honest precision labels"** and corrected for the speed of sound.
- Frame-by-frame review. **Share cards** (branded video with the clock burned in, 9:16/1:1/4:5) can feature time, reaction or breakout.
- No benchmarks or prose.

### 1.14 GoSwim, TritonWear, Commit Swimming, others
- **GoSwim** (https://blog.goswim.tv/post/performance-data-in-the-goswim-app · https://swimmingworldmagazine.com/news/goswim-launches-app-designed-to-provide-data-centric-video-feedback-for-swimmers):
  - Data View covers breakout split and distance, strokes, tempo (spm), distance per cycle, 15 m split, velocity, turn/finish (flags to wall) and lap time.
  - A **stroke-length vs stroke-rate view** plotted per stroke.
  - Best race vs most recent race.
  - Coach voice and annotation over parent-filmed video.
  - Swimmers enter their own data (aimed at ages 10–11 and up).
- **TritonWear on SwimSwam** (https://swimswam.com/tritonwear-race-analysis-2018-pro-series-womens-100m-freestyle/ · https://www.swimmingworldmagazine.com/news/tritonwear-race-analysis-2018-usa-nationals-mens-100-breaststroke/):
  - Narrative lap by lap, using underwater s, SR, DPS and **stroke index (DPS × speed)**, compared against the **heat average** and rivals.
  - Conclusions name the trade-off: holding DPS while raising SR wins the close.
- **Commit Swimming meet reports** (https://swimswam.com/commit-swimming-launches-individual-meet-reports-for-deeper-performance-analysis/ · https://support.commitswimming.com/coaches/reports/reports-guide):
  - Compare against all-time bests or a date range; PB-only filter; time drops plus % improvement; standards achieved and progress to the next.
  - PDF or XLSX output per swimmer, shared with families. Parents see **only their own swimmer**, with the coach controlling what is visible.
- **Raúl Arellano / UGR Aquatics Lab** (https://blogs.ugr.es/aquaticslab/the-fastest-swim-in-the-history-50y-caeleb-dressel-analysis): a research-style write-up with tables at 5/10/15 m, 25 y and 50 y. Limitations are stated, and the conclusion is framed as **new performance targets and training objectives**.
- **Others with no public report detail:**
  - Orca Vision: 20+ metrics, 8–10 lanes (https://startupim.com/company/orca-vision).
  - Contemplas: automatic time and frequency curves (https://www.prophysics.ch/en/our-products/sport-performance-diagnostics/contemplas-schwimmanalyse).
  - iSwim (https://ai.g2.com/marketplace/tools/iswim).
  - Peak Athlete "Performance Lab", a 48–72 h service (https://www.gomotionapp.com/fgcspst/UserFiles/Image/QuickUpload/peak-athlete-brochure_096800.pdf).
  - IPB Bragança (Portugal) race-analysis service, which publishes no format (https://starseu.org/race-analysis-in-swimming/).
  - Kinovea: only forum-level DIY workflows (https://www.kinovea.org/en/forum/viewtopic.php?id=2069).

### 1.15 Parent communication (coach guidance)
Source: ASCA "News for Swim Parents", Guy Edson (2010), https://www.gomotionapp.com/csbbsc/UserFiles/File/Cuda%20-%20Article%20-%20After%20Your%20Child%20Races.pdf

- The coach should debrief first and ask how the swimmer felt before giving any verdict.
- The swim is judged on **three objectives**:
  - (1) best time?
  - (2) best *swim*, meaning execution of start, turns, stroke, pace and finish;
  - (3) did they *race*, beating the swimmers near them?

  Success on 1, 2 or all 3 objectives is graded as good, better or best.
- **Avoid superlatives** so the swimmer keeps room to improve.
- Parents should comfort and congratulate but **not add technical critique**.

### 1.16 Research on what coaches actually use
- Elite Olympic/Paralympic coaches rely most on video, performance reports and trend analysis, and **time available** limits feedback the most (https://core.ac.uk/works/8280971).
- Coaches and analysts agree full video is needed, but **only about a third of coaches want analyst-level profiling depth** (https://repository.mdx.ac.uk/item/89v70).
- In soccer, practitioners valued tracking an individual's change over benchmark comparisons. This is a proxy finding from a search-engine summary; **I have no verified URL for it**, so treat it as weak.
- In short course, turns are about 52% of race time and 50 m official splits mix turn and clean swim, so use 25 m or clean-swim sections (https://www.researchgate.net/publication/360087786_Turn_Performance_Variation_in_European_Elite_Short-Course_Swimmers).
- The 15 m mark discriminates performance tiers in 50 m events (https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2022.797367/pdf). In 50 free, DPS correlates with speed more than SR does (https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12541611/).

---

## 2. Cross-product matrix

| Product | Segment model | Ref. for deltas | Delta display | Prose verdicts | Next steps | Audiences | Video link |
|---|---|---|---|---|---|---|---|
| FFN booklet | 15 / 15–45 / walls ±5 / last 5 | other finalists, winner | +Δ to winner | none | none | coach | Dartfish |
| AIS sheet | 15 / half-laps / turn 7.5+7.5 / 5 | field | columns | none | none | coach | overlay (Sparta) |
| PRSVision | per length, 0–15, 15–35 | named PR meet | inline (±x) green/red | none | none | coach | n/a |
| MakoVision | 15 / 15–20 / 5 in / FES-BES | front vs back half | Diff row | blog only | AI | coach + athlete PDF + parent email | HUD, voice-over |
| Swimmetrix/OmniCoach | per length | half vs half | % drop | strong (LLM) | sets | swimmer, coach review | n/a |
| SwimInsights | start/UW/turns/finish | PB, previous race, age benchmark | side by side | yes | 1–2 fixes, goal splits | swimmer / coach / parent | upload |
| MyRaceData | user markers | previous race, official time | delta badges | blog | takeaways | coach, swimmer | yes |
| Swimcloud | per 25 + UW/surface v | PB/SB, any race, standards | Improvement −x.xx green | guide only | goals, target splits, next cut | swimmer, coach | linked |
| Gophin / Commit | none (times) | PB, standards | drop + % | none | next standard | parent / swimmer / coach | none |

---

## 3. Synthesis: 14 best practices

1. **Lead with the outcome and the delta to a *named* reference.** Show time, a PB/SB badge, a coloured Δ, and *which* PB (meet and date). Seen in Swimcloud's swim card, PRSVision's "Compared to PR: <meet> (<date>)" and Commit's time drop plus %.
2. **Use one fixed, defined segment model, and publish the glossary.** Start (0–15 m), clean swim, turn (5 m in + 5 m or 10 m out, or 7.5 + 7.5), finish (last 5 m). FFN, AIS, Mako and Swimcloud's guide do this, and FFN prints a glossary page. Define breakout as the first stroke versus head surfacing, so a 15.4 m breakout does not look illegal.
3. **Show deltas inline next to values**, not in a separate table, with consistent green/red meaning (faster or better). Seen in PRSVision (11.08 (+0.06)), MyRaceData's delta badges and Swimcloud's green improvement.
4. **Make comparison the main view.** Same swimmer against PB, previous race or the heat, side by side with synced segments, plus a **cumulative-delta line** (below zero means ahead). Seen in PRSVision comparison mode, Swimcloud+ race comparison, SwimInsights comparison reports, MyRaceData synced tabs, Mako's 1500 WR cumulative delta chart and GoSwim best-vs-recent.
5. **Use a single pacing number.** Front-end vs back-end difference (Mako FES/BES "Diff +2.15"), or the second-half drop in s and % (OmniCoach). Coaches read pacing at a glance.
6. **Never show stroke rate without DPS (and velocity).** Show them as a pair per 25 m and phrase the trade-off. Seen in FFN MOUVEMENTS, TritonWear stroke index, Mako's SR-vs-DPS chart, SwimInsights McEvoy and GoSwim's SL-SR view. Take SR at several points, not one race average (Mako).
7. **For the coach view, put one column per swimmer and rank per segment.** Columns per swimmer that the coach reads down the page (AIS, FFN), plus per-segment rankings showing "where the race was won" (SwimSwam's reuse of FFN). This suits relays, heats and squad review.
8. **Give few prioritized actions with fixed sections.** Going well → Improve (with the *why*) → Next time → Bottom line, limited to **1–2 fixes** or one key takeaway. Seen in SwimInsights (1–2 fixes), OmniCoach structure, MyRaceData coaching takeaways, Swimcloud (a few key improvements, one takeaway, rotate the focus).
9. **Tie every conclusion to evidence.** Use the chain *segment → Δ (s and %) → mechanism (SR/DPS/strokes/UW) → set or drill*. OmniCoach and SwimInsights have the best phrasing pattern, though their numbers need validating.
10. **Layer the same data for three audiences.**
    - Coach: full table, technical detail.
    - Swimmer: 1–2 actions plus a strength.
    - Parent: progress (PB, standards, what moved), with **no technical critique**, written by or approved by the coach.

    Seen in SwimInsights, Gophin's per-audience views, Mako parent emails, ASCA guidance, Commit (families see only their own child), British Swimming (video first, dashboard second).
11. **Use benchmarks with context and humility.** Use age and event standards and "how close to the next cut" (Gophin, Swimcloud, Commit, SwimInsights), and % to the qualifying time (World Aquatics Results Report). Plain-language elite references (Swimcloud: world-class 15 m under 6 s, seniors 6–7 s). Add caveats for juniors (swimstats.net).
12. **Anchor numbers in the video.** HUD overlay, tags on frames, voice-over and drawings (Mako); metrics overlaid on video (Sparta); video linked to results (Swimcloud, British Swimming Dartfish).
13. **State measurement precision and the source.** Swimlab's "honest precision labels", Swimcloud's "this value is an approximation", Arellano's limitations section, StrokeLab's AI disclaimer and coach review.
14. **Make it fast, persistent and portable.**
    - Fast: minutes on deck (PRSVision under 5 min, Sparta about 20–30 min) versus 24–48 h for services.
    - Persistent: stored on the swimmer profile beside training and progression (Mako, SwimInsights app).
    - Portable: a one-page PDF the athlete can pull, plus CSV/XLSX (Mako, MyRaceData, Commit, FFN).
    - Trend charts only with at least 4 swims, updated at season end (Swimcloud).

Mobile patterns: a stacked list of rows per length with a cumulative/subtracted toggle and expandable details (Swimcloud). Header KPI tiles (PRSVision, Mako). Landscape for video with HUD (Mako). Installable PWA (Gophin).

## 4. Common mistakes to avoid (with who does it)

1. **Unit and definition drift.** Yards vs metres in one report (OmniCoach sample). SPM vs CPM vs seconds per stroke: HyTek defines "stroke rate" as seconds per stroke (https://hytek.active.com/User_Guides_HTML/SwTM7/HTML/entersplits.htm). Fix: one unit system, plus a toggle and a tooltip (StrokeLab CPM/SPM).
2. **Internally inconsistent numbers in generated prose.** OmniCoach gives an average SR of 52 alongside a range of 84–126 and a turn artefact read as technique. SwimInsights gives two different final times. Fix: compute the facts, validate them (velocity ≈ DPS × SR/60, splits sum to the total), *then* template the text.
3. **Deltas against an unnamed or ambiguous reference**, or an all-zero placeholder delta (PRSVision mock). Always say which PB, race or benchmark, with the date.
4. **One race-average SR or DPS.** It hides the fade. Mako explicitly rejects one number for the whole swim.
5. **50 m official splits only for short-course pacing.** They mix turns (about 52% of SC time) with swimming. Use clean-swim and turn sections (FFN, research).
6. **Information overload.** Analyst-depth tables pushed to everyone. Only about a third of coaches want that depth, and Swimcloud advises a few key points per race.
7. **Undefined breakout or underwater metrics** that look like rule violations (the 15.47 m case needed explaining on SwimSwam).
8. **Hype or superlatives and generic labels** ("freshman 50", exclamation marks in OmniCoach). ASCA advises avoiding superlatives. Keep the tone factual and growth-oriented (SwimInsights reframes weakness as the next marginal gain).
9. **Technical critique shown to parents**, or parent messaging that contradicts the coach (ASCA). Gate parent content behind the coach.
10. **Trend lines from too few points or early-season swims** (Swimcloud's rules exist to prevent this).
11. **Implying causation from correlation or from a single race.** The AIS paper uses correlation only to direct attention. Label conclusions as "indicates" or "confirm next race".
12. **Advice that is not linked to the swimmer's own numbers.** Generic drill lists. Every action should cite the segment and Δ that triggered it.

## 5. Conclusion-sentence templates (coach language)

Use `{}` slots. They are written in PT-PT for the Aquastats UI, with English glosses. Every template carries **segment + Δ + reference + mechanism + action**, and none uses superlatives.

1. **Delta, cause, action.**
   `Perdeu {Δs} s ({Δ%}%) {segmento} face a {referência}: a frequência passou de {SR1} para {SR2} ciclos/min e a distância por ciclo de {DPS1} para {DPS2} m. Foco seguinte: {tarefa}.`
   EN: "Lost {Δ}s ({%}) in {segment} vs {reference}: rate {SR1}→{SR2}, DPS {DPS1}→{DPS2}. Next focus: {task}."
2. **Strength first, with a benchmark.**
   `Ponto forte: chegou aos 15 m em {t15} s, {Δ} s melhor que {referência} e {dentro/acima} da referência do escalão ({ref_escalão} s).`
3. **Pacing verdict.**
   `Passou aos {metade} m {Δ1} s mais rápido que o plano e perdeu {Δ2} s na segunda metade (diferença {FES-BES} s): a prova decidiu-se na gestão do ritmo, não na velocidade.`
4. **Same time, different story (vs PB).**
   `Em relação ao MP ({prova}, {data}), ganhou {Δv} s nas viragens e perdeu {Δn} s em nado limpo. O tempo final semelhante esconde duas tendências opostas.`
5. **Confidence-qualified.**
   `Indicativo (vídeo de bancada, precisão ±{p} s): a saída da coulée na {n}.ª viragem encurtou de {d1} m para {d2} m. Confirmar na próxima prova antes de alterar o treino.`
6. **Parent version (coach-approved).**
   `{Nome} fez {MP/não fez MP} ({Δ} s). Correu bem: {ponto_forte}. Vamos trabalhar: {um_foco}. Próxima meta: {marca/mínimo}, a {Δmeta} s.`

## 6. Direct implications for Aquastats (short)

- Persist a fixed segment model plus a glossary (FFN/AIS definitions). Every metric needs its unit and precision.
- Use one comparison component: values with inline Δ against a **named** reference (PB, previous race, target, benchmark), plus a cumulative-delta sparkline.
- Generate conclusions from validated numbers through templates (section 5), capped at 1–2 actions. Never let the LLM invent numbers.
- Offer three views from the same data:
  - Treinador: full table, columns per swimmer for squads.
  - Atleta: strength, 1–2 actions, video moment.
  - Encarregado de educação: PB, standards and progress only, coach-gated.
