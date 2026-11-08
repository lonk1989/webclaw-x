//! Component Pack（P1）：日期范围 / 下拉 / 分页 适配器脚本。
//! 优先命中 `[data-webclaw-comp=…]`（webclaw-x fixture），并回退 Element 风格 class。

/// 选择日期范围：`2026-01-01至2026-11-06` / `开始=…，结束=…`
pub const SELECT_DATE_RANGE: &str = r#"
// component-pack-v1 date-range
const raw = String(ctx.args || '').trim();
if (!raw) return { ok: false, error: '「选择日期范围」缺少参数，如：选择日期范围 2026-01-01至2026-11-06' };

function parseRange(s) {
  let m = s.match(/开始\s*[=:：]\s*([^\s，,;；到至~\-—]+)[，,;；\s]*结束\s*[=:：]\s*([^\s，,;；]+)/);
  if (m) return { start: m[1].trim(), end: m[2].trim() };
  m = s.match(/^(.+?)\s*(?:至|到|~|—|–|-)\s*(.+)$/);
  if (m) return { start: m[1].trim(), end: m[2].trim() };
  return null;
}
const range = parseRange(raw);
if (!range || !range.start || !range.end) {
  return { ok: false, error: '无法解析日期范围「' + raw + '」。示例：2026-01-01至2026-11-06 或 开始=2026-01-01，结束=2026-11-06' };
}

function visible(el) {
  if (!el) return false;
  const st = window.getComputedStyle(el);
  if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function findRoot() {
  const marked = Array.from(document.querySelectorAll('[data-webclaw-comp="date-range"]')).filter(visible);
  if (marked.length) return marked[0];
  const elish = Array.from(document.querySelectorAll(
    '.el-date-editor.el-range-editor, .el-range-editor, .el-date-editor--daterange'
  )).filter(visible);
  return elish[0] || null;
}

function findInputs(root) {
  const start = root.querySelector('[data-webclaw-role="start"]')
    || root.querySelectorAll('input')[0];
  const end = root.querySelector('[data-webclaw-role="end"]')
    || root.querySelectorAll('input')[1];
  return { start, end };
}

function setInput(el, value) {
  if (!el) return false;
  el.readOnly = false;
  el.disabled = false;
  el.focus();
  const proto = window.HTMLInputElement && window.HTMLInputElement.prototype;
  const desc = proto && Object.getOwnPropertyDescriptor(proto, 'value');
  if (desc && desc.set) desc.set.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  el.dispatchEvent(new Event('blur', { bubbles: true }));
  return true;
}

const root = findRoot();
if (!root) return { ok: false, error: '未找到日期范围组件（data-webclaw-comp=date-range 或 .el-range-editor）' };
const inputs = findInputs(root);
if (!inputs.start || !inputs.end) return { ok: false, error: '日期范围组件缺少起止输入框' };
if (!setInput(inputs.start, range.start)) return { ok: false, error: '无法写入开始日期' };
if (!setInput(inputs.end, range.end)) return { ok: false, error: '无法写入结束日期' };
return {
  ok: true,
  message: '已选择日期范围 ' + range.start + ' 至 ' + range.end,
  start: range.start,
  end: range.end,
  component: 'date-range'
};
"#;

/// 选择下拉：`状态=已完成` / `已完成`
pub const SELECT_DROPDOWN: &str = r#"
// component-pack-v1 select
const raw = String(ctx.args || '').trim();
if (!raw) return { ok: false, error: '「选择下拉」缺少参数，如：选择下拉 状态=已完成' };

function parseSelect(s) {
  const m = s.match(/^([^=:：]+)\s*[=:：]\s*(.+)$/);
  if (m) return { label: m[1].trim(), value: m[2].trim() };
  return { label: '', value: s.trim() };
}
const spec = parseSelect(raw);
if (!spec.value) return { ok: false, error: '「选择下拉」缺少选项值' };

function visible(el) {
  if (!el) return false;
  const st = window.getComputedStyle(el);
  if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function findSelectRoots() {
  const marked = Array.from(document.querySelectorAll('[data-webclaw-comp="select"]')).filter(visible);
  if (marked.length) return marked;
  return Array.from(document.querySelectorAll('.el-select')).filter(visible);
}

function rootLabel(root) {
  return (root.getAttribute('data-webclaw-label') || root.getAttribute('aria-label') || '').trim();
}

function pickRoot(roots, label) {
  if (!roots.length) return null;
  if (!label) return roots[0];
  const hit = roots.find(r => rootLabel(r).includes(label) || (r.innerText || '').includes(label));
  return hit || roots[0];
}

function openSelect(root) {
  const trigger = root.querySelector('[data-webclaw-role="trigger"]')
    || root.querySelector('.el-input__inner')
    || root.querySelector('input')
    || root;
  trigger.click();
  root.classList.add('open');
}

function listOptions(root) {
  const panel = root.querySelector('[data-webclaw-role="dropdown"]')
    || root.querySelector('.el-select-dropdown')
    || document.querySelector('.el-select-dropdown:not([style*="display: none"])');
  const scope = panel || root;
  return Array.from(scope.querySelectorAll(
    '.el-select-dropdown__item, [data-value], [role="option"], li'
  )).filter(visible);
}

const roots = findSelectRoots();
if (!roots.length) return { ok: false, error: '未找到下拉组件（data-webclaw-comp=select 或 .el-select）' };
const root = pickRoot(roots, spec.label);
openSelect(root);
const options = listOptions(root);
const opt = options.find(o => {
  const t = (o.getAttribute('data-value') || o.textContent || '').trim();
  return t === spec.value || t.includes(spec.value);
});
if (!opt) {
  return {
    ok: false,
    error: '未找到下拉选项「' + spec.value + '」',
    candidateCount: options.length,
    candidates: options.slice(0, 8).map(o => (o.getAttribute('data-value') || o.textContent || '').trim())
  };
}
opt.click();
return {
  ok: true,
  message: '已选择下拉' + (spec.label ? (' ' + spec.label + '=') : ' ') + spec.value,
  value: spec.value,
  label: spec.label || rootLabel(root),
  component: 'select'
};
"#;

/// 翻页 / 翻到：`下一页` / `上一页` / `第2页` / `2`
pub const PAGER: &str = r#"
// component-pack-v1 pager
const raw = String(ctx.args || '').trim();
if (!raw) return { ok: false, error: '「翻页/翻到」缺少参数，如：翻页下一页、翻到第2页' };

function visible(el) {
  if (!el) return false;
  const st = window.getComputedStyle(el);
  if (st.display === 'none' || st.visibility === 'hidden' || Number(st.opacity) === 0) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
}

function findPager() {
  const marked = Array.from(document.querySelectorAll('[data-webclaw-comp="pager"]')).filter(visible);
  if (marked.length) return marked[0];
  const elish = Array.from(document.querySelectorAll('.el-pagination')).filter(visible);
  return elish[0] || null;
}

const pager = findPager();
if (!pager) return { ok: false, error: '未找到分页组件（data-webclaw-comp=pager 或 .el-pagination）' };

let action = '';
let pageNum = 0;
if (/^(下一页|下页|next)$/i.test(raw)) action = 'next';
else if (/^(上一页|上页|prev|previous)$/i.test(raw)) action = 'prev';
else {
  const m = raw.match(/第?\s*(\d+)\s*页?/);
  if (m) { action = 'goto'; pageNum = parseInt(m[1], 10); }
}
if (!action) return { ok: false, error: '无法解析翻页参数「' + raw + '」。支持：下一页、上一页、第2页、2' };

let target = null;
if (action === 'next') {
  target = pager.querySelector('[data-webclaw-role="next"], .btn-next, button.btn-next');
  if (!target) {
    const buttons = Array.from(pager.querySelectorAll('button')).filter(visible);
    target = buttons.find(b => /下一页|下页|›|»|next/i.test((b.textContent || '').trim()));
  }
} else if (action === 'prev') {
  target = pager.querySelector('[data-webclaw-role="prev"], .btn-prev, button.btn-prev');
  if (!target) {
    const buttons = Array.from(pager.querySelectorAll('button')).filter(visible);
    target = buttons.find(b => /上一页|上页|‹|«|prev/i.test((b.textContent || '').trim()));
  }
} else {
  const nums = Array.from(pager.querySelectorAll('.number, [data-page], button, li')).filter(visible);
  target = nums.find(el => {
    const dp = el.getAttribute('data-page');
    if (dp && parseInt(dp, 10) === pageNum) return true;
    return (el.textContent || '').trim() === String(pageNum);
  });
}

if (!target) {
  return { ok: false, error: '未找到翻页控件「' + raw + '」', action, pageNum };
}
target.click();
return {
  ok: true,
  message: action === 'goto' ? ('已翻到第' + pageNum + '页') : ('已翻页' + raw),
  action,
  page: pageNum || null,
  component: 'pager'
};
"#;
