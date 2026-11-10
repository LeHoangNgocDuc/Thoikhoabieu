# SMART TKB 1.7.0 — CHỈNH SỬA, XÓA, SAO CHÉP/DÁN TIẾT CHÍNH KHÓA

**Trường THCS Nam Nha Trang — Giáo viên Lê Hoàng Ngọc Đức**  
**Ngày cập nhật: 10/11/2026**

> Bản này phát triển trực tiếp từ bộ mã nguồn Smart TKB 1.6.5. Dữ liệu trong Google Sheets **không cần chuyển bảng, không cần khởi tạo lại**. Cần cập nhật **CẢ GitHub/Vercel VÀ Apps Script**. Chưa ghi trực tiếp vào Google Sheets của người dùng, nên thao tác triển khai Production phải được thực hiện trong tài khoản đang quản lý.

## 1. Các lỗi đã khắc phục

1. Trước đây, bấm lưu khi chưa đổi vị trí/lớp/môn/mạch báo `Chưa thay đổi thông tin tiết`. Bản này cung cấp nút **Xóa tiết** riêng cho trường hợp muốn loại bỏ một trong hai tiết trùng; nút **Sửa/chuyển** chỉ dùng khi thực sự thay đổi dữ liệu.
2. Bấm vào ô có **hai tiết chính khóa** sẽ hiện hai thẻ độc lập. Mỗi thẻ có **Sửa / chuyển**, **Xóa**, **Sao chép**. Chọn một thẻ sẽ **không tự động xóa hoặc chỉnh** thẻ còn lại.
3. Chọn **Sao chép** rồi chạm ô trống để **Dán tiết đã sao chép**. Tiết gốc không bị mất.
4. **Phạm vi áp dụng cho mỗi thao tác**:
   - **Chỉ tuần đang xem:** thay đổi được ghi vào `changes` như ngoại lệ có ngày cụ thể; các tuần khác giữ nguyên.
   - **Từ tuần này đến khi có TKB mới (mặc định):** tạo phiên bản mới trên `versions`/`slots`, lặp từ tuần hiện tại đến khi có phiên bản TKB khác có hiệu lực. Các tuần trước ngày áp dụng giữ nguyên.
5. Lưu có kiểm tra đầu vào và **đọc lại Google Sheets**. Thao tác ghi lại cùng một `requestId` được nhận diện để tránh nhân đôi khi trình duyệt gửi lại.
6. Nếu Apps Script vẫn là bản 1.6.5, giao diện giải thích phải cập nhật Apps Script **1.7.0** trước khi sửa/xóa/dán; không báo lưu thành công giả.
7. Sửa quy tắc chọn phiên bản khi bản TKB nhập từ trường và bản chỉnh thủ công **cùng ngày hiệu lực**; phiên bản được tạo sau sẽ ưu tiên.

## 2. Sao lưu trước khi triển khai

- Vào Google Sheets đang kết nối → **Tệp → Tạo bản sao**.
- Sao lưu repository GitHub, lưu lại commit gần nhất để có thể phục hồi.
- Tuyệt đối **không dùng Khởi tạo dữ liệu** trên bảng đã có dữ liệu.
- Không xóa / đổi tên các tab: `classes`, `versions`, `slots`, `changes`, `ppct`, `baselines`, `ppct_overrides`, `extra_patterns`, `extra_sessions`, `audit_log`.

## 3. Cập nhật Google Apps Script (bắt buộc)

1. Mở đúng Google Sheets đang sử dụng → **Tiện ích mở rộng → Apps Script**.
2. Mở file `Code.gs`, **thay toàn bộ nội dung** bằng file `gas/Code.gs` **của bộ 1.7.0**.
3. **Lưu**.
4. Chọn **Triển khai → Quản lý tùy chọn triển khai**.
5. Nhấn biểu tượng **bút chì** của **Web app deployment đang sử dụng**.
6. Ở mục **Phiên bản**, chọn **Phiên bản mới**, nhập mô tả `Smart TKB 1.7.0`, rồi nhấn **Triển khai**.
7. Mở lại URL `/exec` cũ, kiểm tra JSON có `"apiVersion":"1.7.0"`.

**Nếu sửa deployment Web app hiện tại qua bút chì, URL `/exec` và biến `GAS_URL` trên Vercel không thay đổi.** Chỉ khi tạo một deployment khác và sử dụng URL mới, cần cập nhật `GAS_URL` và redeploy Vercel. Không tự thay `GAS_API_KEY` hoặc `SMART_TKB_API_KEY` khi chúng đang khớp.

**Chú ý:** Bấm **Lưu** trong trình soạn thảo Apps Script chưa đủ. Phải chọn **Phiên bản mới** và triển khai lên Web app đang dùng.

## 4. Cập nhật GitHub / Vercel

Tải bộ mã nguồn 1.7.0 trong file ZIP, giải nén. Với repository hiện có, thay các file đúng **đường dẫn tương ứng**:

```
index.html
src/main.js
src/core.js
src/style.css
gas/Code.gs
api/tkb.js
api/_auth.js
package.json
public/release.json
```

- Được giữ nguyên `public/seed.json`, `src/cache.js`, `src/importExcel.js`, `vercel.json` và các biến môi trường cũ.
- Không đưa cả thư mục bọc ZIP vào bên trong repository hiện tại; phải thay thế đúng đường dẫn.
- **Commit changes** lên nhánh Production (thường là `main`).
- Trong Vercel → **Deployments**, kiểm tra bản Production mới nhất có trạng thái **Ready**.
- Không cần tạo một dự án Vercel mới hoặc đổi tên miền hiện tại.

## 5. Kiểm tra ba phiên bản

- `https://thoikhoabieu-sage.vercel.app/release.json` → `frontend: 1.7.0`.
- `https://thoikhoabieu-sage.vercel.app/api/tkb?action=version` → `apiVersion: 1.7.0`.
- URL Apps Script `/exec` của giáo viên → `apiVersion: 1.7.0`.
- Trong ứng dụng → **Cấu hình & dữ liệu → Xác minh phiên bản Web / API / GAS** → tất cả phải là **1.7.0**.

Nếu vẫn là bản cũ: xem đúng deployment `Production`, mở lại app bằng Ctrl+F5, xác nhận đã triển khai **Apps Script phiên bản mới**; không khởi tạo lại Google Sheets.

## 6. Cách thao tác với tiết trùng (ví dụ tuần 10)

1. Chọn **Tuần 10, 09/11–15/11/2026** → tab **Chính khóa**.
2. Nhấn ô **Thứ Năm — Sáng — Tiết 3**, nơi đang có **Toán 9/1** và **Tin 7/3**, hoặc mở dòng cảnh báo trùng tiết.
3. Chọn **đúng thẻ lớp cần xử lý**, KHÔNG nhấn nhầm thẻ khác:
   - **Sửa / chuyển**: đổi lớp, môn, mạch, thứ, buổi hoặc tiết, rồi chọn phạm vi lưu. Nếu giữ nguyên tất cả trường và bấm Lưu, ứng dụng giải thích cần thay đổi trường hoặc dùng nút Xóa.
   - **Xóa tiết**: chọn **Chỉ tuần này** hoặc **Đến khi có TKB mới**. Khi xóa Tin 7/3, Toán 9/1 vẫn còn ở ô đó.
   - **Sao chép**: chạm một ô trống, nhấn **Dán tiết đã sao chép**, chọn phạm vi rồi lưu. Tiết nguồn giữ nguyên.
4. Chấp nhận hộp thoại xác nhận sau khi đọc đúng **lớp / buổi / tiết / phạm vi**.
5. Tải lại trang, kiểm tra tuần vừa sửa và tuần kế tiếp. Với sửa dài hạn, các tuần sau giữ nguyên tới ngày TKB trường mới có hiệu lực.

**Thêm tiết chính khóa mới:** chạm ô trống → **Chính khóa / Dạy bù** → **Thêm tiết chính khóa**; chọn phạm vi **Một tuần** hoặc **Đến khi có TKB mới**.

## 7. Vị trí lưu và an toàn dữ liệu

| Tác vụ | Nơi ghi dữ liệu | Những gì không bị thay đổi |
|---|---|---|
| Sửa, xóa, thêm, dán **một tuần** | `changes` | TKB mẫu tại `slots`; lịch tuần khác |
| Sửa, xóa, thêm, dán **đến TKB mới** | `versions` + `slots` (thêm phiên bản) | Phiên bản TKB trước; PPCT đã xác nhận |
| Theo dõi thao tác | `audit_log` | Lịch chính khóa và dạy thêm độc lập |

- Backend dùng `LockService` khi ghi. Mỗi lần ghi xác minh lại dữ liệu đã lưu.
- Không thay bảng `ppct` hoặc dữ liệu dạy thêm.
- Không cho sửa/xóa tiết đã được đánh dấu hoàn thành trong tuần được chọn.
- Không cho dán đè vào ô đã có tiết chính khóa; trước hết hãy xử lý tiết trùng hoặc chọn ô trống.
- Khi có TKB mới của trường, tạo phiên bản từ **ngày hiệu lực** của nó. Bản đó thay thế bản chỉnh thủ công từ ngày hiệu lực; các tuần cũ vẫn giữ lịch sử.

## 8. Kiểm thử trong bộ nguồn

- `npm test` → **82/82 kiểm thử JavaScript thành công**.
- `python scripts/test_v170_ui.py` → đã kiểm thử giả lập quy trình sửa một tuần, xóa lâu dài, sao chép/dán trên desktop **1440 px** và điện thoại **390 px**; không tràn ngang.
- Kiểm thử trong bộ nguồn sử dụng mô phỏng Google Sheets; **chưa thể xác minh thao tác ghi Production thực tế khi chưa có quyền triển khai Apps Script và truy cập Google Sheets của giáo viên**.
- Môi trường đóng gói này chưa cài được `vite` (cài đặt npm cần kết nối registry), nên không khẳng định đã chạy `npm run build`. Cấu hình Vercel/Vite vẫn giữ nguyên bản nguồn gốc; máy có Node.js/Internet chỉ cần `npm install && npm run build` để xác minh thêm.

## 9. Trả lời nhanh những lỗi hay gặp

**Lỗi `Chưa thay đổi thông tin tiết`:** Đây là thông báo đúng nếu bấm lưu mà không sửa bất kỳ trường nào. Muốn bỏ tiết thì dùng **Xóa tiết**; muốn giữ nguyên và sao chép thì dùng **Sao chép → Dán**.

**Lỗi `UNSUPPORTED_ACTION: mutateMainSchedule`:** Apps Script Web app cũ; thay `gas/Code.gs` V1.7.0 rồi triển khai **Phiên bản mới** bằng bút chì.

**Lỗi `Phiên bản TKB đã thay đổi`:** một phiên ghi khác đã xảy ra; bấm đồng bộ/refresh rồi thao tác lại. Không gửi liên tiếp khi chưa kiểm tra.

**Đã ghi nhưng web không thấy:** kiểm tra kết nối Google Sheets, đồng bộ lại, và xác minh ba phiên bản. Giữ bản sao Sheet trước khi sửa thủ công.
