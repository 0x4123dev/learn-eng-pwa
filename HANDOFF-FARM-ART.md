# Sinh 48 tranh nông trại và deploy — bản giao việc cho Codex

Dán toàn bộ file này cho Codex. Nó tự chứa: bối cảnh, danh sách ảnh, cách sinh, cách dựng, cách kiểm, cách deploy.

---

## Bối cảnh

FlashLingo là PWA thuần JavaScript, không framework, không bước build. Bé Việt Nam dùng để học tiếng Anh và Toán. Backend là Cloudflare Pages Functions với D1.

Nhánh `feat/daily-task-farm` vừa thêm một nông trại vào khu vườn lâu đài của màn Cướp Đêm. Luật cốt lõi, do chủ sản phẩm chốt:

- Bé làm xong **hết** nhiệm vụ được giao trong ngày thì **mọi cây lớn thêm một nấc**. Không có gì lớn theo giờ. Đây là điều kiện bắt buộc: chủ sản phẩm bác bỏ việc cây lớn theo đồng hồ vì nó kéo bé mở app thay vì để thời gian cho bé học.
- Bỏ một ngày thì cây **héo**, và cây héo **không hái được** cho tới khi bé làm xong nhiệm vụ hôm nay.
- Cây chín hái ra xu, xu mua hạt, mua công trình trang trí, mua thêm nông trại riêng.

Vì cây chỉ lớn khi bé học, **mỗi ngày lớn phải có một bức tranh riêng**. Bé phải nhìn thấy cây hôm nay khác hôm qua. Đó là phần thưởng của việc học.

Toàn bộ mã, luật, test, và đường ống dựng ảnh đã xong. **Thứ duy nhất còn thiếu là 48 bức tranh thật.** Hiện tại chúng là hình tạm: khối màu phẳng có in tên file lên trên, và mọi ngày của cùng một cây là cùng một khối. Nghĩa là luật đã đúng nhưng bé chưa nhìn thấy cây lớn.

---

## Điều kiện trước khi bắt đầu

```bash
cd /Users/chuzon/go/src/learn-eng-pwa/.claude/worktrees/recursing-morse-41b36d
git branch --show-current    # phải là feat/daily-task-farm
git status --porcelain       # phải RỖNG
npm test                     # phải xanh
npm run verify               # phải xanh
```

Nếu cây làm việc chưa sạch thì **dừng lại**: một phiên khác đang sửa dở. Đợi tới khi sạch rồi mới bắt đầu. Không bao giờ `git add -A` hay `git add .` trong repo này vì nhiều phiên dùng chung.

---

## Việc 1: sinh 48 ảnh

### Lấy lời nhắc

```bash
node -e "const M=require('./js/farm-art-manifest.js');for(const f of M.FILES)console.log(f.name+' ('+f.px+'px): '+f.prompt+'\n')"
```

Lệnh này in ra 48 lời nhắc. `js/farm-art-manifest.js` là **nguồn duy nhất**: mỗi lời nhắc đã kèm sẵn một câu tả phong cách chung để 48 hình đọc ra như một bộ. Đừng tự nghĩ tên file khác, và đừng đổi cỡ.

Câu phong cách chung, để tham khảo:

> Isometric game sprite, same camera angle as a 2:1 isometric tile viewed from the front-left, soft cel shading, bright storybook palette matching a green castle garden, transparent background, no text, no ground shadow longer than the object, centered, fills 80% of the canvas.

### Quy tắc quan trọng nhất

**Mỗi cây phải sinh cả chuỗi ngày trong MỘT lần**, không sinh rời từng ảnh. Bí ngô cần 8 khung liền nhau trong đó cây ngày 5 thật sự lớn hơn ngày 4, cùng một chậu đất, cùng một góc nhìn. Sinh rời sẽ ra 8 cây khác nhau chứ không phải một cây lớn dần, và bé sẽ không thấy cây của mình lớn lên.

Thứ tự ưu tiên nếu làm dần: **bí ngô (8), hoa hồng (6), lúa (4), cà rốt (3), cà chua (2), rau cải (1)**. Cây nhiều ngày là cây bé nhìn lâu nhất.

### Danh sách 48 ảnh

Lưu dạng PNG nền trong suốt, đúng tên, vào một thư mục duy nhất.

| Nhóm | Tên file | Cỡ | Ghi chú |
|---|---|---|---|
| Mầm chung | `sprout.png`, `sprout-wilted.png` | 256 | mọi cây ngày 0 dùng chung hai hình này |
| Rau cải | `lettuce-day1.png` | 256 | ngày 1 là chín luôn |
| Cà chua | `tomato-day1.png` … `tomato-day2.png` | 256 | ngày 2 là chín |
| Cà rốt | `carrot-day1.png` … `carrot-day3.png` | 256 | ngày 3 là chín |
| Lúa | `rice-day1.png` … `rice-day4.png` | 256 | ngày 4 là chín |
| Hoa hồng | `rose-day1.png` … `rose-day6.png` | 256 | ngày 6 là chín |
| Bí ngô | `pumpkin-day1.png` … `pumpkin-day8.png` | 256 | ngày 8 là chín |
| Héo, mỗi cây 2 hình | `<cây>-wilted-young.png`, `<cây>-wilted-old.png` | 256 | 6 cây × 2 = 12 hình |
| Công trình 1 ô | `fence.png`, `fruit-tree.png`, `well.png` | 256 | |
| Công trình 2×2 | `chicken-coop.png`, `barn.png`, `windmill.png`, `cow-shed.png`, `farmhouse.png` | 512 | |
| Biểu tượng shop | `farm-plot.png` | 256 | ô đất có biển, cho tab Mở rộng |
| Nền đất khô | `dry-ground.png` | 512 | ô lát **liền mạch**, phủ lên vườn khi héo |

Tổng 48 hình: 42 ảnh 256px, 6 ảnh 512px.

### Hai điều dễ làm sai

- **Ảnh ngày cuối của mỗi cây phải là "chín rõ ràng"**: quả hoặc hoa nhiều, màu tươi, nhìn là biết hái được. Bé phải phân biệt được cây chín và cây gần chín.
- **Hai hình héo phải buồn thấy rõ**: lá rũ, ngả vàng nâu, đất nứt. Chủ sản phẩm nói thẳng là muốn bé thấy buồn khi bỏ ngày học. `wilted-young` là cây còn nhỏ, `wilted-old` là cây đã lớn.
- `dry-ground.png` phải **lát liền mạch**, vì nó được lặp lại làm nền. Cạnh trái phải nối được với cạnh phải.

---

## Việc 2: dựng WebP

```bash
python3 scripts/build-farm-art.py --masters /đường/dẫn/thư-mục-ảnh
```

Script tự cắt sát viền trong suốt, thu về đúng cỡ, xuất WebP vào `img/farm/`. Thiếu ảnh nào nó in tên ảnh đó ra và **giữ nguyên hình tạm** của ảnh đó, nên làm dần từng cây được. Không sửa dòng mã nào, vì tên và cỡ không đổi.

Cần Python 3 và Pillow có hỗ trợ WebP. Máy này đã có sẵn.

---

## Việc 3: kiểm

```bash
node tests/farm-art.test.js     # mọi file trong bản kê tồn tại, được precache, không có file thừa
npm test                        # toàn bộ suite
npm run verify                  # bản kê tính năng
```

Cả ba phải xanh. `tests/farm-art.test.js` sẽ đỏ nếu thiếu file, thừa file, hoặc sai tên.

Nên xem mắt vài ảnh trước khi deploy, nhất là chuỗi bí ngô, để chắc cây thật sự lớn dần chứ không phải 8 ảnh rời.

---

## Việc 4: commit

Chỉ commit thư mục ảnh. Nêu đường dẫn tường minh.

```bash
git add img/farm
git commit -m "$(cat <<'EOF'
art(farm): real farm sprites replace the placeholders

Each crop's growth days were generated as one sequence so a plant visibly
grows from day to day — that is the whole reward for finishing a day's tasks.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Việc 5: deploy

```bash
scripts/deploy.sh -m "feat: nông trại theo ngày nhiệm vụ, tranh thật"
```

Những điều **bắt buộc** phải biết về script này:

- Nó **từ chối chạy khi cây làm việc chưa sạch**. Commit việc của mình trước.
- Nó **tự bump cả bốn mốc phiên bản**: `js/home.js` APP_VERSION, `sw.js` CACHE_NAME, `package.json`, `functions/api/version.js`. **Tuyệt đối không bump tay**, vì `tests/version-sync.test.js` sẽ đỏ ở mốc bị quên.
- Nó chạy suite, commit đúng bốn file mốc đó, dựng bundle, đẩy lên Cloudflare Pages, rồi hỏi endpoint version để xác nhận bản mới đã sống.
- Nó **không bao giờ push lên GitHub**. Chỉ commit cục bộ và Cloudflare Pages. Giữ nguyên như vậy.

Không cần chạy migration. Nhánh này không thêm bảng, không thêm route, không thêm file `.sql`.

---

## Việc 6: bật cho vài bé

Nông trại nằm sau cờ `allow_bot` của từng bé. Cờ này giờ mang nghĩa **"được chơi trước"**, không còn liên quan tới bot nữa vì cả hai chế độ chơi với máy đã bị gỡ khỏi nhánh này.

Vào trang admin, bật cờ cho vài bé test, nhãn hiển thị là **🌱 Chơi trước**. Nhớ giao nhiệm vụ hằng ngày cho chính các bé đó, vì không có nhiệm vụ thì cây không lớn được.

Ghi lại ngày bật để sau vài tuần đối chiếu.

---

## Việc không được làm

- Không `git push` lên GitHub trừ khi chủ sản phẩm nói rõ.
- Không bump phiên bản bằng tay.
- Không `git add -A` hay `git add .`.
- Không sửa `js/farm-rules.js`, `js/farm-art-manifest.js`, hay bất cứ file nào dưới `functions/`. Việc này chỉ thay ảnh.
- Không đổi tên hay cỡ ảnh. Bản kê là nguồn duy nhất, và test sẽ đỏ.
