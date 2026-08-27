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

const OPERATIONS = [
  { id: "employee_add", label: "Employee Add", status: "active" },
  { id: "attendance_add", label: "Employee Attendance Add", status: "soon" },
  { id: "leave_balance_add", label: "Leave Balance Add", status: "soon" },
  { id: "payroll_field_add", label: "Payroll Custom Field Add", status: "soon" },
  { id: "assets_add", label: "Assets Add", status: "soon" }
];
