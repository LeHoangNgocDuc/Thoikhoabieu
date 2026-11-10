# Smart TKB – Trường THCS Nam Nha Trang

**Web v1.8.1 (giao diện Mobile UI), tương thích Vercel API & Google Apps Script v1.8.0.**

- [Thay đổi, sử dụng và kiểm thử Web v1.8.1](./README_V1_8_1.md)
- [Hướng dẫn cấu hình backend và nhập ba file Excel v1.8.0](./README_V1_8_0.md)
- `src/`: giao diện và logic thời khóa biểu / Excel / PPCT / Dạy thêm.
- `api/`: Vercel API và xác thực phiên (giữ nguyên v1.8.0).
- `gas/Code.gs` hoặc `Code.gs`: cùng một bản Apps Script v1.8.0; chỉ dán một bản khi cần triển khai lại backend.
- `public/`: dữ liệu mẫu thời khóa biểu và tệp xác minh phiên bản web.
- `tests/`: bộ kiểm thử Node và dữ liệu test.

Chạy kiểm thử: `npm test`. Build Vercel: `npm run build`.
