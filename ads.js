// ============================================================
// 広告設定（Google AdSense）
// ここに自分のAdSense IDを入れると、ホーム画面下に広告が表示される。
// 未設定のあいだは「こうこくスペース」のプレースホルダーを表示。
//
// 子ども向け配慮（コード側で対応済み）:
//   - 広告はホーム画面下部のバナー1枠のみ（任務中・なぞとき中は非表示）
//   - 非パーソナライズ広告をリクエスト（requestNonPersonalizedAds=1）
//   - 全画面広告・動画広告・ポップアップは使わない
// AdSense管理画面side でも「子ども向けコンテンツ」の指定を推奨。
// ============================================================

const AD_CONFIG = {
  enabled: true,
  client: "",   // 例: "ca-pub-1234567890123456"（AdSense審査合格後に入力）
  slot: ""      // 例: "1234567890"（ディスプレイ広告ユニットのスロットID）
};

let adInitialized = false;

function initAdBar() {
  const bar = document.getElementById("ad-bar");
  if (!bar || !AD_CONFIG.enabled || adInitialized) return;
  adInitialized = true;

  if (!AD_CONFIG.client || !AD_CONFIG.slot) {
    // ID未設定：プレースホルダー表示（設定するとここが実広告になる）
    bar.innerHTML = "<div class='ad-placeholder'>🪧 こうこくスペース<span>ads.js に AdSense ID を入れると表示されます</span></div>";
    return;
  }

  // 非パーソナライズ広告（子ども向け配慮）
  (window.adsbygoogle = window.adsbygoogle || []).requestNonPersonalizedAds = 1;

  const s = document.createElement("script");
  s.async = true;
  s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + AD_CONFIG.client;
  s.crossOrigin = "anonymous";
  document.head.appendChild(s);

  const ins = document.createElement("ins");
  ins.className = "adsbygoogle";
  ins.style.display = "block";
  ins.style.width = "100%";
  ins.style.height = "60px";
  ins.setAttribute("data-ad-client", AD_CONFIG.client);
  ins.setAttribute("data-ad-slot", AD_CONFIG.slot);
  ins.setAttribute("data-ad-format", "horizontal");
  ins.setAttribute("data-full-width-responsive", "false");
  bar.appendChild(ins);
  (window.adsbygoogle = window.adsbygoogle || []).push({});
}

// ホーム画面のときだけ広告バーを見せる（任務中は非表示）
function updateAdVisibility(tab) {
  const bar = document.getElementById("ad-bar");
  if (!bar) return;
  bar.style.display = (AD_CONFIG.enabled && tab === "home") ? "" : "none";
}
