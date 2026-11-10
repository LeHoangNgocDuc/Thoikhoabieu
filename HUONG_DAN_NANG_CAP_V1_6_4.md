# SMART TKB V1.6.4 - HUONG DAN NANG CAP AN TOAN

**Giao vien:** Le Hoang Ngoc Duc (Lê Hoàng Ngọc Đức)  
**Don vi:** Truong THCS Nam Nha Trang (Trường THCS Nam Nha Trang)  
**Du an:** Smart TKB 2026-2027  
**Nguon nang cap:** V1.6.3, khong tao du an moi.

## A. NOI DUNG DA SUA

1. **Xem TKB tu bo nho dem ngay khi mo trang:** Sau *mot lan doc Google Sheets thanh cong* tren thiet bi, app luu snapshot chi gom classes, versions, slots, ppct, baselines, changes, ppct_overrides, extra_patterns, extra_sessions. Lan mo tiep theo ve TKB tu snapshot truoc khi cho API. Nhan nho 'Ban luu dang duoc dong bo' phan biet voi du lieu truc tuyen. API tra du lieu moi thi cap nhat snapshot va giao dien. Khong cache token, mat khau, cookie hay audit log.
2. **Xac thuc an toan:** Khong gan token co dinh vao JavaScript, khong luu SESSION_SECRET/APP_PASSWORD/GAS_API_KEY trong localStorage. API van yeu cau cookie HttpOnly, Secure, SameSite=Lax. Neu het phien, app van cho xem ban luu (read-only), nhung bat dang nhap lai de sua/luu. Dang xuat se xoa snapshot tren thiet bi. Co nut xoa snapshot rieng trong Cai dat.
3. **Sua pham vi A/B/C:** Scope A va B khong can chuoi DS/HH; chi scope C moi xac thuc chuoi DS/HH. Truong quy tac an khi chon A/B.
4. **Xu ly mot tiet trung lich:** Bam canh bao trung -> chon Doi tiet nay dung voi lop/mon -> chon ngay, buoi, tiet dich. Tinh nang MOVE ghi 1 thay doi theo ma tiet nguon, khong sua mau TKB va khong tu danh dau PPCT da day. Chi ap dung mot lan trong tuan. MOVE can cap nhat Apps Script de mo rong bang changes them 4 cot cuoi.
5. **Day them:** Giu nguyen action `mutateExtra`, payload JSON hien co va validate rieng. Khong gui mạch DS/HH hay quy tac PPCT vao luong day them. Khi offline/cache chi xem, khong bao luu thanh cong gia.

## B. LUU Y VE 'AUTO SESSION' VA CACHE

Yeu cau token vinh vien trong code/localStorage KHONG duoc ap dung vi co the lam ro quyen doc/ghi Google Sheets neu ma nguon public hay dien thoai bi mat. V1.6.4 su dung stale-while-revalidate + cookie secure. Snapshot khong bao dam '0 giay' tuy doi: can thoi gian tai HTML/JS va ve UI; lan dau tren thiet bi khong co cache van phai dang nhap va tai du lieu that.

Bo nho dem localStorage la du lieu co the doc boi nguoi co quyen truy cap trinh duyet tren thiet bi. Khuyen nghi chi dung tren may ca nhan, xoa cache khi dung may dung chung.

## C. TRIỂN KHAI - LAM DUNG THU TU

**1. Sao luu:** Google Sheets > Tệp > Tạo bản sao. Sao luu repository GitHub (tai ZIP). Tuyet doi khong nhan nut Khoi tao du lieu tren web da co du lieu.

**2. Apps Script:** Vao Google Sheets dang su dung > Tien ich mo rong > Apps Script. Thay file Code.gs bang `gas/Code.gs` V1.6.4. Luu, chon Trien khai > Quan ly cac ban trien khai > Sua (but chi) > Phien ban moi > Trien khai. GIU NGUYEN Deployment ID va URL `/exec` neu cap nhat ban trien khai cu. Code tu noi them 4 cot `sourceSlotId`, `moveDate`, `moveShift`, `movePeriod` vao cuoi `changes`; khong xoa noi dung truoc do. Kiem tra script property `SMART_TKB_API_KEY` con nguyen.

**3. GitHub:** Copy de nguon cac file sau, commit len nhanh Production `main`:

- `src/cache.js` (MOI)
- `src/core.js`
- `src/main.js`
- `src/style.css`
- `api/_auth.js` (nang so phien ban)
- `gas/Code.gs` (ban luu dong bo trong repository)
- `package.json`

Cac file `api/login.js`, `api/tkb.js`, `vercel.json`, `public/seed.json` giu nguyen. KHONG them mat khau, token hay API key vao GitHub.

**4. Vercel:** Kiem tra Settings > Environment Variables, 4 bien `APP_PASSWORD`, `SESSION_SECRET`, `GAS_URL`, `GAS_API_KEY` van ton tai. Khong thay gia tri. Neu cap nhat cung Deployment Apps Script thi khong can thay GAS_URL. Sau commit, vao Vercel > Deployments > kiem tra Production la Ready. Neu can, Redeploy ban moi, KHONG chon deployment cu.

**5. Kiem tra tren thiet bi:** Mo `https://thoikhoabieu-sage.vercel.app`, dang nhap lan dau, kiem tra TKB tu Google Sheets. Tai lai trang: TKB tu cache xuat hien truoc khi badge dong bo ket thuc. Chon menu Dạy thêm > sua 1 nhom > bam Luu; sau khi kiem tra server xac nhan, chuyen tuan va doc lai Sheets. Bam canh bao Thu 5 tiet 3 de chon dung tiet; nhap diem dich TRONG, kiem tra popup; chi thuc su luu khi da xac nhan tiet can doi.

## D. KIEM THU

- 66/66 bai Node.js unit/business test dat, gom 61 test tu V1.6.3 + 5 test moi.
- Browser mock: Chromium 390x844 va 1440x900 da render du 18 tiet tu ban cache sau khi mo phong API loi; khong co loi JavaScript va khong tran ngang trang.
- Kiem thu MOVE tren GAS VM: luu ban ghi MOVE, giu nguyen 18 slots goc, chan MOVE vao o co tiet.
- **CHUA KIEM CHUNG:** End-to-end Apps Script va Vercel Production that; Chrome/Samsung Internet tren dien thoai that; `npm run build` (qua trinh cai Vite trong moi truong test khong hoan thanh). Can kiem chung truoc khi su dung chinh thuc.

## E. KHẮC PHỤC SỰ CỐ

- **TKB hien 'ban luu':** Kiem tra ket noi mang, dang nhap neu cookie het han, bam Thu lai. Ban luu chi doc; khong phai du lieu moi nhat.
- **Dạy thêm không lưu:** Vao Cau hinh > Kiem tra may chu, kiem tra action mutateExtra va tren GAS da deploy phien ban moi. Khong nhap lai neu chua xac minh requestId.
- **Dời tiết báo không hỗ trợ:** Apps Script dang chay ma cu (chua ho tro action MOVE). Cap nhat `gas/Code.gs`, deploy phien ban moi.
- **Bấm A/B nhưng báo nhập ĐS/HH:** Kiem tra Vercel da deploy frontend V1.6.4. Trong V1.6.4 chi co C bat buoc chuoi quy tac.
- **App tren dien thoai van hien ma cu:** Tai lai trang, su dung ten mien Production, kiem tra version Frontend/API trong Cau hinh. Khong xoa Google Sheets.

## F. KHÔI PHỤC

Neu phat sinh loi: rollback GitHub/Vercel ve ban V1.6.3, Apps Script deploy lai version cu (quan ly deployment -> sua -> chon version), khong khoi tao/ xoa Sheets. Bon cot moi cua `changes` co the giu lai, khong can xoa. Kiem tra thong nhat version frontend/backend truoc khi tiep tuc.
