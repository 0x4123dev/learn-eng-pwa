#!/usr/bin/env node
'use strict';

/**
 * gen-math4-t4.js — Toán 4 · dạng 4: Giải toán có lời văn.
 *
 * Mỗi câu là một bài toán "rút về đơn vị" hoặc "tìm tỉ số", đúng dạng câu 4 của
 * đề thật: một lượng đã biết được chia đều, rồi hỏi về một lượng khác.
 *
 *   Cô Lan nhận về 6 kg mì chính và chia đều vào 3 bao.
 *   Hỏi với 20 kg mì chính, cô Lan chia được vào mấy bao như thế?
 *
 * Sinh cố định (fixed seed), không phụ thuộc gói ngoài, ghi
 * data/math4/math4-t4.json với đúng 100 câu.
 *
 * Số học được TÍNH, không gõ tay. `expr` là cùng phép tính đó dưới dạng ASCII
 * để build-math4-data.js kiểm lại bằng bộ tính của riêng nó.
 */

const fs = require('node:fs');
const path = require('node:path');

/* ------------------------------------------------------------------ *
 * RNG cố định
 * ------------------------------------------------------------------ */

const SEED = 40404;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(SEED);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i];
    a[i] = a[j];
    a[j] = t;
  }
  return a;
}

/* ------------------------------------------------------------------ *
 * Tiện ích chữ nghĩa
 * ------------------------------------------------------------------ */

const words = (...parts) =>
  parts.filter((p) => p !== undefined && p !== null && String(p).trim() !== '')
    .map(String)
    .join(' ');

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const tidy = (s) => s.replace(/\s+/g, ' ').replace(/ ([,.?])/g, '$1').trim();

/** "kg" đọc thành "ki-lô-gam" khi đứng sau "bao nhiêu" / "số". */
const unitWordOf = (unit) => (unit === 'kg' ? 'ki-lô-gam' : unit);

const NAMES = [
  'cô Lan', 'bác Hùng', 'chú Ba', 'chị Mai', 'anh Tuấn', 'bà Tư',
  'thầy Nam', 'cô Thoa', 'bác Sáu', 'chị Hoa', 'anh Dũng', 'cô Hạnh',
  'bác Thắng', 'chú Tám', 'chị Loan', 'bà Năm', 'anh Kiên', 'cô Nhung',
  'bác Bảy', 'chị Thu', 'chú Hải', 'cô Yến', 'anh Bình', 'bác Long',
  'chị Đào', 'thầy Sơn', 'bà Hiền', 'chú Quý',
];

/* Số phần đẹp, dùng cho lượng hỏi thêm (số bao / số ngày / số chuyến …). */
const NICE_COUNTS = [3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 24, 25, 28, 30, 35, 40];
const RATIOS = [2, 3, 4, 5];
const N_DEFAULT = [2, 3, 4, 5, 6];

/* ------------------------------------------------------------------ *
 * Bối cảnh — 33 cái, đủ để 100 câu không đọc như một câu thay số
 * ------------------------------------------------------------------ */

const CONTEXTS = [
  /* --- hàng khô đóng bao / túi / thùng ------------------------------ */
  { key: 'gao-bao', kind: 'chua', good: 'gạo', unit: 'kg', cont: 'bao',
    scene: 'Ở kho nhà {name}', verb: 'đóng', prep: 'vào', hold: 'đựng',
    fitVerb: 'đóng được', u: [10, 20, 25, 50], n: [2, 3, 4, 5, 6, 8],
    maxAmount: 2000, maxCount: 30 },

  { key: 'duong-tui', kind: 'chua', good: 'đường', unit: 'kg', cont: 'túi',
    scene: 'Ở cửa hàng của {name}', verb: 'đóng', prep: 'vào', hold: 'đựng',
    fitVerb: 'đóng được', u: [2, 3, 5], maxAmount: 300, maxCount: 40 },

  { key: 'muoi-bao', kind: 'chua', good: 'muối', unit: 'kg', cont: 'bao',
    scene: 'Ở kho muối của {name}', verb: 'đóng', prep: 'vào', hold: 'đựng',
    fitVerb: 'đóng được', u: [10, 20, 25], maxAmount: 1500, maxCount: 30 },

  { key: 'thoc-bao', kind: 'chua', good: 'thóc', unit: 'kg', cont: 'bao',
    scene: 'Ở sân phơi nhà {name}', verb: 'đóng', prep: 'vào', hold: 'đựng',
    fitVerb: 'đóng được', u: [20, 30, 40, 50], n: [2, 3, 4, 5, 6, 8],
    maxAmount: 2500, maxCount: 30 },

  { key: 'ximang-bao', kind: 'chua', good: 'xi măng', unit: 'kg', cont: 'bao',
    scene: 'Ở công trường của {name}', verb: 'đóng', prep: 'vào', hold: 'đựng',
    fitVerb: 'đóng được', u: [40, 50], maxAmount: 3000, maxCount: 40 },

  { key: 'phandam-bao', kind: 'chua', good: 'phân đạm', unit: 'kg', cont: 'bao',
    scene: 'Ở hợp tác xã của {name}', verb: 'đóng', prep: 'vào', hold: 'đựng',
    fitVerb: 'đóng được', u: [10, 20, 25, 50], maxAmount: 2000, maxCount: 30 },

  { key: 'michinh-bao', kind: 'chua', good: 'mì chính', unit: 'kg', cont: 'bao',
    scene: 'Ở quầy hàng của {name}', verb: 'chia', prep: 'vào', hold: 'đựng',
    fitVerb: 'chia được vào', u: [2, 3, 5], maxAmount: 200, maxCount: 30 },

  { key: 'botmi-tui', kind: 'chua', good: 'bột mì', unit: 'kg', cont: 'túi',
    scene: 'Ở kho bột nhà {name}', verb: 'đóng', prep: 'vào', hold: 'đựng',
    fitVerb: 'đóng được', u: [2, 5], maxAmount: 250, maxCount: 40 },

  { key: 'caphe-tui', kind: 'chua', good: 'cà phê', unit: 'kg', cont: 'túi',
    scene: 'Ở xưởng rang cà phê của {name}', verb: 'đóng', prep: 'vào',
    hold: 'đựng', fitVerb: 'đóng được', u: [2, 5], maxAmount: 250, maxCount: 40 },

  { key: 'lac-bao', kind: 'chua', good: 'lạc', unit: 'kg', cont: 'bao',
    scene: 'Ở kho nông sản của {name}', verb: 'đóng', prep: 'vào', hold: 'đựng',
    fitVerb: 'đóng được', u: [10, 20, 25], maxAmount: 1200, maxCount: 30 },

  { key: 'ngo-bao', kind: 'chua', good: 'ngô', unit: 'kg', cont: 'bao',
    scene: 'Ở nhà kho của {name}', verb: 'đóng', prep: 'vào', hold: 'đựng',
    fitVerb: 'đóng được', u: [20, 25, 30, 50], maxAmount: 2000, maxCount: 30 },

  { key: 'tao-thung', kind: 'chua', good: 'táo', unit: 'kg', cont: 'thùng',
    scene: 'Ở vườn táo của {name}', verb: 'xếp', prep: 'vào', hold: 'đựng',
    fitVerb: 'xếp được vào', u: [5, 10, 12], maxAmount: 600, maxCount: 30 },

  { key: 'cam-gio', kind: 'chua', good: 'cam', unit: 'kg', cont: 'giỏ',
    scene: 'Ở vườn cam của {name}', verb: 'xếp', prep: 'vào', hold: 'đựng',
    fitVerb: 'xếp được vào', u: [3, 5, 6], maxAmount: 400, maxCount: 30 },

  /* --- chất lỏng ---------------------------------------------------- */
  { key: 'son-thung', kind: 'chua', good: 'sơn', unit: 'lít', cont: 'thùng',
    scene: 'Ở xưởng của {name}', verb: 'rót', prep: 'vào', hold: 'chứa',
    fitVerb: 'rót đầy được', u: [5, 10], maxAmount: 400, maxCount: 30 },

  { key: 'dauan-can', kind: 'chua', good: 'dầu ăn', unit: 'lít', cont: 'can',
    scene: 'Ở kho hàng của {name}', verb: 'rót', prep: 'vào', hold: 'chứa',
    fitVerb: 'rót đầy được', u: [2, 5, 10], maxAmount: 500, maxCount: 30 },

  { key: 'sua-thung', kind: 'chua', good: 'sữa tươi', unit: 'lít', cont: 'thùng',
    scene: 'Ở trạm thu sữa của {name}', verb: 'chia', prep: 'vào', hold: 'chứa',
    fitVerb: 'chia được vào', u: [6, 12], maxAmount: 500, maxCount: 30 },

  { key: 'nuocmam-chai', kind: 'chua', good: 'nước mắm', unit: 'lít', cont: 'chai',
    scene: 'Ở cơ sở nước mắm của {name}', verb: 'rót', prep: 'vào', hold: 'chứa',
    fitVerb: 'rót đầy được', u: [2], n: [2, 3, 4, 5, 6, 8], maxAmount: 120,
    maxCount: 40 },

  { key: 'matong-lo', kind: 'chua', good: 'mật ong', unit: 'lít', cont: 'lọ',
    scene: 'Ở trại ong của {name}', verb: 'rót', prep: 'vào', hold: 'chứa',
    fitVerb: 'rót đầy được', u: [2], n: [2, 3, 4, 5, 6, 8], maxAmount: 120,
    maxCount: 40 },

  { key: 'nuoc-binh', kind: 'chua', good: 'nước lọc', unit: 'lít', cont: 'bình',
    scene: 'Ở nhà máy nước của {name}', verb: 'rót', prep: 'vào', hold: 'chứa',
    fitVerb: 'rót đầy được', u: [5, 10, 20], maxAmount: 600, maxCount: 30 },

  /* --- đồ đếm được -------------------------------------------------- */
  { key: 'vo-tui', kind: 'chua', good: 'vở', unit: 'quyển', cont: 'túi',
    scene: 'Ở lớp của {name}', verb: 'xếp', prep: 'vào', hold: 'có',
    fitVerb: 'xếp được vào', u: [6, 10, 12, 20], n: [2, 3, 4, 5, 6, 8],
    maxAmount: 600, maxCount: 30 },

  { key: 'sach-thung', kind: 'chua', good: 'sách', unit: 'quyển', cont: 'thùng',
    scene: 'Ở thư viện của {name}', verb: 'xếp', prep: 'vào', hold: 'có',
    fitVerb: 'xếp được vào', u: [20, 25, 30, 40], maxAmount: 1500, maxCount: 30 },

  { key: 'but-hop', kind: 'chua', good: 'bút', unit: 'chiếc', amountLabelWord: 'bút',
    cont: 'hộp', scene: 'Ở cửa hàng văn phòng phẩm của {name}', verb: 'xếp',
    prep: 'vào', hold: 'có', fitVerb: 'xếp được vào', u: [10, 12, 20],
    maxAmount: 800, maxCount: 30 },

  { key: 'banh-hop', kind: 'chua', good: 'bánh', unit: 'cái', amountLabelWord: 'bánh',
    cont: 'hộp', scene: 'Ở tiệm bánh của {name}', verb: 'xếp', prep: 'vào',
    hold: 'có', fitVerb: 'xếp được vào', u: [6, 8, 10, 12], maxAmount: 500,
    maxCount: 30 },

  { key: 'trung-khay', kind: 'chua', good: 'trứng', unit: 'quả', amountLabelWord: 'trứng',
    cont: 'khay', scene: 'Ở trại gà của {name}', verb: 'xếp', prep: 'vào',
    hold: 'có', fitVerb: 'xếp được vào', u: [10, 12, 30], n: [2, 3, 4, 5, 6, 8],
    maxAmount: 900, maxCount: 30 },

  { key: 'bapcai-luong', kind: 'chua', good: 'bắp cải', unit: 'cây', cont: 'luống',
    scene: 'Trên mảnh vườn của {name}', verb: 'trồng', prep: 'thành', hold: 'có',
    fitVerb: 'trồng được', u: [20, 25, 30], maxAmount: 900, maxCount: 30 },

  { key: 'gach-xe', kind: 'chua', good: 'gạch', unit: 'viên', cont: 'xe',
    scene: 'Ở công trường nhà {name}', verb: 'xếp', prep: 'lên', hold: 'chở',
    fitVerb: 'xếp được lên', u: [100, 150, 200, 250], maxAmount: 5000, maxCount: 20 },

  { key: 'ghe-phong', kind: 'chua', good: 'ghế', unit: 'chiếc', amountLabelWord: 'ghế',
    cont: 'phòng học', contShort: 'phòng', scene: 'Ở trường của {name}', verb: 'kê',
    prep: 'vào', hold: 'có', fitVerb: 'kê đủ cho', u: [20, 25, 30],
    maxAmount: 900, maxCount: 30 },

  /* --- xe và chuyến -------------------------------------------------- */
  { key: 'hang-chuyen', kind: 'cho', good: 'hàng', unit: 'tấn', cont: 'chuyến',
    scene: 'Ở bến xe của {name}', u: [3, 4, 5, 8], maxAmount: 200, maxCount: 25 },

  { key: 'cat-chuyen', kind: 'cho', good: 'cát', unit: 'tấn', cont: 'chuyến',
    scene: 'Ở bãi cát của {name}', u: [2, 3, 4, 6], maxAmount: 150, maxCount: 25 },

  /* --- ngày công ----------------------------------------------------- */
  { key: 'sanpham-ngay', kind: 'lam', team: 'tổ công nhân của {name}',
    teamShort: 'tổ đó', wverb: 'làm được', good: 'sản phẩm', unit: '', cont: 'ngày',
    u: [20, 25, 30, 40, 50], maxAmount: 1500, maxCount: 24 },

  { key: 'ao-ngay', kind: 'lam', team: 'xưởng may của {name}',
    teamShort: 'xưởng đó', wverb: 'may được',
    good: 'chiếc áo', unit: '', amountTag: 'chiếc áo', amountLabelWord: 'áo',
    cont: 'ngày', u: [40, 50, 60], maxAmount: 1500, maxCount: 24 },

  { key: 'muong-ngay', kind: 'lam', team: 'đội thủy lợi của {name}',
    teamShort: 'đội đó', wverb: 'đào được', good: 'mét mương', unit: '', amountTag: 'mét',
    amountLabelWord: 'mét', cont: 'ngày', u: [20, 25, 30], maxAmount: 900,
    maxCount: 24 },

  /* --- máy bơm và giờ ------------------------------------------------ */
  { key: 'be-gio', kind: 'bom', good: '', unit: 'giờ', cont: 'bể nước',
    contShort: 'bể', scene: 'Ở trại của {name}', u: [2, 3, 4], n: [2, 3, 4, 5],
    maxAmount: 60, maxCount: 15 },
];

for (const c of CONTEXTS) {
  c.n = c.n || N_DEFAULT;
  c.contShort = c.contShort || c.cont;
  c.amountTag = c.amountTag || c.unit || c.good;
  c.amountLabelWord = c.amountLabelWord || c.amountTag;
  c.unitWord = unitWordOf(c.unit);
}

/* ------------------------------------------------------------------ *
 * Câu chữ theo từng nhóm bối cảnh
 * ------------------------------------------------------------------ */

const BUNDLES = {
  /* Hàng hoá chia đều vào vật chứa. */
  chua: {
    base: [
      (v) => `${cap(v.name)} ${v.verb} đều ${v.qty(v.A)} ${v.prep} ${v.n} ${v.cont}.`,
      (v) => `${cap(v.name)} có ${v.qty(v.A)} và ${v.verb} đều ${v.prep} ${v.n} ${v.cont}.`,
      (v) => `${v.scene}, ${v.qty(v.A)} được ${v.verb} đều ${v.prep} ${v.n} ${v.cont}.`,
      (v) => `${cap(v.name)} nhận về ${v.qty(v.A)} rồi chia đều ${v.prep} ${v.n} ${v.cont}.`,
    ],
    askCount: [
      (v) => `Hỏi với ${v.qty(v.B)}, ${v.name} ${v.fitVerb} bao nhiêu ${v.cont} như thế?`,
      (v) => `Hỏi ${v.qty(v.B)} thì ${v.fitVerb} mấy ${v.cont} như thế?`,
      (v) => `Hỏi muốn ${v.verb} hết ${v.qty(v.B)} thì cần bao nhiêu ${v.cont} như thế?`,
      (v) => `Hỏi ${v.qty(v.B)} thì ${v.name} ${v.fitVerb} bao nhiêu ${v.cont} như thế?`,
    ],
    askAmount: [
      (v) => `Hỏi ${v.m} ${v.cont} như thế ${v.hold} bao nhiêu ${v.unitWord} ${v.good}?`,
      (v) => `Hỏi với ${v.m} ${v.cont} như thế, ${v.name} ${v.verb} được bao nhiêu ${v.unitWord} ${v.good}?`,
      (v) => `Hỏi ${v.m} ${v.cont} như thế có tất cả bao nhiêu ${v.unitWord} ${v.good}?`,
      (v) => `Hỏi ${v.name} cần bao nhiêu ${v.unitWord} ${v.good} để ${v.verb} đủ ${v.m} ${v.cont} như thế?`,
    ],
    capUnit: (v) => `Mỗi ${v.cont} ${v.hold} số ${v.unitWord} ${v.good} là:`,
    capCount: (v) => `${v.qty(v.B)} ${v.fitVerb} số ${v.cont} là:`,
    capAmount: (v) => `${v.m} ${v.cont} như thế ${v.hold} số ${v.unitWord} ${v.good} là:`,
  },

  /* Xe chở hàng theo chuyến. */
  cho: {
    base: [
      (v) => `Xe tải của ${v.name} chở hết ${v.qty(v.A)} trong ${v.n} chuyến, mỗi chuyến chở như nhau.`,
      (v) => `${cap(v.name)} lái xe chở ${v.qty(v.A)}, chia đều thành ${v.n} chuyến.`,
      (v) => `${v.scene}, một chiếc xe chở hết ${v.qty(v.A)} trong ${v.n} chuyến như nhau.`,
    ],
    askCount: [
      (v) => `Hỏi ${v.qty(v.B)} thì xe đó phải chở mấy chuyến như thế?`,
      (v) => `Hỏi muốn chở hết ${v.qty(v.B)} thì cần bao nhiêu chuyến như thế?`,
      (v) => `Hỏi với ${v.qty(v.B)}, xe đó phải chở bao nhiêu chuyến như thế?`,
    ],
    askAmount: [
      (v) => `Hỏi ${v.m} chuyến như thế xe đó chở được bao nhiêu ${v.unitWord} ${v.good}?`,
      (v) => `Hỏi trong ${v.m} chuyến như thế, xe đó chở được tất cả bao nhiêu ${v.unitWord} ${v.good}?`,
      (v) => `Hỏi ${v.name} chở ${v.m} chuyến như thế thì được bao nhiêu ${v.unitWord} ${v.good}?`,
    ],
    capUnit: (v) => `Mỗi chuyến xe chở số ${v.unitWord} ${v.good} là:`,
    capCount: (v) => `Chở hết ${v.qty(v.B)} cần số chuyến là:`,
    capAmount: (v) => `${v.m} chuyến như thế chở số ${v.unitWord} ${v.good} là:`,
  },

  /* Công việc làm trong nhiều ngày. */
  lam: {
    base: [
      (v) => `${cap(v.team)} ${v.wverb} ${v.qty(v.A)} trong ${v.n} ${v.cont}.`,
      (v) => `Trong ${v.n} ${v.cont}, ${v.team} ${v.wverb} ${v.qty(v.A)}, mỗi ${v.cont} như nhau.`,
      (v) => `${cap(v.team)} ${v.wverb} ${v.qty(v.A)} sau ${v.n} ${v.cont} làm việc đều nhau.`,
    ],
    askCount: [
      (v) => `Hỏi để ${v.wverb} ${v.qty(v.B)} thì ${v.teamShort} cần bao nhiêu ${v.cont}?`,
      (v) => `Hỏi ${v.teamShort} phải làm bao nhiêu ${v.cont} mới ${v.wverb} ${v.qty(v.B)}?`,
      (v) => `Hỏi muốn ${v.wverb} ${v.qty(v.B)} thì cần mấy ${v.cont} như thế?`,
    ],
    askAmount: [
      (v) => `Hỏi trong ${v.m} ${v.cont}, ${v.teamShort} ${v.wverb} bao nhiêu ${v.good}?`,
      (v) => `Hỏi với ${v.m} ${v.cont} như thế, ${v.teamShort} ${v.wverb} tất cả bao nhiêu ${v.good}?`,
      (v) => `Hỏi ${v.m} ${v.cont} như thế thì ${v.teamShort} ${v.wverb} bao nhiêu ${v.good}?`,
    ],
    capUnit: (v) => `Mỗi ${v.cont} ${v.teamShort} ${v.wverb} số ${v.good} là:`,
    capCount: (v) => `Để ${v.wverb} ${v.qty(v.B)} cần số ${v.cont} là:`,
    capAmount: (v) => `Trong ${v.m} ${v.cont} ${v.teamShort} ${v.wverb} số ${v.good} là:`,
  },

  /* Máy bơm: mỗi bể hết mấy giờ. */
  bom: {
    base: [
      (v) => `Máy bơm của ${v.name} bơm đầy ${v.n} ${v.cont} hết ${v.A} giờ.`,
      (v) => `${cap(v.name)} dùng máy bơm, bơm đầy ${v.n} ${v.cont} trong ${v.A} giờ.`,
      (v) => `${v.scene}, một máy bơm bơm đầy ${v.n} ${v.cont} hết ${v.A} giờ.`,
    ],
    askCount: [
      (v) => `Hỏi trong ${v.B} giờ, máy bơm đó bơm đầy được mấy ${v.cont} như thế?`,
      (v) => `Hỏi với ${v.B} giờ, máy bơm đó bơm đầy được bao nhiêu ${v.cont} như thế?`,
      (v) => `Hỏi chạy ${v.B} giờ thì máy bơm đó bơm đầy được bao nhiêu ${v.cont} như thế?`,
    ],
    askAmount: [
      (v) => `Hỏi bơm đầy ${v.m} ${v.cont} như thế thì máy bơm đó cần bao nhiêu giờ?`,
      (v) => `Hỏi muốn bơm đầy ${v.m} ${v.cont} như thế, máy bơm đó phải chạy bao nhiêu giờ?`,
      (v) => `Hỏi máy bơm đó bơm đầy ${v.m} ${v.cont} như thế hết bao nhiêu giờ?`,
    ],
    capUnit: (v) => `Máy bơm bơm đầy một ${v.contShort} hết số giờ là:`,
    capCount: (v) => `Trong ${v.B} giờ máy bơm bơm đầy được số ${v.contShort} là:`,
    capAmount: (v) => `Bơm đầy ${v.m} ${v.cont} hết số giờ là:`,
  },
};

/* ------------------------------------------------------------------ *
 * Số liệu
 * ------------------------------------------------------------------ */

const COMBOS = ['rut-count', 'rut-amount', 'ti-count', 'ti-amount'];

function buildNumbers(ctx, combo) {
  for (let tries = 0; tries < 400; tries++) {
    const u = pick(ctx.u);          // giá trị một phần
    const n = pick(ctx.n);          // số phần ban đầu
    const A = u * n;                // tổng ban đầu
    if (u < 2) continue;            // 1 phần = 1 đơn vị thì bài toán vô nghĩa
    if (A > ctx.maxAmount) continue;

    // ba số của đề phải khác nhau, nếu không đề đọc rất kỳ
    const distinct = (x) => new Set([A, n, x]).size === 3;

    if (combo === 'rut-count') {
      // Biết A cho n phần, hỏi B thì được mấy phần. B không phải bội của A
      // ⇒ bắt buộc rút về đơn vị.
      const c = pick(NICE_COUNTS);
      if (c <= n || c > ctx.maxCount || c % n === 0) continue;
      const B = u * c;
      if (B > ctx.maxAmount || !distinct(B)) continue;
      return { u, n, A, B, ans: c, expr: `${B}/(${A}/${n})` };
    }

    if (combo === 'rut-amount') {
      // Biết A cho n phần, hỏi m phần được bao nhiêu. m không phải bội của n.
      const m = pick(NICE_COUNTS);
      if (m <= n || m > ctx.maxCount || m % n === 0) continue;
      const tot = u * m;
      if (tot > ctx.maxAmount || !distinct(m)) continue;
      return { u, n, A, m, ans: tot, expr: `${A}/${n}*${m}` };
    }

    if (combo === 'ti-count') {
      // B gấp A đúng k lần ⇒ giải bằng tỉ số.
      const k = pick(RATIOS);
      const B = A * k;
      const ans = n * k;
      if (B > ctx.maxAmount || ans > ctx.maxCount || !distinct(B)) continue;
      return { u, n, A, B, k, ans, expr: `${B}/${A}*${n}` };
    }

    // ti-amount: m phần gấp n phần đúng k lần.
    const k = pick(RATIOS);
    const m = n * k;
    const tot = A * k;
    if (m > ctx.maxCount || tot > ctx.maxAmount || !distinct(m)) continue;
    return { u, n, A, m, k, ans: tot, expr: `${m}/${n}*${A}` };
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Lời văn + bài giải
 * ------------------------------------------------------------------ */

const RULE_RUT = '🔑 Dạng rút về đơn vị: tìm giá trị của một phần trước, rồi mới trả lời câu hỏi.';
const RULE_TI = '🔑 Dạng tìm tỉ số: xem lượng mới gấp lượng đã biết mấy lần, rồi nhân lên bấy nhiêu lần.';

const WORK_RUT = [
  'Tóm tắt bài toán ra bảng nháp rồi tính. Nhớ trình bày Bài giải đầy đủ vào vở: câu lời giải, phép tính rồi đáp số.',
  'Dùng bảng nháp để tóm tắt và làm từng bước. Vào vở, em viết Bài giải đủ câu lời giải, phép tính và đáp số.',
  'Tìm giá trị của một phần ra bảng nháp trước, rồi mới trả lời. Nhớ viết Bài giải đầy đủ vào vở.',
  'Nháp ra bảng cho dễ nhìn rồi nhập kết quả. Bài giải trong vở phải có câu lời giải, phép tính và đáp số.',
];

const WORK_TI = [
  'Tóm tắt bài toán ra bảng nháp rồi tính. Nhớ trình bày Bài giải đầy đủ vào vở: câu lời giải, phép tính rồi đáp số.',
  'Xem lượng mới gấp lượng cũ mấy lần ngay trên bảng nháp, rồi nhập kết quả. Nhớ viết Bài giải đầy đủ vào vở.',
  'Dùng bảng nháp để tóm tắt và làm từng bước. Vào vở, em viết Bài giải đủ câu lời giải, phép tính và đáp số.',
  'Nháp ra bảng cho dễ nhìn rồi nhập kết quả. Bài giải trong vở phải có câu lời giải, phép tính và đáp số.',
];

function makeView(ctx, nums, name) {
  const v = Object.assign({}, ctx, nums);
  v.name = name;
  v.scene = ctx.scene ? ctx.scene.replace('{name}', name) : '';
  v.team = ctx.team ? ctx.team.replace('{name}', name) : '';
  v.qty = (x) => words(x, ctx.unit, ctx.good);
  v.short = (x) => words(x, ctx.unit || ctx.good);
  return v;
}

function buildQuestion(index, ctx, combo, nums, name) {
  const b = BUNDLES[ctx.kind];
  const v = makeView(ctx, nums, name);
  const isCount = combo === 'rut-count' || combo === 'ti-count';
  const isRut = combo === 'rut-count' || combo === 'rut-amount';

  const story = pick(b.base)(v);
  const ask = isCount ? pick(b.askCount)(v) : pick(b.askAmount)(v);
  const q = tidy(`${story} ${ask}`);

  const tag = isCount ? ctx.contShort : ctx.amountTag;
  const label = 'Số ' + (isCount ? ctx.contShort : ctx.amountLabelWord);

  const lines = [];
  if (isRut) {
    lines.push(RULE_RUT);
    lines.push('<b>Bài giải</b>');
    lines.push(tidy(b.capUnit(v)));
    lines.push(`${v.A} : ${v.n} = <b>${v.u}</b> (${ctx.amountTag})`);
    if (isCount) {
      lines.push(tidy(b.capCount(v)));
      lines.push(`${v.B} : ${v.u} = <b>${v.ans}</b> (${ctx.contShort})`);
    } else {
      lines.push(tidy(b.capAmount(v)));
      lines.push(`${v.u} × ${v.m} = <b>${v.ans}</b> (${ctx.amountTag})`);
    }
  } else {
    lines.push(RULE_TI);
    lines.push('<b>Bài giải</b>');
    if (isCount) {
      lines.push(tidy(`${v.short(v.B)} gấp ${v.short(v.A)} số lần là:`));
      lines.push(`${v.B} : ${v.A} = <b>${v.k}</b> (lần)`);
      lines.push(tidy(b.capCount(v)));
      lines.push(`${v.n} × ${v.k} = <b>${v.ans}</b> (${ctx.contShort})`);
    } else {
      lines.push(tidy(`${v.m} ${ctx.contShort} gấp ${v.n} ${ctx.contShort} số lần là:`));
      lines.push(`${v.m} : ${v.n} = <b>${v.k}</b> (lần)`);
      lines.push(tidy(b.capAmount(v)));
      lines.push(`${v.A} × ${v.k} = <b>${v.ans}</b> (${ctx.amountTag})`);
    }
  }
  lines.push(`Đáp số: <b>${v.ans}</b> ${tag}.`);

  const workNote = (isRut ? WORK_RUT : WORK_TI)[index % 4];

  return {
    id: `g4t4-${index + 1}`,
    t: 4,
    topic: 'Toán 4 · Giải toán có lời văn',
    q,
    workNote,
    keys: [],
    answerParts: [{ label, answer: String(nums.ans), expr: nums.expr }],
    explanation: tidy(lines.join('<br>')),
  };
}

/* ------------------------------------------------------------------ *
 * Sinh 100 câu
 * ------------------------------------------------------------------ */

const deck = shuffled(CONTEXTS);
const usedExpr = new Set();
const usedPair = new Set();
const usedQ = new Set();
const questions = [];

for (let i = 0; i < 100; i++) {
  const ctx = deck[i % deck.length];
  const combo = COMBOS[i % COMBOS.length];
  let built = null;

  for (let attempt = 0; attempt < 300 && !built; attempt++) {
    const nums = buildNumbers(ctx, combo);
    if (!nums) continue;
    const pair = `${ctx.key}|${nums.expr}`;
    if (usedExpr.has(nums.expr) || usedPair.has(pair)) continue;
    const question = buildQuestion(i, ctx, combo, nums, pick(NAMES));
    if (usedQ.has(question.q)) continue;
    usedExpr.add(nums.expr);
    usedPair.add(pair);
    usedQ.add(question.q);
    built = question;
  }

  if (!built) {
    throw new Error(`Không dựng được câu ${i + 1} cho bối cảnh ${ctx.key} / ${combo}`);
  }
  questions.push(built);
}

const out = {
  t: 4,
  key: 'loivan',
  title: 'Giải toán có lời văn',
  icon: '④',
  questions,
};

const dir = path.join(__dirname, '..', 'data', 'math4');
fs.mkdirSync(dir, { recursive: true });
const file = path.join(dir, 'math4-t4.json');
fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n', 'utf8');

const ctxUsed = new Set(usedPair.size ? [...usedPair].map((p) => p.split('|')[0]) : []);
const shapes = new Set(questions.map((q) => q.q.replace(/\d+/g, '#')));
console.log(
  `math4-t4: ${questions.length} câu · rút về đơn vị ${questions.filter((q) => q.explanation.includes('rút về đơn vị')).length}` +
  ` · tìm tỉ số ${questions.filter((q) => q.explanation.includes('tìm tỉ số')).length}` +
  ` · ${ctxUsed.size} bối cảnh · ${shapes.size} mẫu câu · ${path.relative(path.join(__dirname, '..'), file)}`
);
