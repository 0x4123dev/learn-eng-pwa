# Nông trại theo ngày nhiệm vụ — thiết kế

Ngày: 2026-09-04. Trạng thái: chờ người dùng duyệt. Cài đặt trên `master`.

## 1. Mục tiêu và tiêu chí

Bé học để kiếm xu, dùng xu trồng cây và xây nông trại ngay trong khu vườn lâu đài, rồi thu hoạch. Nông trại là phần thưởng nhìn thấy được của việc học, không phải một trò chơi để chơi.

Tiêu chí bắt buộc, mọi quyết định bên dưới phải thỏa:

1. **Thứ duy nhất làm cây lớn là hoàn thành hết Daily Task của ngày.** Không có gì lớn theo đồng hồ.
2. **Mỗi ngày lịch cây đổi hình đúng một lần**: lớn nếu xong nhiệm vụ, héo nếu không. Xong lại thì tươi lại.
3. **Không khuyến khích mở app để thăm vườn.** Ngoài lúc vừa xong nhiệm vụ, vườn không có gì mới.
4. **Mọi màn liên quan đều chỉ về việc hoàn thành nhiệm vụ hôm nay**, kể cả trang Daily Task.
5. **Không có màn hình mới.** Bé trồng trên khu vườn lâu đài đang có. Hạt giống, công trình nông trại, và "nông trại riêng" đều mua trong nút SHOP đang có.
6. **Ruộng cũ trong lâu đài theo cùng luật.** Không còn công trình nào "mua rồi đợi giờ là có xu".
7. **Chỉ mở cho tài khoản có cờ `allow_bot`**, để thử với vài bé trước.
8. Luật đủ ngắn để một bé lớp 4 hiểu trong ba câu.

## 2. Hiện trạng liên quan

- **Khu vườn lâu đài** (`js/night-raid.js`, `js/night-raid-rules.js`): lưới 12×12 trong màn Cướp Đêm, tab Arena, hiện với `appState.allowBot`. Lâu đài chiếm 3×3. Nút SHOP mở khay ngang một danh sách duy nhất là `DEFENSES`; kéo món vào ô hoặc chạm chọn rồi chạm ô để mua; máy bé trừ ví rồi PUT `layout_json` lên `night_raid_homes`. Bốn công trình sản xuất theo đồng hồ: ruộng lúa, vườn cà chua, ao cá cho 100 xu mỗi 24 giờ; trại huấn luyện cho 1 lính mỗi 24 giờ. Đồng hồ nằm ở `cell.readyAt` và `PRODUCTION_MS`; server giữ `readyAt` cũ khi PUT (`functions/api/night-raid/home.js:28`) và trả xu khi thu hoạch bằng cộng dồn vào `night_raid_homes.lootable_coins` rồi trả số dư mới cho máy bé (`functions/api/night-raid/collect.js`).
- **Trận cướp** bỏ qua mọi ô có `producer` (`night-raid-rules.js:146, 211`). **Cấp nhà** chỉ cộng giá của món tra được trong `DEFENSES` (`night-raid-rules.js:113`). Món nằm ngoài `DEFENSES` tự động không ảnh hưởng trận đánh và cấp nhà.
- **Khung đất** là một ảnh hàng rào cố định (`isometric-home-board-frame-v4.png`), bên trong trong suốt, lưới CSS đè lên. Số cột và hàng của lưới là tham số CSS, nên cùng khung có thể đè lưới cỡ khác.
- **Daily Task** (`js/daily-task-catalog.js`, `js/daily-task.js`, `functions/api/_daily-task.js`, `db/018`, `db/019`): admin giao nhiệm vụ theo catalog, mỗi nhiệm vụ là N phiên đạt 100% trong ngày GMT+7. Tiến độ đếm từ `activities` khi đọc. Xong hết thì server chèn một dòng `daily_task_rewards(user_id, task_date)` và trả 200 xu qua `coin_grants`, đúng một lần mỗi ngày. Dòng này là khóa. Trang bé có hero một vòng tròn một câu, danh sách nhiệm vụ với nút Vào học, kho khiên kiếm, và thẻ ở màn Home.
- **Tranh**: các tấm nền trận đánh được sinh bằng ImageGen, lưu ở kho ảnh sinh của Codex, rồi `scripts/build-battle-scenes.py` dùng PIL cắt, thu nhỏ, xuất WebP vào `img/`. Nông trại dùng lại quy trình này.
- Worktree hiện tại tách nhánh trước khi Daily Task lên master, nên cài đặt phải tách nhánh mới từ `master`.

## 3. Luật chơi

### 3.1 Ba câu cho bé

1. Hoàn thành hết nhiệm vụ hôm nay là cây lớn thêm **một ngày**.
2. Bỏ một ngày là cây **héo**. Làm xong lại là cây **tươi lại**.
3. Cây chín thì **hái ra xu**. Xu vào SHOP mua hạt, mua công trình, mua thêm vườn.

### 3.2 Ngày nông trại

- Một ngày nông trại = một dòng trong `daily_task_rewards` của bé. Số ngày hiện tại `dayCount` = `COUNT(*)` theo `user_id`.
- Một ngày lịch chỉ có tối đa một ngày nông trại. Không thể cày.
- Bé chưa được giao nhiệm vụ thì `allDone` luôn sai, cây không lớn. Màn hình nói rõ "Hôm nay chưa có nhiệm vụ".

### 3.3 Héo và tươi

Gọi `today`, `yesterday` là ngày GMT+7 theo `nightDate()`. `doneOn(d)` là có dòng thưởng ngày `d`.

- Một cây **héo** khi cả ba điều sau đúng: cây được trồng trước hôm nay (`at < today`), hôm qua không xong (`!doneOn(yesterday)`), và hôm nay chưa xong (`!doneOn(today)`).
- Xong hết nhiệm vụ hôm nay thì `doneOn(today)` đúng, mọi cây tươi lại ngay.
- Hôm qua xong thì sáng nay cây còn tươi, dù hôm nay chưa làm gì.
- Cây trồng hôm nay không héo trong ngày.
- Héo **không** lùi tiến độ, không chết, không mất hạt. Héo là hình ảnh và một khóa: **cây héo không hái được** cho đến khi tươi lại. Cây chín mà héo hiện "Làm xong nhiệm vụ để cây tươi rồi hái".
- Cùng luật cho ruộng cũ.

### 3.4 Cây

| id | Tên | Ngày để chín | Hạt (xu) | Hái được (xu) | Lãi mỗi ngày mỗi ô |
|---|---|---|---|---|---|
| `lettuce` | Rau cải | 1 | 3 | 8 | 5 |
| `tomato` | Cà chua | 2 | 5 | 18 | 6,5 |
| `carrot` | Cà rốt | 3 | 8 | 30 | 7,3 |
| `rice` | Lúa | 4 | 10 | 45 | 8,75 |
| `rose` | Hoa hồng | 6 | 15 | 80 | 10,8 |
| `pumpkin` | Bí ngô | 8 | 20 | 120 | 12,5 |

- Mỗi cây chiếm 1 ô, đặt lên bất kỳ ô trống nào của khu vườn lâu đài hoặc nông trại riêng. Không cần mở khóa, chỉ chặn bằng giá.
- Cây lưu `day` = `dayCount` lúc trồng và `at` = ngày GMT+7 lúc trồng. Tiến độ `g = dayCount − day`, chín khi `g ≥ days`. Trồng trước khi thưởng ngày về thì hôm đó tính là ngày đầu. Rau cải trồng buổi sáng, làm xong nhiệm vụ là hái được ngay hôm đó.
- Trên cây ghi "còn N ngày nhiệm vụ", `N = days − g`. Không ghi giờ.
- **Mỗi ngày lớn là một hình riêng.** Cây có `days + 1` hình tươi: hình mầm chung khi `g = 0`, rồi mỗi `g` từ 1 đến `days` một hình riêng, hình cuối là chín. Không dùng chung bốn giai đoạn.
- Mỗi cây có hai hình héo: **héo non** khi `g < days / 2`, **héo già** khi `g ≥ days / 2`, kể cả chín. Mầm héo dùng một hình mầm héo chung.
- Hái xóa cây khỏi ô. Hoa hồng hái và bán như mọi cây.

### 3.5 Vườn và nông trại riêng

- **Vườn hiện tại** là lưới 12×12 của khu lâu đài. Cây và công trình nông trại đặt lên ô trống như mọi món khác, cạnh tường, bẫy, ruộng cũ.
- Khi thấy khu lâu đài không đủ chỗ, bé vào SHOP mua **Nông trại riêng**, giá **10.000 xu**, mua tối đa **3** lần. Đây chính là màn hình nông trại riêng: một bàn cờ riêng, chuyển qua bằng chip. Mỗi nông trại riêng là một khu đất riêng cùng khung hàng rào với khu lâu đài nhưng **không có lâu đài**, lưới **6×6 = 36 ô**, chỉ đặt được cây và công trình nông trại, không đặt được món phòng thủ. Không bị cướp, không tính vào trận đánh và cấp nhà.
- Đã có nông trại riêng thì màn xây nhà hiện dãy chip **LÂU ĐÀI · NÔNG TRẠI 1 · NÔNG TRẠI 2 · NÔNG TRẠI 3** để chuyển bàn cờ. Cùng SHOP, cùng cử chỉ, cùng nút THU HOẠCH cho mọi khu.
- Không có đất hoang, không có khoảnh. Hết chỗ thì mua nông trại riêng hoặc dỡ bớt.

### 3.6 Công trình nông trại

Thuần trưng bày, không sản xuất, không phòng thủ. Là phần "xây trang trại" mà việc học mua được.

| id | Tên | Giá (xu) | Cỡ |
|---|---|---|---|
| `fence` | Hàng rào gỗ nông trại | 300 | 1×1 |
| `fruit-tree` | Cây ăn quả | 800 | 1×1 |
| `well` | Giếng | 1.000 | 1×1 |
| `chicken-coop` | Chuồng gà | 3.000 | 2×2 |
| `barn` | Nhà kho | 5.000 | 2×2 |
| `windmill` | Cối xay gió | 8.000 | 2×2 |
| `cow-shed` | Chuồng bò | 12.000 | 2×2 |
| `farmhouse` | Nhà nông dân | 20.000 | 2×2 |

- Đặt lên khu lâu đài hoặc nông trại riêng, ô phải trống, 2×2 phải nằm trọn trong lưới.
- **Dỡ** công trình nông trại hoàn 50% giá, làm tròn xuống, giống thay công trình lâu đài. Không dỡ được cây, không hoàn hạt.
- **Giá trị nông trại** = tổng giá công trình nông trại đang đứng trên mọi khu. Hiện cạnh cấp nhà trên bảng tên.
- Không ảnh hưởng cấp nhà, sức mạnh, trận đánh.

### 3.7 Ruộng cũ theo luật mới

Bốn công trình sản xuất của khu lâu đài bỏ đồng hồ 24 giờ:

| Công trình | Trước | Sau |
|---|---|---|
| Ruộng lúa, vườn cà chua, ao cá | 100 xu mỗi 24 giờ | 100 xu mỗi **ngày nhiệm vụ** đã xong kể từ lần thu trước, tối đa một lần mỗi ngày nhiệm vụ |
| Trại huấn luyện | 1 lính mỗi 24 giờ | 1 lính mỗi ngày nhiệm vụ đã xong |

- Ô sản xuất lưu `lastDay` = `dayCount` lúc mua hoặc lúc thu, và `at` ngày GMT+7 lúc mua. **Sẵn** khi `dayCount > lastDay`. Thu xong đặt `lastDay = dayCount`. Vì mỗi ngày lịch chỉ có một ngày nhiệm vụ, mỗi ruộng cho tối đa 100 xu một ngày, đúng như trước, nhưng chỉ khi làm xong việc.
- Ruộng và ao **héo** theo luật 3.3 và không thu được khi héo. Trại huấn luyện không có hình héo nhưng cũng không nhận lính khi héo.
- Ba trạng thái hình cho ruộng và ao: **đang lớn** sau khi thu, **sẵn** khi `dayCount > lastDay`, **héo**. Hình sẵn dùng lại ba ảnh có sẵn.
- Chuyển đổi dữ liệu cũ: lần đầu server đọc một ô còn `readyAt`, đặt `lastDay = dayCount` hiện tại và `at = today`, bỏ `readyAt`. Không ai mất gì, không ai được thêm gì.
- Giá, cỡ, giới hạn số lượng, tác dụng lên cấp nhà, và đường trả xu giữ nguyên; chỉ điều kiện sẵn thay đổi.

### 3.8 Thu hoạch

- Nút **THU HOẠCH** đang có thu mọi thứ sẵn và tươi trên mọi khu: cây chín, ruộng cũ sẵn, lính. Chạm một cây chín tươi để hái riêng cây đó.
- Khi có gì héo, nút đổi thành **VÀO HỌC ĐỂ CÂY TƯƠI** và mở trang Daily Task.
- Sau khi thu, nếu vừa hái ít nhất một cây, hiện thêm nút **TRỒNG LẠI NHƯ CŨ**: trồng lại đúng loại hạt vào đúng các ô vừa hái, trừ ví một lần. Không đủ xu thì nút mờ và ghi số xu còn thiếu. Nút này để bé không phải kéo từng ô mỗi ngày.

### 3.9 Nhịp tiền ước tính

Mỗi ngày làm xong nhiệm vụ: 200 xu thưởng, xu của các phiên học, xu ruộng cũ nếu có, và xu hái cây. Khu lâu đài thường còn 40 đến 80 ô trống; 40 ô toàn bí ngô cho khoảng 500 xu một ngày. Nông trại riêng 36 ô cho thêm khoảng 450 xu một ngày. Bé không có ruộng cũ mua được nông trại riêng đầu tiên sau khoảng **2 đến 3 tuần** làm xong đều. Các con số là chỗ tinh chỉnh; luật thì cố định.

## 4. Kiến trúc

### 4.1 Không có bảng mới, không có API mới

Mọi thứ nằm trong `night_raid_homes.layout_json` và đi qua ba endpoint đang có: `GET/PUT /api/night-raid/home`, `POST /api/night-raid/collect`. Thêm duy nhất một trường `farm` vào `GET /api/me/daily-tasks`. Không có migration.

### 4.2 File

| File | Vai trò |
|---|---|
| `js/farm-rules.js` (mới) | Bảng `CROPS`, `FARM_BUILDINGS`, `FARM_PLOT = { price: 10000, size: 6, max: 3 }`; `byId`; `progress(cell, dayCount)`; `isWilted(cell, ctx)` với `ctx = { today, doneYesterday, doneToday }`; `spriteFor(cell, dayCount, ctx)` trả tên file; `farmValue(layout)`; `producerReady(cell, dayCount)`. UMD như `night-raid-rules.js`, server import được. |
| `js/farm-art-manifest.js` (mới) | Danh sách mọi file hình nông trại và ruộng cũ, kèm cỡ và mô tả. Dùng bởi `spriteFor`, `sw.js`, script dựng tranh, test tồn tại. |
| `js/night-raid-rules.js` | `normalizeLayout` nhận ô nông trại (tra `FarmRules.byId`) và mảng `farms`; bỏ `PRODUCTION_MS`, `readyAt`; chuyển ô cũ sang `lastDay`, `at`. Trận đánh, `combatPower`, `homeLevel` giữ nguyên vì ô nông trại không nằm trong `DEFENSES`. |
| `js/night-raid.js` | SHOP có tab; chip chuyển khu; vẽ cây theo ngày và héo; huy hiệu "còn N ngày", "THU HOẠCH", "HÉO"; nút THU HOẠCH đổi trạng thái; TRỒNG LẠI NHƯ CŨ; thanh nhiệm vụ trên đầu màn xây nhà; lớp nền khô khi héo. |
| `functions/api/_farm.js` (mới) | `dayCount(env, uid)`, `wiltCtx(env, uid, now)` đọc `daily_task_rewards` hai ngày, `farmSummary(env, uid, now)` cho trang Daily Task. |
| `functions/api/night-raid/home.js` | GET trả thêm `dayCount`, `ctx`. PUT: ô cây và ô sản xuất trùng `uid` với ô cũ cùng loại thì giữ `day`/`lastDay`/`at` của server; ô mới đặt theo `dayCount`, `today` của server. Kiểm `farms.length ≤ 3`, lưới 6×6, chỉ món nông trại. |
| `functions/api/night-raid/collect.js` | Thu cây chín tươi, ruộng cũ sẵn tươi, lính; `uid` tùy chọn để thu một ô. Trả `dayCount`, `ctx`, và `wilted: true` khi có món bị chặn vì héo. |
| `functions/api/me/daily-tasks.js` | Thêm `farm` khi `allow_bot`. |
| `js/daily-task.js` | Hero nhắc vườn; dải vườn; thẻ Home nhắc héo; "Xem vườn" mở màn xây nhà. |
| `scripts/build-farm-art.py` (mới) | Đọc ảnh gốc theo bản kê, cắt, thu về cỡ chuẩn, xuất WebP vào `img/farm/`. Kiểu `build-battle-scenes.py`. |
| `js/lazy-data.js`, `sw.js` | Thêm `farm-rules.js`, `farm-art-manifest.js`, tranh theo bản kê. |
| `css/styles.css` | Tab SHOP, chip khu, lưới 6×6, lớp héo, thanh nhiệm vụ, dải vườn trên trang Daily Task. |

Không thêm mục vào `daily-task-catalog.js`: hái vườn không phải việc học, không thể giao làm nhiệm vụ.

### 4.3 Dữ liệu trong `layout_json`

```json
{
  "cells": [
    { "type": "stone-wall", "gx": 2, "gy": 5, "tier": 2 },
    { "type": "rice-field", "gx": 6, "gy": 6, "tier": 1, "uid": "p-…", "lastDay": 12, "at": "2026-09-01" },
    { "type": "tomato", "gx": 1, "gy": 1, "uid": "c-…", "day": 12, "at": "2026-09-04" },
    { "type": "well", "gx": 9, "gy": 9, "uid": "f-…" }
  ],
  "farms": [
    { "cells": [ { "type": "pumpkin", "gx": 0, "gy": 0, "uid": "c-…", "day": 12, "at": "2026-09-04" } ] }
  ],
  "dogLane": 2, "soldiers": 3, "gridVersion": 3, "castleCell": { "gx": 4, "gy": 1 }
}
```

- Ô cây: `type` là id trong `CROPS`, có `uid`, `day`, `at`. Ô công trình nông trại: `type` trong `FARM_BUILDINGS`, có `uid`. Ô sản xuất cũ: `lastDay`, `at` thay `readyAt`.
- `normalizeLayout(value, opts)` với `opts = { dayCount, today }` tùy chọn: bỏ ô sai id, sai tọa độ, chồng nhau; `farms` kẹp 0..3, mỗi vườn chỉ chứa món nông trại trong 6×6; ô còn `readyAt` được chuyển như 3.7 khi có `opts`, thiếu `opts` thì chỉ bỏ `readyAt` và giữ số đã có; `at` thiếu thì đặt `today` nếu có. Ô cây và công trình nông trại không nhận `lane`, `col`, `tier`.
- `gridVersion` lên 3 để đánh dấu bố cục đã chuyển.
- Máy bé giữ `appState.nightRaidLayout` như nay, thêm `appState.farmDayCount`, `appState.farmCtx` để vẽ khi mất mạng.

### 4.4 Mua, hái, dỡ

- **Mua** hạt, công trình nông trại, nông trại riêng: máy bé trừ `appState.coins`, sửa `layout` cục bộ, PUT như mua công trình lâu đài. Server chuẩn hóa và giữ `day`/`at` của mình cho ô mới. Không đủ xu thì không mua được, mục trong SHOP mờ.
- **Hái**: `POST collect` với `uid` hoặc không. Server thu mọi ô sẵn và tươi, cộng xu vào `lootable_coins` như ruộng cũ và trả số dư; máy bé nhận số dư đó. Cây chín mà héo bị bỏ qua và server trả `wilted: true`.
- **Dỡ** công trình nông trại: máy bé hoàn 50% vào ví, xóa ô, PUT. Giống thay công trình lâu đài.
- **Trồng lại như cũ**: máy bé lặp lại bước mua cho từng ô vừa hái trong một PUT.
- Không có gì mới về tiền: hai đường có sẵn là chi ở máy bé và thu qua `collect.js`.

### 4.5 Cờ và mất mạng

- Server: `home.js` và `collect.js` đã kiểm `nightRaidEnabled`. `farm` trong `/api/me/daily-tasks` chỉ có khi cờ bật.
- Máy bé: cả khu Cướp Đêm đã theo `appState.allowBot`. Dải vườn trên trang Daily Task và dòng ở khoảnh khắc thưởng chỉ hiện khi có cờ.
- Mất mạng: vẽ từ bản sao với `farmDayCount`, `farmCtx` đã lưu; mua và hái tắt, ghi "Cần mạng để trồng và hái". `localCollect` dự phòng tuân cùng luật qua `producerReady` và `ctx` đã lưu, giống hiện nay.

## 5. Màn hình

### 5.1 Màn xây nhà

Thay đổi trên màn đang có, không có màn mới:

1. **Thanh nhiệm vụ hôm nay** trên đầu, dưới HUD: "Hôm nay 2/3 nhiệm vụ · xong hết là cây lớn thêm 1 ngày" và nút **Vào học** mở trang Daily Task. Trạng thái: chưa có nhiệm vụ; đang làm; đang héo ("Cây đang héo. Làm xong hôm nay là tươi lại"); xong hôm nay ("Cây đã lớn hôm nay, mai tiếp").
2. **Chip chuyển khu** LÂU ĐÀI · NÔNG TRẠI 1 · NÔNG TRẠI 2 · NÔNG TRẠI 3, chỉ hiện khi có nông trại riêng. Nông trại riêng dùng cùng khung hàng rào, lưới 6×6, không lâu đài, không HUD sức mạnh.
3. **Bàn cờ**: cây đúng hình theo ngày và héo, nhãn "còn N ngày"; ruộng cũ ba trạng thái; công trình nông trại. Chạm cây chín tươi để hái riêng; chạm cây héo hiện lý do và nút Vào học.
4. **THU HOẠCH** như 3.8, kèm **TRỒNG LẠI NHƯ CŨ** sau khi hái.
5. **SHOP** có bốn tab: **Phòng thủ** (như nay), **Hạt giống**, **Nông trại**, **Mở rộng** (Nông trại riêng 10.000, ghi "đã có 1/3"). Tab Phòng thủ ẩn khi đang ở nông trại riêng. Mục không đủ xu mờ đi. Kéo và chạm như nay.
6. **Bảng tên**: cấp nhà như nay, thêm giá trị nông trại.
7. Cả khu héo thì nền đất ngả màu khô, có lớp phủ nhẹ; hình cây héo là hình riêng, không chỉ là lọc màu.

### 5.2 Trang Daily Task

Mục tiêu: bé nhìn một lần là hiểu "xong hết nhiệm vụ thì cây lớn, bỏ thì cây héo". Chỉ áp dụng khi `appState.allowBot`; không có cờ thì trang giữ như hiện nay.

- **Hero**: câu phụ thêm vườn. Chưa xong: "Xong hết là +200 xu, 1 món quà, và cây lớn thêm 1 ngày 🌱". Xong: "+200 xu đã vào túi. Cây đã lớn hôm nay 🌼". Đang héo và chưa xong: "Cây đang héo 🥀. Xong hết nhiệm vụ là cây tươi lại".
- **Dải vườn** ngay dưới hero, trước danh sách nhiệm vụ: một hình cây lấy từ chính vườn của bé, ưu tiên cây sắp chín nhất, vẽ đúng trạng thái tươi hay héo; một câu: "Vườn của con: 3 cây đang lớn, 1 cây chín" hoặc "5 cây đang héo"; nút **Xem vườn** mở màn xây nhà. Bé chưa trồng gì: "Vườn đang trống. Xong nhiệm vụ rồi ghé SHOP mua hạt nhé".
- **Khoảnh khắc thưởng** (`justRewarded`): thêm dòng "Cây lớn thêm 1 ngày · N cây chín" và nút **Đi hái** nếu `N > 0`. Đang héo mà xong thì dòng đầu là "Cây tươi lại rồi 🌱".
- **Thẻ Home** (`renderHomeCard`): khi đang héo, câu phụ đổi thành "Cây đang héo 🥀 · làm nhiệm vụ để cứu cây".
- Dữ liệu lấy từ `farm` trong `GET /api/me/daily-tasks`: `{ wilted, crops, ripe, growing, preview: { id, g, days } }`, tính từ `layout_json` và `daily_task_rewards`. Không thêm yêu cầu mạng mới.

### 5.3 Sân chó ở Arena

Sân chó vẽ ruộng cũ và cây trên khu lâu đài theo cùng trạng thái tươi, sẵn, héo. Không vẽ nông trại riêng.

## 6. Tranh

### 6.1 Quy trình

1. `js/farm-art-manifest.js` liệt kê từng file: tên, cỡ ô, mô tả ngắn để viết lời nhắc. Đây là nguồn duy nhất.
2. Sinh ảnh gốc bằng ImageGen theo một **bảng phong cách** cố định ghi ở đầu `scripts/build-farm-art.py`: isometric cùng góc với `rice-field.png`, nền trong suốt, bảng màu khu lâu đài, không chữ, không bóng đổ dài. Mỗi cây sinh cả chuỗi ngày trong một lần để hình liền mạch.
3. `scripts/build-farm-art.py` đọc ảnh gốc theo bản kê, cắt sát, thu về 256×256 cho 1×1 và 512×512 cho 2×2, xuất WebP vào `img/farm/`.
4. `tests/farm-art.test.js` khẳng định mọi file trong bản kê tồn tại trên đĩa, được `sw.js` precache, và không có file thừa trong `img/farm/`. Lỗi này từng xảy ra với hai tấm nền khu lâu đài chưa được `git add`.
5. `git add` từng file tranh theo đường dẫn rõ.

### 6.2 Bản kê

| Nhóm | Số hình |
|---|---|
| Mầm chung tươi, mầm chung héo | 2 |
| Cây tươi theo ngày: rau cải 1, cà chua 2, cà rốt 3, lúa 4, hoa hồng 6, bí ngô 8 | 24 |
| Cây héo: 6 cây × (non, già) | 12 |
| Ruộng cũ: ruộng lúa, vườn cà chua, ao cá × (đang lớn, héo); hình sẵn dùng lại | 6 |
| Công trình nông trại | 8 |
| Biểu tượng SHOP cho Nông trại riêng, lớp nền khô khi héo | 2 |

Tổng **54 hình**. Nông trại riêng dùng lại khung hàng rào đang có, không cần tấm nền mới. Tách thành bước riêng trong kế hoạch, làm trước phần màn hình để test tồn tại xanh sớm.

## 7. Kiểm thử

Chạy bằng Node 22, `npm test`, hàng đợi tự nhận `tests/*.test.js`, mỗi file kết bằng `runAll().then(code => process.exit(code))`.

- `tests/farm-rules.test.js`: `progress`, chín đúng ngày; `spriteFor` đúng file cho từng `g` và trạng thái héo; héo đúng bảng chân trị của `at`, `doneYesterday`, `doneToday`; `farmValue`; `producerReady`.
- `tests/night-raid-layout-farm.test.js`: `normalizeLayout` nhận ô cây và công trình nông trại, bỏ id lạ, chặn chồng nhau; `farms` kẹp 0..3 và 6×6, từ chối món phòng thủ trong nông trại riêng; chuyển `readyAt` sang `lastDay`, `at`; `homeLevel`, `combatPower`, `createState` bỏ qua ô nông trại và `farms`; bố cục cũ không đổi cấp nhà.
- `tests/money-night-raid-collect.test.js` (sửa hoặc thêm): chạy thật qua `tests/d1-mock.js` và `tests/pages-harness.js`. Cây chín tươi trả đúng xu và xóa ô; cây héo không trả, `wilted: true`, `layout_json` không đổi; ruộng cũ chỉ trả khi `dayCount > lastDay`, `lastDay` cập nhật; tổng một ruộng một ngày không vượt 100; `uid` thu một ô; `dayCount` và `ctx` lấy từ `daily_task_rewards`; 403 khi không có cờ.
- `tests/night-raid-home-put.test.js` (sửa hoặc thêm): PUT không cho lùi `day`, `lastDay`; ô mới nhận `day`, `at` của server; hơn 3 vườn bị cắt; món phòng thủ trong nông trại riêng bị bỏ.
- `tests/daily-task-client.test.js` (mở rộng): hero, dải vườn, thẻ Home đúng chữ ở ba trạng thái tươi, héo, xong; ẩn khi không có cờ. `tests/night-raid-builder-farm.test.js`: SHOP bốn tab, tab Phòng thủ ẩn ở nông trại riêng, chip khu chỉ hiện khi có nông trại riêng, nhãn "còn N ngày", THU HOẠCH đổi thành Vào học khi héo, TRỒNG LẠI NHƯ CŨ mờ khi thiếu xu, mất mạng thì mua và hái tắt.
- `tests/farm-art.test.js`: như 6.1 bước 4.
- Cập nhật kiểm tra danh sách precache và `SCREEN_FILES` cho file mới.
- Thêm mục nông trại, nông trại riêng và ruộng cũ vào bản kê `npm run verify`.
- Không sửa bốn mốc phiên bản bằng tay; `scripts/deploy.sh` tự bump.

## 8. Ra mắt

1. Tách nhánh từ `master`.
2. Sinh và dựng tranh theo mục 6, commit tranh.
3. Không có migration. Commit theo đường dẫn rõ, rồi `scripts/deploy.sh -m "..."`. Không `git push` lên GitHub nếu người dùng chưa yêu cầu.
4. Ruộng cũ tự chuyển đổi ở lần đọc đầu; không cần chạy tay.
5. Bật `allow_bot` cho vài bé test bằng trang admin. Giao nhiệm vụ cho các bé đó.
6. Sau vài tuần xem số liệu rồi mới bàn bản 2.

## 9. Ngoài phạm vi bản này

- Vật nuôi cho sản phẩm theo ngày nhiệm vụ, thành tựu trả xu, sang thăm vườn bạn chỉ xem, cây sự kiện theo tuần. Mọi thứ nếu làm đều tính theo ngày nhiệm vụ, không theo giờ.
- Xác minh ví ở server khi chi tiêu.
- Chuyển đường trả xu thu hoạch từ `lootable_coins` sang `coin_grants`.

## 10. Quyết định đã chốt và lý do

| Quyết định | Lý do |
|---|---|
| Lớn theo ngày nhiệm vụ, không theo giờ thật | Tiêu chí 1 và 3. Cây theo giờ là móc mở app nhiều lần, ngược mục tiêu để thời gian cho bé học. |
| Một nấc mỗi ngày, không theo bài lẻ | Không thể cày bằng bài ngắn; nông trại thành lịch của những ngày làm xong việc được giao. |
| Héo khi bỏ một ngày, tươi lại khi xong; héo chặn hái nhưng không lùi tiến độ | Người dùng yêu cầu hình héo để bé buồn. Chặn hái biến nỗi buồn thành lý do đi học ngay; không lùi tiến độ để không thành hình phạt kép. |
| Mỗi ngày lớn một hình riêng | Người dùng yêu cầu thấy cây lớn từng ngày. Mỗi lần xong nhiệm vụ phải thấy khác hôm qua. |
| Trồng ngay trong khu lâu đài, không màn hình riêng, mọi thứ trong SHOP | Người dùng chốt. Dùng lại toàn bộ lưới, cử chỉ, SHOP, PUT, collect; không bảng mới, không API mới. |
| Nông trại riêng là bàn cờ 6×6 cùng khung, chuyển bằng chip | Bãi cỏ quanh hàng rào chỉ là lề của một ảnh cố định, không đủ chỗ ghép thêm đất; dùng lại khung là cách rẻ nhất. 36 ô để không thành việc kéo thả hàng trăm ô mỗi ngày. |
| Ruộng cũ chuyển sang ngày nhiệm vụ | Người dùng yêu cầu; giữ đúng nguyên tắc không có gì "mua rồi đợi giờ". Giữ giá và đường trả xu để đổi ít nhất. |
| Xu hái cây đi qua `collect.js` như ruộng cũ | Một đường thu hoạch duy nhất cho mọi thứ trên khu đất; đường này đã được kiểm tra hành vi trong bộ test tiền. |
| Hái ra xu thẳng, không kho, không chợ, không đơn hàng | Ba hệ đó là móc quay lại và độ phức tạp, không thêm việc học nào. |
| Số xu nhỏ (hái 8 đến 120) | Bản ×10 cho hàng nghìn xu một ngày, làm 200 xu thưởng nhiệm vụ thành vô nghĩa và chạm trần ví trong hai tuần. |
| Nông trại riêng 10.000, không cần Giấy Đất | Người dùng chốt. |
| Theo cờ `allow_bot` | Thử với vài bé trước khi mở rộng. |
| `dayCount` và héo đếm từ `daily_task_rewards` | Dùng lại khóa đúng-một-lần đã có; không bộ đếm mới, không race. |
| Bản kê tranh là mã, có test tồn tại | Tranh chưa `git add` từng làm khu lâu đài thiếu nền ở checkout sạch. |
| Không vào `daily-task-catalog.js` | Nông trại không phải việc học. |
