# Smart TKB V1.6.4

Incremental upgrade of V1.6.3 for Trường THCS Nam Nha Trang. Files are ready to copy into the same repository.

- Stale-while-revalidate snapshot from previously verified Google Sheets data; read-only if not authenticated.
- No permanent API secrets or sessions in frontend/localStorage.
- Scoped ĐS/HH validation: A/B never request a math stream pattern; C requires one.
- Resolve one colliding timetable slot by **slot ID**, move a single weekly occurrence to an empty cell, retain PPCT and future weeks.
- Reuse existing `mutateExtra` action and payload; separate tutoring validation from official progress.

Run `npm test` after updating. See `HUONG_DAN_NANG_CAP_V1_6_4.md` for mandatory Apps Script-before-Vercel deployment order and test limitations.
