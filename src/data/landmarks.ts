/**
 * Campus landmarks: the pins on the map and the content of the detail panel.
 *
 * Editing guide (no coding needed beyond copying the patterns below):
 * - Text: edit `name` and `description` in both `th` and `en`.
 * - Coordinates: decimal lat/lng. If you move a pin by hand, set
 *   `coordSource: 'manual'`.
 * - Photos: add entries to `images`. For your own photo, put the file at
 *   `public/images/landmarks/<id>.jpg` and add ONE line to that landmark:
 *
 *     images: [own('Your Name', 'CC BY 4.0'), ...]
 *
 *   (`own()` uses the landmark's id automatically; pass a third argument for a
 *   different file name.) Then remove the landmark from TODO-images.md.
 * - Search: add nicknames and alternate spellings to `searchAliases`.
 *
 * Every fact should be traceable to `sources`. Put doubts in `notes`.
 */
import type { Landmark, LandmarkImage } from './types'

const KU_LANDMARKS = 'https://ku.ac.th/landmark'
const KU_FOOD = 'https://www.ku.ac.th/en/food-and-drink'
const KU_SPORTS = 'https://ku.ac.th/en/sports-and-health'
const KU_SPORTS_TH = 'https://ku.ac.th/th/sports-and-health'
const WIKI_TH = (title: string) => `https://th.wikipedia.org/wiki/${encodeURIComponent(title)}`
const OSM = (id: string) => `https://www.openstreetmap.org/${id}`

/** An image hosted on Wikimedia Commons. `file` is the name without the "File:" prefix. */
function commons(file: string, author: string, license: string): LandmarkImage {
  const name = file.replace(/ /g, '_')
  return {
    url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=960`,
    author,
    license,
    sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(name)}`,
  }
}

/**
 * Your own photo in public/images/landmarks/. Used as `own('Author', 'License')`
 * inside a landmark; the id placeholder is filled in by `withOwnImages` below.
 */
function own(author: string, license: string, file?: string): LandmarkImage {
  return { url: `images/landmarks/${file ?? '{id}'}.jpg`, author, license, sourceUrl: '' }
}
// Exported so editors can find it from this file; referenced in the editing guide.
export { own }

const raw: Landmark[] = [
  // ─── Gates ───────────────────────────────────────────────────────────────
  {
    id: 'gate-phahonyothin-1',
    category: 'gate',
    coordinates: { lat: 13.841536, lng: 100.576401 },
    coordSource: 'osm',
    osmId: 'node/10275199705',
    name: { th: 'ประตูพหลโยธิน 1', en: 'Phahonyothin Gate 1' },
    description: {
      th: 'ประตูหลักของมหาวิทยาลัยฝั่งถนนพหลโยธิน ทางทิศตะวันออกเฉียงใต้ของวิทยาเขต เข้ามาแล้วจะพบศาลาหกเหลี่ยมและหอประชุมใหญ่อยู่ใกล้ ๆ',
      en: "The university's main gate on Phahonyothin Road, at the south-east corner of the campus. The Hexagonal Pavilion and the Main Auditorium are just inside.",
    },
    images: [],
    searchAliases: ['ประตูพหล', 'ประตูพหลฯ', 'Phahon Yothin Gate', 'Paholyothin Gate', 'main gate'],
    sources: [OSM('node/10275199705')],
    notes: 'OSM tags this entrance as entrance=main and names it in English only; Thai name follows the same numbering.',
  },
  {
    id: 'gate-ngamwongwan-1',
    category: 'gate',
    featured: true,
    coordinates: { lat: 13.842212, lng: 100.571391 },
    coordSource: 'osm',
    osmId: 'node/10275257609',
    name: { th: 'ประตูงามวงศ์วาน 1', en: 'Ngamwongwan Gate 1' },
    description: {
      th: 'ประตูฝั่งถนนงามวงศ์วานทางด้านใต้ของวิทยาเขต อยู่ใกล้ศูนย์หนังสือมหาวิทยาลัยเกษตรศาสตร์ และมีป้ายรถตะลัย "ประตูงามวงศ์วาน 1" อยู่ด้านใน',
      en: 'A gate on Ngamwongwan Road on the south side of campus, close to the KU Book Center. The "Ngamwongwan Gate 1" shuttle stop is just inside.',
    },
    images: [],
    searchAliases: ['ประตู 1', 'ประตูงามวงศ์วาน', 'Ngam Wong Wan Gate 1'],
    sources: [OSM('node/10275257609'), OSM('node/891276461'), OSM('node/1374627083')],
  },
  {
    id: 'gate-ngamwongwan-3',
    category: 'gate',
    coordinates: { lat: 13.845228, lng: 100.566001 },
    coordSource: 'osm',
    osmId: 'node/10275199707',
    name: { th: 'ประตูงามวงศ์วาน 3', en: 'Ngamwongwan Gate 3' },
    description: {
      th: 'ประตูฝั่งถนนงามวงศ์วานทางด้านตะวันตกเฉียงใต้ของวิทยาเขต ใกล้ KU Avenue และสนามอินทรีจันทรสถิตย์',
      en: 'A gate on Ngamwongwan Road at the south-west of campus, next to KU Avenue and Inseechandrasatitya Stadium.',
    },
    images: [],
    searchAliases: ['ประตู 3', 'Ngam Wong Wan Gate 3'],
    sources: [OSM('node/10275199707'), KU_FOOD],
  },
  {
    id: 'gate-vibhavadi',
    category: 'gate',
    coordinates: { lat: 13.852381, lng: 100.564654 },
    coordSource: 'osm',
    osmId: 'node/10275199706',
    name: { th: 'ประตูวิภาวดีรังสิต', en: 'Vibhavadi Rangsit Gate' },
    shortName: { th: 'ประตูวิภาวดีรังสิต', en: 'Vibhavadi Gate' },
    description: {
      th: 'ประตูฝั่งถนนวิภาวดีรังสิต ทางทิศตะวันตกเฉียงเหนือของวิทยาเขต',
      en: 'The gate on Vibhavadi Rangsit Road, at the north-west of campus.',
    },
    images: [],
    searchAliases: ['ประตูวิภาวดี', 'Vibhavadi Gate'],
    sources: [OSM('node/10275199706')],
    notes: 'OSM has the English name only. Thai name is a direct rendering and has not been checked against KU signage.',
  },

  // ─── Landmarks ───────────────────────────────────────────────────────────
  {
    id: 'auditorium',
    category: 'landmark',
    featured: true,
    coordinates: { lat: 13.841317, lng: 100.574773 },
    coordSource: 'osm',
    osmId: 'way/259685345',
    name: { th: 'หอประชุมใหญ่', en: 'Main Auditorium' },
    description: {
      th: 'หอประชุมมหาวิทยาลัยเกษตรศาสตร์ วางศิลาฤกษ์เมื่อ 18 เมษายน 2497 และสร้างเสร็จในปี 2500 เพื่อใช้จัดพิธีพระราชทานปริญญาบัตร ด้านหน้ามีต้นนนทรีทรงปลูก 9 ต้น ซึ่งพระบาทสมเด็จพระเจ้าอยู่หัวและสมเด็จพระราชินีทรงปลูกเมื่อ 29 พฤศจิกายน 2506 และเป็นที่มาของต้นไม้ประจำมหาวิทยาลัย',
      en: "The university's main auditorium: its foundation stone was laid on 18 April 1954 and it was completed in 1957 for degree-conferment ceremonies. In front stand nine Nontri trees planted by the King and Queen on 29 November 1963, the origin of the Nontri as the university tree.",
    },
    images: [
      commons('Kasetsart University Auditorium.jpg', 'David Supervid', 'CC BY-SA 4.0'),
      commons('Main auditorium of Kasetsart University (Bangkok).jpg', 'abhichartt', 'Public domain'),
    ],
    searchAliases: ['หอประชุม', 'หอประชุมมหาวิทยาลัยเกษตรศาสตร์', 'หอประชุมเกษตรกลางบางเขน', 'ต้นนนทรีทรงปลูก', 'นนทรี', 'KU Auditorium', 'Nontri'],
    sources: [KU_LANDMARKS, 'https://commons.wikimedia.org/wiki/File:Kasetsart_University_Auditorium.jpg', 'https://en.wikipedia.org/wiki/Kasetsart_University'],
    notes: 'Foundation-stone date is from the Commons file description; completion year and Nontri trees from ku.ac.th/landmark.',
  },
  {
    id: 'three-founders',
    category: 'landmark',
    featured: true,
    coordinates: { lat: 13.84217, lng: 100.573071 },
    coordSource: 'osm',
    osmId: 'node/891276459',
    name: { th: 'อนุสาวรีย์สามบูรพาจารย์', en: 'Three Founders Monument' },
    shortName: { th: 'สามบูรพาจารย์', en: 'Three Founders' },
    description: {
      th: 'อนุสาวรีย์ของหลวงสุวรรณวาจกกสิกิจ หลวงอิงคศรีกสิการ และพระช่วงเกษตรศิลปการ ผู้วางรากฐานการเกษตรและการศึกษาด้านการเกษตรของไทย หรือที่รู้จักกันในชื่อ "สามเสือเกษตร" ตั้งอยู่หน้าอาคารสถาบันเกษตราธิการ',
      en: 'Statues of Luang Suvarnavachakakasikij, Luang Ingasrikasikan and Phra Chuangkasetsilapakan, who laid the foundations of Thai agriculture and agricultural education, nicknamed the "Three Tigers of Kaset". It stands in front of the Kasetrathikarn Institute building.',
    },
    images: [
      commons('The Three Co-founders of Kasetsart University.jpg', 'Sirakorn Lamyai', 'CC BY-SA 4.0'),
      commons('มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตบางเขน เขตจตุจักร กรุงเทพมหานคร (15).jpg', 'กสิณธร ราชโอรส', 'CC BY-SA 4.0'),
    ],
    searchAliases: ['สามเสือเกษตร', 'สามบูรพาจารย์', 'Three Masters', 'Three Pioneers'],
    sources: [KU_LANDMARKS, OSM('node/891276459'), OSM('way/259504600'), 'https://commons.wikimedia.org/wiki/Category:Monuments_of_the_3_Masters_of_Kasetsart_University'],
  },
  {
    id: 'hexagonal-pavilion',
    category: 'landmark',
    featured: true,
    coordinates: { lat: 13.841858, lng: 100.576022 },
    coordSource: 'osm',
    osmId: 'way/259496890',
    name: { th: 'ศาลาหกเหลี่ยม', en: 'Hexagonal Pavilion' },
    description: {
      th: 'ศาลาเดิมสร้างราวปี 2490 โดยแผนกทดลองและเพาะเลี้ยง กรมการประมง ศาลาปัจจุบันจำลองจากศาลาไม้หลังเดิม เปิดเมื่อ 2 กุมภาพันธ์ 2542 เป็นที่จัดแสดงนิทรรศการด้านประวัติและความรู้ทางการเกษตร',
      en: 'The original pavilion was built around 1947 by the Fisheries Department’s experimental and breeding division. Today’s replica of the wooden original opened on 2 February 1999 and hosts exhibitions on agricultural history and knowledge.',
    },
    images: [],
    searchAliases: ['ศาลา 6 เหลี่ยม', 'หกเหลี่ยม', 'Hexagon Pavilion'],
    sources: [KU_LANDMARKS, OSM('way/259496890')],
    notes: 'OSM name has a typo ("ศาสาหกเหลี่ยม"); corrected here. A 2008 blog says shuttle lines start and end here; not used until verified in milestone 5.',
  },
  {
    id: 'chakrabandh-pensiri',
    category: 'landmark',
    featured: true,
    coordinates: { lat: 13.849733, lng: 100.568332 },
    coordSource: 'osm',
    osmId: 'way/157198880',
    name: { th: 'อาคารจักรพันธ์เพ็ญศิริ', en: 'Chakrabandhu Pensiri Hall' },
    shortName: { th: 'อาคารจักรพันธ์ฯ', en: 'Chakrabandhu Hall' },
    description: {
      th: 'อาคารอเนกประสงค์ขนาดประมาณ 3,000 ที่นั่ง สร้างเมื่อปี 2528 เดิมเป็นโรงยิมอเนกประสงค์ ปัจจุบันใช้จัดพิธีพระราชทานปริญญาบัตร งานกิจกรรมของมหาวิทยาลัย และเป็นสถานที่รับสมัครสอบเข้ามหาวิทยาลัย',
      en: 'A multipurpose hall seating about 3,000, built in 1985 and originally a sports hall. It now hosts degree ceremonies, university events and admissions registration.',
    },
    images: [],
    searchAliases: ['จักรพันธ์', 'อาคารจักรพันธ์', 'Chakrapan Phensiri', 'Chakrabandh Pensiri'],
    sources: [KU_LANDMARKS, 'https://www.khaosod.co.th/monitor-news/news_9451584'],
  },
  {
    id: 'hall-of-history',
    category: 'landmark',
    coordinates: { lat: 13.845773, lng: 100.566361 },
    coordSource: 'osm',
    osmId: 'way/94728856',
    name: { th: 'หอประวัติมหาวิทยาลัยเกษตรศาสตร์', en: 'KU Hall of History' },
    shortName: { th: 'หอประวัติ มก.', en: 'KU History Hall' },
    description: {
      th: 'พิพิธภัณฑ์ประวัติของมหาวิทยาลัย ตั้งอยู่ใกล้ KU Home และร้านสหกรณ์มหาวิทยาลัยเกษตรศาสตร์',
      en: "The university's history museum, near KU Home and the KU Co-operative Store.",
    },
    images: [],
    searchAliases: ['หอประวัติ', 'หอประวัติฯ', 'Hall of History', 'museum'],
    sources: [OSM('way/94728856'), OSM('way/258879469')],
    notes: 'OSM tags it tourism=museum. Exhibits and opening hours not verified.',
  },
  {
    id: 'ag-museum',
    category: 'landmark',
    coordinates: { lat: 13.847712, lng: 100.563752 },
    coordSource: 'osm',
    osmId: 'node/891253823',
    name: { th: 'สำนักพิพิธภัณฑ์และวัฒนธรรมการเกษตร', en: 'Office of Agricultural Museum and Culture' },
    shortName: { th: 'พิพิธภัณฑ์เกษตรฯ', en: 'Ag Museum' },
    description: {
      th: 'หน่วยงานพิพิธภัณฑ์ด้านการเกษตรของมหาวิทยาลัย ตั้งอยู่ทางด้านตะวันตกของวิทยาเขต ใกล้เขตหอพักนิสิตหญิง',
      en: "The university's agricultural museum office, on the west side of campus near the women's dormitories.",
    },
    images: [],
    searchAliases: ['พิพิธภัณฑ์เกษตร', 'Agricultural Museum'],
    sources: [OSM('node/891253823')],
    notes: 'Only OSM confirms this. Collections, opening hours and the exact building are not verified.',
  },

  // ─── Administration & services ───────────────────────────────────────────
  {
    id: 'golden-jubilee',
    category: 'admin',
    featured: true,
    coordinates: { lat: 13.853438, lng: 100.569883 },
    coordSource: 'osm',
    osmId: 'way/403121488',
    name: { th: 'อาคารสารนิเทศ 50 ปี', en: 'KU Golden Jubilee Administration and Information Center' },
    shortName: { th: 'อาคารสารนิเทศ 50 ปี', en: 'KU 50th Anniv. Bldg' },
    description: {
      th: 'อาคารสูง 10 ชั้น สร้างเนื่องในโอกาสครบรอบ 50 ปีของมหาวิทยาลัย เริ่มใช้งานในปี 2540 เป็นที่ตั้งของหน่วยงานบริหารส่วนกลางและสำนักงานอธิการบดี',
      en: "A 10-storey building marking the university's 50th anniversary, in use since 1997. It houses the central administration and the Office of the President.",
    },
    images: [],
    searchAliases: ['สารนิเทศ', 'ตึกสารนิเทศ', 'สำนักงานอธิการบดี', 'อธิการบดี', 'Office of the President', 'Golden Jubilee Building'],
    sources: [KU_LANDMARKS, KU_FOOD],
  },
  {
    id: 'infirmary',
    category: 'admin',
    coordinates: { lat: 13.84673, lng: 100.568333 },
    coordSource: 'osm',
    osmId: 'way/123189159',
    name: { th: 'สถานพยาบาล มหาวิทยาลัยเกษตรศาสตร์', en: 'KU Infirmary' },
    shortName: { th: 'สถานพยาบาล มก.', en: 'KU Infirmary' },
    description: {
      th: 'สถานพยาบาลของมหาวิทยาลัย ให้บริการตรวจรักษาโรคทั่วไป ฉีดวัคซีน ทำแผล ทันตกรรม กายภาพบำบัด และให้คำปรึกษาด้านสุขภาพจิต ตรวจสอบเวลาเปิดบริการล่าสุดกับสถานพยาบาลก่อนไป',
      en: "The university's health service: general medical care, vaccinations, wound care, dentistry, physical therapy and mental-health advice. Check current opening hours before you go.",
    },
    images: [],
    searchAliases: ['สถานพยาบาล', 'ห้องพยาบาล', 'คลินิก', 'clinic', 'health service', 'Pinyo Kalyanamitra'],
    sources: [KU_SPORTS, OSM('way/123189159')],
    notes: 'KU says weekday service is in the Pinyo Kalyanamitra Building; the OSM area is not named that, so the exact building is unconfirmed.',
  },
  {
    id: 'vet-hospital',
    category: 'admin',
    coordinates: { lat: 13.844348, lng: 100.577522 },
    coordSource: 'osm',
    osmId: 'way/589746727',
    name: { th: 'โรงพยาบาลสัตว์ มหาวิทยาลัยเกษตรศาสตร์ บางเขน', en: 'KU Veterinary Teaching Hospital, Bangkhen' },
    shortName: { th: 'รพ.สัตว์ มก.', en: 'KU Vet Hospital' },
    description: {
      th: 'โรงพยาบาลสัตว์ของคณะสัตวแพทยศาสตร์ รักษาสุนัข แมว กระต่าย และสัตว์เลี้ยงชนิดพิเศษบางชนิด มีหน่วยคลินิก 21 หน่วย และเป็นที่ฝึกปฏิบัติของนิสิตสัตวแพทย์ ที่นี่ยังมี "สระสุวรรณชาด" สระธาราบำบัดสำหรับสุนัขที่มีปัญหาข้อ กระดูก และระบบประสาท',
      en: 'The Faculty of Veterinary Medicine’s teaching hospital treats mainly dogs, cats and rabbits, plus some exotic pets, across 21 clinical departments. It also has the Suwannachat Pool, a hydrotherapy pool for dogs with joint, bone and nerve conditions.',
    },
    images: [],
    searchAliases: ['โรงพยาบาลสัตว์', 'รพ.สัตว์', 'โรงพยาบาลสัตว์เล็ก', 'สระสุวรรณชาด', 'vet hospital', 'animal hospital'],
    sources: [KU_SPORTS, KU_SPORTS_TH, KU_LANDMARKS, OSM('way/589746727')],
  },
  {
    id: 'ku-home',
    category: 'admin',
    coordinates: { lat: 13.845105, lng: 100.567612 },
    coordSource: 'osm',
    osmId: 'way/239146927',
    name: { th: 'เคยู โฮม', en: 'KU Home' },
    description: {
      th: 'ที่พักภายในวิทยาเขต อยู่ใกล้หอประวัติมหาวิทยาลัยและร้านสหกรณ์มหาวิทยาลัยเกษตรศาสตร์',
      en: 'On-campus accommodation near the KU Hall of History and the KU Co-operative Store.',
    },
    images: [],
    searchAliases: ['KU Home', 'เคยูโฮม', 'โรงแรม', 'hotel', 'accommodation'],
    sources: [OSM('way/239146927'), OSM('node/891242942')],
    notes: 'OSM tags it tourism=motel. Booking and facility details are not verified.',
  },
  {
    id: 'dormitories',
    category: 'admin',
    coordinates: { lat: 13.848589, lng: 100.564147 },
    coordSource: 'osm',
    osmId: 'way/77593889',
    name: { th: 'หอพักนิสิต', en: 'Student Dormitories' },
    description: {
      th: 'เขตหอพักนิสิตในวิทยาเขต ประกอบด้วยหอพักนิสิตหญิงทางด้านตะวันตก เช่น หอพักมหาหงส์ ราชาวดี คัทลียา และขจรรัตน์ และหอพักนิสิตชายทางทิศตะวันออกของสนามอินทรีจันทรสถิตย์ หมุดนี้อยู่ที่กลุ่มหอพักหญิง',
      en: "The on-campus dorm zone: the women's dormitories on the west side (e.g. Mahahong, Rachawadee, Cattleya and Khajornrat) and the men's dormitories east of Inseechandrasatitya Stadium. The pin marks the women's dorm cluster.",
    },
    images: [],
    searchAliases: ['หอใน', 'หอพัก', 'หอพักหญิง', 'หอพักชาย', 'dorm', 'dormitory'],
    sources: [OSM('way/77593889'), OSM('node/2713419153'), OSM('node/1374621701')],
    notes: "Dorm names are as tagged in OSM. English spellings of the dorm names are transliterations, not KU's official romanizations.",
  },

  // ─── Library & study ─────────────────────────────────────────────────────
  {
    id: 'library',
    category: 'library',
    featured: true,
    coordinates: { lat: 13.848107, lng: 100.571813 },
    coordSource: 'osm',
    osmId: 'way/336752159',
    name: { th: 'สำนักหอสมุด', en: 'KU Library' },
    description: {
      th: 'ห้องสมุดกลางของมหาวิทยาลัย หมุดอยู่ที่อาคารศูนย์การเรียนรู้ของสำนักหอสมุด ข้างอาคารช่วงเกษตรศิลปการ และมีป้ายรถตะลัย "สำนักหอสมุด" อยู่ใกล้ ๆ',
      en: "The university's central library. The pin marks the Library's Learning Center building, next to the Chuang Kasetsilapakan Building, with the \"Library\" shuttle stop close by.",
    },
    images: [],
    searchAliases: ['หอสมุด', 'ห้องสมุด', 'ห้องสมุดกลาง', 'ศูนย์การเรียนรู้', 'Learning Center', 'library'],
    sources: [OSM('way/336752159'), OSM('way/589727993'), OSM('node/891278241'), 'https://lib.ku.ac.th/'],
    notes: 'Which library services are in which building is not verified.',
  },
  {
    id: 'lecture-hall-1',
    category: 'library',
    featured: true,
    coordinates: { lat: 13.847153, lng: 100.57095 },
    coordSource: 'osm',
    osmId: 'way/173271563',
    name: { th: 'ศูนย์เรียนรวม 1', en: 'Lecture Hall 1' },
    description: {
      th: 'อาคารเรียนรวม 3 ชั้น อยู่ระหว่างคณะวิทยาศาสตร์และคณะวิศวกรรมศาสตร์ ใกล้ศูนย์อาหารของทั้งสองคณะ',
      en: 'A three-storey shared lecture building between the Faculties of Science and Engineering, close to both faculties’ food centers.',
    },
    images: [],
    searchAliases: ['ศร.1', 'ศร1', 'อาคารเรียนรวม', 'LH1', 'Lecture Hall'],
    sources: [OSM('way/173271563'), KU_FOOD],
  },
  {
    id: 'lecture-halls-2-4',
    category: 'library',
    coordinates: { lat: 13.849676, lng: 100.5694 },
    coordSource: 'derived',
    name: { th: 'ศูนย์เรียนรวม 2–4', en: 'Lecture Halls 2–4' },
    description: {
      th: 'กลุ่มอาคารเรียนรวม 2, 3 และ 4 ตั้งเรียงกันใกล้คณะมนุษยศาสตร์ คณะสังคมศาสตร์ และอาคารจักรพันธ์เพ็ญศิริ มีป้ายรถตะลัย "ศร. 4" อยู่ใกล้ ๆ',
      en: 'Lecture Halls 2, 3 and 4 stand in a row near the Faculties of Humanities and Social Sciences and Chakrabandhu Pensiri Hall, with the "LH 4" shuttle stop nearby.',
    },
    images: [],
    searchAliases: ['ศร.2', 'ศร.3', 'ศร.4', 'LH2', 'LH3', 'LH4', 'อาคารเรียนรวม'],
    sources: [OSM('way/173120093'), OSM('way/173120094'), OSM('way/173119727'), OSM('node/2713419156')],
    notes: 'Pin is the mean of the three OSM building centroids (way/173120093, way/173120094, way/173119727).',
  },

  // ─── Faculties ───────────────────────────────────────────────────────────
  {
    id: 'fac-agriculture',
    category: 'faculty',
    featured: true,
    coordinates: { lat: 13.84937, lng: 100.571502 },
    coordSource: 'osm',
    osmId: 'node/891270840',
    name: { th: 'คณะเกษตร', en: 'Faculty of Agriculture' },
    shortName: { th: 'คณะเกษตร', en: 'Agriculture' },
    description: {
      th: 'คณะเกษตรก่อตั้งเมื่อ 2 กุมภาพันธ์ 2486 วันเดียวกับการสถาปนามหาวิทยาลัยเกษตรศาสตร์ ตั้งอยู่กลางวิทยาเขต ใกล้คณะมนุษยศาสตร์และสำนักหอสมุด',
      en: 'Founded on 2 February 1943, the same day as the university itself. It sits in the middle of campus near the Faculty of Humanities and the KU Library.',
    },
    images: [],
    searchAliases: ['เกษตร', 'คณะเกษตรศาสตร์', 'Agriculture', 'AG'],
    sources: [WIKI_TH('คณะเกษตร มหาวิทยาลัยเกษตรศาสตร์'), KU_FOOD, OSM('node/891270840')],
  },
  {
    id: 'fac-engineering',
    category: 'faculty',
    featured: true,
    coordinates: { lat: 13.845669, lng: 100.569092 },
    coordSource: 'osm',
    osmId: 'way/75719557',
    name: { th: 'คณะวิศวกรรมศาสตร์', en: 'Faculty of Engineering' },
    shortName: { th: 'คณะวิศวกรรมศาสตร์', en: 'Engineering' },
    description: {
      th: 'มีจุดเริ่มต้นจากโรงเรียนช่างชลประทานในปี 2481 เป็นคณะวิศวกรรมชลประทานในเครือมหาวิทยาลัยในปี 2497 และเป็นคณะวิศวกรรมศาสตร์ในปี 2509 ในพื้นที่คณะมีอาคาร 4 ที่เรียกกันว่า "หัวลำโพง"',
      en: 'It began as the Irrigation School in 1938, became the Faculty of Irrigation Engineering under the university in 1954 and the Faculty of Engineering in 1966. Its buildings include Building 4, nicknamed "Hua Lamphong".',
    },
    images: [],
    searchAliases: ['วิศวะ', 'วิศวกรรม', 'วศ.', 'วศ.มก.', 'หัวลำโพง', 'Engineering', 'ENG'],
    sources: [WIKI_TH('คณะวิศวกรรมศาสตร์ มหาวิทยาลัยเกษตรศาสตร์'), OSM('way/75719557'), OSM('way/94170891')],
  },
  {
    id: 'fac-science',
    category: 'faculty',
    featured: true,
    coordinates: { lat: 13.845453, lng: 100.571486 },
    coordSource: 'osm',
    osmId: 'way/75496098',
    name: { th: 'คณะวิทยาศาสตร์', en: 'Faculty of Science' },
    shortName: { th: 'คณะวิทยาศาสตร์', en: 'Science' },
    description: {
      th: 'ก่อตั้งเมื่อ 9 มีนาคม 2509 พื้นที่คณะมีอาคารปฏิบัติการวิทยาศาสตร์กายภาพ 45 ปี (SC45) อาคารศูนย์วิจัยวิทยาศาสตร์จุฬาภรณ์ 60 พรรษา และอาคารพิพิธภัณฑ์สัตววิทยา',
      en: 'Founded on 9 March 1966. Its buildings include the 45th Anniversary Physical Science Building (SC45), the Princess Chulabhorn Science Research Center and the Zoological Museum.',
    },
    images: [commons('Science KU Building II.jpg', 'David Supervid', 'CC BY-SA 4.0')],
    searchAliases: ['วิทยาศาสตร์', 'คณะวิทย์', 'วิทย์', 'Science', 'SCI'],
    sources: [WIKI_TH('คณะวิทยาศาสตร์ มหาวิทยาลัยเกษตรศาสตร์'), 'https://commons.wikimedia.org/wiki/Category:Faculty_of_Science,_Kasetsart_University'],
  },
  {
    id: 'cs-sc45',
    category: 'faculty',
    coordinates: { lat: 13.845757, lng: 100.571305 },
    coordSource: 'osm',
    osmId: 'way/239146929',
    name: { th: 'ภาควิชาวิทยาการคอมพิวเตอร์ (อาคาร SC45)', en: 'Department of Computer Science (SC45)' },
    shortName: { th: 'วิทยาการคอมฯ SC45', en: 'Comp Sci · SC45' },
    description: {
      th: 'ภาควิชาวิทยาการคอมพิวเตอร์ คณะวิทยาศาสตร์ อยู่ที่ชั้น 7 ของอาคารปฏิบัติการวิทยาศาสตร์กายภาพ 45 ปี (SC45) ซึ่งเป็นอาคารสูง 12 ชั้น',
      en: 'The Faculty of Science’s Computer Science department is on the 7th floor of the 12-storey 45th Anniversary Physical Science Building (SC45).',
    },
    images: [commons('Science 45 Years Building.jpg', 'David Supervid', 'CC BY-SA 4.0')],
    searchAliases: ['คอมพิวเตอร์', 'วิทยาการคอมพิวเตอร์', 'คอมไซ', 'comsci', 'CS', 'SC45', 'ตึกวิทย์ 45 ปี'],
    sources: [OSM('way/239146929'), 'https://commons.wikimedia.org/wiki/File:Bandai_@sci-com_KU.jpg', 'https://commons.wikimedia.org/wiki/File:Postcard_7th_Floor_SC45.png'],
    notes: 'Floor number comes from user-contributed Commons captions, not an official KU page. Storey count is the OSM building:levels tag.',
  },
  {
    id: 'fac-economics',
    category: 'faculty',
    coordinates: { lat: 13.844084, lng: 100.569548 },
    coordSource: 'osm',
    osmId: 'node/1374641597',
    name: { th: 'คณะเศรษฐศาสตร์', en: 'Faculty of Economics' },
    shortName: { th: 'คณะเศรษฐศาสตร์', en: 'Economics' },
    description: {
      th: 'วิกิพีเดียระบุวันก่อตั้งคือ 2 กุมภาพันธ์ 2486 พร้อมการสถาปนามหาวิทยาลัย ตั้งอยู่ทางด้านใต้ของวิทยาเขต ติดกับคณะบริหารธุรกิจ',
      en: 'Thai Wikipedia gives its founding date as 2 February 1943, alongside the university. It is on the south side of campus next to the Faculty of Business Administration.',
    },
    images: [],
    searchAliases: ['เศรษฐศาสตร์', 'เศรษฐ', 'Economics', 'ECON'],
    sources: [WIKI_TH('คณะเศรษฐศาสตร์ มหาวิทยาลัยเกษตรศาสตร์'), KU_FOOD],
    notes: 'The 1943 date likely refers to a predecessor unit; not checked against the faculty’s own history page.',
  },
  {
    id: 'fac-business',
    category: 'faculty',
    featured: true,
    coordinates: { lat: 13.843945, lng: 100.568756 },
    coordSource: 'osm',
    osmId: 'node/1374579868',
    name: { th: 'คณะบริหารธุรกิจ', en: 'Faculty of Business Administration' },
    shortName: { th: 'คณะบริหารธุรกิจ', en: 'Business Admin.' },
    description: {
      th: 'เริ่มต้นเป็นส่วนหนึ่งของคณะเศรษฐศาสตร์และบริหารธุรกิจเมื่อ 9 มีนาคม 2509 และแยกเป็นคณะบริหารธุรกิจเมื่อ 18 ธันวาคม 2535 ตั้งอยู่ทางด้านใต้ของวิทยาเขต ติดกับคณะเศรษฐศาสตร์',
      en: 'It started within the Faculty of Economics and Business Administration on 9 March 1966 and became a separate faculty on 18 December 1992. It is on the south side of campus next to the Faculty of Economics.',
    },
    images: [commons('Kasetsart Business School Building.jpg', 'David Supervid', 'CC BY-SA 4.0')],
    searchAliases: ['บริหาร', 'บริหารธุรกิจ', 'KBS', 'Kasetsart Business School', 'BBA'],
    sources: [WIKI_TH('คณะบริหารธุรกิจ มหาวิทยาลัยเกษตรศาสตร์'), KU_FOOD],
  },
  {
    id: 'fac-social-sciences',
    category: 'faculty',
    coordinates: { lat: 13.849954, lng: 100.570138 },
    coordSource: 'osm',
    osmId: 'node/891270814',
    name: { th: 'คณะสังคมศาสตร์', en: 'Faculty of Social Sciences' },
    shortName: { th: 'คณะสังคมศาสตร์', en: 'Social Sciences' },
    description: {
      th: 'ก่อตั้งเมื่อ 7 มีนาคม 2517 ตั้งอยู่กลางวิทยาเขต ใกล้ศูนย์เรียนรวม 2–4 และคณะศึกษาศาสตร์',
      en: 'Founded on 7 March 1974. It is in the middle of campus near Lecture Halls 2–4 and the Faculty of Education.',
    },
    images: [],
    searchAliases: ['สังคม', 'สังคมศาสตร์', 'Social Sciences', 'SOC'],
    sources: [WIKI_TH('คณะสังคมศาสตร์ มหาวิทยาลัยเกษตรศาสตร์'), OSM('node/891270814')],
  },
  {
    id: 'fac-humanities',
    category: 'faculty',
    coordinates: { lat: 13.848739, lng: 100.569361 },
    coordSource: 'osm',
    osmId: 'way/544276189',
    name: { th: 'คณะมนุษยศาสตร์', en: 'Faculty of Humanities' },
    shortName: { th: 'คณะมนุษยศาสตร์', en: 'Humanities' },
    description: {
      th: 'ก่อตั้งเมื่อ 17 มิถุนายน 2524 ตั้งอยู่ใกล้คณะเกษตรและกลุ่มศูนย์เรียนรวม 2–4',
      en: 'Founded on 17 June 1981. It is near the Faculty of Agriculture and Lecture Halls 2–4.',
    },
    images: [],
    searchAliases: ['มนุษย์', 'มนุษยศาสตร์', 'มนุษย์ศาสตร์', 'Humanities', 'HUM'],
    sources: [WIKI_TH('คณะมนุษยศาสตร์ มหาวิทยาลัยเกษตรศาสตร์'), KU_FOOD],
    notes: 'OSM name:en says "Department of Humanities"; corrected here.',
  },
  {
    id: 'fac-education',
    category: 'faculty',
    coordinates: { lat: 13.850717, lng: 100.569935 },
    coordSource: 'osm',
    osmId: 'node/891270838',
    name: { th: 'คณะศึกษาศาสตร์', en: 'Faculty of Education' },
    shortName: { th: 'คณะศึกษาศาสตร์', en: 'Education' },
    description: {
      th: 'ก่อตั้งเมื่อ 28 พฤศจิกายน 2512 พื้นที่คณะมีอาคาร 1–4 คณะศึกษาศาสตร์ ตั้งอยู่ทางเหนือของคณะสังคมศาสตร์',
      en: 'Founded on 28 November 1969. Its Buildings 1–4 sit just north of the Faculty of Social Sciences.',
    },
    images: [],
    searchAliases: ['ศึกษา', 'ศึกษาศาสตร์', 'ศษ.', 'Education', 'EDU'],
    sources: [WIKI_TH('คณะศึกษาศาสตร์ มหาวิทยาลัยเกษตรศาสตร์'), OSM('way/758095334'), OSM('way/1446504118')],
  },
  {
    id: 'fac-fisheries',
    category: 'faculty',
    coordinates: { lat: 13.8548, lng: 100.568357 },
    coordSource: 'osm',
    osmId: 'way/75498137',
    name: { th: 'คณะประมง', en: 'Faculty of Fisheries' },
    shortName: { th: 'คณะประมง', en: 'Fisheries' },
    description: {
      th: 'ก่อตั้งเมื่อ 2 กุมภาพันธ์ 2486 พร้อมการสถาปนามหาวิทยาลัย ตั้งอยู่ทางเหนือสุดของวิทยาเขต ใกล้คณะสิ่งแวดล้อม และมีพิพิธภัณฑ์สัตว์น้ำบางเขนอยู่ในพื้นที่',
      en: 'Founded on 2 February 1943, alongside the university. It is at the northern end of campus near the Faculty of Environment, and includes the Bangkhen Aquatic Animal Museum.',
    },
    images: [],
    searchAliases: ['ประมง', 'Fisheries', 'พิพิธภัณฑ์สัตว์น้ำ'],
    sources: [WIKI_TH('คณะประมง มหาวิทยาลัยเกษตรศาสตร์'), KU_FOOD, OSM('node/891272542')],
    notes: 'Museum name is as tagged in OSM (พิพิธภัณฑ์สัตว์น้ำบางเขน); English rendering is ours.',
  },
  {
    id: 'fac-forestry',
    category: 'faculty',
    coordinates: { lat: 13.845532, lng: 100.574078 },
    coordSource: 'osm',
    osmId: 'way/589880230',
    name: { th: 'คณะวนศาสตร์', en: 'Faculty of Forestry' },
    shortName: { th: 'คณะวนศาสตร์', en: 'Forestry' },
    description: {
      th: 'มีจุดเริ่มต้นจากโรงเรียนป่าไม้ที่จังหวัดแพร่ ซึ่งเปิดสอนครั้งแรกเมื่อ 1 พฤษภาคม 2479 เป็นคณะวนศาสตร์เมื่อปี 2486 และย้ายมาที่บางเขนในปี 2499',
      en: 'It grew out of the Forestry School in Phrae, which first opened on 1 May 1936. It became the Faculty of Forestry in 1943 and moved to Bangkhen in 1956.',
    },
    images: [],
    searchAliases: ['วนศาสตร์', 'วนะ', 'ป่าไม้', 'Forestry'],
    sources: [WIKI_TH('คณะวนศาสตร์ มหาวิทยาลัยเกษตรศาสตร์')],
  },
  {
    id: 'fac-architecture',
    category: 'faculty',
    coordinates: { lat: 13.853326, lng: 100.5683 },
    coordSource: 'osm',
    osmId: 'way/1098693403',
    name: { th: 'คณะสถาปัตยกรรมศาสตร์', en: 'Faculty of Architecture' },
    shortName: { th: 'คณะสถาปัตยกรรมศาสตร์', en: 'Architecture' },
    description: {
      th: 'เริ่มจากภาควิชาสถาปัตยกรรมศาสตร์ในคณะวิศวกรรมศาสตร์เมื่อปี 2537 และตั้งเป็นคณะเมื่อ 1 มกราคม 2543 ตั้งอยู่ทางด้านเหนือของวิทยาเขต ใกล้อาคารสารนิเทศ 50 ปี',
      en: 'It began as the Department of Architecture within the Faculty of Engineering in 1994 and became a faculty on 1 January 2000. It is in the north of campus near the Golden Jubilee building.',
    },
    images: [],
    searchAliases: ['สถาปัตย์', 'สถาปัตยกรรม', 'ถาปัด', 'Architecture', 'ARCH'],
    sources: [WIKI_TH('คณะสถาปัตยกรรมศาสตร์ มหาวิทยาลัยเกษตรศาสตร์'), OSM('way/1098693403')],
  },
  {
    id: 'fac-agro-industry',
    category: 'faculty',
    coordinates: { lat: 13.851516, lng: 100.57118 },
    coordSource: 'osm',
    osmId: 'node/891270839',
    name: { th: 'คณะอุตสาหกรรมเกษตร', en: 'Faculty of Agro-Industry' },
    shortName: { th: 'คณะอุตสาหกรรมเกษตร', en: 'Agro-Industry' },
    description: {
      th: 'ก่อตั้งเมื่อ 23 พฤษภาคม 2523 ตั้งอยู่ทางด้านตะวันออกเฉียงเหนือของวิทยาเขต ใกล้โรงอาหารกลาง 2',
      en: 'Founded on 23 May 1980. It is in the north-east of campus near KU Canteen 2.',
    },
    images: [],
    searchAliases: ['อุตสาหกรรมเกษตร', 'อุตฯ', 'Agro-Industry', 'AGRO'],
    sources: [WIKI_TH('คณะอุตสาหกรรมเกษตร มหาวิทยาลัยเกษตรศาสตร์'), KU_FOOD],
  },
  {
    id: 'fac-vet',
    category: 'faculty',
    coordinates: { lat: 13.844551, lng: 100.577273 },
    coordSource: 'osm',
    osmId: 'way/589752219',
    name: { th: 'คณะสัตวแพทยศาสตร์', en: 'Faculty of Veterinary Medicine' },
    shortName: { th: 'คณะสัตวแพทยศาสตร์', en: 'Veterinary Medicine' },
    description: {
      th: 'ก่อตั้งเมื่อ 28 ธันวาคม 2497 ตั้งอยู่ฝั่งตรงข้ามถนนพหลโยธินจากวิทยาเขตหลัก ติดกับคณะเทคนิคการสัตวแพทย์ และมีโรงพยาบาลสัตว์ของมหาวิทยาลัยอยู่ในพื้นที่คณะ',
      en: 'Founded on 28 December 1954. It is across Phahonyothin Road from the main campus, next to the Faculty of Veterinary Technology, and includes the university’s veterinary teaching hospital.',
    },
    images: [],
    searchAliases: ['สัตวแพทย์', 'สัตวแพทยศาสตร์', 'สัตวแพทย์ศาสตร์', 'สพ.', 'Veterinary', 'VET'],
    sources: [WIKI_TH('คณะสัตวแพทยศาสตร์ มหาวิทยาลัยเกษตรศาสตร์'), OSM('way/589752219'), OSM('way/589752221')],
  },

  // ─── Food ────────────────────────────────────────────────────────────────
  {
    id: 'canteen-1',
    category: 'food',
    featured: true,
    coordinates: { lat: 13.848814, lng: 100.567315 },
    coordSource: 'osm',
    osmId: 'way/389998960',
    name: { th: 'โรงอาหารกลาง 1', en: 'KU Canteen 1' },
    description: {
      th: 'โรงอาหารกลางใกล้สระว่ายน้ำจุฬาภรณ์วลัยลักษณ์ เปิดทุกวันรวมวันหยุดนักขัตฤกษ์ ตรวจสอบเวลาเปิดร้านล่าสุดกับมหาวิทยาลัย',
      en: 'A central canteen near the Chulabhorn Walailak Swimming Pool, open daily including public holidays. Check current shop hours with the university.',
    },
    images: [],
    searchAliases: ['โรงอาหาร', 'โรงอาหาร 1', 'canteen', 'food court'],
    sources: [KU_FOOD, OSM('way/389998960')],
  },
  {
    id: 'canteen-2',
    category: 'food',
    coordinates: { lat: 13.852001, lng: 100.571728 },
    coordSource: 'osm',
    osmId: 'way/259504625',
    name: { th: 'โรงอาหารกลาง 2', en: 'KU Canteen 2' },
    description: {
      th: 'โรงอาหารกลางตรงข้ามอาคารสารนิเทศ 50 ปี ใกล้คณะอุตสาหกรรมเกษตร เปิดวันจันทร์ถึงเสาร์ ปิดวันอาทิตย์และวันหยุดนักขัตฤกษ์',
      en: 'A central canteen opposite the Golden Jubilee building, near the Faculty of Agro-Industry. Open Monday to Saturday; closed Sundays and public holidays.',
    },
    images: [],
    searchAliases: ['โรงอาหาร', 'โรงอาหาร 2', 'canteen', 'food court'],
    sources: [KU_FOOD, OSM('way/259504625')],
  },
  {
    id: 'ku-avenue',
    category: 'food',
    featured: true,
    coordinates: { lat: 13.846115, lng: 100.564774 },
    coordSource: 'osm',
    osmId: 'node/7085692217',
    name: { th: 'KU Avenue', en: 'KU Avenue' },
    description: {
      th: 'คอมมูนิตี้มอลล์ในมหาวิทยาลัย มีร้านอาหาร ร้านเครื่องดื่ม ร้านผักผลไม้ คลินิกทันตกรรม และร้านหนังสือ ตั้งอยู่ตรงข้ามสนามอินทรีจันทรสถิตย์ ใกล้ประตูงามวงศ์วาน 3 เปิดทุกวัน',
      en: 'An on-campus community mall with restaurants, drinks, fruit and vegetables, a dental clinic and a bookshop. It faces Inseechandrasatitya Stadium near Ngamwongwan Gate 3 and is open daily.',
    },
    images: [],
    searchAliases: ['เคยู อเวนิว', 'เคยูอเวนิว', 'KU Ave', 'mall'],
    sources: [KU_FOOD, OSM('node/7085692217')],
  },

  // ─── Sport ───────────────────────────────────────────────────────────────
  {
    id: 'stadium',
    category: 'sport',
    featured: true,
    coordinates: { lat: 13.847188, lng: 100.565736 },
    coordSource: 'osm',
    osmId: 'way/1313552698',
    name: { th: 'สนามอินทรีจันทรสถิตย์', en: 'Inseechandrasatitya Stadium' },
    shortName: { th: 'สนามอินทรีฯ', en: 'Insee Stadium' },
    description: {
      th: 'สนามกีฬาหลักของมหาวิทยาลัย ใช้แข่งฟุตบอล กรีฑา และวอลเลย์บอลชายหาด และเป็นสนามเหย้าของสโมสรฟุตบอลเกษตรศาสตร์',
      en: "The university's main stadium, used for football, athletics and beach volleyball, and the home ground of Kasetsart F.C.",
    },
    images: [commons('Insee Chantarasatit Stadium.jpg', 'Pudt', 'CC0')],
    searchAliases: ['Insee Chantarasatit', 'Insee Chantarasatit Stadium', 'สนามอินทรีย์จันทรสถิตย์', 'สนามอินทรี', 'สนามกีฬา', 'stadium'],
    sources: [KU_SPORTS, 'https://en.wikipedia.org/wiki/Insee_Chantarasatit_Stadium', OSM('way/1313552698')],
    notes: 'Capacity omitted: Wikipedia gives both 3,275 and 4,000. OSM spells the Thai name "อินทรีย์"; KU uses "อินทรี".',
  },
  {
    id: 'swimming-pool',
    category: 'sport',
    featured: true,
    coordinates: { lat: 13.84987, lng: 100.567173 },
    coordSource: 'osm',
    osmId: 'way/530953469',
    name: { th: 'สระว่ายน้ำจุฬาภรณ์วลัยลักษณ์', en: 'Chulabhorn Walailak Swimming Pool' },
    shortName: { th: 'สระว่ายน้ำจุฬาภรณ์ฯ', en: 'Chulabhorn Pool' },
    description: {
      th: 'ศูนย์ว่ายน้ำของมหาวิทยาลัย มี 4 สระ ได้แก่ สระแข่งขันมาตรฐานขนาด 50 × 25 เมตร สระกระโดดลึก 5 เมตร สระฝึกในร่มสำหรับผู้เริ่มต้น และสระฝึกซ้อมสำหรับนักกีฬา เปิดให้บุคคลทั่วไปใช้บริการด้วย',
      en: "The university's aquatic center has four pools: a 50 × 25 m competition pool, a 5 m deep diving pool, covered beginners' pools and a training pool for competitive swimmers. It is open to the general public.",
    },
    images: [],
    searchAliases: ['สระว่ายน้ำ', 'สระจุฬาภรณ์', 'สระว่ายน้ำจุฬาภรณ์', 'swimming pool', 'pool'],
    sources: [KU_SPORTS, KU_SPORTS_TH, OSM('way/530953469'), OSM('way/157198906')],
  },
]

/** Fill the `{id}` placeholder that `own()` leaves in local image paths. */
function withOwnImages(list: Landmark[]): Landmark[] {
  return list.map((l) => ({
    ...l,
    images: l.images.map((img) => ({ ...img, url: img.url.replace('{id}', l.id) })),
  }))
}

export const landmarks: Landmark[] = withOwnImages(raw)

export const landmarkById = new Map(landmarks.map((l) => [l.id, l]))

/*
 * ─── Waiting for coordinates ────────────────────────────────────────────────
 * Both are official KU landmarks (ku.ac.th/landmark) but OSM has no reliable
 * position for them. Paste a hand-checked lat/lng, set coordSource: 'manual',
 * and move the entry into the list above.
 *
 * {
 *   id: 'phra-phirun',
 *   category: 'landmark',
 *   coordinates: { lat: 0, lng: 0 }, // ← paste here
 *   coordSource: 'manual',
 *   name: { th: 'พระพิรุณทรงนาค', en: 'Phra Phirun Song Nak (Varuna Riding a Naga)' },
 *   description: {
 *     th: 'ประติมากรรมพระพิรุณทรงนาค สัญลักษณ์ของมหาวิทยาลัย ตั้งอยู่หน้าอาคารสุวรรณวาจกกสิกิจ ได้รับการบูรณะยกฐานสูงขึ้นและทำพิธีสักการะเมื่อ 16 กรกฎาคม 2547',
 *     en: 'The statue of Varuna riding a naga, a symbol of the university, stands in front of the Suvarnavajokkasikij Building. It was renovated on a raised base and rededicated on 16 July 2004.',
 *   },
 *   images: [], // candidates: Commons "มหาวิทยาลัยเกษตรศาสตร์ วิทยาเขตบางเขน เขตจตุจักร กรุงเทพมหานคร (31).jpg" and "(32).jpg" — check licence first
 *   searchAliases: ['พระพิรุณ', 'Phra Phirun', 'Varuna'],
 *   sources: ['https://ku.ac.th/landmark'],
 * },
 * {
 *   id: 'memorial-tower-60',
 *   category: 'landmark',
 *   coordinates: { lat: 0, lng: 0 }, // ← paste here
 *   coordSource: 'manual',
 *   name: { th: 'หออนุสรณ์ 60 ปี มก.', en: 'KU 60th Anniversary Memorial Tower' },
 *   description: {
 *     th: 'หอที่ระลึกถาวรเนื่องในวาระครบรอบ 60 ปีของมหาวิทยาลัย มีฐาน 3 ชั้นและยอดกระจกเจียระไน ลานด้านหน้าเป็นที่ฝังแคปซูลเวลาเมื่อ 27 เมษายน 2549 ซึ่งกำหนดเปิดครั้งแรกในวันที่ 2 กุมภาพันธ์ 2585',
 *     en: "A permanent memorial for the university's 60th anniversary, with a three-tier base and a faceted glass top. A time capsule was sealed in its front plaza on 27 April 2006, due to be opened on 2 February 2042.",
 *   },
 *   images: [],
 *   searchAliases: ['หออนุสรณ์', '60 ปี', 'Time Capsule', 'แคปซูลเวลา'],
 *   sources: ['https://ku.ac.th/landmark'],
 * },
 */
