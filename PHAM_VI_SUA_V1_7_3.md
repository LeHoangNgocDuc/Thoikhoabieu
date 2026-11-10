# Smart TKB 1.7.3 - Ban sua giao dien va thong ke (chua nghiem thu backend)

Da sua: bo loc khoi 6-12, lop A/B/C va tuan/thang tai Danh sach day them; bo chon lop hai cap trong form; ba the thong ke tren danh sach (dem lich dang loc, lich hoan thanh theo co du lieu, lich lap); hien so chenhlech tam tinh voi moc PPCT chua xac nhan; xuong dong ghi chu cot Ke hoach; sticky hai cot dau bang tien do.

CHUA HOAN THANH: atomic replaceSlotLesson va force persistence xuong Google Sheets; cap nhat PPCT sau thay tiet; dong bo trang thai buoi day them va thong ke tong so ca thang dung theo tung lan lap; nghiem thu tren Google Sheets that. Khong nen coi ban nay la sua triet de loi thay tiet.

Cac thao tac chinh khoa van su dung mutateMainSchedule hien tai. De dam bao atomic replace can bo sung giao dich phia GAS co LockService, requestId idempotency, optimistic revision va read-after-write. Khong duoc ghi 2 lenh DELETE + ADD rieng le.

Kiem tra: node --check thanh cong. Bo test co san: 83/85 dat, 2 test cu khong dat; chua chay duoc Vite build do thieu dependency tai moi truong kiem tra.

Cap nhat web: thay file src/main.js va src/style.css hoac toan bo du an, sau do npm install && npm run build, deploy Vercel. Khong can cap nhat GAS cho cac thay doi UI nay.
