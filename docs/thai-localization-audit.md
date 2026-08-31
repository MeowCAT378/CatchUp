# การตรวจภาษาไทยและการทำ Localization ของ CatchUp

วันที่ตรวจ: 27 สิงหาคม 2569  
ขอบเขต: ไฟล์ `apps/web/src/i18n/*.ts` ทั้ง 12 ไฟล์, จุดใช้งานข้อความใน `apps/web/src/app` และ `apps/web/src/components` ทั้ง 39 ไฟล์ TSX รวมถึงเส้นทาง error จาก API ที่แสดงต่อผู้ใช้

สถานะ: นำข้อเสนอที่ยืนยันจากบริบทไปแก้ใน application code แล้ว

## สรุป

- ไม่พบคำสะกดผิดหรือวรรณยุกต์ผิดที่ยืนยันได้ จึงไม่ควรแก้ข้อความที่เป็นธรรมชาติอยู่แล้วเพื่อเพิ่มขนาด diff
- ประเด็นสำคัญคือคำศัพท์ของโดเมนไม่ตรงกับกิจกรรมทั้งสามประเภท, ข้อความบางส่วนเรียงตามโครงสร้างภาษาอังกฤษ และ error บางข้อความเป็นภาษาราชการหรือกำกวม
- พบ error code `NOT_FOUND` ที่ backend ส่งได้จริง แต่ไม่มีคำแปลใน frontend จึงอาจแสดง `errors.NOT_FOUND` ต่อผู้ใช้
- พบข้อความไทย hard-coded นอก i18n เพียง `ไทย` ในตัวสลับภาษา ซึ่งเป็นการตั้งใจใช้ชื่อภาษาในภาษาของตนเอง ไม่ใช่ข้อความตกหล่น

## ข้อเสนอที่ควรแก้

| ระดับ | Current Thai | Recommended Thai | เหตุผลและตำแหน่ง |
|---|---|---|---|
| สูง | `แบบทดสอบของฉัน` | `กิจกรรมของฉัน` | หน้าเดียวกันรวม Quiz, Poll และ Word Cloud จึงไม่ควรเรียกทั้งหมดว่าแบบทดสอบ ([quiz.ts:4](../apps/web/src/i18n/quiz.ts#L4), [teacher-client.tsx:124](../apps/web/src/app/teacher/teacher-client.tsx#L124)) |
| สูง | `เซสชัน`, `ประวัติเซสชัน`, `เซสชันวันนี้`, `เซสชันที่เสร็จสิ้น` | `รอบกิจกรรม`, `ประวัติการจัดกิจกรรม`, `รอบกิจกรรมวันนี้`, `รอบกิจกรรมที่จบแล้ว` | `รอบกิจกรรม` เข้าใจง่ายสำหรับครูและนักเรียนกว่า loanword และควรใช้ชุดเดียวกันใน Admin, History, error และข้อความยืนยัน ([admin.ts:12](../apps/web/src/i18n/admin.ts#L12), [admin.ts:33](../apps/web/src/i18n/admin.ts#L33), [history.ts:4](../apps/web/src/i18n/history.ts#L4), [player.ts:9](../apps/web/src/i18n/player.ts#L9), [teacher.ts:27](../apps/web/src/i18n/teacher.ts#L27)) |
| สูง | `แบบทดสอบจบแล้ว`, `จบแบบทดสอบ` | `กิจกรรมจบแล้ว`, `จบกิจกรรม` | ข้อความเดิมไม่ตรงความหมายเมื่อกิจกรรมเป็น Poll หรือ Word Cloud; ปุ่มยืนยันใช้คำว่า “กิจกรรม” อยู่แล้ว ([player.ts:8](../apps/web/src/i18n/player.ts#L8), [room.ts:11](../apps/web/src/i18n/room.ts#L11), [host-room.tsx:246](../apps/web/src/app/teacher/room/%5Bcode%5D/host-room.tsx#L246)) |
| สูง | สถานะ `เสร็จสิ้น` | `จบแล้ว` | เป็นสถานะสั้นที่อ่านเร็วและตรงกันทั้งห้องสดกับประวัติ ([room.ts:25](../apps/web/src/i18n/room.ts#L25), [history.ts:37](../apps/web/src/i18n/history.ts#L37)) |
| สูง | `เวิร์ดคลาวด์`; ส่วนอื่นใช้ `Word Cloud` | `Word Cloud` ทุกจุด | ชื่อฟีเจอร์ปัจจุบันปะปนสองรูป ควรคง technical name เดียวกัน และใช้ label ตามประเภทเพื่อแสดง `ชื่อ Word Cloud` โดยเว้นวรรคถูกต้อง ([quiz.ts:69](../apps/web/src/i18n/quiz.ts#L69), [quiz.ts:72](../apps/web/src/i18n/quiz.ts#L72), [word-cloud.ts:10](../apps/web/src/i18n/word-cloud.ts#L10)) |
| สูง | `กระดานผู้นำ` | `ตารางคะแนน` | คำเดิมเป็นคำแปลตรงตัวของ Leaderboard; `ตารางคะแนน` เป็นคำที่ผู้ใช้เข้าใจหน้าที่ได้ทันที ([room.ts:15](../apps/web/src/i18n/room.ts#L15), [page.tsx:620](../apps/web/src/app/play/%5Bcode%5D/page.tsx#L620)) |
| สูง | `{{ชื่อกิจกรรม}} ผลลัพธ์` | `ผลลัพธ์: {{ชื่อกิจกรรม}}` | หน้า Results นำชื่อมาต่อหน้าคำแปลตามลำดับภาษาอังกฤษ ทำให้หัวข้อไทยไม่เป็นธรรมชาติ; ควรใช้ interpolation หนึ่งประโยค ([results-client.tsx:184](../apps/web/src/app/teacher/room/%5Bcode%5D/results/results-client.tsx#L184), [results.ts:4](../apps/web/src/i18n/results.ts#L4)) |
| สูง | `5 คำตอบที่ได้รับ · 2 ยังไม่ตอบ · 3 ถูกต้อง · 0 ไม่ถูกต้อง` | `5 คำตอบ · ยังไม่ตอบ: 2 · ตอบถูก: 3 · ตอบผิด: 0` | key เดียวถูกใช้ทั้งหลังตัวเลข, หัวตาราง และค่าของเซลล์ จึงเกิดลำดับคำแบบอังกฤษ ควรจัดวางจำนวนตามบริบท ([results-client.tsx:266](../apps/web/src/app/teacher/room/%5Bcode%5D/results/results-client.tsx#L266), [results.ts:14](../apps/web/src/i18n/results.ts#L14)) |
| สูง | `2 จำนวนการส่ง · 5 โหวต` | `ส่ง 2 ครั้ง · 5 คะแนนโหวต` | การวางจำนวนหน้าคำนามนามธรรมไม่เป็นธรรมชาติ และ “โหวต” ขาดคำขยายในบริบทนี้ ([results-client.tsx:294](../apps/web/src/app/teacher/room/%5Bcode%5D/results/results-client.tsx#L294), [history.ts:40](../apps/web/src/i18n/history.ts#L40)) |
| สูง | `3 เชื่อมต่อแล้ว / 5 ผู้เข้าร่วม` | `เชื่อมต่อแล้ว 3 จาก 5 คน` | การต่อ fragment ในหน้าห้องสดใช้ลำดับคำภาษาอังกฤษ ควรรวมเป็นข้อความไทยหนึ่งชุดพร้อมตัวแปร ([host-room.tsx:162](../apps/web/src/app/teacher/room/%5Bcode%5D/host-room.tsx#L162)) |
| กลาง | `ทำให้ทุกการเรียนรู้มีส่วนร่วม` | `ชวนทุกคนมีส่วนร่วมในทุกช่วงการเรียนรู้` | ประธานของข้อความเดิมคือ “การเรียนรู้” แต่สิ่งที่มีส่วนร่วมคือผู้ใช้ จึงฟังคล้ายคำแปลตรงตัว ([room.ts:18](../apps/web/src/i18n/room.ts#L18)) |
| กลาง | `ห้องถ่ายทอดสด`; `เข้าร่วมในฐานะผู้เล่น` | `ห้องกิจกรรมสด`; `เข้าร่วมกิจกรรม` | ระบบเป็นห้องโต้ตอบ ไม่ใช่การถ่ายทอดสด และข้อความ CTA เดิมยาว/เป็นทางการเกินหน้าที่ ([room.ts:4](../apps/web/src/i18n/room.ts#L4), [room.ts:21](../apps/web/src/i18n/room.ts#L21)) |
| กลาง | `ตัดการเชื่อมต่อ` | `ขาดการเชื่อมต่อ` | จุดใช้งานเป็นสถานะ ไม่ใช่คำสั่งให้ตัดการเชื่อมต่อ ([common.ts:17](../apps/web/src/i18n/common.ts#L17), [page.tsx:335](../apps/web/src/app/play/%5Bcode%5D/page.tsx#L335)) |
| กลาง | `ครูที่ใช้งาน`; `สร้างบัญชีผู้สอน` | `ครูที่เปิดใช้งาน`; `สร้างบัญชีครูผู้สอน` | คำแรกอาจหมายถึงครูที่ “ถูกใช้งาน”; คำหลังควรตรงกับชื่อ role ที่ใช้ทั่ว Admin ([admin.ts:9](../apps/web/src/i18n/admin.ts#L9), [auth.ts:5](../apps/web/src/i18n/auth.ts#L5)) |
| กลาง | `ความคืบหน้า`; `สูงสุด / ต่ำสุด`; `ผลลัพธ์ผู้เข้าร่วม` | `อัตราการตอบ`; `คะแนนสูงสุด/ต่ำสุด`; `ผลลัพธ์รายบุคคล` | card แรกแสดงเปอร์เซ็นต์การตอบ ไม่ใช่ progress ทั่วไป; อีกสองคำยังคลุมเครือหรือขาดความเป็นธรรมชาติ ([results-client.tsx:165](../apps/web/src/app/teacher/room/%5Bcode%5D/results/results-client.tsx#L165), [results.ts:6](../apps/web/src/i18n/results.ts#L6)) |
| กลาง | `เพิ่มคำตอบ`; `ส่งคำตอบแล้ว — รอผู้จัดกิจกรรม` | `ส่งคำตอบ`; `ส่งคำตอบแล้ว` | ปุ่มทำหน้าที่ submit และสถานะหลังส่งควรกระชับโดยไม่สั่งให้รอโดยไม่จำเป็น ([word-cloud.ts:4](../apps/web/src/i18n/word-cloud.ts#L4), [word-cloud.ts:13](../apps/web/src/i18n/word-cloud.ts#L13)) |
| กลาง | `แน่ใจหรือไม่ว่าต้องการลบคำถามนี้?` | `ลบคำถามนี้หรือไม่?` | ชื่อ dialog ควรระบุการกระทำตรง ๆ; warning ด้านล่างอธิบายผลและการย้อนกลับไม่ได้อยู่แล้ว ([teacher.ts:5](../apps/web/src/i18n/teacher.ts#L5), [quiz-editor.tsx:404](../apps/web/src/app/teacher/quiz/%5Bid%5D/quiz-editor.tsx#L404)) |
| กลาง | `วันที่สร้าง / แก้ไข`; `คำถามแบบมีคำตอบถูก` | `วันที่สร้าง/แก้ไข`; `คำถามที่มีคำตอบถูกต้อง` | แก้การเว้นวรรครอบเครื่องหมาย และแก้โครงสร้างคำขยายให้เป็นธรรมชาติ ([admin.ts:29](../apps/web/src/i18n/admin.ts#L29), [quiz.ts:70](../apps/web/src/i18n/quiz.ts#L70)) |

## Error และข้อความช่วยแก้ปัญหา

| Current Thai | Recommended Thai | เหตุผล |
|---|---|---|
| `อีเมลนี้ถูกใช้งานแล้ว` | `อีเมลนี้ลงทะเบียนแล้ว` | ลด passive voice และบอกปัญหาในบริบทสมัครบัญชีโดยตรง ([errors.ts:8](../apps/web/src/i18n/errors.ts#L8)) |
| `ชื่อผู้เข้าร่วมนี้ถูกใช้งานแล้ว` | `ชื่อนี้มีผู้ใช้แล้ว` | สั้นและเป็นธรรมชาติกว่า ([errors.ts:14](../apps/web/src/i18n/errors.ts#L14)) |
| `ไม่พบผู้เข้าร่วมหรือเซสชันหมดอายุ` | `ไม่พบข้อมูลผู้เข้าร่วม หรือการเข้าร่วมหมดอายุแล้ว` | แยกสองสาเหตุให้อ่านชัดและหลีกเลี่ยงศัพท์เทคนิค ([errors.ts:6](../apps/web/src/i18n/errors.ts#L6)) |
| `ไม่สามารถทำรายการในสถานะห้องปัจจุบันได้` | `ทำรายการนี้ไม่ได้ในสถานะปัจจุบันของห้อง` | ลดภาษาราชการและระบุว่าเป็น action ปัจจุบัน ([errors.ts:17](../apps/web/src/i18n/errors.ts#L17)) |
| `กิจกรรมนี้ไม่รองรับการทำรายการนี้` | `กิจกรรมประเภทนี้ทำรายการนี้ไม่ได้` | ลดโครงสร้างแปลตรงตัว ([errors.ts:18](../apps/web/src/i18n/errors.ts#L18)) |
| `คำถามนี้มีคำตอบแล้ว` | `คำถามนี้มีผู้ตอบแล้ว` | คำเดิมอาจหมายถึงมี correct answer; ข้อความใหม่สื่อว่ามี participant response แล้ว ([errors.ts:24](../apps/web/src/i18n/errors.ts#L24)) |
| `Word Cloud ต้องตั้งค่าคำถามก่อนเปิดห้อง` | `ตั้งคำถามสำหรับ Word Cloud ก่อนเปิดห้อง` | ใช้ action-first UX copy ([errors.ts:19](../apps/web/src/i18n/errors.ts#L19)) |
| `คุณส่งคำตอบ Word Cloud แล้ว` | `ส่งคำตอบสำหรับ Word Cloud แล้ว` | ตัดสรรพนามที่ไม่จำเป็นและแก้ความสัมพันธ์ของคำ ([errors.ts:22](../apps/web/src/i18n/errors.ts#L22)) |
| `เกิดข้อผิดพลาดภายในระบบ`; `ดำเนินการไม่สำเร็จ` | `ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง`; `ดำเนินการไม่สำเร็จ กรุณาลองอีกครั้ง` | เพิ่มสิ่งที่ผู้ใช้ทำต่อได้ โดยไม่เปิดเผยรายละเอียดภายใน ([errors.ts:31](../apps/web/src/i18n/errors.ts#L31)) |
| ไม่มี `errors.NOT_FOUND` | เพิ่ม `NOT_FOUND: "ไม่พบข้อมูลที่ต้องการ"` และ English counterpart | Backend สร้าง code นี้เมื่อ `NotFoundException` เกิดขึ้นจริง; Results path มีกรณีดังกล่าว และ frontend แสดง error ผ่าน dynamic key ([api-exception.filter.ts:38](../apps/api/src/common/api-exception.filter.ts#L38), [room-results.service.ts:84](../apps/api/src/modules/rooms/room-results.service.ts#L84), [results-client.tsx:147](../apps/web/src/app/teacher/room/%5Bcode%5D/results/results-client.tsx#L147)) |

## คำศัพท์มาตรฐานที่แนะนำ

| Concept | คำไทยที่ใช้ใน UI |
|---|---|
| Activity | กิจกรรม |
| Session | รอบกิจกรรม |
| Quiz | แบบทดสอบ |
| Poll | แบบสำรวจ |
| Word Cloud | Word Cloud |
| Room | ห้อง |
| Participant / Player | ผู้เข้าร่วม |
| Teacher role | ครูผู้สอน |
| Host ในข้อความ live participant | ผู้สอน |
| Admin | ผู้ดูแลระบบ |
| Question / Answer / Choice | คำถาม / คำตอบ / ตัวเลือก |
| Results / Score | ผลลัพธ์ / คะแนน |
| Leaderboard | ตารางคะแนน |
| History | ประวัติการจัดกิจกรรม |
| Waiting / Active / Revealed / Completed | รอเริ่ม / กำลังดำเนินการ / เฉลยแล้ว / จบแล้ว |
| Export / Analytics | ดาวน์โหลด / การวิเคราะห์ |

## Hard-coded และ untranslated inventory

- Thai นอก i18n: `ไทย` ที่ [language-switcher.tsx:39](../apps/web/src/components/language-switcher.tsx#L39) เป็น label ที่ตั้งใจจับคู่กับ `EN`; ควรคงไว้
- ชื่อผลิตภัณฑ์ `CatchUp` ใน metadata, logo alt และ header aria-label เป็น brand name ที่ตั้งใจคงเดิม ([layout.tsx:14](../apps/web/src/app/layout.tsx#L14), [logo.tsx:7](../apps/web/src/components/logo.tsx#L7), [teacher-header.tsx:19](../apps/web/src/components/teacher-header.tsx#L19))
- `CSV`, `XLSX` และ `Word Cloud` เป็นคำ technical/product ที่กำหนดให้คงภาษาอังกฤษ ไม่ถือเป็น untranslated string
- ไม่พบ visible English sentence ที่ hard-code อยู่ใน TSX; user-facing copy ใช้ `t(...)` เป็นหลัก
- ไม่มี key ไทย/อังกฤษที่ขาดคู่กันใน resource ที่ประกาศ แต่มี backend fallback `NOT_FOUND` ที่ยังไม่ถูกประกาศใน frontend ตามรายการด้านบน

## หลักอ้างอิง

- ใช้ source code และบริบทการแสดงผลจริงเป็นหลัก ไม่ตัดสินจาก English string เพียงอย่างเดียว
- แนวทาง DGA สนับสนุน plain language, ลดภาษาราชการ/ศัพท์เทคนิคที่ไม่จำเป็น และใช้ภาษา เมนู และคำศัพท์ให้สม่ำเสมอ ([DGA Digital Service Standard, หน้า 16 และ 24–26](https://standard.dga.or.th/dga-file/download/MjcuNTg4MmIyMTBkYmI5YWU3ODRlNzY2MDc0ODAzY2UyYzE5YjUxNmRiOGY4MTg4YzEwMDQyZWIwYmU2OTAxNjkyZg/))
- ใช้หลักเว้นวรรคภาษาไทยของราชบัณฑิตยสภาเมื่อตรวจช่องว่างและเครื่องหมาย ([หลักเกณฑ์การเว้นวรรค](https://legacy.orst.go.th/?page_id=629))
- การสลับ `document.documentElement.lang` ตามภาษาที่เลือกใน [language-provider.tsx:14](../apps/web/src/components/language-provider.tsx#L14) ถูกต้องตามแนวทาง language of page ของ WCAG ([WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/language-of-page))

เอกสารนี้บันทึกผลการตรวจก่อนแก้ไข เพื่อนำไปใช้ประกอบการปรับข้อความใน application code
