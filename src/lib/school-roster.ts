/**
 * №82 мектептің сыныптары мен сынып жетекшілері.
 * login — фамилияның латынша жазылуы, бастапқы пароль = login + "82".
 * teacher = null — сынып вакант, аккаунт жасалмайды.
 *
 * Бір фамилия екі сыныпқа тиесілі болса (бір адам екі сыныпты жетектейді,
 * немесе сынып вакант болып, бұрынғы жетекшінің аты тек анықтама үшін
 * қалдырылса), екінші сыныпқа "2" қосылған бөлек логин беріледі
 * (мыс. "otegulova" / "otegulova2").
 */
export type RosterEntry = {
  className: string;
  fullName: string | null;
  login: string | null;
};

export const SCHOOL_ROSTER: RosterEntry[] = [
  { className: "2А", fullName: "Карагулова Ляззат Итемгенқызы", login: "karagulova" },
  { className: "2Ә", fullName: "Умирзакова Айнур Кульмурзаевна", login: "umirzakova" },
  { className: "2Б", fullName: "Төлешова Алмагуль Амангелдіқызы", login: "toleshova" },
  { className: "2В", fullName: "Алдан Әсемгүл Маратқызы", login: "aldan" },
  { className: "2Г", fullName: "Абубакирова Жанат Болатовна", login: "abubakirova" },
  { className: "2Ғ", fullName: "Тенелова Дамеш Кемелбайқызы", login: "tenelova" },
  { className: "2Д", fullName: "Қазтаева Жұлдыз Темірбековна", login: "kaztaeva" },
  { className: "2Е", fullName: "Ажибаева Жұлдыз Сазанбаевна", login: "azhibaeva" },
  { className: "2Ж", fullName: "Мырзагарина Нургул Муратовна", login: "myrzagarina" },
  { className: "2З", fullName: "Болатбекқызы Еркеназ", login: "bolatbekkyzy" },
  { className: "2И", fullName: "Нургалиева Акмарал Танатовна", login: "nuralieva" },
  { className: "2К", fullName: "Қарабатырова Аңсаған Батырхановна", login: "karabatyrova" },
  // Вакант — бұрын осы сыныпты жүргізген Өтеғұлова қазір 4В-де (төменде).
  { className: "2Қ", fullName: "Өтеғұлова Фатима Ертарғынқызы", login: "otegulova2" },
  { className: "2Л", fullName: "Алмурзаева Гульнур Орынбасаровна", login: "almurzaeva" },

  // Махмутова негізгі логині 4Ғ-де (бұрыннан); 3А — оның қосымша сыныбы.
  { className: "3А", fullName: "Махмутова Аккоркем Сериковна", login: "makhmutova2" },
  { className: "3Ә", fullName: "Ағымедолла Көркем Бөлекбайқызы", login: "agymedolla" },
  // Мульдикешева негізгі логині 4И-де (бұрыннан); 3Б — оның қосымша сыныбы.
  { className: "3Б", fullName: "Мульдекешова Асемгуль Нурлыбековна", login: "muldikesheva2" },
  { className: "3В", fullName: "Исанова Гульмира Орынбаевна", login: "isanova" },
  { className: "3Г", fullName: "Берикова Дильназ Берікқызы", login: "berikova" },
  { className: "3Ғ", fullName: "Джуманова Дильбар Султанмуратовна", login: "dzhumanova" },
  { className: "3Д", fullName: "Күлімбет Фариза Нұрланқызы", login: "kulimbet" },
  { className: "3Е", fullName: "Шамшадин Елана Алтынбекқызы", login: "shamshadin" },
  { className: "3Ж", fullName: "Дюсембаева Жансая Абаевна", login: "dyusembaeva" },
  { className: "3З", fullName: "Алшора Перизат Бақтығалиқызы", login: "alshora" },

  { className: "4А", fullName: "Тобағабылова Жайнагүл Серікқызы", login: "tobagabylova" },
  { className: "4Ә", fullName: "Ибрашева Еркеназ Болатбекқызы", login: "ibrasheva" },
  { className: "4Б", fullName: "Құрамысова Динара Саматқызы", login: "kuramysova" },
  { className: "4В", fullName: "Өтеғұлова Фатима Ертарғынқызы", login: "otegulova" },
  { className: "4Г", fullName: "Умирзакова Жансезим Бақытжановна", login: "umirzakova2" },
  { className: "4Ғ", fullName: "Махмутова Аккоркем Сериковна", login: "makhmutova" },
  { className: "4Д", fullName: "Иванова Мадина Газизовна", login: "ivanova" },
  { className: "4Е", fullName: "Қойбағарова Фарида Несіпбайқызы", login: "koibagarova" },
  { className: "4Ж", fullName: "Искендирова Айнур Тауирбаевна", login: "iskendirova" },
  // Вакант — бұрын осы сыныпты жүргізген Нургалиева қазір 2И-де (жоғарыда).
  { className: "4З", fullName: "Нургалиева Акмарал Танатовна", login: "nuralieva2" },
  { className: "4И", fullName: "Мулдикешова Асемгуль Нурлыбековна", login: "muldikesheva" },

  { className: "5А", fullName: "Даулеткалиева Миргуль Каршигаевна", login: "dauletkalieva" },
  { className: "5Ә", fullName: "Боқырова Аяжан Болатбайқызы", login: "bokyrova" },
  { className: "5Б", fullName: "Досова Арудан Нурсериковна", login: "dosova" },
  { className: "5В", fullName: "Бақытжанова Сағыныш Жолдасқызы", login: "bakytzhanova" },
  { className: "5Г", fullName: "Магадан Алтынтаң Әлібекқызы", login: "magadan" },
  { className: "5Ғ", fullName: "Шабикова Акжан Аманкуловна", login: "shabikova" },
  { className: "5Д", fullName: "Рашидов Данияр Мерекеұлы", login: "rashidov" },
  { className: "5Е", fullName: "Джулмагамбетова Нургуль Кайратовна", login: "dzhulmagambetova" },
  { className: "5Ж", fullName: "Бозангалиев Есбол Сакенович", login: "bozangaliev" },
  { className: "5З", fullName: "Ерғазы Нұрбек Салютбекұлы", login: "ergazy" },
  { className: "5И", fullName: "Султанова Ару Едигеевна", login: "sultanova" },

  { className: "6А", fullName: "Алданаева Жанар Жандосовна", login: "aldanaeva" },
  { className: "6Ә", fullName: "Жұмағалиева Гүлнұр Төреғалиқызы", login: "zhumagalieva" },
  { className: "6Б", fullName: "Нарғали Тойгүл Жеңісқызы", login: "nargali" },
  { className: "6В", fullName: "Нурбергенова Аида Алимханқызы", login: "nurbergenova" },
  { className: "6Г", fullName: "Назарова Самал Ақылбекқызы", login: "nazarova" },
  { className: "6Ғ", fullName: "Балтабай Назерке Берікбайқызы", login: "baltabay" },
  { className: "6Д", fullName: "Алмаханова Айдана Табылбайқызы", login: "almakhanova" },
  { className: "6Е", fullName: "Бижанова Мира Сисеновна", login: "bizhanova" },
  { className: "6Ж", fullName: "Ізбасар Мөлдір Қуанышқызы", login: "izbasar" },
  { className: "6З", fullName: "Есболсын Ардақ Жаңабайқызы", login: "esbolsyn" },
  { className: "6И", fullName: "Адилова Салтанат Сатбайқызы", login: "adylova" },

  { className: "7А", fullName: "Алишева Эльмира Меирмановна", login: "alisheva" },
  { className: "7Ә", fullName: "Кемешова Жансая Дулатқызы", login: "kemashova" },
  { className: "7Б", fullName: "Әлім Меруерт Сырымқызы", login: "alim" },
  { className: "7В", fullName: "Махамбетова Назерке Ерболатқызы", login: "makhambetova" },
  { className: "7Г", fullName: "Ермухатова Мольдир Амангельдиевна", login: "ermukhatova" },
  { className: "7Ғ", fullName: "Табанова Гүлдаурен Қуанышқалиқызы", login: "tabanova" },
  { className: "7Д", fullName: "Тасбаева Жадыра Сәлімбайқызы", login: "taspaeva" },
  { className: "7Е", fullName: "Ешова Ақерке Кусаумирзаевна", login: "eshova" },
  { className: "7Ж", fullName: "Сағындық Жазира Қадірбекқызы", login: "sagyndyk" },
  { className: "7З", fullName: "Спан Жасқайрат Қайырбекұлы", login: "span" },

  { className: "8А", fullName: "Бикеева Молдир Сырымовна", login: "bikeeva" },
  { className: "8Ә", fullName: "Утаршиева Гульзада Серикбаевна", login: "utarshieva" },
  { className: "8Б", fullName: "Жанғазы Нурида Асыланқызы", login: "zhangazy" },
  { className: "8В", fullName: "Батырбекова Гульшат Азеровна", login: "batyrbekova" },
  { className: "8Г", fullName: "Адепова Айжан Асхатовна", login: "adelova" },
  { className: "8Ғ", fullName: "Талғатұлы Бауыржан", login: "talgatuly" },
  { className: "8Д", fullName: "Алмурзаев Нұрлыбек Орынбасарұлы", login: "almurzaev" },
  { className: "8Е", fullName: "Маратұлы Бекзат", login: "maratuly" },
  { className: "8Ж", fullName: "Кулданова Ақжарқын Ныгметовна", login: "kuldanova" },
  { className: "8З", fullName: "Нурбулатова Лаура Тимуровна", login: "nurbulatova" },

  { className: "9А", fullName: "Тоймаганбетова Эльмира Бимаганбетовна", login: "toimagambetova" },
  { className: "9Ә", fullName: "Токсанбаева Алтынгуль Ажимбаевна", login: "toksambaeva" },
  { className: "9Б", fullName: "Мұқанбетқазы Гүлсән Қонысбайқызы", login: "mukanbetkazy" },
  { className: "9В", fullName: "Боранбай Айдана Еркінқызы", login: "boranbay" },
  { className: "9Г", fullName: "Өмірзақова Інжу Алыбайқызы", login: "omirzakova" },
  { className: "9Ғ", fullName: "Алимбаева Акмарал Аскатовна", login: "almbaeva" },
  { className: "9Д", fullName: "Ермекова Мөлдір Есқабылқызы", login: "ermekova" },
  { className: "9Е", fullName: "Алибеков Адильбек Арыстанович", login: "alibekov" },
  { className: "9Ж", fullName: "Сагиев Дидар Карасаевич", login: "sagiev" },
  { className: "9З", fullName: "Тулегенова Айжамал Казбаевна", login: "tulegenova" },

  { className: "10А", fullName: "Жұбаева Жансауле Болатбекқызы", login: "zhubaeva" },
  { className: "10Ә", fullName: "Қайбашов Ақылбек Терекбайұлы", login: "kaibashov" },
  { className: "10Б", fullName: "Умирзаков Бақытбек Бауыржанұлы", login: "umirzakov" },
  { className: "10В", fullName: "Мухтарова Камшат Мухтаровна", login: "mukhtarova" },

  { className: "11А", fullName: "Толеуханова Гүлбақыт Турлановна", login: "toleukhanova" },
  { className: "11Ә", fullName: "Сейтенова Базаргул Губайдулловна", login: "seitenova" },
  { className: "11Б", fullName: "Бисенбай Ақмарал Жексенбайқызы", login: "bisenbai" },
  { className: "11В", fullName: "Нурмагамбетова Кенжекей Маулетовна", login: "nurmagambetova" },
];
