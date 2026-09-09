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
  ]
};

const NAME_THEME_LABELS = {
  bangla: "Default (Random Bangla Names)",
  got: "Game of Thrones",
  hp: "Harry Potter",
  marvel: "Marvel",
  dc: "DC",
  games: "Games Character"
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
      { id: "branches", label: "Locations" },
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
    id: "leave",
    label: "Leave",
    modules: [
      { id: "leave_types", label: "Leave Types" },
      { id: "leave_policy", label: "Leave Policy" },
    ],
  },
  {
    id: "payroll",
    label: "Payroll",
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
  {
    id: "offboarding",
    label: "Offboarding",
    modules: [{ id: "offboard_types", label: "Offboard Types" }],
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
