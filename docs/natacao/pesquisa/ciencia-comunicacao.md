# Presenting swim data to coaches and swimmers: evidence and rules for Aquastats

Audience: coaches without data training, swimmers aged 12–25 (and their parents), on phones at the pool. UI in PT-PT.
Date of research: 2026-10-12.

**How sure each claim is** (tag after every source and rule):
- **[V]** = checked against the full text, or against a substantive section of it.
- **[A]** = checked against the abstract or bibliographic metadata only.
- **[M]** = from memory or a secondary source. Not checked against the original. Confirm before quoting.

---

## 1. Source notes

### Reporting and visualisation for coaches
1. **Buchheit M. "Want to see my report, coach? Sport science reporting in the real world." Aspetar Sports Med J 2017;6 (Feb 2017, "Straight Science").** https://journal.aspetar.com/en/journals/volume-6-targeted-topic-straight-science/want-to-see-my-report-coach **[V]** (web text). Page numbers are not shown online. [M]: pp. 36–43.
   - Pick variables that are valid, reliable and *useful for decisions*: "important" beats "interesting". Base the choice on the questions coaches actually ask.
   - Drop p-values and judge changes against the SWC. 1×, 3×, 6× and 10× SWC are small, moderate, large and very large.
   - Show error: typical error (TE) bars for individual values, CIs for group means.
   - Visuals should be "simple but powerful":
     - only a few variables;
     - no extra decimals;
     - horizontal text;
     - values labelled directly on the chart;
     - meaningful changes highlighted (for example with Excel conditional formatting).
   - Team mean ± SD can be a shaded band, with the individual shown against it.
   - Translate statistics into plain language, for example "very likely increased his sprinting speed".
   - Match the format to the coach (visual or verbal, table or graph). A report left on a desk has no impact; the conversation is what makes it work.
   - **Not in this text:** traffic-light colour rules, a "3 questions coaches ask" list, and report timing. I could not trace the "3 questions" framing to a Buchheit source **[unverified]**.
2. **Buchheit M. "Houston, we still have a problem." IJSPP 2017;12(8):1111–1114. doi:10.1123/ijspp.2017-0422** **[A]** (Crossref abstract).
   - Uses Apollo 13 as a metaphor: academic research is disconnected from elite practice.
   - Calls for:
     - short, faster papers;
     - simplified coach-facing versions;
     - free downloads and social media;
     - "evidence-led" or "informed practice" that puts context above simple conclusions.
   - It is about the research-to-practice gap, not visual design.
3. **Buchheit M. "The numbers will love you back in return—I promise." IJSPP 2016;11(4):551–554. doi:10.1123/ijspp.2016-0214** **[A]**.
   - Argues for magnitude-based thinking over p-values, citing its value for individual change, data visualisation and acknowledging trivial effects.
   - Define the smallest important effect up front.
4. **Thornton HR, Delaney JA, Duthie GM, Dascombe BJ. "Developing athlete monitoring systems in team sports: data analysis and visualization." IJSPP 2019;14(6):698–705. doi:10.1123/ijspp.2018-0169** **[A]** (paywalled; the full text could not be opened).
   - The abstract says monitoring needs analysis that allows "rapid reporting of simple and scientifically valid feedback".
   - It covers data-collection factors, meaningful-change methods and visualisation approaches.
   - Communicating to coaches is the basis of a working system.
   - **Not checked:** the paper's specific visual rules (rolling average vs EWMA, chart types to avoid).
5. **Robertson S, Bartlett JD, Gastin PB. "Red, amber, or green? Athlete monitoring in team sport: the need for decision-support systems." IJSPP 2017;12(Suppl 2):73–79. doi:10.1123/ijspp.2016-0541.** Accepted manuscript: https://vuir.vu.edu.au/33497/ **[V]** (full text read).
   - Traffic-light meaning: green = carry on as normal; amber = caution; red = action needed.
   - Traffic lights are popular for their speed and visual appeal, but there is little evidence for them and no standard way of building them. Thresholds and their validation are often unclear.
   - They *explain* outcomes after the fact; they do not *predict* injury or performance. Injury-based systems tend to be over-conservative, so athletes miss sessions they could have trained.
   - Coaches "are typically not statistically trained". Decisions are made 1–2 h before training, so outputs must be quick to read and may need converting (z-scores, % change).
   - % change can blow up when values are close to zero or highly variable.
   - Weekly-load means **and variances** differ a lot between athletes, so thresholds must be **individual**.
   - Their worked example uses <0.3×CV = green, 0.3–0.9×CV = amber, 0.9–1.6×CV = red, but they say plainly that it is "only one example". Thresholds built from SD and from CV flag different weeks.
   - Show individuals as well as group means (Weissgerber 2015).
   - Use colour coding, conditional formatting and flags for outliers and trends.
   - Reduce the data (drop redundant metrics, keep the parsimonious set), weigh athlete and staff burden, and train coaches.
6. **Bailey C. "Longitudinal monitoring of athletes: statistical issues and best practices." J Sci Sport Exerc 2019. doi:10.1007/s42978-019-00042-4** **[A, snippet only]**. Covers clarity, simplicity and distortion in visuals, plus reliability and validity.
7. **Ward P, Windt J, Kempton T. "Business intelligence: how sport scientists can support organization decision making in professional sport." IJSPP 2019;14(4):544–546** **[A]**. Three pillars: data collection and structure; analysis; presentation.

### Statistics for individual change
8. **Hopkins WG. "How to interpret changes in an athletic performance test." Sportscience 2004;8:1–7.** https://www.sportsci.org/jour/04/wghtests.htm **[V]** (summary page).
   - Noise is the typical error. In most tests, noise is bigger than the SWC.
   - **SWC for an individual's competitive performance is 0.3 × the athlete's competition-to-competition variability.** The 2011 update changed this from 0.5×.
   - The team-sport default is 0.2 × between-athlete SD.
   - Report the chances that a change is beneficial, trivial or harmful, or use rule-based categories. Partly discount implausibly large changes.
9. **Hopkins WG, Marshall SW, Batterham AM, Hanin J. "Progressive statistics for studies in sports medicine and exercise science." MSSE 2009;41(1):3–12. doi:10.1249/MSS.0b013e31818cb278**. Free version: https://www.sportsci.org/2009/prostats.htm **[V]**.
   - Standardised thresholds: 0.2, 0.6, 1.2, 2.0, 4.0.
   - Thresholds for an individual's competitive performance are 0.3, 0.9, 1.6, 2.5 and 4.0 × within-athlete variability. They correspond to an extra medal in 1, 3, 5, 7 and 9 of every 10 competitions.
   - Words for probabilities:

     | Chance | Term |
     |---|---|
     | <0.5% | most unlikely |
     | 0.5–5% | very unlikely |
     | 5–25% | unlikely |
     | 25–75% | possibly |
     | 75–95% | likely |
     | 95–99.5% | very likely |
     | >99.5% | most likely |

   - Uncertainty can also be phrased in words, e.g. "unlikely to have a small beneficial effect", or as magnitude ranges such as "trivial–moderate".
   - An effect whose CI spans substantial positive and negative values is "unclear".
10. **Hopkins WG. "A spreadsheet for monitoring an individual's changes and trend." Sportscience 2017;21:5–9.** https://sportsci.org/2017/wghtrend.htm **[V]** (web text).
    - Compare each test with a reference test or the mean of several tests, not only with the previous test.
    - **"Unusual" change with no SWC:** a change larger than about 2.0 × TE. This still produces false "unusual" flags 10% of the time in each direction when nothing has changed.
    - **Averaging n repeats:** TE becomes TE/√n.
    - **Estimating an individual's TE:** use the standard error of estimate of a trend fitted to **≥10 consecutive tests**. Alternatively, pool other athletes' values (average the squared errors, weighted by df) or use published variability inflated by about 1.3.
    - Suggests reading Buchheit 2018, "Magnitudes matter more than beetroot juice", Sport Perf Sci Reports 1. The PDF could not be read **[unverified]**.
11. **Swinton PA, Hemingway BS, Saunders B, Gualano B, Dolan E. "A statistical framework to interpret individual response to intervention." Front Nutr 2018;5:41. doi:10.3389/fnut.2018.00041** (PMC5985399) **[V]**.
    - True-score CI: observed ± z·TE.
    - Individual change CI: Δ ± z·√2·TE. Δ ± TE is roughly a 50% CI.
    - Count a change as meaningful only if the whole interval lies beyond the SWC.
    - TE can come from a CV: TE = CV × score / 100.
    - Reliability samples of about 30 or more are much better than 6–12.
    - Caution: the paper's text is internally inconsistent (/2 vs /√2). Use the standard TE = SD(diff)/√2.
12. **Sainani KL. "The problem with 'magnitude-based inference'." MSSE 2018;50(10):2166–2176. doi:10.1249/MSS.0000000000001645** **[A]**. MBI's probability labels have inflated error rates and are disputed as *formal inference*.
    - Implication for the app: use the labels as conservative *descriptive* confidence wording for one swimmer's monitoring. Never present them as exact probabilities.
13. **Hopkins WG. "Measures of reliability in sports medicine and science." Sports Med 2000;30:1–15. doi:10.2165/00007256-200030010-00001** **[M]**. This is the standard reference for TE = SD(diff)/√2 and for log-transforming to get a CV.

### Swimming variability, tests and load
14. **Stewart AM, Hopkins WG. "Consistency of swimming performance within and between competitions." MSSE 2000;32(5):997–1001** **[A]**. Sample: 532 junior and open national swimmers.
    - Same event at two meets 20 days apart: **typical variation 1.4%** (95% range 1.3–1.5).
    - Faster swimmers vary **1.1%**, slower swimmers **1.5%**.
    - Across distances within a stroke: 1.7%. Across strokes: 2.7%.
    - A 0.5% change can alter placings among top juniors.
15. **Pyne D, Trewin C, Hopkins W. "Progression and variability of competitive performance of Olympic swimmers." J Sports Sci 2004;22(7):613–620. doi:10.1080/02640410310001655822** **[A]**. Sample: 676 swims by 51 Olympians.
    - Within-athlete CV: **0.6% within a meet**, **0.8% between meets**.
    - Their SWC was 0.4%, using the *older* 0.5×CV rule. Under 0.3×CV it would be about 0.24%.
16. **Anderson ME, Hopkins WG, Roberts AD, Pyne DB. "Monitoring seasonal and long-term changes in test performance in elite swimmers." Eur J Sport Sci 2006;6(3):145–154. doi:10.1080/17461390500529574** **[A]**. 7×200 m step test in 40 elite swimmers.
    - **TE about 0.8%** for submaximal (4 mmol) and maximal speed.
    - Pre-season → taper gain: about 2.2% (women) and 1.5% (men). Most of it is lost by the off-season, leaving a net yearly gain of about 1.0% / 0.6%.
17. **Anderson M, Hopkins W, Roberts A, Pyne D. "Ability of test measures to predict competitive performance in elite swimmers." J Sports Sci 2008;26(2):123–130. doi:10.1080/02640410701348669** **[A]**.
    - Test changes predicted race changes only modestly: r ≈ 0.4–0.6.
    - The best single predictor was skinfolds in women, then stroke rate at 4 mmol.
    - The step test is good for tracking *large* changes.
18. **Pyne DB, Lee H, Swanwick KM. "Monitoring the lactate threshold in world-ranked swimmers." MSSE 2001;33:291–297** **[A]** (coachsci summary). Over a season, 200 m test times and threshold speed got worse in mid-season and then improved. Competition performance did not change, and the lactate measures were not related to it.
19. **Hellard P, Avalos M, Millet G, Lacoste L, Barale F, Chatard JC. "Modeling the residual effects and threshold saturation of training: a case study of Olympic swimmers." J Strength Cond Res 2005;19(1):67–75. doi:10.1519/14853.1** (PMC5352828) **[V]**.
    - Load was logged as metres in each lactate zone, normalised to each swimmer's maximum.
    - Training explained only about 30% of performance variance, and individual prediction CIs were about ±1.9%.
    - Responses were individual.
20. **Hellard P, Avalos M, Lacoste L, Barale F, Chatard JC, Millet GP. "Assessing the limitations of the Banister model in monitoring training." J Sports Sci 2006;24:509–520** **[A]**. Fit-fatigue model fits are good, but parameters are unstable, with wide CIs. R² does not guarantee prediction.
21. **Avalos M, Hellard P, Chatard JC. "Modeling the training-performance relationship using a mixed model in elite swimmers." MSSE 2003;35:838–846** **[A]**. Swimmers responded to training in individual ways; r² was 0.15–0.65 per swimmer.
22. **Hellard P, Avalos-Fernandes M, Lefort G, Pla R, Mujika I, Toussaint JF, Pyne DB. "Elite swimmers' training patterns in the 25 weeks prior to their season's best performances." Front Physiol 2019;10:363. doi:10.3389/fphys.2019.00363** **[V]**.
    - Weekly metres by lactate zone, plus dryland minutes, combined into a normalised total load.
    - About 86–90% of volume was ≤4 mmol.
    - Faster swimmers showed progressive loading over about 14–15-week macrocycles. The findings are observational.
    - Figures show load vs weeks-to-target, with CI bands and performance on a second axis.
23. **Wallace LK, Slattery KM, Coutts AJ. "The ecological validity and application of the session-RPE method for quantifying training loads in swimming." J Strength Cond Res 2009;23(1):33–38** **[A]**.
    - sRPE correlated with HR-based load (r 0.55–0.94) and with distance (0.37–0.81).
    - **Coaches under-rated easy sessions and over-rated hard ones** compared with swimmers.
24. **Barry L, Lyons M, McCreesh K, Powell C, Comyns T. "International survey of training load monitoring practices in competitive swimming." Phys Ther Sport 2022;53:51–59. doi:10.1016/j.ptsp.2021.11.005** **[A]**.
    - 84% of respondents monitor load: volume 96%, sRPE 92%, wellness common.
    - Barriers: stakeholder engagement, resources, and how usable the systems are.
25. **Mujika I, Padilla S, Pyne D. "Swimming performance changes during the final 3 weeks of training leading to the Sydney 2000 Olympic Games." Int J Sports Med 2002;23(8):582–587. doi:10.1055/s-2002-35526** **[A]**. Performance improved **2.18 ± 1.50%** over the final 3 weeks (range −1.1% to +6.0%).
26. **Bosquet L, Montpetit J, Arvisais D, Mujika I. "Effects of tapering on performance: a meta-analysis." MSSE 2007;39(8):1358–1365** **[A]**. Best taper: about 2 weeks, volume cut by 41–60%, intensity and frequency kept.
27. **Impellizzeri FM, Tenan MS, Kempton T, Novak A, Coutts AJ. "Acute:chronic workload ratio: conceptual issues and fundamental pitfalls." IJSPP 2020;15(6):907–913. doi:10.1123/ijspp.2019-0864** **[A, metadata]**. ACWR is flawed as an injury-risk indicator. **The detailed content of the paper was not read [M].**
28. **Scott, Burden & Dekerle 2023/24, "Stroke-specific swimming critical speed testing", PMC10875687** **[A, via search summary]**.
    - 200/400 m times: CV <2%. Critical-speed TE ≤0.04 m/s (CV <4%).
    - D′ is unreliable (CV 13–45%).
    - No published TE was found for T30 or 10×100 training sets **[gap]**.

### Wellness and readiness
29. **Saw AE, Main LC, Gastin PB. "Monitoring the athlete training response: subjective self-reported measures trump commonly used objective measures." Br J Sports Med 2016;50:281–291. doi:10.1136/bjsports-2015-094758** **[A]**. Subjective measures respond to acute and chronic load more sensitively and consistently than objective ones, and the two often don't correlate.
30. **Saw AE, Main LC, Gastin PB. "Monitoring athletes through self-report: factors influencing implementation." J Sports Sci Med 2015;14:137–146** (PMC4306765) **[V]**.
    - Keep it brief, one screen, at a consistent time, filled in on the day.
    - Show athletes it is used. Otherwise they give "dummy responses".
    - Punishment, or not knowing who sees the data, leads to withheld or careless answers.
    - Explain the purpose; allow comments; make sure staff interpret consistently.
31. **Jeffries AC, Wallace L, Coutts AJ, McLaren SJ, McCall A, Impellizzeri FM. "Athlete-reported outcome measures for monitoring training responses: a systematic review … COSMIN." IJSPP 2020;15:1203–1215. doi:10.1123/ijspp.2020-0386** **[A]**. The **single-item measures most used in sport science have not been validated.** Modified non-validated items are common, so conclusions drawn from them are questionable.
32. **Duignan C, Doherty C, Caulfield B, Blake C. "Single-item self-report measures of team-sport athlete wellbeing and their relationship with training load: a systematic review." J Athl Train 2020;55(9):944–953. doi:10.4085/1062-6050-0528.19** **[A]**.
    - Items: soreness, fatigue, sleep quality, stress, mood.
    - Associations with load ranged from none to very large.
33. **Hooper SL, Mackinnon LT, Howard A, Gordon RD, Bachmann AW. "Markers for monitoring overtraining and recovery." MSSE 1995;27:106–112. doi:10.1249/00005768-199501000-00019** **[A]**. Study of 14 elite swimmers: self-reported wellbeing was the most efficient marker.
    - Hooper & Mackinnon, Sports Med 1995;20:321–327, doi:10.2165/00007256-199520050-00003.
    - **[M]** The "Hooper index" sums 1–7 ratings of sleep, stress, fatigue and soreness.
34. **McLean BD, Coutts AJ, Kelly V, McGuigan MR, Cormack SJ. IJSPP 2010;5(3):367–383. doi:10.1123/ijspp.5.3.367** **[A, metadata]**. **[M]** Source of the common 5-item, 1–5 wellness scale (fatigue, sleep, soreness, stress, mood).

### Visual perception, text vs graphs, uncertainty
35. **Cleveland WS, McGill R. JASA 1984;79:531–554. doi:10.1080/01621459.1984.10478080** **[A, metadata]**. **[M]** Ranks how accurately people read visual encodings: position on a common scale > length > angle/slope > area > volume/colour.
36. **Vessey I. "Cognitive fit: a theory-based analysis of the graphs versus tables literature." Decision Sciences 1991;22(2):219–240** **[A, secondary]**. Tables suit "symbolic" tasks (reading exact values); graphs suit "spatial" tasks (trends, comparisons).
37. **Few S. Bullet Graph Design Specification (Perceptual Edge, rev. 2013)** https://www.perceptualedge.com/articles/misc/Bullet_Graph_Design_Spec.pdf **[V]**.
    - Designed to replace gauges and meters.
    - Use **2–5 qualitative ranges, ideally 3**, shown as **intensities of one hue** rather than different hues, because of colour blindness. Darker means poor.
    - For "lower is better" measures, reverse the order of the range shading.
38. **Tufte E. *Beautiful Evidence* 2006, pp. 46–63 (sparklines: "data-intense, design-simple, word-sized graphics")** **[A, via Wikipedia and edwardtufte.com]**.
39. **van der Meulen M et al. "When a graph is poorer than 100 words." Appl Cogn Psychol 2010;24(1):77–89** **[A]**. In neonatal ICU decisions, expert-written text gave the best decisions. Computer-generated text was at least as good as graphs.
40. **Gkatzia D, Lemon O, Rieser V. "Natural language generation enhances human decision-making with uncertain information." ACL 2016 (short papers) 264–268. arXiv:1606.03254** **[A]**. With 442 participants: text alone gave about 24% better decisions than graphics, and **text + graphics about 44% better**.
41. **van der Bles AM et al. "Communicating uncertainty about facts, numbers and science." R Soc Open Sci 2019;6:181870. doi:10.1098/rsos.181870** **[V partial]**.
    - Different people read verbal probability words very differently, though each person is consistent with themselves.
    - Fixed vocabularies (IPCC style) help, and pairing words with numbers brings readings closer to what was meant.
    - Keep **"how sure"** separate from **"how big"** and from **"quality of evidence"** (GRADE-like).
    - Negative and positive framing shift what people focus on.
42. **van der Bles AM, van der Linden S, Freeman ALJ, Spiegelhalter DJ. PNAS 2020. doi:10.1073/pnas.1913678117** **[A, secondary]**.
    - Numeric ranges barely reduce trust.
    - **Vague verbal statements that uncertainty exists ("there is some uncertainty") reduce trust more.**
43. **WCAG 2.2 SC 1.4.1 Use of Color (Level A)** https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html **[V]**. Colour must not be the only visual means of conveying information. **[M]** SC 1.4.3 requires 4.5:1 for text and SC 1.4.11 requires 3:1 for graphical objects.
44. **Birch J. "Worldwide prevalence of red-green color deficiency." JOSA A 2012;29:313–320. doi:10.1364/JOSAA.29.000313** **[A, via mirror]**. About **8% of men** and **0.4% of women** of European ancestry.
45. **Okabe M, Ito K. Color Universal Design (2008)** **[M]**. Colour-blind-safe palette: black #000000, orange #E69F00, sky blue #56B4E9, bluish green #009E73, yellow #F0E442, blue #0072B2, vermillion #D55E00, reddish purple #CC79A7.

### Youth swimmers
46. **Smith RE, Smoll FL, Cumming SP. JSEP 2007;29:39–59** **[A]**. A 75-min coach workshop on a mastery-oriented climate:
    - anxiety fell, while control athletes' anxiety rose;
    - **[A, press release]** 11% vs 26% of athletes dropped out.
47. **Moulds K et al. "Coach-created motivational climate ratings differentiate between dropout and continuation in Australian youth swimming." Int J Sports Sci Coach 2023;18:1395–1404. doi:10.1177/17479541231174806** **[A]**. Sample: swimmers aged 8–18. A disempowering climate was associated with dropout and an empowering one with staying in the sport. Athlete-level factors (other than age and sex) were not predictive.
48. **Alshdokhi K, Petersen C, Clarke J. "Improvement and variability of adolescent backstroke swimming performance by age." Front Sports Act Living 2020;2:46. doi:10.3389/fspor.2020.00046** **[V]**.
    - Suggested expected yearly gains: about 10% (ages 8–10), about 5% (11–14), 1–2% (15–18).
    - Maturation confounds training effects; use age-appropriate benchmarks with parents.
49. **Allen SV, Vandenbogaerde TJ, Hopkins WG. "Career performance trajectories of Olympic swimmers." Eur J Sport Sci 2014;14(7):643–651. doi:10.1080/17461391.2014.893020** **[A]**.
    - Peak age: 24.2 years (men), 22.5 (women). Sprinters peak about 1.5–2 years earlier.
    - Improvement to peak: about 2.4% over the final 4 years and about 9.5% over 8 years.

---

## 2. (a) Design rules (19)

Each rule gives its source and how sure it is. "Synthesis" means my inference from the cited sources.

1. **One question per screen; the answer comes first.** Open each view with a one-sentence plain-language conclusion (PT-PT), then the chart, then the numbers on demand.
   - *Sources:* Buchheit 2017 Aspetar (plain language, few variables) [V]; van der Meulen 2010 [A]; Gkatzia 2016 [A].
2. **Pair text with the graphic; neither alone.** Text plus graphics beat graphics alone by about 44% in Gkatzia 2016 [A]. The text tells the coach what to look at.
3. **Show few, decision-relevant variables.** For a swimmer: race time vs PB, the key set's pace, weekly volume and intensity mix, and the wellness check-in. Hide everything else behind "ver detalhe".
   - *Sources:* Buchheit 2017 ("important > interesting") [V]; Robertson 2017 (data reduction, burden) [V]; Thornton 2019 ("simple") [A].
4. **Compare each swimmer to their own history first and to the team second.** Variability differs between swimmers and between performance levels (1.1% vs 1.5%), so team-wide thresholds mislead.
   - *Sources:* Robertson 2017 Fig 2/Table 1 [V]; Stewart & Hopkins 2000 [A]; Avalos 2003 and Hellard 2005 on individual responses [A/V].
5. **Judge every change against "normal variation" and against "worth caring about".** Draw the swimmer's normal band as a light shaded area around their baseline, with the new value as a dot.
   - *Sources:* Buchheit 2017 (SWC, TE bars, shaded bands) [V]; Hopkins 2004 [V]; Swinton 2018 [V].
6. **Label values directly; keep text horizontal; strip extra decimals.**
   - Race times: 0.01 s only when electronically timed. Hand-timed and training times: 0.1 s. Percentages: none in coach UI.
   - *Sources:* Buchheit 2017 [V]. Precision levels are synthesis.
7. **Encode by position along a common scale** (dots, lines, bars from a sensible baseline). Avoid gauges, dials, pies, 3-D, area/bubble encodings and dual y-axes.
   - *Sources:* Cleveland & McGill 1984 [M ranking]; Few bullet-graph spec (replaces gauges) [V]. The dual-axis advice is synthesis.
8. **Tables for looking up exact values, graphs for trends.**
   - A set's reps fit a compact table with conditional emphasis on the reps outside the normal band.
   - Season progression fits a line or dot plot.
   - *Sources:* Vessey 1991 cognitive fit [A]; Buchheit 2017 (conditional formatting) [V]; Robertson 2017 [V].
9. **Use sparklines for trends in lists on phones** (for example, last 8 swims of an event next to the PB). No axes, but mark the PB and the latest point.
   - *Sources:* Tufte 2006 [A]. Phone application is synthesis.
10. **Code "lower time = better" by meaning, not by number direction.**
    - Say "mais rápido / mais lento", never "+0,8 s".
    - Arrows and colours follow better/worse.
    - On bullet-style bars, reverse the range order.
    - *Sources:* Few 2013 (reversed ranges) [V]. Wording is synthesis.
11. **Show individual points, not only averages.** For a set, show every rep as a dot with the set mean as a line. For a squad, show each swimmer.
    - *Sources:* Robertson 2017 citing Weissgerber 2015 [V].
12. **Flags are decision support, not decisions or predictions.**
    - Use flags only for states where a coach can act.
    - Every flag says *why* it fired ("3 dias seguidos com cansaço acima do habitual dela").
    - Never label anything "risco de lesão".
    - *Sources:* Robertson 2017 (explain vs predict, conservative bias, no standard thresholds) [V]; Impellizzeri 2020 on ACWR [A/M].
13. **Ration alerts: ask for persistence or corroboration, and cap the number shown.**
    - Even a "1-in-10" rule produces false "unusual" flags when nothing has changed. Many swimmers × many metrics × many days produces noise.
    - Require two consecutive observations, or a trend, or two independent signals (e.g. wellness + set pace) before amber/red. Show at most about 3 insights per swimmer view.
    - *Sources:* Hopkins 2017 [V]. Persistence rule and cap are synthesis.
14. **Wellness check-in:**
    - ≤5 items on one screen, filled in at the same time each day.
    - Show the swimmer that someone looked (e.g. "o treinador viu").
    - Never punitive; tell them who sees it; allow a comment.
    - Label it "como te sentes (auto-avaliação)", not a medical or "prontidão" score.
    - *Sources:* Saw 2015 [V]; Saw 2016 [A]; Jeffries 2020 (single items not validated) [A]; Hooper 1995 [A].
15. **Readiness without medical claims.**
    - Say "abaixo do habitual dela" or "vale a pena conversar". Never "sobretreino", "doença", "lesão", "recuperação insuficiente" or "risco".
    - No composite "readiness %".
    - *Sources:* Jeffries 2020 [A]; Robertson 2017 [V]. Wording is synthesis.
16. **Training load: show it against plan and context.**
    - Show weekly metres split by intensity zones (and sRPE×min if collected), planned vs done, and the swimmer's usual range.
    - Tag phases (base, intensity, taper, competition, illness, holidays) so expected changes aren't flagged.
    - Take sRPE from the swimmer, not the coach. No ACWR.
    - *Sources:* Hellard 2005/2019 (zones, normalisation, individual response) [V]; Wallace 2009 (coach–swimmer sRPE mismatch) [A]; Barry 2022 [A]; Impellizzeri 2020 [A/M]; Bosquet 2007, Mujika 2002 (taper context) [A].
17. **Don't over-sell tests and sets as race predictors.**
    - Mid-season slowdowns in test and set times under heavy load are expected.
    - Step-test noise is about 0.8%, and changes track race changes only modestly.
    - Use "o teste sugere" rather than "vai nadar X".
    - *Sources:* Pyne 2001 [A]; Anderson 2006/2008 [A]; Hellard 2006 (fit ≠ prediction) [A].
18. **Swimmer- and parent-facing views put progress and PBs first.**
    - Compare with the swimmer's own past (PBs, season-best trend, consistency, technique and effort goals met).
    - No public peer rankings by default.
    - Frame slower swims neutrally and in context ("semana de muita carga").
    - Explain that growth and maturation make year-to-year changes large and uneven.
    - *Sources:* Smith 2007 [A]; Moulds 2023 [A]; Alshdokhi 2020 [V]; Allen 2014 [A].
19. **The report starts a conversation; it does not replace one.**
    - Give coaches 1–2 "talking points" per swimmer rather than more charts.
    - Keep one consistent interpretation across staff.
    - *Sources:* Buchheit 2017 [V]; Saw 2015 (consistent interpretation, visible use) [V].

(Extra, synthesis: keep three axes of uncertainty separate in the UI. These are **how big** (small/moderate/large), **how sure** (talvez/provavelmente/quase de certeza) and **how much data** ("com base em 3 provas"). *Source:* van der Bles 2019 [V partial].)

---

## 3. (b) Statistical approach for one swimmer: "is this rep, set or week meaningfully different?"

### 3.1 Data hygiene before any statistic
- **Compare only like with like:**
  - same event (stroke + distance);
  - same pool length (25 m and 50 m are never mixed);
  - same timing type (electronic vs hand);
  - for sets: same distance, stroke, interval, equipment and target intensity.
- **Transform:** `y = 100 · ln(time_s)`. Differences in y are approximately % changes, and noise becomes a CV (Hopkins 2000 [M]; Hopkins 2009 [V]).
- **A PB is a fact.** Always show and celebrate it. Statistics only qualify whether the *trend* is real (synthesis).

### 3.2 Noise (typical error, TE, in %)
Use the swimmer's own data when there is enough; otherwise pool it with a prior.

| Situation | How to get TE | Source |
|---|---|---|
| ≥10 comparable observations, no big step changes | SE of estimate of a linear trend through them; or `SD(diff of consecutive comparable obs)/√2` when gaps are short | Hopkins 2017 [V]; Hopkins 2000 [M] |
| Fewer than 10 | Pool with a prior: `TE² = (df_p·TE_p² + df_i·TE_i²)/(df_p+df_i)`, with df_i = n_i − 2 for a trend (n_i − 1 for SD) and df_p ≈ 5–10 (design choice) | Hopkins 2017 (df-weighted pooling) [V]; df_p is synthesis |
| Prior, races (same event, between meets) | junior/national **1.4%** (faster 1.1%, slower 1.5%); elite **0.8%** (within-meet 0.6%) | Stewart & Hopkins 2000 [A]; Pyne 2004 [A] |
| Prior, 7×200 step test | **≈0.8%** | Anderson 2006 [A] |
| Prior, 200/400 m time trials | CV <2% | Scott et al. [A] |
| Prior, training-set means (10×100 etc.) | **No published value found.** Start at race CV × 1.3 (Hopkins' inflation for non-top athletes, [V]) and let the swimmer's own data take over | Gap; flagged assumption |

Averaging m repeats on one occasion gives `TE_mean = TE/√m` (Hopkins 2017 [V]). This only holds if rep errors are independent. Fatigue drift within a set breaks that, so **estimate TE at set-mean level** from repeated sets rather than dividing rep TE by √m (synthesis).

### 3.3 Smallest worthwhile change (SWC)
- **Races:** `SWC = 0.3 × CV_between-competition` for that swimmer (or the prior) (Hopkins 2004 update [V]; Hopkins 2009 [V]).
  - Junior at CV 1.4%: SWC ≈ 0.42% (about 0.26 s on a 62 s 100 m).
  - Elite at 0.8%: SWC ≈ 0.24%.
  - The older 0.5×CV rule gives about 0.4% for elites (Pyne 2004) [A].
- **Magnitude ladder** in units of within-swimmer CV: **0.3 / 0.9 / 1.6 / 2.5 / 4.0** (Hopkins 2009 [V]). Labels: small, moderate, large, very large, extremely large.
  - Buchheit's version: 1×/3×/6×/10× SWC = small/moderate/large/very large [V].
- **Sets/tests:** there is no medal anchor. Default to the same 0.3 × race-CV currency. Let the coach override with a practical threshold (e.g. "0,5 s/100 m") (synthesis).
  - The team-sport 0.2 × between-swimmer SD is fragile in small, mixed squads (Hopkins 2004 [V] gives it only as a team-sport default).
- **Weekly load and wellness:** no "worthwhile" anchor. Treat these as *unusual vs own history*, not "better/worse" (synthesis; Hopkins 2017 "unusual" rule [V]).

### 3.4 Noise of the comparison
Let d = observed difference in % (negative = faster).

| Comparison | σ_d |
|---|---|
| single vs single | `√2 · TE` |
| single vs mean of n baseline obs | `TE · √(1 + 1/n)` |
| mean of m vs mean of n | `TE · √(1/m + 1/n)` |
| trend over time | SE of the regression slope (Hopkins 2017) |

(Hopkins 2017 [V]; Swinton 2018 [V]. Prefer "vs mean of recent comparable swims" over "vs last swim", as Hopkins 2017 advises.)

### 3.5 Classification (normal approximation; TE treated as known)
- Probability that the true change exceeds the SWC in the direction of d: `P_real = Φ((|d| − SWC)/σ_d)`.
- Probability that the true change is trivial: `P_trivial = Φ((SWC − d)/σ_d) − Φ((−SWC − d)/σ_d)`.

| Condition | Coach label (PT-PT) | EN |
|---|---|---|
| P_real ≥ 0.95 ⇔ \|d\| ≥ SWC + 1.645·σ_d | "quase de certeza mais rápido/lento" | very likely |
| 0.75 ≤ P_real < 0.95 ⇔ \|d\| ≥ SWC + 0.674·σ_d | "provavelmente mais rápido/lento" | likely |
| P_trivial ≥ 0.75 | "igual ao habitual" | trivial |
| otherwise | "ainda não dá para dizer" (+ reason: "poucos dados" / "varia muito") | unclear |

- The cut-offs follow Hopkins 2009's 75/95% bands [V]. Using them as *descriptive* labels for one athlete, and dropping "possibly", is synthesis made conservative because of Sainani 2018 [A].
- Never show the probability numbers to coaches.
- For **unusual-vs-history** metrics (load, wellness), use `z = (x − mean_baseline)/SD_baseline`:
  - |z| ≥ 2 → "muito acima/abaixo do habitual dela";
  - 1 ≤ |z| < 2 → "acima/abaixo do habitual";
  - otherwise "habitual".
  - Raise an actionable flag only if the state persists for 2+ observations, or if it lines up with a performance signal (synthesis; Hopkins 2017 2×TE "unusual" rule [V]).

**Worked example (100 m free, junior, 62.00 s, CV 1.4% → TE ≈ 0.87 s, SWC ≈ 0.26 s).**
- Single swim vs single swim: σ_d = 1.98% ≈ 1.23 s. "Provavelmente mais rápido" needs about 1.08 s faster. "Quase de certeza" needs about 2.28 s.
- Single swim vs mean of the last 4: σ_d ≈ 1.57% ≈ 0.97 s. "Provavelmente" needs about 0.91 s; "quase de certeza" about 1.86 s.
- Lesson for the UI: one swim rarely proves anything. Trends and baselines of several swims do. A PB is still a PB.

### 3.6 Minimum sample sizes
- **No verdict with <3 comparable previous observations.** Show values and the PB only, with "precisamos de mais provas para comparar" (heuristic, synthesis).
- **≥10 comparable observations** for an individual TE from a trend (Hopkins 2017 [V]). Until then, pool with the prior (3.2).
- **Priors from squad reliability data:** aim for ≥30 swimmers or pairs; 6–12 is imprecise (Swinton 2018 [V]).
- **Load baseline:** ≥4 normal weeks, excluding taper, illness and holiday weeks (heuristic).
- **Wellness baseline:** ≥14 entries before using z-scores; until then show raw answers only (heuristic, unverified).
- **Recompute TE and SWC each season and when the swimmer moves level.** Faster swimmers are more consistent (Stewart & Hopkins 2000 [A]), and youth progress fast (Alshdokhi 2020 [V]).

### 3.7 Context modifiers (avoid false alarms)
- Phase tags change the *expected* direction:
  - heavy-load mid-season: slower sets and tests are expected (Pyne 2001; Anderson 2006);
  - taper: about 2% faster is typical at elite level (Mujika 2002);
  - 2-week taper with 41–60% volume cut (Bosquet 2007).
- Training explains only part of performance (about 30% in Hellard 2005 [V]). Language must never imply "the load caused this swim".

---

## 4. (c) Expressing uncertainty in words, not numbers

1. **Use one fixed, small vocabulary and never vary it.** People read probability words differently from one another but consistently for themselves (van der Bles 2019 [V partial]). Proposed PT-PT ladder, mapped to section 3.5:
   - **"quase de certeza"** (very likely). Avoid "certamente" and "de certeza".
   - **"provavelmente"** (likely).
   - **"igual ao habitual"** (trivial; confidently no relevant change).
   - **"ainda não dá para dizer"** (unclear). Always add *why*: "só temos 2 provas" / "os tempos dela variam muito".
2. **Never say vague things like "há alguma incerteza".** Vague verbal uncertainty lowers trust more than concrete statements do (van der Bles 2020 [A]). Make the uncertainty concrete in natural units instead: "mais rápido do que a variação normal dela (cerca de ±0,9 s)". Seconds are fine; %, CV, z and p are not.
3. **Keep "how big", "how sure" and "how much data" in separate slots** (van der Bles 2019 [V]). Template:
   > **[Quem] [verbo de confiança] [direção] [tamanho]** — [evidência em linguagem simples]. [Próximo passo opcional].
   >
   > "A Ana está **provavelmente** mais rápida nos 100 livres — **uma melhoria moderada**: as últimas 4 provas estão todas abaixo do habitual dela. Pode valer a pena manter o trabalho de ritmo."
   - Magnitude words follow Hopkins (2009) [V]: pequena / moderada / grande / muito grande.
4. **Hedge causation, not just magnitude.** Say "coincide com a semana de mais carga", not "por causa da carga" (Hellard 2005/2006: models don't predict individuals well [V/A]).
5. **Name the evidence, briefly.** Say "com base em 5 provas desde setembro". Data quantity counts as quality of evidence (van der Bles 2019 [V]).
6. **The next step is an option the coach owns, not an order.** Use "pode valer a pena…", "talvez conversar com…". Never prescribe medical actions (Robertson 2017: decision *support* [V]; Buchheit 2017: the conversation is what matters [V]).
7. **Frame for the audience.**
   - Coaches get neutral/clinical wording.
   - Swimmers and parents get progress-first wording ("ainda não é PB, mas é o teu 2.º melhor tempo de sempre").
   - Negative frames draw attention to non-occurrence (van der Bles 2019 [V]).
   - Avoid "falhou", "pior", "mau".
8. **Unclear is a legitimate answer.** Hopkins (2009) explicitly uses "unclear" [V]. Show it rather than forcing a colour.
9. **No numbers inside the sentence** (except seconds and PB times). Put "porquê?" behind a tap that shows the dots, the normal band and "baseado em N provas" (synthesis).

---

## 5. (d) Traffic lights, colour and accessibility

1. **At most 3 states, ideally** (Few 2013: max 5, ideally 3 [V]; Robertson 2017 R/A/G meanings [V]). For this app:
   - **Performance changes** use direction colours: better / habitual / worse.
   - **Alerts** (wellness/load anomalies that need a conversation) use one separate attention colour.
   - Don't reuse "red" for "slower swim". A slower mid-season set is not an alarm (synthesis; Pyne 2001 [A]).
2. **Colour-blind-safe hues.** About 8% of men and 0.4% of women have red-green deficiency (Birch 2012 [A]). Avoid red/green as the only pair. Suggested Okabe–Ito-based tokens [M palette]:
   - better / faster = **blue #0072B2**;
   - worse / slower = **vermillion #D55E00** or **orange #E69F00**;
   - habitual / trivial = **neutral grey**;
   - unclear = **outline or hollow marker, no fill**;
   - alert = orange plus an icon.
   - Check every token in both themes for contrast.
3. **Never colour alone** (WCAG 2.2 SC 1.4.1, Level A [V]). Always pair colour with:
   - an icon or shape: ▲ "mais rápido", ● "habitual", ▼ "mais lento", ⚠ for alerts; filled vs hollow for sure vs unclear;
   - **a word label**;
   - for bands, texture or position (dot inside or outside the shaded band).
   - Test the screens in greyscale.
4. **Contrast** (WCAG 2.2 [M]): text ≥4.5:1 (SC 1.4.3); chart marks, band edges and icons ≥3:1 against adjacent colours (SC 1.4.11). Phones in bright pool light need high contrast; use bold marks and no hairline-only encodings (synthesis).
5. **Bands and ranges in one hue at different intensities** (Few 2013 [V]). Example: the swimmer's "normal band" as a light grey fill. Darker means worse when ranges are qualitative. For times, reverse the order so "faster" reads as good.
6. **Colour follows meaning, not sign.** For swim times a negative Δ is good. Colour and arrow show better/worse, never up/down in numbers (synthesis; Few's reversed ranges [V]).
7. **Thresholds behind colours must be individual, documented and explainable.** A tap on any coloured element shows the rule ("abaixo da variação normal dela em 2 provas seguidas") (Robertson 2017 [V]).
8. **Keep colour meanings identical across the app**, in light and dark mode. Never use the alert colour decoratively (synthesis).

---

## 6. Gaps and caveats
- **Thornton 2019 full text** was paywalled. Its specific chart rules are not checked.
- **Buchheit's "3 questions coaches ask"** could not be found in any source. Treat it as practitioner lore.
- **Buchheit 2018 "Magnitudes matter more than beetroot juice"** (methods for defining SWC) could not be read.
- **No published typical error was found for swim training sets** (10×100, T30, broken swims). The 1.3 × race-CV prior is an assumption; Aquastats could estimate this from its own anonymised data (squad-level reliability, ≥30 swimmers).
- **MBI is disputed as formal inference** (Sainani 2018). The labels in 3.5 are used as conservative descriptive wording for monitoring one swimmer, not for research claims.
- **Contested or unverified claims:**
  - ACWR critique: Impellizzeri 2020 metadata only.
  - Exact WCAG ratios: memory.
  - The Okabe–Ito hex values: memory.
  - The Cleveland–McGill ranking order: memory.
  - The Hooper 1–7 scale details: secondary sources.
- **Thresholds that are heuristics, not evidence:** <3 observations → no verdict; ≥14 wellness entries; ≥4-week load baseline; persistence = 2 observations; df_p 5–10; at most 3 insights per view. They should be revisited with real usage data.
