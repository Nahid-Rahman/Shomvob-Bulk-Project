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

/* Bangladesh government holidays. Entries marked `approx` follow the lunar
   calendar and are announced close to the date, so they are a best guess —
   the UI shows them as editable chips precisely so they can be corrected.
   Adding a year is a matter of adding one more key here. */
const BD_HOLIDAYS = {
  2025: [
    ["2025-02-21", "Shaheed Day / Mother Language Day"],
    ["2025-03-26", "Independence Day"],
    ["2025-03-30", "Eid-ul-Fitr holiday", true],
    ["2025-03-31", "Eid-ul-Fitr", true],
    ["2025-04-01", "Eid-ul-Fitr holiday", true],
    ["2025-04-14", "Pahela Baishakh"],
    ["2025-05-01", "May Day"],
    ["2025-05-11", "Buddha Purnima", true],
    ["2025-06-06", "Eid-ul-Azha holiday", true],
    ["2025-06-07", "Eid-ul-Azha", true],
    ["2025-06-08", "Eid-ul-Azha holiday", true],
    ["2025-07-06", "Ashura", true],
    ["2025-08-16", "Janmashtami", true],
    ["2025-09-05", "Eid-e-Miladunnabi", true],
    ["2025-10-02", "Durga Puja (Vijaya Dashami)", true],
    ["2025-12-16", "Victory Day"],
    ["2025-12-25", "Christmas Day"]
  ],
  2026: [
    ["2026-02-21", "Shaheed Day / Mother Language Day"],
    ["2026-03-20", "Eid-ul-Fitr", true],
    ["2026-03-21", "Eid-ul-Fitr holiday", true],
    ["2026-03-22", "Eid-ul-Fitr holiday", true],
    ["2026-03-26", "Independence Day"],
    ["2026-04-14", "Pahela Baishakh"],
    ["2026-05-01", "May Day"],
    ["2026-05-27", "Eid-ul-Azha", true],
    ["2026-05-28", "Eid-ul-Azha holiday", true],
    ["2026-05-29", "Eid-ul-Azha holiday", true],
    ["2026-05-31", "Buddha Purnima", true],
    ["2026-06-25", "Ashura", true],
    ["2026-08-04", "Janmashtami", true],
    ["2026-08-25", "Eid-e-Miladunnabi", true],
    ["2026-10-20", "Durga Puja (Vijaya Dashami)", true],
    ["2026-12-16", "Victory Day"],
    ["2026-12-25", "Christmas Day"]
  ]
};

const ATTENDANCE_HEADER = ["Employee ID*", "Date*", "In Time*", "Out Time*"];
const ATTENDANCE_SHEET = "Attendance_Bulk_Import";

const OPERATIONS = [
  { id: "employee_add", label: "Employee Add", status: "active" },
  { id: "attendance_add", label: "Employee Attendance Add", status: "active" },
  { id: "leave_balance_add", label: "Leave Balance Add", status: "soon" },
  { id: "payroll_field_add", label: "Payroll Custom Field Add", status: "soon" },
  { id: "assets_add", label: "Assets Add", status: "soon" }
];
