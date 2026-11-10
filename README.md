# Smart TKB – Trường THCS Nam Nha Trang

**Bản v1.8.0** — [Xem hướng dẫn triển khai và nghiệm thu](./README_V1_8_0.md)

- `src/`: giao diện và logic thời khóa biểu / Excel / PPCT / Dạy thêm.
- `api/`: Vercel API và xác thực session.
- `gas/Code.gs` hoặc `Code.gs`: mã Apps Script cùng nội dung, **chỉ sử dụng một bản** để dán vào dự án GAS.
- `public/`: lịch mẫu 18 tiết đã hiệu chỉnh, tệp release.
- `tests/`: bộ kiểm thử Node và fixtures Excel đã trích xuất.

Lệnh cục bộ: `npm test` và `npm run build` (không yêu cầu tải gói bổ sung cho hai lệnh này).
