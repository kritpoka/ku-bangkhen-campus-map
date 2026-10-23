/**
 * KU shuttle (รถตะลัย / รถสวัสดิการ มก.) — lines, stops and service.
 *
 * Sources (Office of Physical Plant and Sustainable Environment, KU):
 * - Route maps "แผนผังเส้นทางให้บริการรถโดยสารสวัสดิการ" dated 01032565
 *   (1 Mar 2022), linked from https://vehicle.ku.ac.th/index.html/ :
 *   …/wp-content/uploads/2022/06/bus_way.jpeg (all lines) and bus1/bus3/bus5.jpeg
 * - Service schedule poster uploaded 2026/08:
 *   …/wp-content/uploads/2026/08/Busway_010726.png
 *
 * Paths (shuttle-paths.json) were traced from the route maps onto OSM roads by
 * scripts/shuttle/trace_routes.py. Stop order is read from the route maps.
 * Stop positions: OSM bus-stop nodes where one matches the official stop,
 * otherwise read from the georeferenced official map (approximate).
 *
 * Editing: change names/notes freely; `stops` in a line is the ordered list of
 * stop ids. Re-run the trace script only if KU publishes new route maps.
 */
import type { Localized } from './types'
import paths from './shuttle-paths.json'

export interface ShuttleService {
  /** Buses in service, as listed on the schedule poster. */
  buses: number
  hours: Localized
}

export interface ShuttleLine {
  id: string
  /** Line colour on the official map (adjusted for contrast). */
  color: string
  name: Localized
  /** One-line summary of where it goes. */
  summary: Localized
  /** Ordered stop ids (a loop returns to the first stop). */
  stops: string[]
  /** Traced path polylines [lng, lat][]; empty when KU publishes no route map. */
  path: [number, number][][]
  service: { weekdays?: ShuttleService; saturday?: ShuttleService; sunday?: ShuttleService }
  notes?: Localized
}

export interface ShuttleStop {
  id: string
  /** Code printed on the official map (E12, W1, …). Absent for OSM-only stops. */
  code?: string
  osmId?: string
  coordinates: { lat: number; lng: number }
  /** osm = OSM bus-stop node; official-map = read from the georeferenced KU map. */
  coordSource: 'osm' | 'official-map'
  name: Localized
  /** Outside this map's campus area (shown in the line's stop list, not on the map). */
  offMap?: boolean
  notes?: string
}

const WEEKDAY_HOURS: Localized = { th: '06:30–18:30 และ 18:30–21:30 น.', en: '06:30–18:30 and 18:30–21:30' }
const WEEKEND_HOURS: Localized = { th: '07:00–17:00 น.', en: '07:00–17:00' }
const line = (id: string) => (paths.lines as unknown as Record<string, [number, number][][]>)[id] ?? []

export const shuttleLines: ShuttleLine[] = [
  {
    id: '1',
    color: '#d6262f',
    name: { th: 'สาย 1', en: 'Line 1' },
    summary: {
      th: 'วนจากศาลาหกเหลี่ยม ผ่านคณะวิทยาศาสตร์ หอสมุด คณะเกษตร ประตูวิภาวดีฯ หอพักหญิง โรงอาหารกลาง 1 และกลับทางหอประชุมใหญ่',
      en: 'Loop from the Hexagonal Pavilion via Science, the Library, Agriculture, Vibhavadi Gate, the women’s dorms and Canteen 1, back past the Main Auditorium',
    },
    stops: ['e1a', 'e3', 's1', 'c1', 'c2', 'e12', 'e14', 'c6', 'c7', 'c8', 'w1', 'w2', 'w3', 'c9', 'c10', 'c11', 'c12', 'e6', 'e5', 'e4', 'e2', 'e1b'],
    path: line('1'),
    service: {
      weekdays: { buses: 5, hours: WEEKDAY_HOURS },
      saturday: { buses: 2, hours: WEEKEND_HOURS },
      sunday: { buses: 2, hours: WEEKEND_HOURS },
    },
  },
  {
    id: '3',
    color: '#0b7a62',
    name: { th: 'สาย 3', en: 'Line 3' },
    summary: {
      th: 'วนจากศาลาหกเหลี่ยม ผ่านประตูงามวงศ์วาน 1–3 สนามอินทรีฯ สำนักการกีฬา คณะสถาปัตย์ อาคารสารนิเทศ 50 ปี โรงอาหารกลาง 2 คณะเกษตร และหอสมุด',
      en: 'Loop from the Hexagonal Pavilion via Ngamwongwan Gates 1–3, the stadium, the Sports Office, Architecture, the 50th Anniv. Building, Canteen 2, Agriculture and the Library',
    },
    stops: ['e1a', 'e3', 's1', 's2', 's3', 'w4', 'w6', 'w7', 'w1', 'w8', 'n1', 'n2', 'n3', 'n9', 'n11', 'e18', 'e15', 'e13', 'e11', 'e10', 'e6', 'e5', 'e4', 'e2', 'e1b'],
    path: line('3'),
    service: {
      weekdays: { buses: 4, hours: WEEKDAY_HOURS },
      saturday: { buses: 2, hours: WEEKEND_HOURS },
    },
  },
  {
    id: '5',
    color: '#27313d',
    name: { th: 'สาย 5', en: 'Line 5' },
    summary: {
      th: 'วิ่งสองทางระหว่างหอพักนิสิต (ซอยพหลโยธิน 45) กับใจกลางวิทยาเขตตามถนนสายตะวันออก ไปถึงคณะเทคนิคการสัตวแพทย์',
      en: 'Runs both ways between the student dormitories (Soi Phahonyothin 45) and the campus centre along the eastern road, out to Veterinary Technology',
    },
    stops: ['e21', 'e18', 'e15', 'e13', 'e11', 'e10', 'e8', 'e9', 'e7', 'e12', 'e14', 'e16', 'e17', 'e19', 'e20', 'e22', 'e23', 'e24', 'e25'],
    path: line('5'),
    service: {
      weekdays: { buses: 5, hours: WEEKDAY_HOURS },
      saturday: { buses: 2, hours: WEEKEND_HOURS },
      sunday: { buses: 2, hours: WEEKEND_HOURS },
    },
    notes: {
      th: 'ช่วงหอพักนิสิตอยู่นอกขอบเขตแผนที่นี้ และช่วงสุดท้ายไปป้าย E8–E9 ไม่ได้ลากเส้นไว้',
      en: 'The dormitory section is outside this map, and the last stretch to stops E8–E9 is not traced.',
    },
  },
  {
    id: 'sr1',
    color: '#b7791f',
    name: { th: 'สายเสริมพิเศษ ศร.1', en: 'Special line LH1 (ศร.1)' },
    summary: {
      th: 'สายเสริมช่วงเช้า 2 คัน มหาวิทยาลัยยังไม่ได้เผยแพร่แผนที่เส้นทาง',
      en: 'Extra morning service with 2 buses. KU has not published a route map for it.',
    },
    stops: [],
    path: [],
    service: { weekdays: { buses: 2, hours: { th: '07:30–09:30 น.', en: '07:30–09:30' } } },
    notes: {
      th: 'ตารางระบุเวลาให้บริการแต่ไม่ได้ระบุวัน (น่าจะเป็นวันทำการ)',
      en: 'The schedule gives hours but not days (probably weekdays).',
    },
  },
]

const stops: ShuttleStop[] = [
  { code: 'C1', id: 'c1', osmId: 'node/2699351223', coordinates: { lat: 13.843801, lng: 100.570352 }, coordSource: 'osm', name: { th: 'ภาควิชาคหกรรมศาสตร์', en: 'Dept. of Home Economics' } },
  { code: 'C2', id: 'c2', osmId: 'node/2699351224', coordinates: { lat: 13.845743, lng: 100.57055 }, coordSource: 'osm', name: { th: 'คณะวิทยาศาสตร์', en: 'Faculty of Science' } },
  { code: 'C6', id: 'c6', osmId: 'node/2713419158', coordinates: { lat: 13.850372, lng: 100.571219 }, coordSource: 'osm', name: { th: 'อาคารวชิรานุสรณ์', en: 'Wachiranusorn Building' } },
  { code: 'C7', id: 'c7', osmId: 'node/2713419156', coordinates: { lat: 13.850346, lng: 100.56895 }, coordSource: 'osm', name: { th: 'ศูนย์เรียนรวม 4', en: 'Lecture Hall 4' } },
  { code: 'C8', id: 'c8', osmId: 'node/2713419155', coordinates: { lat: 13.85038, lng: 100.566818 }, coordSource: 'osm', name: { th: 'สระว่ายน้ำจุฬาภรณ์วลัยลักษณ์', en: 'Chulabhorn Walailak Swimming Pool' } },
  { code: 'C9', id: 'c9', osmId: 'node/2713419153', coordinates: { lat: 13.847794, lng: 100.566867 }, coordSource: 'osm', name: { th: 'หอพักนิสิตชาย', en: 'Men\'s Dormitories' } },
  { code: 'C10', id: 'c10', osmId: 'node/2649308438', coordinates: { lat: 13.847167, lng: 100.568033 }, coordSource: 'osm', name: { th: 'กองกิจการนิสิต', en: 'Office of Student Affairs' } },
  { code: 'C11', id: 'c11', osmId: 'node/2713419140', coordinates: { lat: 13.846857, lng: 100.56939 }, coordSource: 'osm', name: { th: 'คณะวิศวกรรมศาสตร์', en: 'Faculty of Engineering' } },
  { code: 'C12', id: 'c12', osmId: 'node/891278687', coordinates: { lat: 13.846555, lng: 100.570935 }, coordSource: 'osm', name: { th: 'ศูนย์เรียนรวม 1 (ถนนระพีสาคริก)', en: 'Lecture Hall 1 (Rapee Sagarik Rd)' } },
  { code: 'E1a', id: 'e1a', osmId: 'node/891276465', coordinates: { lat: 13.842127, lng: 100.576081 }, coordSource: 'osm', name: { th: 'ศาลาหกเหลี่ยม (BTS ม.เกษตรศาสตร์)', en: 'Hexagonal Pavilion (BTS Kasetsart Univ.)' } },
  { code: 'E1b', id: 'e1b', coordinates: { lat: 13.840311, lng: 100.574748 }, coordSource: 'official-map', name: { th: 'หอประชุมใหญ่ (ประตูอมรพันธ์)', en: 'Main Auditorium (Amornphan Gate)' }, notes: 'Position from the georeferenced official map (approximate).' },
  { code: 'E2', id: 'e2', coordinates: { lat: 13.84239, lng: 100.574227 }, coordSource: 'official-map', name: { th: 'หอประชุมใหญ่', en: 'Main Auditorium' }, notes: 'Position from the georeferenced official map (approximate).' },
  { code: 'E3', id: 'e3', coordinates: { lat: 13.842631, lng: 100.573695 }, coordSource: 'official-map', name: { th: 'อนุสาวรีย์สามบูรพาจารย์', en: 'Three Founders Monument' }, notes: 'Position from the georeferenced official map (approximate).' },
  { code: 'E4', id: 'e4', coordinates: { lat: 13.842745, lng: 100.572403 }, coordSource: 'official-map', name: { th: 'สวนรวมพรรณไม้เกียรติประวัติไทย', en: 'Thai Commemorative Garden' }, notes: 'Position from the georeferenced official map (approximate).' },
  { code: 'E5', id: 'e5', osmId: 'node/891276472', coordinates: { lat: 13.842786, lng: 100.571926 }, coordSource: 'osm', name: { th: 'อาคารวิทยพัฒนา', en: 'Witthayaphatthana Building' } },
  { code: 'E6', id: 'e6', osmId: 'node/3204379765', coordinates: { lat: 13.844598, lng: 100.572632 }, coordSource: 'osm', name: { th: 'ตรงข้ามอาคาร SCL', en: 'Opposite SCL Building' } },
  { code: 'E7', id: 'e7', coordinates: { lat: 13.846116, lng: 100.573722 }, coordSource: 'official-map', name: { th: 'คณะวนศาสตร์', en: 'Faculty of Forestry' }, notes: 'Position from the georeferenced official map (approximate).' },
  { code: 'E8', id: 'e8', coordinates: { lat: 13.84544, lng: 100.576485 }, coordSource: 'official-map', name: { th: 'คณะเทคนิคการสัตวแพทย์ 1', en: 'Faculty of Veterinary Technology 1' }, notes: 'Position read from the official map; not on a traced road (approximate).' },
  { code: 'E9', id: 'e9', coordinates: { lat: 13.844766, lng: 100.576564 }, coordSource: 'official-map', name: { th: 'คณะเทคนิคการสัตวแพทย์ 2', en: 'Faculty of Veterinary Technology 2' }, notes: 'Position read from the official map; not on a traced road (approximate).' },
  { code: 'E10', id: 'e10', coordinates: { lat: 13.84654, lng: 100.572502 }, coordSource: 'official-map', name: { th: 'สถาบันวิจัยและพัฒนาแห่ง มก.', en: 'KU Research and Development Institute' }, notes: 'Position from the georeferenced official map (approximate).' },
  { code: 'E11', id: 'e11', coordinates: { lat: 13.847451, lng: 100.572503 }, coordSource: 'official-map', name: { th: 'สำนักหอสมุด (ฝั่งตะวันออก)', en: 'KU Library (east side)' }, notes: 'Position from the georeferenced official map (approximate).' },
  { code: 'E12', id: 'e12', osmId: 'node/891278241', coordinates: { lat: 13.847771, lng: 100.57251 }, coordSource: 'osm', name: { th: 'สำนักหอสมุด', en: 'KU Library' } },
  { code: 'E13', id: 'e13', osmId: 'node/2713419163', coordinates: { lat: 13.848748, lng: 100.572618 }, coordSource: 'osm', name: { th: 'ตึกปฐพีวิทยา', en: 'Soil Science Building' } },
  { code: 'E14', id: 'e14', osmId: 'node/2713419159', coordinates: { lat: 13.850117, lng: 100.572477 }, coordSource: 'osm', name: { th: 'คณะเกษตร 1', en: 'Faculty of Agriculture 1' } },
  { code: 'E15', id: 'e15', coordinates: { lat: 13.850473, lng: 100.572505 }, coordSource: 'official-map', name: { th: 'คณะเกษตร (ฝั่งตะวันออก)', en: 'Faculty of Agriculture (east side)' }, notes: 'Position from the georeferenced official map (approximate).' },
  { code: 'E16', id: 'e16', osmId: 'node/2713419160', coordinates: { lat: 13.850995, lng: 100.572467 }, coordSource: 'osm', name: { th: 'คณะอุตสาหกรรมเกษตร 1', en: 'Faculty of Agro-Industry 1' } },
  { code: 'E17', id: 'e17', osmId: 'node/2713419161', coordinates: { lat: 13.85174, lng: 100.572483 }, coordSource: 'osm', name: { th: 'คณะอุตสาหกรรมเกษตร 2', en: 'Faculty of Agro-Industry 2' } },
  { code: 'E18', id: 'e18', osmId: 'node/898449839', coordinates: { lat: 13.851543, lng: 100.57261 }, coordSource: 'osm', name: { th: 'กรมการข้าว', en: 'Rice Department' } },
  { code: 'E19', id: 'e19', coordinates: { lat: 13.852519, lng: 100.576755 }, coordSource: 'official-map', name: { th: 'หอพักนิสิต (ถนนเข้า)', en: 'Student Dormitories (access road)' }, offMap: true, notes: 'Position from the georeferenced official map (approximate).' },
  { code: 'E20', id: 'e20', coordinates: { lat: 13.852995, lng: 100.578408 }, coordSource: 'official-map', name: { th: 'อาคารสวัสดิการ มก.', en: 'KU Welfare Building' }, offMap: true, notes: 'Position from the georeferenced official map (approximate).' },
  { code: 'E21', id: 'e21', coordinates: { lat: 13.853455, lng: 100.579056 }, coordSource: 'official-map', name: { th: 'ศูนย์อาหาร', en: 'Food Center' }, offMap: true, notes: 'Position from the georeferenced official map (approximate).' },
  { code: 'E22', id: 'e22', coordinates: { lat: 13.853326, lng: 100.57988 }, coordSource: 'official-map', name: { th: 'หอพักนิสิต 1', en: 'Student Dormitories 1' }, offMap: true, notes: 'Position from the georeferenced official map (approximate).' },
  { code: 'E23', id: 'e23', coordinates: { lat: 13.853191, lng: 100.579986 }, coordSource: 'official-map', name: { th: 'หอพักนิสิต 2', en: 'Student Dormitories 2' }, offMap: true, notes: 'Position from the georeferenced official map (approximate).' },
  { code: 'E24', id: 'e24', coordinates: { lat: 13.852606, lng: 100.580585 }, coordSource: 'official-map', name: { th: 'หอพักนิสิต 3', en: 'Student Dormitories 3' }, offMap: true, notes: 'Position read from the official map; not on a traced road (approximate).' },
  { code: 'E25', id: 'e25', coordinates: { lat: 13.851928, lng: 100.580689 }, coordSource: 'official-map', name: { th: 'หอพักนิสิต 4', en: 'Student Dormitories 4' }, offMap: true, notes: 'Position read from the official map; not on a traced road (approximate).' },
  { code: 'N1', id: 'n1', osmId: 'node/2699351214', coordinates: { lat: 13.852966, lng: 100.567054 }, coordSource: 'osm', name: { th: 'ภาควิชากีฏวิทยา', en: 'Dept. of Entomology' } },
  { code: 'N2', id: 'n2', coordinates: { lat: 13.854846, lng: 100.567381 }, coordSource: 'official-map', name: { th: 'คณะประมง (ฝั่งตะวันตก)', en: 'Faculty of Fisheries (west)' }, notes: 'Position from the georeferenced official map (approximate).' },
  { code: 'N3', id: 'n3', coordinates: { lat: 13.854865, lng: 100.56928 }, coordSource: 'official-map', name: { th: 'คณะประมง (ฝั่งตะวันออก)', en: 'Faculty of Fisheries (east)' }, notes: 'Position from the georeferenced official map (approximate).' },
  { code: 'N9', id: 'n9', osmId: 'node/2699351211', coordinates: { lat: 13.852581, lng: 100.570831 }, coordSource: 'osm', name: { th: 'สถาบันค้นคว้าและพัฒนาผลิตภัณฑ์อาหาร', en: 'Institute of Food Research and Product Development' } },
  { code: 'N11', id: 'n11', osmId: 'node/2699351210', coordinates: { lat: 13.852441, lng: 100.571605 }, coordSource: 'osm', name: { th: 'โรงอาหารกลาง 2', en: 'KU Canteen 2' } },
  { code: 'S1', id: 's1', osmId: 'node/891276461', coordinates: { lat: 13.84299, lng: 100.570777 }, coordSource: 'osm', name: { th: 'ประตูงามวงศ์วาน 1', en: 'Ngamwongwan Gate 1' } },
  { code: 'S2', id: 's2', osmId: 'node/11099052155', coordinates: { lat: 13.844148, lng: 100.568725 }, coordSource: 'osm', name: { th: 'คณะบริหารธุรกิจ 2', en: 'Business Administration 2' } },
  { code: 'S3', id: 's3', osmId: 'node/2699351220', coordinates: { lat: 13.845365, lng: 100.566901 }, coordSource: 'osm', name: { th: 'ร้านสหกรณ์ มก.', en: 'KU Co-op Store' } },
  { code: 'S7', id: 's7', osmId: 'node/891276470', coordinates: { lat: 13.843019, lng: 100.571154 }, coordSource: 'osm', name: { th: 'ศูนย์หนังสือ มก.', en: 'KU Book Center' } },
  { code: 'W1', id: 'w1', osmId: 'node/912958429', coordinates: { lat: 13.851677, lng: 100.565333 }, coordSource: 'osm', name: { th: 'กองยานพาหนะ (ประตูวิภาวดีรังสิต)', en: 'Transportation Center (Vibhavadi Gate)' } },
  { code: 'W2', id: 'w2', osmId: 'node/2699351218', coordinates: { lat: 13.849213, lng: 100.564132 }, coordSource: 'osm', name: { th: 'มูลนิธิโครงการหลวง', en: 'Royal Project Foundation' } },
  { code: 'W3', id: 'w3', osmId: 'node/2713419154', coordinates: { lat: 13.84877, lng: 100.56493 }, coordSource: 'osm', name: { th: 'หอพักนิสิตหญิง 2', en: 'Women\'s Dormitories 2' } },
  { code: 'W4', id: 'w4', osmId: 'node/2699351219', coordinates: { lat: 13.847524, lng: 100.565092 }, coordSource: 'osm', name: { th: 'สนามอินทรีจันทรสถิตย์', en: 'Inseechandrasatitya Stadium' } },
  { code: 'W6', id: 'w6', osmId: 'node/2699351217', coordinates: { lat: 13.848802, lng: 100.565418 }, coordSource: 'osm', name: { th: 'สนามเซปักตะกร้อ', en: 'Sepak Takraw Court' } },
  { code: 'W7', id: 'w7', osmId: 'node/2699351216', coordinates: { lat: 13.850242, lng: 100.565501 }, coordSource: 'osm', name: { th: 'สำนักการกีฬา', en: 'Sports Office' } },
  { code: 'W8', id: 'w8', osmId: 'node/2699351215', coordinates: { lat: 13.85265, lng: 100.565955 }, coordSource: 'osm', name: { th: 'ศูนย์จุลินทรีย์', en: 'Microbiology Centre' } },
  // OSM stops that are not on KU's official stop map; lines unknown.
  { id: 'osm-891273705', osmId: 'node/891273705', coordinates: { lat: 13.852575, lng: 100.571675 }, coordSource: 'osm', name: { th: 'คณะอุตสาหกรรมเกษตร (สิ่งทอ)', en: 'Agro-Industry (Textiles)' }, notes: 'In OpenStreetMap but not on KU\'s official stop map.' },
  { id: 'osm-2699351212', osmId: 'node/2699351212', coordinates: { lat: 13.852594, lng: 100.569502 }, coordSource: 'osm', name: { th: 'อาคารสารนิเทศ 50 ปี', en: 'KU 50th Anniversary Building' }, notes: 'In OpenStreetMap but not on KU\'s official stop map.' },
  { id: 'osm-2699351213', osmId: 'node/2699351213', coordinates: { lat: 13.852755, lng: 100.567725 }, coordSource: 'osm', name: { th: 'คณะสถาปัตยกรรมศาสตร์', en: 'Faculty of Architecture' }, notes: 'In OpenStreetMap but not on KU\'s official stop map.' },
  { id: 'osm-2699351221', osmId: 'node/2699351221', coordinates: { lat: 13.844291, lng: 100.568834 }, coordSource: 'osm', name: { th: 'คณะบริหารธุรกิจ 1', en: 'Business Administration 1' }, notes: 'In OpenStreetMap but not on KU\'s official stop map.' },
  { id: 'osm-2699351222', osmId: 'node/2699351222', coordinates: { lat: 13.843739, lng: 100.569841 }, coordSource: 'osm', name: { th: 'คณะเศรษฐศาสตร์', en: 'Faculty of Economics' }, notes: 'In OpenStreetMap but not on KU\'s official stop map.' },
  { id: 'osm-2713419157', osmId: 'node/2713419157', coordinates: { lat: 13.85046, lng: 100.570117 }, coordSource: 'osm', name: { th: 'คณะศึกษาศาสตร์', en: 'Faculty of Education' }, notes: 'In OpenStreetMap but not on KU\'s official stop map.' },
  { id: 'osm-2713419165', osmId: 'node/2713419165', coordinates: { lat: 13.845962, lng: 100.572636 }, coordSource: 'osm', name: { th: 'ที่ทำการไปรษณีย์', en: 'Post Office' }, notes: 'In OpenStreetMap but not on KU\'s official stop map.' },
]

export const shuttleStops = stops
export const shuttleStopById = new Map(stops.map((s) => [s.id, s]))

/** Lines serving each stop (from the ordered stop lists). */
export const linesByStop: Map<string, ShuttleLine[]> = (() => {
  const m = new Map<string, ShuttleLine[]>()
  for (const l of shuttleLines) for (const id of new Set(l.stops)) m.set(id, [...(m.get(id) ?? []), l])
  return m
})()

export const SHUTTLE_SOURCES = {
  routeMap: 'https://vehicle.ku.ac.th/index.html/wp-content/uploads/2022/06/bus_way.jpeg',
  schedule: 'https://vehicle.ku.ac.th/index.html/wp-content/uploads/2026/08/Busway_010726.png',
  site: 'https://vehicle.ku.ac.th/index.html/',
}
