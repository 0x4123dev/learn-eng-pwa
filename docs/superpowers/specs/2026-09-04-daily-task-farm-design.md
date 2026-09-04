# Nông trại theo ngày nhiệm vụ — thiết kế

Ngày: 2026-09-04. Trạng thái: chờ người dùng duyệt. Cài đặt trên `master`.

## 1. Mục tiêu và tiêu chí

Bé học để kiếm xu, dùng xu xây nông trại, rồi thu hoạch. Nông trại là phần thưởng nhìn thấy được của việc học, không phải một trò chơi để chơi.

Tiêu chí bắt buộc, mọi quyết định bên dưới phải thỏa:

1. **Thứ duy nhất làm nông trại thay đổi là hoàn thành hết Daily Task của ngày.** Không có gì lớn theo đồng hồ.
2. **Không khuyến khích mở app để thăm vườn.** Ngoài lúc vừa xong nhiệm vụ, vườn không có gì mới.
3. **Mọi màn của nông trại đều chỉ về việc hoàn thành nhiệm vụ hôm nay.**
4. **Chỉ mở cho tài khoản có cờ `allow_bot`**, để thử với vài bé trước.
5. Luật đủ ngắn để một bé lớp 4 hiểu trong ba câu.

## 2. Hiện trạng liên quan

- **Khu đất lâu đài** (`js/night-raid.js`, `js/night-raid-rules.js`): lưới 12×12 trong màn Cướp Đêm, nằm ở tab Arena, hiện với `appState.allowBot`. Có ba ruộng (lúa, cà chua, ao cá) cho 100 xu mỗi 24 giờ. Giữ nguyên, không đụng.
- **Daily Task** (`js/daily-task-catalog.js`, `js/daily-task.js`, `functions/api/_daily-task.js`, `db/018`, `db/019`): admin giao nhiệm vụ theo catalog, mỗi nhiệm vụ là N phiên đạt 100% trong ngày GMT+7. Tiến độ đếm từ bảng `activities` khi đọc. Xong hết mọi nhiệm vụ thì server chèn một dòng vào `daily_task_rewards(user_id, task_date)` và trả 200 xu qua `coin_grants`, đúng một lần mỗi ngày. Dòng này là khóa.
- **Tiền**: ví là `appState.coins` trong localStorage. Server chỉ trả xu bằng dòng IOU trong `coin_grants` với `note` duy nhất; máy bé nhận khi đồng bộ tài khoản qua `POST /api/coins` (`js/auth.js`). Mua sắm trừ ví ở máy bé.
- Worktree hiện tại tách nhánh trước khi Daily Task lên master, nên cài đặt phải tách nhánh mới từ `master`.

## 3. Luật chơi

### 3.1 Ba câu cho bé

1. Hoàn thành hết nhiệm vụ hôm nay là nông trại lớn thêm **một ngày**. Mọi cây lớn một nấc.
2. Cây chín thì **hái ra xu**. Cây chín đứng chờ, không thối.
3. Xu để **mua đất, mua hạt, xây thứ con thích**.

### 3.2 Ngày nông trại

- Một ngày nông trại = một dòng trong `daily_task_rewards` của bé. Số ngày hiện tại `dayCount` = `COUNT(*)` của bảng đó theo `user_id`.
- Một ngày lịch chỉ có tối đa một ngày nông trại. Không thể cày.
- Không làm xong nhiệm vụ thì vườn đứng im. Không có phạt, không lùi nấc.
- Bé chưa được giao nhiệm vụ nào thì `allDone` luôn sai, vườn không lớn. Màn hình nói rõ "Hôm nay chưa có nhiệm vụ".

### 3.3 Cây

| id | Tên | Ngày để chín | Hạt (xu) | Hái được (xu) | Lãi mỗi ngày mỗi ô |
|---|---|---|---|---|---|
| `lettuce` | Rau cải | 1 | 3 | 8 | 5 |
| `tomato` | Cà chua | 2 | 5 | 18 | 6,5 |
| `carrot` | Cà rốt | 3 | 8 | 30 | 7,3 |
| `rice` | Lúa | 4 | 10 | 45 | 8,75 |
| `rose` | Hoa hồng | 6 | 15 | 80 | 10,8 |
| `pumpkin` | Bí ngô | 8 | 20 | 120 | 12,5 |

- Mỗi cây chiếm 1 ô. Không cần mở khóa, chỉ chặn bằng giá.
- Cây lưu `day` = `dayCount` lúc trồng. Chín khi `dayCount − day ≥ days`. Trồng trước khi thưởng ngày về thì hôm đó tính là ngày đầu. Rau cải trồng buổi sáng, làm xong nhiệm vụ là hái được ngay hôm đó.
- Trên cây ghi "còn N ngày nhiệm vụ" với `N = days − (dayCount − day)`. Không ghi giờ.
- Bốn giai đoạn hình theo tiến độ `p = (dayCount − day) / days`: mầm khi chưa qua ngày nào, non khi đã qua ít nhất một ngày và `p < 0,5`, xanh khi `0,5 ≤ p < 1`, chín khi `p ≥ 1`. Cây ngắn ngày bỏ qua giai đoạn không rơi vào; rau cải đi thẳng từ mầm sang chín.
- Hái xóa cây khỏi ô. Hoa hồng hái và bán như mọi cây.

### 3.4 Đất

- Lưới **8×8 ô**, bốn khoảnh 4×4 mở theo thứ tự cố định:
  - Khoảnh 1: x 0–3, y 0–3. Có sẵn.
  - Khoảnh 2: x 4–7, y 0–3.
  - Khoảnh 3: x 0–3, y 4–7.
  - Khoảnh 4: x 4–7, y 4–7.
- Mỗi khoảnh sau **10.000 xu**, chỉ mua được khoảnh kế tiếp. `land` là số khoảnh đã mở, 1 đến 4.
- Ô thuộc khoảnh có số thứ tự lớn hơn `land` là đất hoang: vẽ bụi cây và đá, có biển giá. Không trồng, không xây lên đó.

### 3.5 Công trình

Thuần trưng bày, không sản xuất. Là phần "xây trang trại" mà việc học mua được.

| id | Tên | Giá (xu) | Cỡ |
|---|---|---|---|
| `fence` | Hàng rào | 300 | 1×1 |
| `fruit-tree` | Cây ăn quả | 800 | 1×1 |
| `well` | Giếng | 1.000 | 1×1 |
| `chicken-coop` | Chuồng gà | 3.000 | 2×2 |
| `barn` | Nhà kho | 5.000 | 2×2 |
| `windmill` | Cối xay gió | 8.000 | 2×2 |
| `cow-shed` | Chuồng bò | 12.000 | 2×2 |
| `farmhouse` | Nhà nông dân | 20.000 | 2×2 |

- Công trình 2×2 phải nằm trọn trong đất đã mở và bốn ô đều trống. Được phép nằm vắt qua hai khoảnh đã mở.
- **Dỡ** công trình hoàn 50% giá, làm tròn xuống. Không dỡ được cây, không hoàn hạt.
- **Giá trị nông trại** = tổng giá công trình đang đứng. Hiện trên bảng tên vườn.

### 3.6 Nhịp tiền ước tính

Mỗi ngày làm xong nhiệm vụ: 200 xu thưởng, xu của các phiên học, và xu hái vườn. 16 ô toàn bí ngô cho khoảng 200 xu một ngày. Khoảnh 2 mua được sau khoảng 3 đến 4 tuần làm xong đều. Đủ 64 ô thì vườn cho khoảng 800 xu một ngày, sau đó xu chảy vào công trình, skin lâu đài và phụ kiện chó. Các con số là chỗ tinh chỉnh; luật thì cố định.

## 4. Kiến trúc

### 4.1 File

| File | Vai trò |
|---|---|
| `js/farm-rules.js` (mới) | Luật thuần, UMD như `night-raid-rules.js`, dùng chung máy bé và server. `CROPS`, `BUILDINGS`, `GRID = 8`, `QUADRANTS`, `LAND_PRICE = 10000`, `normalize(state)`, `ownedAt(state, x, y)`, `ripeCells(state, dayCount)`, `apply(state, action, dayCount)` trả `{ state, error?, granted?, refund? }`, `farmValue(state)`, `stage(plot, dayCount)`. |
| `js/farm.js` (mới) | Màn hình nông trại, `view = 'farm'` trong màn Cướp Đêm, cùng shell với `renderBuilder`. Đăng ký trong `lazy-data.js` `SCREEN_FILES` và `sw.js`; không vào `index.html`. |
| `functions/api/farm/index.js` (mới) | `GET`: trạng thái vườn, `dayCount`, tiến độ hôm nay từ `progress()` của `_daily-task.js`, `serverNow`. Tạo dòng `farms` rỗng nếu chưa có. |
| `functions/api/farm/act.js` (mới) | `POST` một hành động, kiểm `nightRaidEnabled`. |
| `db/027-farms.sql` (mới) | Bảng `farms`. |
| `js/night-raid.js` | Thêm nút NÔNG TRẠI vào `nr-home-fabs` khi `appState.allowBot`. |
| `js/daily-task.js` | Khi `justRewarded` và `appState.allowBot`: gọi `GET /api/farm`, hiện dòng "Nông trại +1 ngày · N cây chín" và nút "Đi hái" nếu `N > 0`. |
| `js/lazy-data.js`, `sw.js` | Thêm `farm.js`, `farm-rules.js` và tranh. |
| `css/styles.css` | Kiểu cho bàn cờ, đất hoang, thanh nhiệm vụ. Dùng lại lớp `nr-build-shop`, `nr-build-tray`, `nr-collect-all`. |

Không thêm mục vào `daily-task-catalog.js`: hái vườn không phải việc học, không thể giao làm nhiệm vụ.

### 4.2 Dữ liệu

```sql
-- db/027-farms.sql
CREATE TABLE IF NOT EXISTS farms (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id),
  farm_json  TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
```

`farm_json`:

```json
{
  "v": 1,
  "land": 1,
  "plots": [
    { "x": 0, "y": 0, "type": "crop",  "id": "tomato", "day": 12 },
    { "x": 2, "y": 2, "type": "build", "id": "well" }
  ]
}
```

- `normalize` bỏ ô sai tọa độ, sai id, trùng chỗ, nằm ngoài đất đã mở; kẹp `land` vào 1..4; `day` là số nguyên không âm.
- Máy bé giữ bản sao `appState.farm` và `appState.farmDayCount` để vẽ khi mất mạng. Server là nguồn sự thật.

### 4.3 Hành động `POST /api/farm/act`

Thân yêu cầu: `{ action, x?, y?, id?, harvestId? }`.

| action | Điều kiện | Kết quả |
|---|---|---|
| `plant` | ô thuộc đất đã mở, trống, `id` là cây | thêm cây với `day = dayCount` |
| `build` | mọi ô trong cỡ thuộc đất đã mở và trống, `id` là công trình | thêm công trình |
| `remove` | có công trình tại `(x, y)` | xóa, trả `refund = floor(price / 2)` |
| `expand` | `land < 4` | `land + 1` |
| `harvest` | `harvestId` khớp `^[A-Za-z0-9-]{8,32}$`; `x, y` tùy chọn | có `x, y` thì chỉ hái cây chín tại ô đó, không có thì hái mọi cây chín; tổng xu vào `coin_grants` |

Mã lỗi 400: `bad_action`, `bad_cell`, `not_owned`, `occupied`, `bad_id`, `no_land_left`, `bad_harvest_id`. 403 khi không có cờ. Mọi trả lời thành công kèm `farm`, `dayCount`, và cho `harvest` thêm `granted`.

`harvest` chạy trong **một** `env.DB.batch`: `UPDATE farms` và `INSERT INTO coin_grants (user_id, amount, note, granted_by) SELECT ... WHERE NOT EXISTS (SELECT 1 FROM coin_grants WHERE user_id = ? AND note = ?)` với `note = 'farm:harvest:' + uid + ':' + harvestId`. Gọi lại cùng `harvestId` không có cây chín nào còn lại, và `note` đã tồn tại, nên `granted = 0`. `granted_by = 0`, cùng giá trị hệ thống mà `_daily-task.js` dùng cho thưởng ngày.

### 4.4 Đường tiền

- **Chi** (hạt, đất, công trình): máy bé trừ `appState.coins` rồi gửi hành động, giống mua công trình lâu đài. Server từ chối thì máy bé hoàn lại và vẽ lại theo `farm` server trả. Không đủ xu thì máy bé không gửi.
- **Thu** (hái): chỉ qua `coin_grants`. Máy bé nhận ở lần đồng bộ tài khoản kế tiếp, và gọi đồng bộ ngay sau khi hái để xu về liền.
- **Hoàn** (dỡ): máy bé cộng `refund` vào ví, giống hoàn 50% khi thay công trình lâu đài.

### 4.5 Cờ và mất mạng

- Server: mọi endpoint nông trại gọi `nightRaidEnabled(env, uid)`, 403 nếu tắt.
- Máy bé: nút NÔNG TRẠI và dòng ở khoảnh khắc thưởng chỉ hiện khi `appState.allowBot`.
- Mất mạng: vẽ từ `appState.farm`, mọi nút thao tác tắt, ghi "Cần mạng để trồng và hái".

## 5. Màn hình

Từ trên xuống:

1. **Thanh nhiệm vụ hôm nay**: "Hôm nay 2/3 nhiệm vụ · xong hết là vườn +1 ngày" và nút **Vào học** mở đúng deep link của Daily Task hiện có. Trạng thái: chưa có nhiệm vụ; đang làm; xong hôm nay ("Vườn đã lớn hôm nay, mai tiếp").
2. **Bảng tên vườn**: giá trị nông trại, `land` khoảnh, `dayCount` ngày.
3. **Bàn cờ 8×8**: cây với nhãn "còn N ngày", công trình, đất hoang có biển giá. Chạm cây chín để hái riêng, chạm đất hoang của khoảnh kế tiếp để mua; khoảnh xa hơn ghi "mở khoảnh trước đã". Chạm ô trống trong lúc chọn hạt để trồng.
4. **THU HOẠCH TẤT CẢ**: sáng khi có cây chín, ghi tổng xu.
5. **Shop**: khay ngang hai nhóm Hạt và Công trình, kéo vào đất hoặc chạm chọn rồi chạm ô, dùng lại cử chỉ của khu xây nhà. Mục không đủ xu mờ đi.

Điểm vào: nút NÔNG TRẠI ở màn Cướp Đêm; dòng "Nông trại +1 ngày · N cây chín" với nút "Đi hái" ở khoảnh khắc thưởng ngày.

## 6. Tranh

Cùng phong cách isometric với khu lâu đài, PNG hoặc WebP trong `img/farm/`.

- Bàn cờ 8×8: 1
- Lớp đất hoang cho một khoảnh 4×4: 1
- Biển giá: 1
- Mầm chung cho mọi cây: 1
- 6 cây × 3 giai đoạn non, xanh, chín: 18
- 8 công trình: 8
- Bảng chỉ đường "Nông trại" đặt ở cổng lâu đài: 1

Tổng 31 hình. Đây là bước tốn công nhất, tách riêng trong kế hoạch. Cà chua và lúa chín có thể dùng lại `tomato-field.png` và `rice-field.png` nếu hợp cỡ.

## 7. Kiểm thử

Chạy bằng Node 22, `npm test`, hàng đợi tự nhận `tests/*.test.js`, mỗi file kết bằng `runAll().then(code => process.exit(code))`.

- `tests/farm-rules.test.js`: luật thuần. Trồng trước và sau thưởng ngày; chín đúng ngày; giai đoạn hình; không trồng lên đất hoang, ô có cây, ô có công trình; công trình 2×2 vắt qua hai khoảnh đã mở được phép, vắt qua khoảnh chưa mở bị chặn; `expand` dừng ở 4; `remove` hoàn 50% làm tròn xuống; `normalize` bỏ ô sai; `farmValue`; không có số âm.
- `tests/money-farm.test.js`: chạy thật qua `tests/d1-mock.js` và `tests/pages-harness.js`. Hái trả đúng tổng và đúng một dòng `coin_grants`; gọi lại cùng `harvestId` không thêm dòng; hai lần hái khác id trong cùng ngày là hai dòng; `dayCount` lấy từ `daily_task_rewards`; 403 khi không có cờ; `GET` tạo vườn rỗng lần đầu; `plant` trên đất hoang bị từ chối và không đổi `farm_json`.
- `tests/farm-client.test.js`: màn hình trong sandbox `tests/setup.js`. Nút NÔNG TRẠI ẩn khi không có cờ; thanh nhiệm vụ ra đúng ba trạng thái; nhãn "còn N ngày" đúng; nút thu hoạch tắt khi không có cây chín; mất mạng thì nút thao tác tắt.
- Cập nhật kiểm tra danh sách precache và `SCREEN_FILES` cho file mới.
- Thêm mục nông trại vào bản kê `npm run verify`.
- Không sửa bốn mốc phiên bản bằng tay; `scripts/deploy.sh` tự bump.

## 8. Ra mắt

1. Tách nhánh từ `master`.
2. Chạy `npx wrangler@3 d1 execute eng_pwa_db --remote --file db/027-farms.sql` trước khi deploy mã đọc bảng.
3. Commit theo đường dẫn rõ, rồi `scripts/deploy.sh -m "..."`. Không `git push` lên GitHub nếu người dùng chưa yêu cầu.
4. Bật `allow_bot` cho vài bé test bằng trang admin. Giao nhiệm vụ cho các bé đó.
5. Sau vài tuần xem số liệu rồi mới bàn bản 2.

## 9. Ngoài phạm vi bản này

- Vật nuôi cho sản phẩm theo ngày nhiệm vụ, thành tựu trả xu, sang thăm vườn bạn chỉ xem, cây sự kiện theo tuần. Mọi thứ nếu làm đều tính theo ngày nhiệm vụ, không theo giờ.
- Chuyển ba ruộng cũ trong lâu đài sang luật mới.
- Xác minh ví ở server khi chi tiêu.

## 10. Quyết định đã chốt và lý do

| Quyết định | Lý do |
|---|---|
| Lớn theo ngày nhiệm vụ, không theo giờ thật | Tiêu chí 1 và 2. Cây theo giờ là móc mở app nhiều lần, ngược mục tiêu để thời gian cho bé học. |
| Một nấc mỗi ngày, không theo bài lẻ | Không thể cày bằng bài ngắn; nông trại thành lịch của những ngày làm xong việc được giao. |
| Hái ra xu thẳng, không kho, không chợ, không đơn hàng | Ba hệ đó là móc quay lại và độ phức tạp, không thêm việc học nào. |
| Số xu nhỏ (hái 18 đến 120) | Bản ×10 cho 2.000 đến 8.000 xu một ngày, làm 200 xu thưởng nhiệm vụ thành vô nghĩa và chạm trần ví trong hai tuần. |
| Đất 10.000 một khoảnh, không cần Giấy Đất | Người dùng chốt. Mua đất nhanh là cảm giác tốt cho bé mới; công trình là mục tiêu dài. |
| Nằm trong khu Cướp Đêm, theo cờ `allow_bot` | Thử với vài bé trước khi mở rộng. |
| `dayCount` đếm từ `daily_task_rewards` | Dùng lại khóa đúng-một-lần đã có; không bộ đếm mới, không race. |
| Xu hái qua `coin_grants` | Quy ước tiền của repo: server chỉ chuyển tiền bằng IOU có `note` duy nhất. |
| Không vào `daily-task-catalog.js` | Nông trại không phải việc học. |
