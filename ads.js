// ============================================================
// 広告設定（Google AdSense）
//
// ・AdSenseの読み込みタグは index.html の <head> に1回だけ置いてある
//   （以前はここでも読み込んでいて二重読み込みになっていたので廃止）
// ・slot が空のあいだは広告枠を出さない（「こうこくスペース」の仮表示は
//   「未完成のサイト」と見なされ審査で不利になるため）
//
// 子ども向け配慮（コード側で対応済み）:
//   - 広告はホーム画面下部のバナー1枠のみ（任務中・なぞとき中は非表示）
//   - 非パーソナライズ広告をリクエスト（index.html の <head> で指定）
//   - 全画面広告・動画広告・ポップアップは使わない
//   - オフライン時・広告が配信されなかったときは枠ごと隠す
// AdSense管理画面側でも「子ども向けとして扱う」設定を推奨（README参照）。
// ============================================================

const AD_CONFIG = {
  enabled: true,
  client: "ca-pub-2175971581635704",  // サイト運営者ID（設定済み）
  slot: ""   // AdSense管理画面 → 広告 → 広告ユニットごと → ディスプレイ広告 で作ったスロットID（数字10桁）を入れる
};

let adPushed = false;

function adReady() {
  return AD_CONFIG.enabled && AD_CONFIG.client && AD_CONFIG.slot && navigator.onLine !== false;
}

// 初めてホーム画面が表示されたときに広告ユニットを差し込む（幅0で push するとエラーになるため）
function initAdBar() {
  const bar = document.getElementById("ad-bar");
  if (!bar || adPushed || !adReady() || bar.offsetWidth === 0) return;
  adPushed = true;

  const ins = document.createElement("ins");
  ins.className = "adsbygoogle";
  ins.style.display = "block";
  ins.style.width = "100%";
  ins.style.height = "60px";
  ins.setAttribute("data-ad-client", AD_CONFIG.client);
  ins.setAttribute("data-ad-slot", AD_CONFIG.slot);
  ins.setAttribute("data-full-width-responsive", "false");
  bar.appendChild(ins);
  try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { bar.style.display = "none"; }
}

// ホーム画面のときだけ広告バーを見せる（任務中は非表示）
function updateAdVisibility(tab) {
  const bar = document.getElementById("ad-bar");
  if (!bar) return;
  const show = adReady() && tab === "home";
  bar.style.display = show ? "" : "none";
  if (show) initAdBar();
}
