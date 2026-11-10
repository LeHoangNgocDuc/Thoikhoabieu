# Smart TKB 1.7.2 - Chon lop day them va chan lich lap chong

- Man hinh them/sua day them co lua chon cac lop 6A, 6B, 6C den 12A, 12B, 12C. Van co the nhap nhom khac.
- Neu mot mau lap bat dau trong tuong lai cung thu/suat, hien thong bao ve mau da co, khong gui CREATE chong lich.
- Neu thay bao 'Suat nay da co mot lich day them lap', vao **Day them > Danh sach da luu > Doc tu Google Sheets**, tim dung thu/suat va chon **Mo / sua**. Khong bam Luu suat moi lien tuc.
- Neu co mau lap nhung khong hien trong tuan 10, kiem tra ngay bat dau, ngay ket thuc, active va cac ngoai le CANCEL cua ngay 09/11/2026 trong extra_patterns va extra_sessions. Khong xoa du lieu khi chua doi chieu.
- Viec bo sung Tin 7/3 tai Thu Nam 12/11/2026 sang tiet 3 TUAN 10 la thay doi du lieu tren Google Sheets, khong the tu ghi chi bang viec cap nhat code. Sau khi trien khai, chon o do > Them tiet > Tin > 7/3 > chi tuan 10, neu o co Toan 9/1 thi chon dung tiet can sua. Kiem tra ca tuan 11.
- Cap nhat frontend Vercel tu bo ma nguon nay. Backend GAS van giu 1.7.1; neu da trien khai dung 1.7.1 thi khong can thay GAS_URL.
- Kiem thu Node: 83/85 dat; hai bai v163-auth hien ky vong phien ban API 1.7.0, trong khi backend 1.7.1. Chua kiem thu Google Sheets that.
