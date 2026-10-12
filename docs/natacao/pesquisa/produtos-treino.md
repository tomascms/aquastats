# Competitive research: how swim and endurance products present TRAINING data

Date: 2026-10-12. Researcher stance: swim coach + product researcher, for Aquastats (PT-PT UI).
Method: web search + direct fetch of product pages, help centers, manuals, app-store listings, independent reviews.
Verbatim quotes are kept short (UI strings / short phrases). Everything else is paraphrased.

---

## 0. Access limits (read first)

| Source | Status |
|---|---|
| Reddit (r/Swimming, r/SwimmingCoach) | **Blocked** for this crawler (domain not accessible). No Reddit quotes in this report. |
| SwimSwam articles | Redirect to `tollbit.swimswam.com` → **HTTP 402**. Only search-engine snippets used (marked "snippet"). Many are sponsored ("courtesy of X, a SwimSwam partner"). |
| FORM help center (support.formswim.com) | **HTTP 403**. Used FORM blog, press release, DC Rainmaker, Slowtwitch instead. |
| WHOOP The Locker / help | **HTTP 403**. Used search snippets of WHOOP pages and podcast summaries. |
| Swim Smooth free-resources + Guru pages | **HTTP 404** on fetch; used search snippets + blog.swimsmooth.com. |
| YouTube descriptions | Not accessed. |
| App-store screenshot captions | Apple pages fetched for TritonWear, MySwimPro, Commit, Swimio: **no caption text exposed** (image-only). |
| Not found at all | "SwimAnalytics"/"Swim Analytics" as a product, "schoolfish", "Padlie", "SwimMate"/swimai.net (only a "Coming Soon" page at swimai.carrd.co), SwimCloud training logs, MySwimPro "Swim Score"/"Strength and Swim Score". |
| Sponsored bias | Most TritonWear, Commit and FORM press is vendor-sponsored. Independent sources used where possible (DC Rainmaker, Slowtwitch, the5krunner, peer-reviewed survey). |

---

## 1. Product-by-product findings

Fields: (1) metrics/units, (2) visual forms, (3) wording, (4) WHY/over-claiming, (5) coach vs athlete, (6) mobile, (7) reviews.

### 1.1 Commit Swimming / Commit Analytics (team workout software)
1. **Metrics**: volume parsed from typed workouts "by stroke, distance, and intensity"; intensity vocabulary is set per training group ("Rename the levels to your energy-system language"); "Line, set, and total duration summaries"; a "stress score" per workout (formula not public); attendance by athlete (attended, missed, %) and by workout. Yards or metres.
   - https://www.commitswimming.com/features/workout-builder
   - https://support.commitswimming.com/coaches/training/workout-writing-guide
   - https://support.commitswimming.com/coaches/reports/reports-guide
2. **Visuals**: dashboard graphs (from image alt text) "yards swum by week, stroke types, training types, intensity, and weekly stress scores"; report exports as PDF "Visual Report" and XLSX; per-swimmer individual reports. https://www.commitswimming.com/features/reports-analytics , reports guide above.
3. **Wording**: marketing-level only: "Spot trends and measure progress"; Workout Statistics = "volume, intensity, and training load from your workouts". No generated insight sentences found. https://www.commitswimming.com/solutions/training-reports
4. **WHY / over-claiming**: none — Commit reports descriptive totals, no causal claims. A coach testimonial credits the stress score for taper planning (snippet, sponsored SwimSwam https://swimswam.com/?p=379906).
5. **Coach vs athlete**: dashboard "for both coaches and athletes"; coaches can view per-athlete dashboards; athlete analysis accounts for "attendance and the exact sets that swimmer did" (App Store version notes https://apps.apple.com/us/app/commit-swimming-workouts/id1054029727 ; snippet https://www.commitswimming.com/product/workout-management).
6. **Mobile**: "Web & iPhone app workout writing"; separate deck app (workouts + attendance) vs team/parent app (https://support.commitswimming.com/parents/mobile/get-the-mobile-apps).
7. **Reviews** (App Store, 3.3/5, 19 ratings): "basically does one thing and it does it perfectly: track and analyze your swim workouts" vs "a bug fix ... seems to have broken the app". No test-set or "best average" feature documented anywhere I could access.

### 1.2 TritonWear (cap sensor + coach live dashboard + Triton Score)
1. **Metrics**: 30+ data points per lap; splits, stroke count, stroke rate, DPS, Stroke Index, turn time, time underwater/breakout, underwater speed (m/s), HR (with Polar Verity Sense); zones as pace /100 m (Z1 Recovery … Z5 Sprint shown on homepage); ACWR; RPE.
   - https://apps.apple.com/us/app/id1556135007 , https://www.tritonwear.com/
2. **Visuals**:
   - Live: per-swimmer **tile** with "4 distinct metrics, two for the lap and two for the rep" + Heart-Rate bar and Speed bar; card colour changes with current training zone; tap a swimmer → detail with **set tile → reps graph → laps-of-rep graph**; pick up to 2 metrics per graph (e.g. Time + DPS). https://support.tritonwear.com/switching-between-view-in-live-workouts?hsLang=en
   - Repeated test sets "overlaid on the same plot" to show improvement or stagnation. https://www.swimmingworldmagazine.com/news/tritonwear-set-of-the-week-mile-pace-set
   - Seasonal Tracker: weekly bars for volume, stroke types, training zones, work-to-rest ratio. Weekly Report: improvements in **blue**, areas needing work in **red**. https://support.tritonwear.com/weekly-reports-overview?hsLang=en , https://support.tritonwear.com/exploring-your-team-hub?hsLang=en
3. **Wording**:
   - Triton Score = Readiness + Focus + Intensity. Readiness → status "safe, overtraining, or undertraining" (snippet of sponsored "Mastering Triton Score" https://swimswam.com/mastering-triton-score/).
   - Team Hub member cards: latest score "< 65 will have a red circle"; "Scores between 65-75 are still not improving, so follow up"; >75 = training better than usual. Pending/missing-score/missing-rating markers. https://support.tritonwear.com/exploring-your-team-hub?hsLang=en
   - Weekly report load status: "training safely, overtraining, undertraining"; first week shows "Data Gathering".
   - App Store: "Identify when they're over or under training and safely bring them back to the sweet spot."
   - Homepage coach cue example: "Stroke length is dropping under fatigue."
4. **WHY / over-claiming**: scores are framed **relative to the athlete's own typical** load/execution/intensity; Focus compares to "previous bests or athletes like you" (speed + height matched); stroke scores unlock after 20 laps per stroke; recommends 4 weeks of tracking before goal-setting (snippets, sponsored https://swimswam.com/understanding-focus-comparisons/). Readiness depends on complete logging. Mentions non-training stress (school/work) as a factor (snippet).
5. **Coach vs athlete**: Weekly Reports/Analysis page **coach and admins only**; swimmers cannot access. Athletes can set score to "coach only" (hidden from teammates). Team activity cards average Triton Score across session.
6. **Mobile**: Live view works on phone and tablet (zoom tile = tablet only). Weekly reports **iPad/desktop only, "Not yet available on mobile phones"**. Reports auto-generated Sunday 06:00 EST.
7. **Reviews**: App Store 4.2 (5 ratings): "able to see all of my times and view anything that I am doing incorrectly" vs "Not only is the data flawed, the device itself is too much of a headache"; dev reply blames unit placement. Coach Brian Fazzino (snippet, SwimSwam https://swimswam.com/swim-data-deep-dive-with-new-canaan-ymca-coach-brian-fazzino/): swimmers not wearing/charging units "will throw off the metrics"; he does "not dive too much into the focus points".

### 1.3 FORM Smart Swim goggles (AR HUD + app + HeadCoach)
1. **Metrics**: pace (avg time per 100 m), SWOLF, stroke rate (spm; real-time only freestyle), DPS, HR, distance, lap time; "FORM Score" 0–100 from pace + stroke length (premium). https://apps.apple.com/app/id1321117442 (snippet), https://www.formswim.com/blogs/all/5-tips-for-learning-from-your-swimming-analytics
2. **Visuals**: workout drill-down "sets, then intervals, and finally lengths"; HR as thin red/pink line on charts (DC Rainmaker https://dcrainmaker.com/2024/04/smart-goggles-review.html). In-goggle: 2 lines of data, choose different metrics for swimming / after turns / rest (Triathlete review snippet).
3. **Wording**: HeadCoach 2.0: after each pool swim "a tailored piece of feedback" + "a focus area for their next session", and an in-goggle reminder next swim. Insights surfaced by goal ("Improve My Technique", "Prepare for a Race"), swimmer type and recent swims. No sample feedback text published. https://www.formswim.com/blogs/media/form-introduces-headcoach%E2%84%A2-2-0-expert-coaching-tailored-to-your-goals
4. **WHY / over-claiming**: blog explicitly says small split differences in broken race sets can be due to outside factors like poor sleep; rising SWOLF framed as possible fatigue; DPS vs stroke rate trade-off "with many exceptions". (FORM blog above.) One insight + one focus — deliberately minimal.
5. **Coach vs athlete**: athlete-first. No team coach portal found; sharing via link; coaches can push workouts via TrainingPeaks integration (https://forum.220triathlon.com/discussion/17560/new-form-trainingpeaks-workout-integration-launch).
6. **Mobile**: phone app is the hub; HUD is the "screen" during the swim.
7. **Reviews**: Slowtwitch long-term (2022): "just how bulletproof the system has been"; cons: membership cost, no syncing from other sources (https://www.slowtwitch.com/industry/long-term-review-form-swim/). Trustpilot complaints centre on subscription gating of real-time metrics (search summary of https://ch.trustpilot.com/review/www.formswim.com). DC Rainmaker: first length of each set often slightly short (wall-departure detection).

### 1.4 MySwimPro (athlete app, AI coach)
1. **Metrics**: per workout HR, strokes per lap, lap splits, SWOLF; per rep: rep split, avg HR, avg stroke count, "Average Lap Split", **avg pace per 50 and per 100**, per-length stroke count and lap time. Lap times exclude underwater after push-off (rep split − Σ laps = underwater). https://blog.myswimpro.com/2022/12/13/understanding-your-myswimpro-swimming-analytics/
2. **Visuals**: per-workout and per-set graphs with **min / max / avg** under each; "Review Splits by Set"; each graph has a "Why it Matters" explainer. Trends tab (Mar 2026): distance, duration, avg workout distance/duration, freestyle pace /100 m, freestyle SWOLF; Week/Month/Year toggle. https://support.myswimpro.com/en/articles/13586885-introducing-the-new-trends-tab
3. **Wording**: reflective, not prescriptive: "review these analytics after every swim and reflect on how you felt in the water." Test sets: Coach tier "will notify you when it's time to swim a Test Set and track your performance over time" (search snippet of blog https://blog.myswimpro.com/?p=4653). Post-workout difficulty rating feeds next workouts (third-party showcase https://screensdesign.com/showcase/myswimpro-1-swim-workout-app).
4. **WHY**: no physiology causal claims found.
5. **Coach vs athlete**: athlete only.
6. **Mobile**: phone + watch native.
7. **Reviews** (App Store 4.5, 5.9K): "pushes you but never has unreasonably high expectations"; complaints: watch sync bugs; "designed for interval training not lap swimming". https://apps.apple.com/us/app/myswimpro-swim-workout-app/id994386450
   - "Swim Score" / "Strength and Swim Score": **not found** in any public MySwimPro source.

### 1.5 Swim.com
- Only third-party review snippets: analysis "broken down by intervals, or lengths", weekly/monthly/annual goals, local leaderboards, users can correct lap counts and wrong stroke detection (https://tostracker.app/document/swim ; https://www.gowod.app/blog/best-swimming-apps-for-performance-tracking-and-recovery). Notable: **editable data** is praised.

### 1.6 Garmin (watch + Garmin Connect)
1. **Swim metrics**: lengths, intervals ("a new interval starts after a rest"), auto-rest after >15 s, SWOLF, stroke type per length, pace /100, drill log; **CSS** "expressed as a pace per 100 meters", "the theoretical speed you can maintain continuously without exhaustion"; CSS can be tested or typed in. https://www8.garmin.com/manuals/webhelp/forerunner945/EN-US/GUID-F9FFE0BF-ED46-40D4-A562-92F1CB4C3650.html ; pool swim manual pages listed in search.
2. **Visuals**: Training Readiness score with colour bands (purple/blue/green/orange/red), 30-day trend, six factor breakdown (the5krunner https://the5krunner.com/garmin-features/training/training-readiness). Training status, load focus bars, acute load.
3. **Wording** (official):
   - Training Readiness bands: Prime "Best possible", High "Ready for challenges", Moderate "Good to go", Low "Time to slow down", Poor "Let your body recover". Factors: sleep score, recovery time, HRV status, acute load, 3-night sleep history, 3-day stress history. https://www8.garmin.com/manuals/webhelp/GUID-31D23DBB-57C2-4DF7-A0C9-8D1A00AB4BE7/EN-US/GUID-C21BE0C8-A08E-4DA1-B6C6-2E0E2DDDB372.html
   - Training Status (each state = diagnosis + suggestion): e.g. Maintaining → "try adding more variety ... or increasing your training volume"; Peaking → "can only be maintained for a short time"; Overreaching → "Your body needs a rest"; Unproductive → "focusing on rest, nutrition, and stress management". https://www8.garmin.com/manuals/webhelp/fenix66s6xpro/EN-US/GUID-6F81BF5B-B49A-4506-95E2-0F4A04D8B319.html
   - Training Effect aerobic scale: 2.0–2.9 "Maintains", 3.0–3.9 "Impacts", 4.0–4.9 "Highly impacts", 5.0 overreaching. https://www8.garmin.com/manuals/webhelp/GUID-0F89E6A5-EC1C-4382-964E-27DC4B5FC932/EN-US/GUID-7275629E-743A-4658-A284-C84F42A66AE5.html
   - Load Focus: "Shortage" labels per intensity + advice ("Try increasing the duration or frequency"). https://www8.garmin.com/manuals/webhelp/GUID-3D8FCD7B-7C56-43A9-8665-5CDE4FFD7DF3/EN-US/GUID-C3205D96-DAB6-4C93-A225-5B8D7B5A5621.html
4. **WHY / over-claiming**: Readiness lists its inputs; "No Status" until enough data. Weakness for swimmers: status needs VO2max from run/bike, so pure swimmers often see "no status"; pool wrist-HR unreliable (Garmin forum https://forums.garmin.com/sports-fitness/running-multisport/f/forerunner-745/254738/training-status-for-swimming ; Slowtwitch https://forum.slowtwitch.com/t/garmin-945-swimming-wrist-hr/782522). the5krunner: no published validation; score "sets context ... does not prescribe exact effort".
5. **Coach vs athlete**: athlete product.
6. **Mobile**: watch-first glance (Morning Report on wake).
7. **Complaints**: swim intervals not editable in Connect; pace display wrong after edits; per-length splits missing in Android app (forum threads in search results above).

### 1.7 Apple Watch / Fitness (watchOS 11+)
1. **Swim**: Pool Swim auto-sets (swim vs rest), splits, stroke type, SWOLF per set behind "Show More"; per-set pace only on iPhone summary. https://support.apple.com/en-us/HT209393 (search summary)
2. **Training Load**: effort (1–10) × duration; 7-day vs 28-day: "well below / below / steady / above / well above"; 28-day baseline drawn as **white line**, 7-day as coloured line. https://support.apple.com/guide/watch/apde4c07a6cf
3. **Wording**: Apple's guide: helps you "understand the relative strain on your body and decide whether it's sustainable" (paraphrase-level, search summary). Vitals: out-of-range metric gets a pink marker; two out-of-range together → notification that "something bigger might be at play" (DC Rainmaker).
4. **Over-claiming**: effort is editable retroactively; needs 28 days; no backfill. DC Rainmaker critique: hides exact baseline/number → "far too nebulous to use"; auto effort "keeps giving me a '7'". https://dcrainmaker.com/2024/07/apples-training-load-vitals-watchos11.html

### 1.8 Polar
- **Cardio Load Status** = Strain (7-day avg) / Tolerance (28-day avg); states Detraining / Maintaining / Productive / Overreaching (+ newer "Recovering"). Estimates flagged with `*` until baseline exists ("you'll see an estimate (indicated with*)"). https://support.polar.com/en/training-load-pro
- **Calibration change worth copying**: Polar admitted old logic hit "Overreaching" too quickly (e.g. beginners) and now shows "Productive"; shows "Recovering" instead of "Detraining" after a recent overreach. https://support.polar.com/en/updated-cardio-load-status-in-the-flow-app-and-web-service
- **Nightly Recharge**: very poor → very good scale; ANS charge −10…+10 around personal 4-week baseline; daily exercise tip (take it easy vs go for it), sleep tip when sleep worse than usual, energy tip on rough days. https://support.polar.com/en/nightly-recharge-recovery-measurement

### 1.9 COROS (EvoLab)
- Training Load per session (Low/Medium/High personalised), Load Impact (7-day), Base Fitness (42-day), Fatigue, **Intensity Trend** % zones: Excessive ≥150, Optimized 100–149, Maintaining 80–99, Resuming/Performance 50–79, Decreasing 0–49; taper explicitly framed as moving Optimized → Performance zone. https://coros.com/stories/coros-metrics/c/training-load , https://support.coros.com/hc/en-us/articles/4410520934676-EvoLab
- Swim handled only via HR; no swim-specific load model documented.

### 1.10 TrainingPeaks
1. **Metrics**: sTSS = IF³ × hours × 100, IF = normalized swim speed / threshold pace (rest removed) — "always an estimate" (https://www.trainingpeaks.com/learn/articles/calculating-swimming-tss-score/). Swim zones as % of T-pace (https://www.trainingpeaks.com/learn/articles/how-to-best-calculate-swim-zones-in-trainingpeaks/).
2. **Visuals**: Performance Management Chart: Fitness (CTL, 42-day EWA), Fatigue (ATL, 7-day), **Form = Fitness − Fatigue (yellow line)**, daily TSS as red dots. https://www.trainingpeaks.com/learn/articles/what-is-the-performance-management-chart/
   - **Compliance colours** (plan vs actual): green ±20 %, yellow 50–79 % / 121–150 %, orange >50 % off, red not completed, grey unplanned; mobile = colour strip on left edge of card; indicator shows which metric (TSS/duration/distance) and over/under. https://help.trainingpeaks.com/hc/en-us/articles/204861204
3. **Wording**: "A negative Form would indicate that you are carrying a lot of fatigue"; rule of thumb "slightly negative up to positive 25".
4. **Over-claiming guards**: "There is no single Form that works for every athlete"; "Just because you are fit does not mean that you are ready to race"; help center warns colour alone can mislead (green recovery ride that became a 3-hour ride) → open Quick View.
5. **Coach vs athlete**: Coach Home = per-group list "to see who needs immediate attention", compliance dots for last 7 days, feed of peak performances / unusual metrics / athlete comments; click athlete → fitness, fatigue, form + private notes. https://www.trainingpeaks.com/blog/announcing-the-new-home-view-for-coaches/

### 1.11 intervals.icu (bonus; widely used free PMC)
- Form zones on fitness chart: Transition, Fresh, Grey, Optimal, High risk; community stresses "It's just a mathematical model". https://forum.intervals.icu/t/zones-of-form-in-fitness-chart/3623 , https://forum.intervals.icu/t/grey-zone-is-optimal/114395

### 1.12 WHOOP
- Recovery 0–100 % in green/yellow/red; green "primed to perform", red "Rest is likely what your body needs" with listed possible causes (overtraining, sickness, stress, lack of sleep). Inputs HRV (dominant), RHR, sleep performance, respiratory rate (+ SpO2, skin temp on 4.0). Colours described by WHOOP's own scientist as "a simplification layered on top of a continuous scale". "There is no single 'correct' Recovery score". Recovery greyed out for first 4 days (calibration). Strain Target adapts to recovery with goal options (recover / maintain / push). Training zones: Optimal / Overreaching / Restoring. All from search snippets of https://www.whoop.com/thelocker/how-does-whoop-recovery-work-101 , https://www.whoop.com/thelocker/podcast-40-whoop-recovery-maximize-readiness/ , https://www.whoop.com/thelocker/strain-coach/ (direct fetch blocked).

### 1.13 Oura (best "explain a bad day" pattern)
- Bands: 85+ "Optimal, you're ready for action!", 70–84 "Good, you've recovered well enough.", <70 "Pay attention, you're not fully recovered."
- **Each contributor phrased as a plain question**, e.g. Sleep Balance "Have I been getting enough sleep in the last 2 weeks?"; Activity Balance "How much load is my body under from my recent activity levels?"; RHR "Was my RHR substantially higher or lower than usual?". Red bar + "pay attention" only on the problem contributor.
- Hedging: possible causes listed (illness, irregular sleep, alcohol, stress); "Some variation in your Readiness Score is a good thing"; hard training can cause a temporary dip; a single low HRV day matters less than the long-term average; Rest Mode mutes scores when ill.
- https://ouraring.com/blog/readiness-score/ , https://support.ouraring.com/hc/en-us/articles/360025589793-Readiness-Score

### 1.14 Swim Smooth (CSS, Red Mist, Guru)
- CSS = aerobic threshold pace /100 m, retested; sets prescribed as **CSS ± s/100 m** (e.g. Red Mist 10×400: 4 @ CSS+6, 3 @ +5, 2 @ +4, 1 @ +3). Red Mist used to *validate* a CSS result within 5 days. https://swimsmooth.com/free-resources/2012/07/red-mist-set.html (snippet), https://www.swimsmooth.com/free-resources/2016/10/validating-css-test-using-red-mist.html (snippet)
- Pacing language: amateurs "vary by several seconds and fade as the session progresses"; elites hold 100 splits "within half a second". https://blog.swimsmooth.com/p/get-your-pace-right
- Guru Fitness, Fatigue & Form chart on sTSS anchored to CSS; rough guide easy ≈40 sTSS, tough 70–80, >100 = fatigue for several days; **trend direction matters more than the numbers, which are arbitrary; model is an approximation** (snippets of https://swimsmooth.com/guru-features/fitness-tracker and blog posts; direct fetch 404).

### 1.15 Phlex (goggle HR sensor + PRO coach dashboard)
- Metric groups: Basic (HR, lap time, splits), Individualized (**readiness score, training zones, fitness tests, technique progress, stroke efficiency, training effect**), Stroke (DPS, stroke rate, stroke index), **Sets (set recognition, set-specific HR, set breakdown, drill detection, interval detection)**. Zones from automated fitness testing (max HR + speed per HR zone). PRO dashboard "at-a-glance view into the teams' performance". https://www.phlexswim.com/ , https://www.swimmingworldmagazine.com/news/phlex-partners-with-polar-electro-offers-swimmers-cutting-edge-data-feedback-in-training-and-competition/ (May 2023)
- User testimonial: "breaks down the sets and gives me times for each part of the workout." Early forum: "still very quirky", sync issues (https://forum.slowtwitch.com/t/phlex-edge-first-impression/786999).

### 1.16 Swimio (2025–26 Apple Watch AI coach)
- Release note 1.21.0: "reads your readiness, training load and consistency across the last 28 days, and shapes what it suggests next"; "personalized coaching feedback after every completed swim". https://apps.apple.com/us/app/swimio-ai-swim-coach/id6749207394 . No reviews yet.

### 1.17 Team admin tools: Hy-Tek Team Manager, TeamUnify/OnDeck, SwimTopia, SwimOffice
- **Hy-Tek**: "Record the results of any test set ... such as 5 x 100 on 5 minutes", "Record heart rate and comments with each test set", "Generate test set and training pace reports", T-30 test to predict training paces; reports: "weekly yardage, attendance percentages, energy system percentages"; yardage report in 5-week blocks with weekly totals + weekly average; attendance codes (sick/absent lower %, bonus can exceed 100 %). https://hytek.active.com/swimming-management-software.html , https://hytek.active.com/User_Guides_HTML/SwTM8/HTML/attendancereports.htm , https://hytek.active.com/User_Guides_HTML/SwTM8/HTML/recordingattendanceandyarda.htm
- **TeamUnify/OnDeck**: attendance % or count toggle over a date range; distance toggle yards/metres; coach note icon per practice (club guides, e.g. https://www.gomotionapp.com/reccalmgssd/UserFiles/File/ondeck-app-parent-instructions_012413.pdf).
- **SwimTopia**: no practice attendance/yardage analytics found (meet + comms tool).
- **SwimOffice Pro** testimonial (snippet): kids "love test sets" when they "see their average times and individual times immediately after practice" (https://swimswam.com/one-tool-every-swim-coach-must/, 402 on fetch).

### 1.18 Strava, SwimCloud, Finzy
- **Strava**: no length-level pool analysis; long-standing complaint that pace used elapsed time incl. rest (https://forum.slowtwitch.com/t/strava-swim-pace-calculation/648645). Relative Effort works for swims only with HR.
- **SwimCloud**: no training-log feature documented publicly (results-focused).
- **Finzy Swimlog** (bonus): squad overview with "weekly logging compliance" and "swimmers requiring attention based on training patterns" (https://www.getapp.com/all-software/a/finzy-swimlog/).

### 1.19 What coaches actually monitor (evidence)
- Barry et al., 2022, *Physical Therapy in Sport* 53:51–59 (n=31 swim practitioners): **swim volume 96 %, session-RPE 92 %**, wellness monitoring prominent; 81 % combine internal + external load; barriers = engagement, resources, system usability; recommend sRPE as the one metric that spans pool, dryland and competition. https://lida.sport-iat.de/ta/Record/4083021
- Swimming World (Tech Tuesday) warns of information overload and that data misses context (school exams, conflicts, late nights). https://swimmingworldmagazine.com/news/the-relationship-between-swimming-and-wearable-technology-how-much-do-we-need-it

---

## 2. Cross-product patterns

| Pattern | Who does it | Note |
|---|---|---|
| Score + one-line verdict | Garmin readiness, Oura, WHOOP, Polar | Verdict is an action ("Time to slow down"), not a diagnosis |
| Contributors list with only the abnormal one flagged | Oura, Garmin readiness, WHOOP | Oura phrases each contributor as a question |
| Short (7 d) vs long (28/42 d) load, ratio labelled in words | Apple, Polar, COROS, TrainingPeaks, Garmin | Labels: below/steady/above; productive/maintaining/overreaching |
| Data-sufficiency state | TritonWear "Data Gathering", Polar `*`, Garmin "No Status", WHOOP greyed 4 days, Apple 28 d | Never show a fake number |
| Drill-down session → set → rep → length | FORM, MySwimPro, TritonWear, Garmin, Apple | MySwimPro shows min/max/avg under every graph |
| Pace targets as CSS ± s/100 | Swim Smooth, Garmin CSS, TritonWear zones /100 m | Coaches think in /100 and per-rep times |
| Plan vs actual colours | TrainingPeaks (±20 % green…) | Plus "which metric" indicator and over/under arrow |
| Repeat test sets overlaid | TritonWear, Hy-Tek, MySwimPro, DuoSwim | Best average + individual times right after practice |
| Coach triage list | TrainingPeaks Home, TritonWear Team Hub, Finzy | Red <65 / follow-up 65–75 / missing data markers; sort by worst |
| One insight + one focus for athlete | FORM HeadCoach, Swimio | Coach-like brevity |
| Weekly auto digest for coach | TritonWear Sunday report | Blue = improved, red = needs work |
| Editable inputs | Apple effort, Swim.com laps | Garmin's non-editable intervals is a complaint |

---

## 3. Best practices (synthesis, 15)

1. **Verdict first, number second, context third.** One sentence in coach language ("Faded in the second half"), then the supporting numbers, then the explanation. (Garmin readiness, Oura bands, FORM HeadCoach.)
2. **Always compare to the athlete's own baseline and name the window** ("vs last 4 times this set", "7 d vs 28 d"). Show the baseline value, not only a label — Apple is criticised for hiding it.
3. **Per-rep times and pace /100 side by side**; per-length only on drill-down. Coaches read rep splits; swimmers read pace /100. Show min/max/avg under each set (MySwimPro).
4. **Express targets in the coach's own currency**: per-rep target time or CSS ± s/100, and show delta per rep (+0.8 s / −0.4 s), not % of speed.
5. **Fade/consistency as two simple numbers**: second half vs first half (s) and spread (best–worst, or CV %). Use Swim Smooth's framing: "held within X s" vs "faded Y s".
6. **Test sets are first-class objects**: same set repeated, overlaid on one plot, "best average" + individual reps shown immediately after practice; mark new bests. (TritonWear, Hy-Tek, SwimOffice.)
7. **Load = what coaches already use**: weekly volume (by stroke / intensity / energy system) + session-RPE load; ratio 7 d / 28 d with word labels. Don't invent opaque composite scores first (Barry 2022; Commit, Hy-Tek).
8. **Explain a bad day with contributors, not conclusions**: list 1–3 contributors that were out of the athlete's normal (sleep, recent load, missed sessions, wellness), each with its value vs normal; use "may / likely / consistent with". (Oura, Garmin, WHOOP.)
9. **One day ≠ trend**: say so explicitly and suggest watching the next session before changing the plan (Oura HRV balance, Swim Smooth "trend matters more", TrainingPeaks "tell a story").
10. **Data-sufficiency states are honest UI**: "A recolher dados (2 de 4 sessões)" instead of a number; mark estimates (Polar `*`). Thresholds must not fire too early for new athletes (Polar's Overreaching fix).
11. **Separate the three time scales**: today (readiness/wellness), this session (set analysis/training effect), the block (load trend/status). Garmin keeps Readiness, Effect, Status as separate cards.
12. **Every state label carries an action** (Garmin Training Status: diagnosis + what to do; Load Focus "shortage → add X").
13. **Coach view = triage; athlete view = progress + one focus.** Coach: roster sorted by "needs attention", red/amber markers, missing-data markers, weekly digest. Athlete: own trend, PB/best-average badges, one focus for next session. Allow "coach-only" visibility for sensitive scores (TritonWear).
14. **Plan-vs-actual compliance colours with a legend and the metric named** (TrainingPeaks bands), plus a guard: colour never replaces the numbers.
15. **Mobile-first glanceable cards; heavy analysis on tablet/desktop.** Live/deck: one tile per swimmer with ≤4 numbers; post-session phone: summary card + expandable set table; weekly report: tablet/desktop. Let users correct inputs (rep times, RPE) — sensors and stopwatches miscount.

## 4. Common mistakes to avoid

- **Hiding the numbers behind labels** ("Above" without the baseline) — Apple critique.
- **Black-box composites** without decomposition (FORM Score, early Triton Score coverage): coaches can't act on them.
- **Over-claiming causality** from weak signals: wrist HR in the pool, single night of sleep, single session. Pure swimmers on Garmin get "No Status" — don't pretend.
- **Pace on elapsed time incl. rest** (Strava) — always split swim time vs rest.
- **False alarms for beginners / after breaks** (Polar's "Overreaching too quickly").
- **Colour-only compliance** that hides a wrong session (TrainingPeaks' own warning).
- **Too much data for swimmers**: coaches report swimmers ignore focus points; show swimmers less than coaches (Fazzino; Swimming World).
- **Non-editable records** (Garmin intervals) — coaches need to fix a mistimed rep.
- **Missing-data blindness**: uncharged sensors or unlogged sessions silently distort load; show "missing" explicitly (TritonWear's missing-score marker).
- **Paywalling the core insight** (FORM review backlash) — keep basic set analysis free/standard.
- **Population comparisons without context** ("like me" peers) — keep them secondary to own-history comparisons.
- **Weekly reports not readable on phone** (TritonWear limitation) — at least a phone summary.

## 5. Insight-sentence templates (coach language, EN + PT-PT)

Placeholders in `{}`. Each template = verdict + evidence + (hedged) reason + suggestion. Show only when data sufficiency is met; otherwise use template 8.

1. **Set fade**
   - EN: "Faded in the second half: reps {k+1}–{n} averaged {t2} vs {t1} in reps 1–{k} (+{Δ} s). {Stroke rate held / DPS dropped} — looks like fatigue rather than pacing."
   - PT: "Quebrou na segunda metade: repetições {k+1}–{n} com média {t2} vs {t1} nas 1–{k} (+{Δ} s). {Frequência manteve-se / distância por braçada caiu} — parece fadiga, não ritmo."

2. **Faster than target**
   - EN: "All {n}×{d} under target ({T}): average {avg}, best {best}, spread {s} s. Ready to tighten the target to {T−1}?"
   - PT: "Todas as {n}×{d} abaixo do alvo ({T}): média {avg}, melhor {best}, dispersão {s} s. Pronto para apertar o alvo para {T−1}?"

3. **Bad day explained by sleep / load (hedged)**
   - EN: "Slower than usual on this set (+{Δ}/100 vs last {k} times). Possible contributors: {sleep h} h sleep reported (usual {u} h) and 7-day load {p}% above the 4-week average. One session only — check the next one before changing the plan."
   - PT: "Mais lento do que o habitual nesta série (+{Δ}/100 vs últimas {k} vezes). Possíveis fatores: {h} h de sono registadas (habitual {u} h) e carga dos últimos 7 dias {p}% acima da média de 4 semanas. É só uma sessão — confirmar na próxima antes de mudar o plano."

4. **Taper response**
   - EN: "Taper week {w}: load −{p}% vs build. Race-pace {d}s are {Δ} s faster than at the start of the taper with the same stroke count — responding as expected."
   - PT: "Semana {w} de taper (afinação): carga −{p}% vs fase de construção. Os {d} a ritmo de prova estão {Δ} s mais rápidos do que no início do taper, com o mesmo n.º de braçadas — está a responder como esperado."

5. **Load response (positive / flat)**
   - EN (+): "After {w} weeks at +{p}% volume, test-set average improved {a1} → {a2} ({Δ} s). The extra load is being absorbed."
   - EN (flat): "Volume +{p}% for {w} weeks, but test-set times are flat and session RPE is up {r} points. Consider a lighter week."
   - PT (+): "Após {w} semanas com +{p}% de volume, a média da série de controlo melhorou {a1} → {a2} ({Δ} s). A carga extra está a ser assimilada."
   - PT (estável): "Volume +{p}% há {w} semanas, mas os tempos da série de controlo não mexem e o PSE da sessão subiu {r} pontos. Ponderar uma semana mais leve."

6. **Consistency**
   - EN: "Most even set this month: {n}×{d} within {s} s (best–worst). Four weeks ago the same set spread {s0} s — pacing control is improving."
   - PT: "Série mais regular do mês: {n}×{d} dentro de {s} s (melhor–pior). Há 4 semanas a mesma série variou {s0} s — o controlo de ritmo está a melhorar."

7. **Test set / best average progress**
   - EN: "Best average on {n}×{d} @ {int}: {avg} — {Δ} s better than {date}. New best for this test."
   - PT: "Melhor média em {n}×{d} @ {int}: {avg} — {Δ} s melhor do que em {data}. Novo melhor registo nesta série de controlo."

8. **Insufficient data / attendance context (honesty template)**
   - EN: "Not enough comparable sessions yet ({k} of {m}) — showing raw times only." / "Missed {x} of the last {y} sessions; the drop is more likely the gap than fatigue."
   - PT: "Ainda sem sessões comparáveis suficientes ({k} de {m}) — mostramos só os tempos." / "Faltou a {x} das últimas {y} sessões; a quebra deve-se mais provavelmente à paragem do que a fadiga."

Wording rules derived: use "possível / provável / parece" for causes; never "porque" for physiology unless measured; cite the comparison window; end with a suggested action or "confirmar na próxima"; keep swimmer-facing text to verdict + one focus.
