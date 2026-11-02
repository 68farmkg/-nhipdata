# nhip-data

Dữ liệu do GitHub Actions dựng cho NHỊP (repo công khai).

| Workflow | File ra | Lịch |
|---|---|---|
| `history.yml` (fetch-history) | `data/history.json` | 16:30 giờ VN, T2–T6 |
| `macro.yml` (fetch-macro) — MỚI | `data/macro.json`, `data/macro-status.json` | 07:15 và 20:45 giờ VN hằng ngày |
| `announcements.yml` (fetch-announcements) — MỚI | `data/announcements.json`, `data/announcements-status.json` | mỗi 30 phút 08:00–16:30 T2–T6, và 20:30 |

| `indices.yml` (fetch-indices) — MỚI | `data/indices.json`, `data/index-members.json`, `data/indices-status.json` | mỗi 30 phút 09:00–15:30 T2–T6, 15:45 và 17:30 |

Bảng 29 chỉ số: xem mục "BẢNG CHỈ SỐ" trong HUONG-DAN-TU-DAU.md. Chỉ số thiếu thành phần thì dán danh sách vào `data/index-members-manual.json`.

## Cài đặt (làm 1 lần)
1. Chép `scripts/`, `.github/workflows/macro.yml`, `.github/workflows/announcements.yml` vào repo, commit.
2. Tab Actions → chạy tay `fetch-macro` và `fetch-announcements` (Run workflow).
3. Mở `data/macro-status.json` và `data/announcements-status.json`: mỗi chuỗi/nguồn ghi `ok` hoặc lỗi + mã HTTP.
4. Nếu nguồn "trực tiếp" (hsx.vn / hnx.vn / ssc.gov.vn) báo 0 mục thì sửa địa chỉ trong mảng `SOURCES` của `scripts/announcements.mjs` — các địa chỉ trang chủ đó là đoán, CHƯA kiểm. Nguồn "gián tiếp" (Google News theo tên miền) là RSS thật nên dễ sống hơn.
5. Thư mục `github/workflows/` (không có dấu chấm) trong gói cũ là thừa, có thể xóa.

## Chưa có
PMI/ISM (bản quyền, không có nguồn miễn phí ổn định) và số liệu tháng của Việt Nam (GSO: CPI, IIP, xuất nhập khẩu) — chỉ có số năm từ World Bank.
