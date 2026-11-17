# Snelle check vóór het reviewteam (Jev) — 2026-11-17 (a)

Jev: `typesafe/jev-1.14`, 3× per cursus. Reviewers: `claude-code::claude-sonnet-5-5`. Drempels vooraf vast (0,3/0,7), niets afgesteld.

| Set | Paren | Overgeslagen | Gemist: waarschuwing | Gemist: verwachte fout | Alleen tips gemist | Terecht overgeslagen | Wisselend |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Rolagenten-cases | 150 | 13 (9%) | 0 | 0 | 9 | 4 | 2 |
| Holdout | 72 | 11 (15%) | 1 | 0 | 8 | 2 | 1 |

## Per reviewer (beide sets)

| Reviewer | Paren | Overgeslagen | Gemist: waarschuwing |
| --- | --- | --- | --- |
| assessment-expert | 37 | 1 | 0 |
| designer | 37 | 1 | 0 |
| ai-resilience | 37 | 11 | 0 |
| professional-practice | 37 | 0 | 0 |
| student | 37 | 8 | 1 |
| inclusion | 37 | 3 | 0 |

## Wat Jev oversloeg, en wat de reviewer zei

### Rolagenten-cases

- **ae-knowledge-test-for-create/ai-resilience**:
  - info T2: Bij T2 (Kennistoets REST, 100% van het cijfer) staat niet of de toets onder of zonder toezicht plaatsvindt. Een meerkeuzetoets die thuis gemaakt wordt, kan een student grotendeels aan AI overlaten, terwijl dit de enige summatieve toets is.
  - info T2: T2 is de enige summatieve toets (100%) en het is een meerkeuzetoets; of die onder toezicht is afgenomen, staat niet ingevuld. Zonder toezicht kan een student de vragen eenvoudig door AI laten beantwoorden.
  - info L1: L1 (een REST-API ontwerpen) wordt alleen gedekt door T2, een meerkeuzetoets, en de student ontwerpt in T2 zelf niets. Het ontwerp uit A3 en de feedbackronde T1 tellen niet mee, dus het cijfer zegt weinig over of de student zelf een API kan ontwerpen.
  - info T1: T1 is formatief en daarmee prima, ook met AI. Het is wel het enige moment waarop de student aan L1 werkt met feedback, terwijl T2 daar geen ontwerpwerk van vraagt, dus de oefening sluit niet aan op wat telt.
- **ae-clean/student**:
  - info T3: Week 5 is leeg, in week 6 staat Kennistoets indexen (T2, 10 uur) en T3 (40 uur) valt in week 7. Een student kan het grootste werk daardoor tot de laatste weken uitstellen.
  - info T1: In week 3 komen A3 (20 uur) en de formatieve Oefenopdracht met feedback (T1, 6 uur) samen, ruim 26 uur in één week. Daarna volgt in week 4 alleen nog een feedbackgesprek van 2 uur (A4).
  - info T3: In week 5 staat niets gepland, terwijl T3 (40 uur) pas in week 7 telt, de week na de kennistoets T2 in week 6. Een student kan T3 pas laat oppakken en moet dan in één week veel uren maken.
  - info T2: Tussen het feedbackgesprek in week 4 en de kennistoets T2 in week 6 is er geen activiteit die L1 oefent. De enige feedback op L1 komt uit T1 in week 3.
- **de-order/ai-resilience**:
  - info T2: Bij T2 (Praktijktoets testen, 100% van het cijfer) staat niet of de toets onder toezicht plaatsvindt, en de titel laat dat niet zien. Daardoor kan ik niet beoordelen of een student de testsuite grotendeels door generatieve AI kan laten schrijven.
  - info T2: Bij T2 (Praktijktoets testen, 100% van het cijfer, L1) staat niet ingevuld of de toets onder toezicht plaatsvindt. De titel laat dat niet zien. Het product, een testsuite, kan een student grotendeels met AI laten schrijven als hij thuis wordt gemaakt.
- **de-load-peak/student**:
  - info A7: In week 1 tot en met 6 heeft een student alleen een werkcollege van 2 uur, en in week 7 staat dan het eindproject van 90 uur. Dat is een eindsprint van ruim twee volle werkweken in één week, vlak voor de oplevering in week 8.
  - info T1: De demo met feedback in week 6 valt vóór de start van het eindproject (A7, week 7). Een student weet dan niet wat hij moet laten zien, en de feedback komt maar één week voor de oplevering in week 8.
  - info A7: In week 1 tot en met 6 heeft een student alleen een werkcollege van 2 uur per week, en in week 7 staat ineens 90 uur voor het Eindproject. Dat is meer dan twee volle werkweken in één week, en daarna volgt in week 8 nog 20 uur voor T2.
  - info T1: De demo met feedback (T1) is in week 6, maar de opdracht A7 (het bouwen van de app) staat pas in week 7. Een student weet dan niet wat hij in week 6 al moet kunnen laten zien.
- **de-clean/designer**:
  - info L2: L2 vraagt dat studenten uitleggen wanneer een mock past. In A3 horen ze dat en in A4 en A5 passen ze mocks toe, maar nergens onderbouwen ze zelf hun keuze.
  - info A5: A5 is met 24 uur in week 3 veel zwaarder dan week 1 (10 uur) en week 2 (12 uur), terwijl het de eerste keer is dat studenten zelfstandig een hele testsuite bouwen.
  - info A6: Na de feedbackronde in A6 (week 4) en de peerreview T1 is er geen activiteit waarin studenten de feedback verwerken; week 5 is leeg en T2 volgt pas in week 6.
  - info A5: A5 (24 uur) valt helemaal in week 3, terwijl de weken ervoor 10 en 12 uur zijn. De feedbackronde A6 komt pas in week 4, als het project al af is.
  - info L2: In A4 en A5 passen studenten mocks toe, maar nergens oefenen ze met uitleggen waarom een mock op een bepaalde plek nodig is. L2 vraagt precies die uitleg.
  - info A6: A6 is alleen aan L1 gekoppeld, terwijl de peerreview T1 in dezelfde week L1 en L2 behandelt. Week 5 heeft geen activiteit, dus er is geen vaste tijd om feedback te verwerken vóór T2 in week 6.
- **de-clean/ai-resilience**:
  - info T2: Bij T2 (Praktijktoets testen, 100% van het cijfer, 20 uur) is niet ingevuld of de toets onder toezicht is, en de titel laat dat ook niet zien. Een testsuite of uitleg over mocks die thuis wordt gemaakt, kan grotendeels met AI tot stand komen.
  - info T1: T1 (peerreview testsuite) is formatief en de enige formatieve toets vlak voor T2. De student oefent er vooral met beoordelen van andermans suite, niet met zelf tests schrijven of uitleggen wanneer een mock past (L2).
  - info T2: Bij T2 (Praktijktoets testen, 100% van het cijfer, 20 uur) is niet ingevuld of die onder toezicht of zonder toezicht plaatsvindt. Het is een praktijktoets waarin een student tests schrijft; werk dat thuis wordt gemaakt kan grotendeels met AI.
  - info T1: T1 (peerreview, formatief) is het enige formatieve moment vóór T2, en pas in week 4. De student kan zo niet goed oefenen met wat T2 vraagt, en L2 (uitleggen wanneer je een mock gebruikt) wordt zelden zelfstandig geoefend.
- **de-clean/student**:
  - info T2: De titel "Praktijktoets testen" (week 6, 100% van het cijfer) laat niet zien wat een student moet doen of inleveren, bijvoorbeeld een testsuite, een uitleg of beide. Ook is niet te zien of hij binnen een bepaalde tijd gemaakt wordt of als opdracht thuis.
  - info A5: In week 3 staat alleen A5 (24 uur), terwijl week 1 en 2 samen 10 en 12 uur vragen. Daardoor is dit voor een student de zwaarste week, met een grote sprong ten opzichte van de weken ervoor.
  - info A5: In week 3 staat A5 (Projectopdracht, 24 uur) na weken van 10 en 12 uur. Week 5 blijft daarna leeg, terwijl de student in week 3 het grootste deel van zijn tijd kwijt is aan één opdracht.
  - info T2: T2 (summatief, week 6, 100%) heet alleen 'Praktijktoets testen'. Een student ziet daaraan niet wat hij moet maken of inleveren, en ook niet hoe 20 uur daarvoor is opgebouwd.
- **ae-linked-items-too-low/ai-resilience**:
  - info T2: Bij T2 (tentamen databases, 100% van het cijfer) is niet ingevuld of de toets onder toezicht is. De titel wijst op een tentamen, maar de gegevens laten dat niet met zekerheid zien.
  - info T2: T2 (tentamen databases, 100% van het cijfer) is een summatieve toets, maar er staat niet bij of die onder toezicht plaatsvindt. De titel wijst op een tentamen, maar dat laat niet zeker zien of het in een zaal of thuis wordt afgenomen.
- **pp-level-too-low/ai-resilience**:
  - info T1: T2 is onder toezicht, dus daar is niets aan te merken. De voorbereiding bestaat echter uit een stap-voor-stap tutorial (A2) en een codereview (T1), en die kan een student grotendeels door AI laten uitvoeren. Dan oefent de student niet echt voor T2.
  - info T1: T2 is onder toezicht en daarmee in orde. De enige voorbereiding is A2, een tutorial die stap voor stap te volgen is, plus de formatieve codereview T1, en die kan een student grotendeels door AI laten doen. Dan oefent de student er zelf weinig mee voor T2.
- Terecht overgeslagen: pp-advice-only-knowledge/ai-resilience, st-clean/student, in-all-written/ai-resilience, pp-wo-only-knowledge/ai-resilience

### Holdout

- **h06-en-statistics-clean/student**:
  - warning T3: Nothing in the course gives feedback on the survey-based research report (T3, week 9) before it counts: T1 (week 4) only covers the lab assignment, and the group project A5 starts in week 5 without any feedback moment. A student therefore hands in T3 without knowing whether their own-data analysis and reporting are on track.
  - warning T2: The only feedback on L1 and L2 comes in T1 (week 4), and it covers the week 3 assignment, so a student gets no feedback on exam-type work (running and interpreting tests in R under time pressure) before T2 in week 7.
  - warning T2: T2 (week 7) is a summative exam, and A5 (week 5, 40 h) is a heavy group project that runs right up to it. A student has to divide time between exam preparation and the project in weeks 5 to 7, and T3 follows two weeks later.
  - info A5: A5 is a 40-hour group project that starts in week 5, with no stated milestones, and the report (T3) is due in week 9. A student does not know what should be ready by when, and after a light start (2 to 4 hours in weeks 1, 2 and 4) the workload rises sharply in weeks 5 to 9.
  - info T1: T1 gives feedback on the lab assignment in week 4, but the title does not show how it is given (individually, in class, or in writing), or when the student receives it relative to the week 3 assignment.
  - info T3: T3 is titled 'Research report on your survey with oral discussion', but it is not clear to a student whether the report is individual or group work, given that A5 is a group project, nor when the oral discussion takes place.
  - info A5: A5 (group project, 40 h) sits in week 5 only, then the computer exam T2 follows in week 7, and weeks 6 and 8 show nothing. A student cannot tell from the schedule how the 40 hours are spread or when to work on the project versus prepare for the exam.
  - info T3: The only feedback (T1, week 4) is on the given dataset from A3, so before T3 in week 9 a student gets no feedback on their own survey analysis or on the report they must write. The report is the larger summative piece (30 h).
  - info T3: A5 is a group project, while T3 is a research report with oral discussion on 'your survey'. It is not clear whether a student writes the report alone or with the group, or what is graded individually.
- **h01-marketing-clean/student**:
  - info A5: In week 5 staat 'Opdracht: contentplan in teams' voor 40 uur, terwijl de weken ervoor 2 tot 24 uur vragen. Een student heeft dan in één week een volle werkweek aan teamwerk.
  - info T3: In week 7 staat geen activiteit of toets, terwijl T3 (rapport, 30 uur, 60%) in week 8 moet worden ingeleverd. De peerfeedback uit week 6 komt zo direct voor die week dat een student niet weet of week 7 bedoeld is om die feedback te verwerken.
  - info T4: T3 komt in week 8 en T4 (pitch en verdediging, 10 uur) in week 9, dus de pitchvoorbereiding valt in de week van het rapport. De pitchtraining (A6) was in week 6, drie weken eerder.
  - info A5: In week 5 staat voor 'Opdracht: contentplan in teams' 40 uur, terwijl week 7 leeg is. Een student heeft dan één week met een voltijdse werklast en daarna een week zonder werk.
  - info T4: T4 (pitch en verdediging, week 9) volgt direct op de inlevering van T3 (week 8, 30 uur). Een student moet de pitch voorbereiden terwijl hij het rapport nog afrondt.
- **h04-economics-deadline-clash/assessment-expert**:
  - info T1: Het oefententamen (T1) is een schriftelijke toets, maar L2 (evalueren) wordt summatief getoetst met een adviesrapport en mondelinge toelichting (T3). Studenten oefenen L2 dus niet in de vorm waarin ze beoordeeld worden.
  - info T3: T3 is een product zonder toezicht met een mondelinge toelichting, maar de gegevens laten niet zien hoe die toelichting meetelt of hoe je vaststelt dat het werk van de student zelf is.
  - info: Beide summatieve toetsen vallen in week 8, terwijl T3 al 40 uur kost. Dat geeft een piekbelasting en laat geen ruimte om bij T2 of T3 feedback te gebruiken voor de andere toets.
  - info T1: Het oefententamen (3 uur) dekt ook L2, maar L2 (evaluate) wordt summatief getoetst met een adviesrapport en een mondelinge toelichting. Studenten oefenen L2 dus niet in de vorm waarin ze getoetst worden.
  - info T3: T3 is een product van 40 uur zonder toezicht met een gewicht van 50%. Het is dan lastig vast te stellen of het advies het eigen werk van de student is.
  - info L2: L2 laat open welke kengetallen de student moet gebruiken en wanneer een beoordeling goed genoeg is. Dat maakt de beoordeling van T3 minder eenduidig.
- **h04-economics-deadline-clash/inclusion**:
  - info T2: T2 is een schriftelijk tentamen onder toezicht in één vorm en op één moment, en weegt 50% mee; L1 (berekenen) wordt alleen zo getoond. Wel staat er al een tweede vorm naast (T3) en is er een oefententamen (T1), dus het risico is beperkt.
  - info T3: T3 en T2 vallen allebei in week 8, en T3 vraagt 40 uur zelfstandig werk dat samenvalt met de tentamenperiode. Dat legt veel druk op één moment.
  - info A4: In A4 schrijven alle studenten een investeringsadvies voor dezelfde bakkerij; dat is een goede plek voor een kleine keuze (vermoeden: de casus is nu voor iedereen gelijk).
  - info A2: De werkvormen zijn vooral werkcolleges en individuele opgaven (A1, A2, A3); samen oefenen of bespreken is uit de titels niet te zien.
  - info T2: L1 wordt alleen getoetst met één schriftelijk tentamen onder toezicht in week 8; wie zich op die manier minder goed laat zien, heeft geen tweede kans of andere vorm. Dat T3 wel een mondelinge toelichting heeft, biedt voor L1 geen alternatief.
  - info T3: T2 en T3 vallen allebei in week 8, terwijl T3 een oplevering van circa 40 uur is. Dat legt veel druk op één week en maakt dat één slechte week zwaar telt.
  - info A4: Bij de casus over een bakkerij (A4) heeft iedereen vermoedelijk dezelfde casus. Er is geen zichtbare keuze of samenwerking.
- **h06-en-statistics-clean/inclusion**:
  - info T2: T2 is a 3-hour supervised computer exam in R, and it carries half the grade at a single moment, so one bad day or a technical hiccup weighs heavily.
  - info T2: T2 has every student show their skill in one way only: under time pressure, on a computer, in a fixed format.
  - info T3: T3 is a written report with oral discussion, and it is 30 hours unsupervised, so the form is mostly writing and the only other route is the discussion.
  - info A5: A5 is a 40-hour group project on your own survey data, so the ownership is already there, but the title does not show whether students can choose their topic or role.
  - info: Teaching is mainly a lecture (A1), a lab (A2), a seminar (A4) and two assignments, so it already mixes instruction and practice, but little of it shows students explaining or discussing their reasoning with each other before the assessments.
  - info T2: T2 is a 3-hour supervised computer exam in R, and it carries half the grade at a single moment. One bad day or a technical problem weighs heavily here.
  - info T2: T2 only lets students show L1 and L2 by working live in R under time pressure, while T3 already covers the same outcomes through a report and discussion.
  - info T3: T3 lets students choose their own survey topic, which is a good start. The form is fixed as a written report with oral discussion.
  - info A5: A5 is a 40-hour group project in week 5 with no visible interim moment. Students who work best in other ways, such as individually or with step-by-step feedback, have little to hold on to.
  - info A1: The first weeks lean on a lecture (A1), a lab (A2) and a seminar (A4). From the titles alone it is hard to tell how much students discuss or practise together.
- **h08-construction-order/student**:
  - info A1: In week 1 krijgt de student een opdracht van 16 uur om de balklaag door te rekenen, terwijl de instructie over belastingen en sterkteleer (A2) pas in week 3 komt. Week 2 is helemaal leeg.
  - info T3: De praktijktoets in week 8 (4 uur, onder toezicht, 100%) is de enige summatieve toets. In week 7 staat verder niets gepland. De student weet daardoor niet wat hij in die week moet doen om zich voor te bereiden.
  - info A1: In week 1 begint de student aan een opdracht van 16 uur om de balklaag door te rekenen, maar de instructie over belastingen en sterkteleer (A2) volgt pas in week 3. Week 2 is leeg, dus de student weet niet goed wat hij in die week moet doen.
- **h09-law-feedback-late/inclusion**:
  - info T2: T2 is een schriftelijk casustentamen onder toezicht van 3 uur, en T3 is een geschreven rapport. Beide summatieve toetsen laten dus werk in schrijfvorm zien.
  - info T3: T3 is een geschreven adviesrapport, terwijl L2 ('een juridisch advies aan een cliënt') ook in andere vormen is te laten zien. Vermoedelijk is er nu één vorm voor de hele L2.
  - info T2: T2 en T1 vallen allebei in week 7, en T2 is de enige toets voor L1 en weegt dus volledig voor die uitkomst: één moment, één vorm.
  - info A1: De contactmomenten zijn een hoorcollege (A1) en twee werkgroepen (A2, A3); er is al enige afwisseling, maar A1 is de enige kennisoverdracht en de voorbereiding lijkt zelfstandig.
  - info T2: T2 is een schriftelijk casustentamen onder toezicht van 3 uur en weegt voor L1 zwaar op één moment, terwijl T3 ook schriftelijk is. Alle summatieve toetsen vragen dus om schriftelijk laten zien.
  - info T3: T3 is een geschreven adviesrapport van 20 uur zonder toezicht, terwijl L2 (een advies aan een cliënt) ook in andere vormen te laten zien is.
  - info T2: T2 en T1 vallen allebei in week 7 en T2 is de enige toets voor L1. Eén slechte dag weegt daardoor zwaar voor die leeruitkomst.
  - info A1: De enige activiteit voor kennisopbouw in week 1 is een hoorcollege (A1) van 2 uur; daarna volgen werkgroepen en een opdracht, dus er is al redelijke afwisseling. Het is een vermoeden dat de stof uit A1 alleen live beschikbaar is.
  - info A4: A4 (adviesbrief aan de cliënt) lijkt voor alle studenten dezelfde casus en vorm te hebben.
- **h10-business-advice-clean/student**:
  - info A4: A4 (adviesrapport, 40 uur) valt volledig in week 5, terwijl er in week 3 en week 7 niets gepland staat. Een student moet in één week een bijna volledige werkweek aan het rapport besteden om in week 6 een conceptadvies voor de peerreview (T2) te hebben.
  - info T3: Voor een student is niet duidelijk hoe A4 (adviesrapport, week 5), het conceptadvies in T2 (week 6) en het adviesrapport in T3 (week 8) zich tot elkaar verhouden. Het is onduidelijk wat in week 5 moet worden ingeleverd en wat in week 8 definitief beoordeeld wordt.
  - info A4: A4 (adviesrapport voor de opdrachtgever) is 40 uur in week 5, terwijl het conceptadvies pas in week 6 peerreview krijgt. Een student moet dan in één week bijna een volle werkweek aan deze cursus besteden, en week 3 en 7 blijven leeg.
- **h11-ict-level3-stepwise/ai-resilience**:
  - info T2: T2 is een summatief praktijkexamen van 100% onder toezicht, dus AI-gebruik is hier geen groot risico. Het examen volgt wel het stappenplan, waardoor het vooral laat zien of de student een bekende procedure kan uitvoeren, niet of hij of zij zelf kan ontwerpen.
  - info T1: T1 (aftekenen van de labopdrachten) is formatief en dus vrij, maar de labopdrachten in A2 volgen een stappenhandleiding die een student met AI kan laten uitvoeren of uitwerken. Daardoor oefent de student mogelijk niet echt met wat T2 onder toezicht vraagt.
- Terecht overgeslagen: h03-nursing-skills-by-lecture/ai-resilience, h08-construction-order/ai-resilience

## Waarom een reviewer wél draaide

| Reden | Keer |
| --- | --- |
| professional-practice.professional-activity | 171 |
| feedbackNotBefore | 138 |
| loadPeak | 105 |
| gradeOnOneTest | 96 |
| assessment-expert.bloom-mismatch | 92 |
| ai-resilience.home-product | 84 |
| inclusion.one-test-form | 78 |
| assessment-expert.outcomes-differ | 76 |
| emptyWeeks | 66 |
| professional-practice.practice-situation | 47 |
| professional-practice.test-like-work | 35 |
| assessment-expert.several-actions | 35 |
| inclusion.one-way-of-learning | 34 |
| designer.only-lectures | 23 |
| assessment-expert.vague | 18 |
| assessment-expert.pack-fit | 18 |
| ai-resilience.home-work-presented | 17 |
| designer.hours-off | 16 |
| student.clear-assignment | 12 |
| summativeSameWeek | 9 |
| designer.order | 7 |
| assessment-expert.knowledge-test | 6 |
| professional-practice.step-by-step | 6 |
| outcomeLittleTime | 6 |
| student.clear-title | 6 |
| designer.off-topic | 3 |
| linked-work | 3 |

## Snelheid en kosten

- Jev: 111 verzoeken (één per cursus en herhaling, alle reviewers samen), gemiddeld 268 ms, hoogst 557 ms; samen $0.01963 (gemeten).
- Overgeslagen reviewer-aanroepen: 24 van 222 (11%).
- Een reviewer-aanroep kost gemiddeld $0.0137 (API-lijstprijs van de reviews in deze meting). Jev per cursus: $0.00018.
