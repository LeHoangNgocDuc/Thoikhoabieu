# SMART TKB – Trường THCS Nam Nha Trang

**Bộ mã nguồn dự án MVP 1.0, năm học 2026–2027.** Ứng dụng quản lý lịch 7 ngày/tuần, sáng 5 tiết, chiều 5 tiết, tối 2 suất; lịch chính khóa theo phiên bản, lịch dạy thêm và dạy bù theo ngày; PPCT Toán ĐS/HH và Tin; Google Sheets làm nơi lưu trữ.

> Đọc **docs/HUONG_DAN_TRIEN_KHAI.md** để làm từng bước, không cần thành thạo lập trình.

## Cấu trúc dự án

```text
smart-tkb-project/
├── index.html                   Trang vào ứng dụng
├── src/
│   ├── main.js                  Giao diện và thao tác
│   ├── core.js                  Tính lịch, dồn PPCT, phát hiện trùng tiết
│   ├── importExcel.js           Nhận diện Excel K7/K9 và bảng Tin học
│   └── style.css                Giao diện EdTech
├── public/
│   ├── seed.json                Dữ liệu 7 lớp, 18 tiết, 350 PPCT
│   └── favicon.svg
├── api/
│   ├── _auth.js                 Cookie phiên đăng nhập
│   ├── login.js                 Đăng nhập bằng mật khẩu riêng
│   └── tkb.js                   Proxy Vercel → Google Apps Script
├── gas/Code.gs                  Dịch vụ lưu dữ liệu Google Sheets
├── tests/core.test.js          6 phép kiểm thử logic
├── scripts/build_seed.py       Trích xuất lại dữ liệu từ tài liệu nguồn
├── docs/HUONG_DAN_TRIEN_KHAI.md
├── .env.example                Tên biến môi trường, không chứa khóa thật
├── vercel.json                 Cấu hình Vercel
└── package.json
```

## Chạy thử trên Windows

1. Cài Node.js LTS 20+ từ https://nodejs.org.
2. Giải nén bộ mã nguồn ra thư mục `Smart-TKB`.
3. Nhấp đúp `KHOI_DONG_WINDOWS.bat` hoặc mở Terminal trong thư mục và chạy:

```bash
npm install
npm run dev
```

4. Mở địa chỉ được Vite cung cấp, thường là `http://localhost:5173`.
5. Ứng dụng mở **chế độ demo**, lưu thay đổi trên chính trình duyệt đó. Demo **không phải** dữ liệu Google Sheets.

## Lưu Google Sheets

Kiến trúc: **Trình duyệt (Vite) → Vercel Functions → Google Apps Script → Google Sheets**. Không để mật khẩu hoặc khóa Apps Script trong mã JavaScript của trình duyệt.

1. Tạo Google Sheets mới, mở **Tiện ích mở rộng → Apps Script**.
2. Sao chép toàn bộ `gas/Code.gs` vào dự án Apps Script gắn với Sheets.
3. Vào **Cài đặt dự án → Thuộc tính tập lệnh** và thêm `SMART_TKB_API_KEY` với chuỗi bí mật mạnh.
4. **Triển khai → Tùy chọn triển khai mới → Ứng dụng web**; **Thực thi với tư cách: Tôi**; **Ai có quyền truy cập: Bất kỳ ai**; sao chép URL kết thúc bằng `/exec`. URL này được bảo vệ bằng khóa API và chỉ dùng bởi Vercel proxy.
5. Đưa mã nguồn lên GitHub, kết nối repository với Vercel, framework preset **Vite**, build `npm run build`, output `dist`.
6. Trong Vercel **Project → Settings → Environment Variables**, tạo bốn biến:

| Biến | Giá trị |
|---|---|
| `APP_PASSWORD` | Mật khẩu đăng nhập ứng dụng mạnh, dài |
| `SESSION_SECRET` | Chuỗi ngẫu nhiên dài 64 ký tự trở lên |
| `GAS_URL` | URL Apps Script `/exec` |
| `GAS_API_KEY` | Giống giá trị `SMART_TKB_API_KEY` trong Apps Script |

7. Redeploy Vercel; mở web → **Kết nối Google** → nhập `APP_PASSWORD`.
8. Vào **Cấu hình & dữ liệu** → **Khởi tạo dữ liệu mẫu trên Sheet trống**. Thao tác này chỉ hoạt động nếu Google Sheets chưa chứa bất cứ bản ghi nào trong các bảng dự án.
9. Vào **PPCT & tiến độ** xác nhận mốc PPCT hiện đã dạy cho từng lớp – môn – mạch.
10. Vào **Thời khóa biểu** để xem và chỉnh sửa. Sau đó các thay đổi được ghi vào Google Sheets.

**Lưu ý:** Google Apps Script có giới hạn quota và thời gian thực thi; thiết kế này phù hợp với lịch cá nhân/quy mô nhỏ. Chưa cung cấp quản lý nhiều giáo viên đồng thời, SSO, hay bảo vệ chống thử mật khẩu tự động. Cần triển khai tính năng bảo mật bổ sung nếu đưa lên internet công khai ở quy mô trường.

## Dữ liệu nguồn ban đầu

Đã đọc 7 tệp người dùng cung cấp. Dữ liệu khởi tạo gồm:

- **7 lớp**: 7F38 (7/2), 7F39 (7/3), 9F43 (9/1), 9F44 (9/2), 9F46 (9/4), 9F47 (9/5), 9F48 (9/6).
- **18 tiết chính khóa/tuần**: 12 Toán và 6 Tin (không bao gồm dạy thêm).
- **350 tiết PPCT**: Toán 7 ĐS 80 / HH 60, Toán 9 ĐS 82 / HH 58, Tin 7 35, Tin 9 35.
- **TKB lần 4**, từ 09/11/2026, nhập theo đúng nguồn. Hệ thống tự lặp lịch đến khi xuất hiện phiên bản mới, không cắt ở mốc dự kiến 13/12 nếu chưa nhập lịch thay thế.
- **MỘT XUNG ĐỘT GỐC CẦN XÁC NHẬN:** Thứ Năm, 12/11/2026, sáng tiết 3 có Toán 9/1 và Tin 7/3. Hệ thống báo đỏ và không tự đổi cho thầy.
- **Hai tuần không có tuần học PPCT trong tài liệu**: bắt đầu 11/01/2027 và 08/02/2027; code đánh số tuần dựa trên kế hoạch học này. Nếu nhà trường điều chỉnh lịch nghỉ, cần chỉnh trong `src/core.js`.

**Không được coi dữ liệu mẫu là minh chứng đã dạy**: tiến độ khởi tạo được lấy từ dòng PPCT tuần 10 nhưng trạng thái `confirmed=false`. Thầy phải xác nhận trước khi sử dụng tính năng tự đề xuất.

## Chức năng đã có

- Bảng tuần Thứ Hai–Chủ nhật, sáng 1–5, chiều 1–5, tối Suất 1–2 (84 ô).
- Bộ lọc lớp, buổi, môn, loại lịch, mạch Toán.
- Điều chỉnh mỗi ô: đã dạy, nghỉ tiết, dạy thêm, dạy bù và thay bài cho ngày cụ thể.
- Đề xuất nội dung tiết tiếp theo và tự lùi trong cùng mạch khi có nghỉ.
- Đọc file Excel theo **2 kiểu mẫu gốc** từ giáo viên, cho phép xem trước và bỏ tiết trùng.
- Tạo phiên bản mới theo ngày hiệu lực, giữ phiên bản cũ và lịch sử điều chỉnh.
- Google Sheets backend với khóa API không lộ ra trình duyệt.
- Xuất CSV thời khóa biểu, in trình duyệt, sao lưu JSON.

## Giới hạn của MVP 1.0

- Chưa có OCR/AI Gemini xử lý các mẫu TKB hay PPCT hoàn toàn mới (4 PPCT đã được trích xuất sẵn).
- Bộ đọc Excel chỉ nhận đúng các mẫu nguồn K7, K9 có sheet `DỮ LIỆU 150 TIẾT`, và mẫu lưới Tin học; file Excel khác phải lập trình thêm cấu hình ánh xạ.
- Lịch dạy thêm chưa có công cụ sao chép lặp hàng tuần; giáo viên nhập từng ngày. Đây là chủ ý theo yêu cầu: chỉ chính khóa tự sao chép.
- Khi chưa xác nhận tiến độ từng lớp, nội dung được hiển thị là **dự kiến** chứ không phải xác nhận dạy thực tế.
- Chưa hỗ trợ chỉnh sửa danh sách lớp trên giao diện; danh sách 7 lớp có sẵn trong Google Sheets và dữ liệu mẫu.
- Chưa có sơ đồ phân lịch chi tiết cấp trường, báo cáo chuẩn mẫu của nhà trường, xuất Word hay PDF nhiều trang; có in TKB và CSV.
- Chưa kiểm thử tích hợp với Google Sheets/Vercel trong tài khoản người dùng; cần thực hiện theo hướng dẫn và kiểm tra quyền triển khai.

## Kiểm thử

```bash
npm test
```

Các phép thử xác minh số mục PPCT, tuần học, sao chép lịch, xung đột và nghỉ tiết/tiến độ độc lập. Bộ mã nguồn sử dụng `vite` là dependency duy nhất để chạy frontend phát triển/biên dịch. Xử lý XLSX bằng API có sẵn trong Chrome/Edge hiện đại.
