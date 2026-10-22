# Landmark photos still needed

These landmarks have no open-licensed photo yet, so the detail panel shows a styled placeholder.

To add your own photo:

1. Save it as `public/images/landmarks/<id>.jpg` (landscape, about 1600 px wide, under ~300 KB).
2. In `src/data/landmarks.ts`, add one line to that landmark: `images: [own("Your Name", "CC BY 4.0")],`
3. Delete its row below.

| id | Landmark | Category |
|---|---|---|
| `gate-phahonyothin-1` | ประตูพหลโยธิน 1 / Phahonyothin Gate 1 | landmark |
| `gate-ngamwongwan-1` | ประตูงามวงศ์วาน 1 / Ngamwongwan Gate 1 | landmark |
| `gate-ngamwongwan-3` | ประตูงามวงศ์วาน 3 / Ngamwongwan Gate 3 | landmark |
| `gate-vibhavadi` | ประตูวิภาวดีรังสิต / Vibhavadi Rangsit Gate | landmark |
| `hexagonal-pavilion` | ศาลาหกเหลี่ยม / Hexagonal Pavilion | landmark |
| `chakrabandh-pensiri` | อาคารจักรพันธ์เพ็ญศิริ / Chakrabandhu Pensiri Hall | landmark |
| `hall-of-history` | หอประวัติมหาวิทยาลัยเกษตรศาสตร์ / KU Hall of History | landmark |
| `ag-museum` | สำนักพิพิธภัณฑ์และวัฒนธรรมการเกษตร / Office of Agricultural Museum and Culture | landmark |
| `golden-jubilee` | อาคารสารนิเทศ 50 ปี / KU Golden Jubilee Administration and Information Center | admin |
| `infirmary` | สถานพยาบาล มหาวิทยาลัยเกษตรศาสตร์ / KU Infirmary | admin |
| `vet-hospital` | โรงพยาบาลสัตว์ มหาวิทยาลัยเกษตรศาสตร์ บางเขน / KU Veterinary Teaching Hospital, Bangkhen | admin |
| `ku-home` | เคยู โฮม / KU Home | admin |
| `dormitories` | หอพักนิสิต / Student Dormitories | admin |
| `library` | สำนักหอสมุด / KU Library | library |
| `lecture-hall-1` | ศูนย์เรียนรวม 1 / Lecture Hall 1 | library |
| `lecture-halls-2-4` | ศูนย์เรียนรวม 2–4 / Lecture Halls 2–4 | library |
| `fac-agriculture` | คณะเกษตร / Faculty of Agriculture | faculty |
| `fac-engineering` | คณะวิศวกรรมศาสตร์ / Faculty of Engineering | faculty |
| `fac-economics` | คณะเศรษฐศาสตร์ / Faculty of Economics | faculty |
| `fac-social-sciences` | คณะสังคมศาสตร์ / Faculty of Social Sciences | faculty |
| `fac-humanities` | คณะมนุษยศาสตร์ / Faculty of Humanities | faculty |
| `fac-education` | คณะศึกษาศาสตร์ / Faculty of Education | faculty |
| `fac-fisheries` | คณะประมง / Faculty of Fisheries | faculty |
| `fac-forestry` | คณะวนศาสตร์ / Faculty of Forestry | faculty |
| `fac-architecture` | คณะสถาปัตยกรรมศาสตร์ / Faculty of Architecture | faculty |
| `fac-agro-industry` | คณะอุตสาหกรรมเกษตร / Faculty of Agro-Industry | faculty |
| `fac-vet` | คณะสัตวแพทยศาสตร์ / Faculty of Veterinary Medicine | faculty |
| `canteen-1` | โรงอาหารกลาง 1 / KU Canteen 1 | food |
| `canteen-2` | โรงอาหารกลาง 2 / KU Canteen 2 | food |
| `ku-avenue` | KU Avenue / KU Avenue | food |
| `swimming-pool` | สระว่ายน้ำจุฬาภรณ์วลัยลักษณ์ / Chulabhorn Walailak Swimming Pool | sport |

Also waiting for coordinates (see the end of `src/data/landmarks.ts`): `phra-phirun`, `memorial-tower-60`.
