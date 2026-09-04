# Nông trại theo ngày nhiệm vụ — thiết kế

Ngày: 2026-09-04. Trạng thái: chờ người dùng duyệt. Cài đặt trên `master`.

## 1. Mục tiêu và tiêu chí

Bé học để kiếm xu, dùng xu trồng cây và xây nông trại ngay trong khu vườn lâu đài, rồi thu hoạch. Nông trại là phần thưởng nhìn thấy được của việc học, không phải một trò chơi để chơi.

Tiêu chí bắt buộc, mọi quyết định bên dưới phải thỏa:

1. **Thứ duy nhất làm cây lớn là hoàn thành hết Daily Task của ngày.** Không có gì lớn theo đồng hồ.
2. **Mỗi ngày lịch cây đổi hình đúng một lần**: lớn nếu xong nhiệm vụ, héo nếu không. Xong lại thì tươi lại.
3. **Không khuyến khích mở app để thăm vườn.** Ngoài lúc vừa xong nhiệm vụ, vườn không có gì mới.
4. **Mọi màn liên quan đều chỉ về việc hoàn thành nhiệm vụ hôm nay**, kể cả trang Daily Task.
5. **Không có màn hình mới.** Bé trồng trên khu vườn lâu đài đang có. Hạt giống, công trình nông trại, và nông trại riêng đều mua trong nút SHOP đang có.
6. **Ruộng cũ giữ như cũ**, chỉ giới hạn mỗi loại một cái để xu thụ động không lấn át việc học. **Trại lính chỉ ra lính khi xong nhiệm vụ.**
7. **Chỉ mở cho tài khoản có cờ `allow_bot`**, để thử với vài bé trước. Cờ này từ nay chỉ còn nghĩa "được chơi trước": **hai chế độ chơi với bot bị gỡ** (mục 3.9).
8. Luật đủ ngắn để một bé lớp 4 hiểu trong ba câu.

## 2. Hiện trạng liên quan

- **Khu vườn lâu đài** (`js/night-raid.js`, `js/night-raid-rules.js`): lưới 12×12 trong màn Cướp Đêm, tab Arena, hiện với `appState.allowBot`. Lâu đài chiếm 3×3. Nút SHOP mở khay ngang một danh sách duy nhất là `DEFENSES`; kéo món vào ô hoặc chạm chọn rồi chạm ô để mua; máy bé trừ ví rồi PUT `layout_json` lên `night_raid_homes`. Bốn công trình sản xuất theo đồng hồ: ruộng lúa, vườn cà chua, ao cá 6.000 xu cho 100 xu mỗi 24 giờ, tối đa 4 mỗi loại; trại huấn luyện 8.000 xu cho 1 lính mỗi 24 giờ, tối đa 2. Kho lính không có trần (`SOLDIER_SANITY_CAP` chỉ chặn dữ liệu hỏng). Đồng hồ nằm ở `cell.readyAt` và `PRODUCTION_MS`; server giữ `readyAt` cũ khi PUT (`functions/api/night-raid/home.js:28`) và trả xu khi thu hoạch bằng cộng dồn vào `night_raid_homes.lootable_coins` rồi trả số dư mới cho máy bé (`functions/api/night-raid/collect.js`). `normalizeLayout` **xóa** ô vượt `maxOwned` (`night-raid-rules.js:91`).
- **Trận cướp** bỏ qua mọi ô có `producer` (`night-raid-rules.js:146, 211`). **Cấp nhà** chỉ cộng giá của món tra được trong `DEFENSES` (`night-raid-rules.js:113`). Món nằm ngoài `DEFENSES` tự động không ảnh hưởng trận đánh và cấp nhà.
- **Hai chế độ bot**, cả hai chạy hoàn toàn ở máy bé, không có đường server: "Luyện tập với máy" trong Arena (`js/petbattlebot.js`, `startBotBattle`/`finishBotBattle` trong `js/petbattle.js`, nút `pb-practice-btn`, được `allow_bot` mở); và cướp nhà bot trong Cướp Đêm. Trên master nút CƯỚP ĐÊM ở màn nhà đã mở thẳng danh sách nhà thật (`nrShowLiveTargets`); bot chỉ còn là nút "Chơi thử với Bot" ở cuối danh sách đó và trong màn báo lỗi khi không tải được nhà thật (`nrScoutBot` → `scoutBot` → `makeBotTarget` chọn trong 20 bậc `trainingTarget`). Trận bot kết thúc ở `finishRaid(..., online=false)`, nhánh này **cộng xu thẳng vào ví ở máy bé** (tối đa 120 một ngày) và trừ 20 xu khi thua; gỡ bot là gỡ luôn đường in xu cục bộ này. `trainingTarget` còn là snapshot mặc định của `resolveAutoBattle` và `createState` (`night-raid-rules.js:193, 209`).
- **Khung đất** là một ảnh hàng rào cố định (`isometric-home-board-frame-v4.png`), bên trong trong suốt, lưới CSS đè lên. Số cột và hàng của lưới là tham số CSS, nên cùng khung có thể đè lưới cỡ khác.
- **Daily Task** (`js/daily-task-catalog.js`, `js/daily-task.js`, `functions/api/_daily-task.js`, `db/018`, `db/019`): admin giao nhiệm vụ theo catalog, mỗi nhiệm vụ là N phiên đạt 100% trong ngày GMT+7. Tiến độ đếm từ `activities` khi đọc. Xong hết thì server chèn một dòng `daily_task_rewards(user_id, task_date)` và trả 200 xu qua `coin_grants`, đúng một lần mỗi ngày. Dòng này là khóa. Trang bé có hero một vòng tròn một câu, danh sách nhiệm vụ với nút Vào học, kho khiên kiếm, và thẻ ở màn Home.
- **Tranh**: các tấm nền trận đánh được sinh bằng ImageGen, lưu ở kho ảnh sinh của Codex, rồi `scripts/build-battle-scenes.py` dùng PIL cắt, thu nhỏ, xuất WebP vào `img/`. Nông trại dùng lại quy trình này.
- Worktree hiện tại tách nhánh trước khi Daily Task lên master, nên cài đặt phải tách nhánh mới từ `master`.

## 3. Luật chơi

### 3.1 Ba câu cho bé

1. Hoàn thành hết nhiệm vụ hôm nay là cây lớn thêm **một ngày**.
2. Bỏ một ngày là cây **héo**. Làm xong lại là cây **tươi lại**.
3. Cây chín thì **hái ra xu**. Xu vào SHOP mua hạt, mua công trình, mua thêm nông trại.

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
- Chỉ cây trồng mới héo. Ruộng cũ, ao cá, trại lính, công trình không héo.

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
- Khi thấy khu lâu đài không đủ chỗ, bé vào SHOP mua **Nông trại riêng**, giá **10.000 xu**, mua tối đa **3** lần. Đây chính là màn hình nông trại riêng: một bàn cờ riêng, chuyển qua bằng chip. Mỗi nông trại riêng cùng khung hàng rào với khu lâu đài nhưng **không có lâu đài**, lưới **6×6 = 36 ô**, chỉ đặt được cây và công trình nông trại, không đặt được món phòng thủ hay sản xuất cũ. Không bị cướp, không tính vào trận đánh và cấp nhà.
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

### 3.7 Ruộng cũ và trại lính

| Công trình | Trước | Sau |
|---|---|---|
| Ruộng lúa, vườn cà chua, ao cá | 6.000 xu, 100 xu mỗi 24 giờ, tối đa 4 mỗi loại | **Giữ nguyên** đồng hồ 24 giờ và giá. Chỉ đổi: **mua mới tối đa 1 mỗi loại**. |
| Trại huấn luyện | 8.000 xu, 1 lính mỗi 24 giờ, tối đa 2 | Giá **8.000 giữ nguyên**. **Mua nhiều được**, trần 10 trại chỉ để không mua thừa vô ích (kho lính trên master không còn trần). Mỗi trại cho **1 lính mỗi ngày nhiệm vụ đã xong** kể từ lần nhận trước, không theo giờ. |

- Ruộng cũ và ao cá không đổi cơ chế, không héo, hình như cũ. Đây là nguồn xu thụ động duy nhất còn lại, tối đa 300 xu một ngày, nhỏ hơn thưởng nhiệm vụ.
- **Giới hạn 1 chỉ áp cho mua mới.** Bé đang có 2 đến 4 ruộng cùng loại giữ nguyên tất cả; SHOP chỉ từ chối mua thêm khi đã có từ 1 trở lên. `normalizeLayout` **không** xóa ô vượt giới hạn mới; nó giữ tối đa 4 như trước. Giới hạn mua mới kiểm ở SHOP và ở server PUT cho ô có `uid` chưa từng có.
- Trại lính lưu `lastDay` = `dayCount` lúc mua hoặc lúc nhận lính, thay `readyAt`. **Sẵn** khi `dayCount > lastDay`. Nhận xong đặt `lastDay = dayCount`. Vì mỗi ngày lịch chỉ có một ngày nhiệm vụ, mỗi trại cho tối đa 1 lính một ngày, chỉ khi làm xong việc.
- Chuyển đổi trại lính cũ: lần đầu server đọc một trại còn `readyAt`, đặt `lastDay = dayCount` hiện tại, bỏ `readyAt`. Trại đang đếm giờ mất phần giờ đã đếm, đổi lại nhận lính ngay khi xong nhiệm vụ hôm nay. Ruộng cũ không chuyển gì.

### 3.8 Thu hoạch

- Nút **THU HOẠCH** đang có thu mọi thứ sẵn trên mọi khu: cây chín tươi, ruộng cũ đến giờ, lính từ trại đã có ngày nhiệm vụ mới. Chạm một cây chín tươi để hái riêng cây đó.
- Khi có cây héo, nút đổi thành **VÀO HỌC ĐỂ CÂY TƯƠI** và mở trang Daily Task. Ruộng cũ đến giờ vẫn thu được bằng cách chạm riêng ruộng, vì ruộng không héo.
- Sau khi thu, nếu vừa hái ít nhất một cây, hiện thêm nút **TRỒNG LẠI NHƯ CŨ**: trồng lại đúng loại hạt vào đúng các ô vừa hái, trừ ví một lần. Không đủ xu thì nút mờ và ghi số xu còn thiếu. Nút này để bé không phải kéo từng ô mỗi ngày.

### 3.9 Bỏ chế độ bot

Người dùng chốt: chỉ còn chơi với người thật. Cờ `allow_bot` giữ nguyên tên trong cơ sở dữ liệu và trang admin, chỉ đổi nghĩa thành "được chơi nông trại và Cướp Đêm trước".

- **Gỡ "Luyện tập với máy" ở Arena**: xóa nút `pb-practice-btn`, `startBotBattle`, `finishBotBattle`, nút "chơi lại" của kết quả luyện tập, chuỗi dịch `practiceBtn`/`practiceSub`/`practiceAgain`; xóa file `js/petbattlebot.js`, thẻ script trong `index.html`, dòng precache trong `sw.js`. Đấu với bạn thật giữ nguyên.
- **Gỡ cướp nhà bot trong Cướp Đêm**: xóa nút "Chơi thử với Bot" ở cuối danh sách nhà thật và trong màn báo lỗi tải nhà, xóa `nrScoutBot`, `scoutBot`, `makeBotTarget`, nhãn "BOT NGẪU NHIÊN" trong màn trinh sát, và **nhánh `online=false` của `finishRaid`** đang cộng xu vào ví ở máy bé. Nút CƯỚP ĐÊM ở màn nhà giữ như master: mở danh sách nhà thật. Không tải được nhà thật thì màn hình nói rõ "Chưa tải được nhà người chơi, thử lại sau", không đưa nhà bot ra thay. `scout()` chỉ còn nhận nhà thật và luôn `online=true`.
- Vé cướp 3 mỗi ngày, cộng 1 khi đủ 10 câu, kiếm cộng DAM, khiên chặn cướp: giữ nguyên, chỉ còn dùng cho nhà thật.
- `trainingTarget` và `trainingLayout` giữ trong `night-raid-rules.js` vì là snapshot mặc định của mô phỏng và được test dùng; không còn nút nào trên màn hình dẫn tới chúng.
- Không đụng server: cả hai chế độ bot chưa từng có endpoint riêng.

### 3.10 Nhịp tiền ước tính

Mỗi ngày làm xong nhiệm vụ: 200 xu thưởng, xu của các phiên học, tối đa 300 xu ruộng cũ, và xu hái cây. Khu lâu đài thường còn 40 đến 80 ô trống; 40 ô toàn bí ngô cho khoảng 500 xu một ngày. Nông trại riêng 36 ô cho thêm khoảng 450 xu một ngày. Bé mua được nông trại riêng đầu tiên sau khoảng **2 đến 3 tuần** làm xong đều. Các con số là chỗ tinh chỉnh; luật thì cố định.

## 4. Kiến trúc

### 4.1 Không có bảng mới, không có API mới

Mọi thứ nằm trong `night_raid_homes.layout_json` và đi qua ba endpoint đang có: `GET/PUT /api/night-raid/home`, `POST /api/night-raid/collect`. Thêm duy nhất một trường `farm` vào `GET /api/me/daily-tasks`. Không có migration.

### 4.2 File

| File | Vai trò |
|---|---|
| `js/farm-rules.js` (mới) | Bảng `CROPS`, `FARM_BUILDINGS`, `FARM_PLOT = { price: 10000, size: 6, max: 3 }`; `byId`; `progress(cell, dayCount)`; `isWilted(cell, ctx)` với `ctx = { today, doneYesterday, doneToday }`; `spriteFor(cell, dayCount, ctx)` trả tên file; `farmValue(layout)`; `barracksReady(cell, dayCount)`. UMD như `night-raid-rules.js`, server import được. **Kho lính không có trần**, nên `barracksReady` không nhận `soldiers`: sẵn là `dayCount > cell.lastDay`, hết. (`SOLDIER_SANITY_CAP` trong `night-raid-rules.js` chỉ chặn dữ liệu hỏng, không phải trần chơi.) |
| `js/farm-art-manifest.js` (mới) | Danh sách mọi file hình nông trại, kèm cỡ và mô tả. Dùng bởi `spriteFor`, `sw.js`, script dựng tranh, test tồn tại. |
| `js/night-raid-rules.js` | `normalizeLayout` nhận ô nông trại (tra `FarmRules.byId`) và mảng `farms`; trại lính dùng `lastDay` thay `readyAt`, chuyển ô cũ; ruộng cũ giữ `readyAt` và `PRODUCTION_MS`; `maxOwned` của ba ruộng đổi thành `buyMax: 1`, giữ `maxOwned: 4` cho chuẩn hóa; trại lính `maxOwned: 10`. Trận đánh, `combatPower`, `homeLevel` giữ nguyên vì ô nông trại không nằm trong `DEFENSES`. |
| `js/night-raid.js` | SHOP có tab; chip chuyển khu; vẽ cây theo ngày và héo; huy hiệu "còn N ngày", "THU HOẠCH", "HÉO"; trại lính ghi "chờ nhiệm vụ" thay đếm giờ; SHOP từ chối ruộng thứ hai; nút THU HOẠCH đổi trạng thái; TRỒNG LẠI NHƯ CŨ; thanh nhiệm vụ trên đầu màn xây nhà; lớp nền khô khi héo. |
| `functions/api/_farm.js` (mới) | `dayCount(env, uid)`, `wiltCtx(env, uid, now)` đọc `daily_task_rewards` hai ngày, `farmSummary(env, uid, now)` cho trang Daily Task. |
| `functions/api/night-raid/home.js` | GET trả thêm `dayCount`, `ctx`. PUT: ô cây và trại lính trùng `uid` với ô cũ cùng loại thì giữ `day`/`lastDay`/`at` của server; ô mới đặt theo `dayCount`, `today` của server; ruộng cũ giữ `readyAt` như nay. Từ chối ruộng mới khi đã có từ 1 cùng loại. Kiểm `farms.length ≤ 3`, lưới 6×6, chỉ món nông trại. |
| `functions/api/night-raid/collect.js` | Thu cây chín tươi, ruộng cũ đến giờ như nay, lính từ trại có `dayCount > lastDay`; `uid` tùy chọn để thu một ô. Trả `dayCount`, `ctx`, và `wilted: true` khi có cây bị chặn vì héo. |
| `functions/api/me/daily-tasks.js` | Thêm `farm` khi `allow_bot`. |
| `js/daily-task.js` | Hero nhắc vườn; dải vườn; thẻ Home nhắc héo; "Xem vườn" mở màn xây nhà. |
| `scripts/build-farm-art.py` (mới) | Đọc ảnh gốc theo bản kê, cắt, thu về cỡ chuẩn, xuất WebP vào `img/farm/`. Kiểu `build-battle-scenes.py`. |
| `js/petbattle.js`, `js/petbattlebot.js` (xóa), `index.html` | Gỡ luyện tập với máy theo 3.9. |
| `index.html`, `sw.js` | Nạp `farm-rules.js` và `farm-art-manifest.js` ngay lúc mở app, **trước** `night-raid-rules.js` (file này cần `FarmRules`); hai file nhỏ dưới 10 KB nên không qua `lazy-data.js`. Precache hai file và tranh theo bản kê; bỏ `petbattlebot.js`. |
| `css/styles.css` | Tab SHOP, chip khu, lưới 6×6, lớp héo, thanh nhiệm vụ, dải vườn trên trang Daily Task. |

Không thêm mục vào `daily-task-catalog.js`: hái vườn không phải việc học, không thể giao làm nhiệm vụ.

### 4.3 Dữ liệu trong `layout_json`

```json
{
  "cells": [
    { "type": "stone-wall", "gx": 2, "gy": 5, "tier": 2 },
    { "type": "rice-field", "gx": 6, "gy": 6, "tier": 1, "uid": "p-…", "readyAt": 1757000000000 },
    { "type": "training-barracks", "gx": 0, "gy": 8, "tier": 1, "uid": "p-…", "lastDay": 12 },
    { "type": "tomato", "gx": 1, "gy": 1, "uid": "c-…", "day": 12, "at": "2026-09-04" },
    { "type": "well", "gx": 9, "gy": 9, "uid": "f-…" }
  ],
  "farms": [
    { "cells": [ { "type": "pumpkin", "gx": 0, "gy": 0, "uid": "c-…", "day": 12, "at": "2026-09-04" } ] }
  ],
  "dogLane": 2, "soldiers": 3, "gridVersion": 3, "castleCell": { "gx": 4, "gy": 1 }
}
```

- Ô cây: `type` là id trong `CROPS`, có `uid`, `day`, `at`. Ô công trình nông trại: `type` trong `FARM_BUILDINGS`, có `uid`. Ruộng cũ: `readyAt` như nay. Trại lính: `lastDay` thay `readyAt`.
- `normalizeLayout(value, opts)` với `opts = { dayCount, today }` tùy chọn: bỏ ô sai id, sai tọa độ, chồng nhau; `farms` kẹp 0..3, mỗi nông trại riêng chỉ chứa món nông trại trong 6×6; trại lính còn `readyAt` được chuyển như 3.7 khi có `opts`, thiếu `opts` thì chỉ bỏ `readyAt` và giữ `lastDay` đã có; `at` thiếu thì đặt `today` nếu có. Ô cây và công trình nông trại không nhận `lane`, `col`, `tier`. Ruộng cũ vượt `buyMax` **không** bị xóa.
- `gridVersion` lên 3 để đánh dấu bố cục đã chuyển.
- Máy bé giữ `appState.nightRaidLayout` như nay, thêm `appState.farmDayCount`, `appState.farmCtx` để vẽ khi mất mạng.

### 4.4 Mua, hái, dỡ

- **Mua** hạt, công trình nông trại, nông trại riêng, trại lính: máy bé trừ `appState.coins`, sửa `layout` cục bộ, PUT như mua công trình lâu đài. Server chuẩn hóa và giữ `day`/`lastDay`/`at` của mình cho ô mới. Không đủ xu thì không mua được, mục trong SHOP mờ. Ruộng cũ: SHOP mờ và ghi "Mỗi loại 1 cái" khi đã có; server bỏ ô ruộng mới nếu đã có cùng loại.
- **Hái**: `POST collect` với `uid` hoặc không. Server thu mọi ô sẵn: cây chín tươi, ruộng đến giờ, lính; cộng xu vào `lootable_coins` như ruộng cũ và trả số dư; máy bé nhận số dư đó. Cây chín mà héo bị bỏ qua và server trả `wilted: true`.
- **Dỡ** công trình nông trại: máy bé hoàn 50% vào ví, xóa ô, PUT. Giống thay công trình lâu đài.
- **Trồng lại như cũ**: máy bé lặp lại bước mua cho từng ô vừa hái trong một PUT.
- Không có gì mới về tiền: hai đường có sẵn là chi ở máy bé và thu qua `collect.js`.

### 4.5 Cờ và mất mạng

- Server: `home.js` và `collect.js` đã kiểm `nightRaidEnabled`. `farm` trong `/api/me/daily-tasks` chỉ có khi cờ bật.
- Máy bé: cả khu Cướp Đêm đã theo `appState.allowBot`. Dải vườn trên trang Daily Task và dòng ở khoảnh khắc thưởng chỉ hiện khi có cờ.
- Mất mạng: vẽ từ bản sao với `farmDayCount`, `farmCtx` đã lưu; mua và hái tắt, ghi "Cần mạng để trồng và hái". `localCollect` dự phòng tuân cùng luật qua `barracksReady`, `readyAt` và `ctx` đã lưu, giống hiện nay.

## 5. Màn hình

### 5.1 Màn xây nhà

Thay đổi trên màn đang có, không có màn mới:

1. **Thanh nhiệm vụ hôm nay** trên đầu, dưới HUD: "Hôm nay 2/3 nhiệm vụ · xong hết là cây lớn thêm 1 ngày" và nút **Vào học** mở trang Daily Task. Trạng thái: chưa có nhiệm vụ; đang làm; đang héo ("Cây đang héo. Làm xong hôm nay là tươi lại"); xong hôm nay ("Cây đã lớn hôm nay, mai tiếp").
2. **Chip chuyển khu** LÂU ĐÀI · NÔNG TRẠI 1 · NÔNG TRẠI 2 · NÔNG TRẠI 3, chỉ hiện khi có nông trại riêng. Nông trại riêng dùng cùng khung hàng rào, lưới 6×6, không lâu đài, không HUD sức mạnh.
3. **Bàn cờ**: cây đúng hình theo ngày và héo, nhãn "còn N ngày"; ruộng cũ đếm giờ như nay; trại lính ghi "chờ nhiệm vụ" hoặc "NHẬN LÍNH"; công trình nông trại. Chạm cây chín tươi để hái riêng; chạm cây héo hiện lý do và nút Vào học.
4. **THU HOẠCH** như 3.8, kèm **TRỒNG LẠI NHƯ CŨ** sau khi hái.
5. **SHOP** có bốn tab: **Phòng thủ** (như nay, gồm ruộng cũ và trại lính), **Hạt giống**, **Nông trại**, **Mở rộng** (Nông trại riêng 10.000, ghi "đã có 1/3"). Tab Phòng thủ ẩn khi đang ở nông trại riêng. Mục không đủ xu mờ đi; ruộng đã có mờ và ghi "Mỗi loại 1 cái". Kéo và chạm như nay.
6. **Bảng tên**: cấp nhà như nay, thêm giá trị nông trại.
7. Cả khu héo thì nền đất ngả màu khô, có lớp phủ nhẹ; hình cây héo là hình riêng, không chỉ là lọc màu.

### 5.2 Trang Daily Task

Mục tiêu: bé nhìn một lần là hiểu "xong hết nhiệm vụ thì cây lớn, bỏ thì cây héo". Chỉ áp dụng khi `appState.allowBot`; không có cờ thì trang giữ như hiện nay.

- **Hero**: câu phụ thêm vườn. Chưa xong: "Xong hết là +200 xu, 1 món quà, và cây lớn thêm 1 ngày 🌱". Xong: "+200 xu đã vào túi. Cây đã lớn hôm nay 🌼". Đang héo và chưa xong: "Cây đang héo 🥀. Xong hết nhiệm vụ là cây tươi lại".
- **Dải vườn** ngay dưới hero, trước danh sách nhiệm vụ: một hình cây lấy từ chính vườn của bé, ưu tiên cây sắp chín nhất, vẽ đúng trạng thái tươi hay héo; một câu: "Vườn của con: 3 cây đang lớn, 1 cây chín" hoặc "5 cây đang héo"; nút **Xem vườn** mở màn xây nhà. Bé chưa trồng gì: "Vườn đang trống. Xong nhiệm vụ rồi ghé SHOP mua hạt nhé".
- **Khoảnh khắc thưởng** (`justRewarded`): thêm dòng "Cây lớn thêm 1 ngày · N cây chín · M lính mới" và nút **Đi hái** nếu có gì để thu. Đang héo mà xong thì dòng đầu là "Cây tươi lại rồi 🌱".
- **Thẻ Home** (`renderHomeCard`): khi đang héo, câu phụ đổi thành "Cây đang héo 🥀 · làm nhiệm vụ để cứu cây".
- Dữ liệu lấy từ `farm` trong `GET /api/me/daily-tasks`: `{ wilted, crops, ripe, growing, barracksReady, preview: { id, g, days } }`, tính từ `layout_json` và `daily_task_rewards`. Không thêm yêu cầu mạng mới.

### 5.3 Sân chó ở Arena

Sân chó vẽ cây trên khu lâu đài theo trạng thái tươi hay héo; ruộng cũ và trại lính như nay. Không vẽ nông trại riêng.

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
| Công trình nông trại | 8 |
| Biểu tượng SHOP cho Nông trại riêng, lớp nền khô khi héo | 2 |

Tổng **48 hình**. Ruộng cũ, ao cá, trại lính dùng hình đang có. Nông trại riêng dùng lại khung hàng rào đang có. Tách thành bước riêng trong kế hoạch, làm trước phần màn hình để test tồn tại xanh sớm.

## 7. Kiểm thử

Chạy bằng Node 22, `npm test`, hàng đợi tự nhận `tests/*.test.js`, mỗi file kết bằng `runAll().then(code => process.exit(code))`.

- `tests/farm-rules.test.js`: `progress`, chín đúng ngày; `spriteFor` đúng file cho từng `g` và trạng thái héo; héo đúng bảng chân trị của `at`, `doneYesterday`, `doneToday`; `farmValue`; `barracksReady` theo `dayCount` (không có trần lính).
- `tests/night-raid-layout-farm.test.js`: `normalizeLayout` nhận ô cây và công trình nông trại, bỏ id lạ, chặn chồng nhau; `farms` kẹp 0..3 và 6×6, từ chối món phòng thủ và ruộng cũ trong nông trại riêng; trại lính chuyển `readyAt` sang `lastDay`; ruộng cũ giữ `readyAt`; bố cục có 4 ruộng lúa **giữ đủ 4**; trại lính lên tới 10; `homeLevel`, `combatPower`, `createState` bỏ qua ô nông trại và `farms`; bố cục cũ không đổi cấp nhà.
- `tests/money-night-raid-collect.test.js` (sửa hoặc thêm): chạy thật qua `tests/d1-mock.js` và `tests/pages-harness.js`. Cây chín tươi trả đúng xu và xóa ô; cây héo không trả, `wilted: true`, `layout_json` không đổi; ruộng cũ trả theo `readyAt` như trước; trại lính chỉ ra lính khi `dayCount > lastDay`, `lastDay` cập nhật, kho lính cộng dồn không trần; `uid` thu một ô; `dayCount` và `ctx` lấy từ `daily_task_rewards`; 403 khi không có cờ.
- `tests/night-raid-home-put.test.js` (sửa hoặc thêm): PUT không cho lùi `day`, `lastDay`; ô mới nhận `day`, `at` của server; ruộng mới bị bỏ khi đã có cùng loại, ruộng cũ dư giữ nguyên; hơn 3 nông trại riêng bị cắt; món phòng thủ trong nông trại riêng bị bỏ.
- `tests/daily-task-client.test.js` (mở rộng): hero, dải vườn, thẻ Home đúng chữ ở ba trạng thái tươi, héo, xong; ẩn khi không có cờ. `tests/night-raid-builder-farm.test.js`: SHOP bốn tab, tab Phòng thủ ẩn ở nông trại riêng, ruộng đã có mờ trong SHOP, chip khu chỉ hiện khi có nông trại riêng, nhãn "còn N ngày", THU HOẠCH đổi thành Vào học khi héo, TRỒNG LẠI NHƯ CŨ mờ khi thiếu xu, mất mạng thì mua và hái tắt.
- `tests/farm-art.test.js`: như 6.1 bước 4.
- **Bỏ chế độ bot**: xóa `tests/bot-practice.test.js`; sửa `tests/teammates.test.js`, `tests/cups.test.js`, `tests/battle-hit-logic.test.js`, `tests/castle-collision.test.js`, `tests/field-rules.test.js` chỗ đang nạp `petbattlebot.js` hoặc gọi `startBotBattle`/`finishBotBattle` (giữ phần kiểm luật bắn, bỏ phần bot); sửa `tests/night-raid-screens.test.js`, `tests/night-raid-ui.test.js`, `tests/home-yard-layout.test.js` chỗ gọi `scoutBot`/`nrScoutBot`/`makeBotTarget`; `tests/night-raid-rules.test.js` và `tests/night-raid-choreo.test.js` giữ `trainingTarget`. Thêm khẳng định: `index.html` và `sw.js` không còn nhắc `petbattlebot.js`; Arena không có nút luyện tập với máy; màn Cướp Đêm không có nút gọi `nrScoutBot`.
- `tests/verify/manifest.js`: sửa mô tả mục Cướp Đêm và Arena cho khớp sau khi gỡ bot, vì bản kê lỗi khi nêu thứ app không còn có.
- Cập nhật kiểm tra danh sách precache và `SCREEN_FILES` cho file mới.
- Thêm mục nông trại, nông trại riêng, trại lính theo ngày vào bản kê `npm run verify`.
- Không sửa bốn mốc phiên bản bằng tay; `scripts/deploy.sh` tự bump.

## 8. Ra mắt

1. Tách nhánh từ `master`.
2. Sinh và dựng tranh theo mục 6, commit tranh.
3. Không có migration. Commit theo đường dẫn rõ, rồi `scripts/deploy.sh -m "..."`. Không `git push` lên GitHub nếu người dùng chưa yêu cầu.
4. Trại lính tự chuyển đổi ở lần đọc đầu; không cần chạy tay.
5. Bật `allow_bot` cho vài bé test bằng trang admin. Giao nhiệm vụ cho các bé đó.
6. Sau vài tuần xem số liệu rồi mới bàn bản 2.

## 9. Ngoài phạm vi bản này

- Vật nuôi cho sản phẩm theo ngày nhiệm vụ, thành tựu trả xu, sang thăm vườn bạn chỉ xem, cây sự kiện theo tuần. Mọi thứ nếu làm đều tính theo ngày nhiệm vụ, không theo giờ.
- Xác minh ví ở server khi chi tiêu.
- Chuyển đường trả xu thu hoạch từ `lootable_coins` sang `coin_grants`.
- Đổi cơ chế ruộng cũ.

## 10. Quyết định đã chốt và lý do

| Quyết định | Lý do |
|---|---|
| Lớn theo ngày nhiệm vụ, không theo giờ thật | Tiêu chí 1 và 3. Cây theo giờ là móc mở app nhiều lần, ngược mục tiêu để thời gian cho bé học. |
| Một nấc mỗi ngày, không theo bài lẻ | Không thể cày bằng bài ngắn; nông trại thành lịch của những ngày làm xong việc được giao. |
| Héo khi bỏ một ngày, tươi lại khi xong; héo chặn hái nhưng không lùi tiến độ | Người dùng yêu cầu hình héo để bé buồn. Chặn hái biến nỗi buồn thành lý do đi học ngay; không lùi tiến độ để không thành hình phạt kép. |
| Mỗi ngày lớn một hình riêng | Người dùng yêu cầu thấy cây lớn từng ngày. Mỗi lần xong nhiệm vụ phải thấy khác hôm qua. |
| Trồng ngay trong khu lâu đài, không màn hình mới, mọi thứ trong SHOP | Người dùng chốt. Dùng lại toàn bộ lưới, cử chỉ, SHOP, PUT, collect; không bảng mới, không API mới. |
| Nông trại riêng là bàn cờ 6×6 cùng khung, mua trong SHOP, chuyển bằng chip | Người dùng muốn vẫn mua được nông trại riêng khi khu lâu đài không đủ. Bãi cỏ quanh hàng rào chỉ là lề của một ảnh cố định; dùng lại khung là cách rẻ nhất. 36 ô để không thành việc kéo thả hàng trăm ô mỗi ngày. |
| Ruộng cũ giữ nguyên, mua mới tối đa 1 mỗi loại; giới hạn không xóa ruộng đã có | Người dùng chốt. Xu thụ động còn tối đa 300 một ngày, nhỏ hơn thưởng nhiệm vụ. `normalizeLayout` hiện xóa ô vượt giới hạn, nên giới hạn phải đặt ở chỗ mua để không mất của bé. |
| Trại lính mua nhiều được, ra lính theo ngày nhiệm vụ, giá cũ | Người dùng chốt. Trần 10 trại vì lính tối đa 10, tránh mua thừa vô ích. |
| Xu hái cây đi qua `collect.js` như ruộng cũ | Một đường thu hoạch duy nhất cho mọi thứ trên khu đất; đường này đã được kiểm tra hành vi trong bộ test tiền. |
| Hái ra xu thẳng, không kho, không chợ, không đơn hàng | Ba hệ đó là móc quay lại và độ phức tạp, không thêm việc học nào. |
| Số xu nhỏ (hái 8 đến 120) | Bản ×10 cho hàng nghìn xu một ngày, làm 200 xu thưởng nhiệm vụ thành vô nghĩa và chạm trần ví trong hai tuần. |
| Nông trại riêng 10.000, không cần Giấy Đất | Người dùng chốt. |
| Theo cờ `allow_bot`, cờ chỉ còn nghĩa "được chơi trước" | Thử với vài bé trước khi mở rộng. |
| Gỡ cả luyện tập với máy và cướp nhà bot | Người dùng chốt: chỉ chơi với người thật; chơi với máy là thời gian không thành việc học. Cả hai đều ở máy bé nên gỡ không đụng server. |
| `dayCount` và héo đếm từ `daily_task_rewards` | Dùng lại khóa đúng-một-lần đã có; không bộ đếm mới, không race. |
| Bản kê tranh là mã, có test tồn tại | Tranh chưa `git add` từng làm khu lâu đài thiếu nền ở checkout sạch. |
| Không vào `daily-task-catalog.js` | Nông trại không phải việc học. |
