window.__ModuleLoader__.load({
  id: "@lonk1989/webclaw",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  WEBCLAW_LIVE_ID: () => WEBCLAW_LIVE_ID,
  WEBCLAW_LIVE_KIND: () => WEBCLAW_LIVE_KIND,
  WEBCLAW_PREVIEW_ID: () => WEBCLAW_PREVIEW_ID,
  apply: () => apply,
  inject: () => inject,
  installWebclawSurfaces: () => installWebclawSurfaces,
  name: () => name
});
module.exports = __toCommonJS(index_exports);

// src/client/AccountsSettings.tsx
var import_react = require("react");
var import_jsx_runtime = require("react/jsx-runtime");
var CANDIDATE_PORTS = [19229, 19230, 19231, 19232, 19233];
async function findBase() {
  for (const port of CANDIDATE_PORTS) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 500);
      const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const j = await res.json();
      if (j.ok && j.service === "webclaw-accounts-ui") {
        return `http://127.0.0.1:${port}`;
      }
    } catch {
    }
  }
  return null;
}
function AccountsSettings({ t }) {
  const [base, setBase] = (0, import_react.useState)(void 0);
  const [rows, setRows] = (0, import_react.useState)([]);
  const [loadError, setLoadError] = (0, import_react.useState)("");
  const reload = async (apiBase) => {
    setLoadError("");
    try {
      const res = await fetch(`${apiBase}/api/accounts`);
      const data = await res.json();
      if (!data.ok) {
        setLoadError(data.error || t("loadFailed"));
        return;
      }
      setRows(
        (data.items ?? []).map((it) => ({
          ...it,
          passwordDraft: "",
          msg: "",
          err: false,
          saving: false
        }))
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : t("loadFailed"));
    }
  };
  (0, import_react.useEffect)(() => {
    let cancelled = false;
    void (async () => {
      const found = await findBase();
      if (cancelled) return;
      setBase(found);
      if (found) await reload(found);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const updateRow = (id, patch) => {
    setRows((prev) => prev.map((r) => r.id === id ? { ...r, ...patch } : r));
  };
  const saveRow = async (row) => {
    if (!base) return;
    updateRow(row.id, { saving: true, msg: t("saving"), err: false });
    try {
      const res = await fetch(`${base}/api/accounts/${encodeURIComponent(row.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: row.id,
          name: row.name,
          url: row.url,
          username: row.username,
          password: row.passwordDraft
        })
      });
      const data = await res.json();
      if (data.ok) {
        updateRow(row.id, {
          saving: false,
          msg: t("saved"),
          err: false,
          passwordDraft: "",
          has_password: Boolean(data.item?.has_password ?? row.has_password),
          username: data.item?.username ?? row.username,
          url: data.item?.url ?? row.url
        });
      } else {
        updateRow(row.id, {
          saving: false,
          msg: data.error || t("saveFailed"),
          err: true
        });
      }
    } catch (error) {
      updateRow(row.id, {
        saving: false,
        msg: error instanceof Error ? error.message : t("saveFailed"),
        err: true
      });
    }
  };
  if (base === void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { padding: 16 }, children: t("loading") });
  }
  if (base === null) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: 16, maxWidth: 560, lineHeight: 1.55, fontSize: 14 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { marginTop: 0 }, children: t("offlineTitle") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { opacity: 0.8 }, children: t("offlineHint") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "pre",
        {
          style: {
            padding: 12,
            overflow: "auto",
            fontSize: 12,
            background: "color-mix(in srgb, currentColor 6%, transparent)",
            borderRadius: 8
          },
          children: t("offlineCmd")
        }
      )
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { padding: 16, maxWidth: 640 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { marginTop: 0, opacity: 0.8, fontSize: 13, lineHeight: 1.5 }, children: t("intro") }),
    loadError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { color: "#dc2626" }, children: loadError }) : rows.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          border: "1px solid color-mix(in srgb, currentColor 14%, transparent)",
          borderRadius: 10,
          padding: "12px 14px",
          marginBottom: 12
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("strong", { children: row.name || row.id }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 12, opacity: 0.7 }, children: row.has_password ? t("hasPassword") : t("noPassword") })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: { display: "block", fontSize: 12, opacity: 0.65, marginBottom: 4 }, children: t("url") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              value: row.url,
              onChange: (e) => updateRow(row.id, { url: e.target.value }),
              style: { width: "100%", boxSizing: "border-box", marginBottom: 8, padding: "6px 8px" }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: { display: "block", fontSize: 12, opacity: 0.65, marginBottom: 4 }, children: t("username") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              value: row.username,
              autoComplete: "username",
              onChange: (e) => updateRow(row.id, { username: e.target.value }),
              style: { width: "100%", boxSizing: "border-box", marginBottom: 8, padding: "6px 8px" }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { style: { display: "block", fontSize: 12, opacity: 0.65, marginBottom: 4 }, children: t("password") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              type: "password",
              value: row.passwordDraft,
              autoComplete: "new-password",
              placeholder: t("passwordPlaceholder"),
              onChange: (e) => updateRow(row.id, { passwordDraft: e.target.value }),
              style: { width: "100%", boxSizing: "border-box", marginBottom: 8, padding: "6px 8px" }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 10, alignItems: "center" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                disabled: row.saving,
                onClick: () => void saveRow(row),
                style: {
                  padding: "6px 12px",
                  borderRadius: 6,
                  border: 0,
                  background: "#2563eb",
                  color: "#fff",
                  fontWeight: 600,
                  cursor: row.saving ? "default" : "pointer"
                },
                children: t("save")
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 12, color: row.err ? "#dc2626" : void 0 }, children: row.msg })
          ] })
        ]
      },
      row.id
    )),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { style: { fontSize: 12, opacity: 0.65 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("a", { href: base + "/", target: "_blank", rel: "noreferrer", children: t("openStandalone") }) })
  ] });
}

// src/client/accounts-locales.ts
var zh = {
  sectionLabel: "\u7F51\u7AD9\u8D26\u53F7",
  intro: "\u767B\u5F55\u5730\u5740\u4E0E\u53EF\u9009\u8D26\u53F7\u5BC6\u7801\u53EA\u4FDD\u5B58\u5728\u672C\u673A webclaw \u4FDD\u9669\u7BB1\uFF08Windows \u4E0B DPAPI\uFF0CmacOS/Linux \u4E3A\u672C\u673A\u6DF7\u6DC6\u5B58\u50A8\uFF09\u3002\u98DE\u4E66 SSO \u7B49\u53EA\u9700\u586B\u5199\u6B63\u786E\u7684\u767B\u5F55 URL\uFF08\u5982 \u2026/login?sso=lark&\u2026\uFF09\uFF0C\u5BC6\u7801\u53EF\u7559\u7A7A\u3002\u5BC6\u7801\u6846\u7559\u7A7A\u8868\u793A\u4E0D\u4FEE\u6539\u5DF2\u4FDD\u5B58\u7684\u5BC6\u7801\uFF1B\u52FF\u628A\u5BC6\u7801\u53D1\u5230\u5BF9\u8BDD\u91CC\u3002",
  loading: "\u6B63\u5728\u8FDE\u63A5\u672C\u673A\u914D\u7F6E\u670D\u52A1\u2026",
  loadFailed: "\u52A0\u8F7D\u5931\u8D25",
  url: "\u767B\u5F55\u5730\u5740",
  username: "\u8D26\u53F7",
  password: "\u5BC6\u7801",
  passwordPlaceholder: "\u7559\u7A7A = \u4FDD\u6301\u539F\u5BC6\u7801",
  save: "\u4FDD\u5B58",
  saving: "\u4FDD\u5B58\u4E2D\u2026",
  saved: "\u5DF2\u4FDD\u5B58\u5230\u672C\u673A",
  saveFailed: "\u4FDD\u5B58\u5931\u8D25",
  hasPassword: "\u5DF2\u8BBE\u5BC6\u7801",
  noPassword: "\u672A\u8BBE\u5BC6\u7801",
  openStandalone: "\u5728\u6D4F\u89C8\u5668\u4E2D\u6253\u5F00\u672C\u673A\u914D\u7F6E\u9875",
  offlineTitle: "\u672C\u673A\u8D26\u53F7\u914D\u7F6E\u670D\u52A1\u672A\u5C31\u7EEA",
  offlineHint: "\u8BF7\u786E\u8BA4 DSH \u5DF2\u52A0\u8F7D webclaw \u63D2\u4EF6\u4E14 Host \u5728\u672C\u673A\u8FD0\u884C\u3002\u4E5F\u53EF\u8FD0\u884C\u672C\u673A\u542F\u52A8\u811A\u672C\uFF08\u65E0\u9700\u628A webclaw-lite \u52A0\u5165 PATH\uFF09\uFF1A",
  offlineCmd: "Windows: %LOCALAPPDATA%\\webclaw\\bin\\webclaw-accounts.cmd\nmacOS: ~/.webclaw/bin/webclaw-accounts\n\uFF08\u9996\u6B21\u542F\u52A8 DSH / \u8C03\u7528 webclaw \u5DE5\u5177\u540E\u4F1A\u81EA\u52A8\u751F\u6210\uFF09"
};
var en = {
  sectionLabel: "Site accounts",
  intro: "Login URL and optional credentials stay in the local webclaw vault (DPAPI on Windows; obfuscated storage on macOS/Linux). Feishu SSO only needs the correct login URL (e.g. \u2026/login?sso=lark&\u2026); password may be blank. Leave password blank to keep the stored secret \u2014 never paste passwords into chat.",
  loading: "Connecting to local accounts service\u2026",
  loadFailed: "Failed to load",
  url: "Login URL",
  username: "Username",
  password: "Password",
  passwordPlaceholder: "Blank = keep existing",
  save: "Save",
  saving: "Saving\u2026",
  saved: "Saved locally",
  saveFailed: "Save failed",
  hasPassword: "Password set",
  noPassword: "No password",
  openStandalone: "Open standalone page in browser",
  offlineTitle: "Local accounts service is offline",
  offlineHint: "Make sure the webclaw plugin is loaded and the Host runs on this machine. Or open the launcher (no PATH needed):",
  offlineCmd: "Windows: %LOCALAPPDATA%\\webclaw\\bin\\webclaw-accounts.cmd\nmacOS: ~/.webclaw/bin/webclaw-accounts\n(created after DSH boot / first webclaw tool call)"
};
var ACCOUNTS_NS = "webclawAccounts";

// src/client/icons-css.ts
var WEBCLAW_ICON_CSS = `
[data-files-entry='file'][data-files-path$='.webclaw' i] svg,
[data-files-entry='file'][data-files-path$='.WEBCLAW'] svg {
  color: var(--dsw-static-deepseek-500) !important;
  --dsh-file-type-icon-color: var(--dsw-static-deepseek-500);
  --dsh-file-type-default-color: var(--dsw-static-deepseek-500);
}
[data-webclaw-preview] {
  display: flex;
  flex: 1;
  min-height: 0;
  flex-direction: column;
}
[data-webclaw-preview] > * {
  flex: 1;
  min-height: 0;
}
`;

// src/client/live-locales.ts
var zh2 = {
  title: "\u6267\u884C\u753B\u9762",
  waiting: "\u7B49\u5F85\u6267\u884C\u2026",
  offline: "\u9884\u89C8\u672A\u5C31\u7EEA",
  noImage: "\u6682\u65E0\u753B\u9762",
  placeholder: "\u7B49\u5F85\u753B\u9762\u2026",
  live: "\u5B9E\u65F6",
  scrubHint: "\u62D6\u52A8\u67E5\u770B\u8FC7\u7A0B",
  guideTitle: "webclaw \u6267\u884C\u753B\u9762",
  guideDesc: "\u65E0\u5934\u8FD0\u884C\u65F6\u5728\u6B64\u56DE\u770B\u6B65\u9AA4\u4E0E\u5B9E\u65F6\u753B\u9762",
  phaseIdle: "\u7A7A\u95F2",
  phaseRunning: "\u6267\u884C\u4E2D",
  phaseNeedHuman: "\u9700\u8981\u4EBA\u5DE5",
  phaseCancelling: "\u53D6\u6D88\u4E2D",
  phaseCancelled: "\u5DF2\u53D6\u6D88",
  phaseDone: "\u5DF2\u7ED3\u675F"
};
var en2 = {
  title: "Live run",
  waiting: "Waiting\u2026",
  offline: "Preview offline",
  noImage: "No frame yet",
  placeholder: "Waiting for frame\u2026",
  live: "Live",
  scrubHint: "Drag to review",
  guideTitle: "webclaw live",
  guideDesc: "Scrub step frames or stay on live",
  phaseIdle: "Idle",
  phaseRunning: "Running",
  phaseNeedHuman: "Needs human",
  phaseCancelling: "Cancelling",
  phaseCancelled: "Cancelled",
  phaseDone: "Done"
};
var LIVE_NS = "webclawLive";

// src/client/locales.ts
var zh3 = {
  title: "\u83DC\u8C31",
  copy: "\u590D\u5236",
  copied: "\u5DF2\u590D\u5236",
  codeBlockTitle: "\u83DC\u8C31",
  wrap: "\u6362\u884C",
  unwrap: "\u4E0D\u6362\u884C",
  paramsTitle: "\u53EF\u6539\u53C2\u6570\uFF08\u591A\u4E3A\u5360\u4F4D\uFF0C\u8BF7\u7F16\u8F91\uFF09",
  paramsHint: "\u6709 \u53C2\u6570\u2026= \u65F6\u5148\u5C55\u793A\u4E00\u5F20\u53EF\u7F16\u8F91\u8868\u8BF7\u7528\u6237\u6539\u5B8C\u518D\u8DD1\uFF1B\u52FF\u9010\u9879\u8FFD\u95EE\u3002\u4EC5\u7528\u6237\u660E\u786E\u8BF4\u300C\u7528\u9ED8\u8BA4\u300D\u624D\u53EF\u4E0D\u6539\u3002\u672C\u8F6E\u5DF2\u7ED9\u9F50\u5B57\u6BB5\u5219\u53EF\u76F4\u63A5\u8DD1\u3002"
};
var en3 = {
  title: "Recipe",
  copy: "Copy",
  copied: "Copied",
  codeBlockTitle: "Recipe",
  wrap: "Wrap",
  unwrap: "Unwrap",
  paramsTitle: "Editable params (usually placeholders)",
  paramsHint: "On run, show one editable table for the user to change values. Do not interview field-by-field;\u300Cuse defaults\u300Donly if asked."
};
var NS = "webclawPreview";

// src/client/run-tool-locales.ts
var zh4 = {
  pending: "\u6B63\u5728\u6267\u884C\u83DC\u8C31\u2026",
  waitingStart: "\u8BF7\u5148\u786E\u8BA4\u8FD0\u884C\u53C2\u6570\uFF0C\u786E\u8BA4\u540E\u5F00\u59CB\u6267\u884C",
  offline: "\u672C\u673A\u65E5\u5FD7\u670D\u52A1\u672A\u5C31\u7EEA",
  empty: "\u7B49\u5F85\u6B65\u9AA4\u65E5\u5FD7\u2026",
  placeholder: "\u7B49\u5F85\u753B\u9762\u2026",
  done: "\u6267\u884C\u7ED3\u675F",
  failed: "\u6267\u884C\u5931\u8D25",
  cancelled: "\u5DF2\u53D6\u6D88",
  needHuman: "\u9700\u8981\u4EBA\u5DE5\u786E\u8BA4"
};
var en4 = {
  pending: "Running recipe\u2026",
  waitingStart: "Confirm the run parameters first; the run starts after that",
  offline: "Local log service offline",
  empty: "Waiting for step logs\u2026",
  placeholder: "Waiting for frame\u2026",
  done: "Finished",
  failed: "Failed",
  cancelled: "Cancelled",
  needHuman: "Needs human input"
};
var RUN_TOOL_NS = "webclawRunTool";

// src/client/WebclawLive.tsx
var import_react3 = require("react");

// src/client/LivePreviewImage.tsx
var import_react2 = require("react");
var import_jsx_runtime2 = require("react/jsx-runtime");
var shellStyle = {
  width: "100%",
  height: "100%",
  minHeight: 120,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxSizing: "border-box"
};
var placeholderStyle = {
  ...shellStyle,
  flexDirection: "column",
  gap: 10,
  padding: 16,
  borderRadius: 8,
  border: "1px dashed color-mix(in srgb, currentColor 22%, transparent)",
  background: "repeating-linear-gradient(135deg, color-mix(in srgb, currentColor 5%, transparent) 0 8px, transparent 8px 16px)",
  color: "inherit",
  opacity: 0.78
};
function Placeholder({ label, maxHeight }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { ...placeholderStyle, maxHeight, minHeight: typeof maxHeight === "number" ? Math.min(120, maxHeight) : 120 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("svg", { width: "36", height: "28", viewBox: "0 0 36 28", "aria-hidden": "true", style: { opacity: 0.55 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("rect", { x: "1.5", y: "1.5", width: "33", height: "25", rx: "3", fill: "none", stroke: "currentColor", strokeWidth: "1.5" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("circle", { cx: "11", cy: "10", r: "2.5", fill: "currentColor", opacity: "0.45" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "path",
        {
          d: "M4 22 L13 12 L18 16 L24 9 L32 22 Z",
          fill: "currentColor",
          opacity: "0.28"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { fontSize: 12, fontWeight: 500 }, children: label })
  ] });
}
function LivePreviewImage({ src, alt = "", label, maxHeight, style }) {
  const [status, setStatus] = (0, import_react2.useState)(src ? "loading" : "error");
  (0, import_react2.useEffect)(() => {
    setStatus(src ? "loading" : "error");
  }, [src]);
  if (!src || status === "error") {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Placeholder, { label, maxHeight });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { ...shellStyle, position: "relative", maxHeight, ...style }, children: [
    status === "loading" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: { position: "absolute", inset: 0, pointerEvents: "none" }, children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Placeholder, { label, maxHeight }) }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
      "img",
      {
        src,
        alt,
        draggable: false,
        onLoad: () => setStatus("ok"),
        onError: () => setStatus("error"),
        style: {
          maxWidth: "100%",
          maxHeight: maxHeight ?? "100%",
          objectFit: "contain",
          display: status === "ok" ? "block" : "none"
        }
      },
      src
    )
  ] });
}

// src/client/WebclawLive.tsx
var import_jsx_runtime3 = require("react/jsx-runtime");
var CANDIDATE_PORTS2 = [19229, 19230, 19231, 19232, 19233];
async function findBase2() {
  for (const port of CANDIDATE_PORTS2) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 500);
      const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const j = await res.json();
      if (j.ok && j.service === "webclaw-accounts-ui") {
        return `http://127.0.0.1:${port}`;
      }
    } catch {
    }
  }
  return null;
}
function runDirFromNav(params) {
  if (!params || typeof params !== "object") return "";
  const p = params;
  return typeof p.runDir === "string" ? p.runDir.trim() : "";
}
function frameLabel(frame, fallback) {
  const kw = frame?.keyword?.trim();
  if (kw) return kw;
  if (typeof frame?.step === "number" && frame.step > 0) return `#${frame.step}`;
  return fallback;
}
function pngUrl(base, runDir, frameId, bust) {
  const q = new URLSearchParams({ runDir });
  if (frameId != null) q.set("frame", String(frameId));
  q.set("t", bust);
  return `${base}/api/live/png?${q.toString()}`;
}
function WebclawLive({ t, useTabInfo }) {
  const { tab } = useTabInfo();
  const navRunDir = runDirFromNav(tab.navigation?.params);
  const [base, setBase] = (0, import_react3.useState)(null);
  const [runDir, setRunDir] = (0, import_react3.useState)(navRunDir);
  const [frames, setFrames] = (0, import_react3.useState)([]);
  const [index, setIndex] = (0, import_react3.useState)(0);
  const [live, setLive] = (0, import_react3.useState)(true);
  const [imgUrl, setImgUrl] = (0, import_react3.useState)("");
  const [error, setError] = (0, import_react3.useState)("");
  const [dragging, setDragging] = (0, import_react3.useState)(false);
  const [phase, setPhase] = (0, import_react3.useState)("idle");
  const [phaseHint, setPhaseHint] = (0, import_react3.useState)("");
  const liveRef = (0, import_react3.useRef)(true);
  const draggingRef = (0, import_react3.useRef)(false);
  const indexRef = (0, import_react3.useRef)(0);
  const trackRef = (0, import_react3.useRef)(null);
  (0, import_react3.useEffect)(() => {
    liveRef.current = live;
  }, [live]);
  (0, import_react3.useEffect)(() => {
    draggingRef.current = dragging;
  }, [dragging]);
  (0, import_react3.useEffect)(() => {
    indexRef.current = index;
  }, [index]);
  const hardResetPreview = (0, import_react3.useCallback)((nextRunDir) => {
    setRunDir(nextRunDir);
    setFrames([]);
    setImgUrl("");
    setIndex(0);
    indexRef.current = 0;
    setError("");
    setLive(true);
    liveRef.current = true;
    setDragging(false);
    draggingRef.current = false;
    setPhase("idle");
    setPhaseHint("");
  }, []);
  (0, import_react3.useEffect)(() => {
    if (!navRunDir) return;
    if (navRunDir === runDir) return;
    hardResetPreview(navRunDir);
  }, [navRunDir, tab.navigation?.revision, runDir, hardResetPreview]);
  (0, import_react3.useEffect)(() => {
    let cancelled = false;
    void (async () => {
      const found = await findBase2();
      if (!cancelled) setBase(found);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const goLive = (0, import_react3.useCallback)(() => {
    setLive(true);
    liveRef.current = true;
    setFrames((prev) => {
      if (prev.length) setIndex(prev.length - 1);
      return prev;
    });
  }, []);
  const applyScrubIndex = (0, import_react3.useCallback)(
    (next, list, activeRunDir, activeBase) => {
      if (!list.length) return;
      const clamped = Math.max(0, Math.min(list.length - 1, next));
      indexRef.current = clamped;
      setIndex(clamped);
      const atEnd = clamped >= list.length - 1;
      setLive(atEnd);
      liveRef.current = atEnd;
      const b = activeBase || base;
      const rd = activeRunDir || runDir;
      const frame = list[clamped];
      if (b && rd && frame) {
        setImgUrl(pngUrl(b, rd, frame.id, String(frame.at || frame.id)));
      }
    },
    [base, runDir]
  );
  const indexFromClientX = (0, import_react3.useCallback)((clientX, listLen) => {
    const el = trackRef.current;
    if (!el || listLen <= 1) return 0;
    const rect = el.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round(ratio * (listLen - 1));
  }, []);
  const onTrackPointerDown = (0, import_react3.useCallback)(
    (e) => {
      if (!frames.length) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
      draggingRef.current = true;
      applyScrubIndex(indexFromClientX(e.clientX, frames.length), frames);
    },
    [applyScrubIndex, frames, indexFromClientX]
  );
  const onTrackPointerMove = (0, import_react3.useCallback)(
    (e) => {
      if (!draggingRef.current || !frames.length) return;
      applyScrubIndex(indexFromClientX(e.clientX, frames.length), frames);
    },
    [applyScrubIndex, frames, indexFromClientX]
  );
  const onTrackPointerUp = (0, import_react3.useCallback)((e) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
    }
    setDragging(false);
    draggingRef.current = false;
  }, []);
  (0, import_react3.useEffect)(() => {
    if (!base) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const focusRes = await fetch(`${base}/api/live/focus`, {
          cache: "no-store"
        });
        const focusJson = await focusRes.json();
        const focused = focusJson.focus?.runDir?.trim() || "";
        const active = (focused || runDir).trim();
        if (!active) {
          if (!cancelled) {
            setError("");
            setFrames([]);
            setImgUrl("");
          }
          return;
        }
        if (focused && focused !== runDir) {
          if (!cancelled) hardResetPreview(focused);
        }
        const metaRes = await fetch(
          `${base}/api/live/meta?runDir=${encodeURIComponent(active)}&t=${Date.now()}`,
          { cache: "no-store" }
        );
        const metaJson = await metaRes.json();
        if (cancelled) return;
        if (!metaJson.ok) {
          setError(metaJson.error || t("waiting"));
          return;
        }
        setError("");
        setPhase(metaJson.phase || "idle");
        setPhaseHint(typeof metaJson.hint === "string" ? metaJson.hint : "");
        const nextFrames = Array.isArray(metaJson.frames) ? metaJson.frames : [];
        setFrames(nextFrames);
        const followLive = liveRef.current && !draggingRef.current;
        let viewIndex = 0;
        if (nextFrames.length) {
          if (followLive) {
            viewIndex = nextFrames.length - 1;
            indexRef.current = viewIndex;
            setIndex(viewIndex);
            setLive(true);
          } else {
            viewIndex = Math.max(
              0,
              Math.min(indexRef.current, nextFrames.length - 1)
            );
            indexRef.current = viewIndex;
            setIndex(viewIndex);
          }
        }
        if (!metaJson.hasPng && !nextFrames.length) {
          setImgUrl("");
          return;
        }
        const frame = nextFrames[viewIndex];
        const useLiveFile = Boolean(followLive && metaJson.preferLivePreview);
        const frameId = useLiveFile ? null : frame?.id ?? null;
        const bust = String(
          followLive ? metaJson.meta?.updatedAt || metaJson.latestId || frame?.at || Date.now() : frame?.at || frame?.id || Date.now()
        );
        setImgUrl(pngUrl(base, active, frameId, bust));
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("offline"));
        }
      }
    };
    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, 500);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [base, runDir, t, hardResetPreview]);
  if (!base) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { padding: 16, fontSize: 13, opacity: 0.8 }, children: t("offline") });
  }
  if (!runDir && !frames.length && !imgUrl) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { padding: 16, fontSize: 13, opacity: 0.8 }, children: t("waiting") });
  }
  const current = frames[Math.min(index, Math.max(0, frames.length - 1))];
  const label = live ? t("live") : frameLabel(current, t("scrubHint"));
  const maxIdx = Math.max(0, frames.length - 1);
  const progress = maxIdx === 0 ? 1 : index / maxIdx;
  const phaseLabel = (() => {
    switch (phase) {
      case "running":
        return t("phaseRunning");
      case "need_human":
        return t("phaseNeedHuman");
      case "cancelling":
        return t("phaseCancelling");
      case "cancelled":
        return t("phaseCancelled");
      case "done":
        return t("phaseDone");
      default:
        return t("phaseIdle");
    }
  })();
  const phaseTone = phase === "need_human" ? { bg: "#ea580c", fg: "#9a3412" } : phase === "cancelled" || phase === "cancelling" ? { bg: "#dc2626", fg: "#991b1b" } : phase === "running" ? { bg: "#16a34a", fg: "#15803d" } : { bg: "currentColor", fg: "inherit" };
  const phaseChipStyle = {
    border: "none",
    fontSize: 12,
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 999,
    background: `color-mix(in srgb, ${phaseTone.bg} 18%, transparent)`,
    color: phaseTone.fg,
    boxShadow: `0 0 0 1px color-mix(in srgb, ${phaseTone.bg} 40%, transparent)`,
    maxWidth: 160,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap"
  };
  const chipStyle = {
    border: "none",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 999,
    transition: "background 160ms ease, color 160ms ease, box-shadow 160ms ease",
    background: live ? "color-mix(in srgb, #16a34a 22%, transparent)" : "color-mix(in srgb, currentColor 8%, transparent)",
    color: live ? "#15803d" : "inherit",
    boxShadow: live ? "0 0 0 1px color-mix(in srgb, #16a34a 45%, transparent)" : "none",
    opacity: live ? 1 : 0.75
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
    "div",
    {
      "data-webclaw-live": "",
      style: {
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        padding: 12,
        gap: 10,
        boxSizing: "border-box"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              minHeight: 28
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
                "div",
                {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    minWidth: 0,
                    flex: 1
                  },
                  children: [
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: phaseChipStyle, title: phaseHint || phaseLabel, children: phaseLabel }),
                    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                      "div",
                      {
                        style: {
                          fontSize: 13,
                          fontWeight: 600,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          opacity: live ? 0.55 : 0.9
                        },
                        title: live ? t("live") : frameLabel(current, ""),
                        children: live ? t("scrubHint") : label
                      }
                    )
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", style: chipStyle, onClick: goLive, "aria-pressed": live, children: phase === "cancelled" || phase === "done" ? phaseLabel : t("live") })
            ]
          }
        ),
        error ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { color: "#dc2626", fontSize: 12 }, children: error }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "div",
          {
            style: {
              flex: 1,
              minHeight: 160,
              borderRadius: 10,
              overflow: "hidden",
              background: "color-mix(in srgb, currentColor 6%, transparent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 8
            },
            children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(LivePreviewImage, { src: imgUrl, label: t("placeholder") })
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
          "div",
          {
            ref: trackRef,
            role: "slider",
            "aria-valuemin": 0,
            "aria-valuemax": maxIdx,
            "aria-valuenow": index,
            "aria-label": t("scrubHint"),
            tabIndex: 0,
            onPointerDown: onTrackPointerDown,
            onPointerMove: onTrackPointerMove,
            onPointerUp: onTrackPointerUp,
            onPointerCancel: onTrackPointerUp,
            onKeyDown: (e) => {
              if (!frames.length) return;
              if (e.key === "ArrowLeft") {
                e.preventDefault();
                applyScrubIndex(index - 1, frames);
              } else if (e.key === "ArrowRight") {
                e.preventDefault();
                applyScrubIndex(index + 1, frames);
              } else if (e.key === "Home") {
                e.preventDefault();
                applyScrubIndex(0, frames);
              } else if (e.key === "End") {
                e.preventDefault();
                applyScrubIndex(maxIdx, frames);
              }
            },
            style: {
              position: "relative",
              height: 28,
              display: "flex",
              alignItems: "center",
              cursor: frames.length ? "ew-resize" : "default",
              touchAction: "none",
              userSelect: "none",
              paddingTop: 2
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "div",
                {
                  style: {
                    position: "absolute",
                    left: 0,
                    right: 0,
                    height: 4,
                    borderRadius: 999,
                    background: "color-mix(in srgb, currentColor 14%, transparent)"
                  }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "div",
                {
                  style: {
                    position: "absolute",
                    left: 0,
                    width: `${Math.max(2, progress * 100)}%`,
                    height: 4,
                    borderRadius: 999,
                    background: live ? "color-mix(in srgb, #16a34a 70%, currentColor)" : "color-mix(in srgb, currentColor 45%, transparent)",
                    transition: dragging ? "none" : "width 120ms ease"
                  }
                }
              ),
              frames.length > 1 ? frames.map((f, i) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "div",
                {
                  title: frameLabel(f, ""),
                  style: {
                    position: "absolute",
                    left: `${i / maxIdx * 100}%`,
                    width: 2,
                    height: i === 0 || i === maxIdx ? 8 : 5,
                    marginLeft: -1,
                    borderRadius: 1,
                    background: i <= index ? "color-mix(in srgb, currentColor 55%, transparent)" : "color-mix(in srgb, currentColor 18%, transparent)",
                    pointerEvents: "none"
                  }
                },
                f.id
              )) : null,
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "div",
                {
                  style: {
                    position: "absolute",
                    left: `${progress * 100}%`,
                    width: 14,
                    height: 14,
                    marginLeft: -7,
                    borderRadius: "50%",
                    background: live ? "#16a34a" : "currentColor",
                    boxShadow: live ? "0 0 0 4px color-mix(in srgb, #16a34a 28%, transparent)" : "0 0 0 3px color-mix(in srgb, currentColor 12%, transparent)",
                    transition: dragging ? "none" : "left 120ms ease, background 160ms ease",
                    pointerEvents: "none"
                  }
                }
              )
            ]
          }
        )
      ]
    }
  );
}

// src/client/live-open.ts
var WEBCLAW_OPEN_LIVE_EVENT = "webclaw:open-live";
function requestOpenLive(runDir) {
  const trimmed = runDir.trim();
  if (!trimmed || typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(WEBCLAW_OPEN_LIVE_EVENT, {
      detail: { runDir: trimmed, nonce: Date.now() }
    })
  );
}

// src/client/WebclawPreview.tsx
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/params.ts
function normalizeRecipeText(content) {
  return content.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").trim();
}
function splitRecipeSteps(content) {
  const text = normalizeRecipeText(content).replace(/\n+/g, "\uFF0C");
  if (!text) return [];
  const steps = [];
  let buf = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\" && i + 1 < text.length) {
      const next = text[i + 1];
      if (next === "," || next === "\uFF0C" || next === "." || next === "\u3002") {
        buf += next;
        i++;
        continue;
      }
    }
    if (ch === "\uFF0C" || ch === ",") {
      const t = buf.trim();
      if (t) steps.push(t);
      buf = "";
      continue;
    }
    buf += ch;
  }
  const last = buf.trim();
  if (last) steps.push(last);
  return steps;
}
function extractRecipeParams(content) {
  const steps = splitRecipeSteps(content);
  const order = [];
  const map = /* @__PURE__ */ new Map();
  for (const step of steps) {
    if (step.startsWith("\u52A8\u6001\u53C2\u6570")) continue;
    if (!step.startsWith("\u53C2\u6570")) continue;
    const body = step.slice("\u53C2\u6570".length);
    const eq = body.indexOf("=");
    if (eq <= 0) continue;
    const name2 = body.slice(0, eq).trim();
    let value = body.slice(eq + 1).trim();
    value = value.replace(
      /(?<=[\u4e00-\u9fffA-Za-z0-9])(登录|打开|点击|输入|等待)[\u4e00-\u9fffA-Za-z0-9#{}={{}}\s_-]*$/u,
      ""
    ).trim();
    if (!name2 || name2.includes(".")) continue;
    if (!map.has(name2)) order.push(name2);
    map.set(name2, value);
  }
  return order.map((name2) => ({ name: name2, value: map.get(name2) ?? "" }));
}

// src/client/WebclawPreview.tsx
var import_jsx_runtime4 = require("react/jsx-runtime");
function WebclawPreview({
  content,
  wrap,
  scrollportRef,
  t
}) {
  if (content.kind !== "text") return null;
  const params = extractRecipeParams(content.text);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { "data-webclaw-preview": "", "data-wrap": wrap ? "true" : "false", children: [
    params.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
      "div",
      {
        "data-webclaw-params": "",
        style: {
          margin: "0 0 12px",
          padding: "10px 12px",
          borderBottom: "1px solid color-mix(in srgb, currentColor 12%, transparent)",
          fontSize: 13,
          lineHeight: 1.5
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { fontWeight: 600, marginBottom: 6 }, children: t("paramsTitle") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dl", { style: { margin: 0, display: "grid", gap: 4 }, children: params.map((p) => /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(
            "div",
            {
              style: { display: "grid", gridTemplateColumns: "7em 1fr", gap: 8 },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dt", { style: { opacity: 0.7, margin: 0 }, children: p.name }),
                /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("dd", { style: { margin: 0, fontFamily: "ui-monospace, monospace" }, children: p.value })
              ]
            },
            p.name
          )) }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { style: { marginTop: 8, opacity: 0.65, fontSize: 12 }, children: t("paramsHint") })
        ]
      }
    ) : null,
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      import_dsh_client_ui_primitives.CodeBlock,
      {
        contentRef: scrollportRef,
        code: content.text,
        lang: "log",
        streaming: !content.eof,
        wrap,
        lineNumbers: true,
        copyLabel: t("copy"),
        copiedLabel: t("copied"),
        toolbarLabels: {
          codeLabel: t("codeBlockTitle"),
          wrapLabel: t("wrap"),
          unwrapLabel: t("unwrap")
        }
      }
    )
  ] });
}

// src/client/WebclawRunToolview.tsx
var import_react4 = require("react");
var import_jsx_runtime5 = require("react/jsx-runtime");
var CANDIDATE_PORTS3 = [19229, 19230, 19231, 19232, 19233];
async function findBase3() {
  for (const port of CANDIDATE_PORTS3) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 400);
      const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const j = await res.json();
      if (j.ok && j.service === "webclaw-accounts-ui") {
        return `http://127.0.0.1:${port}`;
      }
    } catch {
    }
  }
  return null;
}
function textFromResult(block) {
  const parts = (block.content ?? []).filter((b) => b.type === "text" && b.text).map((b) => b.text.trim()).filter(Boolean);
  return parts.join("\n").trim();
}
function summarizeResult(text, t) {
  if (/NEED_HUMAN|needHuman|需要验证码|需要人工/i.test(text)) return t("needHuman");
  if (/cancelled|已取消|RUN_CANCELLED/i.test(text)) return t("cancelled");
  if (/webclaw_run:\s*ok\b|^ok\b/im.test(text) || /\bok\b.*run_dir/i.test(text)) {
    return t("done");
  }
  if (/webclaw_run:\s*failed|failed|error:/i.test(text)) return t("failed");
  return t("done");
}
function WebclawRunToolview({
  phase,
  block,
  t
}) {
  const [lines, setLines] = (0, import_react4.useState)([]);
  const [baseOk, setBaseOk] = (0, import_react4.useState)(true);
  const [imgUrl, setImgUrl] = (0, import_react4.useState)("");
  const [started, setStarted] = (0, import_react4.useState)(false);
  const scroller = (0, import_react4.useRef)(null);
  const openedRunDir = (0, import_react4.useRef)("");
  const pending = phase === "preparing" || phase === "start";
  (0, import_react4.useEffect)(() => {
    if (!pending) return;
    let cancelled = false;
    let base = null;
    const tick = async () => {
      if (!base) base = await findBase3();
      if (cancelled) return;
      if (!base) {
        setBaseOk(false);
        return;
      }
      setBaseOk(true);
      try {
        const [logRes, focusRes] = await Promise.all([
          fetch(`${base}/api/live/log`),
          fetch(`${base}/api/live/focus`)
        ]);
        const j = await logRes.json();
        const focusJson = await focusRes.json();
        if (!cancelled && j.ok && Array.isArray(j.lines)) {
          setLines(j.lines.slice(-60));
        }
        const runDir = j.runDir?.trim() || focusJson.focus?.runDir?.trim() || "";
        if (!cancelled) setStarted(runDir !== "");
        if (runDir && runDir !== openedRunDir.current) {
          openedRunDir.current = runDir;
          requestOpenLive(runDir);
        }
        if (!runDir) {
          if (!cancelled) setImgUrl("");
          return;
        }
        const metaRes = await fetch(
          `${base}/api/live/meta?runDir=${encodeURIComponent(runDir)}&t=${Date.now()}`,
          { cache: "no-store" }
        ).catch(() => null);
        let nextUrl = "";
        if (metaRes?.ok) {
          try {
            const metaJson = await metaRes.json();
            if (metaJson.ok && metaJson.hasPng) {
              const latest = typeof metaJson.latestId === "number" ? metaJson.latestId : null;
              const bust = metaJson.meta?.updatedAt || latest || Date.now();
              const q = new URLSearchParams({ runDir, t: String(bust) });
              if (latest != null) q.set("frame", String(latest));
              nextUrl = `${base}/api/live/png?${q.toString()}`;
            }
          } catch {
            nextUrl = "";
          }
        }
        if (!cancelled) setImgUrl(nextUrl);
      } catch {
        base = null;
        if (!cancelled) {
          setBaseOk(false);
          setImgUrl("");
        }
      }
    };
    void tick();
    const id = window.setInterval(() => {
      void tick();
    }, 700);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [pending]);
  (0, import_react4.useEffect)(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [lines]);
  (0, import_react4.useEffect)(() => {
    if (pending) return;
    const text = textFromResult(block);
    if (!text) return;
    const extracted = text.split(/\r?\n/).map((s) => s.trim()).filter((s) => s && !s.startsWith("{") && !/^recipePath:|^run_dir:|^error:$/i.test(s)).slice(-40);
    if (extracted.length > 0) setLines(extracted);
  }, [pending, block]);
  const awaitingStart = pending && !started;
  const header = awaitingStart ? t("waitingStart") : pending ? t("pending") : block.isError ? t("failed") : summarizeResult(textFromResult(block), t);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
    "div",
    {
      "data-webclaw-run-toolview": "",
      style: {
        marginTop: 6,
        borderRadius: 8,
        border: "1px solid color-mix(in srgb, currentColor 14%, transparent)",
        overflow: "hidden",
        fontSize: 12,
        lineHeight: 1.45
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(
          "div",
          {
            style: {
              padding: "8px 10px",
              fontWeight: 600,
              background: "color-mix(in srgb, currentColor 6%, transparent)",
              display: "flex",
              justifyContent: "space-between",
              gap: 8
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: header }),
              pending && !awaitingStart ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { opacity: 0.55, fontWeight: 400 }, children: baseOk ? "live" : t("offline") }) : null
            ]
          }
        ),
        awaitingStart ? null : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              style: {
                padding: "8px 10px",
                borderBottom: "1px solid color-mix(in srgb, currentColor 10%, transparent)",
                background: "color-mix(in srgb, currentColor 4%, transparent)"
              },
              children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
                LivePreviewImage,
                {
                  src: imgUrl,
                  alt: "webclaw live preview",
                  label: t("placeholder"),
                  maxHeight: 160
                }
              )
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            "div",
            {
              ref: scroller,
              style: {
                maxHeight: 220,
                overflow: "auto",
                padding: "8px 10px",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                opacity: 0.92
              },
              children: !baseOk && pending ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { opacity: 0.65 }, children: t("offline") }) : lines.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { opacity: 0.65 }, children: t("empty") }) : lines.map((line, i) => /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { children: line }, `${i}-${line.slice(0, 24)}`))
            }
          )
        ] })
      ]
    }
  );
}

// src/client/install.ts
var WEBCLAW_PREVIEW_ID = "@lonk1989/webclaw/recipe";
var WEBCLAW_ACCOUNTS_SECTION = "webclaw-accounts";
var WEBCLAW_LIVE_ID = "@lonk1989/webclaw/live";
var WEBCLAW_LIVE_KIND = "webclaw-live";
var CANDIDATE_PORTS4 = [19229, 19230, 19231, 19232, 19233];
async function findLiveBase() {
  for (const port of CANDIDATE_PORTS4) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 400);
      const res = await fetch(`http://127.0.0.1:${port}/api/health`, {
        signal: ctrl.signal
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const j = await res.json();
      if (j.ok && j.service === "webclaw-accounts-ui") {
        return `http://127.0.0.1:${port}`;
      }
    } catch {
    }
  }
  return null;
}
function installWebclawSurfaces(ctx) {
  ctx.effect(() => {
    const style = document.createElement("style");
    style.setAttribute("data-webclaw-icons", "");
    style.textContent = WEBCLAW_ICON_CSS;
    document.head.appendChild(style);
    return () => {
      style.remove();
    };
  }, "webclaw: file icons");
  ctx.inject(["documentPreviews", "slots", "locale"], (scope) => {
    scope.effect(
      () => scope.locale.register(NS, { zh: zh3, en: en3 }),
      "webclaw: preview dictionaries"
    );
    scope.effect(
      () => scope.locale.register(ACCOUNTS_NS, { zh, en }),
      "webclaw: accounts dictionaries"
    );
    scope.effect(
      () => scope.locale.register(LIVE_NS, { zh: zh2, en: en2 }),
      "webclaw: live dictionaries"
    );
    scope.effect(
      () => scope.locale.register(RUN_TOOL_NS, { zh: zh4, en: en4 }),
      "webclaw: run toolview dictionaries"
    );
    const t = scope.locale.bind(NS);
    const ta = scope.locale.bind(ACCOUNTS_NS);
    const tl = scope.locale.bind(LIVE_NS);
    scope.effect(
      () => scope.slots.inject(
        "tool.call.toolview",
        () => scope.slots.register(
          {
            name: "tool.call.toolview",
            key: "webclaw_run",
            locale: RUN_TOOL_NS
          },
          WebclawRunToolview
        )
      ),
      "webclaw: run toolview"
    );
    scope.effect(
      () => scope.documentPreviews.register({
        id: WEBCLAW_PREVIEW_ID,
        extensions: ["webclaw"],
        priority: "extension",
        title: () => t("title"),
        loading: "text-pages",
        wrap: true
      }),
      "webclaw: preview metadata"
    );
    scope.effect(
      () => scope.slots.inject(
        "sidebar.right.tab.document",
        () => scope.slots.register(
          {
            name: "sidebar.right.tab.document",
            key: WEBCLAW_PREVIEW_ID,
            locale: NS
          },
          WebclawPreview
        )
      ),
      "webclaw: preview body"
    );
    scope.effect(
      () => scope.slots.inject(
        "settings.section",
        () => scope.slots.register(
          {
            name: "settings.section",
            id: WEBCLAW_ACCOUNTS_SECTION,
            order: 45,
            label: () => ta("sectionLabel"),
            locale: ACCOUNTS_NS
          },
          AccountsSettings
        )
      ),
      "webclaw: settings accounts"
    );
    scope.inject(["sidebarRightTabs", "sidebarRight", "slots"], (live) => {
      live.effect(
        () => live.sidebarRightTabs.register({
          id: WEBCLAW_LIVE_ID,
          kind: WEBCLAW_LIVE_KIND,
          priority: "extension",
          title: () => tl("title"),
          guide: [
            {
              id: "webclaw-live",
              order: 35,
              title: () => tl("guideTitle"),
              description: () => tl("guideDesc")
            }
          ]
        }),
        "webclaw: live tab type"
      );
      live.effect(
        () => live.slots.inject(
          "sidebar.right.pane.tab",
          () => live.slots.register(
            {
              name: "sidebar.right.pane.tab",
              key: WEBCLAW_LIVE_ID,
              locale: LIVE_NS
            },
            WebclawLive
          )
        ),
        "webclaw: live tab body"
      );
      live.effect(() => {
        let cancelled = false;
        let lastOpenedSeq = -1;
        let lastOpenedRunDir = "";
        let pendingRunDir = "";
        let base = null;
        let seededLeftoverFocus = false;
        let userCollapsedRail = false;
        let everOpened = false;
        let autoOpen = false;
        const noteCollapsedIfAny = () => {
          try {
            const api = live.sidebarRight;
            if (everOpened && api.isExpanded && !api.isExpanded()) {
              userCollapsedRail = true;
            }
          } catch {
          }
        };
        const tryOpen = (runDir, seq, reveal) => {
          try {
            noteCollapsedIfAny();
            const api = live.sidebarRight;
            const mayReveal = reveal && !userCollapsedRail;
            api.openTab(WEBCLAW_LIVE_KIND, {
              params: { runDir, focusSeq: seq },
              revealIfOpened: mayReveal
            });
            if (mayReveal) everOpened = true;
            lastOpenedSeq = Math.max(lastOpenedSeq, seq);
            lastOpenedRunDir = runDir;
            pendingRunDir = "";
            noteCollapsedIfAny();
            return true;
          } catch {
            pendingRunDir = runDir;
            return false;
          }
        };
        const onOpenLive = (ev) => {
          const detail = ev.detail;
          const runDir = detail?.runDir?.trim() || "";
          if (!runDir || cancelled || !autoOpen) return;
          noteCollapsedIfAny();
          if (userCollapsedRail) return;
          seededLeftoverFocus = true;
          if (runDir !== lastOpenedRunDir) lastOpenedSeq = -1;
          tryOpen(runDir, lastOpenedSeq + 1, true);
        };
        window.addEventListener(WEBCLAW_OPEN_LIVE_EVENT, onOpenLive);
        const poll = async () => {
          if (cancelled) return;
          if (!base) base = await findLiveBase();
          if (!base || cancelled) return;
          try {
            const res = await fetch(`${base}/api/live/focus`);
            const j = await res.json();
            autoOpen = j.autoOpen === true;
            if (!autoOpen) return;
            const focus = j.focus;
            const seq = typeof focus?.seq === "number" ? focus.seq : -1;
            const runDir = focus?.runDir?.trim() || pendingRunDir;
            if (!runDir) return;
            if (!seededLeftoverFocus && !everOpened) {
              seededLeftoverFocus = true;
              lastOpenedSeq = seq > 0 ? seq : 0;
              lastOpenedRunDir = runDir;
              return;
            }
            if (runDir !== lastOpenedRunDir && seq <= lastOpenedSeq) {
              lastOpenedSeq = -1;
            }
            if (seq <= lastOpenedSeq && runDir === lastOpenedRunDir && !pendingRunDir) {
              return;
            }
            tryOpen(runDir, seq > 0 ? seq : lastOpenedSeq + 1, !userCollapsedRail);
          } catch {
            base = null;
          }
        };
        void poll();
        const id = window.setInterval(() => {
          void poll();
        }, 600);
        return () => {
          cancelled = true;
          window.clearInterval(id);
          window.removeEventListener(WEBCLAW_OPEN_LIVE_EVENT, onOpenLive);
        };
      }, "webclaw: live focus poll");
    });
  });
}

// src/client/index.ts
var name = "webclaw";
var inject = ["slots", "locale"];
function apply(ctx) {
  installWebclawSurfaces(ctx);
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2NsaWVudC9pbmRleC50cyIsICIuLi9zcmMvY2xpZW50L0FjY291bnRzU2V0dGluZ3MudHN4IiwgIi4uL3NyYy9jbGllbnQvYWNjb3VudHMtbG9jYWxlcy50cyIsICIuLi9zcmMvY2xpZW50L2ljb25zLWNzcy50cyIsICIuLi9zcmMvY2xpZW50L2xpdmUtbG9jYWxlcy50cyIsICIuLi9zcmMvY2xpZW50L2xvY2FsZXMudHMiLCAiLi4vc3JjL2NsaWVudC9ydW4tdG9vbC1sb2NhbGVzLnRzIiwgIi4uL3NyYy9jbGllbnQvV2ViY2xhd0xpdmUudHN4IiwgIi4uL3NyYy9jbGllbnQvTGl2ZVByZXZpZXdJbWFnZS50c3giLCAiLi4vc3JjL2NsaWVudC9saXZlLW9wZW4udHMiLCAiLi4vc3JjL2NsaWVudC9XZWJjbGF3UHJldmlldy50c3giLCAiLi4vc3JjL3BhcmFtcy50cyIsICIuLi9zcmMvY2xpZW50L1dlYmNsYXdSdW5Ub29sdmlldy50c3giLCAiLi4vc3JjL2NsaWVudC9pbnN0YWxsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcclxuICogQnJvd3NlciBDbGllbnQgZW50cnkgZm9yIGBAbG9uazE5ODkvd2ViY2xhd2AuXHJcbiAqIEhvc3QgdG9vbHMgbGl2ZSBpbiB0aGUgcGFja2FnZSByb290OyB0aGlzIGhhbGYgb3ducyBgLndlYmNsYXdgIHByZXZpZXcgVVguXHJcbiAqL1xyXG5pbXBvcnQgdHlwZSB7IENvbnRleHQgfSBmcm9tICdAZGVlcHNlZWstYWkvY29yZGlzJ1xyXG5pbXBvcnQgeyBpbnN0YWxsV2ViY2xhd1N1cmZhY2VzIH0gZnJvbSAnLi9pbnN0YWxsLnRzJ1xyXG5cclxuLyoqIENvcmRpcyBjbGllbnQgcGx1Z2luIGlkIChzYW1lIHBhY2thZ2UgYXMgSG9zdCkuICovXHJcbmV4cG9ydCBjb25zdCBuYW1lID0gJ3dlYmNsYXcnXHJcblxyXG4vKiogU29mdCBkZXBzOiBwcmV2aWV3IHJlZ2lzdHJ5IGFycml2ZXMgd2l0aCBzaWRlYmFyLWRvY3VtZW50cHJldmlldy4gKi9cclxuZXhwb3J0IGNvbnN0IGluamVjdCA9IFsnc2xvdHMnLCAnbG9jYWxlJ11cclxuXHJcbi8qKlxyXG4gKiBNb3VudCByZWNpcGUgcHJldmlldywgbGl2ZSBzaWRlYmFyIHRhYiwgYW5kIGZpbGUtdHJlZSBpY29uIHRpbnQuXHJcbiAqIEBwYXJhbSBjdHggLSBjbGllbnQgcm9vdCBjb250ZXh0LlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5KGN0eDogQ29udGV4dCk6IHZvaWQge1xyXG4gIGluc3RhbGxXZWJjbGF3U3VyZmFjZXMoY3R4KVxyXG59XHJcblxyXG5leHBvcnQge1xyXG4gIFdFQkNMQVdfTElWRV9JRCxcclxuICBXRUJDTEFXX0xJVkVfS0lORCxcclxuICBXRUJDTEFXX1BSRVZJRVdfSUQsXHJcbiAgaW5zdGFsbFdlYmNsYXdTdXJmYWNlcyxcclxufSBmcm9tICcuL2luc3RhbGwudHMnXHJcbiIsICIvKipcclxuICogRFNIIFNldHRpbmdzIFx1MjE5MiBcdTdGNTFcdTdBRDlcdThEMjZcdTUzRjc6IGVkaXQgbG9jYWwgdmF1bHQgdmlhIGxvb3BiYWNrIEhvc3QgVUkgQVBJLlxyXG4gKiBQYXNzd29yZHMgbmV2ZXIgZ28gdGhyb3VnaCB0aGUgTExNIFx1MjAxNCBvbmx5IDEyNy4wLjAuMSBIb3N0IHByb2Nlc3MuXHJcbiAqL1xyXG5pbXBvcnQgeyB1c2VFZmZlY3QsIHVzZVN0YXRlLCB0eXBlIFJlYWN0Tm9kZSB9IGZyb20gJ3JlYWN0J1xyXG5pbXBvcnQgdHlwZSB7IFByb3BzTG9jYWxlIH0gZnJvbSAnQGRlZXBzZWVrLWFpL2RzaC1jbGllbnQtdWktc2xvdHMnXHJcblxyXG5leHBvcnQgdHlwZSBBY2NvdW50c1NldHRpbmdzUHJvcHMgPSBQcm9wc0xvY2FsZTwnd2ViY2xhd0FjY291bnRzJz5cclxuXHJcbmludGVyZmFjZSBBY2NvdW50Um93IHtcclxuICBpZDogc3RyaW5nXHJcbiAgbmFtZTogc3RyaW5nXHJcbiAgdXJsOiBzdHJpbmdcclxuICB1c2VybmFtZTogc3RyaW5nXHJcbiAgaGFzX3Bhc3N3b3JkOiBib29sZWFuXHJcbiAgcGFzc3dvcmREcmFmdDogc3RyaW5nXHJcbiAgbXNnOiBzdHJpbmdcclxuICBlcnI6IGJvb2xlYW5cclxuICBzYXZpbmc6IGJvb2xlYW5cclxufVxyXG5cclxuY29uc3QgQ0FORElEQVRFX1BPUlRTID0gWzE5MjI5LCAxOTIzMCwgMTkyMzEsIDE5MjMyLCAxOTIzM11cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGZpbmRCYXNlKCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xyXG4gIGZvciAoY29uc3QgcG9ydCBvZiBDQU5ESURBVEVfUE9SVFMpIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGN0cmwgPSBuZXcgQWJvcnRDb250cm9sbGVyKClcclxuICAgICAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IGN0cmwuYWJvcnQoKSwgNTAwKVxyXG4gICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgaHR0cDovLzEyNy4wLjAuMToke3BvcnR9L2FwaS9oZWFsdGhgLCB7XHJcbiAgICAgICAgc2lnbmFsOiBjdHJsLnNpZ25hbCxcclxuICAgICAgfSlcclxuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKVxyXG4gICAgICBpZiAoIXJlcy5vaykgY29udGludWVcclxuICAgICAgY29uc3QgaiA9IChhd2FpdCByZXMuanNvbigpKSBhcyB7IG9rPzogYm9vbGVhbjsgc2VydmljZT86IHN0cmluZyB9XHJcbiAgICAgIGlmIChqLm9rICYmIGouc2VydmljZSA9PT0gJ3dlYmNsYXctYWNjb3VudHMtdWknKSB7XHJcbiAgICAgICAgcmV0dXJuIGBodHRwOi8vMTI3LjAuMC4xOiR7cG9ydH1gXHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2gge1xyXG4gICAgICAvKiBuZXh0ICovXHJcbiAgICB9XHJcbiAgfVxyXG4gIC8vIEVwaGVtZXJhbCBwb3J0OiBIb3N0IHdyaXRlcyBhY2NvdW50cy11aS5qc29uIFx1MjAxNCBDbGllbnQgY2Fubm90IHJlYWQgaXQuXHJcbiAgLy8gVXNlciBjYW4gb3BlbiB0aGUgc3RhbmRhbG9uZSBwYWdlIHZpYSB3ZWJjbGF3LWFjY291bnRzLmNtZC5cclxuICByZXR1cm4gbnVsbFxyXG59XHJcblxyXG4vKipcclxuICogU2V0dGluZ3Mgc2VjdGlvbiBib2R5IGZvciBzaXRlIGFjY291bnRzLlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIEFjY291bnRzU2V0dGluZ3MoeyB0IH06IEFjY291bnRzU2V0dGluZ3NQcm9wcyk6IFJlYWN0Tm9kZSB7XHJcbiAgY29uc3QgW2Jhc2UsIHNldEJhc2VdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZD4odW5kZWZpbmVkKVxyXG4gIGNvbnN0IFtyb3dzLCBzZXRSb3dzXSA9IHVzZVN0YXRlPEFjY291bnRSb3dbXT4oW10pXHJcbiAgY29uc3QgW2xvYWRFcnJvciwgc2V0TG9hZEVycm9yXSA9IHVzZVN0YXRlKCcnKVxyXG5cclxuICBjb25zdCByZWxvYWQgPSBhc3luYyAoYXBpQmFzZTogc3RyaW5nKSA9PiB7XHJcbiAgICBzZXRMb2FkRXJyb3IoJycpXHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgJHthcGlCYXNlfS9hcGkvYWNjb3VudHNgKVxyXG4gICAgICBjb25zdCBkYXRhID0gKGF3YWl0IHJlcy5qc29uKCkpIGFzIHtcclxuICAgICAgICBvaz86IGJvb2xlYW5cclxuICAgICAgICBpdGVtcz86IEFycmF5PHtcclxuICAgICAgICAgIGlkOiBzdHJpbmdcclxuICAgICAgICAgIG5hbWU6IHN0cmluZ1xyXG4gICAgICAgICAgdXJsOiBzdHJpbmdcclxuICAgICAgICAgIHVzZXJuYW1lOiBzdHJpbmdcclxuICAgICAgICAgIGhhc19wYXNzd29yZDogYm9vbGVhblxyXG4gICAgICAgIH0+XHJcbiAgICAgICAgZXJyb3I/OiBzdHJpbmdcclxuICAgICAgfVxyXG4gICAgICBpZiAoIWRhdGEub2spIHtcclxuICAgICAgICBzZXRMb2FkRXJyb3IoZGF0YS5lcnJvciB8fCB0KCdsb2FkRmFpbGVkJykpXHJcbiAgICAgICAgcmV0dXJuXHJcbiAgICAgIH1cclxuICAgICAgc2V0Um93cyhcclxuICAgICAgICAoZGF0YS5pdGVtcyA/PyBbXSkubWFwKGl0ID0+ICh7XHJcbiAgICAgICAgICAuLi5pdCxcclxuICAgICAgICAgIHBhc3N3b3JkRHJhZnQ6ICcnLFxyXG4gICAgICAgICAgbXNnOiAnJyxcclxuICAgICAgICAgIGVycjogZmFsc2UsXHJcbiAgICAgICAgICBzYXZpbmc6IGZhbHNlLFxyXG4gICAgICAgIH0pKSxcclxuICAgICAgKVxyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgc2V0TG9hZEVycm9yKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogdCgnbG9hZEZhaWxlZCcpKVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGxldCBjYW5jZWxsZWQgPSBmYWxzZVxyXG4gICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xyXG4gICAgICBjb25zdCBmb3VuZCA9IGF3YWl0IGZpbmRCYXNlKClcclxuICAgICAgaWYgKGNhbmNlbGxlZCkgcmV0dXJuXHJcbiAgICAgIHNldEJhc2UoZm91bmQpXHJcbiAgICAgIGlmIChmb3VuZCkgYXdhaXQgcmVsb2FkKGZvdW5kKVxyXG4gICAgfSkoKVxyXG4gICAgcmV0dXJuICgpID0+IHtcclxuICAgICAgY2FuY2VsbGVkID0gdHJ1ZVxyXG4gICAgfVxyXG4gIH0sIFtdKVxyXG5cclxuICBjb25zdCB1cGRhdGVSb3cgPSAoaWQ6IHN0cmluZywgcGF0Y2g6IFBhcnRpYWw8QWNjb3VudFJvdz4pID0+IHtcclxuICAgIHNldFJvd3MocHJldiA9PiBwcmV2Lm1hcChyID0+IChyLmlkID09PSBpZCA/IHsgLi4uciwgLi4ucGF0Y2ggfSA6IHIpKSlcclxuICB9XHJcblxyXG4gIGNvbnN0IHNhdmVSb3cgPSBhc3luYyAocm93OiBBY2NvdW50Um93KSA9PiB7XHJcbiAgICBpZiAoIWJhc2UpIHJldHVyblxyXG4gICAgdXBkYXRlUm93KHJvdy5pZCwgeyBzYXZpbmc6IHRydWUsIG1zZzogdCgnc2F2aW5nJyksIGVycjogZmFsc2UgfSlcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAke2Jhc2V9L2FwaS9hY2NvdW50cy8ke2VuY29kZVVSSUNvbXBvbmVudChyb3cuaWQpfWAsIHtcclxuICAgICAgICBtZXRob2Q6ICdQVVQnLFxyXG4gICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxyXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgIGlkOiByb3cuaWQsXHJcbiAgICAgICAgICBuYW1lOiByb3cubmFtZSxcclxuICAgICAgICAgIHVybDogcm93LnVybCxcclxuICAgICAgICAgIHVzZXJuYW1lOiByb3cudXNlcm5hbWUsXHJcbiAgICAgICAgICBwYXNzd29yZDogcm93LnBhc3N3b3JkRHJhZnQsXHJcbiAgICAgICAgfSksXHJcbiAgICAgIH0pXHJcbiAgICAgIGNvbnN0IGRhdGEgPSAoYXdhaXQgcmVzLmpzb24oKSkgYXMge1xyXG4gICAgICAgIG9rPzogYm9vbGVhblxyXG4gICAgICAgIGVycm9yPzogc3RyaW5nXHJcbiAgICAgICAgaXRlbT86IHsgaGFzX3Bhc3N3b3JkPzogYm9vbGVhbjsgdXNlcm5hbWU/OiBzdHJpbmc7IHVybD86IHN0cmluZyB9XHJcbiAgICAgIH1cclxuICAgICAgaWYgKGRhdGEub2spIHtcclxuICAgICAgICB1cGRhdGVSb3cocm93LmlkLCB7XHJcbiAgICAgICAgICBzYXZpbmc6IGZhbHNlLFxyXG4gICAgICAgICAgbXNnOiB0KCdzYXZlZCcpLFxyXG4gICAgICAgICAgZXJyOiBmYWxzZSxcclxuICAgICAgICAgIHBhc3N3b3JkRHJhZnQ6ICcnLFxyXG4gICAgICAgICAgaGFzX3Bhc3N3b3JkOiBCb29sZWFuKGRhdGEuaXRlbT8uaGFzX3Bhc3N3b3JkID8/IHJvdy5oYXNfcGFzc3dvcmQpLFxyXG4gICAgICAgICAgdXNlcm5hbWU6IGRhdGEuaXRlbT8udXNlcm5hbWUgPz8gcm93LnVzZXJuYW1lLFxyXG4gICAgICAgICAgdXJsOiBkYXRhLml0ZW0/LnVybCA/PyByb3cudXJsLFxyXG4gICAgICAgIH0pXHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdXBkYXRlUm93KHJvdy5pZCwge1xyXG4gICAgICAgICAgc2F2aW5nOiBmYWxzZSxcclxuICAgICAgICAgIG1zZzogZGF0YS5lcnJvciB8fCB0KCdzYXZlRmFpbGVkJyksXHJcbiAgICAgICAgICBlcnI6IHRydWUsXHJcbiAgICAgICAgfSlcclxuICAgICAgfVxyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgdXBkYXRlUm93KHJvdy5pZCwge1xyXG4gICAgICAgIHNhdmluZzogZmFsc2UsXHJcbiAgICAgICAgbXNnOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IHQoJ3NhdmVGYWlsZWQnKSxcclxuICAgICAgICBlcnI6IHRydWUsXHJcbiAgICAgIH0pXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBpZiAoYmFzZSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICByZXR1cm4gPGRpdiBzdHlsZT17eyBwYWRkaW5nOiAxNiB9fT57dCgnbG9hZGluZycpfTwvZGl2PlxyXG4gIH1cclxuXHJcbiAgaWYgKGJhc2UgPT09IG51bGwpIHtcclxuICAgIHJldHVybiAoXHJcbiAgICAgIDxkaXYgc3R5bGU9e3sgcGFkZGluZzogMTYsIG1heFdpZHRoOiA1NjAsIGxpbmVIZWlnaHQ6IDEuNTUsIGZvbnRTaXplOiAxNCB9fT5cclxuICAgICAgICA8cCBzdHlsZT17eyBtYXJnaW5Ub3A6IDAgfX0+e3QoJ29mZmxpbmVUaXRsZScpfTwvcD5cclxuICAgICAgICA8cCBzdHlsZT17eyBvcGFjaXR5OiAwLjggfX0+e3QoJ29mZmxpbmVIaW50Jyl9PC9wPlxyXG4gICAgICAgIDxwcmVcclxuICAgICAgICAgIHN0eWxlPXt7XHJcbiAgICAgICAgICAgIHBhZGRpbmc6IDEyLFxyXG4gICAgICAgICAgICBvdmVyZmxvdzogJ2F1dG8nLFxyXG4gICAgICAgICAgICBmb250U2l6ZTogMTIsXHJcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICdjb2xvci1taXgoaW4gc3JnYiwgY3VycmVudENvbG9yIDYlLCB0cmFuc3BhcmVudCknLFxyXG4gICAgICAgICAgICBib3JkZXJSYWRpdXM6IDgsXHJcbiAgICAgICAgICB9fVxyXG4gICAgICAgID5cclxuICAgICAgICAgIHt0KCdvZmZsaW5lQ21kJyl9XHJcbiAgICAgICAgPC9wcmU+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgKVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIChcclxuICAgIDxkaXYgc3R5bGU9e3sgcGFkZGluZzogMTYsIG1heFdpZHRoOiA2NDAgfX0+XHJcbiAgICAgIDxwIHN0eWxlPXt7IG1hcmdpblRvcDogMCwgb3BhY2l0eTogMC44LCBmb250U2l6ZTogMTMsIGxpbmVIZWlnaHQ6IDEuNSB9fT5cclxuICAgICAgICB7dCgnaW50cm8nKX1cclxuICAgICAgPC9wPlxyXG4gICAgICB7bG9hZEVycm9yID8gKFxyXG4gICAgICAgIDxwIHN0eWxlPXt7IGNvbG9yOiAnI2RjMjYyNicgfX0+e2xvYWRFcnJvcn08L3A+XHJcbiAgICAgICkgOiAoXHJcbiAgICAgICAgcm93cy5tYXAocm93ID0+IChcclxuICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAga2V5PXtyb3cuaWR9XHJcbiAgICAgICAgICAgIHN0eWxlPXt7XHJcbiAgICAgICAgICAgICAgYm9yZGVyOiAnMXB4IHNvbGlkIGNvbG9yLW1peChpbiBzcmdiLCBjdXJyZW50Q29sb3IgMTQlLCB0cmFuc3BhcmVudCknLFxyXG4gICAgICAgICAgICAgIGJvcmRlclJhZGl1czogMTAsXHJcbiAgICAgICAgICAgICAgcGFkZGluZzogJzEycHggMTRweCcsXHJcbiAgICAgICAgICAgICAgbWFyZ2luQm90dG9tOiAxMixcclxuICAgICAgICAgICAgfX1cclxuICAgICAgICAgID5cclxuICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiAnZmxleCcsIGdhcDogOCwgYWxpZ25JdGVtczogJ2NlbnRlcicsIG1hcmdpbkJvdHRvbTogOCB9fT5cclxuICAgICAgICAgICAgICA8c3Ryb25nPntyb3cubmFtZSB8fCByb3cuaWR9PC9zdHJvbmc+XHJcbiAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9e3sgZm9udFNpemU6IDEyLCBvcGFjaXR5OiAwLjcgfX0+XHJcbiAgICAgICAgICAgICAgICB7cm93Lmhhc19wYXNzd29yZCA/IHQoJ2hhc1Bhc3N3b3JkJykgOiB0KCdub1Bhc3N3b3JkJyl9XHJcbiAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPGxhYmVsIHN0eWxlPXt7IGRpc3BsYXk6ICdibG9jaycsIGZvbnRTaXplOiAxMiwgb3BhY2l0eTogMC42NSwgbWFyZ2luQm90dG9tOiA0IH19PlxyXG4gICAgICAgICAgICAgIHt0KCd1cmwnKX1cclxuICAgICAgICAgICAgPC9sYWJlbD5cclxuICAgICAgICAgICAgPGlucHV0XHJcbiAgICAgICAgICAgICAgdmFsdWU9e3Jvdy51cmx9XHJcbiAgICAgICAgICAgICAgb25DaGFuZ2U9e2UgPT4gdXBkYXRlUm93KHJvdy5pZCwgeyB1cmw6IGUudGFyZ2V0LnZhbHVlIH0pfVxyXG4gICAgICAgICAgICAgIHN0eWxlPXt7IHdpZHRoOiAnMTAwJScsIGJveFNpemluZzogJ2JvcmRlci1ib3gnLCBtYXJnaW5Cb3R0b206IDgsIHBhZGRpbmc6ICc2cHggOHB4JyB9fVxyXG4gICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICA8bGFiZWwgc3R5bGU9e3sgZGlzcGxheTogJ2Jsb2NrJywgZm9udFNpemU6IDEyLCBvcGFjaXR5OiAwLjY1LCBtYXJnaW5Cb3R0b206IDQgfX0+XHJcbiAgICAgICAgICAgICAge3QoJ3VzZXJuYW1lJyl9XHJcbiAgICAgICAgICAgIDwvbGFiZWw+XHJcbiAgICAgICAgICAgIDxpbnB1dFxyXG4gICAgICAgICAgICAgIHZhbHVlPXtyb3cudXNlcm5hbWV9XHJcbiAgICAgICAgICAgICAgYXV0b0NvbXBsZXRlPVwidXNlcm5hbWVcIlxyXG4gICAgICAgICAgICAgIG9uQ2hhbmdlPXtlID0+IHVwZGF0ZVJvdyhyb3cuaWQsIHsgdXNlcm5hbWU6IGUudGFyZ2V0LnZhbHVlIH0pfVxyXG4gICAgICAgICAgICAgIHN0eWxlPXt7IHdpZHRoOiAnMTAwJScsIGJveFNpemluZzogJ2JvcmRlci1ib3gnLCBtYXJnaW5Cb3R0b206IDgsIHBhZGRpbmc6ICc2cHggOHB4JyB9fVxyXG4gICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICA8bGFiZWwgc3R5bGU9e3sgZGlzcGxheTogJ2Jsb2NrJywgZm9udFNpemU6IDEyLCBvcGFjaXR5OiAwLjY1LCBtYXJnaW5Cb3R0b206IDQgfX0+XHJcbiAgICAgICAgICAgICAge3QoJ3Bhc3N3b3JkJyl9XHJcbiAgICAgICAgICAgIDwvbGFiZWw+XHJcbiAgICAgICAgICAgIDxpbnB1dFxyXG4gICAgICAgICAgICAgIHR5cGU9XCJwYXNzd29yZFwiXHJcbiAgICAgICAgICAgICAgdmFsdWU9e3Jvdy5wYXNzd29yZERyYWZ0fVxyXG4gICAgICAgICAgICAgIGF1dG9Db21wbGV0ZT1cIm5ldy1wYXNzd29yZFwiXHJcbiAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9e3QoJ3Bhc3N3b3JkUGxhY2Vob2xkZXInKX1cclxuICAgICAgICAgICAgICBvbkNoYW5nZT17ZSA9PiB1cGRhdGVSb3cocm93LmlkLCB7IHBhc3N3b3JkRHJhZnQ6IGUudGFyZ2V0LnZhbHVlIH0pfVxyXG4gICAgICAgICAgICAgIHN0eWxlPXt7IHdpZHRoOiAnMTAwJScsIGJveFNpemluZzogJ2JvcmRlci1ib3gnLCBtYXJnaW5Cb3R0b206IDgsIHBhZGRpbmc6ICc2cHggOHB4JyB9fVxyXG4gICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdmbGV4JywgZ2FwOiAxMCwgYWxpZ25JdGVtczogJ2NlbnRlcicgfX0+XHJcbiAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICBkaXNhYmxlZD17cm93LnNhdmluZ31cclxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHZvaWQgc2F2ZVJvdyhyb3cpfVxyXG4gICAgICAgICAgICAgICAgc3R5bGU9e3tcclxuICAgICAgICAgICAgICAgICAgcGFkZGluZzogJzZweCAxMnB4JyxcclxuICAgICAgICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiA2LFxyXG4gICAgICAgICAgICAgICAgICBib3JkZXI6IDAsXHJcbiAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6ICcjMjU2M2ViJyxcclxuICAgICAgICAgICAgICAgICAgY29sb3I6ICcjZmZmJyxcclxuICAgICAgICAgICAgICAgICAgZm9udFdlaWdodDogNjAwLFxyXG4gICAgICAgICAgICAgICAgICBjdXJzb3I6IHJvdy5zYXZpbmcgPyAnZGVmYXVsdCcgOiAncG9pbnRlcicsXHJcbiAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgIHt0KCdzYXZlJyl9XHJcbiAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9e3sgZm9udFNpemU6IDEyLCBjb2xvcjogcm93LmVyciA/ICcjZGMyNjI2JyA6IHVuZGVmaW5lZCB9fT5cclxuICAgICAgICAgICAgICAgIHtyb3cubXNnfVxyXG4gICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICApKVxyXG4gICAgICApfVxyXG4gICAgICA8cCBzdHlsZT17eyBmb250U2l6ZTogMTIsIG9wYWNpdHk6IDAuNjUgfX0+XHJcbiAgICAgICAgPGEgaHJlZj17YmFzZSArICcvJ30gdGFyZ2V0PVwiX2JsYW5rXCIgcmVsPVwibm9yZWZlcnJlclwiPlxyXG4gICAgICAgICAge3QoJ29wZW5TdGFuZGFsb25lJyl9XHJcbiAgICAgICAgPC9hPlxyXG4gICAgICA8L3A+XHJcbiAgICA8L2Rpdj5cclxuICApXHJcbn1cclxuIiwgIi8qKiBMb2NhbGUgZm9yIFNldHRpbmdzIFx1MjE5MiBcdTdGNTFcdTdBRDlcdThEMjZcdTUzRjcuICovXHJcbmltcG9ydCB0eXBlIHt9IGZyb20gJ0BkZWVwc2Vlay1haS9kc2gtY2xpZW50LXVpLXNsb3RzJ1xyXG5cclxuZGVjbGFyZSBtb2R1bGUgJ0BkZWVwc2Vlay1haS9kc2gtY2xpZW50LXVpLXNsb3RzJyB7XHJcbiAgaW50ZXJmYWNlIExvY2FsZU5hbWVzcGFjZU1hcCB7XHJcbiAgICB3ZWJjbGF3QWNjb3VudHM6IGtleW9mIHR5cGVvZiB6aFxyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IHpoID0ge1xyXG4gIHNlY3Rpb25MYWJlbDogJ1x1N0Y1MVx1N0FEOVx1OEQyNlx1NTNGNycsXHJcbiAgaW50cm86XHJcbiAgICAnXHU3NjdCXHU1RjU1XHU1NzMwXHU1NzQwXHU0RTBFXHU1M0VGXHU5MDA5XHU4RDI2XHU1M0Y3XHU1QkM2XHU3ODAxXHU1M0VBXHU0RkREXHU1QjU4XHU1NzI4XHU2NzJDXHU2NzNBIHdlYmNsYXcgXHU0RkREXHU5NjY5XHU3QkIxXHVGRjA4V2luZG93cyBcdTRFMEIgRFBBUElcdUZGMENtYWNPUy9MaW51eCBcdTRFM0FcdTY3MkNcdTY3M0FcdTZERjdcdTZEQzZcdTVCNThcdTUwQThcdUZGMDlcdTMwMDJcdTk4REVcdTRFNjYgU1NPIFx1N0I0OVx1NTNFQVx1OTcwMFx1NTg2Qlx1NTE5OVx1NkI2M1x1Nzg2RVx1NzY4NFx1NzY3Qlx1NUY1NSBVUkxcdUZGMDhcdTU5ODIgXHUyMDI2L2xvZ2luP3Nzbz1sYXJrJlx1MjAyNlx1RkYwOVx1RkYwQ1x1NUJDNlx1NzgwMVx1NTNFRlx1NzU1OVx1N0E3QVx1MzAwMlx1NUJDNlx1NzgwMVx1Njg0Nlx1NzU1OVx1N0E3QVx1ODg2OFx1NzkzQVx1NEUwRFx1NEZFRVx1NjUzOVx1NURGMlx1NEZERFx1NUI1OFx1NzY4NFx1NUJDNlx1NzgwMVx1RkYxQlx1NTJGRlx1NjI4QVx1NUJDNlx1NzgwMVx1NTNEMVx1NTIzMFx1NUJGOVx1OEJERFx1OTFDQ1x1MzAwMicsXHJcbiAgbG9hZGluZzogJ1x1NkI2M1x1NTcyOFx1OEZERVx1NjNBNVx1NjcyQ1x1NjczQVx1OTE0RFx1N0Y2RVx1NjcwRFx1NTJBMVx1MjAyNicsXHJcbiAgbG9hZEZhaWxlZDogJ1x1NTJBMFx1OEY3RFx1NTkzMVx1OEQyNScsXHJcbiAgdXJsOiAnXHU3NjdCXHU1RjU1XHU1NzMwXHU1NzQwJyxcclxuICB1c2VybmFtZTogJ1x1OEQyNlx1NTNGNycsXHJcbiAgcGFzc3dvcmQ6ICdcdTVCQzZcdTc4MDEnLFxyXG4gIHBhc3N3b3JkUGxhY2Vob2xkZXI6ICdcdTc1NTlcdTdBN0EgPSBcdTRGRERcdTYzMDFcdTUzOUZcdTVCQzZcdTc4MDEnLFxyXG4gIHNhdmU6ICdcdTRGRERcdTVCNTgnLFxyXG4gIHNhdmluZzogJ1x1NEZERFx1NUI1OFx1NEUyRFx1MjAyNicsXHJcbiAgc2F2ZWQ6ICdcdTVERjJcdTRGRERcdTVCNThcdTUyMzBcdTY3MkNcdTY3M0EnLFxyXG4gIHNhdmVGYWlsZWQ6ICdcdTRGRERcdTVCNThcdTU5MzFcdThEMjUnLFxyXG4gIGhhc1Bhc3N3b3JkOiAnXHU1REYyXHU4QkJFXHU1QkM2XHU3ODAxJyxcclxuICBub1Bhc3N3b3JkOiAnXHU2NzJBXHU4QkJFXHU1QkM2XHU3ODAxJyxcclxuICBvcGVuU3RhbmRhbG9uZTogJ1x1NTcyOFx1NkQ0Rlx1ODlDOFx1NTY2OFx1NEUyRFx1NjI1M1x1NUYwMFx1NjcyQ1x1NjczQVx1OTE0RFx1N0Y2RVx1OTg3NScsXHJcbiAgb2ZmbGluZVRpdGxlOiAnXHU2NzJDXHU2NzNBXHU4RDI2XHU1M0Y3XHU5MTREXHU3RjZFXHU2NzBEXHU1MkExXHU2NzJBXHU1QzMxXHU3RUVBJyxcclxuICBvZmZsaW5lSGludDpcclxuICAgICdcdThCRjdcdTc4NkVcdThCQTQgRFNIIFx1NURGMlx1NTJBMFx1OEY3RCB3ZWJjbGF3IFx1NjNEMlx1NEVGNlx1NEUxNCBIb3N0IFx1NTcyOFx1NjcyQ1x1NjczQVx1OEZEMFx1ODg0Q1x1MzAwMlx1NEU1Rlx1NTNFRlx1OEZEMFx1ODg0Q1x1NjcyQ1x1NjczQVx1NTQyRlx1NTJBOFx1ODExQVx1NjcyQ1x1RkYwOFx1NjVFMFx1OTcwMFx1NjI4QSB3ZWJjbGF3LWxpdGUgXHU1MkEwXHU1MTY1IFBBVEhcdUZGMDlcdUZGMUEnLFxyXG4gIG9mZmxpbmVDbWQ6XHJcbiAgICAnV2luZG93czogJUxPQ0FMQVBQREFUQSVcXFxcd2ViY2xhd1xcXFxiaW5cXFxcd2ViY2xhdy1hY2NvdW50cy5jbWRcXG4nICtcclxuICAgICdtYWNPUzogfi8ud2ViY2xhdy9iaW4vd2ViY2xhdy1hY2NvdW50c1xcbicgK1xyXG4gICAgJ1x1RkYwOFx1OTk5Nlx1NkIyMVx1NTQyRlx1NTJBOCBEU0ggLyBcdThDMDNcdTc1Mjggd2ViY2xhdyBcdTVERTVcdTUxNzdcdTU0MEVcdTRGMUFcdTgxRUFcdTUyQThcdTc1MUZcdTYyMTBcdUZGMDknLFxyXG59XHJcblxyXG5leHBvcnQgY29uc3QgZW4gPSB7XHJcbiAgc2VjdGlvbkxhYmVsOiAnU2l0ZSBhY2NvdW50cycsXHJcbiAgaW50cm86XHJcbiAgICAnTG9naW4gVVJMIGFuZCBvcHRpb25hbCBjcmVkZW50aWFscyBzdGF5IGluIHRoZSBsb2NhbCB3ZWJjbGF3IHZhdWx0IChEUEFQSSBvbiBXaW5kb3dzOyBvYmZ1c2NhdGVkIHN0b3JhZ2Ugb24gbWFjT1MvTGludXgpLiBGZWlzaHUgU1NPIG9ubHkgbmVlZHMgdGhlIGNvcnJlY3QgbG9naW4gVVJMIChlLmcuIFx1MjAyNi9sb2dpbj9zc289bGFyayZcdTIwMjYpOyBwYXNzd29yZCBtYXkgYmUgYmxhbmsuIExlYXZlIHBhc3N3b3JkIGJsYW5rIHRvIGtlZXAgdGhlIHN0b3JlZCBzZWNyZXQgXHUyMDE0IG5ldmVyIHBhc3RlIHBhc3N3b3JkcyBpbnRvIGNoYXQuJyxcclxuICBsb2FkaW5nOiAnQ29ubmVjdGluZyB0byBsb2NhbCBhY2NvdW50cyBzZXJ2aWNlXHUyMDI2JyxcclxuICBsb2FkRmFpbGVkOiAnRmFpbGVkIHRvIGxvYWQnLFxyXG4gIHVybDogJ0xvZ2luIFVSTCcsXHJcbiAgdXNlcm5hbWU6ICdVc2VybmFtZScsXHJcbiAgcGFzc3dvcmQ6ICdQYXNzd29yZCcsXHJcbiAgcGFzc3dvcmRQbGFjZWhvbGRlcjogJ0JsYW5rID0ga2VlcCBleGlzdGluZycsXHJcbiAgc2F2ZTogJ1NhdmUnLFxyXG4gIHNhdmluZzogJ1NhdmluZ1x1MjAyNicsXHJcbiAgc2F2ZWQ6ICdTYXZlZCBsb2NhbGx5JyxcclxuICBzYXZlRmFpbGVkOiAnU2F2ZSBmYWlsZWQnLFxyXG4gIGhhc1Bhc3N3b3JkOiAnUGFzc3dvcmQgc2V0JyxcclxuICBub1Bhc3N3b3JkOiAnTm8gcGFzc3dvcmQnLFxyXG4gIG9wZW5TdGFuZGFsb25lOiAnT3BlbiBzdGFuZGFsb25lIHBhZ2UgaW4gYnJvd3NlcicsXHJcbiAgb2ZmbGluZVRpdGxlOiAnTG9jYWwgYWNjb3VudHMgc2VydmljZSBpcyBvZmZsaW5lJyxcclxuICBvZmZsaW5lSGludDpcclxuICAgICdNYWtlIHN1cmUgdGhlIHdlYmNsYXcgcGx1Z2luIGlzIGxvYWRlZCBhbmQgdGhlIEhvc3QgcnVucyBvbiB0aGlzIG1hY2hpbmUuIE9yIG9wZW4gdGhlIGxhdW5jaGVyIChubyBQQVRIIG5lZWRlZCk6JyxcclxuICBvZmZsaW5lQ21kOlxyXG4gICAgJ1dpbmRvd3M6ICVMT0NBTEFQUERBVEElXFxcXHdlYmNsYXdcXFxcYmluXFxcXHdlYmNsYXctYWNjb3VudHMuY21kXFxuJyArXHJcbiAgICAnbWFjT1M6IH4vLndlYmNsYXcvYmluL3dlYmNsYXctYWNjb3VudHNcXG4nICtcclxuICAgICcoY3JlYXRlZCBhZnRlciBEU0ggYm9vdCAvIGZpcnN0IHdlYmNsYXcgdG9vbCBjYWxsKScsXHJcbn0gc2F0aXNmaWVzIFJlY29yZDxrZXlvZiB0eXBlb2YgemgsIHN0cmluZz5cclxuXHJcbmV4cG9ydCBjb25zdCBBQ0NPVU5UU19OUyA9ICd3ZWJjbGF3QWNjb3VudHMnXHJcbiIsICIvKiogRmlsZS10cmVlIGljb24gdGludCBmb3IgYC53ZWJjbGF3YCAobWF0Y2hlcyBlbmdpbmUgYGNvZGVgIGNvbG9yIHdpdGhvdXQgcGF0Y2hpbmcgRmlsZVR5cGVJY29uKS4gKi9cclxuZXhwb3J0IGNvbnN0IFdFQkNMQVdfSUNPTl9DU1MgPSBgXHJcbltkYXRhLWZpbGVzLWVudHJ5PSdmaWxlJ11bZGF0YS1maWxlcy1wYXRoJD0nLndlYmNsYXcnIGldIHN2ZyxcclxuW2RhdGEtZmlsZXMtZW50cnk9J2ZpbGUnXVtkYXRhLWZpbGVzLXBhdGgkPScuV0VCQ0xBVyddIHN2ZyB7XHJcbiAgY29sb3I6IHZhcigtLWRzdy1zdGF0aWMtZGVlcHNlZWstNTAwKSAhaW1wb3J0YW50O1xyXG4gIC0tZHNoLWZpbGUtdHlwZS1pY29uLWNvbG9yOiB2YXIoLS1kc3ctc3RhdGljLWRlZXBzZWVrLTUwMCk7XHJcbiAgLS1kc2gtZmlsZS10eXBlLWRlZmF1bHQtY29sb3I6IHZhcigtLWRzdy1zdGF0aWMtZGVlcHNlZWstNTAwKTtcclxufVxyXG5bZGF0YS13ZWJjbGF3LXByZXZpZXddIHtcclxuICBkaXNwbGF5OiBmbGV4O1xyXG4gIGZsZXg6IDE7XHJcbiAgbWluLWhlaWdodDogMDtcclxuICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG59XHJcbltkYXRhLXdlYmNsYXctcHJldmlld10gPiAqIHtcclxuICBmbGV4OiAxO1xyXG4gIG1pbi1oZWlnaHQ6IDA7XHJcbn1cclxuYFxyXG4iLCAiLyoqIExvY2FsZSBmb3IgdGhlIHdlYmNsYXctbGl2ZSBzaWRlYmFyIHRhYi4gKi9cclxuaW1wb3J0IHR5cGUge30gZnJvbSAnQGRlZXBzZWVrLWFpL2RzaC1jbGllbnQtdWktc2xvdHMnXHJcblxyXG5kZWNsYXJlIG1vZHVsZSAnQGRlZXBzZWVrLWFpL2RzaC1jbGllbnQtdWktc2xvdHMnIHtcclxuICBpbnRlcmZhY2UgTG9jYWxlTmFtZXNwYWNlTWFwIHtcclxuICAgIHdlYmNsYXdMaXZlOiBrZXlvZiB0eXBlb2YgemhcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCB6aCA9IHtcclxuICB0aXRsZTogJ1x1NjI2N1x1ODg0Q1x1NzUzQlx1OTc2MicsXHJcbiAgd2FpdGluZzogJ1x1N0I0OVx1NUY4NVx1NjI2N1x1ODg0Q1x1MjAyNicsXHJcbiAgb2ZmbGluZTogJ1x1OTg4NFx1ODlDOFx1NjcyQVx1NUMzMVx1N0VFQScsXHJcbiAgbm9JbWFnZTogJ1x1NjY4Mlx1NjVFMFx1NzUzQlx1OTc2MicsXHJcbiAgcGxhY2Vob2xkZXI6ICdcdTdCNDlcdTVGODVcdTc1M0JcdTk3NjJcdTIwMjYnLFxyXG4gIGxpdmU6ICdcdTVCOUVcdTY1RjYnLFxyXG4gIHNjcnViSGludDogJ1x1NjJENlx1NTJBOFx1NjdFNVx1NzcwQlx1OEZDN1x1N0EwQicsXHJcbiAgZ3VpZGVUaXRsZTogJ3dlYmNsYXcgXHU2MjY3XHU4ODRDXHU3NTNCXHU5NzYyJyxcclxuICBndWlkZURlc2M6ICdcdTY1RTBcdTU5MzRcdThGRDBcdTg4NENcdTY1RjZcdTU3MjhcdTZCNjRcdTU2REVcdTc3MEJcdTZCNjVcdTlBQTRcdTRFMEVcdTVCOUVcdTY1RjZcdTc1M0JcdTk3NjInLFxyXG4gIHBoYXNlSWRsZTogJ1x1N0E3QVx1OTVGMicsXHJcbiAgcGhhc2VSdW5uaW5nOiAnXHU2MjY3XHU4ODRDXHU0RTJEJyxcclxuICBwaGFzZU5lZWRIdW1hbjogJ1x1OTcwMFx1ODk4MVx1NEVCQVx1NURFNScsXHJcbiAgcGhhc2VDYW5jZWxsaW5nOiAnXHU1M0Q2XHU2RDg4XHU0RTJEJyxcclxuICBwaGFzZUNhbmNlbGxlZDogJ1x1NURGMlx1NTNENlx1NkQ4OCcsXHJcbiAgcGhhc2VEb25lOiAnXHU1REYyXHU3RUQzXHU2NzVGJyxcclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IGVuID0ge1xyXG4gIHRpdGxlOiAnTGl2ZSBydW4nLFxyXG4gIHdhaXRpbmc6ICdXYWl0aW5nXHUyMDI2JyxcclxuICBvZmZsaW5lOiAnUHJldmlldyBvZmZsaW5lJyxcclxuICBub0ltYWdlOiAnTm8gZnJhbWUgeWV0JyxcclxuICBwbGFjZWhvbGRlcjogJ1dhaXRpbmcgZm9yIGZyYW1lXHUyMDI2JyxcclxuICBsaXZlOiAnTGl2ZScsXHJcbiAgc2NydWJIaW50OiAnRHJhZyB0byByZXZpZXcnLFxyXG4gIGd1aWRlVGl0bGU6ICd3ZWJjbGF3IGxpdmUnLFxyXG4gIGd1aWRlRGVzYzogJ1NjcnViIHN0ZXAgZnJhbWVzIG9yIHN0YXkgb24gbGl2ZScsXHJcbiAgcGhhc2VJZGxlOiAnSWRsZScsXHJcbiAgcGhhc2VSdW5uaW5nOiAnUnVubmluZycsXHJcbiAgcGhhc2VOZWVkSHVtYW46ICdOZWVkcyBodW1hbicsXHJcbiAgcGhhc2VDYW5jZWxsaW5nOiAnQ2FuY2VsbGluZycsXHJcbiAgcGhhc2VDYW5jZWxsZWQ6ICdDYW5jZWxsZWQnLFxyXG4gIHBoYXNlRG9uZTogJ0RvbmUnLFxyXG59IHNhdGlzZmllcyBSZWNvcmQ8a2V5b2YgdHlwZW9mIHpoLCBzdHJpbmc+XHJcblxyXG5leHBvcnQgY29uc3QgTElWRV9OUyA9ICd3ZWJjbGF3TGl2ZSdcclxuIiwgIi8qKiBMb2NhbGUgZm9yIHRoZSBgQGxvbmsxOTg5L3dlYmNsYXdgIGAud2ViY2xhd2AgZG9jdW1lbnQgcHJldmlldy4gKi9cclxuaW1wb3J0IHR5cGUge30gZnJvbSAnQGRlZXBzZWVrLWFpL2RzaC1jbGllbnQtdWktc2xvdHMnXHJcblxyXG5kZWNsYXJlIG1vZHVsZSAnQGRlZXBzZWVrLWFpL2RzaC1jbGllbnQtdWktc2xvdHMnIHtcclxuICBpbnRlcmZhY2UgTG9jYWxlTmFtZXNwYWNlTWFwIHtcclxuICAgIC8qKiBXZWJjbGF3IHJlY2lwZSBwcmV2aWV3IGNocm9tZS4gKi9cclxuICAgIHdlYmNsYXdQcmV2aWV3OiBrZXlvZiB0eXBlb2YgemhcclxuICB9XHJcbn1cclxuXHJcbi8qKiBTaW1wbGlmaWVkIENoaW5lc2UgZGljdGlvbmFyeSBhbmQga2V5IHNvdXJjZS4gKi9cclxuZXhwb3J0IGNvbnN0IHpoID0ge1xyXG4gIHRpdGxlOiAnXHU4M0RDXHU4QzMxJyxcclxuICBjb3B5OiAnXHU1OTBEXHU1MjM2JyxcclxuICBjb3BpZWQ6ICdcdTVERjJcdTU5MERcdTUyMzYnLFxyXG4gIGNvZGVCbG9ja1RpdGxlOiAnXHU4M0RDXHU4QzMxJyxcclxuICB3cmFwOiAnXHU2MzYyXHU4ODRDJyxcclxuICB1bndyYXA6ICdcdTRFMERcdTYzNjJcdTg4NEMnLFxyXG4gIHBhcmFtc1RpdGxlOiAnXHU1M0VGXHU2NTM5XHU1M0MyXHU2NTcwXHVGRjA4XHU1OTFBXHU0RTNBXHU1MzYwXHU0RjREXHVGRjBDXHU4QkY3XHU3RjE2XHU4RjkxXHVGRjA5JyxcclxuICBwYXJhbXNIaW50OiAnXHU2NzA5IFx1NTNDMlx1NjU3MFx1MjAyNj0gXHU2NUY2XHU1MTQ4XHU1QzU1XHU3OTNBXHU0RTAwXHU1RjIwXHU1M0VGXHU3RjE2XHU4RjkxXHU4ODY4XHU4QkY3XHU3NTI4XHU2MjM3XHU2NTM5XHU1QjhDXHU1MThEXHU4REQxXHVGRjFCXHU1MkZGXHU5MDEwXHU5ODc5XHU4RkZEXHU5NUVFXHUzMDAyXHU0RUM1XHU3NTI4XHU2MjM3XHU2NjBFXHU3ODZFXHU4QkY0XHUzMDBDXHU3NTI4XHU5RUQ4XHU4QkE0XHUzMDBEXHU2MjREXHU1M0VGXHU0RTBEXHU2NTM5XHUzMDAyXHU2NzJDXHU4RjZFXHU1REYyXHU3RUQ5XHU5RjUwXHU1QjU3XHU2QkI1XHU1MjE5XHU1M0VGXHU3NkY0XHU2M0E1XHU4REQxXHUzMDAyJyxcclxufVxyXG5cclxuLyoqIEVuZ2xpc2ggZGljdGlvbmFyeSB3aXRoIHRoZSBzYW1lIGtleXMuICovXHJcbmV4cG9ydCBjb25zdCBlbiA9IHtcclxuICB0aXRsZTogJ1JlY2lwZScsXHJcbiAgY29weTogJ0NvcHknLFxyXG4gIGNvcGllZDogJ0NvcGllZCcsXHJcbiAgY29kZUJsb2NrVGl0bGU6ICdSZWNpcGUnLFxyXG4gIHdyYXA6ICdXcmFwJyxcclxuICB1bndyYXA6ICdVbndyYXAnLFxyXG4gIHBhcmFtc1RpdGxlOiAnRWRpdGFibGUgcGFyYW1zICh1c3VhbGx5IHBsYWNlaG9sZGVycyknLFxyXG4gIHBhcmFtc0hpbnQ6ICdPbiBydW4sIHNob3cgb25lIGVkaXRhYmxlIHRhYmxlIGZvciB0aGUgdXNlciB0byBjaGFuZ2UgdmFsdWVzLiBEbyBub3QgaW50ZXJ2aWV3IGZpZWxkLWJ5LWZpZWxkO1x1MzAwQ3VzZSBkZWZhdWx0c1x1MzAwRG9ubHkgaWYgYXNrZWQuJyxcclxufSBzYXRpc2ZpZXMgUmVjb3JkPGtleW9mIHR5cGVvZiB6aCwgc3RyaW5nPlxyXG5cclxuZXhwb3J0IGNvbnN0IE5TID0gJ3dlYmNsYXdQcmV2aWV3J1xyXG4iLCAiLyoqIExvY2FsZSBmb3IgdGhlIHdlYmNsYXdfcnVuIGluLWNoYXQgdG9vbHZpZXcuICovXHJcbmltcG9ydCB0eXBlIHt9IGZyb20gJ0BkZWVwc2Vlay1haS9kc2gtY2xpZW50LXVpLXNsb3RzJ1xyXG5cclxuZGVjbGFyZSBtb2R1bGUgJ0BkZWVwc2Vlay1haS9kc2gtY2xpZW50LXVpLXNsb3RzJyB7XHJcbiAgaW50ZXJmYWNlIExvY2FsZU5hbWVzcGFjZU1hcCB7XHJcbiAgICB3ZWJjbGF3UnVuVG9vbDoga2V5b2YgdHlwZW9mIHpoXHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgY29uc3QgemggPSB7XHJcbiAgcGVuZGluZzogJ1x1NkI2M1x1NTcyOFx1NjI2N1x1ODg0Q1x1ODNEQ1x1OEMzMVx1MjAyNicsXHJcbiAgd2FpdGluZ1N0YXJ0OiAnXHU4QkY3XHU1MTQ4XHU3ODZFXHU4QkE0XHU4RkQwXHU4ODRDXHU1M0MyXHU2NTcwXHVGRjBDXHU3ODZFXHU4QkE0XHU1NDBFXHU1RjAwXHU1OUNCXHU2MjY3XHU4ODRDJyxcclxuICBvZmZsaW5lOiAnXHU2NzJDXHU2NzNBXHU2NUU1XHU1RkQ3XHU2NzBEXHU1MkExXHU2NzJBXHU1QzMxXHU3RUVBJyxcclxuICBlbXB0eTogJ1x1N0I0OVx1NUY4NVx1NkI2NVx1OUFBNFx1NjVFNVx1NUZEN1x1MjAyNicsXHJcbiAgcGxhY2Vob2xkZXI6ICdcdTdCNDlcdTVGODVcdTc1M0JcdTk3NjJcdTIwMjYnLFxyXG4gIGRvbmU6ICdcdTYyNjdcdTg4NENcdTdFRDNcdTY3NUYnLFxyXG4gIGZhaWxlZDogJ1x1NjI2N1x1ODg0Q1x1NTkzMVx1OEQyNScsXHJcbiAgY2FuY2VsbGVkOiAnXHU1REYyXHU1M0Q2XHU2RDg4JyxcclxuICBuZWVkSHVtYW46ICdcdTk3MDBcdTg5ODFcdTRFQkFcdTVERTVcdTc4NkVcdThCQTQnLFxyXG59XHJcblxyXG5leHBvcnQgY29uc3QgZW4gPSB7XHJcbiAgcGVuZGluZzogJ1J1bm5pbmcgcmVjaXBlXHUyMDI2JyxcclxuICB3YWl0aW5nU3RhcnQ6ICdDb25maXJtIHRoZSBydW4gcGFyYW1ldGVycyBmaXJzdDsgdGhlIHJ1biBzdGFydHMgYWZ0ZXIgdGhhdCcsXHJcbiAgb2ZmbGluZTogJ0xvY2FsIGxvZyBzZXJ2aWNlIG9mZmxpbmUnLFxyXG4gIGVtcHR5OiAnV2FpdGluZyBmb3Igc3RlcCBsb2dzXHUyMDI2JyxcclxuICBwbGFjZWhvbGRlcjogJ1dhaXRpbmcgZm9yIGZyYW1lXHUyMDI2JyxcclxuICBkb25lOiAnRmluaXNoZWQnLFxyXG4gIGZhaWxlZDogJ0ZhaWxlZCcsXHJcbiAgY2FuY2VsbGVkOiAnQ2FuY2VsbGVkJyxcclxuICBuZWVkSHVtYW46ICdOZWVkcyBodW1hbiBpbnB1dCcsXHJcbn0gc2F0aXNmaWVzIFJlY29yZDxrZXlvZiB0eXBlb2YgemgsIHN0cmluZz5cclxuXHJcbmV4cG9ydCBjb25zdCBSVU5fVE9PTF9OUyA9ICd3ZWJjbGF3UnVuVG9vbCdcclxuIiwgIi8qKlxyXG4gKiBSaWdodC1zaWRlYmFyIGJvZHk6IHNjcnViYmFibGUgbGl2ZS1wcmV2aWV3IHRpbWVsaW5lIChEb3ViYW8tc3R5bGUpLlxyXG4gKi9cclxuaW1wb3J0IHtcclxuICB1c2VDYWxsYmFjayxcclxuICB1c2VFZmZlY3QsXHJcbiAgdXNlUmVmLFxyXG4gIHVzZVN0YXRlLFxyXG4gIHR5cGUgQ1NTUHJvcGVydGllcyxcclxuICB0eXBlIFBvaW50ZXJFdmVudCBhcyBSZWFjdFBvaW50ZXJFdmVudCxcclxuICB0eXBlIFJlYWN0Tm9kZSxcclxufSBmcm9tICdyZWFjdCdcclxuaW1wb3J0IHR5cGUgeyBQcm9wc0xvY2FsZSB9IGZyb20gJ0BkZWVwc2Vlay1haS9kc2gtY2xpZW50LXVpLXNsb3RzJ1xyXG5pbXBvcnQgeyBMaXZlUHJldmlld0ltYWdlIH0gZnJvbSAnLi9MaXZlUHJldmlld0ltYWdlLmpzJ1xyXG5cclxuLyoqIE1pbmltYWwgdGFiIGluZm8gdXNlZCBieSB0aGUgbGl2ZSBib2R5IChmcmFtZXdvcmsgaW5qZWN0cyB0aGUgcmVzdCkuICovXHJcbmV4cG9ydCB0eXBlIFdlYmNsYXdMaXZlUHJvcHMgPSBQcm9wc0xvY2FsZTwnd2ViY2xhd0xpdmUnPiAmIHtcclxuICB1c2VUYWJJbmZvOiAoKSA9PiB7XHJcbiAgICB0YWI6IHtcclxuICAgICAgbmF2aWdhdGlvbj86IHtcclxuICAgICAgICBwYXJhbXM/OiB1bmtub3duXHJcbiAgICAgICAgcmV2aXNpb24/OiBudW1iZXJcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxufVxyXG5cclxuaW50ZXJmYWNlIExpdmVGcmFtZSB7XHJcbiAgaWQ6IG51bWJlclxyXG4gIGZpbGU6IHN0cmluZ1xyXG4gIHN0ZXA/OiBudW1iZXJcclxuICBrZXl3b3JkPzogc3RyaW5nXHJcbiAgYXQ/OiBzdHJpbmdcclxufVxyXG5cclxuY29uc3QgQ0FORElEQVRFX1BPUlRTID0gWzE5MjI5LCAxOTIzMCwgMTkyMzEsIDE5MjMyLCAxOTIzM11cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGZpbmRCYXNlKCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xyXG4gIGZvciAoY29uc3QgcG9ydCBvZiBDQU5ESURBVEVfUE9SVFMpIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGN0cmwgPSBuZXcgQWJvcnRDb250cm9sbGVyKClcclxuICAgICAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IGN0cmwuYWJvcnQoKSwgNTAwKVxyXG4gICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgaHR0cDovLzEyNy4wLjAuMToke3BvcnR9L2FwaS9oZWFsdGhgLCB7XHJcbiAgICAgICAgc2lnbmFsOiBjdHJsLnNpZ25hbCxcclxuICAgICAgfSlcclxuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKVxyXG4gICAgICBpZiAoIXJlcy5vaykgY29udGludWVcclxuICAgICAgY29uc3QgaiA9IChhd2FpdCByZXMuanNvbigpKSBhcyB7IG9rPzogYm9vbGVhbjsgc2VydmljZT86IHN0cmluZyB9XHJcbiAgICAgIGlmIChqLm9rICYmIGouc2VydmljZSA9PT0gJ3dlYmNsYXctYWNjb3VudHMtdWknKSB7XHJcbiAgICAgICAgcmV0dXJuIGBodHRwOi8vMTI3LjAuMC4xOiR7cG9ydH1gXHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2gge1xyXG4gICAgICAvKiBuZXh0ICovXHJcbiAgICB9XHJcbiAgfVxyXG4gIHJldHVybiBudWxsXHJcbn1cclxuXHJcbmZ1bmN0aW9uIHJ1bkRpckZyb21OYXYocGFyYW1zOiB1bmtub3duKTogc3RyaW5nIHtcclxuICBpZiAoIXBhcmFtcyB8fCB0eXBlb2YgcGFyYW1zICE9PSAnb2JqZWN0JykgcmV0dXJuICcnXHJcbiAgY29uc3QgcCA9IHBhcmFtcyBhcyB7IHJ1bkRpcj86IHVua25vd24gfVxyXG4gIHJldHVybiB0eXBlb2YgcC5ydW5EaXIgPT09ICdzdHJpbmcnID8gcC5ydW5EaXIudHJpbSgpIDogJydcclxufVxyXG5cclxuZnVuY3Rpb24gZnJhbWVMYWJlbChmcmFtZTogTGl2ZUZyYW1lIHwgdW5kZWZpbmVkLCBmYWxsYmFjazogc3RyaW5nKTogc3RyaW5nIHtcclxuICBjb25zdCBrdyA9IGZyYW1lPy5rZXl3b3JkPy50cmltKClcclxuICBpZiAoa3cpIHJldHVybiBrd1xyXG4gIGlmICh0eXBlb2YgZnJhbWU/LnN0ZXAgPT09ICdudW1iZXInICYmIGZyYW1lLnN0ZXAgPiAwKSByZXR1cm4gYCMke2ZyYW1lLnN0ZXB9YFxyXG4gIHJldHVybiBmYWxsYmFja1xyXG59XHJcblxyXG5mdW5jdGlvbiBwbmdVcmwoYmFzZTogc3RyaW5nLCBydW5EaXI6IHN0cmluZywgZnJhbWVJZDogbnVtYmVyIHwgbnVsbCwgYnVzdDogc3RyaW5nKTogc3RyaW5nIHtcclxuICBjb25zdCBxID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7IHJ1bkRpciB9KVxyXG4gIGlmIChmcmFtZUlkICE9IG51bGwpIHEuc2V0KCdmcmFtZScsIFN0cmluZyhmcmFtZUlkKSlcclxuICBxLnNldCgndCcsIGJ1c3QpXHJcbiAgcmV0dXJuIGAke2Jhc2V9L2FwaS9saXZlL3BuZz8ke3EudG9TdHJpbmcoKX1gXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBMaXZlIGV4ZWN1dGlvbiBwcmV2aWV3IHdpdGggc2NydWJiZXIgKyBMaXZlIG1vZGUuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gV2ViY2xhd0xpdmUoeyB0LCB1c2VUYWJJbmZvIH06IFdlYmNsYXdMaXZlUHJvcHMpOiBSZWFjdE5vZGUge1xyXG4gIGNvbnN0IHsgdGFiIH0gPSB1c2VUYWJJbmZvKClcclxuICBjb25zdCBuYXZSdW5EaXIgPSBydW5EaXJGcm9tTmF2KHRhYi5uYXZpZ2F0aW9uPy5wYXJhbXMpXHJcbiAgY29uc3QgW2Jhc2UsIHNldEJhc2VdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbClcclxuICBjb25zdCBbcnVuRGlyLCBzZXRSdW5EaXJdID0gdXNlU3RhdGUobmF2UnVuRGlyKVxyXG4gIGNvbnN0IFtmcmFtZXMsIHNldEZyYW1lc10gPSB1c2VTdGF0ZTxMaXZlRnJhbWVbXT4oW10pXHJcbiAgY29uc3QgW2luZGV4LCBzZXRJbmRleF0gPSB1c2VTdGF0ZSgwKVxyXG4gIGNvbnN0IFtsaXZlLCBzZXRMaXZlXSA9IHVzZVN0YXRlKHRydWUpXHJcbiAgY29uc3QgW2ltZ1VybCwgc2V0SW1nVXJsXSA9IHVzZVN0YXRlKCcnKVxyXG4gIGNvbnN0IFtlcnJvciwgc2V0RXJyb3JdID0gdXNlU3RhdGUoJycpXHJcbiAgY29uc3QgW2RyYWdnaW5nLCBzZXREcmFnZ2luZ10gPSB1c2VTdGF0ZShmYWxzZSlcclxuICBjb25zdCBbcGhhc2UsIHNldFBoYXNlXSA9IHVzZVN0YXRlPHN0cmluZz4oJ2lkbGUnKVxyXG4gIGNvbnN0IFtwaGFzZUhpbnQsIHNldFBoYXNlSGludF0gPSB1c2VTdGF0ZSgnJylcclxuXHJcbiAgY29uc3QgbGl2ZVJlZiA9IHVzZVJlZih0cnVlKVxyXG4gIGNvbnN0IGRyYWdnaW5nUmVmID0gdXNlUmVmKGZhbHNlKVxyXG4gIGNvbnN0IGluZGV4UmVmID0gdXNlUmVmKDApXHJcbiAgY29uc3QgdHJhY2tSZWYgPSB1c2VSZWY8SFRNTERpdkVsZW1lbnQgfCBudWxsPihudWxsKVxyXG5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgbGl2ZVJlZi5jdXJyZW50ID0gbGl2ZVxyXG4gIH0sIFtsaXZlXSlcclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgZHJhZ2dpbmdSZWYuY3VycmVudCA9IGRyYWdnaW5nXHJcbiAgfSwgW2RyYWdnaW5nXSlcclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaW5kZXhSZWYuY3VycmVudCA9IGluZGV4XHJcbiAgfSwgW2luZGV4XSlcclxuXHJcbiAgY29uc3QgaGFyZFJlc2V0UHJldmlldyA9IHVzZUNhbGxiYWNrKChuZXh0UnVuRGlyOiBzdHJpbmcpID0+IHtcclxuICAgIHNldFJ1bkRpcihuZXh0UnVuRGlyKVxyXG4gICAgc2V0RnJhbWVzKFtdKVxyXG4gICAgc2V0SW1nVXJsKCcnKVxyXG4gICAgc2V0SW5kZXgoMClcclxuICAgIGluZGV4UmVmLmN1cnJlbnQgPSAwXHJcbiAgICBzZXRFcnJvcignJylcclxuICAgIHNldExpdmUodHJ1ZSlcclxuICAgIGxpdmVSZWYuY3VycmVudCA9IHRydWVcclxuICAgIHNldERyYWdnaW5nKGZhbHNlKVxyXG4gICAgZHJhZ2dpbmdSZWYuY3VycmVudCA9IGZhbHNlXHJcbiAgICBzZXRQaGFzZSgnaWRsZScpXHJcbiAgICBzZXRQaGFzZUhpbnQoJycpXHJcbiAgfSwgW10pXHJcblxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBpZiAoIW5hdlJ1bkRpcikgcmV0dXJuXHJcbiAgICBpZiAobmF2UnVuRGlyID09PSBydW5EaXIpIHJldHVyblxyXG4gICAgaGFyZFJlc2V0UHJldmlldyhuYXZSdW5EaXIpXHJcbiAgfSwgW25hdlJ1bkRpciwgdGFiLm5hdmlnYXRpb24/LnJldmlzaW9uLCBydW5EaXIsIGhhcmRSZXNldFByZXZpZXddKVxyXG5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgbGV0IGNhbmNlbGxlZCA9IGZhbHNlXHJcbiAgICB2b2lkIChhc3luYyAoKSA9PiB7XHJcbiAgICAgIGNvbnN0IGZvdW5kID0gYXdhaXQgZmluZEJhc2UoKVxyXG4gICAgICBpZiAoIWNhbmNlbGxlZCkgc2V0QmFzZShmb3VuZClcclxuICAgIH0pKClcclxuICAgIHJldHVybiAoKSA9PiB7XHJcbiAgICAgIGNhbmNlbGxlZCA9IHRydWVcclxuICAgIH1cclxuICB9LCBbXSlcclxuXHJcbiAgY29uc3QgZ29MaXZlID0gdXNlQ2FsbGJhY2soKCkgPT4ge1xyXG4gICAgc2V0TGl2ZSh0cnVlKVxyXG4gICAgbGl2ZVJlZi5jdXJyZW50ID0gdHJ1ZVxyXG4gICAgc2V0RnJhbWVzKHByZXYgPT4ge1xyXG4gICAgICBpZiAocHJldi5sZW5ndGgpIHNldEluZGV4KHByZXYubGVuZ3RoIC0gMSlcclxuICAgICAgcmV0dXJuIHByZXZcclxuICAgIH0pXHJcbiAgfSwgW10pXHJcblxyXG4gIGNvbnN0IGFwcGx5U2NydWJJbmRleCA9IHVzZUNhbGxiYWNrKFxyXG4gICAgKG5leHQ6IG51bWJlciwgbGlzdDogTGl2ZUZyYW1lW10sIGFjdGl2ZVJ1bkRpcj86IHN0cmluZywgYWN0aXZlQmFzZT86IHN0cmluZykgPT4ge1xyXG4gICAgICBpZiAoIWxpc3QubGVuZ3RoKSByZXR1cm5cclxuICAgICAgY29uc3QgY2xhbXBlZCA9IE1hdGgubWF4KDAsIE1hdGgubWluKGxpc3QubGVuZ3RoIC0gMSwgbmV4dCkpXHJcbiAgICAgIGluZGV4UmVmLmN1cnJlbnQgPSBjbGFtcGVkXHJcbiAgICAgIHNldEluZGV4KGNsYW1wZWQpXHJcbiAgICAgIGNvbnN0IGF0RW5kID0gY2xhbXBlZCA+PSBsaXN0Lmxlbmd0aCAtIDFcclxuICAgICAgc2V0TGl2ZShhdEVuZClcclxuICAgICAgbGl2ZVJlZi5jdXJyZW50ID0gYXRFbmRcclxuICAgICAgY29uc3QgYiA9IGFjdGl2ZUJhc2UgfHwgYmFzZVxyXG4gICAgICBjb25zdCByZCA9IGFjdGl2ZVJ1bkRpciB8fCBydW5EaXJcclxuICAgICAgY29uc3QgZnJhbWUgPSBsaXN0W2NsYW1wZWRdXHJcbiAgICAgIGlmIChiICYmIHJkICYmIGZyYW1lKSB7XHJcbiAgICAgICAgc2V0SW1nVXJsKHBuZ1VybChiLCByZCwgZnJhbWUuaWQsIFN0cmluZyhmcmFtZS5hdCB8fCBmcmFtZS5pZCkpKVxyXG4gICAgICB9XHJcbiAgICB9LFxyXG4gICAgW2Jhc2UsIHJ1bkRpcl0sXHJcbiAgKVxyXG5cclxuICBjb25zdCBpbmRleEZyb21DbGllbnRYID0gdXNlQ2FsbGJhY2soKGNsaWVudFg6IG51bWJlciwgbGlzdExlbjogbnVtYmVyKSA9PiB7XHJcbiAgICBjb25zdCBlbCA9IHRyYWNrUmVmLmN1cnJlbnRcclxuICAgIGlmICghZWwgfHwgbGlzdExlbiA8PSAxKSByZXR1cm4gMFxyXG4gICAgY29uc3QgcmVjdCA9IGVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpXHJcbiAgICBjb25zdCByYXRpbyA9IE1hdGgubWF4KDAsIE1hdGgubWluKDEsIChjbGllbnRYIC0gcmVjdC5sZWZ0KSAvIHJlY3Qud2lkdGgpKVxyXG4gICAgcmV0dXJuIE1hdGgucm91bmQocmF0aW8gKiAobGlzdExlbiAtIDEpKVxyXG4gIH0sIFtdKVxyXG5cclxuICBjb25zdCBvblRyYWNrUG9pbnRlckRvd24gPSB1c2VDYWxsYmFjayhcclxuICAgIChlOiBSZWFjdFBvaW50ZXJFdmVudDxIVE1MRGl2RWxlbWVudD4pID0+IHtcclxuICAgICAgaWYgKCFmcmFtZXMubGVuZ3RoKSByZXR1cm5cclxuICAgICAgZS5jdXJyZW50VGFyZ2V0LnNldFBvaW50ZXJDYXB0dXJlKGUucG9pbnRlcklkKVxyXG4gICAgICBzZXREcmFnZ2luZyh0cnVlKVxyXG4gICAgICBkcmFnZ2luZ1JlZi5jdXJyZW50ID0gdHJ1ZVxyXG4gICAgICBhcHBseVNjcnViSW5kZXgoaW5kZXhGcm9tQ2xpZW50WChlLmNsaWVudFgsIGZyYW1lcy5sZW5ndGgpLCBmcmFtZXMpXHJcbiAgICB9LFxyXG4gICAgW2FwcGx5U2NydWJJbmRleCwgZnJhbWVzLCBpbmRleEZyb21DbGllbnRYXSxcclxuICApXHJcblxyXG4gIGNvbnN0IG9uVHJhY2tQb2ludGVyTW92ZSA9IHVzZUNhbGxiYWNrKFxyXG4gICAgKGU6IFJlYWN0UG9pbnRlckV2ZW50PEhUTUxEaXZFbGVtZW50PikgPT4ge1xyXG4gICAgICBpZiAoIWRyYWdnaW5nUmVmLmN1cnJlbnQgfHwgIWZyYW1lcy5sZW5ndGgpIHJldHVyblxyXG4gICAgICBhcHBseVNjcnViSW5kZXgoaW5kZXhGcm9tQ2xpZW50WChlLmNsaWVudFgsIGZyYW1lcy5sZW5ndGgpLCBmcmFtZXMpXHJcbiAgICB9LFxyXG4gICAgW2FwcGx5U2NydWJJbmRleCwgZnJhbWVzLCBpbmRleEZyb21DbGllbnRYXSxcclxuICApXHJcblxyXG4gIGNvbnN0IG9uVHJhY2tQb2ludGVyVXAgPSB1c2VDYWxsYmFjaygoZTogUmVhY3RQb2ludGVyRXZlbnQ8SFRNTERpdkVsZW1lbnQ+KSA9PiB7XHJcbiAgICB0cnkge1xyXG4gICAgICBlLmN1cnJlbnRUYXJnZXQucmVsZWFzZVBvaW50ZXJDYXB0dXJlKGUucG9pbnRlcklkKVxyXG4gICAgfSBjYXRjaCB7XHJcbiAgICAgIC8qIGlnbm9yZSAqL1xyXG4gICAgfVxyXG4gICAgc2V0RHJhZ2dpbmcoZmFsc2UpXHJcbiAgICBkcmFnZ2luZ1JlZi5jdXJyZW50ID0gZmFsc2VcclxuICB9LCBbXSlcclxuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGlmICghYmFzZSkgcmV0dXJuXHJcbiAgICBsZXQgY2FuY2VsbGVkID0gZmFsc2VcclxuICAgIGNvbnN0IHRpY2sgPSBhc3luYyAoKSA9PiB7XHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgZm9jdXNSZXMgPSBhd2FpdCBmZXRjaChgJHtiYXNlfS9hcGkvbGl2ZS9mb2N1c2AsIHtcclxuICAgICAgICAgIGNhY2hlOiAnbm8tc3RvcmUnLFxyXG4gICAgICAgIH0pXHJcbiAgICAgICAgY29uc3QgZm9jdXNKc29uID0gKGF3YWl0IGZvY3VzUmVzLmpzb24oKSkgYXMge1xyXG4gICAgICAgICAgb2s/OiBib29sZWFuXHJcbiAgICAgICAgICBmb2N1cz86IHsgcnVuRGlyPzogc3RyaW5nOyBzZXE/OiBudW1iZXIgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBmb2N1c2VkID0gZm9jdXNKc29uLmZvY3VzPy5ydW5EaXI/LnRyaW0oKSB8fCAnJ1xyXG4gICAgICAgIC8vIEZvY3VzIGlzIHNvdXJjZSBvZiB0cnV0aCB3aGlsZSBhIHJ1biBpcyBhY3RpdmUgXHUyMDE0IGRvbid0IHN0aWNrIG9uIGEgc3RhbGUgdGFiIHBhcmFtLlxyXG4gICAgICAgIGNvbnN0IGFjdGl2ZSA9IChmb2N1c2VkIHx8IHJ1bkRpcikudHJpbSgpXHJcbiAgICAgICAgaWYgKCFhY3RpdmUpIHtcclxuICAgICAgICAgIGlmICghY2FuY2VsbGVkKSB7XHJcbiAgICAgICAgICAgIHNldEVycm9yKCcnKVxyXG4gICAgICAgICAgICBzZXRGcmFtZXMoW10pXHJcbiAgICAgICAgICAgIHNldEltZ1VybCgnJylcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJldHVyblxyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBGb3JjZS1jbGVhciBvbGQgY2FwdGNoYS90aW1lbGluZSB0aGUgbW9tZW50IGZvY3VzIHN3aXRjaGVzIFx1MjAxNCBkb24ndCB3YWl0IGZvciBtZXRhLlxyXG4gICAgICAgIGlmIChmb2N1c2VkICYmIGZvY3VzZWQgIT09IHJ1bkRpcikge1xyXG4gICAgICAgICAgaWYgKCFjYW5jZWxsZWQpIGhhcmRSZXNldFByZXZpZXcoZm9jdXNlZClcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IG1ldGFSZXMgPSBhd2FpdCBmZXRjaChcclxuICAgICAgICAgIGAke2Jhc2V9L2FwaS9saXZlL21ldGE/cnVuRGlyPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGFjdGl2ZSl9JnQ9JHtEYXRlLm5vdygpfWAsXHJcbiAgICAgICAgICB7IGNhY2hlOiAnbm8tc3RvcmUnIH0sXHJcbiAgICAgICAgKVxyXG4gICAgICAgIGNvbnN0IG1ldGFKc29uID0gKGF3YWl0IG1ldGFSZXMuanNvbigpKSBhcyB7XHJcbiAgICAgICAgICBvaz86IGJvb2xlYW5cclxuICAgICAgICAgIG1ldGE/OiB7IGtleXdvcmQ/OiBzdHJpbmc7IHVwZGF0ZWRBdD86IHN0cmluZzsgZnJhbWVJZD86IG51bWJlciB9IHwgbnVsbFxyXG4gICAgICAgICAgZnJhbWVzPzogTGl2ZUZyYW1lW11cclxuICAgICAgICAgIGxhdGVzdElkPzogbnVtYmVyIHwgbnVsbFxyXG4gICAgICAgICAgaGFzUG5nPzogYm9vbGVhblxyXG4gICAgICAgICAgZXJyb3I/OiBzdHJpbmdcclxuICAgICAgICAgIHBoYXNlPzogc3RyaW5nXHJcbiAgICAgICAgICBoaW50Pzogc3RyaW5nXHJcbiAgICAgICAgICBwcmVmZXJMaXZlUHJldmlldz86IGJvb2xlYW5cclxuICAgICAgICB9XHJcbiAgICAgICAgaWYgKGNhbmNlbGxlZCkgcmV0dXJuXHJcbiAgICAgICAgaWYgKCFtZXRhSnNvbi5vaykge1xyXG4gICAgICAgICAgc2V0RXJyb3IobWV0YUpzb24uZXJyb3IgfHwgdCgnd2FpdGluZycpKVxyXG4gICAgICAgICAgcmV0dXJuXHJcbiAgICAgICAgfVxyXG4gICAgICAgIHNldEVycm9yKCcnKVxyXG4gICAgICAgIHNldFBoYXNlKG1ldGFKc29uLnBoYXNlIHx8ICdpZGxlJylcclxuICAgICAgICBzZXRQaGFzZUhpbnQodHlwZW9mIG1ldGFKc29uLmhpbnQgPT09ICdzdHJpbmcnID8gbWV0YUpzb24uaGludCA6ICcnKVxyXG5cclxuICAgICAgICBjb25zdCBuZXh0RnJhbWVzID0gQXJyYXkuaXNBcnJheShtZXRhSnNvbi5mcmFtZXMpID8gbWV0YUpzb24uZnJhbWVzIDogW11cclxuICAgICAgICBzZXRGcmFtZXMobmV4dEZyYW1lcylcclxuXHJcbiAgICAgICAgY29uc3QgZm9sbG93TGl2ZSA9IGxpdmVSZWYuY3VycmVudCAmJiAhZHJhZ2dpbmdSZWYuY3VycmVudFxyXG4gICAgICAgIGxldCB2aWV3SW5kZXggPSAwXHJcbiAgICAgICAgaWYgKG5leHRGcmFtZXMubGVuZ3RoKSB7XHJcbiAgICAgICAgICBpZiAoZm9sbG93TGl2ZSkge1xyXG4gICAgICAgICAgICB2aWV3SW5kZXggPSBuZXh0RnJhbWVzLmxlbmd0aCAtIDFcclxuICAgICAgICAgICAgaW5kZXhSZWYuY3VycmVudCA9IHZpZXdJbmRleFxyXG4gICAgICAgICAgICBzZXRJbmRleCh2aWV3SW5kZXgpXHJcbiAgICAgICAgICAgIHNldExpdmUodHJ1ZSlcclxuICAgICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICAgIHZpZXdJbmRleCA9IE1hdGgubWF4KFxyXG4gICAgICAgICAgICAgIDAsXHJcbiAgICAgICAgICAgICAgTWF0aC5taW4oaW5kZXhSZWYuY3VycmVudCwgbmV4dEZyYW1lcy5sZW5ndGggLSAxKSxcclxuICAgICAgICAgICAgKVxyXG4gICAgICAgICAgICBpbmRleFJlZi5jdXJyZW50ID0gdmlld0luZGV4XHJcbiAgICAgICAgICAgIHNldEluZGV4KHZpZXdJbmRleClcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGlmICghbWV0YUpzb24uaGFzUG5nICYmICFuZXh0RnJhbWVzLmxlbmd0aCkge1xyXG4gICAgICAgICAgc2V0SW1nVXJsKCcnKVxyXG4gICAgICAgICAgcmV0dXJuXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBmcmFtZSA9IG5leHRGcmFtZXNbdmlld0luZGV4XVxyXG4gICAgICAgIC8vIER1cmluZyBORUVEX0hVTUFOIC8gY2FuY2VsbGluZzogcHJlZmVyIGxpdmUtcHJldmlldy5wbmcgc28gc2NydWJiZXJcclxuICAgICAgICAvLyBpcyBub3Qgc3R1Y2sgb24gYSBwcmUtSElUTCBmcmFtZSBhZnRlciBrZXl3b3JkIGZpbHRlcmluZy5cclxuICAgICAgICBjb25zdCB1c2VMaXZlRmlsZSA9IEJvb2xlYW4oZm9sbG93TGl2ZSAmJiBtZXRhSnNvbi5wcmVmZXJMaXZlUHJldmlldylcclxuICAgICAgICBjb25zdCBmcmFtZUlkID0gdXNlTGl2ZUZpbGUgPyBudWxsIDogKGZyYW1lPy5pZCA/PyBudWxsKVxyXG4gICAgICAgIGNvbnN0IGJ1c3QgPSBTdHJpbmcoXHJcbiAgICAgICAgICBmb2xsb3dMaXZlXHJcbiAgICAgICAgICAgID8gbWV0YUpzb24ubWV0YT8udXBkYXRlZEF0IHx8XHJcbiAgICAgICAgICAgICAgICBtZXRhSnNvbi5sYXRlc3RJZCB8fFxyXG4gICAgICAgICAgICAgICAgZnJhbWU/LmF0IHx8XHJcbiAgICAgICAgICAgICAgICBEYXRlLm5vdygpXHJcbiAgICAgICAgICAgIDogZnJhbWU/LmF0IHx8IGZyYW1lPy5pZCB8fCBEYXRlLm5vdygpLFxyXG4gICAgICAgIClcclxuICAgICAgICBzZXRJbWdVcmwocG5nVXJsKGJhc2UsIGFjdGl2ZSwgZnJhbWVJZCwgYnVzdCkpXHJcbiAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICBpZiAoIWNhbmNlbGxlZCkge1xyXG4gICAgICAgICAgc2V0RXJyb3IoZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogdCgnb2ZmbGluZScpKVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgdm9pZCB0aWNrKClcclxuICAgIGNvbnN0IGlkID0gd2luZG93LnNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgdm9pZCB0aWNrKClcclxuICAgIH0sIDUwMClcclxuICAgIHJldHVybiAoKSA9PiB7XHJcbiAgICAgIGNhbmNlbGxlZCA9IHRydWVcclxuICAgICAgd2luZG93LmNsZWFySW50ZXJ2YWwoaWQpXHJcbiAgICB9XHJcbiAgfSwgW2Jhc2UsIHJ1bkRpciwgdCwgaGFyZFJlc2V0UHJldmlld10pXHJcblxyXG4gIGlmICghYmFzZSkge1xyXG4gICAgcmV0dXJuIChcclxuICAgICAgPGRpdiBzdHlsZT17eyBwYWRkaW5nOiAxNiwgZm9udFNpemU6IDEzLCBvcGFjaXR5OiAwLjggfX0+e3QoJ29mZmxpbmUnKX08L2Rpdj5cclxuICAgIClcclxuICB9XHJcblxyXG4gIGlmICghcnVuRGlyICYmICFmcmFtZXMubGVuZ3RoICYmICFpbWdVcmwpIHtcclxuICAgIHJldHVybiAoXHJcbiAgICAgIDxkaXYgc3R5bGU9e3sgcGFkZGluZzogMTYsIGZvbnRTaXplOiAxMywgb3BhY2l0eTogMC44IH19Pnt0KCd3YWl0aW5nJyl9PC9kaXY+XHJcbiAgICApXHJcbiAgfVxyXG5cclxuICBjb25zdCBjdXJyZW50ID0gZnJhbWVzW01hdGgubWluKGluZGV4LCBNYXRoLm1heCgwLCBmcmFtZXMubGVuZ3RoIC0gMSkpXVxyXG4gIGNvbnN0IGxhYmVsID0gbGl2ZSA/IHQoJ2xpdmUnKSA6IGZyYW1lTGFiZWwoY3VycmVudCwgdCgnc2NydWJIaW50JykpXHJcbiAgY29uc3QgbWF4SWR4ID0gTWF0aC5tYXgoMCwgZnJhbWVzLmxlbmd0aCAtIDEpXHJcbiAgY29uc3QgcHJvZ3Jlc3MgPSBtYXhJZHggPT09IDAgPyAxIDogaW5kZXggLyBtYXhJZHhcclxuXHJcbiAgY29uc3QgcGhhc2VMYWJlbCA9ICgoKSA9PiB7XHJcbiAgICBzd2l0Y2ggKHBoYXNlKSB7XHJcbiAgICAgIGNhc2UgJ3J1bm5pbmcnOlxyXG4gICAgICAgIHJldHVybiB0KCdwaGFzZVJ1bm5pbmcnKVxyXG4gICAgICBjYXNlICduZWVkX2h1bWFuJzpcclxuICAgICAgICByZXR1cm4gdCgncGhhc2VOZWVkSHVtYW4nKVxyXG4gICAgICBjYXNlICdjYW5jZWxsaW5nJzpcclxuICAgICAgICByZXR1cm4gdCgncGhhc2VDYW5jZWxsaW5nJylcclxuICAgICAgY2FzZSAnY2FuY2VsbGVkJzpcclxuICAgICAgICByZXR1cm4gdCgncGhhc2VDYW5jZWxsZWQnKVxyXG4gICAgICBjYXNlICdkb25lJzpcclxuICAgICAgICByZXR1cm4gdCgncGhhc2VEb25lJylcclxuICAgICAgZGVmYXVsdDpcclxuICAgICAgICByZXR1cm4gdCgncGhhc2VJZGxlJylcclxuICAgIH1cclxuICB9KSgpXHJcbiAgY29uc3QgcGhhc2VUb25lID1cclxuICAgIHBoYXNlID09PSAnbmVlZF9odW1hbidcclxuICAgICAgPyB7IGJnOiAnI2VhNTgwYycsIGZnOiAnIzlhMzQxMicgfVxyXG4gICAgICA6IHBoYXNlID09PSAnY2FuY2VsbGVkJyB8fCBwaGFzZSA9PT0gJ2NhbmNlbGxpbmcnXHJcbiAgICAgICAgPyB7IGJnOiAnI2RjMjYyNicsIGZnOiAnIzk5MWIxYicgfVxyXG4gICAgICAgIDogcGhhc2UgPT09ICdydW5uaW5nJ1xyXG4gICAgICAgICAgPyB7IGJnOiAnIzE2YTM0YScsIGZnOiAnIzE1ODAzZCcgfVxyXG4gICAgICAgICAgOiB7IGJnOiAnY3VycmVudENvbG9yJywgZmc6ICdpbmhlcml0JyB9XHJcblxyXG4gIGNvbnN0IHBoYXNlQ2hpcFN0eWxlOiBDU1NQcm9wZXJ0aWVzID0ge1xyXG4gICAgYm9yZGVyOiAnbm9uZScsXHJcbiAgICBmb250U2l6ZTogMTIsXHJcbiAgICBmb250V2VpZ2h0OiA2MDAsXHJcbiAgICBwYWRkaW5nOiAnNHB4IDEwcHgnLFxyXG4gICAgYm9yZGVyUmFkaXVzOiA5OTksXHJcbiAgICBiYWNrZ3JvdW5kOiBgY29sb3ItbWl4KGluIHNyZ2IsICR7cGhhc2VUb25lLmJnfSAxOCUsIHRyYW5zcGFyZW50KWAsXHJcbiAgICBjb2xvcjogcGhhc2VUb25lLmZnLFxyXG4gICAgYm94U2hhZG93OiBgMCAwIDAgMXB4IGNvbG9yLW1peChpbiBzcmdiLCAke3BoYXNlVG9uZS5iZ30gNDAlLCB0cmFuc3BhcmVudClgLFxyXG4gICAgbWF4V2lkdGg6IDE2MCxcclxuICAgIG92ZXJmbG93OiAnaGlkZGVuJyxcclxuICAgIHRleHRPdmVyZmxvdzogJ2VsbGlwc2lzJyxcclxuICAgIHdoaXRlU3BhY2U6ICdub3dyYXAnLFxyXG4gIH1cclxuXHJcbiAgY29uc3QgY2hpcFN0eWxlOiBDU1NQcm9wZXJ0aWVzID0ge1xyXG4gICAgYm9yZGVyOiAnbm9uZScsXHJcbiAgICBjdXJzb3I6ICdwb2ludGVyJyxcclxuICAgIGZvbnRTaXplOiAxMixcclxuICAgIGZvbnRXZWlnaHQ6IDYwMCxcclxuICAgIHBhZGRpbmc6ICc0cHggMTBweCcsXHJcbiAgICBib3JkZXJSYWRpdXM6IDk5OSxcclxuICAgIHRyYW5zaXRpb246ICdiYWNrZ3JvdW5kIDE2MG1zIGVhc2UsIGNvbG9yIDE2MG1zIGVhc2UsIGJveC1zaGFkb3cgMTYwbXMgZWFzZScsXHJcbiAgICBiYWNrZ3JvdW5kOiBsaXZlXHJcbiAgICAgID8gJ2NvbG9yLW1peChpbiBzcmdiLCAjMTZhMzRhIDIyJSwgdHJhbnNwYXJlbnQpJ1xyXG4gICAgICA6ICdjb2xvci1taXgoaW4gc3JnYiwgY3VycmVudENvbG9yIDglLCB0cmFuc3BhcmVudCknLFxyXG4gICAgY29sb3I6IGxpdmUgPyAnIzE1ODAzZCcgOiAnaW5oZXJpdCcsXHJcbiAgICBib3hTaGFkb3c6IGxpdmUgPyAnMCAwIDAgMXB4IGNvbG9yLW1peChpbiBzcmdiLCAjMTZhMzRhIDQ1JSwgdHJhbnNwYXJlbnQpJyA6ICdub25lJyxcclxuICAgIG9wYWNpdHk6IGxpdmUgPyAxIDogMC43NSxcclxuICB9XHJcblxyXG4gIHJldHVybiAoXHJcbiAgICA8ZGl2XHJcbiAgICAgIGRhdGEtd2ViY2xhdy1saXZlPVwiXCJcclxuICAgICAgc3R5bGU9e3tcclxuICAgICAgICBkaXNwbGF5OiAnZmxleCcsXHJcbiAgICAgICAgZmxleERpcmVjdGlvbjogJ2NvbHVtbicsXHJcbiAgICAgICAgaGVpZ2h0OiAnMTAwJScsXHJcbiAgICAgICAgbWluSGVpZ2h0OiAwLFxyXG4gICAgICAgIHBhZGRpbmc6IDEyLFxyXG4gICAgICAgIGdhcDogMTAsXHJcbiAgICAgICAgYm94U2l6aW5nOiAnYm9yZGVyLWJveCcsXHJcbiAgICAgIH19XHJcbiAgICA+XHJcbiAgICAgIDxkaXZcclxuICAgICAgICBzdHlsZT17e1xyXG4gICAgICAgICAgZGlzcGxheTogJ2ZsZXgnLFxyXG4gICAgICAgICAgYWxpZ25JdGVtczogJ2NlbnRlcicsXHJcbiAgICAgICAgICBqdXN0aWZ5Q29udGVudDogJ3NwYWNlLWJldHdlZW4nLFxyXG4gICAgICAgICAgZ2FwOiA4LFxyXG4gICAgICAgICAgbWluSGVpZ2h0OiAyOCxcclxuICAgICAgICB9fVxyXG4gICAgICA+XHJcbiAgICAgICAgPGRpdlxyXG4gICAgICAgICAgc3R5bGU9e3tcclxuICAgICAgICAgICAgZGlzcGxheTogJ2ZsZXgnLFxyXG4gICAgICAgICAgICBhbGlnbkl0ZW1zOiAnY2VudGVyJyxcclxuICAgICAgICAgICAgZ2FwOiA4LFxyXG4gICAgICAgICAgICBtaW5XaWR0aDogMCxcclxuICAgICAgICAgICAgZmxleDogMSxcclxuICAgICAgICAgIH19XHJcbiAgICAgICAgPlxyXG4gICAgICAgICAgPHNwYW4gc3R5bGU9e3BoYXNlQ2hpcFN0eWxlfSB0aXRsZT17cGhhc2VIaW50IHx8IHBoYXNlTGFiZWx9PlxyXG4gICAgICAgICAgICB7cGhhc2VMYWJlbH1cclxuICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgc3R5bGU9e3tcclxuICAgICAgICAgICAgICBmb250U2l6ZTogMTMsXHJcbiAgICAgICAgICAgICAgZm9udFdlaWdodDogNjAwLFxyXG4gICAgICAgICAgICAgIG92ZXJmbG93OiAnaGlkZGVuJyxcclxuICAgICAgICAgICAgICB0ZXh0T3ZlcmZsb3c6ICdlbGxpcHNpcycsXHJcbiAgICAgICAgICAgICAgd2hpdGVTcGFjZTogJ25vd3JhcCcsXHJcbiAgICAgICAgICAgICAgb3BhY2l0eTogbGl2ZSA/IDAuNTUgOiAwLjksXHJcbiAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgIHRpdGxlPXtsaXZlID8gdCgnbGl2ZScpIDogZnJhbWVMYWJlbChjdXJyZW50LCAnJyl9XHJcbiAgICAgICAgICA+XHJcbiAgICAgICAgICAgIHtsaXZlID8gdCgnc2NydWJIaW50JykgOiBsYWJlbH1cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDxidXR0b24gdHlwZT1cImJ1dHRvblwiIHN0eWxlPXtjaGlwU3R5bGV9IG9uQ2xpY2s9e2dvTGl2ZX0gYXJpYS1wcmVzc2VkPXtsaXZlfT5cclxuICAgICAgICAgIHtwaGFzZSA9PT0gJ2NhbmNlbGxlZCcgfHwgcGhhc2UgPT09ICdkb25lJyA/IHBoYXNlTGFiZWwgOiB0KCdsaXZlJyl9XHJcbiAgICAgICAgPC9idXR0b24+XHJcbiAgICAgIDwvZGl2PlxyXG5cclxuICAgICAge2Vycm9yID8gKFxyXG4gICAgICAgIDxkaXYgc3R5bGU9e3sgY29sb3I6ICcjZGMyNjI2JywgZm9udFNpemU6IDEyIH19PntlcnJvcn08L2Rpdj5cclxuICAgICAgKSA6IG51bGx9XHJcblxyXG4gICAgICA8ZGl2XHJcbiAgICAgICAgc3R5bGU9e3tcclxuICAgICAgICAgIGZsZXg6IDEsXHJcbiAgICAgICAgICBtaW5IZWlnaHQ6IDE2MCxcclxuICAgICAgICAgIGJvcmRlclJhZGl1czogMTAsXHJcbiAgICAgICAgICBvdmVyZmxvdzogJ2hpZGRlbicsXHJcbiAgICAgICAgICBiYWNrZ3JvdW5kOiAnY29sb3ItbWl4KGluIHNyZ2IsIGN1cnJlbnRDb2xvciA2JSwgdHJhbnNwYXJlbnQpJyxcclxuICAgICAgICAgIGRpc3BsYXk6ICdmbGV4JyxcclxuICAgICAgICAgIGFsaWduSXRlbXM6ICdjZW50ZXInLFxyXG4gICAgICAgICAganVzdGlmeUNvbnRlbnQ6ICdjZW50ZXInLFxyXG4gICAgICAgICAgcGFkZGluZzogOCxcclxuICAgICAgICB9fVxyXG4gICAgICA+XHJcbiAgICAgICAgPExpdmVQcmV2aWV3SW1hZ2Ugc3JjPXtpbWdVcmx9IGxhYmVsPXt0KCdwbGFjZWhvbGRlcicpfSAvPlxyXG4gICAgICA8L2Rpdj5cclxuXHJcbiAgICAgIDxkaXZcclxuICAgICAgICByZWY9e3RyYWNrUmVmfVxyXG4gICAgICAgIHJvbGU9XCJzbGlkZXJcIlxyXG4gICAgICAgIGFyaWEtdmFsdWVtaW49ezB9XHJcbiAgICAgICAgYXJpYS12YWx1ZW1heD17bWF4SWR4fVxyXG4gICAgICAgIGFyaWEtdmFsdWVub3c9e2luZGV4fVxyXG4gICAgICAgIGFyaWEtbGFiZWw9e3QoJ3NjcnViSGludCcpfVxyXG4gICAgICAgIHRhYkluZGV4PXswfVxyXG4gICAgICAgIG9uUG9pbnRlckRvd249e29uVHJhY2tQb2ludGVyRG93bn1cclxuICAgICAgICBvblBvaW50ZXJNb3ZlPXtvblRyYWNrUG9pbnRlck1vdmV9XHJcbiAgICAgICAgb25Qb2ludGVyVXA9e29uVHJhY2tQb2ludGVyVXB9XHJcbiAgICAgICAgb25Qb2ludGVyQ2FuY2VsPXtvblRyYWNrUG9pbnRlclVwfVxyXG4gICAgICAgIG9uS2V5RG93bj17ZSA9PiB7XHJcbiAgICAgICAgICBpZiAoIWZyYW1lcy5sZW5ndGgpIHJldHVyblxyXG4gICAgICAgICAgaWYgKGUua2V5ID09PSAnQXJyb3dMZWZ0Jykge1xyXG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KClcclxuICAgICAgICAgICAgYXBwbHlTY3J1YkluZGV4KGluZGV4IC0gMSwgZnJhbWVzKVxyXG4gICAgICAgICAgfSBlbHNlIGlmIChlLmtleSA9PT0gJ0Fycm93UmlnaHQnKSB7XHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKVxyXG4gICAgICAgICAgICBhcHBseVNjcnViSW5kZXgoaW5kZXggKyAxLCBmcmFtZXMpXHJcbiAgICAgICAgICB9IGVsc2UgaWYgKGUua2V5ID09PSAnSG9tZScpIHtcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXHJcbiAgICAgICAgICAgIGFwcGx5U2NydWJJbmRleCgwLCBmcmFtZXMpXHJcbiAgICAgICAgICB9IGVsc2UgaWYgKGUua2V5ID09PSAnRW5kJykge1xyXG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KClcclxuICAgICAgICAgICAgYXBwbHlTY3J1YkluZGV4KG1heElkeCwgZnJhbWVzKVxyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH19XHJcbiAgICAgICAgc3R5bGU9e3tcclxuICAgICAgICAgIHBvc2l0aW9uOiAncmVsYXRpdmUnLFxyXG4gICAgICAgICAgaGVpZ2h0OiAyOCxcclxuICAgICAgICAgIGRpc3BsYXk6ICdmbGV4JyxcclxuICAgICAgICAgIGFsaWduSXRlbXM6ICdjZW50ZXInLFxyXG4gICAgICAgICAgY3Vyc29yOiBmcmFtZXMubGVuZ3RoID8gJ2V3LXJlc2l6ZScgOiAnZGVmYXVsdCcsXHJcbiAgICAgICAgICB0b3VjaEFjdGlvbjogJ25vbmUnLFxyXG4gICAgICAgICAgdXNlclNlbGVjdDogJ25vbmUnLFxyXG4gICAgICAgICAgcGFkZGluZ1RvcDogMixcclxuICAgICAgICB9fVxyXG4gICAgICA+XHJcbiAgICAgICAgPGRpdlxyXG4gICAgICAgICAgc3R5bGU9e3tcclxuICAgICAgICAgICAgcG9zaXRpb246ICdhYnNvbHV0ZScsXHJcbiAgICAgICAgICAgIGxlZnQ6IDAsXHJcbiAgICAgICAgICAgIHJpZ2h0OiAwLFxyXG4gICAgICAgICAgICBoZWlnaHQ6IDQsXHJcbiAgICAgICAgICAgIGJvcmRlclJhZGl1czogOTk5LFxyXG4gICAgICAgICAgICBiYWNrZ3JvdW5kOiAnY29sb3ItbWl4KGluIHNyZ2IsIGN1cnJlbnRDb2xvciAxNCUsIHRyYW5zcGFyZW50KScsXHJcbiAgICAgICAgICB9fVxyXG4gICAgICAgIC8+XHJcbiAgICAgICAgPGRpdlxyXG4gICAgICAgICAgc3R5bGU9e3tcclxuICAgICAgICAgICAgcG9zaXRpb246ICdhYnNvbHV0ZScsXHJcbiAgICAgICAgICAgIGxlZnQ6IDAsXHJcbiAgICAgICAgICAgIHdpZHRoOiBgJHtNYXRoLm1heCgyLCBwcm9ncmVzcyAqIDEwMCl9JWAsXHJcbiAgICAgICAgICAgIGhlaWdodDogNCxcclxuICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiA5OTksXHJcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IGxpdmVcclxuICAgICAgICAgICAgICA/ICdjb2xvci1taXgoaW4gc3JnYiwgIzE2YTM0YSA3MCUsIGN1cnJlbnRDb2xvciknXHJcbiAgICAgICAgICAgICAgOiAnY29sb3ItbWl4KGluIHNyZ2IsIGN1cnJlbnRDb2xvciA0NSUsIHRyYW5zcGFyZW50KScsXHJcbiAgICAgICAgICAgIHRyYW5zaXRpb246IGRyYWdnaW5nID8gJ25vbmUnIDogJ3dpZHRoIDEyMG1zIGVhc2UnLFxyXG4gICAgICAgICAgfX1cclxuICAgICAgICAvPlxyXG4gICAgICAgIHtmcmFtZXMubGVuZ3RoID4gMVxyXG4gICAgICAgICAgPyBmcmFtZXMubWFwKChmLCBpKSA9PiAoXHJcbiAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAga2V5PXtmLmlkfVxyXG4gICAgICAgICAgICAgICAgdGl0bGU9e2ZyYW1lTGFiZWwoZiwgJycpfVxyXG4gICAgICAgICAgICAgICAgc3R5bGU9e3tcclxuICAgICAgICAgICAgICAgICAgcG9zaXRpb246ICdhYnNvbHV0ZScsXHJcbiAgICAgICAgICAgICAgICAgIGxlZnQ6IGAkeyhpIC8gbWF4SWR4KSAqIDEwMH0lYCxcclxuICAgICAgICAgICAgICAgICAgd2lkdGg6IDIsXHJcbiAgICAgICAgICAgICAgICAgIGhlaWdodDogaSA9PT0gMCB8fCBpID09PSBtYXhJZHggPyA4IDogNSxcclxuICAgICAgICAgICAgICAgICAgbWFyZ2luTGVmdDogLTEsXHJcbiAgICAgICAgICAgICAgICAgIGJvcmRlclJhZGl1czogMSxcclxuICAgICAgICAgICAgICAgICAgYmFja2dyb3VuZDpcclxuICAgICAgICAgICAgICAgICAgICBpIDw9IGluZGV4XHJcbiAgICAgICAgICAgICAgICAgICAgICA/ICdjb2xvci1taXgoaW4gc3JnYiwgY3VycmVudENvbG9yIDU1JSwgdHJhbnNwYXJlbnQpJ1xyXG4gICAgICAgICAgICAgICAgICAgICAgOiAnY29sb3ItbWl4KGluIHNyZ2IsIGN1cnJlbnRDb2xvciAxOCUsIHRyYW5zcGFyZW50KScsXHJcbiAgICAgICAgICAgICAgICAgIHBvaW50ZXJFdmVudHM6ICdub25lJyxcclxuICAgICAgICAgICAgICAgIH19XHJcbiAgICAgICAgICAgICAgLz5cclxuICAgICAgICAgICAgKSlcclxuICAgICAgICAgIDogbnVsbH1cclxuICAgICAgICA8ZGl2XHJcbiAgICAgICAgICBzdHlsZT17e1xyXG4gICAgICAgICAgICBwb3NpdGlvbjogJ2Fic29sdXRlJyxcclxuICAgICAgICAgICAgbGVmdDogYCR7cHJvZ3Jlc3MgKiAxMDB9JWAsXHJcbiAgICAgICAgICAgIHdpZHRoOiAxNCxcclxuICAgICAgICAgICAgaGVpZ2h0OiAxNCxcclxuICAgICAgICAgICAgbWFyZ2luTGVmdDogLTcsXHJcbiAgICAgICAgICAgIGJvcmRlclJhZGl1czogJzUwJScsXHJcbiAgICAgICAgICAgIGJhY2tncm91bmQ6IGxpdmUgPyAnIzE2YTM0YScgOiAnY3VycmVudENvbG9yJyxcclxuICAgICAgICAgICAgYm94U2hhZG93OiBsaXZlXHJcbiAgICAgICAgICAgICAgPyAnMCAwIDAgNHB4IGNvbG9yLW1peChpbiBzcmdiLCAjMTZhMzRhIDI4JSwgdHJhbnNwYXJlbnQpJ1xyXG4gICAgICAgICAgICAgIDogJzAgMCAwIDNweCBjb2xvci1taXgoaW4gc3JnYiwgY3VycmVudENvbG9yIDEyJSwgdHJhbnNwYXJlbnQpJyxcclxuICAgICAgICAgICAgdHJhbnNpdGlvbjogZHJhZ2dpbmcgPyAnbm9uZScgOiAnbGVmdCAxMjBtcyBlYXNlLCBiYWNrZ3JvdW5kIDE2MG1zIGVhc2UnLFxyXG4gICAgICAgICAgICBwb2ludGVyRXZlbnRzOiAnbm9uZScsXHJcbiAgICAgICAgICB9fVxyXG4gICAgICAgIC8+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgPC9kaXY+XHJcbiAgKVxyXG59XHJcbiIsICIvKipcclxuICogTGl2ZSBQTkcgd2l0aCBhIGNhbG0gcGxhY2Vob2xkZXIgaW5zdGVhZCBvZiB0aGUgYnJvd3NlcidzIGJyb2tlbi1pbWFnZSBpY29uLlxyXG4gKi9cclxuaW1wb3J0IHsgdXNlRWZmZWN0LCB1c2VTdGF0ZSwgdHlwZSBDU1NQcm9wZXJ0aWVzLCB0eXBlIFJlYWN0Tm9kZSB9IGZyb20gJ3JlYWN0J1xyXG5cclxudHlwZSBQcm9wcyA9IHtcclxuICBzcmM6IHN0cmluZ1xyXG4gIGFsdD86IHN0cmluZ1xyXG4gIGxhYmVsOiBzdHJpbmdcclxuICBtYXhIZWlnaHQ/OiBudW1iZXIgfCBzdHJpbmdcclxuICBzdHlsZT86IENTU1Byb3BlcnRpZXNcclxufVxyXG5cclxuY29uc3Qgc2hlbGxTdHlsZTogQ1NTUHJvcGVydGllcyA9IHtcclxuICB3aWR0aDogJzEwMCUnLFxyXG4gIGhlaWdodDogJzEwMCUnLFxyXG4gIG1pbkhlaWdodDogMTIwLFxyXG4gIGRpc3BsYXk6ICdmbGV4JyxcclxuICBhbGlnbkl0ZW1zOiAnY2VudGVyJyxcclxuICBqdXN0aWZ5Q29udGVudDogJ2NlbnRlcicsXHJcbiAgYm94U2l6aW5nOiAnYm9yZGVyLWJveCcsXHJcbn1cclxuXHJcbmNvbnN0IHBsYWNlaG9sZGVyU3R5bGU6IENTU1Byb3BlcnRpZXMgPSB7XHJcbiAgLi4uc2hlbGxTdHlsZSxcclxuICBmbGV4RGlyZWN0aW9uOiAnY29sdW1uJyxcclxuICBnYXA6IDEwLFxyXG4gIHBhZGRpbmc6IDE2LFxyXG4gIGJvcmRlclJhZGl1czogOCxcclxuICBib3JkZXI6ICcxcHggZGFzaGVkIGNvbG9yLW1peChpbiBzcmdiLCBjdXJyZW50Q29sb3IgMjIlLCB0cmFuc3BhcmVudCknLFxyXG4gIGJhY2tncm91bmQ6XHJcbiAgICAncmVwZWF0aW5nLWxpbmVhci1ncmFkaWVudCgxMzVkZWcsIGNvbG9yLW1peChpbiBzcmdiLCBjdXJyZW50Q29sb3IgNSUsIHRyYW5zcGFyZW50KSAwIDhweCwgdHJhbnNwYXJlbnQgOHB4IDE2cHgpJyxcclxuICBjb2xvcjogJ2luaGVyaXQnLFxyXG4gIG9wYWNpdHk6IDAuNzgsXHJcbn1cclxuXHJcbmZ1bmN0aW9uIFBsYWNlaG9sZGVyKHsgbGFiZWwsIG1heEhlaWdodCB9OiB7IGxhYmVsOiBzdHJpbmc7IG1heEhlaWdodD86IG51bWJlciB8IHN0cmluZyB9KTogUmVhY3ROb2RlIHtcclxuICByZXR1cm4gKFxyXG4gICAgPGRpdiBzdHlsZT17eyAuLi5wbGFjZWhvbGRlclN0eWxlLCBtYXhIZWlnaHQsIG1pbkhlaWdodDogdHlwZW9mIG1heEhlaWdodCA9PT0gJ251bWJlcicgPyBNYXRoLm1pbigxMjAsIG1heEhlaWdodCkgOiAxMjAgfX0+XHJcbiAgICAgIDxzdmcgd2lkdGg9XCIzNlwiIGhlaWdodD1cIjI4XCIgdmlld0JveD1cIjAgMCAzNiAyOFwiIGFyaWEtaGlkZGVuPVwidHJ1ZVwiIHN0eWxlPXt7IG9wYWNpdHk6IDAuNTUgfX0+XHJcbiAgICAgICAgPHJlY3QgeD1cIjEuNVwiIHk9XCIxLjVcIiB3aWR0aD1cIjMzXCIgaGVpZ2h0PVwiMjVcIiByeD1cIjNcIiBmaWxsPVwibm9uZVwiIHN0cm9rZT1cImN1cnJlbnRDb2xvclwiIHN0cm9rZVdpZHRoPVwiMS41XCIgLz5cclxuICAgICAgICA8Y2lyY2xlIGN4PVwiMTFcIiBjeT1cIjEwXCIgcj1cIjIuNVwiIGZpbGw9XCJjdXJyZW50Q29sb3JcIiBvcGFjaXR5PVwiMC40NVwiIC8+XHJcbiAgICAgICAgPHBhdGhcclxuICAgICAgICAgIGQ9XCJNNCAyMiBMMTMgMTIgTDE4IDE2IEwyNCA5IEwzMiAyMiBaXCJcclxuICAgICAgICAgIGZpbGw9XCJjdXJyZW50Q29sb3JcIlxyXG4gICAgICAgICAgb3BhY2l0eT1cIjAuMjhcIlxyXG4gICAgICAgIC8+XHJcbiAgICAgIDwvc3ZnPlxyXG4gICAgICA8c3BhbiBzdHlsZT17eyBmb250U2l6ZTogMTIsIGZvbnRXZWlnaHQ6IDUwMCB9fT57bGFiZWx9PC9zcGFuPlxyXG4gICAgPC9kaXY+XHJcbiAgKVxyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gTGl2ZVByZXZpZXdJbWFnZSh7IHNyYywgYWx0ID0gJycsIGxhYmVsLCBtYXhIZWlnaHQsIHN0eWxlIH06IFByb3BzKTogUmVhY3ROb2RlIHtcclxuICBjb25zdCBbc3RhdHVzLCBzZXRTdGF0dXNdID0gdXNlU3RhdGU8J2xvYWRpbmcnIHwgJ29rJyB8ICdlcnJvcic+KHNyYyA/ICdsb2FkaW5nJyA6ICdlcnJvcicpXHJcblxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBzZXRTdGF0dXMoc3JjID8gJ2xvYWRpbmcnIDogJ2Vycm9yJylcclxuICB9LCBbc3JjXSlcclxuXHJcbiAgaWYgKCFzcmMgfHwgc3RhdHVzID09PSAnZXJyb3InKSB7XHJcbiAgICByZXR1cm4gPFBsYWNlaG9sZGVyIGxhYmVsPXtsYWJlbH0gbWF4SGVpZ2h0PXttYXhIZWlnaHR9IC8+XHJcbiAgfVxyXG5cclxuICByZXR1cm4gKFxyXG4gICAgPGRpdiBzdHlsZT17eyAuLi5zaGVsbFN0eWxlLCBwb3NpdGlvbjogJ3JlbGF0aXZlJywgbWF4SGVpZ2h0LCAuLi5zdHlsZSB9fT5cclxuICAgICAge3N0YXR1cyA9PT0gJ2xvYWRpbmcnID8gKFxyXG4gICAgICAgIDxkaXYgc3R5bGU9e3sgcG9zaXRpb246ICdhYnNvbHV0ZScsIGluc2V0OiAwLCBwb2ludGVyRXZlbnRzOiAnbm9uZScgfX0+XHJcbiAgICAgICAgICA8UGxhY2Vob2xkZXIgbGFiZWw9e2xhYmVsfSBtYXhIZWlnaHQ9e21heEhlaWdodH0gLz5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgKSA6IG51bGx9XHJcbiAgICAgIDxpbWdcclxuICAgICAgICBrZXk9e3NyY31cclxuICAgICAgICBzcmM9e3NyY31cclxuICAgICAgICBhbHQ9e2FsdH1cclxuICAgICAgICBkcmFnZ2FibGU9e2ZhbHNlfVxyXG4gICAgICAgIG9uTG9hZD17KCkgPT4gc2V0U3RhdHVzKCdvaycpfVxyXG4gICAgICAgIG9uRXJyb3I9eygpID0+IHNldFN0YXR1cygnZXJyb3InKX1cclxuICAgICAgICBzdHlsZT17e1xyXG4gICAgICAgICAgbWF4V2lkdGg6ICcxMDAlJyxcclxuICAgICAgICAgIG1heEhlaWdodDogbWF4SGVpZ2h0ID8/ICcxMDAlJyxcclxuICAgICAgICAgIG9iamVjdEZpdDogJ2NvbnRhaW4nLFxyXG4gICAgICAgICAgZGlzcGxheTogc3RhdHVzID09PSAnb2snID8gJ2Jsb2NrJyA6ICdub25lJyxcclxuICAgICAgICB9fVxyXG4gICAgICAvPlxyXG4gICAgPC9kaXY+XHJcbiAgKVxyXG59XHJcbiIsICIvKipcclxuICogQnJpZGdlOiBpbi1jaGF0IHRvb2x2aWV3IChzZXNzaW9uIHN1cmZhY2UpIFx1MjE5MiBsaXZlIHNpZGViYXIgb3BlblRhYiBwb2xsZXIuXHJcbiAqIEN1c3RvbUV2ZW50IGtlZXBzIHRvb2x2aWV3IGZyZWUgb2YgYSBoYXJkIHNpZGViYXJSaWdodCBpbmplY3QgZGVwZW5kZW5jeS5cclxuICovXHJcblxyXG5leHBvcnQgY29uc3QgV0VCQ0xBV19PUEVOX0xJVkVfRVZFTlQgPSAnd2ViY2xhdzpvcGVuLWxpdmUnXHJcblxyXG5leHBvcnQgdHlwZSBXZWJjbGF3T3BlbkxpdmVEZXRhaWwgPSB7XHJcbiAgcnVuRGlyOiBzdHJpbmdcclxuICAvKiogQnVtcCBzbyB0aGUgc2FtZSBydW5EaXIgY2FuIHJlLXRyaWdnZXIgb3BlbiBhZnRlciBhIGZhaWxlZCBhdHRlbXB0LiAqL1xyXG4gIG5vbmNlPzogbnVtYmVyXHJcbn1cclxuXHJcbi8qKiBBc2sgdGhlIHJvb3QgbGl2ZSBwb2xsZXIgdG8gb3Blbi9yZXZlYWwgdGhlIHdlYmNsYXctbGl2ZSB0YWIuICovXHJcbmV4cG9ydCBmdW5jdGlvbiByZXF1ZXN0T3BlbkxpdmUocnVuRGlyOiBzdHJpbmcpOiB2b2lkIHtcclxuICBjb25zdCB0cmltbWVkID0gcnVuRGlyLnRyaW0oKVxyXG4gIGlmICghdHJpbW1lZCB8fCB0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykgcmV0dXJuXHJcbiAgd2luZG93LmRpc3BhdGNoRXZlbnQoXHJcbiAgICBuZXcgQ3VzdG9tRXZlbnQ8V2ViY2xhd09wZW5MaXZlRGV0YWlsPihXRUJDTEFXX09QRU5fTElWRV9FVkVOVCwge1xyXG4gICAgICBkZXRhaWw6IHsgcnVuRGlyOiB0cmltbWVkLCBub25jZTogRGF0ZS5ub3coKSB9LFxyXG4gICAgfSksXHJcbiAgKVxyXG59XHJcbiIsICIvKiogQ29kZS1zdHlsZSBwcmV2aWV3IGZvciBgLndlYmNsYXdgIHJlY2lwZXMgKGBsYW5nPWxvZ2A7IG5vIGVuZ2luZSBleHRlbnNpb24gdGFibGUpLiAqL1xyXG5pbXBvcnQgdHlwZSB7IFJlYWN0Tm9kZSB9IGZyb20gJ3JlYWN0J1xyXG5pbXBvcnQgdHlwZSB7IFByb3BzTG9jYWxlIH0gZnJvbSAnQGRlZXBzZWVrLWFpL2RzaC1jbGllbnQtdWktc2xvdHMnXHJcbmltcG9ydCB7IENvZGVCbG9jayB9IGZyb20gJ0BkZWVwc2Vlay1haS9kc2gtY2xpZW50LXVpLXByaW1pdGl2ZXMnXHJcbmltcG9ydCB0eXBlIHsgRG9jdW1lbnRQcmV2aWV3UHJvcHMgfSBmcm9tICdAZGVlcHNlZWstYWkvZHNoLWNsaWVudC11aS1zaWRlYmFyLWRvY3VtZW50cHJldmlldy9jbGllbnQnXHJcbmltcG9ydCB7IGV4dHJhY3RSZWNpcGVQYXJhbXMgfSBmcm9tICcuLi9wYXJhbXMudHMnXHJcbmltcG9ydCB0eXBlIHt9IGZyb20gJy4vbG9jYWxlcy50cydcclxuXHJcbi8qKiBEb2N1bWVudCBvd25lciBwcm9wcyBwbHVzIHRoaXMgcHJldmlldydzIGNvcHkuICovXHJcbmV4cG9ydCB0eXBlIFdlYmNsYXdQcmV2aWV3UHJvcHMgPSBEb2N1bWVudFByZXZpZXdQcm9wcyAmIFByb3BzTG9jYWxlPCd3ZWJjbGF3UHJldmlldyc+XHJcblxyXG4vKipcclxuICogSGlnaGxpZ2h0IGAud2ViY2xhd2AgYXMgbG9nL3BsYWluIHJlY2lwZSB0ZXh0LlxyXG4gKiBTaG93cyBkZWNsYXJlZFx1MzAwQ1x1NTNDMlx1NjU3MFx1MzAwRGRlZmF1bHRzIGFib3ZlIHRoZSBib2R5IChyZWFkLW9ubHk7IGVkaXQgdmlhIGNoYXQgZm9ybSBvbiBydW4pLlxyXG4gKiBAcGFyYW0gcHJvcHMgLSBkb2N1bWVudCBjb250ZW50IGZyb20gdGhlIHNpZGViYXIgb3duZXIuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gV2ViY2xhd1ByZXZpZXcoe1xyXG4gIGNvbnRlbnQsXHJcbiAgd3JhcCxcclxuICBzY3JvbGxwb3J0UmVmLFxyXG4gIHQsXHJcbn06IFdlYmNsYXdQcmV2aWV3UHJvcHMpOiBSZWFjdE5vZGUge1xyXG4gIGlmIChjb250ZW50LmtpbmQgIT09ICd0ZXh0JykgcmV0dXJuIG51bGxcclxuICBjb25zdCBwYXJhbXMgPSBleHRyYWN0UmVjaXBlUGFyYW1zKGNvbnRlbnQudGV4dClcclxuICByZXR1cm4gKFxyXG4gICAgPGRpdiBkYXRhLXdlYmNsYXctcHJldmlldz1cIlwiIGRhdGEtd3JhcD17d3JhcCA/ICd0cnVlJyA6ICdmYWxzZSd9PlxyXG4gICAgICB7cGFyYW1zLmxlbmd0aCA+IDAgPyAoXHJcbiAgICAgICAgPGRpdlxyXG4gICAgICAgICAgZGF0YS13ZWJjbGF3LXBhcmFtcz1cIlwiXHJcbiAgICAgICAgICBzdHlsZT17e1xyXG4gICAgICAgICAgICBtYXJnaW46ICcwIDAgMTJweCcsXHJcbiAgICAgICAgICAgIHBhZGRpbmc6ICcxMHB4IDEycHgnLFxyXG4gICAgICAgICAgICBib3JkZXJCb3R0b206ICcxcHggc29saWQgY29sb3ItbWl4KGluIHNyZ2IsIGN1cnJlbnRDb2xvciAxMiUsIHRyYW5zcGFyZW50KScsXHJcbiAgICAgICAgICAgIGZvbnRTaXplOiAxMyxcclxuICAgICAgICAgICAgbGluZUhlaWdodDogMS41LFxyXG4gICAgICAgICAgfX1cclxuICAgICAgICA+XHJcbiAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGZvbnRXZWlnaHQ6IDYwMCwgbWFyZ2luQm90dG9tOiA2IH19Pnt0KCdwYXJhbXNUaXRsZScpfTwvZGl2PlxyXG4gICAgICAgICAgPGRsIHN0eWxlPXt7IG1hcmdpbjogMCwgZGlzcGxheTogJ2dyaWQnLCBnYXA6IDQgfX0+XHJcbiAgICAgICAgICAgIHtwYXJhbXMubWFwKHAgPT4gKFxyXG4gICAgICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAgICAgIGtleT17cC5uYW1lfVxyXG4gICAgICAgICAgICAgICAgc3R5bGU9e3sgZGlzcGxheTogJ2dyaWQnLCBncmlkVGVtcGxhdGVDb2x1bW5zOiAnN2VtIDFmcicsIGdhcDogOCB9fVxyXG4gICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgIDxkdCBzdHlsZT17eyBvcGFjaXR5OiAwLjcsIG1hcmdpbjogMCB9fT57cC5uYW1lfTwvZHQ+XHJcbiAgICAgICAgICAgICAgICA8ZGQgc3R5bGU9e3sgbWFyZ2luOiAwLCBmb250RmFtaWx5OiAndWktbW9ub3NwYWNlLCBtb25vc3BhY2UnIH19PlxyXG4gICAgICAgICAgICAgICAgICB7cC52YWx1ZX1cclxuICAgICAgICAgICAgICAgIDwvZGQ+XHJcbiAgICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICAgICkpfVxyXG4gICAgICAgICAgPC9kbD5cclxuICAgICAgICAgIDxkaXYgc3R5bGU9e3sgbWFyZ2luVG9wOiA4LCBvcGFjaXR5OiAwLjY1LCBmb250U2l6ZTogMTIgfX0+XHJcbiAgICAgICAgICAgIHt0KCdwYXJhbXNIaW50Jyl9XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICA8L2Rpdj5cclxuICAgICAgKSA6IG51bGx9XHJcbiAgICAgIDxDb2RlQmxvY2tcclxuICAgICAgICBjb250ZW50UmVmPXtzY3JvbGxwb3J0UmVmfVxyXG4gICAgICAgIGNvZGU9e2NvbnRlbnQudGV4dH1cclxuICAgICAgICBsYW5nPVwibG9nXCJcclxuICAgICAgICBzdHJlYW1pbmc9eyFjb250ZW50LmVvZn1cclxuICAgICAgICB3cmFwPXt3cmFwfVxyXG4gICAgICAgIGxpbmVOdW1iZXJzXHJcbiAgICAgICAgY29weUxhYmVsPXt0KCdjb3B5Jyl9XHJcbiAgICAgICAgY29waWVkTGFiZWw9e3QoJ2NvcGllZCcpfVxyXG4gICAgICAgIHRvb2xiYXJMYWJlbHM9e3tcclxuICAgICAgICAgIGNvZGVMYWJlbDogdCgnY29kZUJsb2NrVGl0bGUnKSxcclxuICAgICAgICAgIHdyYXBMYWJlbDogdCgnd3JhcCcpLFxyXG4gICAgICAgICAgdW53cmFwTGFiZWw6IHQoJ3Vud3JhcCcpLFxyXG4gICAgICAgIH19XHJcbiAgICAgIC8+XHJcbiAgICA8L2Rpdj5cclxuICApXHJcbn1cclxuIiwgIi8qKlxuICogUmVjaXBlXHUzMDBDXHU1M0MyXHU2NTcwXHUzMDBEaGVscGVycyBmb3IgRFNIIChtaXJyb3JzIHJ1bnRpbWUgZXh0cmFjdC9tZXJnZSBmb3Igc3RhdGljIHBhcmFtcykuXG4gKlxuICogRGVza3RvcCBzaG93cyB0aGVzZSBpbiB0aGUgdG9wIFx1NTNDMlx1NjU3MFx1NjgwRiBiZWZvcmUgcnVuLiBEU0ggaGFzIG5vIG5hdGl2ZSBmb3JtIEFQSSxcbiAqIHNvIHRoZSBIb3N0IHRvb2xzIGV4dHJhY3QgZGVmYXVsdHMsIGdhdGUgcnVuIHVudGlsIGNvbmZpcm1lZCwgdGhlbiByZXdyaXRlXG4gKiBgXHU1M0MyXHU2NTcwXHU1NDBEPVx1NTAzQ2AgaW50byB0aGUgdGVtcCByZWNpcGUgKGZpbGUgZGVjbGFyYXRpb25zIG90aGVyd2lzZSBiZWF0IENMSSAtLXBhcmFtcykuXG4gKi9cblxuZXhwb3J0IGludGVyZmFjZSBSZWNpcGVQYXJhbUt2IHtcbiAgcmVhZG9ubHkgbmFtZTogc3RyaW5nXG4gIHJlYWRvbmx5IHZhbHVlOiBzdHJpbmdcbn1cblxuLyoqIE5vcm1hbGl6ZSBCT00gLyBuZXdsaW5lcyBzbyBjb21tYS1zcGxpdCBzZWVzIG9uZSBzdGVwIHN0cmVhbS4gKi9cbmZ1bmN0aW9uIG5vcm1hbGl6ZVJlY2lwZVRleHQoY29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcbiAgcmV0dXJuIGNvbnRlbnQucmVwbGFjZSgvXlxcdUZFRkYvLCAnJykucmVwbGFjZSgvXFxyXFxuL2csICdcXG4nKS50cmltKClcbn1cblxuLyoqXG4gKiBTcGxpdCByZWNpcGUgaW50byBzdGVwIHNlZ21lbnRzIG9uIENoaW5lc2UvQVNDSUkgY29tbWFzLlxuICogRXNjYXBlIHNlcXVlbmNlcyBgXFwsYCBgXFxcdUZGMENgIGtlZXAgdGhlIGNvbW1hIGxpdGVyYWwgKHNhbWUgaWRlYSBhcyBydW50aW1lKS5cbiAqXG4gKiBOZXdsaW5lcyBiZWNvbWUgYFx1RkYwQ2AgKG5vdCBlbXB0eSk6IG90aGVyd2lzZVxuICogYFx1NTNDMlx1NjU3MFx1NTM5Rlx1NTZFMD1cdTVCQjZcdTRFMkRcdTY3MDlcdTRFOEJcXG5cdTc2N0JcdTVGNTVFSFJcdTdDRkJcdTdFREZgIGNvbGxhcHNlcyB0byBgXHU1M0MyXHU2NTcwXHU1MzlGXHU1NkUwPVx1NUJCNlx1NEUyRFx1NjcwOVx1NEU4Qlx1NzY3Qlx1NUY1NUVIUlx1N0NGQlx1N0VERmBcbiAqIGFuZCB0aGUgbG9naW4gc3RlcCBpcyBsb3N0LlxuICovXG5leHBvcnQgZnVuY3Rpb24gc3BsaXRSZWNpcGVTdGVwcyhjb250ZW50OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IHRleHQgPSBub3JtYWxpemVSZWNpcGVUZXh0KGNvbnRlbnQpLnJlcGxhY2UoL1xcbisvZywgJ1x1RkYwQycpXG4gIGlmICghdGV4dCkgcmV0dXJuIFtdXG4gIGNvbnN0IHN0ZXBzOiBzdHJpbmdbXSA9IFtdXG4gIGxldCBidWYgPSAnJ1xuICBmb3IgKGxldCBpID0gMDsgaSA8IHRleHQubGVuZ3RoOyBpKyspIHtcbiAgICBjb25zdCBjaCA9IHRleHRbaV0hXG4gICAgaWYgKGNoID09PSAnXFxcXCcgJiYgaSArIDEgPCB0ZXh0Lmxlbmd0aCkge1xuICAgICAgY29uc3QgbmV4dCA9IHRleHRbaSArIDFdIVxuICAgICAgaWYgKG5leHQgPT09ICcsJyB8fCBuZXh0ID09PSAnXHVGRjBDJyB8fCBuZXh0ID09PSAnLicgfHwgbmV4dCA9PT0gJ1x1MzAwMicpIHtcbiAgICAgICAgYnVmICs9IG5leHRcbiAgICAgICAgaSsrXG4gICAgICAgIGNvbnRpbnVlXG4gICAgICB9XG4gICAgfVxuICAgIGlmIChjaCA9PT0gJ1x1RkYwQycgfHwgY2ggPT09ICcsJykge1xuICAgICAgY29uc3QgdCA9IGJ1Zi50cmltKClcbiAgICAgIGlmICh0KSBzdGVwcy5wdXNoKHQpXG4gICAgICBidWYgPSAnJ1xuICAgICAgY29udGludWVcbiAgICB9XG4gICAgYnVmICs9IGNoXG4gIH1cbiAgY29uc3QgbGFzdCA9IGJ1Zi50cmltKClcbiAgaWYgKGxhc3QpIHN0ZXBzLnB1c2gobGFzdClcbiAgcmV0dXJuIHN0ZXBzXG59XG5cbi8qKlxuICogRXh0cmFjdCBzdGF0aWMgYFx1NTNDMlx1NjU3MFx1NTQwRD1cdTUwM0NgIGRlY2xhcmF0aW9ucyAodG9wIGJhciAvIGZvcm0gZmllbGRzKS5cbiAqIFNraXBzXHUzMDBDXHU1MkE4XHU2MDAxXHU1M0MyXHU2NTcwXHUzMDBEOyBsYXN0IGR1cGxpY2F0ZSBuYW1lIHdpbnMgb3JkZXIgb2YgZmlyc3Qgb2NjdXJyZW5jZSB3aXRoIGxhc3QgdmFsdWUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0UmVjaXBlUGFyYW1zKGNvbnRlbnQ6IHN0cmluZyk6IFJlY2lwZVBhcmFtS3ZbXSB7XG4gIGNvbnN0IHN0ZXBzID0gc3BsaXRSZWNpcGVTdGVwcyhjb250ZW50KVxuICBjb25zdCBvcmRlcjogc3RyaW5nW10gPSBbXVxuICBjb25zdCBtYXAgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPigpXG4gIGZvciAoY29uc3Qgc3RlcCBvZiBzdGVwcykge1xuICAgIGlmIChzdGVwLnN0YXJ0c1dpdGgoJ1x1NTJBOFx1NjAwMVx1NTNDMlx1NjU3MCcpKSBjb250aW51ZVxuICAgIGlmICghc3RlcC5zdGFydHNXaXRoKCdcdTUzQzJcdTY1NzAnKSkgY29udGludWVcbiAgICBjb25zdCBib2R5ID0gc3RlcC5zbGljZSgnXHU1M0MyXHU2NTcwJy5sZW5ndGgpXG4gICAgY29uc3QgZXEgPSBib2R5LmluZGV4T2YoJz0nKVxuICAgIGlmIChlcSA8PSAwKSBjb250aW51ZVxuICAgIGNvbnN0IG5hbWUgPSBib2R5LnNsaWNlKDAsIGVxKS50cmltKClcbiAgICAvLyBEcm9wIGdsdWVkIHZlcmJzIGZyb20gb2xkZXIgbmV3bGluZSBidWdzOiBcdTVCQjZcdTRFMkRcdTY3MDlcdTRFOEJcdTc2N0JcdTVGNTVFSFJcdTdDRkJcdTdFREYgXHUyMTkyIFx1NUJCNlx1NEUyRFx1NjcwOVx1NEU4QlxuICAgIGxldCB2YWx1ZSA9IGJvZHkuc2xpY2UoZXEgKyAxKS50cmltKClcbiAgICB2YWx1ZSA9IHZhbHVlLnJlcGxhY2UoXG4gICAgICAvKD88PVtcXHU0ZTAwLVxcdTlmZmZBLVphLXowLTldKShcdTc2N0JcdTVGNTV8XHU2MjUzXHU1RjAwfFx1NzBCOVx1NTFGQnxcdThGOTNcdTUxNjV8XHU3QjQ5XHU1Rjg1KVtcXHU0ZTAwLVxcdTlmZmZBLVphLXowLTkje309e3t9fVxcc18tXSokL3UsXG4gICAgICAnJyxcbiAgICApLnRyaW0oKVxuICAgIGlmICghbmFtZSB8fCBuYW1lLmluY2x1ZGVzKCcuJykpIGNvbnRpbnVlXG4gICAgaWYgKCFtYXAuaGFzKG5hbWUpKSBvcmRlci5wdXNoKG5hbWUpXG4gICAgbWFwLnNldChuYW1lLCB2YWx1ZSlcbiAgfVxuICByZXR1cm4gb3JkZXIubWFwKG5hbWUgPT4gKHsgbmFtZSwgdmFsdWU6IG1hcC5nZXQobmFtZSkgPz8gJycgfSkpXG59XG5cbi8qKiBEcm9wIHN0YXRpY1x1MzAwQ1x1NTNDMlx1NjU3MFx1MzAwRHN0ZXBzOyBrZWVwXHUzMDBDXHU1MkE4XHU2MDAxXHU1M0MyXHU2NTcwXHUzMDBEYW5kIGV2ZXJ5dGhpbmcgZWxzZS4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzdHJpcFJlY2lwZVBhcmFtU3RlcHMoY29udGVudDogc3RyaW5nKToge1xuICBib2R5OiBzdHJpbmdcbiAgcGFyYW1zOiBSZWNpcGVQYXJhbUt2W11cbn0ge1xuICBjb25zdCBzdGVwcyA9IHNwbGl0UmVjaXBlU3RlcHMoY29udGVudClcbiAgY29uc3QgcGFyYW1zID0gZXh0cmFjdFJlY2lwZVBhcmFtcyhjb250ZW50KVxuICAvLyBTdGF0aWNcdTMwMENcdTUzQzJcdTY1NzBcdTMwMERzdHJpcHBlZDtcdTMwMENcdTUyQThcdTYwMDFcdTUzQzJcdTY1NzBcdTMwMERhbmQgYWxsIG90aGVyIHN0ZXBzIGtlcHQuXG4gIGNvbnN0IGtlcHQgPSBzdGVwcy5maWx0ZXIoc3RlcCA9PiB7XG4gICAgaWYgKHN0ZXAuc3RhcnRzV2l0aCgnXHU1MkE4XHU2MDAxXHU1M0MyXHU2NTcwJykpIHJldHVybiB0cnVlXG4gICAgaWYgKHN0ZXAuc3RhcnRzV2l0aCgnXHU1M0MyXHU2NTcwJykpIHJldHVybiBmYWxzZVxuICAgIHJldHVybiB0cnVlXG4gIH0pXG4gIHJldHVybiB7IGJvZHk6IGtlcHQuam9pbignXHVGRjBDJyksIHBhcmFtcyB9XG59XG5cbi8qKiBSZXdyaXRlIGNvbnRlbnQ6IHByZWZpeCBtZXJnZWQgYFx1NTNDMlx1NjU3MFx1NTQwRD1cdTUwM0NgIHRoZW4gYm9keSB3aXRob3V0IG9sZCBzdGF0aWMgcGFyYW1zLiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG1lcmdlUGFyYW1zSW50b0NvbnRlbnQoXG4gIGNvbnRlbnQ6IHN0cmluZyxcbiAgZW50cmllczogcmVhZG9ubHkgUmVjaXBlUGFyYW1LdltdLFxuKTogc3RyaW5nIHtcbiAgY29uc3QgeyBib2R5IH0gPSBzdHJpcFJlY2lwZVBhcmFtU3RlcHMoY29udGVudClcbiAgY29uc3QgY2xlYW5lZCA9IGVudHJpZXNcbiAgICAubWFwKGUgPT4gKHsgbmFtZTogZS5uYW1lLnRyaW0oKSwgdmFsdWU6IGUudmFsdWUgfSkpXG4gICAgLmZpbHRlcihlID0+IGUubmFtZSAhPT0gJycpXG4gIGlmIChjbGVhbmVkLmxlbmd0aCA9PT0gMCkgcmV0dXJuIGJvZHlcbiAgY29uc3QgcHJlZml4ID0gY2xlYW5lZC5tYXAoZSA9PiBgXHU1M0MyXHU2NTcwJHtlLm5hbWV9PSR7ZS52YWx1ZX1gKS5qb2luKCdcdUZGMEMnKVxuICBpZiAoIWJvZHkudHJpbSgpKSByZXR1cm4gcHJlZml4XG4gIHJldHVybiBgJHtwcmVmaXh9XHVGRjBDJHtib2R5fWBcbn1cblxuLyoqXG4gKiBJZiBhIGJhZCBzcGxpdCBvbmNlIGdsdWVkIGBcdTc2N0JcdTVGNTVcdTIwMjZgIGludG8gYSBcdTUzQzJcdTY1NzAgdmFsdWUgYW5kIHRoZW4gc3RyaXBwZWQgaXQsXG4gKiByZWNvdmVyIGxvZ2luIChhbmQgZm9sbG93aW5nKSBzdGVwcyBmcm9tIHRoZSByYXcgcmVjaXBlLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVjb3Zlckxvc3RBY3Rpb25TdGVwcyhcbiAgcmF3Q29udGVudDogc3RyaW5nLFxuICBtZXJnZWRDb250ZW50OiBzdHJpbmcsXG4pOiBzdHJpbmcge1xuICBjb25zdCByYXdTdGVwcyA9IHNwbGl0UmVjaXBlU3RlcHMocmF3Q29udGVudClcbiAgY29uc3QgbWVyZ2VkU3RlcHMgPSBzcGxpdFJlY2lwZVN0ZXBzKG1lcmdlZENvbnRlbnQpXG4gIGNvbnN0IHJhd0FjdGlvbnMgPSByYXdTdGVwcy5maWx0ZXIoXG4gICAgcyA9PiAhcy5zdGFydHNXaXRoKCdcdTUzQzJcdTY1NzAnKSB8fCBzLnN0YXJ0c1dpdGgoJ1x1NTJBOFx1NjAwMVx1NTNDMlx1NjU3MCcpLFxuICApXG4gIGNvbnN0IG1lcmdlZEFjdGlvbnMgPSBtZXJnZWRTdGVwcy5maWx0ZXIoXG4gICAgcyA9PiAhcy5zdGFydHNXaXRoKCdcdTUzQzJcdTY1NzAnKSB8fCBzLnN0YXJ0c1dpdGgoJ1x1NTJBOFx1NjAwMVx1NTNDMlx1NjU3MCcpLFxuICApXG4gIGNvbnN0IHJhd0hhc0xvZ2luID0gcmF3QWN0aW9ucy5zb21lKHMgPT4gcy5zdGFydHNXaXRoKCdcdTc2N0JcdTVGNTUnKSlcbiAgY29uc3QgbWVyZ2VkSGFzTG9naW4gPSBtZXJnZWRBY3Rpb25zLnNvbWUocyA9PiBzLnN0YXJ0c1dpdGgoJ1x1NzY3Qlx1NUY1NScpKVxuICBpZiAoIXJhd0hhc0xvZ2luIHx8IG1lcmdlZEhhc0xvZ2luKSByZXR1cm4gbWVyZ2VkQ29udGVudFxuICBjb25zdCBwYXJhbXMgPSBleHRyYWN0UmVjaXBlUGFyYW1zKG1lcmdlZENvbnRlbnQpXG4gIGNvbnN0IHByZWZpeCA9XG4gICAgcGFyYW1zLmxlbmd0aCA+IDBcbiAgICAgID8gcGFyYW1zLm1hcChwID0+IGBcdTUzQzJcdTY1NzAke3AubmFtZX09JHtwLnZhbHVlfWApLmpvaW4oJ1x1RkYwQycpICsgJ1x1RkYwQydcbiAgICAgIDogJydcbiAgcmV0dXJuIGAke3ByZWZpeH0ke3Jhd0FjdGlvbnMuam9pbignXHVGRjBDJyl9YFxufVxuXG4vKipcbiAqIEFwcGx5IG92ZXJyaWRlcyBvbnRvIGRlY2xhcmVkIHBhcmFtcyAoZGVjbGFyZWQgb3JkZXIgcHJlc2VydmVkOyBuZXcga2V5cyBhcHBlbmRlZCkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBhcHBseVBhcmFtT3ZlcnJpZGVzKFxuICBjb250ZW50OiBzdHJpbmcsXG4gIG92ZXJyaWRlcz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gfCBudWxsLFxuKTogeyBjb250ZW50OiBzdHJpbmc7IHBhcmFtczogUmVjaXBlUGFyYW1LdltdIH0ge1xuICBjb25zdCBiYXNlID0gZXh0cmFjdFJlY2lwZVBhcmFtcyhjb250ZW50KVxuICBjb25zdCBtYXAgPSBuZXcgTWFwKGJhc2UubWFwKHAgPT4gW3AubmFtZSwgcC52YWx1ZV0pKVxuICBpZiAob3ZlcnJpZGVzKSB7XG4gICAgZm9yIChjb25zdCBbcmF3S2V5LCByYXdWYWxdIG9mIE9iamVjdC5lbnRyaWVzKG92ZXJyaWRlcykpIHtcbiAgICAgIGNvbnN0IG5hbWUgPSByYXdLZXkudHJpbSgpXG4gICAgICBpZiAoIW5hbWUpIGNvbnRpbnVlXG4gICAgICBtYXAuc2V0KG5hbWUsIFN0cmluZyhyYXdWYWwgPz8gJycpKVxuICAgIH1cbiAgfVxuICBjb25zdCBwYXJhbXM6IFJlY2lwZVBhcmFtS3ZbXSA9IFtdXG4gIGNvbnN0IHNlZW4gPSBuZXcgU2V0PHN0cmluZz4oKVxuICBmb3IgKGNvbnN0IHAgb2YgYmFzZSkge1xuICAgIHBhcmFtcy5wdXNoKHsgbmFtZTogcC5uYW1lLCB2YWx1ZTogbWFwLmdldChwLm5hbWUpID8/IHAudmFsdWUgfSlcbiAgICBzZWVuLmFkZChwLm5hbWUpXG4gIH1cbiAgaWYgKG92ZXJyaWRlcykge1xuICAgIGZvciAoY29uc3QgcmF3S2V5IG9mIE9iamVjdC5rZXlzKG92ZXJyaWRlcykpIHtcbiAgICAgIGNvbnN0IG5hbWUgPSByYXdLZXkudHJpbSgpXG4gICAgICBpZiAoIW5hbWUgfHwgc2Vlbi5oYXMobmFtZSkpIGNvbnRpbnVlXG4gICAgICBwYXJhbXMucHVzaCh7IG5hbWUsIHZhbHVlOiBtYXAuZ2V0KG5hbWUpID8/ICcnIH0pXG4gICAgICBzZWVuLmFkZChuYW1lKVxuICAgIH1cbiAgfVxuICBjb25zdCBtZXJnZWQgPSBtZXJnZVBhcmFtc0ludG9Db250ZW50KGNvbnRlbnQsIHBhcmFtcylcbiAgcmV0dXJuIHtcbiAgICBjb250ZW50OiByZWNvdmVyTG9zdEFjdGlvblN0ZXBzKGNvbnRlbnQsIG1lcmdlZCksXG4gICAgcGFyYW1zLFxuICB9XG59XG5cbi8qKiBCdWlsdC1pbiBkeW5hbWljIHBsYWNlaG9sZGVycyBcdTIwMTQgbm90IHVzZXItZWRpdGFibGUgcnVuIHBhcmFtcy4gKi9cbmNvbnN0IEJVSUxUSU5fUExBQ0VIT0xERVJTID0gbmV3IFNldChbXG4gICdcdTk4NzVcdTdCN0VcdTU3MzBcdTU3NDAnLFxuICAnXHU5ODc1XHU3QjdFXHU2ODA3XHU5ODk4JyxcbiAgJ1x1NTI2QVx1NTIwN1x1Njc3RicsXG4gICdcdTVGNTNcdTUyNERcdTY1RjZcdTk1RjQnLFxuICAnXHU1RjUzXHU1MjREXHU2NUU1XHU2NzFGJyxcbl0pXG5cbi8qKlxuICogQ29sbGVjdCBge3tcdTU0MERcdTc5RjB9fWAgcGxhY2Vob2xkZXJzIHRoYXQgbmVlZCB1c2VyIGNvbmZpcm1hdGlvblxuICogKGV4Y2x1ZGVzIGJ1aWx0aW5zIGxpa2UgXHU5ODc1XHU3QjdFXHU1NzMwXHU1NzQwKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGV4dHJhY3RNdXN0YWNoZVBhcmFtcyhjb250ZW50OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG4gIGNvbnN0IG9yZGVyOiBzdHJpbmdbXSA9IFtdXG4gIGNvbnN0IHNlZW4gPSBuZXcgU2V0PHN0cmluZz4oKVxuICBjb25zdCByZSA9IC9cXHtcXHtcXHMqKFtee31dKz8pXFxzKlxcfVxcfS9nXG4gIGxldCBtOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsXG4gIHdoaWxlICgobSA9IHJlLmV4ZWMoY29udGVudCkpICE9PSBudWxsKSB7XG4gICAgY29uc3QgbmFtZSA9IChtWzFdID8/ICcnKS50cmltKClcbiAgICBpZiAoIW5hbWUgfHwgbmFtZS5pbmNsdWRlcygnLicpIHx8IEJVSUxUSU5fUExBQ0VIT0xERVJTLmhhcyhuYW1lKSkgY29udGludWVcbiAgICBpZiAoc2Vlbi5oYXMobmFtZSkpIGNvbnRpbnVlXG4gICAgc2Vlbi5hZGQobmFtZSlcbiAgICBvcmRlci5wdXNoKG5hbWUpXG4gIH1cbiAgcmV0dXJuIG9yZGVyXG59XG5cbi8qKlxuICogUGFyYW1zIHRoZSBIb3N0IG11c3QgY29uZmlybSBiZWZvcmUgYnJvd3NlciBzdGFydDpcbiAqIGRlY2xhcmVkIGBcdTUzQzJcdTY1NzBcdTU0MEQ9XHU1MDNDYCwgcmVtYWluaW5nIGB7e1x1NTQwRH19YCwgYW5kIGV4cGxpY2l0IHRvb2wgYHBhcmFtc2Aga2V5cy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNvbGxlY3RDb25maXJtYWJsZVBhcmFtcyhcbiAgY29udGVudDogc3RyaW5nLFxuICBvdmVycmlkZXM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHwgbnVsbCxcbik6IFJlY2lwZVBhcmFtS3ZbXSB7XG4gIGNvbnN0IGRlY2xhcmVkID0gZXh0cmFjdFJlY2lwZVBhcmFtcyhjb250ZW50KVxuICBjb25zdCBtYXAgPSBuZXcgTWFwKGRlY2xhcmVkLm1hcChwID0+IFtwLm5hbWUsIHAudmFsdWVdKSlcbiAgY29uc3Qgb3JkZXIgPSBkZWNsYXJlZC5tYXAocCA9PiBwLm5hbWUpXG4gIGNvbnN0IHNlZW4gPSBuZXcgU2V0KG9yZGVyKVxuXG4gIGZvciAoY29uc3QgbmFtZSBvZiBleHRyYWN0TXVzdGFjaGVQYXJhbXMoY29udGVudCkpIHtcbiAgICBpZiAoc2Vlbi5oYXMobmFtZSkpIGNvbnRpbnVlXG4gICAgc2Vlbi5hZGQobmFtZSlcbiAgICBvcmRlci5wdXNoKG5hbWUpXG4gICAgbWFwLnNldChuYW1lLCBvdmVycmlkZXM/LltuYW1lXSA/PyAnJylcbiAgfVxuXG4gIGlmIChvdmVycmlkZXMpIHtcbiAgICBmb3IgKGNvbnN0IHJhd0tleSBvZiBPYmplY3Qua2V5cyhvdmVycmlkZXMpKSB7XG4gICAgICBjb25zdCBuYW1lID0gcmF3S2V5LnRyaW0oKVxuICAgICAgaWYgKCFuYW1lIHx8IHNlZW4uaGFzKG5hbWUpKSBjb250aW51ZVxuICAgICAgc2Vlbi5hZGQobmFtZSlcbiAgICAgIG9yZGVyLnB1c2gobmFtZSlcbiAgICAgIG1hcC5zZXQobmFtZSwgU3RyaW5nKG92ZXJyaWRlc1tyYXdLZXldID8/ICcnKSlcbiAgICB9XG4gICAgZm9yIChjb25zdCBbaywgdl0gb2YgT2JqZWN0LmVudHJpZXMob3ZlcnJpZGVzKSkge1xuICAgICAgY29uc3QgbmFtZSA9IGsudHJpbSgpXG4gICAgICBpZiAoIW5hbWUpIGNvbnRpbnVlXG4gICAgICBtYXAuc2V0KG5hbWUsIFN0cmluZyh2ID8/ICcnKSlcbiAgICB9XG4gIH1cblxuICByZXR1cm4gb3JkZXIubWFwKG5hbWUgPT4gKHsgbmFtZSwgdmFsdWU6IG1hcC5nZXQobmFtZSkgPz8gJycgfSkpXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgUGFyYW1FZGl0IHtcbiAgcmVhZG9ubHkgbmFtZTogc3RyaW5nXG4gIC8qKiBWYWx1ZSB0aGUgYm9keSBtYXkgc3RpbGwgY2FycnkgbGl0ZXJhbGx5IChyZWNpcGUgLyBmb3JtIGRlZmF1bHQpLiAqL1xuICByZWFkb25seSBmcm9tOiBzdHJpbmdcbiAgLyoqIFZhbHVlIHRoZSBodW1hbiBjb25maXJtZWQuICovXG4gIHJlYWRvbmx5IHRvOiBzdHJpbmdcbn1cblxuLyoqXG4gKiBQb2ludCBsaXRlcmFsIGRlZmF1bHRzIGluIHN0ZXAgYm9kaWVzIGF0IHRoZSBjb25maXJtZWQgdmFsdWUsIGZvciBuYW1lcyB0aGVcbiAqIHJlY2lwZSBuZXZlciByZWZlcmVuY2VzIGFzIGB7e1x1NTQwRH19YCAoc2tpbGwgYXV0aG9ycyAvIG1vZGVscyB0aGF0IGV4cGFuZGVkXG4gKiBgXHU1M0MyXHU2NTcwXHU2NzA4XHU0RUZEPVx1NEUwM1x1NjcwOGAgaW50byBgXHU3MEI5XHU1MUZCXHU0RTAzXHU2NzA4YCkuIFdpdGhvdXQgdGhpcyBhIGZvcm0gZWRpdCBjYW5ub3QgcmVhY2ggdGhlIGJvZHkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWJpbmRFeHBhbmRlZERlZmF1bHRzKFxuICBjb250ZW50OiBzdHJpbmcsXG4gIGVkaXRzOiByZWFkb25seSBQYXJhbUVkaXRbXSxcbik6IHsgY29udGVudDogc3RyaW5nOyByZWJvdW5kOiBzdHJpbmdbXSB9IHtcbiAgY29uc3QgcGxhY2Vob2xkZXJzID0gbmV3IFNldChleHRyYWN0TXVzdGFjaGVQYXJhbXMoY29udGVudCkpXG4gIGNvbnN0IGFjdGl2ZSA9IGVkaXRzXG4gICAgLm1hcChlID0+ICh7IG5hbWU6IGUubmFtZS50cmltKCksIGZyb206IGUuZnJvbS50cmltKCksIHRvOiBlLnRvLnRyaW0oKSB9KSlcbiAgICAuZmlsdGVyKGUgPT5cbiAgICAgIGUubmFtZSAhPT0gJydcbiAgICAgICYmIGUuZnJvbS5sZW5ndGggPj0gMlxuICAgICAgJiYgZS50byAhPT0gJydcbiAgICAgICYmIGUuZnJvbSAhPT0gZS50b1xuICAgICAgJiYgIXBsYWNlaG9sZGVycy5oYXMoZS5uYW1lKSlcbiAgICAvLyBMb25nZXIgbGl0ZXJhbHMgZmlyc3Qgc29cdTMwMENcdTRFMkRcdTczQUZcdTZEMDEoXHU1MzE3XHU0RUFDKVx1MjAyNlx1MzAwRGlzIG5vdCBjbGlwcGVkIGJ5IGEgc2hvcnRlciBkZWZhdWx0LlxuICAgIC5zb3J0KChhLCBiKSA9PiBiLmZyb20ubGVuZ3RoIC0gYS5mcm9tLmxlbmd0aClcbiAgaWYgKGFjdGl2ZS5sZW5ndGggPT09IDApIHJldHVybiB7IGNvbnRlbnQsIHJlYm91bmQ6IFtdIH1cblxuICBjb25zdCByZWJvdW5kID0gbmV3IFNldDxzdHJpbmc+KClcbiAgY29uc3Qgc3RlcHMgPSBzcGxpdFJlY2lwZVN0ZXBzKGNvbnRlbnQpLm1hcChzdGVwID0+IHtcbiAgICBpZiAoc3RlcC5zdGFydHNXaXRoKCdcdTUzQzJcdTY1NzAnKSB8fCBzdGVwLnN0YXJ0c1dpdGgoJ1x1NTJBOFx1NjAwMVx1NTNDMlx1NjU3MCcpKSByZXR1cm4gc3RlcFxuICAgIGxldCBvdXQgPSBzdGVwXG4gICAgZm9yIChjb25zdCBlIG9mIGFjdGl2ZSkge1xuICAgICAgaWYgKCFvdXQuaW5jbHVkZXMoZS5mcm9tKSkgY29udGludWVcbiAgICAgIG91dCA9IG91dC5zcGxpdChlLmZyb20pLmpvaW4oZS50bylcbiAgICAgIHJlYm91bmQuYWRkKGUubmFtZSlcbiAgICB9XG4gICAgcmV0dXJuIG91dFxuICB9KVxuICBpZiAocmVib3VuZC5zaXplID09PSAwKSByZXR1cm4geyBjb250ZW50LCByZWJvdW5kOiBbXSB9XG4gIHJldHVybiB7IGNvbnRlbnQ6IHN0ZXBzLmpvaW4oJ1x1RkYwQycpLCByZWJvdW5kOiBbLi4ucmVib3VuZF0gfVxufVxuXG4vKiogUGFyc2UgdG9vbCBgcGFyYW1zYCBhcmc6IEpTT04gb2JqZWN0IHN0cmluZyBvciBhbHJlYWR5LXBsYWluIHJlY29yZC4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVBhcmFtc0FyZyhyYXc6IHVua25vd24pOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHwgdW5kZWZpbmVkIHtcbiAgaWYgKHJhdyA9PSBudWxsIHx8IHJhdyA9PT0gJycpIHJldHVybiB1bmRlZmluZWRcbiAgaWYgKHR5cGVvZiByYXcgPT09ICdvYmplY3QnICYmICFBcnJheS5pc0FycmF5KHJhdykpIHtcbiAgICBjb25zdCBvdXQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fVxuICAgIGZvciAoY29uc3QgW2ssIHZdIG9mIE9iamVjdC5lbnRyaWVzKHJhdyBhcyBSZWNvcmQ8c3RyaW5nLCB1bmtub3duPikpIHtcbiAgICAgIGlmICh0eXBlb2YgayA9PT0gJ3N0cmluZycgJiYgay50cmltKCkpIG91dFtrLnRyaW0oKV0gPSBTdHJpbmcodiA/PyAnJylcbiAgICB9XG4gICAgcmV0dXJuIE9iamVjdC5rZXlzKG91dCkubGVuZ3RoID8gb3V0IDogdW5kZWZpbmVkXG4gIH1cbiAgaWYgKHR5cGVvZiByYXcgIT09ICdzdHJpbmcnKSByZXR1cm4gdW5kZWZpbmVkXG4gIGNvbnN0IHRleHQgPSByYXcudHJpbSgpXG4gIGlmICghdGV4dCkgcmV0dXJuIHVuZGVmaW5lZFxuICB0cnkge1xuICAgIGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2UodGV4dCkgYXMgdW5rbm93blxuICAgIHJldHVybiBwYXJzZVBhcmFtc0FyZyhwYXJzZWQpXG4gIH0gY2F0Y2gge1xuICAgIHRocm93IG5ldyBFcnJvcihgcGFyYW1zIG11c3QgYmUgYSBKU09OIG9iamVjdCBzdHJpbmcsIGdvdDogJHt0ZXh0LnNsaWNlKDAsIDEyMCl9YClcbiAgfVxufVxuIiwgIi8qKlxyXG4gKiBJbi1jaGF0IHRvb2wgY2FyZCBmb3Igd2ViY2xhd19ydW46IHdoaWxlIHBlbmRpbmcsIHBvbGwgbGl2ZSBzdGVwIGxvZ3MuXHJcbiAqL1xyXG5pbXBvcnQgeyB1c2VFZmZlY3QsIHVzZVJlZiwgdXNlU3RhdGUsIHR5cGUgUmVhY3ROb2RlIH0gZnJvbSAncmVhY3QnXHJcbmltcG9ydCB0eXBlIHsgUHJvcHNMb2NhbGUgfSBmcm9tICdAZGVlcHNlZWstYWkvZHNoLWNsaWVudC11aS1zbG90cydcclxuaW1wb3J0IHsgTGl2ZVByZXZpZXdJbWFnZSB9IGZyb20gJy4vTGl2ZVByZXZpZXdJbWFnZS5qcydcclxuaW1wb3J0IHsgcmVxdWVzdE9wZW5MaXZlIH0gZnJvbSAnLi9saXZlLW9wZW4udHMnXHJcblxyXG5jb25zdCBDQU5ESURBVEVfUE9SVFMgPSBbMTkyMjksIDE5MjMwLCAxOTIzMSwgMTkyMzIsIDE5MjMzXVxyXG5cclxudHlwZSBQaGFzZSA9ICdwcmVwYXJpbmcnIHwgJ3N0YXJ0JyB8ICdyZXN1bHQnXHJcblxyXG50eXBlIEJsb2NrID0ge1xyXG4gIGNvbnRlbnQ/OiByZWFkb25seSB7IHR5cGU6IHN0cmluZzsgdGV4dD86IHN0cmluZyB9W11cclxuICBtZXRhPzogdW5rbm93blxyXG4gIGlzRXJyb3I/OiBib29sZWFuXHJcbiAgYXJnc1Jhdz86IHN0cmluZ1xyXG4gIGNhbGw/OiB7IG5hbWU6IHN0cmluZzsgYXJnc1Jhdzogc3RyaW5nIH0gfCBudWxsXHJcbiAgZXJyb3I/OiB7IG5hbWU6IHN0cmluZzsgY29kZTogc3RyaW5nOyByZWFzb24/OiBzdHJpbmcgfVxyXG59XHJcblxyXG5leHBvcnQgdHlwZSBXZWJjbGF3UnVuVG9vbHZpZXdQcm9wcyA9IFByb3BzTG9jYWxlPCd3ZWJjbGF3UnVuVG9vbCc+ICYge1xyXG4gIHRvb2xOYW1lOiBzdHJpbmdcclxuICBwaGFzZTogUGhhc2VcclxuICBibG9jazogQmxvY2tcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZmluZEJhc2UoKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgZm9yIChjb25zdCBwb3J0IG9mIENBTkRJREFURV9QT1JUUykge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgY3RybCA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKVxyXG4gICAgICBjb25zdCB0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4gY3RybC5hYm9ydCgpLCA0MDApXHJcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGBodHRwOi8vMTI3LjAuMC4xOiR7cG9ydH0vYXBpL2hlYWx0aGAsIHtcclxuICAgICAgICBzaWduYWw6IGN0cmwuc2lnbmFsLFxyXG4gICAgICB9KVxyXG4gICAgICBjbGVhclRpbWVvdXQodGltZXIpXHJcbiAgICAgIGlmICghcmVzLm9rKSBjb250aW51ZVxyXG4gICAgICBjb25zdCBqID0gKGF3YWl0IHJlcy5qc29uKCkpIGFzIHsgb2s/OiBib29sZWFuOyBzZXJ2aWNlPzogc3RyaW5nIH1cclxuICAgICAgaWYgKGoub2sgJiYgai5zZXJ2aWNlID09PSAnd2ViY2xhdy1hY2NvdW50cy11aScpIHtcclxuICAgICAgICByZXR1cm4gYGh0dHA6Ly8xMjcuMC4wLjE6JHtwb3J0fWBcclxuICAgICAgfVxyXG4gICAgfSBjYXRjaCB7XHJcbiAgICAgIC8qIG5leHQgKi9cclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIG51bGxcclxufVxyXG5cclxuZnVuY3Rpb24gdGV4dEZyb21SZXN1bHQoYmxvY2s6IEJsb2NrKTogc3RyaW5nIHtcclxuICBjb25zdCBwYXJ0cyA9IChibG9jay5jb250ZW50ID8/IFtdKVxyXG4gICAgLmZpbHRlcihiID0+IGIudHlwZSA9PT0gJ3RleHQnICYmIGIudGV4dClcclxuICAgIC5tYXAoYiA9PiBiLnRleHQhLnRyaW0oKSlcclxuICAgIC5maWx0ZXIoQm9vbGVhbilcclxuICByZXR1cm4gcGFydHMuam9pbignXFxuJykudHJpbSgpXHJcbn1cclxuXHJcbmZ1bmN0aW9uIHN1bW1hcml6ZVJlc3VsdCh0ZXh0OiBzdHJpbmcsIHQ6IFdlYmNsYXdSdW5Ub29sdmlld1Byb3BzWyd0J10pOiBzdHJpbmcge1xyXG4gIGlmICgvTkVFRF9IVU1BTnxuZWVkSHVtYW58XHU5NzAwXHU4OTgxXHU5QThDXHU4QkMxXHU3ODAxfFx1OTcwMFx1ODk4MVx1NEVCQVx1NURFNS9pLnRlc3QodGV4dCkpIHJldHVybiB0KCduZWVkSHVtYW4nKVxyXG4gIGlmICgvY2FuY2VsbGVkfFx1NURGMlx1NTNENlx1NkQ4OHxSVU5fQ0FOQ0VMTEVEL2kudGVzdCh0ZXh0KSkgcmV0dXJuIHQoJ2NhbmNlbGxlZCcpXHJcbiAgaWYgKC93ZWJjbGF3X3J1bjpcXHMqb2tcXGJ8Xm9rXFxiL2ltLnRlc3QodGV4dCkgfHwgL1xcYm9rXFxiLipydW5fZGlyL2kudGVzdCh0ZXh0KSkge1xyXG4gICAgcmV0dXJuIHQoJ2RvbmUnKVxyXG4gIH1cclxuICBpZiAoL3dlYmNsYXdfcnVuOlxccypmYWlsZWR8ZmFpbGVkfGVycm9yOi9pLnRlc3QodGV4dCkpIHJldHVybiB0KCdmYWlsZWQnKVxyXG4gIHJldHVybiB0KCdkb25lJylcclxufVxyXG5cclxuLyoqXHJcbiAqIFBlbmRpbmc6IGxpdmUgbG9nIHBvbGwuIFJlc3VsdDoga2VlcCBhIHNob3J0IGxvZyBwYW5lbCBmcm9tIHJlc3VsdCB0ZXh0LlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIFdlYmNsYXdSdW5Ub29sdmlldyh7XHJcbiAgcGhhc2UsXHJcbiAgYmxvY2ssXHJcbiAgdCxcclxufTogV2ViY2xhd1J1blRvb2x2aWV3UHJvcHMpOiBSZWFjdE5vZGUge1xyXG4gIGNvbnN0IFtsaW5lcywgc2V0TGluZXNdID0gdXNlU3RhdGU8c3RyaW5nW10+KFtdKVxyXG4gIGNvbnN0IFtiYXNlT2ssIHNldEJhc2VPa10gPSB1c2VTdGF0ZSh0cnVlKVxyXG4gIGNvbnN0IFtpbWdVcmwsIHNldEltZ1VybF0gPSB1c2VTdGF0ZSgnJylcclxuICAvKiogSG9zdCBjbGVhcnMgbGl2ZSBtYXJrZXJzIGJlZm9yZSBwYXJhbSBjb25maXJtOyBhIHJ1bkRpciBtZWFucyBsaXRlIGhhcyBzdGFydGVkLiAqL1xyXG4gIGNvbnN0IFtzdGFydGVkLCBzZXRTdGFydGVkXSA9IHVzZVN0YXRlKGZhbHNlKVxyXG4gIGNvbnN0IHNjcm9sbGVyID0gdXNlUmVmPEhUTUxEaXZFbGVtZW50IHwgbnVsbD4obnVsbClcclxuICBjb25zdCBvcGVuZWRSdW5EaXIgPSB1c2VSZWYoJycpXHJcbiAgY29uc3QgcGVuZGluZyA9IHBoYXNlID09PSAncHJlcGFyaW5nJyB8fCBwaGFzZSA9PT0gJ3N0YXJ0J1xyXG5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKCFwZW5kaW5nKSByZXR1cm5cclxuICAgIGxldCBjYW5jZWxsZWQgPSBmYWxzZVxyXG4gICAgbGV0IGJhc2U6IHN0cmluZyB8IG51bGwgPSBudWxsXHJcbiAgICBjb25zdCB0aWNrID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgICBpZiAoIWJhc2UpIGJhc2UgPSBhd2FpdCBmaW5kQmFzZSgpXHJcbiAgICAgIGlmIChjYW5jZWxsZWQpIHJldHVyblxyXG4gICAgICBpZiAoIWJhc2UpIHtcclxuICAgICAgICBzZXRCYXNlT2soZmFsc2UpXHJcbiAgICAgICAgcmV0dXJuXHJcbiAgICAgIH1cclxuICAgICAgc2V0QmFzZU9rKHRydWUpXHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgW2xvZ1JlcywgZm9jdXNSZXNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xyXG4gICAgICAgICAgZmV0Y2goYCR7YmFzZX0vYXBpL2xpdmUvbG9nYCksXHJcbiAgICAgICAgICBmZXRjaChgJHtiYXNlfS9hcGkvbGl2ZS9mb2N1c2ApLFxyXG4gICAgICAgIF0pXHJcbiAgICAgICAgY29uc3QgaiA9IChhd2FpdCBsb2dSZXMuanNvbigpKSBhcyB7XHJcbiAgICAgICAgICBvaz86IGJvb2xlYW5cclxuICAgICAgICAgIGxpbmVzPzogc3RyaW5nW11cclxuICAgICAgICAgIHJ1bkRpcj86IHN0cmluZ1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBmb2N1c0pzb24gPSAoYXdhaXQgZm9jdXNSZXMuanNvbigpKSBhcyB7XHJcbiAgICAgICAgICBvaz86IGJvb2xlYW5cclxuICAgICAgICAgIGZvY3VzPzogeyBydW5EaXI/OiBzdHJpbmcgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIWNhbmNlbGxlZCAmJiBqLm9rICYmIEFycmF5LmlzQXJyYXkoai5saW5lcykpIHtcclxuICAgICAgICAgIHNldExpbmVzKGoubGluZXMuc2xpY2UoLTYwKSlcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgcnVuRGlyID1cclxuICAgICAgICAgIGoucnVuRGlyPy50cmltKCkgfHwgZm9jdXNKc29uLmZvY3VzPy5ydW5EaXI/LnRyaW0oKSB8fCAnJ1xyXG4gICAgICAgIGlmICghY2FuY2VsbGVkKSBzZXRTdGFydGVkKHJ1bkRpciAhPT0gJycpXHJcbiAgICAgICAgLy8gU2Vzc2lvbi1zY29wZWQgdG9vbCBjYXJkIGlzIHRoZSBtb3N0IHJlbGlhYmxlIG1vbWVudCB0byBvcGVuIHRoZSByaWdodCByYWlsLlxyXG4gICAgICAgIGlmIChydW5EaXIgJiYgcnVuRGlyICE9PSBvcGVuZWRSdW5EaXIuY3VycmVudCkge1xyXG4gICAgICAgICAgb3BlbmVkUnVuRGlyLmN1cnJlbnQgPSBydW5EaXJcclxuICAgICAgICAgIHJlcXVlc3RPcGVuTGl2ZShydW5EaXIpXHJcbiAgICAgICAgfVxyXG4gICAgICAgIC8vIEZvbGxvdyBsaXZlLXByZXZpZXcvdGltZWxpbmUgb25seSAocmVhbCBwYWdlIHNob3RzIFx1MjAxNCBuZXZlciBjYXB0Y2hhIGNyb3ApLlxyXG4gICAgICAgIGlmICghcnVuRGlyKSB7XHJcbiAgICAgICAgICBpZiAoIWNhbmNlbGxlZCkgc2V0SW1nVXJsKCcnKVxyXG4gICAgICAgICAgcmV0dXJuXHJcbiAgICAgICAgfVxyXG4gICAgICAgIGNvbnN0IG1ldGFSZXMgPSBhd2FpdCBmZXRjaChcclxuICAgICAgICAgIGAke2Jhc2V9L2FwaS9saXZlL21ldGE/cnVuRGlyPSR7ZW5jb2RlVVJJQ29tcG9uZW50KHJ1bkRpcil9JnQ9JHtEYXRlLm5vdygpfWAsXHJcbiAgICAgICAgICB7IGNhY2hlOiAnbm8tc3RvcmUnIH0sXHJcbiAgICAgICAgKS5jYXRjaCgoKSA9PiBudWxsKVxyXG4gICAgICAgIGxldCBuZXh0VXJsID0gJydcclxuICAgICAgICBpZiAobWV0YVJlcz8ub2spIHtcclxuICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIGNvbnN0IG1ldGFKc29uID0gKGF3YWl0IG1ldGFSZXMuanNvbigpKSBhcyB7XHJcbiAgICAgICAgICAgICAgb2s/OiBib29sZWFuXHJcbiAgICAgICAgICAgICAgaGFzUG5nPzogYm9vbGVhblxyXG4gICAgICAgICAgICAgIGxhdGVzdElkPzogbnVtYmVyIHwgbnVsbFxyXG4gICAgICAgICAgICAgIG1ldGE/OiB7IHVwZGF0ZWRBdD86IHN0cmluZyB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgaWYgKG1ldGFKc29uLm9rICYmIG1ldGFKc29uLmhhc1BuZykge1xyXG4gICAgICAgICAgICAgIGNvbnN0IGxhdGVzdCA9XHJcbiAgICAgICAgICAgICAgICB0eXBlb2YgbWV0YUpzb24ubGF0ZXN0SWQgPT09ICdudW1iZXInID8gbWV0YUpzb24ubGF0ZXN0SWQgOiBudWxsXHJcbiAgICAgICAgICAgICAgY29uc3QgYnVzdCA9IG1ldGFKc29uLm1ldGE/LnVwZGF0ZWRBdCB8fCBsYXRlc3QgfHwgRGF0ZS5ub3coKVxyXG4gICAgICAgICAgICAgIGNvbnN0IHEgPSBuZXcgVVJMU2VhcmNoUGFyYW1zKHsgcnVuRGlyLCB0OiBTdHJpbmcoYnVzdCkgfSlcclxuICAgICAgICAgICAgICBpZiAobGF0ZXN0ICE9IG51bGwpIHEuc2V0KCdmcmFtZScsIFN0cmluZyhsYXRlc3QpKVxyXG4gICAgICAgICAgICAgIG5leHRVcmwgPSBgJHtiYXNlfS9hcGkvbGl2ZS9wbmc/JHtxLnRvU3RyaW5nKCl9YFxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICB9IGNhdGNoIHtcclxuICAgICAgICAgICAgbmV4dFVybCA9ICcnXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmICghY2FuY2VsbGVkKSBzZXRJbWdVcmwobmV4dFVybClcclxuICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgYmFzZSA9IG51bGxcclxuICAgICAgICBpZiAoIWNhbmNlbGxlZCkge1xyXG4gICAgICAgICAgc2V0QmFzZU9rKGZhbHNlKVxyXG4gICAgICAgICAgc2V0SW1nVXJsKCcnKVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgdm9pZCB0aWNrKClcclxuICAgIGNvbnN0IGlkID0gd2luZG93LnNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgdm9pZCB0aWNrKClcclxuICAgIH0sIDcwMClcclxuICAgIHJldHVybiAoKSA9PiB7XHJcbiAgICAgIGNhbmNlbGxlZCA9IHRydWVcclxuICAgICAgd2luZG93LmNsZWFySW50ZXJ2YWwoaWQpXHJcbiAgICB9XHJcbiAgfSwgW3BlbmRpbmddKVxyXG5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgY29uc3QgZWwgPSBzY3JvbGxlci5jdXJyZW50XHJcbiAgICBpZiAoIWVsKSByZXR1cm5cclxuICAgIGVsLnNjcm9sbFRvcCA9IGVsLnNjcm9sbEhlaWdodFxyXG4gIH0sIFtsaW5lc10pXHJcblxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBpZiAocGVuZGluZykgcmV0dXJuXHJcbiAgICBjb25zdCB0ZXh0ID0gdGV4dEZyb21SZXN1bHQoYmxvY2spXHJcbiAgICBpZiAoIXRleHQpIHJldHVyblxyXG4gICAgY29uc3QgZXh0cmFjdGVkID0gdGV4dFxyXG4gICAgICAuc3BsaXQoL1xccj9cXG4vKVxyXG4gICAgICAubWFwKHMgPT4gcy50cmltKCkpXHJcbiAgICAgIC5maWx0ZXIocyA9PiBzICYmICFzLnN0YXJ0c1dpdGgoJ3snKSAmJiAhL15yZWNpcGVQYXRoOnxecnVuX2Rpcjp8XmVycm9yOiQvaS50ZXN0KHMpKVxyXG4gICAgICAuc2xpY2UoLTQwKVxyXG4gICAgaWYgKGV4dHJhY3RlZC5sZW5ndGggPiAwKSBzZXRMaW5lcyhleHRyYWN0ZWQpXHJcbiAgfSwgW3BlbmRpbmcsIGJsb2NrXSlcclxuXHJcbiAgLy8gUGVuZGluZyBiZWZvcmUgbGl0ZSBzdGFydHMgPSBIb3N0IGlzIHN0aWxsIGNvbmZpcm1pbmcgcGFyYW1zOiBubyBwcmV2aWV3IHlldCxcclxuICAvLyBzbyB0aGUgcGFyYW0gZm9ybSBpcyB0aGUgb25seSB0aGluZyBhc2tpbmcgZm9yIGF0dGVudGlvbi5cclxuICBjb25zdCBhd2FpdGluZ1N0YXJ0ID0gcGVuZGluZyAmJiAhc3RhcnRlZFxyXG5cclxuICBjb25zdCBoZWFkZXIgPSBhd2FpdGluZ1N0YXJ0XHJcbiAgICA/IHQoJ3dhaXRpbmdTdGFydCcpXHJcbiAgICA6IHBlbmRpbmdcclxuICAgID8gdCgncGVuZGluZycpXHJcbiAgICA6IGJsb2NrLmlzRXJyb3JcclxuICAgICAgPyB0KCdmYWlsZWQnKVxyXG4gICAgICA6IHN1bW1hcml6ZVJlc3VsdCh0ZXh0RnJvbVJlc3VsdChibG9jayksIHQpXHJcblxyXG4gIHJldHVybiAoXHJcbiAgICA8ZGl2XHJcbiAgICAgIGRhdGEtd2ViY2xhdy1ydW4tdG9vbHZpZXc9XCJcIlxyXG4gICAgICBzdHlsZT17e1xyXG4gICAgICAgIG1hcmdpblRvcDogNixcclxuICAgICAgICBib3JkZXJSYWRpdXM6IDgsXHJcbiAgICAgICAgYm9yZGVyOiAnMXB4IHNvbGlkIGNvbG9yLW1peChpbiBzcmdiLCBjdXJyZW50Q29sb3IgMTQlLCB0cmFuc3BhcmVudCknLFxyXG4gICAgICAgIG92ZXJmbG93OiAnaGlkZGVuJyxcclxuICAgICAgICBmb250U2l6ZTogMTIsXHJcbiAgICAgICAgbGluZUhlaWdodDogMS40NSxcclxuICAgICAgfX1cclxuICAgID5cclxuICAgICAgPGRpdlxyXG4gICAgICAgIHN0eWxlPXt7XHJcbiAgICAgICAgICBwYWRkaW5nOiAnOHB4IDEwcHgnLFxyXG4gICAgICAgICAgZm9udFdlaWdodDogNjAwLFxyXG4gICAgICAgICAgYmFja2dyb3VuZDogJ2NvbG9yLW1peChpbiBzcmdiLCBjdXJyZW50Q29sb3IgNiUsIHRyYW5zcGFyZW50KScsXHJcbiAgICAgICAgICBkaXNwbGF5OiAnZmxleCcsXHJcbiAgICAgICAgICBqdXN0aWZ5Q29udGVudDogJ3NwYWNlLWJldHdlZW4nLFxyXG4gICAgICAgICAgZ2FwOiA4LFxyXG4gICAgICAgIH19XHJcbiAgICAgID5cclxuICAgICAgICA8c3Bhbj57aGVhZGVyfTwvc3Bhbj5cclxuICAgICAgICB7cGVuZGluZyAmJiAhYXdhaXRpbmdTdGFydCA/IChcclxuICAgICAgICAgIDxzcGFuIHN0eWxlPXt7IG9wYWNpdHk6IDAuNTUsIGZvbnRXZWlnaHQ6IDQwMCB9fT5cclxuICAgICAgICAgICAge2Jhc2VPayA/ICdsaXZlJyA6IHQoJ29mZmxpbmUnKX1cclxuICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICApIDogbnVsbH1cclxuICAgICAgPC9kaXY+XHJcbiAgICAgIHthd2FpdGluZ1N0YXJ0ID8gbnVsbCA6ICg8PlxyXG4gICAgICA8ZGl2XHJcbiAgICAgICAgc3R5bGU9e3tcclxuICAgICAgICAgIHBhZGRpbmc6ICc4cHggMTBweCcsXHJcbiAgICAgICAgICBib3JkZXJCb3R0b206ICcxcHggc29saWQgY29sb3ItbWl4KGluIHNyZ2IsIGN1cnJlbnRDb2xvciAxMCUsIHRyYW5zcGFyZW50KScsXHJcbiAgICAgICAgICBiYWNrZ3JvdW5kOiAnY29sb3ItbWl4KGluIHNyZ2IsIGN1cnJlbnRDb2xvciA0JSwgdHJhbnNwYXJlbnQpJyxcclxuICAgICAgICB9fVxyXG4gICAgICA+XHJcbiAgICAgICAgPExpdmVQcmV2aWV3SW1hZ2VcclxuICAgICAgICAgIHNyYz17aW1nVXJsfVxyXG4gICAgICAgICAgYWx0PVwid2ViY2xhdyBsaXZlIHByZXZpZXdcIlxyXG4gICAgICAgICAgbGFiZWw9e3QoJ3BsYWNlaG9sZGVyJyl9XHJcbiAgICAgICAgICBtYXhIZWlnaHQ9ezE2MH1cclxuICAgICAgICAvPlxyXG4gICAgICA8L2Rpdj5cclxuICAgICAgPGRpdlxyXG4gICAgICAgIHJlZj17c2Nyb2xsZXJ9XHJcbiAgICAgICAgc3R5bGU9e3tcclxuICAgICAgICAgIG1heEhlaWdodDogMjIwLFxyXG4gICAgICAgICAgb3ZlcmZsb3c6ICdhdXRvJyxcclxuICAgICAgICAgIHBhZGRpbmc6ICc4cHggMTBweCcsXHJcbiAgICAgICAgICBmb250RmFtaWx5OiAndWktbW9ub3NwYWNlLCBTRk1vbm8tUmVndWxhciwgTWVubG8sIENvbnNvbGFzLCBtb25vc3BhY2UnLFxyXG4gICAgICAgICAgd2hpdGVTcGFjZTogJ3ByZS13cmFwJyxcclxuICAgICAgICAgIHdvcmRCcmVhazogJ2JyZWFrLXdvcmQnLFxyXG4gICAgICAgICAgb3BhY2l0eTogMC45MixcclxuICAgICAgICB9fVxyXG4gICAgICA+XHJcbiAgICAgICAgeyFiYXNlT2sgJiYgcGVuZGluZyA/IChcclxuICAgICAgICAgIDxzcGFuIHN0eWxlPXt7IG9wYWNpdHk6IDAuNjUgfX0+e3QoJ29mZmxpbmUnKX08L3NwYW4+XHJcbiAgICAgICAgKSA6IGxpbmVzLmxlbmd0aCA9PT0gMCA/IChcclxuICAgICAgICAgIDxzcGFuIHN0eWxlPXt7IG9wYWNpdHk6IDAuNjUgfX0+e3QoJ2VtcHR5Jyl9PC9zcGFuPlxyXG4gICAgICAgICkgOiAoXHJcbiAgICAgICAgICBsaW5lcy5tYXAoKGxpbmUsIGkpID0+IChcclxuICAgICAgICAgICAgPGRpdiBrZXk9e2Ake2l9LSR7bGluZS5zbGljZSgwLCAyNCl9YH0+e2xpbmV9PC9kaXY+XHJcbiAgICAgICAgICApKVxyXG4gICAgICAgICl9XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgICA8Lz4pfVxyXG4gICAgPC9kaXY+XHJcbiAgKVxyXG59XHJcbiIsICIvKipcclxuICogQ2xpZW50IHN1cmZhY2VzOiBgLndlYmNsYXdgIHByZXZpZXcgKyBTZXR0aW5ncyBcdTIxOTIgXHU3RjUxXHU3QUQ5XHU4RDI2XHU1M0Y3ICsgbGl2ZSBzaWRlYmFyLlxyXG4gKi9cclxuaW1wb3J0IHR5cGUgeyBDb250ZXh0IH0gZnJvbSAnQGRlZXBzZWVrLWFpL2NvcmRpcydcclxuaW1wb3J0IHR5cGUge30gZnJvbSAnQGRlZXBzZWVrLWFpL2RzaC1jbGllbnQtdWktc2lkZWJhci1kb2N1bWVudHByZXZpZXcvY2xpZW50J1xyXG5pbXBvcnQgdHlwZSB7fSBmcm9tICdAZGVlcHNlZWstYWkvZHNoLWNsaWVudC11aS1zaWRlYmFyLXJpZ2h0L2NsaWVudCdcclxuaW1wb3J0IHR5cGUge30gZnJvbSAnQGRlZXBzZWVrLWFpL2RzaC1jbGllbnQtdWktc2xvdHMnXHJcbmltcG9ydCB0eXBlIHt9IGZyb20gJy4vc2xvdHMtYXVnLnRzJ1xyXG5pbXBvcnQgeyBBY2NvdW50c1NldHRpbmdzIH0gZnJvbSAnLi9BY2NvdW50c1NldHRpbmdzLnRzeCdcclxuaW1wb3J0IHtcclxuICBBQ0NPVU5UU19OUyxcclxuICBlbiBhcyBhY2NvdW50c0VuLFxyXG4gIHpoIGFzIGFjY291bnRzWmgsXHJcbn0gZnJvbSAnLi9hY2NvdW50cy1sb2NhbGVzLnRzJ1xyXG5pbXBvcnQgeyBXRUJDTEFXX0lDT05fQ1NTIH0gZnJvbSAnLi9pY29ucy1jc3MudHMnXHJcbmltcG9ydCB7IExJVkVfTlMsIGVuIGFzIGxpdmVFbiwgemggYXMgbGl2ZVpoIH0gZnJvbSAnLi9saXZlLWxvY2FsZXMudHMnXHJcbmltcG9ydCB7IGVuLCBOUywgemggfSBmcm9tICcuL2xvY2FsZXMudHMnXHJcbmltcG9ydCB7XHJcbiAgUlVOX1RPT0xfTlMsXHJcbiAgZW4gYXMgcnVuVG9vbEVuLFxyXG4gIHpoIGFzIHJ1blRvb2xaaCxcclxufSBmcm9tICcuL3J1bi10b29sLWxvY2FsZXMudHMnXHJcbmltcG9ydCB7IFdlYmNsYXdMaXZlIH0gZnJvbSAnLi9XZWJjbGF3TGl2ZS50c3gnXHJcbmltcG9ydCB7XHJcbiAgV0VCQ0xBV19PUEVOX0xJVkVfRVZFTlQsXHJcbiAgdHlwZSBXZWJjbGF3T3BlbkxpdmVEZXRhaWwsXHJcbn0gZnJvbSAnLi9saXZlLW9wZW4udHMnXHJcbmltcG9ydCB7IFdlYmNsYXdQcmV2aWV3IH0gZnJvbSAnLi9XZWJjbGF3UHJldmlldy50c3gnXHJcbmltcG9ydCB7IFdlYmNsYXdSdW5Ub29sdmlldyB9IGZyb20gJy4vV2ViY2xhd1J1blRvb2x2aWV3LnRzeCdcclxuXHJcbi8qKiBEb2N1bWVudC1wcmV2aWV3IGltcGxlbWVudGF0aW9uIGlkIChzbG90IGtleSkuICovXHJcbmV4cG9ydCBjb25zdCBXRUJDTEFXX1BSRVZJRVdfSUQgPSAnQGxvbmsxOTg5L3dlYmNsYXcvcmVjaXBlJ1xyXG5cclxuLyoqIFNldHRpbmdzIHNlY3Rpb24gaWQgZm9yIHNpdGUgYWNjb3VudHMuICovXHJcbmV4cG9ydCBjb25zdCBXRUJDTEFXX0FDQ09VTlRTX1NFQ1RJT04gPSAnd2ViY2xhdy1hY2NvdW50cydcclxuXHJcbi8qKiBMaXZlIHNpZGViYXIgdGFiIGltcGxlbWVudGF0aW9uIGlkLiAqL1xyXG5leHBvcnQgY29uc3QgV0VCQ0xBV19MSVZFX0lEID0gJ0Bsb25rMTk4OS93ZWJjbGF3L2xpdmUnXHJcblxyXG4vKiogTGl2ZSBzaWRlYmFyIGtpbmQgKG9wZW5UYWIgbmFtZSkuICovXHJcbmV4cG9ydCBjb25zdCBXRUJDTEFXX0xJVkVfS0lORCA9ICd3ZWJjbGF3LWxpdmUnXHJcblxyXG5jb25zdCBDQU5ESURBVEVfUE9SVFMgPSBbMTkyMjksIDE5MjMwLCAxOTIzMSwgMTkyMzIsIDE5MjMzXVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gZmluZExpdmVCYXNlKCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xyXG4gIGZvciAoY29uc3QgcG9ydCBvZiBDQU5ESURBVEVfUE9SVFMpIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGN0cmwgPSBuZXcgQWJvcnRDb250cm9sbGVyKClcclxuICAgICAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IGN0cmwuYWJvcnQoKSwgNDAwKVxyXG4gICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgaHR0cDovLzEyNy4wLjAuMToke3BvcnR9L2FwaS9oZWFsdGhgLCB7XHJcbiAgICAgICAgc2lnbmFsOiBjdHJsLnNpZ25hbCxcclxuICAgICAgfSlcclxuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKVxyXG4gICAgICBpZiAoIXJlcy5vaykgY29udGludWVcclxuICAgICAgY29uc3QgaiA9IChhd2FpdCByZXMuanNvbigpKSBhcyB7IG9rPzogYm9vbGVhbjsgc2VydmljZT86IHN0cmluZyB9XHJcbiAgICAgIGlmIChqLm9rICYmIGouc2VydmljZSA9PT0gJ3dlYmNsYXctYWNjb3VudHMtdWknKSB7XHJcbiAgICAgICAgcmV0dXJuIGBodHRwOi8vMTI3LjAuMC4xOiR7cG9ydH1gXHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2gge1xyXG4gICAgICAvKiBuZXh0ICovXHJcbiAgICB9XHJcbiAgfVxyXG4gIHJldHVybiBudWxsXHJcbn1cclxuXHJcbi8qKlxyXG4gKiBSZWdpc3RlciBwcmV2aWV3ICsgYWNjb3VudHMgc2V0dGluZ3MgKyBsaXZlIHRhYiArIGZpbGUtdHJlZSBpY29uIENTUy5cclxuICogQHBhcmFtIGN0eCAtIGNsaWVudCByb290IGNvbnRleHQuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gaW5zdGFsbFdlYmNsYXdTdXJmYWNlcyhjdHg6IENvbnRleHQpOiB2b2lkIHtcclxuICBjdHguZWZmZWN0KCgpID0+IHtcclxuICAgIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKVxyXG4gICAgc3R5bGUuc2V0QXR0cmlidXRlKCdkYXRhLXdlYmNsYXctaWNvbnMnLCAnJylcclxuICAgIHN0eWxlLnRleHRDb250ZW50ID0gV0VCQ0xBV19JQ09OX0NTU1xyXG4gICAgZG9jdW1lbnQuaGVhZC5hcHBlbmRDaGlsZChzdHlsZSlcclxuICAgIHJldHVybiAoKSA9PiB7XHJcbiAgICAgIHN0eWxlLnJlbW92ZSgpXHJcbiAgICB9XHJcbiAgfSwgJ3dlYmNsYXc6IGZpbGUgaWNvbnMnKVxyXG5cclxuICBjdHguaW5qZWN0KFsnZG9jdW1lbnRQcmV2aWV3cycsICdzbG90cycsICdsb2NhbGUnXSwgc2NvcGUgPT4ge1xyXG4gICAgc2NvcGUuZWZmZWN0KFxyXG4gICAgICAoKSA9PiBzY29wZS5sb2NhbGUucmVnaXN0ZXIoTlMsIHsgemgsIGVuIH0pLFxyXG4gICAgICAnd2ViY2xhdzogcHJldmlldyBkaWN0aW9uYXJpZXMnLFxyXG4gICAgKVxyXG4gICAgc2NvcGUuZWZmZWN0KFxyXG4gICAgICAoKSA9PiBzY29wZS5sb2NhbGUucmVnaXN0ZXIoQUNDT1VOVFNfTlMsIHsgemg6IGFjY291bnRzWmgsIGVuOiBhY2NvdW50c0VuIH0pLFxyXG4gICAgICAnd2ViY2xhdzogYWNjb3VudHMgZGljdGlvbmFyaWVzJyxcclxuICAgIClcclxuICAgIHNjb3BlLmVmZmVjdChcclxuICAgICAgKCkgPT4gc2NvcGUubG9jYWxlLnJlZ2lzdGVyKExJVkVfTlMsIHsgemg6IGxpdmVaaCwgZW46IGxpdmVFbiB9KSxcclxuICAgICAgJ3dlYmNsYXc6IGxpdmUgZGljdGlvbmFyaWVzJyxcclxuICAgIClcclxuICAgIHNjb3BlLmVmZmVjdChcclxuICAgICAgKCkgPT4gc2NvcGUubG9jYWxlLnJlZ2lzdGVyKFJVTl9UT09MX05TLCB7IHpoOiBydW5Ub29sWmgsIGVuOiBydW5Ub29sRW4gfSksXHJcbiAgICAgICd3ZWJjbGF3OiBydW4gdG9vbHZpZXcgZGljdGlvbmFyaWVzJyxcclxuICAgIClcclxuICAgIGNvbnN0IHQgPSBzY29wZS5sb2NhbGUuYmluZChOUylcclxuICAgIGNvbnN0IHRhID0gc2NvcGUubG9jYWxlLmJpbmQoQUNDT1VOVFNfTlMpXHJcbiAgICBjb25zdCB0bCA9IHNjb3BlLmxvY2FsZS5iaW5kKExJVkVfTlMpXHJcblxyXG4gICAgLy8gSW4tY2hhdCBsaXZlIGxvZyB3aGlsZSB3ZWJjbGF3X3J1biBpcyBwZW5kaW5nIChEU0ggY2Fubm90IHN0cmVhbSBleGVjdXRlKCkpLlxyXG4gICAgc2NvcGUuZWZmZWN0KFxyXG4gICAgICAoKSA9PlxyXG4gICAgICAgIHNjb3BlLnNsb3RzLmluamVjdCgndG9vbC5jYWxsLnRvb2x2aWV3JywgKCkgPT5cclxuICAgICAgICAgIHNjb3BlLnNsb3RzLnJlZ2lzdGVyKFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgbmFtZTogJ3Rvb2wuY2FsbC50b29sdmlldycsXHJcbiAgICAgICAgICAgICAga2V5OiAnd2ViY2xhd19ydW4nLFxyXG4gICAgICAgICAgICAgIGxvY2FsZTogUlVOX1RPT0xfTlMsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFdlYmNsYXdSdW5Ub29sdmlldyxcclxuICAgICAgICAgICksXHJcbiAgICAgICAgKSxcclxuICAgICAgJ3dlYmNsYXc6IHJ1biB0b29sdmlldycsXHJcbiAgICApXHJcbiAgICBzY29wZS5lZmZlY3QoXHJcbiAgICAgICgpID0+XHJcbiAgICAgICAgc2NvcGUuZG9jdW1lbnRQcmV2aWV3cy5yZWdpc3Rlcih7XHJcbiAgICAgICAgICBpZDogV0VCQ0xBV19QUkVWSUVXX0lELFxyXG4gICAgICAgICAgZXh0ZW5zaW9uczogWyd3ZWJjbGF3J10sXHJcbiAgICAgICAgICBwcmlvcml0eTogJ2V4dGVuc2lvbicsXHJcbiAgICAgICAgICB0aXRsZTogKCkgPT4gdCgndGl0bGUnKSxcclxuICAgICAgICAgIGxvYWRpbmc6ICd0ZXh0LXBhZ2VzJyxcclxuICAgICAgICAgIHdyYXA6IHRydWUsXHJcbiAgICAgICAgfSksXHJcbiAgICAgICd3ZWJjbGF3OiBwcmV2aWV3IG1ldGFkYXRhJyxcclxuICAgIClcclxuICAgIHNjb3BlLmVmZmVjdChcclxuICAgICAgKCkgPT5cclxuICAgICAgICBzY29wZS5zbG90cy5pbmplY3QoJ3NpZGViYXIucmlnaHQudGFiLmRvY3VtZW50JywgKCkgPT5cclxuICAgICAgICAgIHNjb3BlLnNsb3RzLnJlZ2lzdGVyKFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgbmFtZTogJ3NpZGViYXIucmlnaHQudGFiLmRvY3VtZW50JyxcclxuICAgICAgICAgICAgICBrZXk6IFdFQkNMQVdfUFJFVklFV19JRCxcclxuICAgICAgICAgICAgICBsb2NhbGU6IE5TLFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBXZWJjbGF3UHJldmlldyxcclxuICAgICAgICAgICksXHJcbiAgICAgICAgKSxcclxuICAgICAgJ3dlYmNsYXc6IHByZXZpZXcgYm9keScsXHJcbiAgICApXHJcbiAgICAvLyBTb2Z0OiBzZXR0aW5ncyBzaGVsbCBtYXkgYmUgYWJzZW50IGluIG1pbmltYWwgY29tcG9zaXRpb25zLlxyXG4gICAgc2NvcGUuZWZmZWN0KFxyXG4gICAgICAoKSA9PlxyXG4gICAgICAgIHNjb3BlLnNsb3RzLmluamVjdCgnc2V0dGluZ3Muc2VjdGlvbicsICgpID0+XHJcbiAgICAgICAgICBzY29wZS5zbG90cy5yZWdpc3RlcihcclxuICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgIG5hbWU6ICdzZXR0aW5ncy5zZWN0aW9uJyxcclxuICAgICAgICAgICAgICBpZDogV0VCQ0xBV19BQ0NPVU5UU19TRUNUSU9OLFxyXG4gICAgICAgICAgICAgIG9yZGVyOiA0NSxcclxuICAgICAgICAgICAgICBsYWJlbDogKCkgPT4gdGEoJ3NlY3Rpb25MYWJlbCcpLFxyXG4gICAgICAgICAgICAgIGxvY2FsZTogQUNDT1VOVFNfTlMsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIEFjY291bnRzU2V0dGluZ3MsXHJcbiAgICAgICAgICApLFxyXG4gICAgICAgICksXHJcbiAgICAgICd3ZWJjbGF3OiBzZXR0aW5ncyBhY2NvdW50cycsXHJcbiAgICApXHJcblxyXG4gICAgLy8gTGl2ZSBleGVjdXRpb24gdGFiIChvcHRpb25hbDogbmVlZHMgc2lkZWJhclJpZ2h0VGFicykuXHJcbiAgICBzY29wZS5pbmplY3QoWydzaWRlYmFyUmlnaHRUYWJzJywgJ3NpZGViYXJSaWdodCcsICdzbG90cyddLCBsaXZlID0+IHtcclxuICAgICAgbGl2ZS5lZmZlY3QoXHJcbiAgICAgICAgKCkgPT5cclxuICAgICAgICAgIGxpdmUuc2lkZWJhclJpZ2h0VGFicy5yZWdpc3Rlcih7XHJcbiAgICAgICAgICAgIGlkOiBXRUJDTEFXX0xJVkVfSUQsXHJcbiAgICAgICAgICAgIGtpbmQ6IFdFQkNMQVdfTElWRV9LSU5ELFxyXG4gICAgICAgICAgICBwcmlvcml0eTogJ2V4dGVuc2lvbicsXHJcbiAgICAgICAgICAgIHRpdGxlOiAoKSA9PiB0bCgndGl0bGUnKSxcclxuICAgICAgICAgICAgZ3VpZGU6IFtcclxuICAgICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgICBpZDogJ3dlYmNsYXctbGl2ZScsXHJcbiAgICAgICAgICAgICAgICBvcmRlcjogMzUsXHJcbiAgICAgICAgICAgICAgICB0aXRsZTogKCkgPT4gdGwoJ2d1aWRlVGl0bGUnKSxcclxuICAgICAgICAgICAgICAgIGRlc2NyaXB0aW9uOiAoKSA9PiB0bCgnZ3VpZGVEZXNjJyksXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgXSxcclxuICAgICAgICAgIH0pLFxyXG4gICAgICAgICd3ZWJjbGF3OiBsaXZlIHRhYiB0eXBlJyxcclxuICAgICAgKVxyXG4gICAgICBsaXZlLmVmZmVjdChcclxuICAgICAgICAoKSA9PlxyXG4gICAgICAgICAgbGl2ZS5zbG90cy5pbmplY3QoJ3NpZGViYXIucmlnaHQucGFuZS50YWInLCAoKSA9PlxyXG4gICAgICAgICAgICBsaXZlLnNsb3RzLnJlZ2lzdGVyKFxyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIG5hbWU6ICdzaWRlYmFyLnJpZ2h0LnBhbmUudGFiJyxcclxuICAgICAgICAgICAgICAgIGtleTogV0VCQ0xBV19MSVZFX0lELFxyXG4gICAgICAgICAgICAgICAgbG9jYWxlOiBMSVZFX05TLFxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgV2ViY2xhd0xpdmUsXHJcbiAgICAgICAgICAgICksXHJcbiAgICAgICAgICApLFxyXG4gICAgICAgICd3ZWJjbGF3OiBsaXZlIHRhYiBib2R5JyxcclxuICAgICAgKVxyXG5cclxuICAgICAgLy8gUG9sbCBIb3N0IGZvY3VzIG1hcmtlciBcdTIxOTIgb3BlblRhYiB3aXRoIHJ1bkRpci5cclxuICAgICAgLy8gT25seSBhZHZhbmNlIGxhc3RTZXEgYWZ0ZXIgb3BlblRhYiBzdWNjZWVkczsgcmV0cnkgd2hpbGUgU2Vzc2lvbiBzdXJmYWNlIGlzIGNvbGQuXHJcbiAgICAgIC8vIEFsc28gaG9ub3IgdG9vbHZpZXcgQ3VzdG9tRXZlbnQgKGZpcmVzIHdoaWxlIHRoZSBhZ2VudCBjYXJkIGlzIG9uIHNjcmVlbikuXHJcbiAgICAgIGxpdmUuZWZmZWN0KCgpID0+IHtcclxuICAgICAgICBsZXQgY2FuY2VsbGVkID0gZmFsc2VcclxuICAgICAgICBsZXQgbGFzdE9wZW5lZFNlcSA9IC0xXHJcbiAgICAgICAgbGV0IGxhc3RPcGVuZWRSdW5EaXIgPSAnJ1xyXG4gICAgICAgIGxldCBwZW5kaW5nUnVuRGlyID0gJydcclxuICAgICAgICBsZXQgYmFzZTogc3RyaW5nIHwgbnVsbCA9IG51bGxcclxuICAgICAgICAvKiogTGVmdG92ZXIgbGl2ZS1mb2N1cy5qc29uIGZyb20gYSBwcmV2aW91cyBzZXNzaW9uIG11c3Qgbm90IHlhbmsgdGhlIHJhaWwgb3Blbi4gKi9cclxuICAgICAgICBsZXQgc2VlZGVkTGVmdG92ZXJGb2N1cyA9IGZhbHNlXHJcblxyXG4gICAgICAgIC8vIElmIHRoZSB1c2VyIGNvbGxhcHNlcyB0aGUgcmlnaHQgcmFpbCwgc3RvcCBmb3JjaW5nIGl0IGJhY2sgb3Blbi5cclxuICAgICAgICBsZXQgdXNlckNvbGxhcHNlZFJhaWwgPSBmYWxzZVxyXG4gICAgICAgIGxldCBldmVyT3BlbmVkID0gZmFsc2VcclxuICAgICAgICAvKiogSG9zdCBgbGl2ZUF1dG9PcGVuYDsgb2ZmIFx1MjE5MiBuZXZlciBvcGVuVGFiLCB0aGUgdXNlciBvcGVucyB0aGUgbGl2ZSB0YWIgYnkgaGFuZC4gKi9cclxuICAgICAgICBsZXQgYXV0b09wZW4gPSBmYWxzZVxyXG5cclxuICAgICAgICBjb25zdCBub3RlQ29sbGFwc2VkSWZBbnkgPSAoKTogdm9pZCA9PiB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBhcGkgPSBsaXZlLnNpZGViYXJSaWdodCBhcyB7IGlzRXhwYW5kZWQ/OiAoKSA9PiBib29sZWFuIH1cclxuICAgICAgICAgICAgaWYgKGV2ZXJPcGVuZWQgJiYgYXBpLmlzRXhwYW5kZWQgJiYgIWFwaS5pc0V4cGFuZGVkKCkpIHtcclxuICAgICAgICAgICAgICB1c2VyQ29sbGFwc2VkUmFpbCA9IHRydWVcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICAgIC8qIG9wdGlvbmFsICovXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCB0cnlPcGVuID0gKHJ1bkRpcjogc3RyaW5nLCBzZXE6IG51bWJlciwgcmV2ZWFsOiBib29sZWFuKTogYm9vbGVhbiA9PiB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBub3RlQ29sbGFwc2VkSWZBbnkoKVxyXG4gICAgICAgICAgICBjb25zdCBhcGkgPSBsaXZlLnNpZGViYXJSaWdodCBhcyB7XHJcbiAgICAgICAgICAgICAgb3BlblRhYjogdHlwZW9mIGxpdmUuc2lkZWJhclJpZ2h0Lm9wZW5UYWJcclxuICAgICAgICAgICAgICBpc0V4cGFuZGVkPzogKCkgPT4gYm9vbGVhblxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vIEFmdGVyIHRoZSB1c2VyIGNsb3NlcyB0aGUgcmFpbCwgb25seSByZWZyZXNoIHRhYiBwYXJhbXMgcXVpZXRseS5cclxuICAgICAgICAgICAgY29uc3QgbWF5UmV2ZWFsID0gcmV2ZWFsICYmICF1c2VyQ29sbGFwc2VkUmFpbFxyXG4gICAgICAgICAgICBhcGkub3BlblRhYihXRUJDTEFXX0xJVkVfS0lORCwge1xyXG4gICAgICAgICAgICAgIHBhcmFtczogeyBydW5EaXIsIGZvY3VzU2VxOiBzZXEgfSxcclxuICAgICAgICAgICAgICByZXZlYWxJZk9wZW5lZDogbWF5UmV2ZWFsLFxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICBpZiAobWF5UmV2ZWFsKSBldmVyT3BlbmVkID0gdHJ1ZVxyXG4gICAgICAgICAgICBsYXN0T3BlbmVkU2VxID0gTWF0aC5tYXgobGFzdE9wZW5lZFNlcSwgc2VxKVxyXG4gICAgICAgICAgICBsYXN0T3BlbmVkUnVuRGlyID0gcnVuRGlyXHJcbiAgICAgICAgICAgIHBlbmRpbmdSdW5EaXIgPSAnJ1xyXG4gICAgICAgICAgICBub3RlQ29sbGFwc2VkSWZBbnkoKVxyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxyXG4gICAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICAgIHBlbmRpbmdSdW5EaXIgPSBydW5EaXJcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBvbk9wZW5MaXZlID0gKGV2OiBFdmVudCkgPT4ge1xyXG4gICAgICAgICAgY29uc3QgZGV0YWlsID0gKGV2IGFzIEN1c3RvbUV2ZW50PFdlYmNsYXdPcGVuTGl2ZURldGFpbD4pLmRldGFpbFxyXG4gICAgICAgICAgY29uc3QgcnVuRGlyID0gZGV0YWlsPy5ydW5EaXI/LnRyaW0oKSB8fCAnJ1xyXG4gICAgICAgICAgaWYgKCFydW5EaXIgfHwgY2FuY2VsbGVkIHx8ICFhdXRvT3BlbikgcmV0dXJuXHJcbiAgICAgICAgICBub3RlQ29sbGFwc2VkSWZBbnkoKVxyXG4gICAgICAgICAgLy8gVXNlciBjbG9zZWQgdGhlIHJhaWwgXHUyMDE0IGRvbid0IHlhbmsgaXQgb3BlbiBmcm9tIHRoZSB0b29sIGNhcmQgZWl0aGVyLlxyXG4gICAgICAgICAgaWYgKHVzZXJDb2xsYXBzZWRSYWlsKSByZXR1cm5cclxuICAgICAgICAgIHNlZWRlZExlZnRvdmVyRm9jdXMgPSB0cnVlXHJcbiAgICAgICAgICAvLyBGb3JjZSBhIHJldHJ5IGV2ZW4gd2hlbiBzZXEgaXMgdW5jaGFuZ2VkICh0b29sdmlldyBzYXcgcnVuRGlyIGZpcnN0KS5cclxuICAgICAgICAgIGlmIChydW5EaXIgIT09IGxhc3RPcGVuZWRSdW5EaXIpIGxhc3RPcGVuZWRTZXEgPSAtMVxyXG4gICAgICAgICAgdHJ5T3BlbihydW5EaXIsIGxhc3RPcGVuZWRTZXEgKyAxLCB0cnVlKVxyXG4gICAgICAgIH1cclxuICAgICAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcihXRUJDTEFXX09QRU5fTElWRV9FVkVOVCwgb25PcGVuTGl2ZSlcclxuXHJcbiAgICAgICAgY29uc3QgcG9sbCA9IGFzeW5jICgpID0+IHtcclxuICAgICAgICAgIGlmIChjYW5jZWxsZWQpIHJldHVyblxyXG4gICAgICAgICAgaWYgKCFiYXNlKSBiYXNlID0gYXdhaXQgZmluZExpdmVCYXNlKClcclxuICAgICAgICAgIGlmICghYmFzZSB8fCBjYW5jZWxsZWQpIHJldHVyblxyXG4gICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYCR7YmFzZX0vYXBpL2xpdmUvZm9jdXNgKVxyXG4gICAgICAgICAgICBjb25zdCBqID0gKGF3YWl0IHJlcy5qc29uKCkpIGFzIHtcclxuICAgICAgICAgICAgICBvaz86IGJvb2xlYW5cclxuICAgICAgICAgICAgICBmb2N1cz86IHsgcnVuRGlyPzogc3RyaW5nOyBzZXE/OiBudW1iZXIgfVxyXG4gICAgICAgICAgICAgIGF1dG9PcGVuPzogYm9vbGVhblxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGF1dG9PcGVuID0gai5hdXRvT3BlbiA9PT0gdHJ1ZVxyXG4gICAgICAgICAgICBpZiAoIWF1dG9PcGVuKSByZXR1cm5cclxuICAgICAgICAgICAgY29uc3QgZm9jdXMgPSBqLmZvY3VzXHJcbiAgICAgICAgICAgIGNvbnN0IHNlcSA9IHR5cGVvZiBmb2N1cz8uc2VxID09PSAnbnVtYmVyJyA/IGZvY3VzLnNlcSA6IC0xXHJcbiAgICAgICAgICAgIGNvbnN0IHJ1bkRpciA9IGZvY3VzPy5ydW5EaXI/LnRyaW0oKSB8fCBwZW5kaW5nUnVuRGlyXHJcbiAgICAgICAgICAgIGlmICghcnVuRGlyKSByZXR1cm5cclxuICAgICAgICAgICAgLy8gQ29sZCBzdGFydDogYWRvcHQgZGlzayBsZWZ0b3ZlciB3aXRob3V0IHJldmVhbGluZyB0aGUgcmlnaHQgcmFpbC5cclxuICAgICAgICAgICAgaWYgKCFzZWVkZWRMZWZ0b3ZlckZvY3VzICYmICFldmVyT3BlbmVkKSB7XHJcbiAgICAgICAgICAgICAgc2VlZGVkTGVmdG92ZXJGb2N1cyA9IHRydWVcclxuICAgICAgICAgICAgICBsYXN0T3BlbmVkU2VxID0gc2VxID4gMCA/IHNlcSA6IDBcclxuICAgICAgICAgICAgICBsYXN0T3BlbmVkUnVuRGlyID0gcnVuRGlyXHJcbiAgICAgICAgICAgICAgcmV0dXJuXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy8gTmV3IHJ1bkRpciBtdXN0IHJlb3BlbiBldmVuIGlmIHNlcSBzb21laG93IHN0YWxsZWQuXHJcbiAgICAgICAgICAgIGlmIChydW5EaXIgIT09IGxhc3RPcGVuZWRSdW5EaXIgJiYgc2VxIDw9IGxhc3RPcGVuZWRTZXEpIHtcclxuICAgICAgICAgICAgICBsYXN0T3BlbmVkU2VxID0gLTFcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoc2VxIDw9IGxhc3RPcGVuZWRTZXEgJiYgcnVuRGlyID09PSBsYXN0T3BlbmVkUnVuRGlyICYmICFwZW5kaW5nUnVuRGlyKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdHJ5T3BlbihydW5EaXIsIHNlcSA+IDAgPyBzZXEgOiBsYXN0T3BlbmVkU2VxICsgMSwgIXVzZXJDb2xsYXBzZWRSYWlsKVxyXG4gICAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICAgIGJhc2UgPSBudWxsXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZvaWQgcG9sbCgpXHJcbiAgICAgICAgY29uc3QgaWQgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xyXG4gICAgICAgICAgdm9pZCBwb2xsKClcclxuICAgICAgICB9LCA2MDApXHJcbiAgICAgICAgcmV0dXJuICgpID0+IHtcclxuICAgICAgICAgIGNhbmNlbGxlZCA9IHRydWVcclxuICAgICAgICAgIHdpbmRvdy5jbGVhckludGVydmFsKGlkKVxyXG4gICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoV0VCQ0xBV19PUEVOX0xJVkVfRVZFTlQsIG9uT3BlbkxpdmUpXHJcbiAgICAgICAgfVxyXG4gICAgICB9LCAnd2ViY2xhdzogbGl2ZSBmb2N1cyBwb2xsJylcclxuICAgIH0pXHJcbiAgfSlcclxufVxyXG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7OztBQ0lBLG1CQUFvRDtBQW1KekM7QUFsSVgsSUFBTSxrQkFBa0IsQ0FBQyxPQUFPLE9BQU8sT0FBTyxPQUFPLEtBQUs7QUFFMUQsZUFBZSxXQUFtQztBQUNoRCxhQUFXLFFBQVEsaUJBQWlCO0FBQ2xDLFFBQUk7QUFDRixZQUFNLE9BQU8sSUFBSSxnQkFBZ0I7QUFDakMsWUFBTSxRQUFRLFdBQVcsTUFBTSxLQUFLLE1BQU0sR0FBRyxHQUFHO0FBQ2hELFlBQU0sTUFBTSxNQUFNLE1BQU0sb0JBQW9CLElBQUksZUFBZTtBQUFBLFFBQzdELFFBQVEsS0FBSztBQUFBLE1BQ2YsQ0FBQztBQUNELG1CQUFhLEtBQUs7QUFDbEIsVUFBSSxDQUFDLElBQUksR0FBSTtBQUNiLFlBQU0sSUFBSyxNQUFNLElBQUksS0FBSztBQUMxQixVQUFJLEVBQUUsTUFBTSxFQUFFLFlBQVksdUJBQXVCO0FBQy9DLGVBQU8sb0JBQW9CLElBQUk7QUFBQSxNQUNqQztBQUFBLElBQ0YsUUFBUTtBQUFBLElBRVI7QUFBQSxFQUNGO0FBR0EsU0FBTztBQUNUO0FBS08sU0FBUyxpQkFBaUIsRUFBRSxFQUFFLEdBQXFDO0FBQ3hFLFFBQU0sQ0FBQyxNQUFNLE9BQU8sUUFBSSx1QkFBb0MsTUFBUztBQUNyRSxRQUFNLENBQUMsTUFBTSxPQUFPLFFBQUksdUJBQXVCLENBQUMsQ0FBQztBQUNqRCxRQUFN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Q04sZUFBTyxNQUFNO0FBQ1gsc0JBQVk7QUFDWixpQkFBTyxjQUFjLEVBQUU7QUFDdkIsaUJBQU8sb0JBQW9CLHlCQUF5QixVQUFVO0FBQUEsUUFDaEU7QUFBQSxNQUNGLEdBQUcsMEJBQTBCO0FBQUEsSUFDL0IsQ0FBQztBQUFBLEVBQ0gsQ0FBQztBQUNIOzs7QWIvU08sSUFBTSxPQUFPO0FBR2IsSUFBTSxTQUFTLENBQUMsU0FBUyxRQUFRO0FBTWpDLFNBQVMsTUFBTSxLQUFvQjtBQUN4Qyx5QkFBdUIsR0FBRztBQUM1QjsiLAogICJuYW1lcyI6IFsiemgiLCAiZW4iLCAiemgiLCAiZW4iLCAiemgiLCAiZW4iLCAiaW1wb3J0X3JlYWN0IiwgImltcG9ydF9yZWFjdCIsICJpbXBvcnRfanN4X3J1bnRpbWUiLCAiaW1wb3J0X2pzeF9ydW50aW1lIiwgIkNBTkRJREFURV9QT1JUUyIsICJmaW5kQmFzZSIsICJuYW1lIiwgImltcG9ydF9qc3hfcnVudGltZSIsICJpbXBvcnRfcmVhY3QiLCAiaW1wb3J0X2pzeF9ydW50aW1lIiwgIkNBTkRJREFURV9QT1JUUyIsICJmaW5kQmFzZSIsICJDQU5ESURBVEVfUE9SVFMiLCAiemgiLCAiZW4iXQp9Cg==

    return module.exports;
  }
});
