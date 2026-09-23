/* ===== Bulk Forge — data tables ===== */

const BANGLA_MALE_FIRST = ["Rahim","Karim","Jahid","Mahmudur","Rakibul","Shakil","Tanvir","Rasel","Nayeem","Foysal","Arif","Sajib","Emon","Rubel","Hasan","Mizan","Anisur","Shahin","Delwar","Kamrul","Faruk","Nazrul","Habibur","Zahid","Mostafa","Alamgir","Rafiqul","Shamim","Iqbal","Mahbub","Zakir","Aminul","Selim","Golam","Sohel","Masud","Ashraf","Nurul","Abdul","Monir","Rashed","Imran","Tareq","Kamal","Jamal","Bulbul","Shafiq","Riyad","Tanjil","Sabbir","Rifat","Fahim","Naimul","Robiul","Asaduzzaman","Shaon","Mehedi","Firoz","Anwar","Yusuf","Ibrahim","Sultan","Moinul","Rezaul","Manik","Liton","Milton","Sujon","Palash","Tuhin","Anik","Ovi","Shanto","Rahat","Nabil","Sazzad","Wasim","Zubair","Tamim","Adnan","Rakib","Sourav","Apon","Rian","Ridoy","Sifat","Antor","Prince","Turjo","Shovon","Rupom","Bappy","Habib","Munna","Sagor","Joy","Rony","Robin","Tanim","Ahnaf","Rafsan"];

const BANGLA_FEMALE_FIRST = ["Nusrat","Sumaiya","Farzana","Taslima","Shirin","Rehana","Salma","Nasrin","Ruma","Shathi","Jesmin","Rina","Momtaz","Halima","Rabeya","Marufa","Sultana","Ferdousi","Kohinoor","Parveen","Shahida","Rokeya","Ayesha","Fatema","Jannatul","Mim","Tania","Nishat","Tasnim","Israt","Priya","Moushumi","Shampa","Lipi","Poly","Runa","Rupa","Shathy","Sanjida","Mahfuza","Sabrina","Shama","Nazma","Dilruba","Khadija","Mahmuda","Farhana","Anika","Tanjina","Rumana","Bithi","Mukta","Sathi","Papia","Hasina","Suraiya","Sabina","Lucky","Munni","Toma","Trisha","Orin","Nodi","Mitu","Liza","Onni","Puja","Bristi","Shorna","Turin","Prapti","Ishika","Mahima","Shanjida","Rifah","Adiba","Zara","Ayra","Nawrin","Sadia","Tabassum","Anjum","Rima","Sharmin","Afroza","Kulsum","Meherun","Shamsun","Zubaida","Rowshan","Nurjahan","Bilkis","Amina","Hafsa","Zannat","Labiba","Erin","Nova","Mahia","Rifta","Adity"];

const BANGLA_LAST = ["Rahman","Islam","Hossain","Ahmed","Chowdhury","Khan","Ali","Uddin","Akter","Sarkar","Talukder","Molla","Sheikh","Mia","Bhuiyan","Khandaker","Pramanik","Mondol","Biswas","Das","Roy","Sen","Dutta","Barua","Chakraborty","Debnath","Saha","Ghosh","Paul","Halder","Majumder","Mollick","Sardar","Munshi","Miah","Mridha","Siddiqui","Ansari","Qureshi","Hawlader","Mallik","Akand","Sana","Bepari","Sikder","Molik","Fakir","Mostafi","Kabir","Karim","Rashid","Aziz","Haque","Malek","Alam","Kader","Zaman","Noor","Salam","Wahid","Jabbar","Latif","Momin","Bashar","Nasir","Sattar","Hakim","Elahi","Yasin","Osman","Mahmud","Ferdous","Anwar","Kashem","Ripon","Manik","Tarafdar","Adhikari","Pal","Nag","Basak","Modak","Dey","Guha","Bose","Bhattacharjee","Gupta","Shil","Kar","Nandi","Chanda","Ray","Deb","Dhar","Baidya","Karmakar","Barman","Nath","Bagchi","Chaudhuri","Bhowmik","Rakshit","Kundu","Ahsan","Anam","Prodhan","Toha","Zaved","Rafi"];

/* Theme character pools — [First, Last, Gender] gender: 'M' | 'F' */
const THEME_POOLS = {
  bangla: null, /* built from the lists above at runtime */
  got: [
    ["Jon","Snow","M"],["Daenerys","Targaryen","F"],["Tyrion","Lannister","M"],["Cersei","Lannister","F"],
    ["Jaime","Lannister","M"],["Arya","Stark","F"],["Sansa","Stark","F"],["Bran","Stark","M"],
    ["Robb","Stark","M"],["Catelyn","Stark","F"],["Ned","Stark","M"],["Theon","Greyjoy","M"],
    ["Brienne","Tarth","F"],["Samwell","Tarly","M"],["Davos","Seaworth","M"],["Melisandre","Asshai","F"],
    ["Petyr","Baelish","M"],["Sandor","Clegane","M"],["Gregor","Clegane","M"],["Varys","Spider","M"],
    ["Missandei","Naath","F"],["Grey","Worm","M"],["Robert","Baratheon","M"],["Stannis","Baratheon","M"],
    ["Renly","Baratheon","M"],["Margaery","Tyrell","F"],["Olenna","Tyrell","F"],["Loras","Tyrell","M"],
    ["Tywin","Lannister","M"],["Joffrey","Baratheon","M"],["Tommen","Baratheon","M"],["Myrcella","Baratheon","F"],
    ["Ygritte","Wildling","F"],["Tormund","Giantsbane","M"],["Bronn","Blackwater","M"],["Gendry","Baratheon","M"],
    ["Podrick","Payne","M"],["Shae","Lorath","F"],["Ramsay","Bolton","M"],["Roose","Bolton","M"],
    ["Yara","Greyjoy","F"],["Euron","Greyjoy","M"],["Oberyn","Martell","M"],["Ellaria","Sand","F"],
    ["Jorah","Mormont","M"],["Lyanna","Mormont","F"]
  ],
  hp: [
    ["Harry","Potter","M"],["Hermione","Granger","F"],["Ron","Weasley","M"],["Ginny","Weasley","F"],
    ["Fred","Weasley","M"],["George","Weasley","M"],["Percy","Weasley","M"],["Bill","Weasley","M"],
    ["Charlie","Weasley","M"],["Molly","Weasley","F"],["Arthur","Weasley","M"],["Draco","Malfoy","M"],
    ["Neville","Longbottom","M"],["Luna","Lovegood","F"],["Albus","Dumbledore","M"],["Minerva","McGonagall","F"],
    ["Severus","Snape","M"],["Rubeus","Hagrid","M"],["Sirius","Black","M"],["Remus","Lupin","M"],
    ["Nymphadora","Tonks","F"],["Bellatrix","Lestrange","F"],["Lucius","Malfoy","M"],["Narcissa","Malfoy","F"],
    ["Cho","Chang","F"],["Cedric","Diggory","M"],["Fleur","Delacour","F"],["Viktor","Krum","M"],
    ["Dolores","Umbridge","F"],["Horace","Slughorn","M"],["Filius","Flitwick","M"],["Pomona","Sprout","F"],
    ["Alastor","Moody","M"],["Kingsley","Shacklebolt","M"],["Dean","Thomas","M"],["Seamus","Finnigan","M"],
    ["Lavender","Brown","F"],["Parvati","Patil","F"],["Padma","Patil","F"],["Oliver","Wood","M"],
    ["Angelina","Johnson","F"],["Katie","Bell","F"],["Colin","Creevey","M"],["Xenophilius","Lovegood","M"]
  ],
  marvel: [
    ["Tony","Stark","M"],["Steve","Rogers","M"],["Natasha","Romanoff","F"],["Bruce","Banner","M"],
    ["Thor","Odinson","M"],["Clint","Barton","M"],["Peter","Parker","M"],["Wanda","Maximoff","F"],
    ["Vision","Android","M"],["Stephen","Strange","M"],["Carol","Danvers","F"],["Scott","Lang","M"],
    ["Sam","Wilson","M"],["Bucky","Barnes","M"],["Nick","Fury","M"],["Peggy","Carter","F"],
    ["James","Rhodes","M"],["Pepper","Potts","F"],["Hope","Pym","F"],["Hank","Pym","M"],
    ["Gamora","Zenwhirr","F"],["Peter","Quill","M"],["Drax","Destroyer","M"],["Rocket","Raccoon","M"],
    ["Groot","Flora","M"],["Loki","Odinson","M"],["Nebula","Luphomoid","F"],["Mantis","Empath","F"],
    ["Matt","Murdock","M"],["Jessica","Jones","F"],["Luke","Cage","M"],["Danny","Rand","M"],
    ["Wade","Wilson","M"],["Charles","Xavier","M"],["Erik","Lehnsherr","M"],["Jean","Grey","F"],
    ["Ororo","Munroe","F"],["Scott","Summers","M"],["Logan","Howlett","M"],["Kurt","Wagner","M"],
    ["Kitty","Pryde","F"],["Reed","Richards","M"],["Susan","Storm","F"],["Johnny","Storm","M"],
    ["Ben","Grimm","M"],["Shuri","Udaku","F"]
  ],
  dc: [
    ["Bruce","Wayne","M"],["Clark","Kent","M"],["Diana","Prince","F"],["Barry","Allen","M"],
    ["Hal","Jordan","M"],["Arthur","Curry","M"],["Victor","Stone","M"],["Dick","Grayson","M"],
    ["Barbara","Gordon","F"],["Jason","Todd","M"],["Tim","Drake","M"],["Damian","Wayne","M"],
    ["Selina","Kyle","F"],["Harvey","Dent","M"],["Edward","Nygma","M"],["Oswald","Cobblepot","M"],
    ["Pamela","Isley","F"],["Harleen","Quinzel","F"],["Jonathan","Crane","M"],["Victor","Fries","M"],
    ["Lex","Luthor","M"],["Kara","Zorel","F"],["Billy","Batson","M"],["Kate","Kane","F"],
    ["John","Constantine","M"],["Oliver","Queen","M"],["Dinah","Lance","F"],["Roy","Harper","M"],
    ["Kaldur","Ahm","M"],["Wally","West","M"],["Bart","Allen","M"],["John","Stewart","M"],
    ["Kyle","Rayner","M"],["Guy","Gardner","M"],["Jon","Jonzz","M"],["Zatanna","Zatara","F"],
    ["Helena","Wayne","F"],["Cassandra","Cain","F"],["Stephanie","Brown","F"],["Alfred","Pennyworth","M"],
    ["Lucius","Fox","M"],["Amanda","Waller","F"],["Rick","Flag","M"],["Ted","Kord","M"]
  ],
  games: [
    ["Mario","Mario","M"],["Luigi","Mario","M"],["Link","Hyrule","M"],["Zelda","Hyrule","F"],
    ["Samus","Aran","F"],["Kratos","Spartan","M"],["Master","Chief","M"],["Lara","Croft","F"],
    ["Nathan","Drake","M"],["Ellie","Williams","F"],["Joel","Miller","M"],["Geralt","Rivia","M"],
    ["Gordon","Freeman","M"],["Cloud","Strife","M"],["Tifa","Lockhart","F"],["Aerith","Gainsborough","F"],
    ["Sephiroth","Crescent","M"],["Solid","Snake","M"],["Big","Boss","M"],["Dante","Sparda","M"],
    ["Vergil","Sparda","M"],["Bayonetta","Cereza","F"],["Chun","Li","F"],["Ryu","Hoshi","M"],
    ["Kazuya","Mishima","M"],["Jin","Kazama","M"],["Sub","Zero","M"],["Scorpion","Hanzo","M"],
    ["Ezio","Auditore","M"],["Connor","Kenway","M"],["Aloy","Nora","F"],["Kassandra","Spartan","F"],
    ["Commander","Shepard","M"],["Marcus","Fenix","M"],["Jill","Valentine","F"],["Leon","Kennedy","M"],
    ["Chris","Redfield","M"],["Ada","Wong","F"],["Yuna","Besaid","F"],["Tidus","Zanarkand","M"]
  ],
  squidgame: [
    ["Gi-hun","Seong","M"],["Sang-woo","Cho","M"],["Sae-byeok","Kang","F"],["Il-nam","Oh","M"],
    ["Mi-nyeo","Han","F"],["Deok-su","Jang","M"],["Ali","Abdul","M"],["Jun-ho","Hwang","M"],
    ["In-ho","Hwang","M"],["Myung-gi","Lee","M"],["Jun-hee","Kim","F"],["Geum-ja","Jang","F"],
    ["Hyun-ju","Park","F"]
  ],
  strangerthings: [
    ["Mike","Wheeler","M"],["Jane","Hopper","F"],["Dustin","Henderson","M"],["Lucas","Sinclair","M"],
    ["Will","Byers","M"],["Max","Mayfield","F"],["Steve","Harrington","M"],["Nancy","Wheeler","F"],
    ["Jonathan","Byers","M"],["Robin","Buckley","F"],["Eddie","Munson","M"],["Jim","Hopper","M"],
    ["Joyce","Byers","F"],["Murray","Bauman","M"],["Erica","Sinclair","F"],["Billy","Hargrove","M"],
    ["Henry","Creel","M"],["Suzie","Bingham","F"],["Karen","Wheeler","F"],["Martin","Brenner","M"]
  ],
  moneyheist: [
    ["Sergio","Marquina","M"],["Silene","Oliveira","F"],["Andres","Fonollosa","M"],["Agata","Jimenez","F"],
    ["Anibal","Cortes","M"],["Daniel","Ramos","M"],["Agustin","Ramos","M"],["Mirko","Dragic","M"],
    ["Radko","Dragic","M"],["Raquel","Murillo","F"],["Alicia","Sierra","F"],["Martin","Berrote","M"],
    ["Monica","Gaztambide","F"],["Arturo","Roman","M"],["Angel","Rubio","M"]
  ],
  breakingbad: [
    ["Walter","White","M"],["Jesse","Pinkman","M"],["Skyler","White","F"],["Hank","Schrader","M"],
    ["Marie","Schrader","F"],["Flynn","White","M"],["Saul","Goodman","M"],["Mike","Ehrmantraut","M"],
    ["Gustavo","Fring","M"],["Tuco","Salamanca","M"],["Hector","Salamanca","M"],["Lydia","Rodarte-Quayle","F"],
    ["Todd","Alquist","M"],["Jane","Margolis","F"],["Andrea","Cantillo","F"],["Huell","Babineaux","M"],
    ["Brandon","Mayhew","M"]
  ],
  anime: [
    ["Naruto","Uzumaki","M"],["Sasuke","Uchiha","M"],["Sakura","Haruno","F"],["Kakashi","Hatake","M"],
    ["Itachi","Uchiha","M"],["Hinata","Hyuga","F"],["Izuku","Midoriya","M"],["Katsuki","Bakugo","M"],
    ["Ochaco","Uraraka","F"],["Shoto","Todoroki","M"],["Ichigo","Kurosaki","M"],["Light","Yagami","M"],
    ["Edward","Elric","M"],["Alphonse","Elric","M"],["Eren","Yeager","M"],["Mikasa","Ackerman","F"],
    ["Levi","Ackerman","M"],["Armin","Arlert","M"],["Tanjiro","Kamado","M"],["Nezuko","Kamado","F"],
    ["Zenitsu","Agatsuma","M"],["Inosuke","Hashibira","M"],["Goku","Son","M"],["Usagi","Tsukino","F"],
    ["Gon","Freecss","M"],["Killua","Zoldyck","M"],["Spike","Spiegel","M"],["Lelouch","Lamperouge","M"],
    ["Asuna","Yuuki","F"],["Kazuto","Kirigaya","M"],["Anya","Forger","F"],["Loid","Forger","M"],
    ["Yor","Forger","F"]
  ],
  cricket: [
    ["Sachin","Tendulkar","M"],["Virat","Kohli","M"],["Mahendra","Dhoni","M"],["Rohit","Sharma","M"],
    ["Shakib","Al Hasan","M"],["Tamim","Iqbal","M"],["Mushfiqur","Rahim","M"],["Mashrafe","Mortaza","M"],
    ["Babar","Azam","M"],["Kane","Williamson","M"],["Steve","Smith","M"],["Ben","Stokes","M"],
    ["Joe","Root","M"],["Jasprit","Bumrah","M"],["Rashid","Khan","M"],["AB","de Villiers","M"],
    ["Chris","Gayle","M"],["Brian","Lara","M"],["Ricky","Ponting","M"],["Wasim","Akram","M"],
    ["Imran","Khan","M"],["Mithali","Raj","F"],["Jhulan","Goswami","F"],["Nigar","Sultana","F"]
  ],
  football: [
    ["Lionel","Messi","M"],["Cristiano","Ronaldo","M"],["Kylian","Mbappe","M"],["Erling","Haaland","M"],
    ["Kevin","De Bruyne","M"],["Mohamed","Salah","M"],["Robert","Lewandowski","M"],["Luka","Modric","M"],
    ["Virgil","van Dijk","M"],["Sergio","Ramos","M"],["Zinedine","Zidane","M"],["David","Beckham","M"],
    ["Andres","Iniesta","M"],["Xavi","Hernandez","M"],["Antoine","Griezmann","M"],["Luis","Suarez","M"],
    ["Manuel","Neuer","M"],["Toni","Kroos","M"],["Heung-min","Son","M"],["Neymar","Jr","M"],
    ["Sabina","Khatun","F"],["Alex","Morgan","F"],["Megan","Rapinoe","F"],["Sam","Kerr","F"]
  ],
  wweufc: [
    ["John","Cena","M"],["Dwayne","Johnson","M"],["Roman","Reigns","M"],["Randy","Orton","M"],
    ["Paul","Levesque","M"],["Mark","Calaway","M"],["Charlotte","Flair","F"],["Becky","Lynch","F"],
    ["Rhea","Ripley","F"],["Seth","Rollins","M"],["Kevin","Owens","M"],["AJ","Styles","M"],
    ["Brock","Lesnar","M"],["Rey","Mysterio","M"],["Bianca","Belair","F"],["Cody","Rhodes","M"],
    ["Conor","McGregor","M"],["Khabib","Nurmagomedov","M"],["Jon","Jones","M"],["Israel","Adesanya","M"],
    ["Amanda","Nunes","F"],["Ronda","Rousey","F"],["Valentina","Shevchenko","F"],["Islam","Makhachev","M"]
  ],
  friends: [
    ["Ross","Geller","M"],["Rachel","Green","F"],["Monica","Geller","F"],["Chandler","Bing","M"],
    ["Joey","Tribbiani","M"],["Phoebe","Buffay","F"],["Janice","Litman","F"],["Mike","Hannigan","M"],
    ["Richard","Burke","M"],["Barry","Farber","M"],["Carol","Willick","F"],["Susan","Bunch","F"],
    ["Estelle","Leonard","F"]
  ]
};

const NAME_THEME_LABELS = {
  bangla: "Default (Random Bangla Names)",
  got: "Game of Thrones",
  hp: "Harry Potter",
  marvel: "Marvel",
  dc: "DC",
  games: "Games Character",
  squidgame: "Squid Game",
  strangerthings: "Stranger Things",
  moneyheist: "Money Heist",
  breakingbad: "Breaking Bad",
  anime: "Anime Characters",
  cricket: "Cricketers",
  football: "Footballers",
  wweufc: "WWE / UFC Athletes",
  friends: "Friends"
};

const DEFAULT_DEPARTMENTS = [
  { id: "hr", name: "HR", designations: ["HR Executive","HR Manager","Recruiter","HR Business Partner"] },
  { id: "eng", name: "Engineering/IT", designations: ["Software Engineer","QA Engineer","DevOps Engineer","Engineering Manager"] },
  { id: "sales", name: "Sales & Business", designations: ["Sales Executive","Business Development Manager","Sales Manager","Key Account Manager"] },
  { id: "marketing", name: "Marketing", designations: ["Marketing Executive","Digital Marketing Specialist","Content Manager","Marketing Manager"] },
  { id: "finance", name: "Finance & Accounts", designations: ["Accounts Executive","Finance Manager","Accountant","Financial Analyst"] },
  { id: "ops", name: "Operations", designations: ["Operations Executive","Operations Manager","Logistics Coordinator","Process Analyst"] }
];

/* ===== Attendance Add ===== */

/* Weekday index matches JS Date#getDay(): 0 = Sunday. */
const WEEKDAYS = [
  { day: 0, label: "Sun" },
  { day: 1, label: "Mon" },
  { day: 2, label: "Tue" },
  { day: 3, label: "Wed" },
  { day: 4, label: "Thu" },
  { day: 5, label: "Fri" },
  { day: 6, label: "Sat" }
];

const DEFAULT_WEEKEND = [5, 6]; /* Friday + Saturday */

/* The four time formats the real template accepts. The first three are the
   formats its own three example rows use; HH:MM is the 24-hour form its
   column description names explicitly. */
const TIME_FORMATS = [
  { id: "h12", label: "09:00 AM", sub: "12-hour" },
  { id: "h24", label: "17:00", sub: "24-hour" },
  { id: "h24s", label: "09:15:45", sub: "24-hour + seconds" },
  { id: "h12s", label: "09:30:45 AM", sub: "12-hour + seconds" }
];

/* Holidays, taken from Shomvob's own HR system (Holiday Management →
   2026 → All → Active) rather than a government gazette, because that is
   the calendar the test data has to line up with. Every date here was read
   off that screen — none is a guess, unlike the draft this replaced.

   Two things the source does that this format flattens:
   - Eid is stored there as a date *range* (Eid ul-Fitr 19–23 Mar, Eid
     ul-Adha 26–31 May). Each day is its own entry here, so the rest of the
     code can keep treating a holiday as a single date.
   - Two names can share one date — 1 May is both May Day and Buddha
     Purnima, 20 Mar is both an Eid day and Jumatul Bidah. One entry per
     date, both names in the label.

   Three entries on that screen were left out deliberately: "Test"
   (29 Jun), "Chuti" (8 Jul) and "S/B" (22 Jul) are somebody's test rows in
   the demo account, not holidays, and treating them as such would turn
   three working days into holidays.

   Only 2026 is covered — the user does not need earlier years. A date
   range in a year with no entry here simply gets no holidays, and the UI
   says so rather than silently pretending there are none. Adding a year is
   one more key. */
const BD_HOLIDAYS = {
  2026: [
    ["2026-02-04", "Shab e-Barat"],
    ["2026-02-11", "Election Day"],
    ["2026-02-12", "Election Day Holiday"],
    ["2026-02-21", "Language Martyrs' Day"],
    ["2026-03-17", "Shab-e-qadr"],
    ["2026-03-19", "Eid ul-Fitr"],
    ["2026-03-20", "Eid ul-Fitr / Jumatul Bidah"],
    ["2026-03-21", "Eid ul-Fitr"],
    ["2026-03-22", "Eid ul-Fitr"],
    ["2026-03-23", "Eid ul-Fitr"],
    ["2026-03-26", "Independence Day"],
    ["2026-04-13", "Chaitra Sankranti"],
    ["2026-04-14", "Bengali New Year"],
    ["2026-05-01", "May Day / Buddha Purnima-Vesak"],
    ["2026-05-26", "Eid ul-Adha"],
    ["2026-05-27", "Eid ul-Adha"],
    ["2026-05-28", "Eid ul-Adha"],
    ["2026-05-29", "Eid ul-Adha"],
    ["2026-05-30", "Eid ul-Adha"],
    ["2026-05-31", "Eid ul-Adha"],
    ["2026-06-17", "Muharram"],
    ["2026-06-26", "Ashura"],
    ["2026-08-05", "Student-People Uprising Day"],
    ["2026-08-26", "Eid e-Milad-un Nabi"],
    ["2026-10-20", "Mahanabami"],
    ["2026-10-21", "Durga Puja"],
    ["2026-12-16", "Victory Day"],
    ["2026-12-25", "Christmas Day"]
  ]
};

const ATTENDANCE_HEADER = ["Employee ID*", "Date*", "In Time*", "Out Time*"];
const ATTENDANCE_SHEET = "Attendance_Bulk_Import";

/* ===== Leave Balance Add ===== */

/* Unlike the other operations, this one does not build a file from
   scratch — the user uploads the system's own export and only the
   "Already Used Leave" column is filled in. So these are the headers we
   look FOR, not headers we invent. Matched case-insensitively on the
   uploaded sheet, since only the export produces them. */
const LEAVE_COLUMNS = {
  id: "Employee ID",
  name: "Employee Name",
  type: "Leave Type Name",
  total: "Total Allocated",
  earned: "Earned Leave",
  used: "Already Used Leave"
};

/* The export's sheet name, already truncated to Excel's 31-character
   limit ("..._Update" lost its "te"). Used only if an uploaded file
   somehow carries no sheet name — normally we round-trip whatever the
   upload had. */
const LEAVE_SHEET_FALLBACK = "Leave_Balance_Already_Used_Upda";

/* Leave actually taken lands on half days, so every generated value is a
   multiple of 0.5 — 4, 4.5, 5, 5.5 are all valid. */
const LEAVE_STEP = 0.5;

/* How much of the year's leave is plausibly used up by now: the generated
   value sits between these fractions of (ceiling x year-progress), so an
   October file shows materially more used than a January one. */
const LEAVE_BAND = { low: 0.6, high: 1.0 };

/* ===== Payroll Custom Field Value Add ===== */

/* Another export the user fills in rather than a blank template. Only the
   two identity columns are known ahead of time; every column after them is
   a custom addition or deduction the company configured itself, so the
   field names — typos and all — are read from the uploaded header. */
const PAYROLL_COLUMNS = { id: "Employee ID", name: "Employee Name" };

/* Field headers carry their sign as a suffix: "Win Quiditch Match (+)",
   "Friends With Malfoy (-)". Both signs draw from the same amount range —
   the header already says which way the money moves, so values stay
   positive. */
const PAYROLL_SIGN_RE = /^(.*?)\s*\((\+|-)\)$/;

/* Coverage is a plain percentage dropdown, applied per cell. Below 100%
   this leaves some employees untouched across every field, which is what
   real payroll looks like. */
const PAYROLL_COVERAGE_OPTIONS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

const PAYROLL_DEFAULTS = { coverage: 30, min: 500, max: 10000, step: 100 };

/* ===== Assets Add ===== */

const ASSETS_HEADER = [
  "Asset Image",
  "Asset Code*",
  "Asset Name*",
  "Asset Type*",
  "Asset Description",
  "Assigned Employee ID",
  "Assigned Date"
];
const ASSETS_SHEET = "Assets_List_Upload";

/* Between 70% and 80% of assets get an employee; the rest stay
   unassigned, with Assigned Employee ID and Assigned Date both blank.
   Both columns are optional in the template, so that is a valid file. The
   user asked for this band with no input to control it. */
const ASSETS_ASSIGNED_BAND = { low: 70, high: 80 };

/* How far back an Assigned Date may fall, in days. Never in the future. */
const ASSETS_ASSIGNED_WINDOW_DAYS = 365;

/* Each entry is [name, description] so the two columns always agree — a
   monitor never inherits a laptop's description. The template's own
   example rows mismatch name and type on purpose, which told us Asset
   Type is a free category rather than something derived from the name. */
const DEFAULT_ASSET_TYPES = [
  { id: "laptops", name: "Laptops", items: [
    ["HP EliteBook 840 G9", "14-inch business laptop, 16GB RAM / 512GB SSD"],
    ["Dell Latitude 5430", "14-inch laptop, i5 / 16GB RAM / 256GB SSD"],
    ["Lenovo ThinkPad T14", "14-inch laptop, i7 / 16GB RAM / 512GB SSD"],
    ["MacBook Air M2", "13-inch MacBook, 8GB unified memory / 256GB SSD"],
    ["Asus ExpertBook B9", "14-inch ultralight laptop, 16GB RAM / 1TB SSD"],
    ["HP ProBook 450 G10", "15-inch laptop, i5 / 8GB RAM / 512GB SSD"]
  ] },
  { id: "desktops", name: "Desktops", items: [
    ["Dell OptiPlex 7010 SFF", "Small form factor desktop, i5 / 16GB RAM"],
    ["HP ProDesk 400 G9", "Mini tower desktop, i5 / 8GB RAM / 512GB SSD"],
    ["Lenovo ThinkCentre M70q", "Tiny desktop, i5 / 16GB RAM / 512GB SSD"],
    ["Asus ExpertCenter D700", "Tower desktop, i7 / 16GB RAM / 1TB HDD"],
    ["Intel NUC 13 Pro", "Mini PC, i5 / 16GB RAM / 512GB SSD"]
  ] },
  { id: "monitors", name: "Monitors", items: [
    ["Dell P2422H 24\"", "24-inch IPS monitor, 1920x1080, height adjustable"],
    ["LG 27UP550 27\"", "27-inch 4K IPS monitor with USB-C"],
    ["Samsung S36C 24\"", "24-inch curved monitor, 1920x1080, 75Hz"],
    ["HP E24 G5 24\"", "24-inch IPS monitor, 1920x1080, pivot stand"],
    ["Asus ProArt PA248QV", "24-inch colour-calibrated monitor, 1920x1200"]
  ] },
  { id: "mobile", name: "Mobile Devices", items: [
    ["Samsung Galaxy A54", "Android phone, 8GB RAM / 128GB storage"],
    ["iPhone 14", "iOS phone, 128GB storage"],
    ["Xiaomi Redmi Note 13", "Android phone, 6GB RAM / 128GB storage"],
    ["Samsung Galaxy Tab A9+", "11-inch Android tablet, 64GB storage"],
    ["iPad 10th Gen", "10.9-inch tablet, 64GB storage, Wi-Fi"]
  ] },
  { id: "printers", name: "Printers & Scanners", items: [
    ["HP LaserJet Pro M404dn", "Mono laser printer with duplex and network"],
    ["Canon imageCLASS MF445dw", "Mono laser multifunction, print/scan/copy"],
    ["Epson EcoTank L3250", "Colour inkjet all-in-one with refillable tanks"],
    ["Brother HL-L2350DW", "Compact mono laser printer, wireless"],
    ["Canon CanoScan LiDE 300", "Flatbed document scanner, 600 dpi"]
  ] },
  { id: "networking", name: "Networking", items: [
    ["TP-Link Archer AX55", "Dual-band Wi-Fi 6 router, AX3000"],
    ["Cisco Catalyst 1000-24T", "24-port managed gigabit switch"],
    ["Ubiquiti UniFi U6-Lite", "Ceiling-mount Wi-Fi 6 access point"],
    ["Netgear GS308 8-port", "Unmanaged 8-port gigabit desktop switch"],
    ["MikroTik hEX S", "Gigabit router with SFP and PoE out"]
  ] },
  { id: "peripherals", name: "Peripherals", items: [
    ["Logitech MX Master 3S", "Wireless ergonomic mouse, USB-C rechargeable"],
    ["Logitech K380 Keyboard", "Compact multi-device Bluetooth keyboard"],
    ["Jabra Evolve2 40", "USB wired headset with noise-cancelling mic"],
    ["Logitech C920 HD Pro", "1080p USB webcam with stereo mics"],
    ["Anker 7-in-1 USB-C Hub", "USB-C dock with HDMI, ethernet and card reader"],
    ["APC BX1100C-IN UPS", "1100VA line-interactive UPS with AVR"]
  ] },
  { id: "furniture", name: "Furniture", items: [
    ["Ergonomic Office Chair", "Mesh-back chair with lumbar support and armrests"],
    ["Height-Adjustable Desk", "Electric sit-stand desk, 120x60 cm"],
    ["3-Drawer Filing Cabinet", "Lockable steel filing cabinet"],
    ["8-Seat Conference Table", "Laminate conference table with cable channel"],
    ["5-Shelf Bookcase", "Open steel and laminate storage shelf"]
  ] },
  { id: "office", name: "Office Equipment", items: [
    ["Epson EB-X51 Projector", "3LCD projector, XGA, 3800 lumens"],
    ["Whiteboard 6x4 ft", "Magnetic dry-erase board with aluminium frame"],
    ["Voltas 1.5 Ton Split AC", "Inverter split air conditioner, 5 star"],
    ["Water Dispenser", "Hot and cold bottled water dispenser"],
    ["Fellowes Paper Shredder", "Cross-cut shredder, 12-sheet capacity"]
  ] }
];

/* ===== Per-operation media =====

   The video that sits in the sticky right-hand rail of an operation page.
   One entry per operation id; an operation with no entry simply gets no
   rail and keeps the full-width form, so these can be filled in one at a
   time without the other pages changing.

   Videos live in assets/ as separate files rather than data URIs — same
   reasoning as the login clip: inlining a megabyte-plus would delay the
   page for no gain. */
const OPERATION_MEDIA = {
  employee_add: "assets/op_employee_add.mp4",
  attendance_add: "assets/op_attendance_add.mp4",
  leave_balance_add: "assets/op_leave_balance_add.mp4",
  payroll_field_add: "assets/op_payroll_field_add.mp4",
  assets_add: "assets/op_assets_add.mp4",
};

/* ===== The joke gate =====

   Not security, and nothing here pretends otherwise: the credentials are
   printed on the login screen, pre-filled into the inputs, and sitting in
   this file, which anyone can read. It is a gag about the app's own
   premise, and it gates nothing that matters — every generated file is
   random test data made in the visitor's own browser. */
const DEMO_LOGIN = { email: "amilazy@yopmail.com", password: "amioneklazy" };

/* ===== Dashboard ===== */

/* One card per operation on the dashboard. `cost` is what you would be
   typing by hand instead — the numbers are real, taken from each
   operation's own limits and from the sample account's 110 employees, so
   keep them honest if a limit changes.

   The dashboard is the one screen written in English; every operation's
   own copy stays in Banglish. */
const OPERATION_BLURBS = {
  employee_add: {
    blurb: "300 employees with names, emails, phones, salaries, dates of birth and departments. Name them after the Harry Potter cast if you like.",
    cost: "14 columns x 300 rows = 4,200 cells"
  },
  attendance_add: {
    blurb: "A month of attendance that respects shifts, weekends, holidays, the grace period, lateness, absence and overtime.",
    cost: "110 people x 30 days = ~13,000 cells"
  },
  leave_balance_add: {
    blurb: "Hand it the system's own export and it fills in the leave already used, scaled to how far into the year you are.",
    cost: "110 people x 5 leave types = 550 rows"
  },
  payroll_field_add: {
    blurb: "The custom addition and deduction grid. Who gets what, how many of them, which fields — random, but believable.",
    cost: "110 people x 8 fields = 880 cells"
  },
  assets_add: {
    blurb: "Laptops, monitors, chairs, projectors — code, type, description, and who each one is assigned to.",
    cost: "7 columns x up to 5,000 rows"
  }
};

/* Five seconds a cell is generous for someone typing carefully from a
   spec. 4,200 cells at that rate is the figure in the hero. */
const WELCOME_SECONDS_PER_CELL = 5;
const WELCOME_BIGGEST_BATCH = 300 * 14;

const OPERATIONS = [
  { id: "employee_add", label: "Employee Add", status: "active" },
  { id: "attendance_add", label: "Employee Attendance Add", status: "active" },
  { id: "leave_balance_add", label: "Leave Balance Add", status: "active" },
  { id: "payroll_field_add", label: "Payroll Custom Field Add", status: "active" },
  { id: "assets_add", label: "Assets Add", status: "active" }
];

/* ===== Phase 2 — Company Setup =====

   Unlike every operation above, this one writes into a real Shomvob
   environment through its actual API, gated by a real company login. It
   is deliberately kept separate from OPERATIONS: it is not a generator,
   it has its own two-step auth, and it is the one part of this app that
   is not risk-free. */

/* The only two servers this app will ever call, and their base URLs are
   fixed here at build time — never a text field on the page. Adding a
   third (or, deliberately, production) means editing this file and
   deploying, not typing a URL in and hitting go. */
const ENVIRONMENTS = {
  dev: { id: "dev", label: "Dev", apiBase: "https://dev.api-hr.shomvob.com/api/v1" },
  staging: { id: "staging", label: "Staging", apiBase: "https://staging.api-hr.shomvob.com/api/v1" },
};

/* Bulk Forge's own sign-in — the gate in front of the real company login,
   not a replacement for it. Backed by Supabase Auth; sign-up is switched
   off on the project, so this is really "whoever was added by hand in the
   Supabase dashboard," not a list this file controls. The key below is
   the publishable one — it identifies the project, it does not authorize
   anything by itself, and it is meant to sit in a public page like this
   one. */
const SUPABASE_URL = "https://wtlaiidtiugxirqcxjzw.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_F8HUWz-rcg9SqQgXsEcWeA_YrXilWgT";

const SETUP_TOOLS = [{ id: "company_setup", label: "Company Setup", status: "active" }];

/* The ~20 settings modules, two levels deep — confirmed with the user
   2026-09-09 against real screenshots of the actual HRIS admin (not
   invented): a group is a tabbed page (mirrors "Company Settings" and
   "Org Structure" in the real product, each its own small tab strip), a
   module is one tab within it. The main Company Setup view shows one
   card per GROUP, not per module — opening a group shows its modules as
   free-pick tabs, never a forced order.

   Grouping and module order follow the real Postman collection's own
   folders (`HRIS Collection Automation.postman_collection.json`, kept
   outside this repo). Only `company_profile` is wired to anything today;
   every other id exists so the tab strip is right from day one and each
   module becomes "swap in real content for one more tab" rather than
   "build tab machinery again". */
const SETTINGS_GROUPS = [
  {
    id: "company",
    label: "Company Settings",
    modules: [
      { id: "company_profile", label: "Company Profile" },
      { id: "bank_info", label: "Bank Info" },
      { id: "location_types", label: "Location Types" },
      { id: "locations", label: "Locations" },
      { id: "departments", label: "Department Management" },
      { id: "designations", label: "Designation Management" },
    ],
  },
  {
    id: "employee",
    label: "Employee Settings",
    modules: [
      { id: "custom_fields", label: "Custom Fields" },
      { id: "required_documents", label: "Required Documents" },
    ],
  },
  {
    id: "attendance",
    label: "Attendance Settings",
    modules: [{ id: "attendance_policy", label: "Attendance Policy" }],
  },
  {
    id: "schedule",
    label: "Schedule Management",
    modules: [
      { id: "roster", label: "Create Roster" },
      { id: "roster_pattern", label: "Create Roster Pattern" },
    ],
  },
  {
    id: "leave",
    label: "Leave Settings",
    modules: [
      { id: "leave_types", label: "Leave Types" },
      { id: "leave_policy", label: "Leave Policy" },
      { id: "holiday_calendar", label: "Holiday Calendar" },
    ],
  },
  {
    id: "payroll",
    label: "Payroll Settings",
    modules: [
      { id: "payroll_general", label: "General" },
      { id: "salary_components", label: "Salary Components" },
      { id: "configure_salary_components", label: "Configure Salary Components" },
      { id: "late_arrival", label: "Late Arrival" },
      { id: "absent_deduction", label: "Absent Deduction" },
      { id: "bonus_types", label: "Bonus Types" },
      { id: "bonus_policy", label: "Bonus Policy" },
      { id: "overtime", label: "Overtime" },
      { id: "attendance_bonus", label: "Attendance Bonus" },
      { id: "custom_addition_deduction", label: "Custom Addition/Deduction" },
      { id: "tax", label: "Tax" },
    ],
  },
];

/* ===== Company Profile — first settings module (built 2026-09-09) =====

   Ported from the Postman collection's own pre-request script for
   `PATCH /company-profile`, verbatim — every pool below is the real
   collection's, not a fresh guess. `tegNo` is a 13-digit dummy the
   collection's own author admitted not knowing the real meaning of
   ("tegNo er exact business meaning clear na"); a real staging company
   was found to hold free text there instead ("NOMUGGLESALLOWED"), so
   the field takes anything — this numeric pattern is kept because it
   reads as a plausible registration number for QA data, which a joke
   string doesn't. */
const COMPANY_LEGAL_SUFFIXES = [
  "Limited", "Ltd.", "Corporation", "Group Limited", "Holdings Limited",
  "Solutions Limited", "Systems Limited", "Digital Limited",
  "Innovations Limited", "Enterprises Limited", "Industries Limited",
  "Global Limited", "International Limited", "Software Limited",
];

/* Paired rather than two separate pools, so industry and businessType
   always land on a coherent combination (same defensive shape as
   Employee Add's gender matching its picked name). */
const COMPANY_INDUSTRY_PAIRS = [
  { industry: "HR Technology", businessType: "Technology" },
  { industry: "ERP", businessType: "Technology" },
  { industry: "Software Development", businessType: "Technology" },
  { industry: "E-commerce", businessType: "Retail" },
  { industry: "FinTech", businessType: "Financial Services" },
  { industry: "EdTech", businessType: "Education" },
  { industry: "HealthTech", businessType: "Healthcare" },
  { industry: "Logistics", businessType: "Service" },
  { industry: "Manufacturing", businessType: "Manufacturing" },
  { industry: "Digital Marketing", businessType: "Agency" },
  { industry: "Consultancy", businessType: "Professional Services" },
  { industry: "Real Estate", businessType: "Property" },
  { industry: "Retail", businessType: "Trading" },
  { industry: "Garments", businessType: "Manufacturing" },
  { industry: "Food and Beverage", businessType: "Consumer Goods" },
];

const COMPANY_DOMAIN_EXTENSIONS = [".com", ".net", ".co", ".io", ".biz", ".com.bd"];

/* {industry}/{businessType} get interpolated in, so these read as
   specific to the generated pair rather than generic filler. */
const COMPANY_DESCRIPTION_TEMPLATES = [
  "A growing {industry} focused {businessType} that provides reliable and scalable business solutions.",
  "A professional {industry} organization working to improve operational efficiency through modern services.",
  "A customer-focused company providing practical solutions in the {industry} sector.",
  "An emerging business organization delivering quality services and long-term value to clients.",
  "A dynamic company focused on innovation, service quality, and sustainable business growth.",
];
const COMPANY_MISSION_TEMPLATES = [
  "To deliver reliable and user-friendly solutions that help clients improve their business operations.",
  "To support organizations with efficient, scalable, and practical services for long-term growth.",
  "To create value for customers by providing quality services, innovation, and dependable support.",
  "To simplify business processes through effective solutions and professional service delivery.",
  "To build trusted partnerships by delivering consistent quality and measurable business impact.",
];
const COMPANY_VISION_TEMPLATES = [
  "To become a trusted and respected company in the {industry} industry.",
  "To be recognized as a reliable business partner for organizations seeking sustainable growth.",
  "To become a leading service provider known for quality, innovation, and customer satisfaction.",
  "To help organizations grow through modern, efficient, and accessible business solutions.",
  "To build a future-focused company that creates long-term value for clients and communities.",
];

/* Shown on a button mid-network-call (Company Setup's two logins and its
   first real save), one picked at random so repeat clicks don't repeat
   the same line. Mostly English, per the "no Banglish in the product"
   rule (src/app.js was rewritten out of Banglish 2026-09-08) — carrying
   the same joke ("doing your kamla work") in the app's own voice, with
   one entry kept verbatim as a wink rather than dropping it outright. */
const BUSY_MESSAGES = [
  "Doing your dirty work…",
  "Grinding through the boring bits…",
  "Pretending this is hard…",
  "Talking to the server — be nice, we're new here…",
  "Filing this under someone else's problem. Ours, specifically…",
  "Doing the kamla work so you don't have to…",
];

/* ===== Bank Info — second settings module (built 2026-09-10) =====

   Ported from the Postman collection's own pre-request script for
   `POST /company-bank-informations/save`, verbatim — same discipline as
   Company Profile. `BANK_SHORT_CODE_MAP`'s codes are the script's own
   (not always the bank's real published short code — e.g. "Agrani Bank"
   -> "AGRANI", not any official abbreviation), kept as-is since matching
   the script matters more than matching the bank. */
const BANK_NAMES = [
  "AB Bank Ltd.", "Agrani Bank", "Al-Arafah Islami Bank Ltd.", "Ansar VDP Unnayan Bank",
  "BASIC Bank", "BRAC Bank Ltd.", "Bangladesh Commerce Bank Ltd.", "Bangladesh Development Bank",
  "Bangladesh Krishi Bank", "Bank Al-Falah", "Bank Asia Ltd.", "CITI Bank NA",
  "Commercial Bank of Ceylon", "Community Bank Bangladesh Limited", "Dhaka Bank Ltd.",
  "Dutch Bangla Bank Ltd.", "EXIM Bank Ltd.", "Eastern Bank Ltd.", "First Security Islami Bank Ltd.",
  "Global Islamic Bank Ltd.", "Grameen Bank", "HSBC", "Habib Bank Ltd.", "ICB Islamic Bank",
  "IFIC Bank Ltd.", "Islami Bank Bangladesh Ltd.", "Jamuna Bank Ltd.", "Janata Bank", "Jubilee Bank",
  "Karmashangosthan Bank", "Meghna Bank Ltd.", "Mercantile Bank Ltd.", "Midland Bank Ltd.",
  "Modhumoti Bank Ltd.", "Mutual Trust Bank Ltd.", "NCC Bank Ltd.", "NRB Bank Ltd.",
  "NRB Commercial Bank Ltd.", "National Bank Ltd.", "National Bank of Pakistan", "One Bank Ltd.",
  "Padma Bank Ltd.", "Palli Sanchay Bank", "Premier Bank Ltd.", "Prime Bank Ltd.", "Pubali Bank Ltd.",
  "Rajshahi Krishi Unnayan Bank", "Rupali Bank", "SBAC Bank Ltd.", "Shahjalal Islami Bank Ltd.",
  "Shimanto Bank Ltd.", "Social Islami Bank Ltd.", "Sonali Bank", "Southeast Bank Ltd.",
  "Standard Bank Ltd.", "Standard Chartered Bank", "State Bank of India", "The City Bank Ltd.",
  "Trust Bank Ltd.", "Union Bank Ltd.", "United Commercial Bank Ltd.", "Uttara Bank Ltd.",
  "Woori Bank Ltd.",
];

const BANK_SHORT_CODE_MAP = {
  "AB Bank Ltd.": "AB", "Agrani Bank": "AGRANI", "Al-Arafah Islami Bank Ltd.": "AIBL",
  "Ansar VDP Unnayan Bank": "ANSARVDP", "BASIC Bank": "BASIC", "BRAC Bank Ltd.": "BRAC",
  "Bangladesh Commerce Bank Ltd.": "BCBL", "Bangladesh Development Bank": "BDBL",
  "Bangladesh Krishi Bank": "BKB", "Bank Al-Falah": "ALFALAH", "Bank Asia Ltd.": "ASIA",
  "CITI Bank NA": "CITI", "Commercial Bank of Ceylon": "CBC",
  "Community Bank Bangladesh Limited": "COMMUNITY", "Dhaka Bank Ltd.": "DHAKA",
  "Dutch Bangla Bank Ltd.": "DBBL", "EXIM Bank Ltd.": "EXIM", "Eastern Bank Ltd.": "EBL",
  "First Security Islami Bank Ltd.": "FSIBL", "Global Islamic Bank Ltd.": "GIB",
  "Grameen Bank": "GRAMEEN", "HSBC": "HSBC", "Habib Bank Ltd.": "HABIB", "ICB Islamic Bank": "ICB",
  "IFIC Bank Ltd.": "IFIC", "Islami Bank Bangladesh Ltd.": "IBBL", "Jamuna Bank Ltd.": "JAMUNA",
  "Janata Bank": "JANATA", "Jubilee Bank": "JUBILEE", "Karmashangosthan Bank": "KARMASHANGOSTHAN",
  "Meghna Bank Ltd.": "MEGHNA", "Mercantile Bank Ltd.": "MERCANTILE", "Midland Bank Ltd.": "MIDLAND",
  "Modhumoti Bank Ltd.": "MODHUMOTI", "Mutual Trust Bank Ltd.": "MTB", "NCC Bank Ltd.": "NCC",
  "NRB Bank Ltd.": "NRB", "NRB Commercial Bank Ltd.": "NRBC", "National Bank Ltd.": "NBL",
  "National Bank of Pakistan": "NBP", "One Bank Ltd.": "ONE", "Padma Bank Ltd.": "PADMA",
  "Palli Sanchay Bank": "PALLI", "Premier Bank Ltd.": "PREMIER", "Prime Bank Ltd.": "PRIME",
  "Pubali Bank Ltd.": "PUBALI", "Rajshahi Krishi Unnayan Bank": "RAKUB", "Rupali Bank": "RUPALI",
  "SBAC Bank Ltd.": "SBAC", "Shahjalal Islami Bank Ltd.": "SJIBL", "Shimanto Bank Ltd.": "SHIMANTO",
  "Social Islami Bank Ltd.": "SIBL", "Sonali Bank": "SONALI", "Southeast Bank Ltd.": "SOUTHEAST",
  "Standard Bank Ltd.": "STANDARD", "Standard Chartered Bank": "SCB", "State Bank of India": "SBI",
  "The City Bank Ltd.": "CITY", "Trust Bank Ltd.": "TRUST", "Union Bank Ltd.": "UNION",
  "United Commercial Bank Ltd.": "UCB", "Uttara Bank Ltd.": "UTTARA", "Woori Bank Ltd.": "WOORI",
};

const MFS_CODES = ["MFSBKASH", "MFSNAGAD"];

/* ===== Location Types, Locations — Company Settings, replacing the old
   "Locations" (Postman: "Branch Management", POST /company/branches)
   module entirely (2026-09-24) =====

   Not from the Postman collection at all — the real product moved on to
   a different real API since that module was first built, the same way
   Schedule Management's own endpoints were never in the collection
   either. The user supplied both real endpoints and real payloads
   directly, confirmed live against a real staging company
   (`GET .../locations/location-types/paginated`, `GET .../locations`)
   before any code was written — same discipline as Roster/Roster
   Pattern. Two real modules, a genuine dependency between them: every
   Location references a real Location Type by id. */
const OFFICE_NAMES = [
  "Head Office", "Zonal Office", "Regional Office", "Branch Office", "Corporate Office",
  "Sales Office", "Operations Office", "Field Office", "Admin Office", "Support Office",
  "Business Center", "Service Center",
];

/* A Location Type names a real Dhaka-area zone, matching the shape of
   the real default ("Baridhara") rather than a generic label like
   "Office" would. */
const LOCATION_TYPE_NAMES = [
  "Baridhara", "Gulshan", "Banani", "Uttara", "Bashundhara", "Dhanmondi",
  "Mirpur", "Motijheel", "Mohakhali", "Tejgaon",
];

/* Create Location Types — POST /locations/location-types. Only Name and
   "Can Have Geofence" are exposed as editable inputs, confirmed directly
   — code/sortOrder/canHaveEmployees/status/allowedParentLocationTypeId
   are always the fixed shape below, no hierarchy support yet
   (allowedParentLocationTypeId stays null; a real parent-type hierarchy
   is a later phase, not asked for). */
const LOCATION_TYPE_DEFAULT = {
  name: "Baridhara",
  code: "",
  sortOrder: 1,
  allowedParentLocationTypeId: null,
  canHaveEmployees: true,
  canHaveGeofence: true,
  status: "Active",
};

/* Create Locations — POST /locations. locationTypeId is a real
   dependency on Location Types (a location can't exist without one);
   Name, Location Type, Has Geofence and Is Default are the only
   editable inputs — parentId/timezone/currency/headEmployeeId/status
   are always the fixed shape below, confirmed directly. `isDefault`
   only defaults true for "Create the Default" itself — a hand-created
   location starts false, toggleable either way, since the user
   confirmed a company should end up with exactly one real default. */
const LOCATION_DEFAULT = {
  name: "Railgate",
  hasGeofence: true,
  isDefault: true,
  geofence: { latitude: 23.8103, longitude: 90.4125, radiusInMeters: 200 },
};

/* When Has Geofence is on, coordinates are a small random offset from
   Baridhara DOHS — the same real reference point the default location's
   own geofence sits on, not an arbitrary choice. */
const BARIDHARA_BASE_LATITUDE = 23.812007684570396;
const BARIDHARA_BASE_LONGITUDE = 90.41516296328736;
const BRANCH_RADIUS_OPTIONS = [100, 150, 200, 250, 300, 350, 400, 450, 500];

/* ===== Department Management — fourth settings module (built 2026-09-10) ===== */
const DEPARTMENT_NAMES = [
  "Human Resources", "Talent Acquisition", "Recruitment", "People Operations", "Administration",
  "Finance", "Accounts", "Payroll", "Sales", "Business Development", "Marketing",
  "Digital Marketing", "Customer Support", "Client Success", "Operations", "Product",
  "Engineering", "Software Development", "Quality Assurance", "IT Support", "Data Analytics",
  "Research and Development", "Legal", "Compliance", "Procurement", "Supply Chain",
  "Training and Development", "Corporate Affairs", "Strategy", "Design", "Content", "Partnerships",
];

/* ===== Designation Management — fifth settings module (built 2026-09-10) =====

   The one module so far with a REAL live dependency: the Postman
   collection's own "Get Active Departments" step throws if there's
   nothing to attach a designation to ("Age Get Active Departments API
   run korte hobe") — this app checks the same thing live against
   /departments/active rather than assuming a department exists. */
const DESIGNATION_NAMES = ["Executive", "Senior Executive", "Assistant Manager", "Manager"];

/* ===== Custom Fields — sixth settings module (built 2026-09-10) =====

   `type` and `fieldName` always travel together (a "Blood Group" field
   is never typed "number") — same paired-pool discipline as everywhere
   else. Only `enum` carries `choicePool`; `enableFilter` only ever
   applies to `checkbox`/`enum` in the real API, so it's forced false for
   every other type rather than randomised across the board. */
const CUSTOM_FIELD_PRESETS = [
  { fieldName: "NID Number", type: "text" },
  { fieldName: "Passport Number", type: "text" },
  { fieldName: "Father Name", type: "text" },
  { fieldName: "Mother Name", type: "text" },
  { fieldName: "Emergency Contact Number", type: "text" },
  { fieldName: "LinkedIn Profile", type: "text" },
  { fieldName: "Present Address", type: "long_text" },
  { fieldName: "Permanent Address", type: "long_text" },
  { fieldName: "Career Objective", type: "long_text" },
  { fieldName: "Skills Summary", type: "long_text" },
  { fieldName: "Previous Work Details", type: "long_text" },
  { fieldName: "Personal Bio", type: "long_text" },
  { fieldName: "Years of Experience", type: "number" },
  { fieldName: "Expected Salary", type: "number" },
  { fieldName: "Current Salary", type: "number" },
  { fieldName: "Number of Dependents", type: "number" },
  { fieldName: "Notice Period in Days", type: "number" },
  { fieldName: "Are you married?", type: "checkbox" },
  { fieldName: "Do you have previous work experience?", type: "checkbox" },
  { fieldName: "Do you have a driving license?", type: "checkbox" },
  { fieldName: "Are you willing to relocate?", type: "checkbox" },
  { fieldName: "Do you agree with company policy?", type: "checkbox" },
  { fieldName: "Select what describes you?", type: "enum", choicePool: ["Dedicated", "Hardworking", "Punctual", "Team Player", "Quick Learner", "Self Motivated", "Creative"] },
  { fieldName: "Employment Type", type: "enum", choicePool: ["Full-time", "Part-time", "Contractual", "Intern", "Probationary", "Remote"] },
  { fieldName: "Education Level", type: "enum", choicePool: ["SSC", "HSC", "Diploma", "Bachelor", "Master", "PhD"] },
  { fieldName: "Preferred Work Location", type: "enum", choicePool: ["Dhaka", "Chattogram", "Sylhet", "Khulna", "Rajshahi", "Remote"] },
  { fieldName: "T-Shirt Size", type: "enum", choicePool: ["XS", "S", "M", "L", "XL", "XXL"] },
  { fieldName: "Blood Group", type: "enum", choicePool: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] },
];
const CUSTOM_FIELD_STATUSES = ["Active", "Inactive"];
/* The real, API-accepted set of field types — Type is now a real
   dropdown (2026-09-11) rather than free text next to a randomly
   generated field name, since a typo there would send an invalid type. */
const CUSTOM_FIELD_TYPES = [
  { id: "text", label: "Text" },
  { id: "long_text", label: "Long Text" },
  { id: "number", label: "Number" },
  { id: "checkbox", label: "Checkbox" },
  { id: "enum", label: "Enum (dropdown)" },
];

/* ===== Required Documents — seventh settings module (built 2026-09-10) =====

   Note the lowercase status values ("active"/"inactive") — this endpoint's
   own convention, different from every Active/Inactive-capitalized status
   elsewhere in this app. Kept exactly as the Postman body sends it. */
const REQUIRED_DOCUMENT_NAMES = [
  "Passport", "National ID", "Birth Certificate", "TIN Certificate", "Academic Certificate",
  "Experience Certificate", "Police Clearance", "Medical Certificate", "Bank Statement",
  "Driving License", "Profile Photo", "Resume", "Appointment Letter",
  "Previous Employment Letter", "Nominee NID",
];
const REQUIRED_DOCUMENT_TYPES = ["file", "text"];
const REQUIRED_DOCUMENT_STATUSES = ["active", "inactive"];

/* ===== Leave Types — eighth settings module (built 2026-09-10) =====

   Ported from the Postman collection's own six leave-type pre-request
   scripts. Four ("normal" leave — Annual, Casual, Sick, Unmarried) share
   one large, identical rule set (consecutive/monthly limits, prorata,
   accrual, backdating, documents, carry-forward, sandwich and bridge
   rules, leave-reset cycle) and differ only in name and eligibility.
   Two (Maternity, Paternity) are "special entitlement" leave — a much
   smaller, mostly-fixed body built around an instance count and a fixed
   per-instance day count, with almost every normal-leave field forced
   off. `special` on each kind picks which generator runs.

   Scope note, deliberate: only name and the three headline toggles
   (consecutive/monthly limit + carry-forward, each with their day count)
   are exposed as editable fields for normal leave — not all ~15
   booleans the real body carries. Everything else is still generated
   correctly per the script's own conditional logic, just not surfaced as
   its own input row; the user flagged Leave as the one place a 5% chance
   of needing rework was already expected. */
const LEAVE_TYPE_KINDS = [
  { id: "annual", name: "Annual Leave", genderEligibility: "all", maritalStatusEligibility: "all", special: false },
  { id: "casual", name: "Casual Leave", genderEligibility: "all", maritalStatusEligibility: "all", special: false },
  { id: "sick", name: "Sick Leave", genderEligibility: "all", maritalStatusEligibility: "all", special: false },
  { id: "unmarried", name: "Unmarried Leave", genderEligibility: "all", maritalStatusEligibility: "unmarried", special: false },
  { id: "maternity", name: "Maternity Leave", genderEligibility: "female", maritalStatusEligibility: "married", special: true, seMaxDaysPerInstance: 120 },
  { id: "paternity", name: "Paternity Leave", genderEligibility: "male", maritalStatusEligibility: "married", special: true, seMaxDaysPerInstance: 14 },
];

/* ===== Leave Policy — ninth settings module, the second with a real dependency =====

   POST /leave-policies needs at least one leave type to attach — the
   Postman script itself throws if none exist ("leaveTypesAll not
   found... run GET all leave types API first"), same shape of rule as
   Designation needing a Department. */
const LEAVE_POLICY_NAMES = ["Default Leave Policy", "Company Leave Policy"];
const LEAVE_POLICY_DESCRIPTION =
  "This policy defines the company-wide leave rules and determines how employees can receive and use their leave entitlements.";
const LEAVE_POLICY_EMPLOYEE_TYPES = ["Permanent", "Part-time", "Intern", "Contractual", "Probationary"];

/* ===== Attendance Policy — Attendance group's only module (2026-09-10,
   real shape re-derived 2026-09-10) =====

   POST /attendance/policy/create. The Postman collection's own script
   (`shifts`/`weekendDays`) does NOT match the real API — confirmed broken
   in a live verification pass the same day (see CLAUDE.md). The real
   shape below was re-derived from a known-good real payload plus the
   actual "Create Default Attendance Policy" admin screen, both supplied
   by the user: no `shifts`, no `weekendDays` at all (this is a single
   company-wide policy, not a per-shift one) — replaced by two fields the
   script had no concept of, `maxCheckOutLimit` (paired with
   `earlyCheckInLimit`) and `fixedBreakSettings` (the "Deduct Break
   Configuration" toggle, a sibling of `breakConfig`'s "Break Time
   Configuration" toggle). overtimeConfigs/earlyCheckInLimit/breakConfig
   keep the script's own shape unchanged — confirmed correct against the
   real payload. Same "headline fields only" scoping as Leave Types: only
   title is exposed as an editable input, everything else is generated
   correctly per the rules below but not surfaced as its own input row.
   Overtime/Break/Deduct Break all default off and both check-in/check-
   out limits default to 120 minutes (2026-09-14, direct request) — no
   longer random pools, see generateAttendancePolicyFields() in app.js. */

/* ===== Schedule Management — new group, "Create Roster" (2026-09-22) =====

   Not from the Postman collection at all — a lead feedback item ("roster
   ar default pattern create") the user supplied the real endpoint and a
   known-good real payload for directly: `POST /workforce/time-slots`,
   array-wrapped even though this app only ever sends one item per call
   (confirmed with the user — no batch mode needed). "Create Roster Pattern"
   is a second module in this same group the user hasn't specified yet;
   it stays an honest "not built yet" tab until it does.

   `totalWorkingHours` and `halfDayHours` are NOT their own editable
   fields — confirmed directly ("total ta to auto calculate hobe
   bujhtesoi", "half 4 o auto dhoiro"): total is always computed from
   whatever Start/End the visitor currently has (`rosterTotalHours()` in
   app.js), half-day is always the fixed `4` from the real default
   payload, never derived. Only Name/Start/End/Grace are real inputs —
   same "headline fields only" scoping as Leave Types/Attendance Policy. */
const ROSTER_NAMES = [
  "Morning Shift", "Day Shift", "General Shift", "Regular Shift", "Standard Shift",
  "Office Shift", "Primary Shift", "Core Hours Shift",
];

/* "normally bd te 9-11 ta start time hoy 30 min gap e" — direct user
   instruction, not a guess: real BD office start times cluster in this
   window, 30 minutes apart. End time is always start + 9 hours
   (generateRosterFields() in app.js), matching the real default's own
   09:00-18:00 span. */
const ROSTER_START_TIMES = ["09:00", "09:30", "10:00", "10:30", "11:00"];

const ROSTER_GRACE_OPTIONS = [0, 5, 10, 15];

/* The real default's own green plus a small palette of other plausible
   Tailwind-ish colours — purely cosmetic, "color random diyo" was the
   whole spec. */
const ROSTER_COLORS = ["#22C55E", "#3B82F6", "#A855F7", "#F97316", "#EF4444", "#06B6D4"];

/* The exact real payload the user supplied for "Create the Default" —
   `[{"name":"Default","workStartTime":"09:00","workEndTime":"18:00",
   "totalWorkingHours":9,"halfDayHours":4,"gracePeriodMinutes":15,
   "color":"#22C55E"}]`. total/half are dropped here since they're never
   stored on state (see comment above) — saveRoster() in app.js always
   recomputes totalWorkingHours as 9 from this exact start/end anyway. */
const ROSTER_DEFAULT = { name: "Default", workStartTime: "09:00", workEndTime: "18:00", gracePeriodMinutes: 15, color: "#22C55E" };

/* ===== Payroll — 11 modules, all ported from the Postman collection's own
   "Payroll Settings" folder (2026-09-10). The user's own call ahead of
   building this: 2-3 of these are already known to need rework once
   tried against a real environment, and Tax specifically is expected to
   need an entirely new API — confirmed true below, not a guess. Every
   pool here is the script's own, ported verbatim. */

/* General — POST /payroll/configuration/payroll-cycle. No dependency.
   Only used to re-roll the cycle on Regenerate — the very first load
   always starts on calendar_month regardless of these weights. */
const PAYROLL_CYCLE_OPTIONS = [
  { value: "calendar_month", weight: 55 },
  { value: "fixed_date", weight: 40 },
  { value: "bi_weekly", weight: 5 },
];

/* Salary Components — POST /payroll/configuration/salary-components. No
   dependency. These 4 are the Postman collection's own fixed examples
   (each its own request, not a generated name) — status/tax-countable/
   pro-rata are the only randomised fields per the script. */
const SALARY_COMPONENT_PRESETS = [
  { name: "Medical Allowance", description: "Allowance provided to support employee medical and healthcare-related expenses." },
  { name: "House Rent Allowance", description: "Allowance provided to support employee house rent or accommodation-related expenses." },
  { name: "Mobile Allowance", description: "Allowance provided to support employee mobile phone and communication expenses." },
  { name: "Internet Allowance", description: "Allowance provided to support employee Internet expenses." },
];

/* Configure Salary Components — PUT /payroll/configuration/non-paygrade-structure.
   Needs at least 2 Active salary components — the collection's own script
   throws without them ("salaryComponent1Id or salaryComponent2Id missing").
   Splits always sum to 100, the script's own fixed set. */
const SALARY_STRUCTURE_SPLITS = [
  { basic: 50, c1: 20, c2: 30 },
  { basic: 50, c1: 25, c2: 25 },
  { basic: 55, c1: 20, c2: 25 },
  { basic: 55, c1: 25, c2: 20 },
  { basic: 60, c1: 15, c2: 25 },
  { basic: 60, c1: 20, c2: 20 },
  { basic: 65, c1: 15, c2: 20 },
  { basic: 65, c1: 20, c2: 15 },
  { basic: 70, c1: 10, c2: 20 },
  { basic: 70, c1: 15, c2: 15 },
];

/* Late Arrival, Absent Deduction — both need at least one Leave Type,
   same rule the collection enforces on itself, reusing the existing
   Leave Type dependency infrastructure. */
const PAYROLL_SALARY_BASIS_OPTIONS = ["Deduction of per day Basic Salary", "Deduction of per day Gross Salary"];

/* Bonus Types — POST /bonus/configuration/types. No dependency. Fixed
   pool, same discipline as Salary Components — only status/icon are
   randomised, never the name/description. */
const BONUS_TYPE_ICON_OPTIONS = ["gift", "calendar", "grid", "hierarchy", "target", "medal", "trophy", "chart", "arrows"];
const BONUS_TYPE_PRESETS = [
  { typeName: "Eid Bonus", status: "Active", description: "Bonus type used for Eid festival bonus configuration." },
  { typeName: "Bangla New Year Bonus", status: "Active", description: "Bonus type used for Bangla New Year bonus configuration." },
  { typeName: "Special Bonus", status: "Active", description: "Bonus type used for special employee bonus configuration." },
  { typeName: "Inactive Test Bonus", status: "Inactive", description: "Bonus type used to verify inactive bonus type creation." },
];

/* Bonus Policy — POST /bonus/configuration/policies. Needs at least one
   Bonus Type. The collection's own fully-specified example is Eid Ul
   Fitr (fixed Gross basis, fixed 50%) — generalised here to any bonus
   type the company has, since this module lets the visitor pick which
   one rather than hardcoding Eid. */
const BONUS_POLICY_NAMES = ["Eid Ul Fitr Bonus Policy", "Eid Ul Adha Bonus Policy", "Bangla New Year Bonus Policy", "Special Bonus Policy"];
const BONUS_POLICY_PAYMENT_METHODS = [
  { value: "off_cycle_payment", weight: 90 },
  { value: "with_regular_payroll", weight: 10 },
];
const BONUS_POLICY_TENURE_ENABLED = [
  { value: true, weight: 80 },
  { value: false, weight: 20 },
];
const BONUS_POLICY_TENURE_UNITS = [
  { value: "months", weight: 70 },
  { value: "days", weight: 20 },
  { value: "years", weight: 10 },
];

/* "Create the default 3" for Bonus Policy (2026-09-13, direct request):
   both Eid policies point at the same real "Eid Bonus" type — there's
   only one Eid bonus TYPE, but two festivals each get their own POLICY
   against it, same as the real product's own shape. Fixed
   paymentMethod/tenure, same "headline fields only, rest is a fixed
   default shape" discipline as Leave Types' "Create the default 3". */
const BONUS_POLICY_DEFAULT_ITEMS = [
  { policyName: "Eid Ul Fitr Bonus Policy", bonusTypeName: "Eid Bonus", bonusPercentage: 40 },
  { policyName: "Eid Ul Adha Bonus Policy", bonusTypeName: "Eid Bonus", bonusPercentage: 40 },
  { policyName: "Bangla New Year Bonus Policy", bonusTypeName: "Bangla New Year Bonus", bonusPercentage: 20 },
];

/* Overtime — POST /payroll/configuration/overtime. No dependency. */
const OVERTIME_CALCULATION_TYPES = [
  { value: "Fixed Rate", weight: 50 },
  { value: "Multiplier of Salary", weight: 50 },
];
const OVERTIME_SPECIAL_ENABLED = [
  { value: "Enable", weight: 80 },
  { value: "Disable", weight: 20 },
];
const OVERTIME_FIXED_RATE_RANGES = { regular: [800, 1000, 1200], weekend: [1000, 1200, 1500], holiday: [1200, 1500, 2000] };
const OVERTIME_MULTIPLIERS = [1.5, 2];
const OVERTIME_BASED_ON = ["Basic", "Gross"];

/* Attendance Bonus — POST /payroll/configuration/attendance-bonus. No
   dependency. */
const ATTENDANCE_BONUS_COUNT_ON_TYPES = [
  { value: "Percentage", weight: 70 },
  { value: "Days", weight: 30 },
];
const ATTENDANCE_BONUS_PERCENTAGE_VALUES = [50, 60, 70, 80, 90];
const ATTENDANCE_BONUS_DAYS_VALUES = [10, 12, 15];
const ATTENDANCE_BONUS_CALCULATION_TYPES = [
  { value: "Fixed Rate", weight: 50 },
  { value: "Percentage of Salary", weight: 50 },
];
const ATTENDANCE_BONUS_FIXED_RATES = [1000, 1500, 2000];
const ATTENDANCE_BONUS_PERCENTAGES = [5, 10, 15, 20];

/* Custom Addition/Deduction — POST /payroll/configuration/custom-fields.
   No dependency. Names are the collection's own fixed examples, paired
   by type so an Addition never gets a Deduction-shaped name. */
const CUSTOM_ADDITION_NAMES = ["Mobile Allowance", "Internet Allowance"];
const CUSTOM_DEDUCTION_NAMES = ["Late Fee", "Device Penalty"];

/* Tax — PATCH /payroll/configuration/tax-rules/toggle/Enable. The one
   place the collection genuinely stops short: this is an enable/disable
   toggle only, no request body, and there is no companion endpoint
   anywhere in the collection for creating an actual tax bracket or rule.
   Built as exactly what exists; flagged in the module's own copy rather
   than papering over the gap with an invented body. This is the "payroll
   needs a new API" case the user predicted before this group was built. */
