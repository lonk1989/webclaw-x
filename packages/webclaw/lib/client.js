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
  guideDesc: "\u65E0\u5934\u8FD0\u884C\u65F6\u5728\u6B64\u56DE\u770B\u6B65\u9AA4\u4E0E\u5B9E\u65F6\u753B\u9762"
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
  guideDesc: "Scrub step frames or stay on live"
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
        const frameId = frame?.id ?? null;
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
              ),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", style: chipStyle, onClick: goLive, "aria-pressed": live, children: t("live") })
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
  const header = pending ? t("pending") : block.isError ? t("failed") : summarizeResult(textFromResult(block), t);
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
              pending ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { style: { opacity: 0.55, fontWeight: 400 }, children: baseOk ? "live" : t("offline") }) : null
            ]
          }
        ),
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
          if (!runDir || cancelled) return;
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiLi4vc3JjL2NsaWVudC9pbmRleC50cyIsICIuLi9zcmMvY2xpZW50L0FjY291bnRzU2V0dGluZ3MudHN4IiwgIi4uL3NyYy9jbGllbnQvYWNjb3VudHMtbG9jYWxlcy50cyIsICIuLi9zcmMvY2xpZW50L2ljb25zLWNzcy50cyIsICIuLi9zcmMvY2xpZW50L2xpdmUtbG9jYWxlcy50cyIsICIuLi9zcmMvY2xpZW50L2xvY2FsZXMudHMiLCAiLi4vc3JjL2NsaWVudC9ydW4tdG9vbC1sb2NhbGVzLnRzIiwgIi4uL3NyYy9jbGllbnQvV2ViY2xhd0xpdmUudHN4IiwgIi4uL3NyYy9jbGllbnQvTGl2ZVByZXZpZXdJbWFnZS50c3giLCAiLi4vc3JjL2NsaWVudC9saXZlLW9wZW4udHMiLCAiLi4vc3JjL2NsaWVudC9XZWJjbGF3UHJldmlldy50c3giLCAiLi4vc3JjL3BhcmFtcy50cyIsICIuLi9zcmMvY2xpZW50L1dlYmNsYXdSdW5Ub29sdmlldy50c3giLCAiLi4vc3JjL2NsaWVudC9pbnN0YWxsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKipcclxuICogQnJvd3NlciBDbGllbnQgZW50cnkgZm9yIGBAbG9uazE5ODkvd2ViY2xhd2AuXHJcbiAqIEhvc3QgdG9vbHMgbGl2ZSBpbiB0aGUgcGFja2FnZSByb290OyB0aGlzIGhhbGYgb3ducyBgLndlYmNsYXdgIHByZXZpZXcgVVguXHJcbiAqL1xyXG5pbXBvcnQgdHlwZSB7IENvbnRleHQgfSBmcm9tICdAZGVlcHNlZWstYWkvY29yZGlzJ1xyXG5pbXBvcnQgeyBpbnN0YWxsV2ViY2xhd1N1cmZhY2VzIH0gZnJvbSAnLi9pbnN0YWxsLnRzJ1xyXG5cclxuLyoqIENvcmRpcyBjbGllbnQgcGx1Z2luIGlkIChzYW1lIHBhY2thZ2UgYXMgSG9zdCkuICovXHJcbmV4cG9ydCBjb25zdCBuYW1lID0gJ3dlYmNsYXcnXHJcblxyXG4vKiogU29mdCBkZXBzOiBwcmV2aWV3IHJlZ2lzdHJ5IGFycml2ZXMgd2l0aCBzaWRlYmFyLWRvY3VtZW50cHJldmlldy4gKi9cclxuZXhwb3J0IGNvbnN0IGluamVjdCA9IFsnc2xvdHMnLCAnbG9jYWxlJ11cclxuXHJcbi8qKlxyXG4gKiBNb3VudCByZWNpcGUgcHJldmlldywgbGl2ZSBzaWRlYmFyIHRhYiwgYW5kIGZpbGUtdHJlZSBpY29uIHRpbnQuXHJcbiAqIEBwYXJhbSBjdHggLSBjbGllbnQgcm9vdCBjb250ZXh0LlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGFwcGx5KGN0eDogQ29udGV4dCk6IHZvaWQge1xyXG4gIGluc3RhbGxXZWJjbGF3U3VyZmFjZXMoY3R4KVxyXG59XHJcblxyXG5leHBvcnQge1xyXG4gIFdFQkNMQVdfTElWRV9JRCxcclxuICBXRUJDTEFXX0xJVkVfS0lORCxcclxuICBXRUJDTEFXX1BSRVZJRVdfSUQsXHJcbiAgaW5zdGFsbFdlYmNsYXdTdXJmYWNlcyxcclxufSBmcm9tICcuL2luc3RhbGwudHMnXHJcbiIsICIvKipcclxuICogRFNIIFNldHRpbmdzIFx1MjE5MiBcdTdGNTFcdTdBRDlcdThEMjZcdTUzRjc6IGVkaXQgbG9jYWwgdmF1bHQgdmlhIGxvb3BiYWNrIEhvc3QgVUkgQVBJLlxyXG4gKiBQYXNzd29yZHMgbmV2ZXIgZ28gdGhyb3VnaCB0aGUgTExNIFx1MjAxNCBvbmx5IDEyNy4wLjAuMSBIb3N0IHByb2Nlc3MuXHJcbiAqL1xyXG5pbXBvcnQgeyB1c2VFZmZlY3QsIHVzZVN0YXRlLCB0eXBlIFJlYWN0Tm9kZSB9IGZyb20gJ3JlYWN0J1xyXG5pbXBvcnQgdHlwZSB7IFByb3BzTG9jYWxlIH0gZnJvbSAnQGRlZXBzZWVrLWFpL2RzaC1jbGllbnQtdWktc2xvdHMnXHJcblxyXG5leHBvcnQgdHlwZSBBY2NvdW50c1NldHRpbmdzUHJvcHMgPSBQcm9wc0xvY2FsZTwnd2ViY2xhd0FjY291bnRzJz5cclxuXHJcbmludGVyZmFjZSBBY2NvdW50Um93IHtcclxuICBpZDogc3RyaW5nXHJcbiAgbmFtZTogc3RyaW5nXHJcbiAgdXJsOiBzdHJpbmdcclxuICB1c2VybmFtZTogc3RyaW5nXHJcbiAgaGFzX3Bhc3N3b3JkOiBib29sZWFuXHJcbiAgcGFzc3dvcmREcmFmdDogc3RyaW5nXHJcbiAgbXNnOiBzdHJpbmdcclxuICBlcnI6IGJvb2xlYW5cclxuICBzYXZpbmc6IGJvb2xlYW5cclxufVxyXG5cclxuY29uc3QgQ0FORElEQVRFX1BPUlRTID0gWzE5MjI5LCAxOTIzMCwgMTkyMzEsIDE5MjMyLCAxOTIzM11cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGZpbmRCYXNlKCk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4ge1xyXG4gIGZvciAoY29uc3QgcG9ydCBvZiBDQU5ESURBVEVfUE9SVFMpIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IGN0cmwgPSBuZXcgQWJvcnRDb250cm9sbGVyKClcclxuICAgICAgY29uc3QgdGltZXIgPSBzZXRUaW1lb3V0KCgpID0+IGN0cmwuYWJvcnQoKSwgNTAwKVxyXG4gICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgaHR0cDovLzEyNy4wLjAuMToke3BvcnR9L2FwaS9oZWFsdGhgLCB7XHJcbiAgICAgICAgc2lnbmFsOiBjdHJsLnNpZ25hbCxcclxuICAgICAgfSlcclxuICAgICAgY2xlYXJUaW1lb3V0KHRpbWVyKVxyXG4gICAgICBpZiAoIXJlcy5vaykgY29udGludWVcclxuICAgICAgY29uc3QgaiA9IChhd2FpdCByZXMuanNvbigpKSBhcyB7IG9rPzogYm9vbGVhbjsgc2VydmljZT86IHN0cmluZyB9XHJcbiAgICAgIGlmIChqLm9rICYmIGouc2VydmljZSA9PT0gJ3dlYmNsYXctYWNjb3VudHMtdWknKSB7XHJcbiAgICAgICAgcmV0dXJuIGBodHRwOi8vMTI3LjAuMC4xOiR7cG9ydH1gXHJcbiAgICAgIH1cclxuICAgIH0gY2F0Y2gge1xyXG4gICAgICAvKiBuZXh0ICovXHJcbiAgICB9XHJcbiAgfVxyXG4gIC8vIEVwaGVtZXJhbCBwb3J0OiBIb3N0IHdyaXRlcyBhY2NvdW50cy11aS5qc29uIFx1MjAxNCBDbGllbnQgY2Fubm90IHJlYWQgaXQuXHJcbiAgLy8gVXNlciBjYW4gb3BlbiB0aGUgc3RhbmRhbG9uZSBwYWdlIHZpYSB3ZWJjbGF3LWFjY291bnRzLmNtZC5cclxuICByZXR1cm4gbnVsbFxyXG59XHJcblxyXG4vKipcclxuICogU2V0dGluZ3Mgc2VjdGlvbiBib2R5IGZvciBzaXRlIGFjY291bnRzLlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIEFjY291bnRzU2V0dGluZ3MoeyB0IH06IEFjY291bnRzU2V0dGluZ3NQcm9wcyk6IFJlYWN0Tm9kZSB7XHJcbiAgY29uc3QgW2Jhc2UsIHNldEJhc2VdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbCB8IHVuZGVmaW5lZD4odW5kZWZpbmVkKVxyXG4gIGNvbnN0IFtyb3dzLCBzZXRSb3dzXSA9IHVzZVN0YXRlPEFjY291bnRSb3dbXT4oW10pXHJcbiAgY29uc3QgW2xvYWRFcnJvciwgc2V0TG9hZEVycm9yXSA9IHVzZVN0YXRlKCcnKVxyXG5cclxuICBjb25zdCByZWxvYWQgPSBhc3luYyAoYXBpQmFzZTogc3RyaW5nKSA9PiB7XHJcbiAgICBzZXRMb2FkRXJyb3IoJycpXHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgJHthcGlCYXNlfS9hcGkvYWNjb3VudHNgKVxyXG4gICAgICBjb25zdCBkYXRhID0gKGF3YWl0IHJlcy5qc29uKCkpIGFzIHtcclxuICAgICAgICBvaz86IGJvb2xlYW5cclxuICAgICAgICBpdGVtcz86IEFycmF5PHtcclxuICAgICAgICAgIGlkOiBzdHJpbmdcclxuICAgICAgICAgIG5hbWU6IHN0cmluZ1xyXG4gICAgICAgICAgdXJsOiBzdHJpbmdcclxuICAgICAgICAgIHVzZXJuYW1lOiBzdHJpbmdcclxuICAgICAgICAgIGhhc19wYXNzd29yZDogYm9vbGVhblxyXG4gICAgICAgIH0+XHJcbiAgICAgICAgZXJyb3I/OiBzdHJpbmdcclxuICAgICAgfVxyXG4gICAgICBpZiAoIWRhdGEub2spIHtcclxuICAgICAgICBzZXRMb2FkRXJyb3IoZGF0YS5lcnJvciB8fCB0KCdsb2FkRmFpbGVkJykpXHJcbiAgICAgICAgcmV0dXJuXHJcbiAgICAgIH1cclxuICAgICAgc2V0Um93cyhcclxuICAgICAgICAoZGF0YS5pdGVtcyA/PyBbXSkubWFwKGl0ID0+ICh7XHJcbiAgICAgICAgICAuLi5pdCxcclxuICAgICAgICAgIHBhc3N3b3JkRHJhZnQ6ICcnLFxyXG4gICAgICAgICAgbXNnOiAnJyxcclxuICAgICAgICAgIGVycjogZmFsc2UsXHJcbiAgICAgICAgICBzYXZpbmc6IGZhbHNlLFxyXG4gICAgICAgIH0pKSxcclxuICAgICAgKVxyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgc2V0TG9hZEVycm9yKGVycm9yIGluc3RhbmNlb2YgRXJyb3IgPyBlcnJvci5tZXNzYWdlIDogdCgnbG9hZEZhaWxlZCcpKVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGxldCBjYW5jZWxsZWQgPSBmYWxzZVxyXG4gICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xyXG4gICAgICBjb25zdCBmb3VuZCA9IGF3YWl0IGZpbmRCYXNlKClcclxuICAgICAgaWYgKGNhbmNlbGxlZCkgcmV0dXJuXHJcbiAgICAgIHNldEJhc2UoZm91bmQpXHJcbiAgICAgIGlmIChmb3VuZCkgYXdhaXQgcmVsb2FkKGZvdW5kKVxyXG4gICAgfSkoKVxyXG4gICAgcmV0dXJuICgpID0+IHtcclxuICAgICAgY2FuY2VsbGVkID0gdHJ1ZVxyXG4gICAgfVxyXG4gIH0sIFtdKVxyXG5cclxuICBjb25zdCB1cGRhdGVSb3cgPSAoaWQ6IHN0cmluZywgcGF0Y2g6IFBhcnRpYWw8QWNjb3VudFJvdz4pID0+IHtcclxuICAgIHNldFJvd3MocHJldiA9PiBwcmV2Lm1hcChyID0+IChyLmlkID09PSBpZCA/IHsgLi4uciwgLi4ucGF0Y2ggfSA6IHIpKSlcclxuICB9XHJcblxyXG4gIGNvbnN0IHNhdmVSb3cgPSBhc3luYyAocm93OiBBY2NvdW50Um93KSA9PiB7XHJcbiAgICBpZiAoIWJhc2UpIHJldHVyblxyXG4gICAgdXBkYXRlUm93KHJvdy5pZCwgeyBzYXZpbmc6IHRydWUsIG1zZzogdCgnc2F2aW5nJyksIGVycjogZmFsc2UgfSlcclxuICAgIHRyeSB7XHJcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGAke2Jhc2V9L2FwaS9hY2NvdW50cy8ke2VuY29kZVVSSUNvbXBvbmVudChyb3cuaWQpfWAsIHtcclxuICAgICAgICBtZXRob2Q6ICdQVVQnLFxyXG4gICAgICAgIGhlYWRlcnM6IHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9LFxyXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHtcclxuICAgICAgICAgIGlkOiByb3cuaWQsXHJcbiAgICAgICAgICBuYW1lOiByb3cubmFtZSxcclxuICAgICAgICAgIHVybDogcm93LnVybCxcclxuICAgICAgICAgIHVzZXJuYW1lOiByb3cudXNlcm5hbWUsXHJcbiAgICAgICAgICBwYXNzd29yZDogcm93LnBhc3N3b3JkRHJhZnQsXHJcbiAgICAgICAgfSksXHJcbiAgICAgIH0pXHJcbiAgICAgIGNvbnN0IGRhdGEgPSAoYXdhaXQgcmVzLmpzb24oKSkgYXMge1xyXG4gICAgICAgIG9rPzogYm9vbGVhblxyXG4gICAgICAgIGVycm9yPzogc3RyaW5nXHJcbiAgICAgICAgaXRlbT86IHsgaGFzX3Bhc3N3b3JkPzogYm9vbGVhbjsgdXNlcm5hbWU/OiBzdHJpbmc7IHVybD86IHN0cmluZyB9XHJcbiAgICAgIH1cclxuICAgICAgaWYgKGRhdGEub2spIHtcclxuICAgICAgICB1cGRhdGVSb3cocm93LmlkLCB7XHJcbiAgICAgICAgICBzYXZpbmc6IGZhbHNlLFxyXG4gICAgICAgICAgbXNnOiB0KCdzYXZlZCcpLFxyXG4gICAgICAgICAgZXJyOiBmYWxzZSxcclxuICAgICAgICAgIHBhc3N3b3JkRHJhZnQ6ICcnLFxyXG4gICAgICAgICAgaGFzX3Bhc3N3b3JkOiBCb29sZWFuKGRhdGEuaXRlbT8uaGFzX3Bhc3N3b3JkID8/IHJvdy5oYXNfcGFzc3dvcmQpLFxyXG4gICAgICAgICAgdXNlcm5hbWU6IGRhdGEuaXRlbT8udXNlcm5hbWUgPz8gcm93LnVzZXJuYW1lLFxyXG4gICAgICAgICAgdXJsOiBkYXRhLml0ZW0/LnVybCA/PyByb3cudXJsLFxyXG4gICAgICAgIH0pXHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgdXBkYXRlUm93KHJvdy5pZCwge1xyXG4gICAgICAgICAgc2F2aW5nOiBmYWxzZSxcclxuICAgICAgICAgIG1zZzogZGF0YS5lcnJvciB8fCB0KCdzYXZlRmFpbGVkJyksXHJcbiAgICAgICAgICBlcnI6IHRydWUsXHJcbiAgICAgICAgfSlcclxuICAgICAgfVxyXG4gICAgfSBjYXRjaCAoZXJyb3IpIHtcclxuICAgICAgdXBkYXRlUm93KHJvdy5pZCwge1xyXG4gICAgICAgIHNhdmluZzogZmFsc2UsXHJcbiAgICAgICAgbXNnOiBlcnJvciBpbnN0YW5jZW9mIEVycm9yID8gZXJyb3IubWVzc2FnZSA6IHQoJ3NhdmVGYWlsZWQnKSxcclxuICAgICAgICBlcnI6IHRydWUsXHJcbiAgICAgIH0pXHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICBpZiAoYmFzZSA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICByZXR1cm4gPGRpdiBzdHlsZT17eyBwYWRkaW5nOiAxNiB9fT57dCgnbG9hZGluZycpfTwvZGl2PlxyXG4gIH1cclxuXHJcbiAgaWYgKGJhc2UgPT09IG51bGwpIHtcclxuICAgIHJldHVybiAoXHJcbiAgICAgIDxkaXYgc3R5bGU9e3sgcGFkZGluZzogMTYsIG1heFdpZHRoOiA1NjAsIGxpbmVIZWlnaHQ6IDEuNTUsIGZvbnRTaXplOiAxNCB9fT5cclxuICAgICAgICA8cCBzdHlsZT17eyBtYXJnaW5Ub3A6IDAgfX0+e3QoJ29mZmxpbmVUaXRsZScpfTwvcD5cclxuICAgICAgICA8cCBzdHlsZT17eyBvcGFjaXR5OiAwLjggfX0+e3QoJ29mZmxpbmVIaW50Jyl9PC9wPlxyXG4gICAgICAgIDxwcmVcclxuICAgICAgICAgIHN0eWxlPXt7XHJcbiAgICAgICAgICAgIHBhZGRpbmc6IDEyLFxyXG4gICAgICAgICAgICBvdmVyZmxvdzogJ2F1dG8nLFxyXG4gICAgICAgICAgICBmb250U2l6ZTogMTIsXHJcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICdjb2xvci1taXgoaW4gc3JnYiwgY3VycmVudENvbG9yIDYlLCB0cmFuc3BhcmVudCknLFxyXG4gICAgICAgICAgICBib3JkZXJSYWRpdXM6IDgsXHJcbiAgICAgICAgICB9fVxyXG4gICAgICAgID5cclxuICAgICAgICAgIHt0KCdvZmZsaW5lQ21kJyl9XHJcbiAgICAgICAgPC9wcmU+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgKVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIChcclxuICAgIDxkaXYgc3R5bGU9e3sgcGFkZGluZzogMTYsIG1heFdpZHRoOiA2NDAgfX0+XHJcbiAgICAgIDxwIHN0eWxlPXt7IG1hcmdpblRvcDogMCwgb3BhY2l0eTogMC44LCBmb250U2l6ZTogMTMsIGxpbmVIZWlnaHQ6IDEuNSB9fT5cclxuICAgICAgICB7dCgnaW50cm8nKX1cclxuICAgICAgPC9wPlxyXG4gICAgICB7bG9hZEVycm9yID8gKFxyXG4gICAgICAgIDxwIHN0eWxlPXt7IGNvbG9yOiAnI2RjMjYyNicgfX0+e2xvYWRFcnJvcn08L3A+XHJcbiAgICAgICkgOiAoXHJcbiAgICAgICAgcm93cy5tYXAocm93ID0+IChcclxuICAgICAgICAgIDxkaXZcclxuICAgICAgICAgICAga2V5PXtyb3cuaWR9XHJcbiAgICAgICAgICAgIHN0eWxlPXt7XHJcbiAgICAgICAgICAgICAgYm9yZGVyOiAnMXB4IHNvbGlkIGNvbG9yLW1peChpbiBzcmdiLCBjdXJyZW50Q29sb3IgMTQlLCB0cmFuc3BhcmVudCknLFxyXG4gICAgICAgICAgICAgIGJvcmRlclJhZGl1czogMTAsXHJcbiAgICAgICAgICAgICAgcGFkZGluZzogJzEycHggMTRweCcsXHJcbiAgICAgICAgICAgICAgbWFyZ2luQm90dG9tOiAxMixcclxuICAgICAgICAgICAgfX1cclxuICAgICAgICAgID5cclxuICAgICAgICAgICAgPGRpdiBzdHlsZT17eyBkaXNwbGF5OiAnZmxleCcsIGdhcDogOCwgYWxpZ25JdGVtczogJ2NlbnRlcicsIG1hcmdpbkJvdHRvbTogOCB9fT5cclxuICAgICAgICAgICAgICA8c3Ryb25nPntyb3cubmFtZSB8fCByb3cuaWR9PC9zdHJvbmc+XHJcbiAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9e3sgZm9udFNpemU6IDEyLCBvcGFjaXR5OiAwLjcgfX0+XHJcbiAgICAgICAgICAgICAgICB7cm93Lmhhc19wYXNzd29yZCA/IHQoJ2hhc1Bhc3N3b3JkJykgOiB0KCdub1Bhc3N3b3JkJyl9XHJcbiAgICAgICAgICAgICAgPC9zcGFuPlxyXG4gICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgPGxhYmVsIHN0eWxlPXt7IGRpc3BsYXk6ICdibG9jaycsIGZvbnRTaXplOiAxMiwgb3BhY2l0eTogMC42NSwgbWFyZ2luQm90dG9tOiA0IH19PlxyXG4gICAgICAgICAgICAgIHt0KCd1cmwnKX1cclxuICAgICAgICAgICAgPC9sYWJlbD5cclxuICAgICAgICAgICAgPGlucHV0XHJcbiAgICAgICAgICAgICAgdmFsdWU9e3Jvdy51cmx9XHJcbiAgICAgICAgICAgICAgb25DaGFuZ2U9e2UgPT4gdXBkYXRlUm93KHJvdy5pZCwgeyB1cmw6IGUudGFyZ2V0LnZhbHVlIH0pfVxyXG4gICAgICAgICAgICAgIHN0eWxlPXt7IHdpZHRoOiAnMTAwJScsIGJveFNpemluZzogJ2JvcmRlci1ib3gnLCBtYXJnaW5Cb3R0b206IDgsIHBhZGRpbmc6ICc2cHggOHB4JyB9fVxyXG4gICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICA8bGFiZWwgc3R5bGU9e3sgZGlzcGxheTogJ2Jsb2NrJywgZm9udFNpemU6IDEyLCBvcGFjaXR5OiAwLjY1LCBtYXJnaW5Cb3R0b206IDQgfX0+XHJcbiAgICAgICAgICAgICAge3QoJ3VzZXJuYW1lJyl9XHJcbiAgICAgICAgICAgIDwvbGFiZWw+XHJcbiAgICAgICAgICAgIDxpbnB1dFxyXG4gICAgICAgICAgICAgIHZhbHVlPXtyb3cudXNlcm5hbWV9XHJcbiAgICAgICAgICAgICAgYXV0b0NvbXBsZXRlPVwidXNlcm5hbWVcIlxyXG4gICAgICAgICAgICAgIG9uQ2hhbmdlPXtlID0+IHVwZGF0ZVJvdyhyb3cuaWQsIHsgdXNlcm5hbWU6IGUudGFyZ2V0LnZhbHVlIH0pfVxyXG4gICAgICAgICAgICAgIHN0eWxlPXt7IHdpZHRoOiAnMTAwJScsIGJveFNpemluZzogJ2JvcmRlci1ib3gnLCBtYXJnaW5Cb3R0b206IDgsIHBhZGRpbmc6ICc2cHggOHB4JyB9fVxyXG4gICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICA8bGFiZWwgc3R5bGU9e3sgZGlzcGxheTogJ2Jsb2NrJywgZm9udFNpemU6IDEyLCBvcGFjaXR5OiAwLjY1LCBtYXJnaW5Cb3R0b206IDQgfX0+XHJcbiAgICAgICAgICAgICAge3QoJ3Bhc3N3b3JkJyl9XHJcbiAgICAgICAgICAgIDwvbGFiZWw+XHJcbiAgICAgICAgICAgIDxpbnB1dFxyXG4gICAgICAgICAgICAgIHR5cGU9XCJwYXNzd29yZFwiXHJcbiAgICAgICAgICAgICAgdmFsdWU9e3Jvdy5wYXNzd29yZERyYWZ0fVxyXG4gICAgICAgICAgICAgIGF1dG9Db21wbGV0ZT1cIm5ldy1wYXNzd29yZFwiXHJcbiAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9e3QoJ3Bhc3N3b3JkUGxhY2Vob2xkZXInKX1cclxuICAgICAgICAgICAgICBvbkNoYW5nZT17ZSA9PiB1cGRhdGVSb3cocm93LmlkLCB7IHBhc3N3b3JkRHJhZnQ6IGUudGFyZ2V0LnZhbHVlIH0pfVxyXG4gICAgICAgICAgICAgIHN0eWxlPXt7IHdpZHRoOiAnMTAwJScsIGJveFNpemluZzogJ2JvcmRlci1ib3gnLCBtYXJnaW5Cb3R0b206IDgsIHBhZGRpbmc6ICc2cHggOHB4JyB9fVxyXG4gICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICA8ZGl2IHN0eWxlPXt7IGRpc3BsYXk6ICdmbGV4JywgZ2FwOiAxMCwgYWxpZ25JdGVtczogJ2NlbnRlcicgfX0+XHJcbiAgICAgICAgICAgICAgPGJ1dHRvblxyXG4gICAgICAgICAgICAgICAgdHlwZT1cImJ1dHRvblwiXHJcbiAgICAgICAgICAgICAgICBkaXNhYmxlZD17cm93LnNhdmluZ31cclxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHZvaWQgc2F2ZVJvdyhyb3cpfVxyXG4gICAgICAgICAgICAgICAgc3R5bGU9e3tcclxuICAgICAgICAgICAgICAgICAgcGFkZGluZzogJzZweCAxMnB4JyxcclxuICAgICAgICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiA2LFxyXG4gICAgICAgICAgICAgICAgICBib3JkZXI6IDAsXHJcbiAgICAgICAgICAgICAgICAgIGJhY2tncm91bmQ6ICcjMjU2M2ViJyxcclxuICAgICAgICAgICAgICAgICAgY29sb3I6ICcjZmZmJyxcclxuICAgICAgICAgICAgICAgICAgZm9udFdlaWdodDogNjAwLFxyXG4gICAgICAgICAgICAgICAgICBjdXJzb3I6IHJvdy5zYXZpbmcgPyAnZGVmYXVsdCcgOiAncG9pbnRlcicsXHJcbiAgICAgICAgICAgICAgICB9fVxyXG4gICAgICAgICAgICAgID5cclxuICAgICAgICAgICAgICAgIHt0KCdzYXZlJyl9XHJcbiAgICAgICAgICAgICAgPC9idXR0b24+XHJcbiAgICAgICAgICAgICAgPHNwYW4gc3R5bGU9e3sgZm9udFNpemU6IDEyLCBjb2xvcjogcm93LmVyciA/ICcjZGMyNjI2JyA6IHVuZGVmaW5lZCB9fT5cclxuICAgICAgICAgICAgICAgIHtyb3cubXNnfVxyXG4gICAgICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICApKVxyXG4gICAgICApfVxyXG4gICAgICA8cCBzdHlsZT17eyBmb250U2l6ZTogMTIsIG9wYWNpdHk6IDAuNjUgfX0+XHJcbiAgICAgICAgPGEgaHJlZj17YmFzZSArICcvJ30gdGFyZ2V0PVwiX2JsYW5rXCIgcmVsPVwibm9yZWZlcnJlclwiPlxyXG4gICAgICAgICAge3QoJ29wZW5TdGFuZGFsb25lJyl9XHJcbiAgICAgICAgPC9hPlxyXG4gICAgICA8L3A+XHJcbiAgICA8L2Rpdj5cclxuICApXHJcbn1cclxuIiwgIi8qKiBMb2NhbGUgZm9yIFNldHRpbmdzIFx1MjE5MiBcdTdGNTFcdTdBRDlcdThEMjZcdTUzRjcuICovXHJcbmltcG9ydCB0eXBlIHt9IGZyb20gJ0BkZWVwc2Vlay1haS9kc2gtY2xpZW50LXVpLXNsb3RzJ1xyXG5cclxuZGVjbGFyZSBtb2R1bGUgJ0BkZWVwc2Vlay1haS9kc2gtY2xpZW50LXVpLXNsb3RzJyB7XHJcbiAgaW50ZXJmYWNlIExvY2FsZU5hbWVzcGFjZU1hcCB7XHJcbiAgICB3ZWJjbGF3QWNjb3VudHM6IGtleW9mIHR5cGVvZiB6aFxyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IHpoID0ge1xyXG4gIHNlY3Rpb25MYWJlbDogJ1x1N0Y1MVx1N0FEOVx1OEQyNlx1NTNGNycsXHJcbiAgaW50cm86XHJcbiAgICAnXHU3NjdCXHU1RjU1XHU1NzMwXHU1NzQwXHU0RTBFXHU1M0VGXHU5MDA5XHU4RDI2XHU1M0Y3XHU1QkM2XHU3ODAxXHU1M0VBXHU0RkREXHU1QjU4XHU1NzI4XHU2NzJDXHU2NzNBIHdlYmNsYXcgXHU0RkREXHU5NjY5XHU3QkIxXHVGRjA4V2luZG93cyBcdTRFMEIgRFBBUElcdUZGMENtYWNPUy9MaW51eCBcdTRFM0FcdTY3MkNcdTY3M0FcdTZERjdcdTZEQzZcdTVCNThcdTUwQThcdUZGMDlcdTMwMDJcdTk4REVcdTRFNjYgU1NPIFx1N0I0OVx1NTNFQVx1OTcwMFx1NTg2Qlx1NTE5OVx1NkI2M1x1Nzg2RVx1NzY4NFx1NzY3Qlx1NUY1NSBVUkxcdUZGMDhcdTU5ODIgXHUyMDI2L2xvZ2luP3Nzbz1sYXJrJlx1MjAyNlx1RkYwOVx1RkYwQ1x1NUJDNlx1NzgwMVx1NTNFRlx1NzU1OVx1N0E3QVx1MzAwMlx1NUJDNlx1NzgwMVx1Njg0Nlx1NzU1OVx1N0E3QVx1ODg2OFx1NzkzQVx1NEUwRFx1NEZFRVx1NjUzOVx1NURGMlx1NEZERFx1NUI1OFx1NzY4NFx1NUJDNlx1NzgwMVx1RkYxQlx1NTJGRlx1NjI4QVx1NUJDNlx1NzgwMVx1NTNEMVx1NTIzMFx1NUJGOVx1OEJERFx1OTFDQ1x1MzAwMicsXHJcbiAgbG9hZGluZzogJ1x1NkI2M1x1NTcyOFx1OEZERVx1NjNBNVx1NjcyQ1x1NjczQVx1OTE0RFx1N0Y2RVx1NjcwRFx1NTJBMVx1MjAyNicsXHJcbiAgbG9hZEZhaWxlZDogJ1x1NTJBMFx1OEY3RFx1NTkzMVx1OEQyNScsXHJcbiAgdXJsOiAnXHU3NjdCXHU1RjU1XHU1NzMwXHU1NzQwJyxcclxuICB1c2VybmFtZTogJ1x1OEQyNlx1NTNGNycsXHJcbiAgcGFzc3dvcmQ6ICdcdTVCQzZcdTc4MDEnLFxyXG4gIHBhc3N3b3JkUGxhY2Vob2xkZXI6ICdcdTc1NTlcdTdBN0EgPSBcdTRGRERcdTYzMDFcdTUzOUZcdTVCQzZcdTc4MDEnLFxyXG4gIHNhdmU6ICdcdTRGRERcdTVCNTgnLFxyXG4gIHNhdmluZzogJ1x1NEZERFx1NUI1OFx1NEUyRFx1MjAyNicsXHJcbiAgc2F2ZWQ6ICdcdTVERjJcdTRGRERcdTVCNThcdTUyMzBcdTY3MkNcdTY3M0EnLFxyXG4gIHNhdmVGYWlsZWQ6ICdcdTRGRERcdTVCNThcdTU5MzFcdThEMjUnLFxyXG4gIGhhc1Bhc3N3b3JkOiAnXHU1REYyXHU4QkJFXHU1QkM2XHU3ODAxJyxcclxuICBub1Bhc3N3b3JkOiAnXHU2NzJBXHU4QkJFXHU1QkM2XHU3ODAxJyxcclxuICBvcGVuU3RhbmRhbG9uZTogJ1x1NTcyOFx1NkQ0Rlx1ODlDOFx1NTY2OFx1NEUyRFx1NjI1M1x1NUYwMFx1NjcyQ1x1NjczQVx1OTE0RFx1N0Y2RVx1OTg3NScsXHJcbiAgb2ZmbGluZVRpdGxlOiAnXHU2NzJDXHU2NzNBXHU4RDI2XHU1M0Y3XHU5MTREXHU3RjZFXHU2NzBEXHU1MkExXHU2NzJBXHU1QzMxXHU3RUVBJyxcclxuICBvZmZsaW5lSGludDpcclxuICAgICdcdThCRjdcdTc4NkVcdThCQTQgRFNIIFx1NURGMlx1NTJBMFx1OEY3RCB3ZWJjbGF3IFx1NjNEMlx1NEVGNlx1NEUxNCBIb3N0IFx1NTcyOFx1NjcyQ1x1NjczQVx1OEZEMFx1ODg0Q1x1MzAwMlx1NEU1Rlx1NTNFRlx1OEZEMFx1ODg0Q1x1NjcyQ1x1NjczQVx1NTQyRlx1NTJBOFx1ODExQVx1NjcyQ1x1RkYwOFx1NjVFMFx1OTcwMFx1NjI4QSB3ZWJjbGF3LWxpdGUgXHU1MkEwXHU1MTY1IFBBVEhcdUZGMDlcdUZGMUEnLFxyXG4gIG9mZmxpbmVDbWQ6XHJcbiAgICAnV2luZG93czogJUxPQ0FMQVBQREFUQSVcXFxcd2ViY2xhd1xcXFxiaW5cXFxcd2ViY2xhdy1hY2NvdW50cy5jbWRcXG4nICtcclxuICAgICdtYWNPUzogfi8ud2ViY2xhdy9iaW4vd2ViY2xhdy1hY2NvdW50c1xcbicgK1xyXG4gICAgJ1x1RkYwOFx1OTk5Nlx1NkIyMVx1NTQyRlx1NTJBOCBEU0ggLyBcdThDMDNcdTc1Mjggd2ViY2xhdyBcdTVERTVcdTUxNzdcdTU0MEVcdTRGMUFcdTgxRUFcdTUyQThcdTc1MUZcdTYyMTBcdUZGMDknLFxyXG59XHJcblxyXG5leHBvcnQgY29uc3QgZW4gPSB7XHJcbiAgc2VjdGlvbkxhYmVsOiAnU2l0ZSBhY2NvdW50cycsXHJcbiAgaW50cm86XHJcbiAgICAnTG9naW4gVVJMIGFuZCBvcHRpb25hbCBjcmVkZW50aWFscyBzdGF5IGluIHRoZSBsb2NhbCB3ZWJjbGF3IHZhdWx0IChEUEFQSSBvbiBXaW5kb3dzOyBvYmZ1c2NhdGVkIHN0b3JhZ2Ugb24gbWFjT1MvTGludXgpLiBGZWlzaHUgU1NPIG9ubHkgbmVlZHMgdGhlIGNvcnJlY3QgbG9naW4gVVJMIChlLmcuIFx1MjAyNi9sb2dpbj9zc289bGFyayZcdTIwMjYpOyBwYXNzd29yZCBtYXkgYmUgYmxhbmsuIExlYXZlIHBhc3N3b3JkIGJsYW5rIHRvIGtlZXAgdGhlIHN0b3JlZCBzZWNyZXQgXHUyMDE0IG5ldmVyIHBhc3RlIHBhc3N3b3JkcyBpbnRvIGNoYXQuJyxcclxuICBsb2FkaW5nOiAnQ29ubmVjdGluZyB0byBsb2NhbCBhY2NvdW50cyBzZXJ2aWNlXHUyMDI2JyxcclxuICBsb2FkRmFpbGVkOiAnRmFpbGVkIHRvIGxvYWQnLFxyXG4gIHVybDogJ0xvZ2luIFVSTCcsXHJcbiAgdXNlcm5hbWU6ICdVc2VybmFtZScsXHJcbiAgcGFzc3dvcmQ6ICdQYXNzd29yZCcsXHJcbiAgcGFzc3dvcmRQbGFjZWhvbGRlcjogJ0JsYW5rID0ga2VlcCBleGlzdGluZycsXHJcbiAgc2F2ZTogJ1NhdmUnLFxyXG4gIHNhdmluZzogJ1NhdmluZ1x1MjAyNicsXHJcbiAgc2F2ZWQ6ICdTYXZlZCBsb2NhbGx5JyxcclxuICBzYXZlRmFpbGVkOiAnU2F2ZSBmYWlsZWQnLFxyXG4gIGhhc1Bhc3N3b3JkOiAnUGFzc3dvcmQgc2V0JyxcclxuICBub1Bhc3N3b3JkOiAnTm8gcGFzc3dvcmQnLFxyXG4gIG9wZW5TdGFuZGFsb25lOiAnT3BlbiBzdGFuZGFsb25lIHBhZ2UgaW4gYnJvd3NlcicsXHJcbiAgb2ZmbGluZVRpdGxlOiAnTG9jYWwgYWNjb3VudHMgc2VydmljZSBpcyBvZmZsaW5lJyxcclxuICBvZmZsaW5lSGludDpcclxuICAgICdNYWtlIHN1cmUgdGhlIHdlYmNsYXcgcGx1Z2luIGlzIGxvYWRlZCBhbmQgdGhlIEhvc3QgcnVucyBvbiB0aGlzIG1hY2hpbmUuIE9yIG9wZW4gdGhlIGxhdW5jaGVyIChubyBQQVRIIG5lZWRlZCk6JyxcclxuICBvZmZsaW5lQ21kOlxyXG4gICAgJ1dpbmRvd3M6ICVMT0NBTEFQUERBVEElXFxcXHdlYmNsYXdcXFxcYmluXFxcXHdlYmNsYXctYWNjb3VudHMuY21kXFxuJyArXHJcbiAgICAnbWFjT1M6IH4vLndlYmNsYXcvYmluL3dlYmNsYXctYWNjb3VudHNcXG4nICtcclxuICAgICcoY3JlYXRlZCBhZnRlciBEU0ggYm9vdCAvIGZpcnN0IHdlYmNsYXcgdG9vbCBjYWxsKScsXHJcbn0gc2F0aXNmaWVzIFJlY29yZDxrZXlvZiB0eXBlb2YgemgsIHN0cmluZz5cclxuXHJcbmV4cG9ydCBjb25zdCBBQ0NPVU5UU19OUyA9ICd3ZWJjbGF3QWNjb3VudHMnXHJcbiIsICIvKiogRmlsZS10cmVlIGljb24gdGludCBmb3IgYC53ZWJjbGF3YCAobWF0Y2hlcyBlbmdpbmUgYGNvZGVgIGNvbG9yIHdpdGhvdXQgcGF0Y2hpbmcgRmlsZVR5cGVJY29uKS4gKi9cclxuZXhwb3J0IGNvbnN0IFdFQkNMQVdfSUNPTl9DU1MgPSBgXHJcbltkYXRhLWZpbGVzLWVudHJ5PSdmaWxlJ11bZGF0YS1maWxlcy1wYXRoJD0nLndlYmNsYXcnIGldIHN2ZyxcclxuW2RhdGEtZmlsZXMtZW50cnk9J2ZpbGUnXVtkYXRhLWZpbGVzLXBhdGgkPScuV0VCQ0xBVyddIHN2ZyB7XHJcbiAgY29sb3I6IHZhcigtLWRzdy1zdGF0aWMtZGVlcHNlZWstNTAwKSAhaW1wb3J0YW50O1xyXG4gIC0tZHNoLWZpbGUtdHlwZS1pY29uLWNvbG9yOiB2YXIoLS1kc3ctc3RhdGljLWRlZXBzZWVrLTUwMCk7XHJcbiAgLS1kc2gtZmlsZS10eXBlLWRlZmF1bHQtY29sb3I6IHZhcigtLWRzdy1zdGF0aWMtZGVlcHNlZWstNTAwKTtcclxufVxyXG5bZGF0YS13ZWJjbGF3LXByZXZpZXddIHtcclxuICBkaXNwbGF5OiBmbGV4O1xyXG4gIGZsZXg6IDE7XHJcbiAgbWluLWhlaWdodDogMDtcclxuICBmbGV4LWRpcmVjdGlvbjogY29sdW1uO1xyXG59XHJcbltkYXRhLXdlYmNsYXctcHJldmlld10gPiAqIHtcclxuICBmbGV4OiAxO1xyXG4gIG1pbi1oZWlnaHQ6IDA7XHJcbn1cclxuYFxyXG4iLCAiLyoqIExvY2FsZSBmb3IgdGhlIHdlYmNsYXctbGl2ZSBzaWRlYmFyIHRhYi4gKi9cclxuaW1wb3J0IHR5cGUge30gZnJvbSAnQGRlZXBzZWVrLWFpL2RzaC1jbGllbnQtdWktc2xvdHMnXHJcblxyXG5kZWNsYXJlIG1vZHVsZSAnQGRlZXBzZWVrLWFpL2RzaC1jbGllbnQtdWktc2xvdHMnIHtcclxuICBpbnRlcmZhY2UgTG9jYWxlTmFtZXNwYWNlTWFwIHtcclxuICAgIHdlYmNsYXdMaXZlOiBrZXlvZiB0eXBlb2YgemhcclxuICB9XHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCB6aCA9IHtcclxuICB0aXRsZTogJ1x1NjI2N1x1ODg0Q1x1NzUzQlx1OTc2MicsXHJcbiAgd2FpdGluZzogJ1x1N0I0OVx1NUY4NVx1NjI2N1x1ODg0Q1x1MjAyNicsXHJcbiAgb2ZmbGluZTogJ1x1OTg4NFx1ODlDOFx1NjcyQVx1NUMzMVx1N0VFQScsXHJcbiAgbm9JbWFnZTogJ1x1NjY4Mlx1NjVFMFx1NzUzQlx1OTc2MicsXHJcbiAgcGxhY2Vob2xkZXI6ICdcdTdCNDlcdTVGODVcdTc1M0JcdTk3NjJcdTIwMjYnLFxyXG4gIGxpdmU6ICdcdTVCOUVcdTY1RjYnLFxyXG4gIHNjcnViSGludDogJ1x1NjJENlx1NTJBOFx1NjdFNVx1NzcwQlx1OEZDN1x1N0EwQicsXHJcbiAgZ3VpZGVUaXRsZTogJ3dlYmNsYXcgXHU2MjY3XHU4ODRDXHU3NTNCXHU5NzYyJyxcclxuICBndWlkZURlc2M6ICdcdTY1RTBcdTU5MzRcdThGRDBcdTg4NENcdTY1RjZcdTU3MjhcdTZCNjRcdTU2REVcdTc3MEJcdTZCNjVcdTlBQTRcdTRFMEVcdTVCOUVcdTY1RjZcdTc1M0JcdTk3NjInLFxyXG59XHJcblxyXG5leHBvcnQgY29uc3QgZW4gPSB7XHJcbiAgdGl0bGU6ICdMaXZlIHJ1bicsXHJcbiAgd2FpdGluZzogJ1dhaXRpbmdcdTIwMjYnLFxyXG4gIG9mZmxpbmU6ICdQcmV2aWV3IG9mZmxpbmUnLFxyXG4gIG5vSW1hZ2U6ICdObyBmcmFtZSB5ZXQnLFxyXG4gIHBsYWNlaG9sZGVyOiAnV2FpdGluZyBmb3IgZnJhbWVcdTIwMjYnLFxyXG4gIGxpdmU6ICdMaXZlJyxcclxuICBzY3J1YkhpbnQ6ICdEcmFnIHRvIHJldmlldycsXHJcbiAgZ3VpZGVUaXRsZTogJ3dlYmNsYXcgbGl2ZScsXHJcbiAgZ3VpZGVEZXNjOiAnU2NydWIgc3RlcCBmcmFtZXMgb3Igc3RheSBvbiBsaXZlJyxcclxufSBzYXRpc2ZpZXMgUmVjb3JkPGtleW9mIHR5cGVvZiB6aCwgc3RyaW5nPlxyXG5cclxuZXhwb3J0IGNvbnN0IExJVkVfTlMgPSAnd2ViY2xhd0xpdmUnXHJcbiIsICIvKiogTG9jYWxlIGZvciB0aGUgYEBsb25rMTk4OS93ZWJjbGF3YCBgLndlYmNsYXdgIGRvY3VtZW50IHByZXZpZXcuICovXHJcbmltcG9ydCB0eXBlIHt9IGZyb20gJ0BkZWVwc2Vlay1haS9kc2gtY2xpZW50LXVpLXNsb3RzJ1xyXG5cclxuZGVjbGFyZSBtb2R1bGUgJ0BkZWVwc2Vlay1haS9kc2gtY2xpZW50LXVpLXNsb3RzJyB7XHJcbiAgaW50ZXJmYWNlIExvY2FsZU5hbWVzcGFjZU1hcCB7XHJcbiAgICAvKiogV2ViY2xhdyByZWNpcGUgcHJldmlldyBjaHJvbWUuICovXHJcbiAgICB3ZWJjbGF3UHJldmlldzoga2V5b2YgdHlwZW9mIHpoXHJcbiAgfVxyXG59XHJcblxyXG4vKiogU2ltcGxpZmllZCBDaGluZXNlIGRpY3Rpb25hcnkgYW5kIGtleSBzb3VyY2UuICovXHJcbmV4cG9ydCBjb25zdCB6aCA9IHtcclxuICB0aXRsZTogJ1x1ODNEQ1x1OEMzMScsXHJcbiAgY29weTogJ1x1NTkwRFx1NTIzNicsXHJcbiAgY29waWVkOiAnXHU1REYyXHU1OTBEXHU1MjM2JyxcclxuICBjb2RlQmxvY2tUaXRsZTogJ1x1ODNEQ1x1OEMzMScsXHJcbiAgd3JhcDogJ1x1NjM2Mlx1ODg0QycsXHJcbiAgdW53cmFwOiAnXHU0RTBEXHU2MzYyXHU4ODRDJyxcclxuICBwYXJhbXNUaXRsZTogJ1x1NTNFRlx1NjUzOVx1NTNDMlx1NjU3MFx1RkYwOFx1NTkxQVx1NEUzQVx1NTM2MFx1NEY0RFx1RkYwQ1x1OEJGN1x1N0YxNlx1OEY5MVx1RkYwOScsXHJcbiAgcGFyYW1zSGludDogJ1x1NjcwOSBcdTUzQzJcdTY1NzBcdTIwMjY9IFx1NjVGNlx1NTE0OFx1NUM1NVx1NzkzQVx1NEUwMFx1NUYyMFx1NTNFRlx1N0YxNlx1OEY5MVx1ODg2OFx1OEJGN1x1NzUyOFx1NjIzN1x1NjUzOVx1NUI4Q1x1NTE4RFx1OEREMVx1RkYxQlx1NTJGRlx1OTAxMFx1OTg3OVx1OEZGRFx1OTVFRVx1MzAwMlx1NEVDNVx1NzUyOFx1NjIzN1x1NjYwRVx1Nzg2RVx1OEJGNFx1MzAwQ1x1NzUyOFx1OUVEOFx1OEJBNFx1MzAwRFx1NjI0RFx1NTNFRlx1NEUwRFx1NjUzOVx1MzAwMlx1NjcyQ1x1OEY2RVx1NURGMlx1N0VEOVx1OUY1MFx1NUI1N1x1NkJCNVx1NTIxOVx1NTNFRlx1NzZGNFx1NjNBNVx1OEREMVx1MzAwMicsXHJcbn1cclxuXHJcbi8qKiBFbmdsaXNoIGRpY3Rpb25hcnkgd2l0aCB0aGUgc2FtZSBrZXlzLiAqL1xyXG5leHBvcnQgY29uc3QgZW4gPSB7XHJcbiAgdGl0bGU6ICdSZWNpcGUnLFxyXG4gIGNvcHk6ICdDb3B5JyxcclxuICBjb3BpZWQ6ICdDb3BpZWQnLFxyXG4gIGNvZGVCbG9ja1RpdGxlOiAnUmVjaXBlJyxcclxuICB3cmFwOiAnV3JhcCcsXHJcbiAgdW53cmFwOiAnVW53cmFwJyxcclxuICBwYXJhbXNUaXRsZTogJ0VkaXRhYmxlIHBhcmFtcyAodXN1YWxseSBwbGFjZWhvbGRlcnMpJyxcclxuICBwYXJhbXNIaW50OiAnT24gcnVuLCBzaG93IG9uZSBlZGl0YWJsZSB0YWJsZSBmb3IgdGhlIHVzZXIgdG8gY2hhbmdlIHZhbHVlcy4gRG8gbm90IGludGVydmlldyBmaWVsZC1ieS1maWVsZDtcdTMwMEN1c2UgZGVmYXVsdHNcdTMwMERvbmx5IGlmIGFza2VkLicsXHJcbn0gc2F0aXNmaWVzIFJlY29yZDxrZXlvZiB0eXBlb2YgemgsIHN0cmluZz5cclxuXHJcbmV4cG9ydCBjb25zdCBOUyA9ICd3ZWJjbGF3UHJldmlldydcclxuIiwgIi8qKiBMb2NhbGUgZm9yIHRoZSB3ZWJjbGF3X3J1biBpbi1jaGF0IHRvb2x2aWV3LiAqL1xyXG5pbXBvcnQgdHlwZSB7fSBmcm9tICdAZGVlcHNlZWstYWkvZHNoLWNsaWVudC11aS1zbG90cydcclxuXHJcbmRlY2xhcmUgbW9kdWxlICdAZGVlcHNlZWstYWkvZHNoLWNsaWVudC11aS1zbG90cycge1xyXG4gIGludGVyZmFjZSBMb2NhbGVOYW1lc3BhY2VNYXAge1xyXG4gICAgd2ViY2xhd1J1blRvb2w6IGtleW9mIHR5cGVvZiB6aFxyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGNvbnN0IHpoID0ge1xyXG4gIHBlbmRpbmc6ICdcdTZCNjNcdTU3MjhcdTYyNjdcdTg4NENcdTgzRENcdThDMzFcdTIwMjYnLFxyXG4gIG9mZmxpbmU6ICdcdTY3MkNcdTY3M0FcdTY1RTVcdTVGRDdcdTY3MERcdTUyQTFcdTY3MkFcdTVDMzFcdTdFRUEnLFxyXG4gIGVtcHR5OiAnXHU3QjQ5XHU1Rjg1XHU2QjY1XHU5QUE0XHU2NUU1XHU1RkQ3XHUyMDI2JyxcclxuICBwbGFjZWhvbGRlcjogJ1x1N0I0OVx1NUY4NVx1NzUzQlx1OTc2Mlx1MjAyNicsXHJcbiAgZG9uZTogJ1x1NjI2N1x1ODg0Q1x1N0VEM1x1Njc1RicsXHJcbiAgZmFpbGVkOiAnXHU2MjY3XHU4ODRDXHU1OTMxXHU4RDI1JyxcclxuICBjYW5jZWxsZWQ6ICdcdTVERjJcdTUzRDZcdTZEODgnLFxyXG4gIG5lZWRIdW1hbjogJ1x1OTcwMFx1ODk4MVx1NEVCQVx1NURFNVx1Nzg2RVx1OEJBNCcsXHJcbn1cclxuXHJcbmV4cG9ydCBjb25zdCBlbiA9IHtcclxuICBwZW5kaW5nOiAnUnVubmluZyByZWNpcGVcdTIwMjYnLFxyXG4gIG9mZmxpbmU6ICdMb2NhbCBsb2cgc2VydmljZSBvZmZsaW5lJyxcclxuICBlbXB0eTogJ1dhaXRpbmcgZm9yIHN0ZXAgbG9nc1x1MjAyNicsXHJcbiAgcGxhY2Vob2xkZXI6ICdXYWl0aW5nIGZvciBmcmFtZVx1MjAyNicsXHJcbiAgZG9uZTogJ0ZpbmlzaGVkJyxcclxuICBmYWlsZWQ6ICdGYWlsZWQnLFxyXG4gIGNhbmNlbGxlZDogJ0NhbmNlbGxlZCcsXHJcbiAgbmVlZEh1bWFuOiAnTmVlZHMgaHVtYW4gaW5wdXQnLFxyXG59IHNhdGlzZmllcyBSZWNvcmQ8a2V5b2YgdHlwZW9mIHpoLCBzdHJpbmc+XHJcblxyXG5leHBvcnQgY29uc3QgUlVOX1RPT0xfTlMgPSAnd2ViY2xhd1J1blRvb2wnXHJcbiIsICIvKipcclxuICogUmlnaHQtc2lkZWJhciBib2R5OiBzY3J1YmJhYmxlIGxpdmUtcHJldmlldyB0aW1lbGluZSAoRG91YmFvLXN0eWxlKS5cclxuICovXHJcbmltcG9ydCB7XHJcbiAgdXNlQ2FsbGJhY2ssXHJcbiAgdXNlRWZmZWN0LFxyXG4gIHVzZVJlZixcclxuICB1c2VTdGF0ZSxcclxuICB0eXBlIENTU1Byb3BlcnRpZXMsXHJcbiAgdHlwZSBQb2ludGVyRXZlbnQgYXMgUmVhY3RQb2ludGVyRXZlbnQsXHJcbiAgdHlwZSBSZWFjdE5vZGUsXHJcbn0gZnJvbSAncmVhY3QnXHJcbmltcG9ydCB0eXBlIHsgUHJvcHNMb2NhbGUgfSBmcm9tICdAZGVlcHNlZWstYWkvZHNoLWNsaWVudC11aS1zbG90cydcclxuaW1wb3J0IHsgTGl2ZVByZXZpZXdJbWFnZSB9IGZyb20gJy4vTGl2ZVByZXZpZXdJbWFnZS5qcydcclxuXHJcbi8qKiBNaW5pbWFsIHRhYiBpbmZvIHVzZWQgYnkgdGhlIGxpdmUgYm9keSAoZnJhbWV3b3JrIGluamVjdHMgdGhlIHJlc3QpLiAqL1xyXG5leHBvcnQgdHlwZSBXZWJjbGF3TGl2ZVByb3BzID0gUHJvcHNMb2NhbGU8J3dlYmNsYXdMaXZlJz4gJiB7XHJcbiAgdXNlVGFiSW5mbzogKCkgPT4ge1xyXG4gICAgdGFiOiB7XHJcbiAgICAgIG5hdmlnYXRpb24/OiB7XHJcbiAgICAgICAgcGFyYW1zPzogdW5rbm93blxyXG4gICAgICAgIHJldmlzaW9uPzogbnVtYmVyXHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9XHJcbn1cclxuXHJcbmludGVyZmFjZSBMaXZlRnJhbWUge1xyXG4gIGlkOiBudW1iZXJcclxuICBmaWxlOiBzdHJpbmdcclxuICBzdGVwPzogbnVtYmVyXHJcbiAga2V5d29yZD86IHN0cmluZ1xyXG4gIGF0Pzogc3RyaW5nXHJcbn1cclxuXHJcbmNvbnN0IENBTkRJREFURV9QT1JUUyA9IFsxOTIyOSwgMTkyMzAsIDE5MjMxLCAxOTIzMiwgMTkyMzNdXHJcblxyXG5hc3luYyBmdW5jdGlvbiBmaW5kQmFzZSgpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcclxuICBmb3IgKGNvbnN0IHBvcnQgb2YgQ0FORElEQVRFX1BPUlRTKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBjdHJsID0gbmV3IEFib3J0Q29udHJvbGxlcigpXHJcbiAgICAgIGNvbnN0IHRpbWVyID0gc2V0VGltZW91dCgoKSA9PiBjdHJsLmFib3J0KCksIDUwMClcclxuICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYGh0dHA6Ly8xMjcuMC4wLjE6JHtwb3J0fS9hcGkvaGVhbHRoYCwge1xyXG4gICAgICAgIHNpZ25hbDogY3RybC5zaWduYWwsXHJcbiAgICAgIH0pXHJcbiAgICAgIGNsZWFyVGltZW91dCh0aW1lcilcclxuICAgICAgaWYgKCFyZXMub2spIGNvbnRpbnVlXHJcbiAgICAgIGNvbnN0IGogPSAoYXdhaXQgcmVzLmpzb24oKSkgYXMgeyBvaz86IGJvb2xlYW47IHNlcnZpY2U/OiBzdHJpbmcgfVxyXG4gICAgICBpZiAoai5vayAmJiBqLnNlcnZpY2UgPT09ICd3ZWJjbGF3LWFjY291bnRzLXVpJykge1xyXG4gICAgICAgIHJldHVybiBgaHR0cDovLzEyNy4wLjAuMToke3BvcnR9YFxyXG4gICAgICB9XHJcbiAgICB9IGNhdGNoIHtcclxuICAgICAgLyogbmV4dCAqL1xyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4gbnVsbFxyXG59XHJcblxyXG5mdW5jdGlvbiBydW5EaXJGcm9tTmF2KHBhcmFtczogdW5rbm93bik6IHN0cmluZyB7XHJcbiAgaWYgKCFwYXJhbXMgfHwgdHlwZW9mIHBhcmFtcyAhPT0gJ29iamVjdCcpIHJldHVybiAnJ1xyXG4gIGNvbnN0IHAgPSBwYXJhbXMgYXMgeyBydW5EaXI/OiB1bmtub3duIH1cclxuICByZXR1cm4gdHlwZW9mIHAucnVuRGlyID09PSAnc3RyaW5nJyA/IHAucnVuRGlyLnRyaW0oKSA6ICcnXHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZyYW1lTGFiZWwoZnJhbWU6IExpdmVGcmFtZSB8IHVuZGVmaW5lZCwgZmFsbGJhY2s6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgY29uc3Qga3cgPSBmcmFtZT8ua2V5d29yZD8udHJpbSgpXHJcbiAgaWYgKGt3KSByZXR1cm4ga3dcclxuICBpZiAodHlwZW9mIGZyYW1lPy5zdGVwID09PSAnbnVtYmVyJyAmJiBmcmFtZS5zdGVwID4gMCkgcmV0dXJuIGAjJHtmcmFtZS5zdGVwfWBcclxuICByZXR1cm4gZmFsbGJhY2tcclxufVxyXG5cclxuZnVuY3Rpb24gcG5nVXJsKGJhc2U6IHN0cmluZywgcnVuRGlyOiBzdHJpbmcsIGZyYW1lSWQ6IG51bWJlciB8IG51bGwsIGJ1c3Q6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgY29uc3QgcSA9IG5ldyBVUkxTZWFyY2hQYXJhbXMoeyBydW5EaXIgfSlcclxuICBpZiAoZnJhbWVJZCAhPSBudWxsKSBxLnNldCgnZnJhbWUnLCBTdHJpbmcoZnJhbWVJZCkpXHJcbiAgcS5zZXQoJ3QnLCBidXN0KVxyXG4gIHJldHVybiBgJHtiYXNlfS9hcGkvbGl2ZS9wbmc/JHtxLnRvU3RyaW5nKCl9YFxyXG59XHJcblxyXG4vKipcclxuICogTGl2ZSBleGVjdXRpb24gcHJldmlldyB3aXRoIHNjcnViYmVyICsgTGl2ZSBtb2RlLlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIFdlYmNsYXdMaXZlKHsgdCwgdXNlVGFiSW5mbyB9OiBXZWJjbGF3TGl2ZVByb3BzKTogUmVhY3ROb2RlIHtcclxuICBjb25zdCB7IHRhYiB9ID0gdXNlVGFiSW5mbygpXHJcbiAgY29uc3QgbmF2UnVuRGlyID0gcnVuRGlyRnJvbU5hdih0YWIubmF2aWdhdGlvbj8ucGFyYW1zKVxyXG4gIGNvbnN0IFtiYXNlLCBzZXRCYXNlXSA9IHVzZVN0YXRlPHN0cmluZyB8IG51bGw+KG51bGwpXHJcbiAgY29uc3QgW3J1bkRpciwgc2V0UnVuRGlyXSA9IHVzZVN0YXRlKG5hdlJ1bkRpcilcclxuICBjb25zdCBbZnJhbWVzLCBzZXRGcmFtZXNdID0gdXNlU3RhdGU8TGl2ZUZyYW1lW10+KFtdKVxyXG4gIGNvbnN0IFtpbmRleCwgc2V0SW5kZXhdID0gdXNlU3RhdGUoMClcclxuICBjb25zdCBbbGl2ZSwgc2V0TGl2ZV0gPSB1c2VTdGF0ZSh0cnVlKVxyXG4gIGNvbnN0IFtpbWdVcmwsIHNldEltZ1VybF0gPSB1c2VTdGF0ZSgnJylcclxuICBjb25zdCBbZXJyb3IsIHNldEVycm9yXSA9IHVzZVN0YXRlKCcnKVxyXG4gIGNvbnN0IFtkcmFnZ2luZywgc2V0RHJhZ2dpbmddID0gdXNlU3RhdGUoZmFsc2UpXHJcblxyXG4gIGNvbnN0IGxpdmVSZWYgPSB1c2VSZWYodHJ1ZSlcclxuICBjb25zdCBkcmFnZ2luZ1JlZiA9IHVzZVJlZihmYWxzZSlcclxuICBjb25zdCBpbmRleFJlZiA9IHVzZVJlZigwKVxyXG4gIGNvbnN0IHRyYWNrUmVmID0gdXNlUmVmPEhUTUxEaXZFbGVtZW50IHwgbnVsbD4obnVsbClcclxuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGxpdmVSZWYuY3VycmVudCA9IGxpdmVcclxuICB9LCBbbGl2ZV0pXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGRyYWdnaW5nUmVmLmN1cnJlbnQgPSBkcmFnZ2luZ1xyXG4gIH0sIFtkcmFnZ2luZ10pXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGluZGV4UmVmLmN1cnJlbnQgPSBpbmRleFxyXG4gIH0sIFtpbmRleF0pXHJcblxyXG4gIGNvbnN0IGhhcmRSZXNldFByZXZpZXcgPSB1c2VDYWxsYmFjaygobmV4dFJ1bkRpcjogc3RyaW5nKSA9PiB7XHJcbiAgICBzZXRSdW5EaXIobmV4dFJ1bkRpcilcclxuICAgIHNldEZyYW1lcyhbXSlcclxuICAgIHNldEltZ1VybCgnJylcclxuICAgIHNldEluZGV4KDApXHJcbiAgICBpbmRleFJlZi5jdXJyZW50ID0gMFxyXG4gICAgc2V0RXJyb3IoJycpXHJcbiAgICBzZXRMaXZlKHRydWUpXHJcbiAgICBsaXZlUmVmLmN1cnJlbnQgPSB0cnVlXHJcbiAgICBzZXREcmFnZ2luZyhmYWxzZSlcclxuICAgIGRyYWdnaW5nUmVmLmN1cnJlbnQgPSBmYWxzZVxyXG4gIH0sIFtdKVxyXG5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKCFuYXZSdW5EaXIpIHJldHVyblxyXG4gICAgaWYgKG5hdlJ1bkRpciA9PT0gcnVuRGlyKSByZXR1cm5cclxuICAgIGhhcmRSZXNldFByZXZpZXcobmF2UnVuRGlyKVxyXG4gIH0sIFtuYXZSdW5EaXIsIHRhYi5uYXZpZ2F0aW9uPy5yZXZpc2lvbiwgcnVuRGlyLCBoYXJkUmVzZXRQcmV2aWV3XSlcclxuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGxldCBjYW5jZWxsZWQgPSBmYWxzZVxyXG4gICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xyXG4gICAgICBjb25zdCBmb3VuZCA9IGF3YWl0IGZpbmRCYXNlKClcclxuICAgICAgaWYgKCFjYW5jZWxsZWQpIHNldEJhc2UoZm91bmQpXHJcbiAgICB9KSgpXHJcbiAgICByZXR1cm4gKCkgPT4ge1xyXG4gICAgICBjYW5jZWxsZWQgPSB0cnVlXHJcbiAgICB9XHJcbiAgfSwgW10pXHJcblxyXG4gIGNvbnN0IGdvTGl2ZSA9IHVzZUNhbGxiYWNrKCgpID0+IHtcclxuICAgIHNldExpdmUodHJ1ZSlcclxuICAgIGxpdmVSZWYuY3VycmVudCA9IHRydWVcclxuICAgIHNldEZyYW1lcyhwcmV2ID0+IHtcclxuICAgICAgaWYgKHByZXYubGVuZ3RoKSBzZXRJbmRleChwcmV2Lmxlbmd0aCAtIDEpXHJcbiAgICAgIHJldHVybiBwcmV2XHJcbiAgICB9KVxyXG4gIH0sIFtdKVxyXG5cclxuICBjb25zdCBhcHBseVNjcnViSW5kZXggPSB1c2VDYWxsYmFjayhcclxuICAgIChuZXh0OiBudW1iZXIsIGxpc3Q6IExpdmVGcmFtZVtdLCBhY3RpdmVSdW5EaXI/OiBzdHJpbmcsIGFjdGl2ZUJhc2U/OiBzdHJpbmcpID0+IHtcclxuICAgICAgaWYgKCFsaXN0Lmxlbmd0aCkgcmV0dXJuXHJcbiAgICAgIGNvbnN0IGNsYW1wZWQgPSBNYXRoLm1heCgwLCBNYXRoLm1pbihsaXN0Lmxlbmd0aCAtIDEsIG5leHQpKVxyXG4gICAgICBpbmRleFJlZi5jdXJyZW50ID0gY2xhbXBlZFxyXG4gICAgICBzZXRJbmRleChjbGFtcGVkKVxyXG4gICAgICBjb25zdCBhdEVuZCA9IGNsYW1wZWQgPj0gbGlzdC5sZW5ndGggLSAxXHJcbiAgICAgIHNldExpdmUoYXRFbmQpXHJcbiAgICAgIGxpdmVSZWYuY3VycmVudCA9IGF0RW5kXHJcbiAgICAgIGNvbnN0IGIgPSBhY3RpdmVCYXNlIHx8IGJhc2VcclxuICAgICAgY29uc3QgcmQgPSBhY3RpdmVSdW5EaXIgfHwgcnVuRGlyXHJcbiAgICAgIGNvbnN0IGZyYW1lID0gbGlzdFtjbGFtcGVkXVxyXG4gICAgICBpZiAoYiAmJiByZCAmJiBmcmFtZSkge1xyXG4gICAgICAgIHNldEltZ1VybChwbmdVcmwoYiwgcmQsIGZyYW1lLmlkLCBTdHJpbmcoZnJhbWUuYXQgfHwgZnJhbWUuaWQpKSlcclxuICAgICAgfVxyXG4gICAgfSxcclxuICAgIFtiYXNlLCBydW5EaXJdLFxyXG4gIClcclxuXHJcbiAgY29uc3QgaW5kZXhGcm9tQ2xpZW50WCA9IHVzZUNhbGxiYWNrKChjbGllbnRYOiBudW1iZXIsIGxpc3RMZW46IG51bWJlcikgPT4ge1xyXG4gICAgY29uc3QgZWwgPSB0cmFja1JlZi5jdXJyZW50XHJcbiAgICBpZiAoIWVsIHx8IGxpc3RMZW4gPD0gMSkgcmV0dXJuIDBcclxuICAgIGNvbnN0IHJlY3QgPSBlbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKVxyXG4gICAgY29uc3QgcmF0aW8gPSBNYXRoLm1heCgwLCBNYXRoLm1pbigxLCAoY2xpZW50WCAtIHJlY3QubGVmdCkgLyByZWN0LndpZHRoKSlcclxuICAgIHJldHVybiBNYXRoLnJvdW5kKHJhdGlvICogKGxpc3RMZW4gLSAxKSlcclxuICB9LCBbXSlcclxuXHJcbiAgY29uc3Qgb25UcmFja1BvaW50ZXJEb3duID0gdXNlQ2FsbGJhY2soXHJcbiAgICAoZTogUmVhY3RQb2ludGVyRXZlbnQ8SFRNTERpdkVsZW1lbnQ+KSA9PiB7XHJcbiAgICAgIGlmICghZnJhbWVzLmxlbmd0aCkgcmV0dXJuXHJcbiAgICAgIGUuY3VycmVudFRhcmdldC5zZXRQb2ludGVyQ2FwdHVyZShlLnBvaW50ZXJJZClcclxuICAgICAgc2V0RHJhZ2dpbmcodHJ1ZSlcclxuICAgICAgZHJhZ2dpbmdSZWYuY3VycmVudCA9IHRydWVcclxuICAgICAgYXBwbHlTY3J1YkluZGV4KGluZGV4RnJvbUNsaWVudFgoZS5jbGllbnRYLCBmcmFtZXMubGVuZ3RoKSwgZnJhbWVzKVxyXG4gICAgfSxcclxuICAgIFthcHBseVNjcnViSW5kZXgsIGZyYW1lcywgaW5kZXhGcm9tQ2xpZW50WF0sXHJcbiAgKVxyXG5cclxuICBjb25zdCBvblRyYWNrUG9pbnRlck1vdmUgPSB1c2VDYWxsYmFjayhcclxuICAgIChlOiBSZWFjdFBvaW50ZXJFdmVudDxIVE1MRGl2RWxlbWVudD4pID0+IHtcclxuICAgICAgaWYgKCFkcmFnZ2luZ1JlZi5jdXJyZW50IHx8ICFmcmFtZXMubGVuZ3RoKSByZXR1cm5cclxuICAgICAgYXBwbHlTY3J1YkluZGV4KGluZGV4RnJvbUNsaWVudFgoZS5jbGllbnRYLCBmcmFtZXMubGVuZ3RoKSwgZnJhbWVzKVxyXG4gICAgfSxcclxuICAgIFthcHBseVNjcnViSW5kZXgsIGZyYW1lcywgaW5kZXhGcm9tQ2xpZW50WF0sXHJcbiAgKVxyXG5cclxuICBjb25zdCBvblRyYWNrUG9pbnRlclVwID0gdXNlQ2FsbGJhY2soKGU6IFJlYWN0UG9pbnRlckV2ZW50PEhUTUxEaXZFbGVtZW50PikgPT4ge1xyXG4gICAgdHJ5IHtcclxuICAgICAgZS5jdXJyZW50VGFyZ2V0LnJlbGVhc2VQb2ludGVyQ2FwdHVyZShlLnBvaW50ZXJJZClcclxuICAgIH0gY2F0Y2gge1xyXG4gICAgICAvKiBpZ25vcmUgKi9cclxuICAgIH1cclxuICAgIHNldERyYWdnaW5nKGZhbHNlKVxyXG4gICAgZHJhZ2dpbmdSZWYuY3VycmVudCA9IGZhbHNlXHJcbiAgfSwgW10pXHJcblxyXG4gIHVzZUVmZmVjdCgoKSA9PiB7XHJcbiAgICBpZiAoIWJhc2UpIHJldHVyblxyXG4gICAgbGV0IGNhbmNlbGxlZCA9IGZhbHNlXHJcbiAgICBjb25zdCB0aWNrID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgICB0cnkge1xyXG4gICAgICAgIGNvbnN0IGZvY3VzUmVzID0gYXdhaXQgZmV0Y2goYCR7YmFzZX0vYXBpL2xpdmUvZm9jdXNgLCB7XHJcbiAgICAgICAgICBjYWNoZTogJ25vLXN0b3JlJyxcclxuICAgICAgICB9KVxyXG4gICAgICAgIGNvbnN0IGZvY3VzSnNvbiA9IChhd2FpdCBmb2N1c1Jlcy5qc29uKCkpIGFzIHtcclxuICAgICAgICAgIG9rPzogYm9vbGVhblxyXG4gICAgICAgICAgZm9jdXM/OiB7IHJ1bkRpcj86IHN0cmluZzsgc2VxPzogbnVtYmVyIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgZm9jdXNlZCA9IGZvY3VzSnNvbi5mb2N1cz8ucnVuRGlyPy50cmltKCkgfHwgJydcclxuICAgICAgICAvLyBGb2N1cyBpcyBzb3VyY2Ugb2YgdHJ1dGggd2hpbGUgYSBydW4gaXMgYWN0aXZlIFx1MjAxNCBkb24ndCBzdGljayBvbiBhIHN0YWxlIHRhYiBwYXJhbS5cclxuICAgICAgICBjb25zdCBhY3RpdmUgPSAoZm9jdXNlZCB8fCBydW5EaXIpLnRyaW0oKVxyXG4gICAgICAgIGlmICghYWN0aXZlKSB7XHJcbiAgICAgICAgICBpZiAoIWNhbmNlbGxlZCkge1xyXG4gICAgICAgICAgICBzZXRFcnJvcignJylcclxuICAgICAgICAgICAgc2V0RnJhbWVzKFtdKVxyXG4gICAgICAgICAgICBzZXRJbWdVcmwoJycpXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICByZXR1cm5cclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gRm9yY2UtY2xlYXIgb2xkIGNhcHRjaGEvdGltZWxpbmUgdGhlIG1vbWVudCBmb2N1cyBzd2l0Y2hlcyBcdTIwMTQgZG9uJ3Qgd2FpdCBmb3IgbWV0YS5cclxuICAgICAgICBpZiAoZm9jdXNlZCAmJiBmb2N1c2VkICE9PSBydW5EaXIpIHtcclxuICAgICAgICAgIGlmICghY2FuY2VsbGVkKSBoYXJkUmVzZXRQcmV2aWV3KGZvY3VzZWQpXHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBtZXRhUmVzID0gYXdhaXQgZmV0Y2goXHJcbiAgICAgICAgICBgJHtiYXNlfS9hcGkvbGl2ZS9tZXRhP3J1bkRpcj0ke2VuY29kZVVSSUNvbXBvbmVudChhY3RpdmUpfSZ0PSR7RGF0ZS5ub3coKX1gLFxyXG4gICAgICAgICAgeyBjYWNoZTogJ25vLXN0b3JlJyB9LFxyXG4gICAgICAgIClcclxuICAgICAgICBjb25zdCBtZXRhSnNvbiA9IChhd2FpdCBtZXRhUmVzLmpzb24oKSkgYXMge1xyXG4gICAgICAgICAgb2s/OiBib29sZWFuXHJcbiAgICAgICAgICBtZXRhPzogeyBrZXl3b3JkPzogc3RyaW5nOyB1cGRhdGVkQXQ/OiBzdHJpbmc7IGZyYW1lSWQ/OiBudW1iZXIgfSB8IG51bGxcclxuICAgICAgICAgIGZyYW1lcz86IExpdmVGcmFtZVtdXHJcbiAgICAgICAgICBsYXRlc3RJZD86IG51bWJlciB8IG51bGxcclxuICAgICAgICAgIGhhc1BuZz86IGJvb2xlYW5cclxuICAgICAgICAgIGVycm9yPzogc3RyaW5nXHJcbiAgICAgICAgfVxyXG4gICAgICAgIGlmIChjYW5jZWxsZWQpIHJldHVyblxyXG4gICAgICAgIGlmICghbWV0YUpzb24ub2spIHtcclxuICAgICAgICAgIHNldEVycm9yKG1ldGFKc29uLmVycm9yIHx8IHQoJ3dhaXRpbmcnKSlcclxuICAgICAgICAgIHJldHVyblxyXG4gICAgICAgIH1cclxuICAgICAgICBzZXRFcnJvcignJylcclxuXHJcbiAgICAgICAgY29uc3QgbmV4dEZyYW1lcyA9IEFycmF5LmlzQXJyYXkobWV0YUpzb24uZnJhbWVzKSA/IG1ldGFKc29uLmZyYW1lcyA6IFtdXHJcbiAgICAgICAgc2V0RnJhbWVzKG5leHRGcmFtZXMpXHJcblxyXG4gICAgICAgIGNvbnN0IGZvbGxvd0xpdmUgPSBsaXZlUmVmLmN1cnJlbnQgJiYgIWRyYWdnaW5nUmVmLmN1cnJlbnRcclxuICAgICAgICBsZXQgdmlld0luZGV4ID0gMFxyXG4gICAgICAgIGlmIChuZXh0RnJhbWVzLmxlbmd0aCkge1xyXG4gICAgICAgICAgaWYgKGZvbGxvd0xpdmUpIHtcclxuICAgICAgICAgICAgdmlld0luZGV4ID0gbmV4dEZyYW1lcy5sZW5ndGggLSAxXHJcbiAgICAgICAgICAgIGluZGV4UmVmLmN1cnJlbnQgPSB2aWV3SW5kZXhcclxuICAgICAgICAgICAgc2V0SW5kZXgodmlld0luZGV4KVxyXG4gICAgICAgICAgICBzZXRMaXZlKHRydWUpXHJcbiAgICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgICB2aWV3SW5kZXggPSBNYXRoLm1heChcclxuICAgICAgICAgICAgICAwLFxyXG4gICAgICAgICAgICAgIE1hdGgubWluKGluZGV4UmVmLmN1cnJlbnQsIG5leHRGcmFtZXMubGVuZ3RoIC0gMSksXHJcbiAgICAgICAgICAgIClcclxuICAgICAgICAgICAgaW5kZXhSZWYuY3VycmVudCA9IHZpZXdJbmRleFxyXG4gICAgICAgICAgICBzZXRJbmRleCh2aWV3SW5kZXgpXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBpZiAoIW1ldGFKc29uLmhhc1BuZyAmJiAhbmV4dEZyYW1lcy5sZW5ndGgpIHtcclxuICAgICAgICAgIHNldEltZ1VybCgnJylcclxuICAgICAgICAgIHJldHVyblxyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3QgZnJhbWUgPSBuZXh0RnJhbWVzW3ZpZXdJbmRleF1cclxuICAgICAgICAvLyBMaXZlIG1vZGU6IHBpbiB0byBsYXRlc3QgZnJhbWUgaWQgc28gZWFjaCBoZWFydGJlYXQgZ2V0cyBhIGRpc3RpbmN0IFVSTFxyXG4gICAgICAgIC8vIChsaXZlLXByZXZpZXcucG5nIGFsb25lIGNhbiBsb29rIFwic3R1Y2tcIiB1bmRlciBhZ2dyZXNzaXZlIGltYWdlIGNhY2hpbmcpLlxyXG4gICAgICAgIGNvbnN0IGZyYW1lSWQgPSBmcmFtZT8uaWQgPz8gbnVsbFxyXG4gICAgICAgIGNvbnN0IGJ1c3QgPSBTdHJpbmcoXHJcbiAgICAgICAgICBmb2xsb3dMaXZlXHJcbiAgICAgICAgICAgID8gbWV0YUpzb24ubWV0YT8udXBkYXRlZEF0IHx8XHJcbiAgICAgICAgICAgICAgICBtZXRhSnNvbi5sYXRlc3RJZCB8fFxyXG4gICAgICAgICAgICAgICAgZnJhbWU/LmF0IHx8XHJcbiAgICAgICAgICAgICAgICBEYXRlLm5vdygpXHJcbiAgICAgICAgICAgIDogZnJhbWU/LmF0IHx8IGZyYW1lPy5pZCB8fCBEYXRlLm5vdygpLFxyXG4gICAgICAgIClcclxuICAgICAgICBzZXRJbWdVcmwocG5nVXJsKGJhc2UsIGFjdGl2ZSwgZnJhbWVJZCwgYnVzdCkpXHJcbiAgICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgICBpZiAoIWNhbmNlbGxlZCkge1xyXG4gICAgICAgICAgc2V0RXJyb3IoZSBpbnN0YW5jZW9mIEVycm9yID8gZS5tZXNzYWdlIDogdCgnb2ZmbGluZScpKVxyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfVxyXG4gICAgdm9pZCB0aWNrKClcclxuICAgIGNvbnN0IGlkID0gd2luZG93LnNldEludGVydmFsKCgpID0+IHtcclxuICAgICAgdm9pZCB0aWNrKClcclxuICAgIH0sIDUwMClcclxuICAgIHJldHVybiAoKSA9PiB7XHJcbiAgICAgIGNhbmNlbGxlZCA9IHRydWVcclxuICAgICAgd2luZG93LmNsZWFySW50ZXJ2YWwoaWQpXHJcbiAgICB9XHJcbiAgfSwgW2Jhc2UsIHJ1bkRpciwgdCwgaGFyZFJlc2V0UHJldmlld10pXHJcblxyXG4gIGlmICghYmFzZSkge1xyXG4gICAgcmV0dXJuIChcclxuICAgICAgPGRpdiBzdHlsZT17eyBwYWRkaW5nOiAxNiwgZm9udFNpemU6IDEzLCBvcGFjaXR5OiAwLjggfX0+e3QoJ29mZmxpbmUnKX08L2Rpdj5cclxuICAgIClcclxuICB9XHJcblxyXG4gIGlmICghcnVuRGlyICYmICFmcmFtZXMubGVuZ3RoICYmICFpbWdVcmwpIHtcclxuICAgIHJldHVybiAoXHJcbiAgICAgIDxkaXYgc3R5bGU9e3sgcGFkZGluZzogMTYsIGZvbnRTaXplOiAxMywgb3BhY2l0eTogMC44IH19Pnt0KCd3YWl0aW5nJyl9PC9kaXY+XHJcbiAgICApXHJcbiAgfVxyXG5cclxuICBjb25zdCBjdXJyZW50ID0gZnJhbWVzW01hdGgubWluKGluZGV4LCBNYXRoLm1heCgwLCBmcmFtZXMubGVuZ3RoIC0gMSkpXVxyXG4gIGNvbnN0IGxhYmVsID0gbGl2ZSA/IHQoJ2xpdmUnKSA6IGZyYW1lTGFiZWwoY3VycmVudCwgdCgnc2NydWJIaW50JykpXHJcbiAgY29uc3QgbWF4SWR4ID0gTWF0aC5tYXgoMCwgZnJhbWVzLmxlbmd0aCAtIDEpXHJcbiAgY29uc3QgcHJvZ3Jlc3MgPSBtYXhJZHggPT09IDAgPyAxIDogaW5kZXggLyBtYXhJZHhcclxuXHJcbiAgY29uc3QgY2hpcFN0eWxlOiBDU1NQcm9wZXJ0aWVzID0ge1xyXG4gICAgYm9yZGVyOiAnbm9uZScsXHJcbiAgICBjdXJzb3I6ICdwb2ludGVyJyxcclxuICAgIGZvbnRTaXplOiAxMixcclxuICAgIGZvbnRXZWlnaHQ6IDYwMCxcclxuICAgIHBhZGRpbmc6ICc0cHggMTBweCcsXHJcbiAgICBib3JkZXJSYWRpdXM6IDk5OSxcclxuICAgIHRyYW5zaXRpb246ICdiYWNrZ3JvdW5kIDE2MG1zIGVhc2UsIGNvbG9yIDE2MG1zIGVhc2UsIGJveC1zaGFkb3cgMTYwbXMgZWFzZScsXHJcbiAgICBiYWNrZ3JvdW5kOiBsaXZlXHJcbiAgICAgID8gJ2NvbG9yLW1peChpbiBzcmdiLCAjMTZhMzRhIDIyJSwgdHJhbnNwYXJlbnQpJ1xyXG4gICAgICA6ICdjb2xvci1taXgoaW4gc3JnYiwgY3VycmVudENvbG9yIDglLCB0cmFuc3BhcmVudCknLFxyXG4gICAgY29sb3I6IGxpdmUgPyAnIzE1ODAzZCcgOiAnaW5oZXJpdCcsXHJcbiAgICBib3hTaGFkb3c6IGxpdmUgPyAnMCAwIDAgMXB4IGNvbG9yLW1peChpbiBzcmdiLCAjMTZhMzRhIDQ1JSwgdHJhbnNwYXJlbnQpJyA6ICdub25lJyxcclxuICAgIG9wYWNpdHk6IGxpdmUgPyAxIDogMC43NSxcclxuICB9XHJcblxyXG4gIHJldHVybiAoXHJcbiAgICA8ZGl2XHJcbiAgICAgIGRhdGEtd2ViY2xhdy1saXZlPVwiXCJcclxuICAgICAgc3R5bGU9e3tcclxuICAgICAgICBkaXNwbGF5OiAnZmxleCcsXHJcbiAgICAgICAgZmxleERpcmVjdGlvbjogJ2NvbHVtbicsXHJcbiAgICAgICAgaGVpZ2h0OiAnMTAwJScsXHJcbiAgICAgICAgbWluSGVpZ2h0OiAwLFxyXG4gICAgICAgIHBhZGRpbmc6IDEyLFxyXG4gICAgICAgIGdhcDogMTAsXHJcbiAgICAgICAgYm94U2l6aW5nOiAnYm9yZGVyLWJveCcsXHJcbiAgICAgIH19XHJcbiAgICA+XHJcbiAgICAgIDxkaXZcclxuICAgICAgICBzdHlsZT17e1xyXG4gICAgICAgICAgZGlzcGxheTogJ2ZsZXgnLFxyXG4gICAgICAgICAgYWxpZ25JdGVtczogJ2NlbnRlcicsXHJcbiAgICAgICAgICBqdXN0aWZ5Q29udGVudDogJ3NwYWNlLWJldHdlZW4nLFxyXG4gICAgICAgICAgZ2FwOiA4LFxyXG4gICAgICAgICAgbWluSGVpZ2h0OiAyOCxcclxuICAgICAgICB9fVxyXG4gICAgICA+XHJcbiAgICAgICAgPGRpdlxyXG4gICAgICAgICAgc3R5bGU9e3tcclxuICAgICAgICAgICAgZm9udFNpemU6IDEzLFxyXG4gICAgICAgICAgICBmb250V2VpZ2h0OiA2MDAsXHJcbiAgICAgICAgICAgIG92ZXJmbG93OiAnaGlkZGVuJyxcclxuICAgICAgICAgICAgdGV4dE92ZXJmbG93OiAnZWxsaXBzaXMnLFxyXG4gICAgICAgICAgICB3aGl0ZVNwYWNlOiAnbm93cmFwJyxcclxuICAgICAgICAgICAgb3BhY2l0eTogbGl2ZSA/IDAuNTUgOiAwLjksXHJcbiAgICAgICAgICB9fVxyXG4gICAgICAgICAgdGl0bGU9e2xpdmUgPyB0KCdsaXZlJykgOiBmcmFtZUxhYmVsKGN1cnJlbnQsICcnKX1cclxuICAgICAgICA+XHJcbiAgICAgICAgICB7bGl2ZSA/IHQoJ3NjcnViSGludCcpIDogbGFiZWx9XHJcbiAgICAgICAgPC9kaXY+XHJcbiAgICAgICAgPGJ1dHRvbiB0eXBlPVwiYnV0dG9uXCIgc3R5bGU9e2NoaXBTdHlsZX0gb25DbGljaz17Z29MaXZlfSBhcmlhLXByZXNzZWQ9e2xpdmV9PlxyXG4gICAgICAgICAge3QoJ2xpdmUnKX1cclxuICAgICAgICA8L2J1dHRvbj5cclxuICAgICAgPC9kaXY+XHJcblxyXG4gICAgICB7ZXJyb3IgPyAoXHJcbiAgICAgICAgPGRpdiBzdHlsZT17eyBjb2xvcjogJyNkYzI2MjYnLCBmb250U2l6ZTogMTIgfX0+e2Vycm9yfTwvZGl2PlxyXG4gICAgICApIDogbnVsbH1cclxuXHJcbiAgICAgIDxkaXZcclxuICAgICAgICBzdHlsZT17e1xyXG4gICAgICAgICAgZmxleDogMSxcclxuICAgICAgICAgIG1pbkhlaWdodDogMTYwLFxyXG4gICAgICAgICAgYm9yZGVyUmFkaXVzOiAxMCxcclxuICAgICAgICAgIG92ZXJmbG93OiAnaGlkZGVuJyxcclxuICAgICAgICAgIGJhY2tncm91bmQ6ICdjb2xvci1taXgoaW4gc3JnYiwgY3VycmVudENvbG9yIDYlLCB0cmFuc3BhcmVudCknLFxyXG4gICAgICAgICAgZGlzcGxheTogJ2ZsZXgnLFxyXG4gICAgICAgICAgYWxpZ25JdGVtczogJ2NlbnRlcicsXHJcbiAgICAgICAgICBqdXN0aWZ5Q29udGVudDogJ2NlbnRlcicsXHJcbiAgICAgICAgICBwYWRkaW5nOiA4LFxyXG4gICAgICAgIH19XHJcbiAgICAgID5cclxuICAgICAgICA8TGl2ZVByZXZpZXdJbWFnZSBzcmM9e2ltZ1VybH0gbGFiZWw9e3QoJ3BsYWNlaG9sZGVyJyl9IC8+XHJcbiAgICAgIDwvZGl2PlxyXG5cclxuICAgICAgPGRpdlxyXG4gICAgICAgIHJlZj17dHJhY2tSZWZ9XHJcbiAgICAgICAgcm9sZT1cInNsaWRlclwiXHJcbiAgICAgICAgYXJpYS12YWx1ZW1pbj17MH1cclxuICAgICAgICBhcmlhLXZhbHVlbWF4PXttYXhJZHh9XHJcbiAgICAgICAgYXJpYS12YWx1ZW5vdz17aW5kZXh9XHJcbiAgICAgICAgYXJpYS1sYWJlbD17dCgnc2NydWJIaW50Jyl9XHJcbiAgICAgICAgdGFiSW5kZXg9ezB9XHJcbiAgICAgICAgb25Qb2ludGVyRG93bj17b25UcmFja1BvaW50ZXJEb3dufVxyXG4gICAgICAgIG9uUG9pbnRlck1vdmU9e29uVHJhY2tQb2ludGVyTW92ZX1cclxuICAgICAgICBvblBvaW50ZXJVcD17b25UcmFja1BvaW50ZXJVcH1cclxuICAgICAgICBvblBvaW50ZXJDYW5jZWw9e29uVHJhY2tQb2ludGVyVXB9XHJcbiAgICAgICAgb25LZXlEb3duPXtlID0+IHtcclxuICAgICAgICAgIGlmICghZnJhbWVzLmxlbmd0aCkgcmV0dXJuXHJcbiAgICAgICAgICBpZiAoZS5rZXkgPT09ICdBcnJvd0xlZnQnKSB7XHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKVxyXG4gICAgICAgICAgICBhcHBseVNjcnViSW5kZXgoaW5kZXggLSAxLCBmcmFtZXMpXHJcbiAgICAgICAgICB9IGVsc2UgaWYgKGUua2V5ID09PSAnQXJyb3dSaWdodCcpIHtcclxuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpXHJcbiAgICAgICAgICAgIGFwcGx5U2NydWJJbmRleChpbmRleCArIDEsIGZyYW1lcylcclxuICAgICAgICAgIH0gZWxzZSBpZiAoZS5rZXkgPT09ICdIb21lJykge1xyXG4gICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KClcclxuICAgICAgICAgICAgYXBwbHlTY3J1YkluZGV4KDAsIGZyYW1lcylcclxuICAgICAgICAgIH0gZWxzZSBpZiAoZS5rZXkgPT09ICdFbmQnKSB7XHJcbiAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKVxyXG4gICAgICAgICAgICBhcHBseVNjcnViSW5kZXgobWF4SWR4LCBmcmFtZXMpXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfX1cclxuICAgICAgICBzdHlsZT17e1xyXG4gICAgICAgICAgcG9zaXRpb246ICdyZWxhdGl2ZScsXHJcbiAgICAgICAgICBoZWlnaHQ6IDI4LFxyXG4gICAgICAgICAgZGlzcGxheTogJ2ZsZXgnLFxyXG4gICAgICAgICAgYWxpZ25JdGVtczogJ2NlbnRlcicsXHJcbiAgICAgICAgICBjdXJzb3I6IGZyYW1lcy5sZW5ndGggPyAnZXctcmVzaXplJyA6ICdkZWZhdWx0JyxcclxuICAgICAgICAgIHRvdWNoQWN0aW9uOiAnbm9uZScsXHJcbiAgICAgICAgICB1c2VyU2VsZWN0OiAnbm9uZScsXHJcbiAgICAgICAgICBwYWRkaW5nVG9wOiAyLFxyXG4gICAgICAgIH19XHJcbiAgICAgID5cclxuICAgICAgICA8ZGl2XHJcbiAgICAgICAgICBzdHlsZT17e1xyXG4gICAgICAgICAgICBwb3NpdGlvbjogJ2Fic29sdXRlJyxcclxuICAgICAgICAgICAgbGVmdDogMCxcclxuICAgICAgICAgICAgcmlnaHQ6IDAsXHJcbiAgICAgICAgICAgIGhlaWdodDogNCxcclxuICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiA5OTksXHJcbiAgICAgICAgICAgIGJhY2tncm91bmQ6ICdjb2xvci1taXgoaW4gc3JnYiwgY3VycmVudENvbG9yIDE0JSwgdHJhbnNwYXJlbnQpJyxcclxuICAgICAgICAgIH19XHJcbiAgICAgICAgLz5cclxuICAgICAgICA8ZGl2XHJcbiAgICAgICAgICBzdHlsZT17e1xyXG4gICAgICAgICAgICBwb3NpdGlvbjogJ2Fic29sdXRlJyxcclxuICAgICAgICAgICAgbGVmdDogMCxcclxuICAgICAgICAgICAgd2lkdGg6IGAke01hdGgubWF4KDIsIHByb2dyZXNzICogMTAwKX0lYCxcclxuICAgICAgICAgICAgaGVpZ2h0OiA0LFxyXG4gICAgICAgICAgICBib3JkZXJSYWRpdXM6IDk5OSxcclxuICAgICAgICAgICAgYmFja2dyb3VuZDogbGl2ZVxyXG4gICAgICAgICAgICAgID8gJ2NvbG9yLW1peChpbiBzcmdiLCAjMTZhMzRhIDcwJSwgY3VycmVudENvbG9yKSdcclxuICAgICAgICAgICAgICA6ICdjb2xvci1taXgoaW4gc3JnYiwgY3VycmVudENvbG9yIDQ1JSwgdHJhbnNwYXJlbnQpJyxcclxuICAgICAgICAgICAgdHJhbnNpdGlvbjogZHJhZ2dpbmcgPyAnbm9uZScgOiAnd2lkdGggMTIwbXMgZWFzZScsXHJcbiAgICAgICAgICB9fVxyXG4gICAgICAgIC8+XHJcbiAgICAgICAge2ZyYW1lcy5sZW5ndGggPiAxXHJcbiAgICAgICAgICA/IGZyYW1lcy5tYXAoKGYsIGkpID0+IChcclxuICAgICAgICAgICAgICA8ZGl2XHJcbiAgICAgICAgICAgICAgICBrZXk9e2YuaWR9XHJcbiAgICAgICAgICAgICAgICB0aXRsZT17ZnJhbWVMYWJlbChmLCAnJyl9XHJcbiAgICAgICAgICAgICAgICBzdHlsZT17e1xyXG4gICAgICAgICAgICAgICAgICBwb3NpdGlvbjogJ2Fic29sdXRlJyxcclxuICAgICAgICAgICAgICAgICAgbGVmdDogYCR7KGkgLyBtYXhJZHgpICogMTAwfSVgLFxyXG4gICAgICAgICAgICAgICAgICB3aWR0aDogMixcclxuICAgICAgICAgICAgICAgICAgaGVpZ2h0OiBpID09PSAwIHx8IGkgPT09IG1heElkeCA/IDggOiA1LFxyXG4gICAgICAgICAgICAgICAgICBtYXJnaW5MZWZ0OiAtMSxcclxuICAgICAgICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiAxLFxyXG4gICAgICAgICAgICAgICAgICBiYWNrZ3JvdW5kOlxyXG4gICAgICAgICAgICAgICAgICAgIGkgPD0gaW5kZXhcclxuICAgICAgICAgICAgICAgICAgICAgID8gJ2NvbG9yLW1peChpbiBzcmdiLCBjdXJyZW50Q29sb3IgNTUlLCB0cmFuc3BhcmVudCknXHJcbiAgICAgICAgICAgICAgICAgICAgICA6ICdjb2xvci1taXgoaW4gc3JnYiwgY3VycmVudENvbG9yIDE4JSwgdHJhbnNwYXJlbnQpJyxcclxuICAgICAgICAgICAgICAgICAgcG9pbnRlckV2ZW50czogJ25vbmUnLFxyXG4gICAgICAgICAgICAgICAgfX1cclxuICAgICAgICAgICAgICAvPlxyXG4gICAgICAgICAgICApKVxyXG4gICAgICAgICAgOiBudWxsfVxyXG4gICAgICAgIDxkaXZcclxuICAgICAgICAgIHN0eWxlPXt7XHJcbiAgICAgICAgICAgIHBvc2l0aW9uOiAnYWJzb2x1dGUnLFxyXG4gICAgICAgICAgICBsZWZ0OiBgJHtwcm9ncmVzcyAqIDEwMH0lYCxcclxuICAgICAgICAgICAgd2lkdGg6IDE0LFxyXG4gICAgICAgICAgICBoZWlnaHQ6IDE0LFxyXG4gICAgICAgICAgICBtYXJnaW5MZWZ0OiAtNyxcclxuICAgICAgICAgICAgYm9yZGVyUmFkaXVzOiAnNTAlJyxcclxuICAgICAgICAgICAgYmFja2dyb3VuZDogbGl2ZSA/ICcjMTZhMzRhJyA6ICdjdXJyZW50Q29sb3InLFxyXG4gICAgICAgICAgICBib3hTaGFkb3c6IGxpdmVcclxuICAgICAgICAgICAgICA/ICcwIDAgMCA0cHggY29sb3ItbWl4KGluIHNyZ2IsICMxNmEzNGEgMjglLCB0cmFuc3BhcmVudCknXHJcbiAgICAgICAgICAgICAgOiAnMCAwIDAgM3B4IGNvbG9yLW1peChpbiBzcmdiLCBjdXJyZW50Q29sb3IgMTIlLCB0cmFuc3BhcmVudCknLFxyXG4gICAgICAgICAgICB0cmFuc2l0aW9uOiBkcmFnZ2luZyA/ICdub25lJyA6ICdsZWZ0IDEyMG1zIGVhc2UsIGJhY2tncm91bmQgMTYwbXMgZWFzZScsXHJcbiAgICAgICAgICAgIHBvaW50ZXJFdmVudHM6ICdub25lJyxcclxuICAgICAgICAgIH19XHJcbiAgICAgICAgLz5cclxuICAgICAgPC9kaXY+XHJcbiAgICA8L2Rpdj5cclxuICApXHJcbn1cclxuIiwgIi8qKlxyXG4gKiBMaXZlIFBORyB3aXRoIGEgY2FsbSBwbGFjZWhvbGRlciBpbnN0ZWFkIG9mIHRoZSBicm93c2VyJ3MgYnJva2VuLWltYWdlIGljb24uXHJcbiAqL1xyXG5pbXBvcnQgeyB1c2VFZmZlY3QsIHVzZVN0YXRlLCB0eXBlIENTU1Byb3BlcnRpZXMsIHR5cGUgUmVhY3ROb2RlIH0gZnJvbSAncmVhY3QnXHJcblxyXG50eXBlIFByb3BzID0ge1xyXG4gIHNyYzogc3RyaW5nXHJcbiAgYWx0Pzogc3RyaW5nXHJcbiAgbGFiZWw6IHN0cmluZ1xyXG4gIG1heEhlaWdodD86IG51bWJlciB8IHN0cmluZ1xyXG4gIHN0eWxlPzogQ1NTUHJvcGVydGllc1xyXG59XHJcblxyXG5jb25zdCBzaGVsbFN0eWxlOiBDU1NQcm9wZXJ0aWVzID0ge1xyXG4gIHdpZHRoOiAnMTAwJScsXHJcbiAgaGVpZ2h0OiAnMTAwJScsXHJcbiAgbWluSGVpZ2h0OiAxMjAsXHJcbiAgZGlzcGxheTogJ2ZsZXgnLFxyXG4gIGFsaWduSXRlbXM6ICdjZW50ZXInLFxyXG4gIGp1c3RpZnlDb250ZW50OiAnY2VudGVyJyxcclxuICBib3hTaXppbmc6ICdib3JkZXItYm94JyxcclxufVxyXG5cclxuY29uc3QgcGxhY2Vob2xkZXJTdHlsZTogQ1NTUHJvcGVydGllcyA9IHtcclxuICAuLi5zaGVsbFN0eWxlLFxyXG4gIGZsZXhEaXJlY3Rpb246ICdjb2x1bW4nLFxyXG4gIGdhcDogMTAsXHJcbiAgcGFkZGluZzogMTYsXHJcbiAgYm9yZGVyUmFkaXVzOiA4LFxyXG4gIGJvcmRlcjogJzFweCBkYXNoZWQgY29sb3ItbWl4KGluIHNyZ2IsIGN1cnJlbnRDb2xvciAyMiUsIHRyYW5zcGFyZW50KScsXHJcbiAgYmFja2dyb3VuZDpcclxuICAgICdyZXBlYXRpbmctbGluZWFyLWdyYWRpZW50KDEzNWRlZywgY29sb3ItbWl4KGluIHNyZ2IsIGN1cnJlbnRDb2xvciA1JSwgdHJhbnNwYXJlbnQpIDAgOHB4LCB0cmFuc3BhcmVudCA4cHggMTZweCknLFxyXG4gIGNvbG9yOiAnaW5oZXJpdCcsXHJcbiAgb3BhY2l0eTogMC43OCxcclxufVxyXG5cclxuZnVuY3Rpb24gUGxhY2Vob2xkZXIoeyBsYWJlbCwgbWF4SGVpZ2h0IH06IHsgbGFiZWw6IHN0cmluZzsgbWF4SGVpZ2h0PzogbnVtYmVyIHwgc3RyaW5nIH0pOiBSZWFjdE5vZGUge1xyXG4gIHJldHVybiAoXHJcbiAgICA8ZGl2IHN0eWxlPXt7IC4uLnBsYWNlaG9sZGVyU3R5bGUsIG1heEhlaWdodCwgbWluSGVpZ2h0OiB0eXBlb2YgbWF4SGVpZ2h0ID09PSAnbnVtYmVyJyA/IE1hdGgubWluKDEyMCwgbWF4SGVpZ2h0KSA6IDEyMCB9fT5cclxuICAgICAgPHN2ZyB3aWR0aD1cIjM2XCIgaGVpZ2h0PVwiMjhcIiB2aWV3Qm94PVwiMCAwIDM2IDI4XCIgYXJpYS1oaWRkZW49XCJ0cnVlXCIgc3R5bGU9e3sgb3BhY2l0eTogMC41NSB9fT5cclxuICAgICAgICA8cmVjdCB4PVwiMS41XCIgeT1cIjEuNVwiIHdpZHRoPVwiMzNcIiBoZWlnaHQ9XCIyNVwiIHJ4PVwiM1wiIGZpbGw9XCJub25lXCIgc3Ryb2tlPVwiY3VycmVudENvbG9yXCIgc3Ryb2tlV2lkdGg9XCIxLjVcIiAvPlxyXG4gICAgICAgIDxjaXJjbGUgY3g9XCIxMVwiIGN5PVwiMTBcIiByPVwiMi41XCIgZmlsbD1cImN1cnJlbnRDb2xvclwiIG9wYWNpdHk9XCIwLjQ1XCIgLz5cclxuICAgICAgICA8cGF0aFxyXG4gICAgICAgICAgZD1cIk00IDIyIEwxMyAxMiBMMTggMTYgTDI0IDkgTDMyIDIyIFpcIlxyXG4gICAgICAgICAgZmlsbD1cImN1cnJlbnRDb2xvclwiXHJcbiAgICAgICAgICBvcGFjaXR5PVwiMC4yOFwiXHJcbiAgICAgICAgLz5cclxuICAgICAgPC9zdmc+XHJcbiAgICAgIDxzcGFuIHN0eWxlPXt7IGZvbnRTaXplOiAxMiwgZm9udFdlaWdodDogNTAwIH19PntsYWJlbH08L3NwYW4+XHJcbiAgICA8L2Rpdj5cclxuICApXHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBMaXZlUHJldmlld0ltYWdlKHsgc3JjLCBhbHQgPSAnJywgbGFiZWwsIG1heEhlaWdodCwgc3R5bGUgfTogUHJvcHMpOiBSZWFjdE5vZGUge1xyXG4gIGNvbnN0IFtzdGF0dXMsIHNldFN0YXR1c10gPSB1c2VTdGF0ZTwnbG9hZGluZycgfCAnb2snIHwgJ2Vycm9yJz4oc3JjID8gJ2xvYWRpbmcnIDogJ2Vycm9yJylcclxuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIHNldFN0YXR1cyhzcmMgPyAnbG9hZGluZycgOiAnZXJyb3InKVxyXG4gIH0sIFtzcmNdKVxyXG5cclxuICBpZiAoIXNyYyB8fCBzdGF0dXMgPT09ICdlcnJvcicpIHtcclxuICAgIHJldHVybiA8UGxhY2Vob2xkZXIgbGFiZWw9e2xhYmVsfSBtYXhIZWlnaHQ9e21heEhlaWdodH0gLz5cclxuICB9XHJcblxyXG4gIHJldHVybiAoXHJcbiAgICA8ZGl2IHN0eWxlPXt7IC4uLnNoZWxsU3R5bGUsIHBvc2l0aW9uOiAncmVsYXRpdmUnLCBtYXhIZWlnaHQsIC4uLnN0eWxlIH19PlxyXG4gICAgICB7c3RhdHVzID09PSAnbG9hZGluZycgPyAoXHJcbiAgICAgICAgPGRpdiBzdHlsZT17eyBwb3NpdGlvbjogJ2Fic29sdXRlJywgaW5zZXQ6IDAsIHBvaW50ZXJFdmVudHM6ICdub25lJyB9fT5cclxuICAgICAgICAgIDxQbGFjZWhvbGRlciBsYWJlbD17bGFiZWx9IG1heEhlaWdodD17bWF4SGVpZ2h0fSAvPlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICApIDogbnVsbH1cclxuICAgICAgPGltZ1xyXG4gICAgICAgIGtleT17c3JjfVxyXG4gICAgICAgIHNyYz17c3JjfVxyXG4gICAgICAgIGFsdD17YWx0fVxyXG4gICAgICAgIGRyYWdnYWJsZT17ZmFsc2V9XHJcbiAgICAgICAgb25Mb2FkPXsoKSA9PiBzZXRTdGF0dXMoJ29rJyl9XHJcbiAgICAgICAgb25FcnJvcj17KCkgPT4gc2V0U3RhdHVzKCdlcnJvcicpfVxyXG4gICAgICAgIHN0eWxlPXt7XHJcbiAgICAgICAgICBtYXhXaWR0aDogJzEwMCUnLFxyXG4gICAgICAgICAgbWF4SGVpZ2h0OiBtYXhIZWlnaHQgPz8gJzEwMCUnLFxyXG4gICAgICAgICAgb2JqZWN0Rml0OiAnY29udGFpbicsXHJcbiAgICAgICAgICBkaXNwbGF5OiBzdGF0dXMgPT09ICdvaycgPyAnYmxvY2snIDogJ25vbmUnLFxyXG4gICAgICAgIH19XHJcbiAgICAgIC8+XHJcbiAgICA8L2Rpdj5cclxuICApXHJcbn1cclxuIiwgIi8qKlxyXG4gKiBCcmlkZ2U6IGluLWNoYXQgdG9vbHZpZXcgKHNlc3Npb24gc3VyZmFjZSkgXHUyMTkyIGxpdmUgc2lkZWJhciBvcGVuVGFiIHBvbGxlci5cclxuICogQ3VzdG9tRXZlbnQga2VlcHMgdG9vbHZpZXcgZnJlZSBvZiBhIGhhcmQgc2lkZWJhclJpZ2h0IGluamVjdCBkZXBlbmRlbmN5LlxyXG4gKi9cclxuXHJcbmV4cG9ydCBjb25zdCBXRUJDTEFXX09QRU5fTElWRV9FVkVOVCA9ICd3ZWJjbGF3Om9wZW4tbGl2ZSdcclxuXHJcbmV4cG9ydCB0eXBlIFdlYmNsYXdPcGVuTGl2ZURldGFpbCA9IHtcclxuICBydW5EaXI6IHN0cmluZ1xyXG4gIC8qKiBCdW1wIHNvIHRoZSBzYW1lIHJ1bkRpciBjYW4gcmUtdHJpZ2dlciBvcGVuIGFmdGVyIGEgZmFpbGVkIGF0dGVtcHQuICovXHJcbiAgbm9uY2U/OiBudW1iZXJcclxufVxyXG5cclxuLyoqIEFzayB0aGUgcm9vdCBsaXZlIHBvbGxlciB0byBvcGVuL3JldmVhbCB0aGUgd2ViY2xhdy1saXZlIHRhYi4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIHJlcXVlc3RPcGVuTGl2ZShydW5EaXI6IHN0cmluZyk6IHZvaWQge1xyXG4gIGNvbnN0IHRyaW1tZWQgPSBydW5EaXIudHJpbSgpXHJcbiAgaWYgKCF0cmltbWVkIHx8IHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnKSByZXR1cm5cclxuICB3aW5kb3cuZGlzcGF0Y2hFdmVudChcclxuICAgIG5ldyBDdXN0b21FdmVudDxXZWJjbGF3T3BlbkxpdmVEZXRhaWw+KFdFQkNMQVdfT1BFTl9MSVZFX0VWRU5ULCB7XHJcbiAgICAgIGRldGFpbDogeyBydW5EaXI6IHRyaW1tZWQsIG5vbmNlOiBEYXRlLm5vdygpIH0sXHJcbiAgICB9KSxcclxuICApXHJcbn1cclxuIiwgIi8qKiBDb2RlLXN0eWxlIHByZXZpZXcgZm9yIGAud2ViY2xhd2AgcmVjaXBlcyAoYGxhbmc9bG9nYDsgbm8gZW5naW5lIGV4dGVuc2lvbiB0YWJsZSkuICovXHJcbmltcG9ydCB0eXBlIHsgUmVhY3ROb2RlIH0gZnJvbSAncmVhY3QnXHJcbmltcG9ydCB0eXBlIHsgUHJvcHNMb2NhbGUgfSBmcm9tICdAZGVlcHNlZWstYWkvZHNoLWNsaWVudC11aS1zbG90cydcclxuaW1wb3J0IHsgQ29kZUJsb2NrIH0gZnJvbSAnQGRlZXBzZWVrLWFpL2RzaC1jbGllbnQtdWktcHJpbWl0aXZlcydcclxuaW1wb3J0IHR5cGUgeyBEb2N1bWVudFByZXZpZXdQcm9wcyB9IGZyb20gJ0BkZWVwc2Vlay1haS9kc2gtY2xpZW50LXVpLXNpZGViYXItZG9jdW1lbnRwcmV2aWV3L2NsaWVudCdcclxuaW1wb3J0IHsgZXh0cmFjdFJlY2lwZVBhcmFtcyB9IGZyb20gJy4uL3BhcmFtcy50cydcclxuaW1wb3J0IHR5cGUge30gZnJvbSAnLi9sb2NhbGVzLnRzJ1xyXG5cclxuLyoqIERvY3VtZW50IG93bmVyIHByb3BzIHBsdXMgdGhpcyBwcmV2aWV3J3MgY29weS4gKi9cclxuZXhwb3J0IHR5cGUgV2ViY2xhd1ByZXZpZXdQcm9wcyA9IERvY3VtZW50UHJldmlld1Byb3BzICYgUHJvcHNMb2NhbGU8J3dlYmNsYXdQcmV2aWV3Jz5cclxuXHJcbi8qKlxyXG4gKiBIaWdobGlnaHQgYC53ZWJjbGF3YCBhcyBsb2cvcGxhaW4gcmVjaXBlIHRleHQuXHJcbiAqIFNob3dzIGRlY2xhcmVkXHUzMDBDXHU1M0MyXHU2NTcwXHUzMDBEZGVmYXVsdHMgYWJvdmUgdGhlIGJvZHkgKHJlYWQtb25seTsgZWRpdCB2aWEgY2hhdCBmb3JtIG9uIHJ1bikuXHJcbiAqIEBwYXJhbSBwcm9wcyAtIGRvY3VtZW50IGNvbnRlbnQgZnJvbSB0aGUgc2lkZWJhciBvd25lci5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBXZWJjbGF3UHJldmlldyh7XHJcbiAgY29udGVudCxcclxuICB3cmFwLFxyXG4gIHNjcm9sbHBvcnRSZWYsXHJcbiAgdCxcclxufTogV2ViY2xhd1ByZXZpZXdQcm9wcyk6IFJlYWN0Tm9kZSB7XHJcbiAgaWYgKGNvbnRlbnQua2luZCAhPT0gJ3RleHQnKSByZXR1cm4gbnVsbFxyXG4gIGNvbnN0IHBhcmFtcyA9IGV4dHJhY3RSZWNpcGVQYXJhbXMoY29udGVudC50ZXh0KVxyXG4gIHJldHVybiAoXHJcbiAgICA8ZGl2IGRhdGEtd2ViY2xhdy1wcmV2aWV3PVwiXCIgZGF0YS13cmFwPXt3cmFwID8gJ3RydWUnIDogJ2ZhbHNlJ30+XHJcbiAgICAgIHtwYXJhbXMubGVuZ3RoID4gMCA/IChcclxuICAgICAgICA8ZGl2XHJcbiAgICAgICAgICBkYXRhLXdlYmNsYXctcGFyYW1zPVwiXCJcclxuICAgICAgICAgIHN0eWxlPXt7XHJcbiAgICAgICAgICAgIG1hcmdpbjogJzAgMCAxMnB4JyxcclxuICAgICAgICAgICAgcGFkZGluZzogJzEwcHggMTJweCcsXHJcbiAgICAgICAgICAgIGJvcmRlckJvdHRvbTogJzFweCBzb2xpZCBjb2xvci1taXgoaW4gc3JnYiwgY3VycmVudENvbG9yIDEyJSwgdHJhbnNwYXJlbnQpJyxcclxuICAgICAgICAgICAgZm9udFNpemU6IDEzLFxyXG4gICAgICAgICAgICBsaW5lSGVpZ2h0OiAxLjUsXHJcbiAgICAgICAgICB9fVxyXG4gICAgICAgID5cclxuICAgICAgICAgIDxkaXYgc3R5bGU9e3sgZm9udFdlaWdodDogNjAwLCBtYXJnaW5Cb3R0b206IDYgfX0+e3QoJ3BhcmFtc1RpdGxlJyl9PC9kaXY+XHJcbiAgICAgICAgICA8ZGwgc3R5bGU9e3sgbWFyZ2luOiAwLCBkaXNwbGF5OiAnZ3JpZCcsIGdhcDogNCB9fT5cclxuICAgICAgICAgICAge3BhcmFtcy5tYXAocCA9PiAoXHJcbiAgICAgICAgICAgICAgPGRpdlxyXG4gICAgICAgICAgICAgICAga2V5PXtwLm5hbWV9XHJcbiAgICAgICAgICAgICAgICBzdHlsZT17eyBkaXNwbGF5OiAnZ3JpZCcsIGdyaWRUZW1wbGF0ZUNvbHVtbnM6ICc3ZW0gMWZyJywgZ2FwOiA4IH19XHJcbiAgICAgICAgICAgICAgPlxyXG4gICAgICAgICAgICAgICAgPGR0IHN0eWxlPXt7IG9wYWNpdHk6IDAuNywgbWFyZ2luOiAwIH19PntwLm5hbWV9PC9kdD5cclxuICAgICAgICAgICAgICAgIDxkZCBzdHlsZT17eyBtYXJnaW46IDAsIGZvbnRGYW1pbHk6ICd1aS1tb25vc3BhY2UsIG1vbm9zcGFjZScgfX0+XHJcbiAgICAgICAgICAgICAgICAgIHtwLnZhbHVlfVxyXG4gICAgICAgICAgICAgICAgPC9kZD5cclxuICAgICAgICAgICAgICA8L2Rpdj5cclxuICAgICAgICAgICAgKSl9XHJcbiAgICAgICAgICA8L2RsPlxyXG4gICAgICAgICAgPGRpdiBzdHlsZT17eyBtYXJnaW5Ub3A6IDgsIG9wYWNpdHk6IDAuNjUsIGZvbnRTaXplOiAxMiB9fT5cclxuICAgICAgICAgICAge3QoJ3BhcmFtc0hpbnQnKX1cclxuICAgICAgICAgIDwvZGl2PlxyXG4gICAgICAgIDwvZGl2PlxyXG4gICAgICApIDogbnVsbH1cclxuICAgICAgPENvZGVCbG9ja1xyXG4gICAgICAgIGNvbnRlbnRSZWY9e3Njcm9sbHBvcnRSZWZ9XHJcbiAgICAgICAgY29kZT17Y29udGVudC50ZXh0fVxyXG4gICAgICAgIGxhbmc9XCJsb2dcIlxyXG4gICAgICAgIHN0cmVhbWluZz17IWNvbnRlbnQuZW9mfVxyXG4gICAgICAgIHdyYXA9e3dyYXB9XHJcbiAgICAgICAgbGluZU51bWJlcnNcclxuICAgICAgICBjb3B5TGFiZWw9e3QoJ2NvcHknKX1cclxuICAgICAgICBjb3BpZWRMYWJlbD17dCgnY29waWVkJyl9XHJcbiAgICAgICAgdG9vbGJhckxhYmVscz17e1xyXG4gICAgICAgICAgY29kZUxhYmVsOiB0KCdjb2RlQmxvY2tUaXRsZScpLFxyXG4gICAgICAgICAgd3JhcExhYmVsOiB0KCd3cmFwJyksXHJcbiAgICAgICAgICB1bndyYXBMYWJlbDogdCgndW53cmFwJyksXHJcbiAgICAgICAgfX1cclxuICAgICAgLz5cclxuICAgIDwvZGl2PlxyXG4gIClcclxufVxyXG4iLCAiLyoqXHJcbiAqIFJlY2lwZVx1MzAwQ1x1NTNDMlx1NjU3MFx1MzAwRGhlbHBlcnMgZm9yIERTSCAobWlycm9ycyBydW50aW1lIGV4dHJhY3QvbWVyZ2UgZm9yIHN0YXRpYyBwYXJhbXMpLlxyXG4gKlxyXG4gKiBEZXNrdG9wIHNob3dzIHRoZXNlIGluIHRoZSB0b3AgXHU1M0MyXHU2NTcwXHU2ODBGIGJlZm9yZSBydW4uIERTSCBoYXMgbm8gbmF0aXZlIGZvcm0gQVBJLFxyXG4gKiBzbyB0aGUgSG9zdCB0b29scyBleHRyYWN0IGRlZmF1bHRzLCBnYXRlIHJ1biB1bnRpbCBjb25maXJtZWQsIHRoZW4gcmV3cml0ZVxyXG4gKiBgXHU1M0MyXHU2NTcwXHU1NDBEPVx1NTAzQ2AgaW50byB0aGUgdGVtcCByZWNpcGUgKGZpbGUgZGVjbGFyYXRpb25zIG90aGVyd2lzZSBiZWF0IENMSSAtLXBhcmFtcykuXHJcbiAqL1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBSZWNpcGVQYXJhbUt2IHtcclxuICByZWFkb25seSBuYW1lOiBzdHJpbmdcclxuICByZWFkb25seSB2YWx1ZTogc3RyaW5nXHJcbn1cclxuXHJcbi8qKiBOb3JtYWxpemUgQk9NIC8gbmV3bGluZXMgc28gY29tbWEtc3BsaXQgc2VlcyBvbmUgc3RlcCBzdHJlYW0uICovXHJcbmZ1bmN0aW9uIG5vcm1hbGl6ZVJlY2lwZVRleHQoY29udGVudDogc3RyaW5nKTogc3RyaW5nIHtcclxuICByZXR1cm4gY29udGVudC5yZXBsYWNlKC9eXFx1RkVGRi8sICcnKS5yZXBsYWNlKC9cXHJcXG4vZywgJ1xcbicpLnRyaW0oKVxyXG59XHJcblxyXG4vKipcclxuICogU3BsaXQgcmVjaXBlIGludG8gc3RlcCBzZWdtZW50cyBvbiBDaGluZXNlL0FTQ0lJIGNvbW1hcy5cclxuICogRXNjYXBlIHNlcXVlbmNlcyBgXFwsYCBgXFxcdUZGMENgIGtlZXAgdGhlIGNvbW1hIGxpdGVyYWwgKHNhbWUgaWRlYSBhcyBydW50aW1lKS5cclxuICpcclxuICogTmV3bGluZXMgYmVjb21lIGBcdUZGMENgIChub3QgZW1wdHkpOiBvdGhlcndpc2VcclxuICogYFx1NTNDMlx1NjU3MFx1NTM5Rlx1NTZFMD1cdTVCQjZcdTRFMkRcdTY3MDlcdTRFOEJcXG5cdTc2N0JcdTVGNTVFSFJcdTdDRkJcdTdFREZgIGNvbGxhcHNlcyB0byBgXHU1M0MyXHU2NTcwXHU1MzlGXHU1NkUwPVx1NUJCNlx1NEUyRFx1NjcwOVx1NEU4Qlx1NzY3Qlx1NUY1NUVIUlx1N0NGQlx1N0VERmBcclxuICogYW5kIHRoZSBsb2dpbiBzdGVwIGlzIGxvc3QuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gc3BsaXRSZWNpcGVTdGVwcyhjb250ZW50OiBzdHJpbmcpOiBzdHJpbmdbXSB7XHJcbiAgY29uc3QgdGV4dCA9IG5vcm1hbGl6ZVJlY2lwZVRleHQoY29udGVudCkucmVwbGFjZSgvXFxuKy9nLCAnXHVGRjBDJylcclxuICBpZiAoIXRleHQpIHJldHVybiBbXVxyXG4gIGNvbnN0IHN0ZXBzOiBzdHJpbmdbXSA9IFtdXHJcbiAgbGV0IGJ1ZiA9ICcnXHJcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCB0ZXh0Lmxlbmd0aDsgaSsrKSB7XHJcbiAgICBjb25zdCBjaCA9IHRleHRbaV0hXHJcbiAgICBpZiAoY2ggPT09ICdcXFxcJyAmJiBpICsgMSA8IHRleHQubGVuZ3RoKSB7XHJcbiAgICAgIGNvbnN0IG5leHQgPSB0ZXh0W2kgKyAxXSFcclxuICAgICAgaWYgKG5leHQgPT09ICcsJyB8fCBuZXh0ID09PSAnXHVGRjBDJyB8fCBuZXh0ID09PSAnLicgfHwgbmV4dCA9PT0gJ1x1MzAwMicpIHtcclxuICAgICAgICBidWYgKz0gbmV4dFxyXG4gICAgICAgIGkrK1xyXG4gICAgICAgIGNvbnRpbnVlXHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIGlmIChjaCA9PT0gJ1x1RkYwQycgfHwgY2ggPT09ICcsJykge1xyXG4gICAgICBjb25zdCB0ID0gYnVmLnRyaW0oKVxyXG4gICAgICBpZiAodCkgc3RlcHMucHVzaCh0KVxyXG4gICAgICBidWYgPSAnJ1xyXG4gICAgICBjb250aW51ZVxyXG4gICAgfVxyXG4gICAgYnVmICs9IGNoXHJcbiAgfVxyXG4gIGNvbnN0IGxhc3QgPSBidWYudHJpbSgpXHJcbiAgaWYgKGxhc3QpIHN0ZXBzLnB1c2gobGFzdClcclxuICByZXR1cm4gc3RlcHNcclxufVxyXG5cclxuLyoqXHJcbiAqIEV4dHJhY3Qgc3RhdGljIGBcdTUzQzJcdTY1NzBcdTU0MEQ9XHU1MDNDYCBkZWNsYXJhdGlvbnMgKHRvcCBiYXIgLyBmb3JtIGZpZWxkcykuXHJcbiAqIFNraXBzXHUzMDBDXHU1MkE4XHU2MDAxXHU1M0MyXHU2NTcwXHUzMDBEOyBsYXN0IGR1cGxpY2F0ZSBuYW1lIHdpbnMgb3JkZXIgb2YgZmlyc3Qgb2NjdXJyZW5jZSB3aXRoIGxhc3QgdmFsdWUuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gZXh0cmFjdFJlY2lwZVBhcmFtcyhjb250ZW50OiBzdHJpbmcpOiBSZWNpcGVQYXJhbUt2W10ge1xyXG4gIGNvbnN0IHN0ZXBzID0gc3BsaXRSZWNpcGVTdGVwcyhjb250ZW50KVxyXG4gIGNvbnN0IG9yZGVyOiBzdHJpbmdbXSA9IFtdXHJcbiAgY29uc3QgbWFwID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKVxyXG4gIGZvciAoY29uc3Qgc3RlcCBvZiBzdGVwcykge1xyXG4gICAgaWYgKHN0ZXAuc3RhcnRzV2l0aCgnXHU1MkE4XHU2MDAxXHU1M0MyXHU2NTcwJykpIGNvbnRpbnVlXHJcbiAgICBpZiAoIXN0ZXAuc3RhcnRzV2l0aCgnXHU1M0MyXHU2NTcwJykpIGNvbnRpbnVlXHJcbiAgICBjb25zdCBib2R5ID0gc3RlcC5zbGljZSgnXHU1M0MyXHU2NTcwJy5sZW5ndGgpXHJcbiAgICBjb25zdCBlcSA9IGJvZHkuaW5kZXhPZignPScpXHJcbiAgICBpZiAoZXEgPD0gMCkgY29udGludWVcclxuICAgIGNvbnN0IG5hbWUgPSBib2R5LnNsaWNlKDAsIGVxKS50cmltKClcclxuICAgIC8vIERyb3AgZ2x1ZWQgdmVyYnMgZnJvbSBvbGRlciBuZXdsaW5lIGJ1Z3M6IFx1NUJCNlx1NEUyRFx1NjcwOVx1NEU4Qlx1NzY3Qlx1NUY1NUVIUlx1N0NGQlx1N0VERiBcdTIxOTIgXHU1QkI2XHU0RTJEXHU2NzA5XHU0RThCXHJcbiAgICBsZXQgdmFsdWUgPSBib2R5LnNsaWNlKGVxICsgMSkudHJpbSgpXHJcbiAgICB2YWx1ZSA9IHZhbHVlLnJlcGxhY2UoXHJcbiAgICAgIC8oPzw9W1xcdTRlMDAtXFx1OWZmZkEtWmEtejAtOV0pKFx1NzY3Qlx1NUY1NXxcdTYyNTNcdTVGMDB8XHU3MEI5XHU1MUZCfFx1OEY5M1x1NTE2NXxcdTdCNDlcdTVGODUpW1xcdTRlMDAtXFx1OWZmZkEtWmEtejAtOSN7fT17e319XFxzXy1dKiQvdSxcclxuICAgICAgJycsXHJcbiAgICApLnRyaW0oKVxyXG4gICAgaWYgKCFuYW1lIHx8IG5hbWUuaW5jbHVkZXMoJy4nKSkgY29udGludWVcclxuICAgIGlmICghbWFwLmhhcyhuYW1lKSkgb3JkZXIucHVzaChuYW1lKVxyXG4gICAgbWFwLnNldChuYW1lLCB2YWx1ZSlcclxuICB9XHJcbiAgcmV0dXJuIG9yZGVyLm1hcChuYW1lID0+ICh7IG5hbWUsIHZhbHVlOiBtYXAuZ2V0KG5hbWUpID8/ICcnIH0pKVxyXG59XHJcblxyXG4vKiogRHJvcCBzdGF0aWNcdTMwMENcdTUzQzJcdTY1NzBcdTMwMERzdGVwczsga2VlcFx1MzAwQ1x1NTJBOFx1NjAwMVx1NTNDMlx1NjU3MFx1MzAwRGFuZCBldmVyeXRoaW5nIGVsc2UuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBzdHJpcFJlY2lwZVBhcmFtU3RlcHMoY29udGVudDogc3RyaW5nKToge1xyXG4gIGJvZHk6IHN0cmluZ1xyXG4gIHBhcmFtczogUmVjaXBlUGFyYW1LdltdXHJcbn0ge1xyXG4gIGNvbnN0IHN0ZXBzID0gc3BsaXRSZWNpcGVTdGVwcyhjb250ZW50KVxyXG4gIGNvbnN0IHBhcmFtcyA9IGV4dHJhY3RSZWNpcGVQYXJhbXMoY29udGVudClcclxuICAvLyBTdGF0aWNcdTMwMENcdTUzQzJcdTY1NzBcdTMwMERzdHJpcHBlZDtcdTMwMENcdTUyQThcdTYwMDFcdTUzQzJcdTY1NzBcdTMwMERhbmQgYWxsIG90aGVyIHN0ZXBzIGtlcHQuXHJcbiAgY29uc3Qga2VwdCA9IHN0ZXBzLmZpbHRlcihzdGVwID0+IHtcclxuICAgIGlmIChzdGVwLnN0YXJ0c1dpdGgoJ1x1NTJBOFx1NjAwMVx1NTNDMlx1NjU3MCcpKSByZXR1cm4gdHJ1ZVxyXG4gICAgaWYgKHN0ZXAuc3RhcnRzV2l0aCgnXHU1M0MyXHU2NTcwJykpIHJldHVybiBmYWxzZVxyXG4gICAgcmV0dXJuIHRydWVcclxuICB9KVxyXG4gIHJldHVybiB7IGJvZHk6IGtlcHQuam9pbignXHVGRjBDJyksIHBhcmFtcyB9XHJcbn1cclxuXHJcbi8qKiBSZXdyaXRlIGNvbnRlbnQ6IHByZWZpeCBtZXJnZWQgYFx1NTNDMlx1NjU3MFx1NTQwRD1cdTUwM0NgIHRoZW4gYm9keSB3aXRob3V0IG9sZCBzdGF0aWMgcGFyYW1zLiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gbWVyZ2VQYXJhbXNJbnRvQ29udGVudChcclxuICBjb250ZW50OiBzdHJpbmcsXHJcbiAgZW50cmllczogcmVhZG9ubHkgUmVjaXBlUGFyYW1LdltdLFxyXG4pOiBzdHJpbmcge1xyXG4gIGNvbnN0IHsgYm9keSB9ID0gc3RyaXBSZWNpcGVQYXJhbVN0ZXBzKGNvbnRlbnQpXHJcbiAgY29uc3QgY2xlYW5lZCA9IGVudHJpZXNcclxuICAgIC5tYXAoZSA9PiAoeyBuYW1lOiBlLm5hbWUudHJpbSgpLCB2YWx1ZTogZS52YWx1ZSB9KSlcclxuICAgIC5maWx0ZXIoZSA9PiBlLm5hbWUgIT09ICcnKVxyXG4gIGlmIChjbGVhbmVkLmxlbmd0aCA9PT0gMCkgcmV0dXJuIGJvZHlcclxuICBjb25zdCBwcmVmaXggPSBjbGVhbmVkLm1hcChlID0+IGBcdTUzQzJcdTY1NzAke2UubmFtZX09JHtlLnZhbHVlfWApLmpvaW4oJ1x1RkYwQycpXHJcbiAgaWYgKCFib2R5LnRyaW0oKSkgcmV0dXJuIHByZWZpeFxyXG4gIHJldHVybiBgJHtwcmVmaXh9XHVGRjBDJHtib2R5fWBcclxufVxyXG5cclxuLyoqXHJcbiAqIElmIGEgYmFkIHNwbGl0IG9uY2UgZ2x1ZWQgYFx1NzY3Qlx1NUY1NVx1MjAyNmAgaW50byBhIFx1NTNDMlx1NjU3MCB2YWx1ZSBhbmQgdGhlbiBzdHJpcHBlZCBpdCxcclxuICogcmVjb3ZlciBsb2dpbiAoYW5kIGZvbGxvd2luZykgc3RlcHMgZnJvbSB0aGUgcmF3IHJlY2lwZS5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiByZWNvdmVyTG9zdEFjdGlvblN0ZXBzKFxyXG4gIHJhd0NvbnRlbnQ6IHN0cmluZyxcclxuICBtZXJnZWRDb250ZW50OiBzdHJpbmcsXHJcbik6IHN0cmluZyB7XHJcbiAgY29uc3QgcmF3U3RlcHMgPSBzcGxpdFJlY2lwZVN0ZXBzKHJhd0NvbnRlbnQpXHJcbiAgY29uc3QgbWVyZ2VkU3RlcHMgPSBzcGxpdFJlY2lwZVN0ZXBzKG1lcmdlZENvbnRlbnQpXHJcbiAgY29uc3QgcmF3QWN0aW9ucyA9IHJhd1N0ZXBzLmZpbHRlcihcclxuICAgIHMgPT4gIXMuc3RhcnRzV2l0aCgnXHU1M0MyXHU2NTcwJykgfHwgcy5zdGFydHNXaXRoKCdcdTUyQThcdTYwMDFcdTUzQzJcdTY1NzAnKSxcclxuICApXHJcbiAgY29uc3QgbWVyZ2VkQWN0aW9ucyA9IG1lcmdlZFN0ZXBzLmZpbHRlcihcclxuICAgIHMgPT4gIXMuc3RhcnRzV2l0aCgnXHU1M0MyXHU2NTcwJykgfHwgcy5zdGFydHNXaXRoKCdcdTUyQThcdTYwMDFcdTUzQzJcdTY1NzAnKSxcclxuICApXHJcbiAgY29uc3QgcmF3SGFzTG9naW4gPSByYXdBY3Rpb25zLnNvbWUocyA9PiBzLnN0YXJ0c1dpdGgoJ1x1NzY3Qlx1NUY1NScpKVxyXG4gIGNvbnN0IG1lcmdlZEhhc0xvZ2luID0gbWVyZ2VkQWN0aW9ucy5zb21lKHMgPT4gcy5zdGFydHNXaXRoKCdcdTc2N0JcdTVGNTUnKSlcclxuICBpZiAoIXJhd0hhc0xvZ2luIHx8IG1lcmdlZEhhc0xvZ2luKSByZXR1cm4gbWVyZ2VkQ29udGVudFxyXG4gIGNvbnN0IHBhcmFtcyA9IGV4dHJhY3RSZWNpcGVQYXJhbXMobWVyZ2VkQ29udGVudClcclxuICBjb25zdCBwcmVmaXggPVxyXG4gICAgcGFyYW1zLmxlbmd0aCA+IDBcclxuICAgICAgPyBwYXJhbXMubWFwKHAgPT4gYFx1NTNDMlx1NjU3MCR7cC5uYW1lfT0ke3AudmFsdWV9YCkuam9pbignXHVGRjBDJykgKyAnXHVGRjBDJ1xyXG4gICAgICA6ICcnXHJcbiAgcmV0dXJuIGAke3ByZWZpeH0ke3Jhd0FjdGlvbnMuam9pbignXHVGRjBDJyl9YFxyXG59XHJcblxyXG4vKipcclxuICogQXBwbHkgb3ZlcnJpZGVzIG9udG8gZGVjbGFyZWQgcGFyYW1zIChkZWNsYXJlZCBvcmRlciBwcmVzZXJ2ZWQ7IG5ldyBrZXlzIGFwcGVuZGVkKS5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBhcHBseVBhcmFtT3ZlcnJpZGVzKFxyXG4gIGNvbnRlbnQ6IHN0cmluZyxcclxuICBvdmVycmlkZXM/OiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHwgbnVsbCxcclxuKTogeyBjb250ZW50OiBzdHJpbmc7IHBhcmFtczogUmVjaXBlUGFyYW1LdltdIH0ge1xyXG4gIGNvbnN0IGJhc2UgPSBleHRyYWN0UmVjaXBlUGFyYW1zKGNvbnRlbnQpXHJcbiAgY29uc3QgbWFwID0gbmV3IE1hcChiYXNlLm1hcChwID0+IFtwLm5hbWUsIHAudmFsdWVdKSlcclxuICBpZiAob3ZlcnJpZGVzKSB7XHJcbiAgICBmb3IgKGNvbnN0IFtyYXdLZXksIHJhd1ZhbF0gb2YgT2JqZWN0LmVudHJpZXMob3ZlcnJpZGVzKSkge1xyXG4gICAgICBjb25zdCBuYW1lID0gcmF3S2V5LnRyaW0oKVxyXG4gICAgICBpZiAoIW5hbWUpIGNvbnRpbnVlXHJcbiAgICAgIG1hcC5zZXQobmFtZSwgU3RyaW5nKHJhd1ZhbCA/PyAnJykpXHJcbiAgICB9XHJcbiAgfVxyXG4gIGNvbnN0IHBhcmFtczogUmVjaXBlUGFyYW1LdltdID0gW11cclxuICBjb25zdCBzZWVuID0gbmV3IFNldDxzdHJpbmc+KClcclxuICBmb3IgKGNvbnN0IHAgb2YgYmFzZSkge1xyXG4gICAgcGFyYW1zLnB1c2goeyBuYW1lOiBwLm5hbWUsIHZhbHVlOiBtYXAuZ2V0KHAubmFtZSkgPz8gcC52YWx1ZSB9KVxyXG4gICAgc2Vlbi5hZGQocC5uYW1lKVxyXG4gIH1cclxuICBpZiAob3ZlcnJpZGVzKSB7XHJcbiAgICBmb3IgKGNvbnN0IHJhd0tleSBvZiBPYmplY3Qua2V5cyhvdmVycmlkZXMpKSB7XHJcbiAgICAgIGNvbnN0IG5hbWUgPSByYXdLZXkudHJpbSgpXHJcbiAgICAgIGlmICghbmFtZSB8fCBzZWVuLmhhcyhuYW1lKSkgY29udGludWVcclxuICAgICAgcGFyYW1zLnB1c2goeyBuYW1lLCB2YWx1ZTogbWFwLmdldChuYW1lKSA/PyAnJyB9KVxyXG4gICAgICBzZWVuLmFkZChuYW1lKVxyXG4gICAgfVxyXG4gIH1cclxuICBjb25zdCBtZXJnZWQgPSBtZXJnZVBhcmFtc0ludG9Db250ZW50KGNvbnRlbnQsIHBhcmFtcylcclxuICByZXR1cm4ge1xyXG4gICAgY29udGVudDogcmVjb3Zlckxvc3RBY3Rpb25TdGVwcyhjb250ZW50LCBtZXJnZWQpLFxyXG4gICAgcGFyYW1zLFxyXG4gIH1cclxufVxyXG5cclxuLyoqIEJ1aWx0LWluIGR5bmFtaWMgcGxhY2Vob2xkZXJzIFx1MjAxNCBub3QgdXNlci1lZGl0YWJsZSBydW4gcGFyYW1zLiAqL1xyXG5jb25zdCBCVUlMVElOX1BMQUNFSE9MREVSUyA9IG5ldyBTZXQoW1xyXG4gICdcdTk4NzVcdTdCN0VcdTU3MzBcdTU3NDAnLFxyXG4gICdcdTk4NzVcdTdCN0VcdTY4MDdcdTk4OTgnLFxyXG4gICdcdTUyNkFcdTUyMDdcdTY3N0YnLFxyXG4gICdcdTVGNTNcdTUyNERcdTY1RjZcdTk1RjQnLFxyXG4gICdcdTVGNTNcdTUyNERcdTY1RTVcdTY3MUYnLFxyXG5dKVxyXG5cclxuLyoqXHJcbiAqIENvbGxlY3QgYHt7XHU1NDBEXHU3OUYwfX1gIHBsYWNlaG9sZGVycyB0aGF0IG5lZWQgdXNlciBjb25maXJtYXRpb25cclxuICogKGV4Y2x1ZGVzIGJ1aWx0aW5zIGxpa2UgXHU5ODc1XHU3QjdFXHU1NzMwXHU1NzQwKS5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBleHRyYWN0TXVzdGFjaGVQYXJhbXMoY29udGVudDogc3RyaW5nKTogc3RyaW5nW10ge1xyXG4gIGNvbnN0IG9yZGVyOiBzdHJpbmdbXSA9IFtdXHJcbiAgY29uc3Qgc2VlbiA9IG5ldyBTZXQ8c3RyaW5nPigpXHJcbiAgY29uc3QgcmUgPSAvXFx7XFx7XFxzKihbXnt9XSs/KVxccypcXH1cXH0vZ1xyXG4gIGxldCBtOiBSZWdFeHBFeGVjQXJyYXkgfCBudWxsXHJcbiAgd2hpbGUgKChtID0gcmUuZXhlYyhjb250ZW50KSkgIT09IG51bGwpIHtcclxuICAgIGNvbnN0IG5hbWUgPSAobVsxXSA/PyAnJykudHJpbSgpXHJcbiAgICBpZiAoIW5hbWUgfHwgbmFtZS5pbmNsdWRlcygnLicpIHx8IEJVSUxUSU5fUExBQ0VIT0xERVJTLmhhcyhuYW1lKSkgY29udGludWVcclxuICAgIGlmIChzZWVuLmhhcyhuYW1lKSkgY29udGludWVcclxuICAgIHNlZW4uYWRkKG5hbWUpXHJcbiAgICBvcmRlci5wdXNoKG5hbWUpXHJcbiAgfVxyXG4gIHJldHVybiBvcmRlclxyXG59XHJcblxyXG4vKipcclxuICogUGFyYW1zIHRoZSBIb3N0IG11c3QgY29uZmlybSBiZWZvcmUgYnJvd3NlciBzdGFydDpcclxuICogZGVjbGFyZWQgYFx1NTNDMlx1NjU3MFx1NTQwRD1cdTUwM0NgLCByZW1haW5pbmcgYHt7XHU1NDBEfX1gLCBhbmQgZXhwbGljaXQgdG9vbCBgcGFyYW1zYCBrZXlzLlxyXG4gKi9cclxuZXhwb3J0IGZ1bmN0aW9uIGNvbGxlY3RDb25maXJtYWJsZVBhcmFtcyhcclxuICBjb250ZW50OiBzdHJpbmcsXHJcbiAgb3ZlcnJpZGVzPzogUmVjb3JkPHN0cmluZywgc3RyaW5nPiB8IG51bGwsXHJcbik6IFJlY2lwZVBhcmFtS3ZbXSB7XHJcbiAgY29uc3QgZGVjbGFyZWQgPSBleHRyYWN0UmVjaXBlUGFyYW1zKGNvbnRlbnQpXHJcbiAgY29uc3QgbWFwID0gbmV3IE1hcChkZWNsYXJlZC5tYXAocCA9PiBbcC5uYW1lLCBwLnZhbHVlXSkpXHJcbiAgY29uc3Qgb3JkZXIgPSBkZWNsYXJlZC5tYXAocCA9PiBwLm5hbWUpXHJcbiAgY29uc3Qgc2VlbiA9IG5ldyBTZXQob3JkZXIpXHJcblxyXG4gIGZvciAoY29uc3QgbmFtZSBvZiBleHRyYWN0TXVzdGFjaGVQYXJhbXMoY29udGVudCkpIHtcclxuICAgIGlmIChzZWVuLmhhcyhuYW1lKSkgY29udGludWVcclxuICAgIHNlZW4uYWRkKG5hbWUpXHJcbiAgICBvcmRlci5wdXNoKG5hbWUpXHJcbiAgICBtYXAuc2V0KG5hbWUsIG92ZXJyaWRlcz8uW25hbWVdID8/ICcnKVxyXG4gIH1cclxuXHJcbiAgaWYgKG92ZXJyaWRlcykge1xyXG4gICAgZm9yIChjb25zdCByYXdLZXkgb2YgT2JqZWN0LmtleXMob3ZlcnJpZGVzKSkge1xyXG4gICAgICBjb25zdCBuYW1lID0gcmF3S2V5LnRyaW0oKVxyXG4gICAgICBpZiAoIW5hbWUgfHwgc2Vlbi5oYXMobmFtZSkpIGNvbnRpbnVlXHJcbiAgICAgIHNlZW4uYWRkKG5hbWUpXHJcbiAgICAgIG9yZGVyLnB1c2gobmFtZSlcclxuICAgICAgbWFwLnNldChuYW1lLCBTdHJpbmcob3ZlcnJpZGVzW3Jhd0tleV0gPz8gJycpKVxyXG4gICAgfVxyXG4gICAgZm9yIChjb25zdCBbaywgdl0gb2YgT2JqZWN0LmVudHJpZXMob3ZlcnJpZGVzKSkge1xyXG4gICAgICBjb25zdCBuYW1lID0gay50cmltKClcclxuICAgICAgaWYgKCFuYW1lKSBjb250aW51ZVxyXG4gICAgICBtYXAuc2V0KG5hbWUsIFN0cmluZyh2ID8/ICcnKSlcclxuICAgIH1cclxuICB9XHJcblxyXG4gIHJldHVybiBvcmRlci5tYXAobmFtZSA9PiAoeyBuYW1lLCB2YWx1ZTogbWFwLmdldChuYW1lKSA/PyAnJyB9KSlcclxufVxyXG5cclxuLyoqIFBhcnNlIHRvb2wgYHBhcmFtc2AgYXJnOiBKU09OIG9iamVjdCBzdHJpbmcgb3IgYWxyZWFkeS1wbGFpbiByZWNvcmQuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVBhcmFtc0FyZyhyYXc6IHVua25vd24pOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+IHwgdW5kZWZpbmVkIHtcclxuICBpZiAocmF3ID09IG51bGwgfHwgcmF3ID09PSAnJykgcmV0dXJuIHVuZGVmaW5lZFxyXG4gIGlmICh0eXBlb2YgcmF3ID09PSAnb2JqZWN0JyAmJiAhQXJyYXkuaXNBcnJheShyYXcpKSB7XHJcbiAgICBjb25zdCBvdXQ6IFJlY29yZDxzdHJpbmcsIHN0cmluZz4gPSB7fVxyXG4gICAgZm9yIChjb25zdCBbaywgdl0gb2YgT2JqZWN0LmVudHJpZXMocmF3IGFzIFJlY29yZDxzdHJpbmcsIHVua25vd24+KSkge1xyXG4gICAgICBpZiAodHlwZW9mIGsgPT09ICdzdHJpbmcnICYmIGsudHJpbSgpKSBvdXRbay50cmltKCldID0gU3RyaW5nKHYgPz8gJycpXHJcbiAgICB9XHJcbiAgICByZXR1cm4gT2JqZWN0LmtleXMob3V0KS5sZW5ndGggPyBvdXQgOiB1bmRlZmluZWRcclxuICB9XHJcbiAgaWYgKHR5cGVvZiByYXcgIT09ICdzdHJpbmcnKSByZXR1cm4gdW5kZWZpbmVkXHJcbiAgY29uc3QgdGV4dCA9IHJhdy50cmltKClcclxuICBpZiAoIXRleHQpIHJldHVybiB1bmRlZmluZWRcclxuICB0cnkge1xyXG4gICAgY29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZSh0ZXh0KSBhcyB1bmtub3duXHJcbiAgICByZXR1cm4gcGFyc2VQYXJhbXNBcmcocGFyc2VkKVxyXG4gIH0gY2F0Y2gge1xyXG4gICAgdGhyb3cgbmV3IEVycm9yKGBwYXJhbXMgbXVzdCBiZSBhIEpTT04gb2JqZWN0IHN0cmluZywgZ290OiAke3RleHQuc2xpY2UoMCwgMTIwKX1gKVxyXG4gIH1cclxufVxyXG4iLCAiLyoqXHJcbiAqIEluLWNoYXQgdG9vbCBjYXJkIGZvciB3ZWJjbGF3X3J1bjogd2hpbGUgcGVuZGluZywgcG9sbCBsaXZlIHN0ZXAgbG9ncy5cclxuICovXHJcbmltcG9ydCB7IHVzZUVmZmVjdCwgdXNlUmVmLCB1c2VTdGF0ZSwgdHlwZSBSZWFjdE5vZGUgfSBmcm9tICdyZWFjdCdcclxuaW1wb3J0IHR5cGUgeyBQcm9wc0xvY2FsZSB9IGZyb20gJ0BkZWVwc2Vlay1haS9kc2gtY2xpZW50LXVpLXNsb3RzJ1xyXG5pbXBvcnQgeyBMaXZlUHJldmlld0ltYWdlIH0gZnJvbSAnLi9MaXZlUHJldmlld0ltYWdlLmpzJ1xyXG5pbXBvcnQgeyByZXF1ZXN0T3BlbkxpdmUgfSBmcm9tICcuL2xpdmUtb3Blbi50cydcclxuXHJcbmNvbnN0IENBTkRJREFURV9QT1JUUyA9IFsxOTIyOSwgMTkyMzAsIDE5MjMxLCAxOTIzMiwgMTkyMzNdXHJcblxyXG50eXBlIFBoYXNlID0gJ3ByZXBhcmluZycgfCAnc3RhcnQnIHwgJ3Jlc3VsdCdcclxuXHJcbnR5cGUgQmxvY2sgPSB7XHJcbiAgY29udGVudD86IHJlYWRvbmx5IHsgdHlwZTogc3RyaW5nOyB0ZXh0Pzogc3RyaW5nIH1bXVxyXG4gIG1ldGE/OiB1bmtub3duXHJcbiAgaXNFcnJvcj86IGJvb2xlYW5cclxuICBhcmdzUmF3Pzogc3RyaW5nXHJcbiAgY2FsbD86IHsgbmFtZTogc3RyaW5nOyBhcmdzUmF3OiBzdHJpbmcgfSB8IG51bGxcclxuICBlcnJvcj86IHsgbmFtZTogc3RyaW5nOyBjb2RlOiBzdHJpbmc7IHJlYXNvbj86IHN0cmluZyB9XHJcbn1cclxuXHJcbmV4cG9ydCB0eXBlIFdlYmNsYXdSdW5Ub29sdmlld1Byb3BzID0gUHJvcHNMb2NhbGU8J3dlYmNsYXdSdW5Ub29sJz4gJiB7XHJcbiAgdG9vbE5hbWU6IHN0cmluZ1xyXG4gIHBoYXNlOiBQaGFzZVxyXG4gIGJsb2NrOiBCbG9ja1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBmaW5kQmFzZSgpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcclxuICBmb3IgKGNvbnN0IHBvcnQgb2YgQ0FORElEQVRFX1BPUlRTKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBjdHJsID0gbmV3IEFib3J0Q29udHJvbGxlcigpXHJcbiAgICAgIGNvbnN0IHRpbWVyID0gc2V0VGltZW91dCgoKSA9PiBjdHJsLmFib3J0KCksIDQwMClcclxuICAgICAgY29uc3QgcmVzID0gYXdhaXQgZmV0Y2goYGh0dHA6Ly8xMjcuMC4wLjE6JHtwb3J0fS9hcGkvaGVhbHRoYCwge1xyXG4gICAgICAgIHNpZ25hbDogY3RybC5zaWduYWwsXHJcbiAgICAgIH0pXHJcbiAgICAgIGNsZWFyVGltZW91dCh0aW1lcilcclxuICAgICAgaWYgKCFyZXMub2spIGNvbnRpbnVlXHJcbiAgICAgIGNvbnN0IGogPSAoYXdhaXQgcmVzLmpzb24oKSkgYXMgeyBvaz86IGJvb2xlYW47IHNlcnZpY2U/OiBzdHJpbmcgfVxyXG4gICAgICBpZiAoai5vayAmJiBqLnNlcnZpY2UgPT09ICd3ZWJjbGF3LWFjY291bnRzLXVpJykge1xyXG4gICAgICAgIHJldHVybiBgaHR0cDovLzEyNy4wLjAuMToke3BvcnR9YFxyXG4gICAgICB9XHJcbiAgICB9IGNhdGNoIHtcclxuICAgICAgLyogbmV4dCAqL1xyXG4gICAgfVxyXG4gIH1cclxuICByZXR1cm4gbnVsbFxyXG59XHJcblxyXG5mdW5jdGlvbiB0ZXh0RnJvbVJlc3VsdChibG9jazogQmxvY2spOiBzdHJpbmcge1xyXG4gIGNvbnN0IHBhcnRzID0gKGJsb2NrLmNvbnRlbnQgPz8gW10pXHJcbiAgICAuZmlsdGVyKGIgPT4gYi50eXBlID09PSAndGV4dCcgJiYgYi50ZXh0KVxyXG4gICAgLm1hcChiID0+IGIudGV4dCEudHJpbSgpKVxyXG4gICAgLmZpbHRlcihCb29sZWFuKVxyXG4gIHJldHVybiBwYXJ0cy5qb2luKCdcXG4nKS50cmltKClcclxufVxyXG5cclxuZnVuY3Rpb24gc3VtbWFyaXplUmVzdWx0KHRleHQ6IHN0cmluZywgdDogV2ViY2xhd1J1blRvb2x2aWV3UHJvcHNbJ3QnXSk6IHN0cmluZyB7XHJcbiAgaWYgKC9ORUVEX0hVTUFOfG5lZWRIdW1hbnxcdTk3MDBcdTg5ODFcdTlBOENcdThCQzFcdTc4MDF8XHU5NzAwXHU4OTgxXHU0RUJBXHU1REU1L2kudGVzdCh0ZXh0KSkgcmV0dXJuIHQoJ25lZWRIdW1hbicpXHJcbiAgaWYgKC9jYW5jZWxsZWR8XHU1REYyXHU1M0Q2XHU2RDg4fFJVTl9DQU5DRUxMRUQvaS50ZXN0KHRleHQpKSByZXR1cm4gdCgnY2FuY2VsbGVkJylcclxuICBpZiAoL3dlYmNsYXdfcnVuOlxccypva1xcYnxeb2tcXGIvaW0udGVzdCh0ZXh0KSB8fCAvXFxib2tcXGIuKnJ1bl9kaXIvaS50ZXN0KHRleHQpKSB7XHJcbiAgICByZXR1cm4gdCgnZG9uZScpXHJcbiAgfVxyXG4gIGlmICgvd2ViY2xhd19ydW46XFxzKmZhaWxlZHxmYWlsZWR8ZXJyb3I6L2kudGVzdCh0ZXh0KSkgcmV0dXJuIHQoJ2ZhaWxlZCcpXHJcbiAgcmV0dXJuIHQoJ2RvbmUnKVxyXG59XHJcblxyXG4vKipcclxuICogUGVuZGluZzogbGl2ZSBsb2cgcG9sbC4gUmVzdWx0OiBrZWVwIGEgc2hvcnQgbG9nIHBhbmVsIGZyb20gcmVzdWx0IHRleHQuXHJcbiAqL1xyXG5leHBvcnQgZnVuY3Rpb24gV2ViY2xhd1J1blRvb2x2aWV3KHtcclxuICBwaGFzZSxcclxuICBibG9jayxcclxuICB0LFxyXG59OiBXZWJjbGF3UnVuVG9vbHZpZXdQcm9wcyk6IFJlYWN0Tm9kZSB7XHJcbiAgY29uc3QgW2xpbmVzLCBzZXRMaW5lc10gPSB1c2VTdGF0ZTxzdHJpbmdbXT4oW10pXHJcbiAgY29uc3QgW2Jhc2VPaywgc2V0QmFzZU9rXSA9IHVzZVN0YXRlKHRydWUpXHJcbiAgY29uc3QgW2ltZ1VybCwgc2V0SW1nVXJsXSA9IHVzZVN0YXRlKCcnKVxyXG4gIGNvbnN0IHNjcm9sbGVyID0gdXNlUmVmPEhUTUxEaXZFbGVtZW50IHwgbnVsbD4obnVsbClcclxuICBjb25zdCBvcGVuZWRSdW5EaXIgPSB1c2VSZWYoJycpXHJcbiAgY29uc3QgcGVuZGluZyA9IHBoYXNlID09PSAncHJlcGFyaW5nJyB8fCBwaGFzZSA9PT0gJ3N0YXJ0J1xyXG5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKCFwZW5kaW5nKSByZXR1cm5cclxuICAgIGxldCBjYW5jZWxsZWQgPSBmYWxzZVxyXG4gICAgbGV0IGJhc2U6IHN0cmluZyB8IG51bGwgPSBudWxsXHJcbiAgICBjb25zdCB0aWNrID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgICBpZiAoIWJhc2UpIGJhc2UgPSBhd2FpdCBmaW5kQmFzZSgpXHJcbiAgICAgIGlmIChjYW5jZWxsZWQpIHJldHVyblxyXG4gICAgICBpZiAoIWJhc2UpIHtcclxuICAgICAgICBzZXRCYXNlT2soZmFsc2UpXHJcbiAgICAgICAgcmV0dXJuXHJcbiAgICAgIH1cclxuICAgICAgc2V0QmFzZU9rKHRydWUpXHJcbiAgICAgIHRyeSB7XHJcbiAgICAgICAgY29uc3QgW2xvZ1JlcywgZm9jdXNSZXNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xyXG4gICAgICAgICAgZmV0Y2goYCR7YmFzZX0vYXBpL2xpdmUvbG9nYCksXHJcbiAgICAgICAgICBmZXRjaChgJHtiYXNlfS9hcGkvbGl2ZS9mb2N1c2ApLFxyXG4gICAgICAgIF0pXHJcbiAgICAgICAgY29uc3QgaiA9IChhd2FpdCBsb2dSZXMuanNvbigpKSBhcyB7XHJcbiAgICAgICAgICBvaz86IGJvb2xlYW5cclxuICAgICAgICAgIGxpbmVzPzogc3RyaW5nW11cclxuICAgICAgICAgIHJ1bkRpcj86IHN0cmluZ1xyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBmb2N1c0pzb24gPSAoYXdhaXQgZm9jdXNSZXMuanNvbigpKSBhcyB7XHJcbiAgICAgICAgICBvaz86IGJvb2xlYW5cclxuICAgICAgICAgIGZvY3VzPzogeyBydW5EaXI/OiBzdHJpbmcgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIWNhbmNlbGxlZCAmJiBqLm9rICYmIEFycmF5LmlzQXJyYXkoai5saW5lcykpIHtcclxuICAgICAgICAgIHNldExpbmVzKGoubGluZXMuc2xpY2UoLTYwKSlcclxuICAgICAgICB9XHJcbiAgICAgICAgY29uc3QgcnVuRGlyID1cclxuICAgICAgICAgIGoucnVuRGlyPy50cmltKCkgfHwgZm9jdXNKc29uLmZvY3VzPy5ydW5EaXI/LnRyaW0oKSB8fCAnJ1xyXG4gICAgICAgIC8vIFNlc3Npb24tc2NvcGVkIHRvb2wgY2FyZCBpcyB0aGUgbW9zdCByZWxpYWJsZSBtb21lbnQgdG8gb3BlbiB0aGUgcmlnaHQgcmFpbC5cclxuICAgICAgICBpZiAocnVuRGlyICYmIHJ1bkRpciAhPT0gb3BlbmVkUnVuRGlyLmN1cnJlbnQpIHtcclxuICAgICAgICAgIG9wZW5lZFJ1bkRpci5jdXJyZW50ID0gcnVuRGlyXHJcbiAgICAgICAgICByZXF1ZXN0T3BlbkxpdmUocnVuRGlyKVxyXG4gICAgICAgIH1cclxuICAgICAgICAvLyBGb2xsb3cgbGl2ZS1wcmV2aWV3L3RpbWVsaW5lIG9ubHkgKHJlYWwgcGFnZSBzaG90cyBcdTIwMTQgbmV2ZXIgY2FwdGNoYSBjcm9wKS5cclxuICAgICAgICBpZiAoIXJ1bkRpcikge1xyXG4gICAgICAgICAgaWYgKCFjYW5jZWxsZWQpIHNldEltZ1VybCgnJylcclxuICAgICAgICAgIHJldHVyblxyXG4gICAgICAgIH1cclxuICAgICAgICBjb25zdCBtZXRhUmVzID0gYXdhaXQgZmV0Y2goXHJcbiAgICAgICAgICBgJHtiYXNlfS9hcGkvbGl2ZS9tZXRhP3J1bkRpcj0ke2VuY29kZVVSSUNvbXBvbmVudChydW5EaXIpfSZ0PSR7RGF0ZS5ub3coKX1gLFxyXG4gICAgICAgICAgeyBjYWNoZTogJ25vLXN0b3JlJyB9LFxyXG4gICAgICAgICkuY2F0Y2goKCkgPT4gbnVsbClcclxuICAgICAgICBsZXQgbmV4dFVybCA9ICcnXHJcbiAgICAgICAgaWYgKG1ldGFSZXM/Lm9rKSB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBtZXRhSnNvbiA9IChhd2FpdCBtZXRhUmVzLmpzb24oKSkgYXMge1xyXG4gICAgICAgICAgICAgIG9rPzogYm9vbGVhblxyXG4gICAgICAgICAgICAgIGhhc1BuZz86IGJvb2xlYW5cclxuICAgICAgICAgICAgICBsYXRlc3RJZD86IG51bWJlciB8IG51bGxcclxuICAgICAgICAgICAgICBtZXRhPzogeyB1cGRhdGVkQXQ/OiBzdHJpbmcgfVxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIGlmIChtZXRhSnNvbi5vayAmJiBtZXRhSnNvbi5oYXNQbmcpIHtcclxuICAgICAgICAgICAgICBjb25zdCBsYXRlc3QgPVxyXG4gICAgICAgICAgICAgICAgdHlwZW9mIG1ldGFKc29uLmxhdGVzdElkID09PSAnbnVtYmVyJyA/IG1ldGFKc29uLmxhdGVzdElkIDogbnVsbFxyXG4gICAgICAgICAgICAgIGNvbnN0IGJ1c3QgPSBtZXRhSnNvbi5tZXRhPy51cGRhdGVkQXQgfHwgbGF0ZXN0IHx8IERhdGUubm93KClcclxuICAgICAgICAgICAgICBjb25zdCBxID0gbmV3IFVSTFNlYXJjaFBhcmFtcyh7IHJ1bkRpciwgdDogU3RyaW5nKGJ1c3QpIH0pXHJcbiAgICAgICAgICAgICAgaWYgKGxhdGVzdCAhPSBudWxsKSBxLnNldCgnZnJhbWUnLCBTdHJpbmcobGF0ZXN0KSlcclxuICAgICAgICAgICAgICBuZXh0VXJsID0gYCR7YmFzZX0vYXBpL2xpdmUvcG5nPyR7cS50b1N0cmluZygpfWBcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICAgIG5leHRVcmwgPSAnJ1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBpZiAoIWNhbmNlbGxlZCkgc2V0SW1nVXJsKG5leHRVcmwpXHJcbiAgICAgIH0gY2F0Y2gge1xyXG4gICAgICAgIGJhc2UgPSBudWxsXHJcbiAgICAgICAgaWYgKCFjYW5jZWxsZWQpIHtcclxuICAgICAgICAgIHNldEJhc2VPayhmYWxzZSlcclxuICAgICAgICAgIHNldEltZ1VybCgnJylcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICAgIHZvaWQgdGljaygpXHJcbiAgICBjb25zdCBpZCA9IHdpbmRvdy5zZXRJbnRlcnZhbCgoKSA9PiB7XHJcbiAgICAgIHZvaWQgdGljaygpXHJcbiAgICB9LCA3MDApXHJcbiAgICByZXR1cm4gKCkgPT4ge1xyXG4gICAgICBjYW5jZWxsZWQgPSB0cnVlXHJcbiAgICAgIHdpbmRvdy5jbGVhckludGVydmFsKGlkKVxyXG4gICAgfVxyXG4gIH0sIFtwZW5kaW5nXSlcclxuXHJcbiAgdXNlRWZmZWN0KCgpID0+IHtcclxuICAgIGNvbnN0IGVsID0gc2Nyb2xsZXIuY3VycmVudFxyXG4gICAgaWYgKCFlbCkgcmV0dXJuXHJcbiAgICBlbC5zY3JvbGxUb3AgPSBlbC5zY3JvbGxIZWlnaHRcclxuICB9LCBbbGluZXNdKVxyXG5cclxuICB1c2VFZmZlY3QoKCkgPT4ge1xyXG4gICAgaWYgKHBlbmRpbmcpIHJldHVyblxyXG4gICAgY29uc3QgdGV4dCA9IHRleHRGcm9tUmVzdWx0KGJsb2NrKVxyXG4gICAgaWYgKCF0ZXh0KSByZXR1cm5cclxuICAgIGNvbnN0IGV4dHJhY3RlZCA9IHRleHRcclxuICAgICAgLnNwbGl0KC9cXHI/XFxuLylcclxuICAgICAgLm1hcChzID0+IHMudHJpbSgpKVxyXG4gICAgICAuZmlsdGVyKHMgPT4gcyAmJiAhcy5zdGFydHNXaXRoKCd7JykgJiYgIS9ecmVjaXBlUGF0aDp8XnJ1bl9kaXI6fF5lcnJvcjokL2kudGVzdChzKSlcclxuICAgICAgLnNsaWNlKC00MClcclxuICAgIGlmIChleHRyYWN0ZWQubGVuZ3RoID4gMCkgc2V0TGluZXMoZXh0cmFjdGVkKVxyXG4gIH0sIFtwZW5kaW5nLCBibG9ja10pXHJcblxyXG4gIGNvbnN0IGhlYWRlciA9IHBlbmRpbmdcclxuICAgID8gdCgncGVuZGluZycpXHJcbiAgICA6IGJsb2NrLmlzRXJyb3JcclxuICAgICAgPyB0KCdmYWlsZWQnKVxyXG4gICAgICA6IHN1bW1hcml6ZVJlc3VsdCh0ZXh0RnJvbVJlc3VsdChibG9jayksIHQpXHJcblxyXG4gIHJldHVybiAoXHJcbiAgICA8ZGl2XHJcbiAgICAgIGRhdGEtd2ViY2xhdy1ydW4tdG9vbHZpZXc9XCJcIlxyXG4gICAgICBzdHlsZT17e1xyXG4gICAgICAgIG1hcmdpblRvcDogNixcclxuICAgICAgICBib3JkZXJSYWRpdXM6IDgsXHJcbiAgICAgICAgYm9yZGVyOiAnMXB4IHNvbGlkIGNvbG9yLW1peChpbiBzcmdiLCBjdXJyZW50Q29sb3IgMTQlLCB0cmFuc3BhcmVudCknLFxyXG4gICAgICAgIG92ZXJmbG93OiAnaGlkZGVuJyxcclxuICAgICAgICBmb250U2l6ZTogMTIsXHJcbiAgICAgICAgbGluZUhlaWdodDogMS40NSxcclxuICAgICAgfX1cclxuICAgID5cclxuICAgICAgPGRpdlxyXG4gICAgICAgIHN0eWxlPXt7XHJcbiAgICAgICAgICBwYWRkaW5nOiAnOHB4IDEwcHgnLFxyXG4gICAgICAgICAgZm9udFdlaWdodDogNjAwLFxyXG4gICAgICAgICAgYmFja2dyb3VuZDogJ2NvbG9yLW1peChpbiBzcmdiLCBjdXJyZW50Q29sb3IgNiUsIHRyYW5zcGFyZW50KScsXHJcbiAgICAgICAgICBkaXNwbGF5OiAnZmxleCcsXHJcbiAgICAgICAgICBqdXN0aWZ5Q29udGVudDogJ3NwYWNlLWJldHdlZW4nLFxyXG4gICAgICAgICAgZ2FwOiA4LFxyXG4gICAgICAgIH19XHJcbiAgICAgID5cclxuICAgICAgICA8c3Bhbj57aGVhZGVyfTwvc3Bhbj5cclxuICAgICAgICB7cGVuZGluZyA/IChcclxuICAgICAgICAgIDxzcGFuIHN0eWxlPXt7IG9wYWNpdHk6IDAuNTUsIGZvbnRXZWlnaHQ6IDQwMCB9fT5cclxuICAgICAgICAgICAge2Jhc2VPayA/ICdsaXZlJyA6IHQoJ29mZmxpbmUnKX1cclxuICAgICAgICAgIDwvc3Bhbj5cclxuICAgICAgICApIDogbnVsbH1cclxuICAgICAgPC9kaXY+XHJcbiAgICAgIDxkaXZcclxuICAgICAgICBzdHlsZT17e1xyXG4gICAgICAgICAgcGFkZGluZzogJzhweCAxMHB4JyxcclxuICAgICAgICAgIGJvcmRlckJvdHRvbTogJzFweCBzb2xpZCBjb2xvci1taXgoaW4gc3JnYiwgY3VycmVudENvbG9yIDEwJSwgdHJhbnNwYXJlbnQpJyxcclxuICAgICAgICAgIGJhY2tncm91bmQ6ICdjb2xvci1taXgoaW4gc3JnYiwgY3VycmVudENvbG9yIDQlLCB0cmFuc3BhcmVudCknLFxyXG4gICAgICAgIH19XHJcbiAgICAgID5cclxuICAgICAgICA8TGl2ZVByZXZpZXdJbWFnZVxyXG4gICAgICAgICAgc3JjPXtpbWdVcmx9XHJcbiAgICAgICAgICBhbHQ9XCJ3ZWJjbGF3IGxpdmUgcHJldmlld1wiXHJcbiAgICAgICAgICBsYWJlbD17dCgncGxhY2Vob2xkZXInKX1cclxuICAgICAgICAgIG1heEhlaWdodD17MTYwfVxyXG4gICAgICAgIC8+XHJcbiAgICAgIDwvZGl2PlxyXG4gICAgICA8ZGl2XHJcbiAgICAgICAgcmVmPXtzY3JvbGxlcn1cclxuICAgICAgICBzdHlsZT17e1xyXG4gICAgICAgICAgbWF4SGVpZ2h0OiAyMjAsXHJcbiAgICAgICAgICBvdmVyZmxvdzogJ2F1dG8nLFxyXG4gICAgICAgICAgcGFkZGluZzogJzhweCAxMHB4JyxcclxuICAgICAgICAgIGZvbnRGYW1pbHk6ICd1aS1tb25vc3BhY2UsIFNGTW9uby1SZWd1bGFyLCBNZW5sbywgQ29uc29sYXMsIG1vbm9zcGFjZScsXHJcbiAgICAgICAgICB3aGl0ZVNwYWNlOiAncHJlLXdyYXAnLFxyXG4gICAgICAgICAgd29yZEJyZWFrOiAnYnJlYWstd29yZCcsXHJcbiAgICAgICAgICBvcGFjaXR5OiAwLjkyLFxyXG4gICAgICAgIH19XHJcbiAgICAgID5cclxuICAgICAgICB7IWJhc2VPayAmJiBwZW5kaW5nID8gKFxyXG4gICAgICAgICAgPHNwYW4gc3R5bGU9e3sgb3BhY2l0eTogMC42NSB9fT57dCgnb2ZmbGluZScpfTwvc3Bhbj5cclxuICAgICAgICApIDogbGluZXMubGVuZ3RoID09PSAwID8gKFxyXG4gICAgICAgICAgPHNwYW4gc3R5bGU9e3sgb3BhY2l0eTogMC42NSB9fT57dCgnZW1wdHknKX08L3NwYW4+XHJcbiAgICAgICAgKSA6IChcclxuICAgICAgICAgIGxpbmVzLm1hcCgobGluZSwgaSkgPT4gKFxyXG4gICAgICAgICAgICA8ZGl2IGtleT17YCR7aX0tJHtsaW5lLnNsaWNlKDAsIDI0KX1gfT57bGluZX08L2Rpdj5cclxuICAgICAgICAgICkpXHJcbiAgICAgICAgKX1cclxuICAgICAgPC9kaXY+XHJcbiAgICA8L2Rpdj5cclxuICApXHJcbn1cclxuIiwgIi8qKlxyXG4gKiBDbGllbnQgc3VyZmFjZXM6IGAud2ViY2xhd2AgcHJldmlldyArIFNldHRpbmdzIFx1MjE5MiBcdTdGNTFcdTdBRDlcdThEMjZcdTUzRjcgKyBsaXZlIHNpZGViYXIuXHJcbiAqL1xyXG5pbXBvcnQgdHlwZSB7IENvbnRleHQgfSBmcm9tICdAZGVlcHNlZWstYWkvY29yZGlzJ1xyXG5pbXBvcnQgdHlwZSB7fSBmcm9tICdAZGVlcHNlZWstYWkvZHNoLWNsaWVudC11aS1zaWRlYmFyLWRvY3VtZW50cHJldmlldy9jbGllbnQnXHJcbmltcG9ydCB0eXBlIHt9IGZyb20gJ0BkZWVwc2Vlay1haS9kc2gtY2xpZW50LXVpLXNpZGViYXItcmlnaHQvY2xpZW50J1xyXG5pbXBvcnQgdHlwZSB7fSBmcm9tICdAZGVlcHNlZWstYWkvZHNoLWNsaWVudC11aS1zbG90cydcclxuaW1wb3J0IHR5cGUge30gZnJvbSAnLi9zbG90cy1hdWcudHMnXHJcbmltcG9ydCB7IEFjY291bnRzU2V0dGluZ3MgfSBmcm9tICcuL0FjY291bnRzU2V0dGluZ3MudHN4J1xyXG5pbXBvcnQge1xyXG4gIEFDQ09VTlRTX05TLFxyXG4gIGVuIGFzIGFjY291bnRzRW4sXHJcbiAgemggYXMgYWNjb3VudHNaaCxcclxufSBmcm9tICcuL2FjY291bnRzLWxvY2FsZXMudHMnXHJcbmltcG9ydCB7IFdFQkNMQVdfSUNPTl9DU1MgfSBmcm9tICcuL2ljb25zLWNzcy50cydcclxuaW1wb3J0IHsgTElWRV9OUywgZW4gYXMgbGl2ZUVuLCB6aCBhcyBsaXZlWmggfSBmcm9tICcuL2xpdmUtbG9jYWxlcy50cydcclxuaW1wb3J0IHsgZW4sIE5TLCB6aCB9IGZyb20gJy4vbG9jYWxlcy50cydcclxuaW1wb3J0IHtcclxuICBSVU5fVE9PTF9OUyxcclxuICBlbiBhcyBydW5Ub29sRW4sXHJcbiAgemggYXMgcnVuVG9vbFpoLFxyXG59IGZyb20gJy4vcnVuLXRvb2wtbG9jYWxlcy50cydcclxuaW1wb3J0IHsgV2ViY2xhd0xpdmUgfSBmcm9tICcuL1dlYmNsYXdMaXZlLnRzeCdcclxuaW1wb3J0IHtcclxuICBXRUJDTEFXX09QRU5fTElWRV9FVkVOVCxcclxuICB0eXBlIFdlYmNsYXdPcGVuTGl2ZURldGFpbCxcclxufSBmcm9tICcuL2xpdmUtb3Blbi50cydcclxuaW1wb3J0IHsgV2ViY2xhd1ByZXZpZXcgfSBmcm9tICcuL1dlYmNsYXdQcmV2aWV3LnRzeCdcclxuaW1wb3J0IHsgV2ViY2xhd1J1blRvb2x2aWV3IH0gZnJvbSAnLi9XZWJjbGF3UnVuVG9vbHZpZXcudHN4J1xyXG5cclxuLyoqIERvY3VtZW50LXByZXZpZXcgaW1wbGVtZW50YXRpb24gaWQgKHNsb3Qga2V5KS4gKi9cclxuZXhwb3J0IGNvbnN0IFdFQkNMQVdfUFJFVklFV19JRCA9ICdAbG9uazE5ODkvd2ViY2xhdy9yZWNpcGUnXHJcblxyXG4vKiogU2V0dGluZ3Mgc2VjdGlvbiBpZCBmb3Igc2l0ZSBhY2NvdW50cy4gKi9cclxuZXhwb3J0IGNvbnN0IFdFQkNMQVdfQUNDT1VOVFNfU0VDVElPTiA9ICd3ZWJjbGF3LWFjY291bnRzJ1xyXG5cclxuLyoqIExpdmUgc2lkZWJhciB0YWIgaW1wbGVtZW50YXRpb24gaWQuICovXHJcbmV4cG9ydCBjb25zdCBXRUJDTEFXX0xJVkVfSUQgPSAnQGxvbmsxOTg5L3dlYmNsYXcvbGl2ZSdcclxuXHJcbi8qKiBMaXZlIHNpZGViYXIga2luZCAob3BlblRhYiBuYW1lKS4gKi9cclxuZXhwb3J0IGNvbnN0IFdFQkNMQVdfTElWRV9LSU5EID0gJ3dlYmNsYXctbGl2ZSdcclxuXHJcbmNvbnN0IENBTkRJREFURV9QT1JUUyA9IFsxOTIyOSwgMTkyMzAsIDE5MjMxLCAxOTIzMiwgMTkyMzNdXHJcblxyXG5hc3luYyBmdW5jdGlvbiBmaW5kTGl2ZUJhc2UoKTogUHJvbWlzZTxzdHJpbmcgfCBudWxsPiB7XHJcbiAgZm9yIChjb25zdCBwb3J0IG9mIENBTkRJREFURV9QT1JUUykge1xyXG4gICAgdHJ5IHtcclxuICAgICAgY29uc3QgY3RybCA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKVxyXG4gICAgICBjb25zdCB0aW1lciA9IHNldFRpbWVvdXQoKCkgPT4gY3RybC5hYm9ydCgpLCA0MDApXHJcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKGBodHRwOi8vMTI3LjAuMC4xOiR7cG9ydH0vYXBpL2hlYWx0aGAsIHtcclxuICAgICAgICBzaWduYWw6IGN0cmwuc2lnbmFsLFxyXG4gICAgICB9KVxyXG4gICAgICBjbGVhclRpbWVvdXQodGltZXIpXHJcbiAgICAgIGlmICghcmVzLm9rKSBjb250aW51ZVxyXG4gICAgICBjb25zdCBqID0gKGF3YWl0IHJlcy5qc29uKCkpIGFzIHsgb2s/OiBib29sZWFuOyBzZXJ2aWNlPzogc3RyaW5nIH1cclxuICAgICAgaWYgKGoub2sgJiYgai5zZXJ2aWNlID09PSAnd2ViY2xhdy1hY2NvdW50cy11aScpIHtcclxuICAgICAgICByZXR1cm4gYGh0dHA6Ly8xMjcuMC4wLjE6JHtwb3J0fWBcclxuICAgICAgfVxyXG4gICAgfSBjYXRjaCB7XHJcbiAgICAgIC8qIG5leHQgKi9cclxuICAgIH1cclxuICB9XHJcbiAgcmV0dXJuIG51bGxcclxufVxyXG5cclxuLyoqXHJcbiAqIFJlZ2lzdGVyIHByZXZpZXcgKyBhY2NvdW50cyBzZXR0aW5ncyArIGxpdmUgdGFiICsgZmlsZS10cmVlIGljb24gQ1NTLlxyXG4gKiBAcGFyYW0gY3R4IC0gY2xpZW50IHJvb3QgY29udGV4dC5cclxuICovXHJcbmV4cG9ydCBmdW5jdGlvbiBpbnN0YWxsV2ViY2xhd1N1cmZhY2VzKGN0eDogQ29udGV4dCk6IHZvaWQge1xyXG4gIGN0eC5lZmZlY3QoKCkgPT4ge1xyXG4gICAgY29uc3Qgc3R5bGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzdHlsZScpXHJcbiAgICBzdHlsZS5zZXRBdHRyaWJ1dGUoJ2RhdGEtd2ViY2xhdy1pY29ucycsICcnKVxyXG4gICAgc3R5bGUudGV4dENvbnRlbnQgPSBXRUJDTEFXX0lDT05fQ1NTXHJcbiAgICBkb2N1bWVudC5oZWFkLmFwcGVuZENoaWxkKHN0eWxlKVxyXG4gICAgcmV0dXJuICgpID0+IHtcclxuICAgICAgc3R5bGUucmVtb3ZlKClcclxuICAgIH1cclxuICB9LCAnd2ViY2xhdzogZmlsZSBpY29ucycpXHJcblxyXG4gIGN0eC5pbmplY3QoWydkb2N1bWVudFByZXZpZXdzJywgJ3Nsb3RzJywgJ2xvY2FsZSddLCBzY29wZSA9PiB7XHJcbiAgICBzY29wZS5lZmZlY3QoXHJcbiAgICAgICgpID0+IHNjb3BlLmxvY2FsZS5yZWdpc3RlcihOUywgeyB6aCwgZW4gfSksXHJcbiAgICAgICd3ZWJjbGF3OiBwcmV2aWV3IGRpY3Rpb25hcmllcycsXHJcbiAgICApXHJcbiAgICBzY29wZS5lZmZlY3QoXHJcbiAgICAgICgpID0+IHNjb3BlLmxvY2FsZS5yZWdpc3RlcihBQ0NPVU5UU19OUywgeyB6aDogYWNjb3VudHNaaCwgZW46IGFjY291bnRzRW4gfSksXHJcbiAgICAgICd3ZWJjbGF3OiBhY2NvdW50cyBkaWN0aW9uYXJpZXMnLFxyXG4gICAgKVxyXG4gICAgc2NvcGUuZWZmZWN0KFxyXG4gICAgICAoKSA9PiBzY29wZS5sb2NhbGUucmVnaXN0ZXIoTElWRV9OUywgeyB6aDogbGl2ZVpoLCBlbjogbGl2ZUVuIH0pLFxyXG4gICAgICAnd2ViY2xhdzogbGl2ZSBkaWN0aW9uYXJpZXMnLFxyXG4gICAgKVxyXG4gICAgc2NvcGUuZWZmZWN0KFxyXG4gICAgICAoKSA9PiBzY29wZS5sb2NhbGUucmVnaXN0ZXIoUlVOX1RPT0xfTlMsIHsgemg6IHJ1blRvb2xaaCwgZW46IHJ1blRvb2xFbiB9KSxcclxuICAgICAgJ3dlYmNsYXc6IHJ1biB0b29sdmlldyBkaWN0aW9uYXJpZXMnLFxyXG4gICAgKVxyXG4gICAgY29uc3QgdCA9IHNjb3BlLmxvY2FsZS5iaW5kKE5TKVxyXG4gICAgY29uc3QgdGEgPSBzY29wZS5sb2NhbGUuYmluZChBQ0NPVU5UU19OUylcclxuICAgIGNvbnN0IHRsID0gc2NvcGUubG9jYWxlLmJpbmQoTElWRV9OUylcclxuXHJcbiAgICAvLyBJbi1jaGF0IGxpdmUgbG9nIHdoaWxlIHdlYmNsYXdfcnVuIGlzIHBlbmRpbmcgKERTSCBjYW5ub3Qgc3RyZWFtIGV4ZWN1dGUoKSkuXHJcbiAgICBzY29wZS5lZmZlY3QoXHJcbiAgICAgICgpID0+XHJcbiAgICAgICAgc2NvcGUuc2xvdHMuaW5qZWN0KCd0b29sLmNhbGwudG9vbHZpZXcnLCAoKSA9PlxyXG4gICAgICAgICAgc2NvcGUuc2xvdHMucmVnaXN0ZXIoXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBuYW1lOiAndG9vbC5jYWxsLnRvb2x2aWV3JyxcclxuICAgICAgICAgICAgICBrZXk6ICd3ZWJjbGF3X3J1bicsXHJcbiAgICAgICAgICAgICAgbG9jYWxlOiBSVU5fVE9PTF9OUyxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgV2ViY2xhd1J1blRvb2x2aWV3LFxyXG4gICAgICAgICAgKSxcclxuICAgICAgICApLFxyXG4gICAgICAnd2ViY2xhdzogcnVuIHRvb2x2aWV3JyxcclxuICAgIClcclxuICAgIHNjb3BlLmVmZmVjdChcclxuICAgICAgKCkgPT5cclxuICAgICAgICBzY29wZS5kb2N1bWVudFByZXZpZXdzLnJlZ2lzdGVyKHtcclxuICAgICAgICAgIGlkOiBXRUJDTEFXX1BSRVZJRVdfSUQsXHJcbiAgICAgICAgICBleHRlbnNpb25zOiBbJ3dlYmNsYXcnXSxcclxuICAgICAgICAgIHByaW9yaXR5OiAnZXh0ZW5zaW9uJyxcclxuICAgICAgICAgIHRpdGxlOiAoKSA9PiB0KCd0aXRsZScpLFxyXG4gICAgICAgICAgbG9hZGluZzogJ3RleHQtcGFnZXMnLFxyXG4gICAgICAgICAgd3JhcDogdHJ1ZSxcclxuICAgICAgICB9KSxcclxuICAgICAgJ3dlYmNsYXc6IHByZXZpZXcgbWV0YWRhdGEnLFxyXG4gICAgKVxyXG4gICAgc2NvcGUuZWZmZWN0KFxyXG4gICAgICAoKSA9PlxyXG4gICAgICAgIHNjb3BlLnNsb3RzLmluamVjdCgnc2lkZWJhci5yaWdodC50YWIuZG9jdW1lbnQnLCAoKSA9PlxyXG4gICAgICAgICAgc2NvcGUuc2xvdHMucmVnaXN0ZXIoXHJcbiAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICBuYW1lOiAnc2lkZWJhci5yaWdodC50YWIuZG9jdW1lbnQnLFxyXG4gICAgICAgICAgICAgIGtleTogV0VCQ0xBV19QUkVWSUVXX0lELFxyXG4gICAgICAgICAgICAgIGxvY2FsZTogTlMsXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIFdlYmNsYXdQcmV2aWV3LFxyXG4gICAgICAgICAgKSxcclxuICAgICAgICApLFxyXG4gICAgICAnd2ViY2xhdzogcHJldmlldyBib2R5JyxcclxuICAgIClcclxuICAgIC8vIFNvZnQ6IHNldHRpbmdzIHNoZWxsIG1heSBiZSBhYnNlbnQgaW4gbWluaW1hbCBjb21wb3NpdGlvbnMuXHJcbiAgICBzY29wZS5lZmZlY3QoXHJcbiAgICAgICgpID0+XHJcbiAgICAgICAgc2NvcGUuc2xvdHMuaW5qZWN0KCdzZXR0aW5ncy5zZWN0aW9uJywgKCkgPT5cclxuICAgICAgICAgIHNjb3BlLnNsb3RzLnJlZ2lzdGVyKFxyXG4gICAgICAgICAgICB7XHJcbiAgICAgICAgICAgICAgbmFtZTogJ3NldHRpbmdzLnNlY3Rpb24nLFxyXG4gICAgICAgICAgICAgIGlkOiBXRUJDTEFXX0FDQ09VTlRTX1NFQ1RJT04sXHJcbiAgICAgICAgICAgICAgb3JkZXI6IDQ1LFxyXG4gICAgICAgICAgICAgIGxhYmVsOiAoKSA9PiB0YSgnc2VjdGlvbkxhYmVsJyksXHJcbiAgICAgICAgICAgICAgbG9jYWxlOiBBQ0NPVU5UU19OUyxcclxuICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgQWNjb3VudHNTZXR0aW5ncyxcclxuICAgICAgICAgICksXHJcbiAgICAgICAgKSxcclxuICAgICAgJ3dlYmNsYXc6IHNldHRpbmdzIGFjY291bnRzJyxcclxuICAgIClcclxuXHJcbiAgICAvLyBMaXZlIGV4ZWN1dGlvbiB0YWIgKG9wdGlvbmFsOiBuZWVkcyBzaWRlYmFyUmlnaHRUYWJzKS5cclxuICAgIHNjb3BlLmluamVjdChbJ3NpZGViYXJSaWdodFRhYnMnLCAnc2lkZWJhclJpZ2h0JywgJ3Nsb3RzJ10sIGxpdmUgPT4ge1xyXG4gICAgICBsaXZlLmVmZmVjdChcclxuICAgICAgICAoKSA9PlxyXG4gICAgICAgICAgbGl2ZS5zaWRlYmFyUmlnaHRUYWJzLnJlZ2lzdGVyKHtcclxuICAgICAgICAgICAgaWQ6IFdFQkNMQVdfTElWRV9JRCxcclxuICAgICAgICAgICAga2luZDogV0VCQ0xBV19MSVZFX0tJTkQsXHJcbiAgICAgICAgICAgIHByaW9yaXR5OiAnZXh0ZW5zaW9uJyxcclxuICAgICAgICAgICAgdGl0bGU6ICgpID0+IHRsKCd0aXRsZScpLFxyXG4gICAgICAgICAgICBndWlkZTogW1xyXG4gICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgIGlkOiAnd2ViY2xhdy1saXZlJyxcclxuICAgICAgICAgICAgICAgIG9yZGVyOiAzNSxcclxuICAgICAgICAgICAgICAgIHRpdGxlOiAoKSA9PiB0bCgnZ3VpZGVUaXRsZScpLFxyXG4gICAgICAgICAgICAgICAgZGVzY3JpcHRpb246ICgpID0+IHRsKCdndWlkZURlc2MnKSxcclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICBdLFxyXG4gICAgICAgICAgfSksXHJcbiAgICAgICAgJ3dlYmNsYXc6IGxpdmUgdGFiIHR5cGUnLFxyXG4gICAgICApXHJcbiAgICAgIGxpdmUuZWZmZWN0KFxyXG4gICAgICAgICgpID0+XHJcbiAgICAgICAgICBsaXZlLnNsb3RzLmluamVjdCgnc2lkZWJhci5yaWdodC5wYW5lLnRhYicsICgpID0+XHJcbiAgICAgICAgICAgIGxpdmUuc2xvdHMucmVnaXN0ZXIoXHJcbiAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgbmFtZTogJ3NpZGViYXIucmlnaHQucGFuZS50YWInLFxyXG4gICAgICAgICAgICAgICAga2V5OiBXRUJDTEFXX0xJVkVfSUQsXHJcbiAgICAgICAgICAgICAgICBsb2NhbGU6IExJVkVfTlMsXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICBXZWJjbGF3TGl2ZSxcclxuICAgICAgICAgICAgKSxcclxuICAgICAgICAgICksXHJcbiAgICAgICAgJ3dlYmNsYXc6IGxpdmUgdGFiIGJvZHknLFxyXG4gICAgICApXHJcblxyXG4gICAgICAvLyBQb2xsIEhvc3QgZm9jdXMgbWFya2VyIFx1MjE5MiBvcGVuVGFiIHdpdGggcnVuRGlyLlxyXG4gICAgICAvLyBPbmx5IGFkdmFuY2UgbGFzdFNlcSBhZnRlciBvcGVuVGFiIHN1Y2NlZWRzOyByZXRyeSB3aGlsZSBTZXNzaW9uIHN1cmZhY2UgaXMgY29sZC5cclxuICAgICAgLy8gQWxzbyBob25vciB0b29sdmlldyBDdXN0b21FdmVudCAoZmlyZXMgd2hpbGUgdGhlIGFnZW50IGNhcmQgaXMgb24gc2NyZWVuKS5cclxuICAgICAgbGl2ZS5lZmZlY3QoKCkgPT4ge1xyXG4gICAgICAgIGxldCBjYW5jZWxsZWQgPSBmYWxzZVxyXG4gICAgICAgIGxldCBsYXN0T3BlbmVkU2VxID0gLTFcclxuICAgICAgICBsZXQgbGFzdE9wZW5lZFJ1bkRpciA9ICcnXHJcbiAgICAgICAgbGV0IHBlbmRpbmdSdW5EaXIgPSAnJ1xyXG4gICAgICAgIGxldCBiYXNlOiBzdHJpbmcgfCBudWxsID0gbnVsbFxyXG4gICAgICAgIC8qKiBMZWZ0b3ZlciBsaXZlLWZvY3VzLmpzb24gZnJvbSBhIHByZXZpb3VzIHNlc3Npb24gbXVzdCBub3QgeWFuayB0aGUgcmFpbCBvcGVuLiAqL1xyXG4gICAgICAgIGxldCBzZWVkZWRMZWZ0b3ZlckZvY3VzID0gZmFsc2VcclxuXHJcbiAgICAgICAgLy8gSWYgdGhlIHVzZXIgY29sbGFwc2VzIHRoZSByaWdodCByYWlsLCBzdG9wIGZvcmNpbmcgaXQgYmFjayBvcGVuLlxyXG4gICAgICAgIGxldCB1c2VyQ29sbGFwc2VkUmFpbCA9IGZhbHNlXHJcbiAgICAgICAgbGV0IGV2ZXJPcGVuZWQgPSBmYWxzZVxyXG5cclxuICAgICAgICBjb25zdCBub3RlQ29sbGFwc2VkSWZBbnkgPSAoKTogdm9pZCA9PiB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCBhcGkgPSBsaXZlLnNpZGViYXJSaWdodCBhcyB7IGlzRXhwYW5kZWQ/OiAoKSA9PiBib29sZWFuIH1cclxuICAgICAgICAgICAgaWYgKGV2ZXJPcGVuZWQgJiYgYXBpLmlzRXhwYW5kZWQgJiYgIWFwaS5pc0V4cGFuZGVkKCkpIHtcclxuICAgICAgICAgICAgICB1c2VyQ29sbGFwc2VkUmFpbCA9IHRydWVcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICAgIC8qIG9wdGlvbmFsICovXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCB0cnlPcGVuID0gKHJ1bkRpcjogc3RyaW5nLCBzZXE6IG51bWJlciwgcmV2ZWFsOiBib29sZWFuKTogYm9vbGVhbiA9PiB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBub3RlQ29sbGFwc2VkSWZBbnkoKVxyXG4gICAgICAgICAgICBjb25zdCBhcGkgPSBsaXZlLnNpZGViYXJSaWdodCBhcyB7XHJcbiAgICAgICAgICAgICAgb3BlblRhYjogdHlwZW9mIGxpdmUuc2lkZWJhclJpZ2h0Lm9wZW5UYWJcclxuICAgICAgICAgICAgICBpc0V4cGFuZGVkPzogKCkgPT4gYm9vbGVhblxyXG4gICAgICAgICAgICB9XHJcbiAgICAgICAgICAgIC8vIEFmdGVyIHRoZSB1c2VyIGNsb3NlcyB0aGUgcmFpbCwgb25seSByZWZyZXNoIHRhYiBwYXJhbXMgcXVpZXRseS5cclxuICAgICAgICAgICAgY29uc3QgbWF5UmV2ZWFsID0gcmV2ZWFsICYmICF1c2VyQ29sbGFwc2VkUmFpbFxyXG4gICAgICAgICAgICBhcGkub3BlblRhYihXRUJDTEFXX0xJVkVfS0lORCwge1xyXG4gICAgICAgICAgICAgIHBhcmFtczogeyBydW5EaXIsIGZvY3VzU2VxOiBzZXEgfSxcclxuICAgICAgICAgICAgICByZXZlYWxJZk9wZW5lZDogbWF5UmV2ZWFsLFxyXG4gICAgICAgICAgICB9KVxyXG4gICAgICAgICAgICBpZiAobWF5UmV2ZWFsKSBldmVyT3BlbmVkID0gdHJ1ZVxyXG4gICAgICAgICAgICBsYXN0T3BlbmVkU2VxID0gTWF0aC5tYXgobGFzdE9wZW5lZFNlcSwgc2VxKVxyXG4gICAgICAgICAgICBsYXN0T3BlbmVkUnVuRGlyID0gcnVuRGlyXHJcbiAgICAgICAgICAgIHBlbmRpbmdSdW5EaXIgPSAnJ1xyXG4gICAgICAgICAgICBub3RlQ29sbGFwc2VkSWZBbnkoKVxyXG4gICAgICAgICAgICByZXR1cm4gdHJ1ZVxyXG4gICAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICAgIHBlbmRpbmdSdW5EaXIgPSBydW5EaXJcclxuICAgICAgICAgICAgcmV0dXJuIGZhbHNlXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBvbk9wZW5MaXZlID0gKGV2OiBFdmVudCkgPT4ge1xyXG4gICAgICAgICAgY29uc3QgZGV0YWlsID0gKGV2IGFzIEN1c3RvbUV2ZW50PFdlYmNsYXdPcGVuTGl2ZURldGFpbD4pLmRldGFpbFxyXG4gICAgICAgICAgY29uc3QgcnVuRGlyID0gZGV0YWlsPy5ydW5EaXI/LnRyaW0oKSB8fCAnJ1xyXG4gICAgICAgICAgaWYgKCFydW5EaXIgfHwgY2FuY2VsbGVkKSByZXR1cm5cclxuICAgICAgICAgIG5vdGVDb2xsYXBzZWRJZkFueSgpXHJcbiAgICAgICAgICAvLyBVc2VyIGNsb3NlZCB0aGUgcmFpbCBcdTIwMTQgZG9uJ3QgeWFuayBpdCBvcGVuIGZyb20gdGhlIHRvb2wgY2FyZCBlaXRoZXIuXHJcbiAgICAgICAgICBpZiAodXNlckNvbGxhcHNlZFJhaWwpIHJldHVyblxyXG4gICAgICAgICAgc2VlZGVkTGVmdG92ZXJGb2N1cyA9IHRydWVcclxuICAgICAgICAgIC8vIEZvcmNlIGEgcmV0cnkgZXZlbiB3aGVuIHNlcSBpcyB1bmNoYW5nZWQgKHRvb2x2aWV3IHNhdyBydW5EaXIgZmlyc3QpLlxyXG4gICAgICAgICAgaWYgKHJ1bkRpciAhPT0gbGFzdE9wZW5lZFJ1bkRpcikgbGFzdE9wZW5lZFNlcSA9IC0xXHJcbiAgICAgICAgICB0cnlPcGVuKHJ1bkRpciwgbGFzdE9wZW5lZFNlcSArIDEsIHRydWUpXHJcbiAgICAgICAgfVxyXG4gICAgICAgIHdpbmRvdy5hZGRFdmVudExpc3RlbmVyKFdFQkNMQVdfT1BFTl9MSVZFX0VWRU5ULCBvbk9wZW5MaXZlKVxyXG5cclxuICAgICAgICBjb25zdCBwb2xsID0gYXN5bmMgKCkgPT4ge1xyXG4gICAgICAgICAgaWYgKGNhbmNlbGxlZCkgcmV0dXJuXHJcbiAgICAgICAgICBpZiAoIWJhc2UpIGJhc2UgPSBhd2FpdCBmaW5kTGl2ZUJhc2UoKVxyXG4gICAgICAgICAgaWYgKCFiYXNlIHx8IGNhbmNlbGxlZCkgcmV0dXJuXHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaChgJHtiYXNlfS9hcGkvbGl2ZS9mb2N1c2ApXHJcbiAgICAgICAgICAgIGNvbnN0IGogPSAoYXdhaXQgcmVzLmpzb24oKSkgYXMge1xyXG4gICAgICAgICAgICAgIG9rPzogYm9vbGVhblxyXG4gICAgICAgICAgICAgIGZvY3VzPzogeyBydW5EaXI/OiBzdHJpbmc7IHNlcT86IG51bWJlciB9XHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgY29uc3QgZm9jdXMgPSBqLmZvY3VzXHJcbiAgICAgICAgICAgIGNvbnN0IHNlcSA9IHR5cGVvZiBmb2N1cz8uc2VxID09PSAnbnVtYmVyJyA/IGZvY3VzLnNlcSA6IC0xXHJcbiAgICAgICAgICAgIGNvbnN0IHJ1bkRpciA9IGZvY3VzPy5ydW5EaXI/LnRyaW0oKSB8fCBwZW5kaW5nUnVuRGlyXHJcbiAgICAgICAgICAgIGlmICghcnVuRGlyKSByZXR1cm5cclxuICAgICAgICAgICAgLy8gQ29sZCBzdGFydDogYWRvcHQgZGlzayBsZWZ0b3ZlciB3aXRob3V0IHJldmVhbGluZyB0aGUgcmlnaHQgcmFpbC5cclxuICAgICAgICAgICAgaWYgKCFzZWVkZWRMZWZ0b3ZlckZvY3VzICYmICFldmVyT3BlbmVkKSB7XHJcbiAgICAgICAgICAgICAgc2VlZGVkTGVmdG92ZXJGb2N1cyA9IHRydWVcclxuICAgICAgICAgICAgICBsYXN0T3BlbmVkU2VxID0gc2VxID4gMCA/IHNlcSA6IDBcclxuICAgICAgICAgICAgICBsYXN0T3BlbmVkUnVuRGlyID0gcnVuRGlyXHJcbiAgICAgICAgICAgICAgcmV0dXJuXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgLy8gTmV3IHJ1bkRpciBtdXN0IHJlb3BlbiBldmVuIGlmIHNlcSBzb21laG93IHN0YWxsZWQuXHJcbiAgICAgICAgICAgIGlmIChydW5EaXIgIT09IGxhc3RPcGVuZWRSdW5EaXIgJiYgc2VxIDw9IGxhc3RPcGVuZWRTZXEpIHtcclxuICAgICAgICAgICAgICBsYXN0T3BlbmVkU2VxID0gLTFcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgICBpZiAoc2VxIDw9IGxhc3RPcGVuZWRTZXEgJiYgcnVuRGlyID09PSBsYXN0T3BlbmVkUnVuRGlyICYmICFwZW5kaW5nUnVuRGlyKSB7XHJcbiAgICAgICAgICAgICAgcmV0dXJuXHJcbiAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgdHJ5T3BlbihydW5EaXIsIHNlcSA+IDAgPyBzZXEgOiBsYXN0T3BlbmVkU2VxICsgMSwgIXVzZXJDb2xsYXBzZWRSYWlsKVxyXG4gICAgICAgICAgfSBjYXRjaCB7XHJcbiAgICAgICAgICAgIGJhc2UgPSBudWxsXHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfVxyXG4gICAgICAgIHZvaWQgcG9sbCgpXHJcbiAgICAgICAgY29uc3QgaWQgPSB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xyXG4gICAgICAgICAgdm9pZCBwb2xsKClcclxuICAgICAgICB9LCA2MDApXHJcbiAgICAgICAgcmV0dXJuICgpID0+IHtcclxuICAgICAgICAgIGNhbmNlbGxlZCA9IHRydWVcclxuICAgICAgICAgIHdpbmRvdy5jbGVhckludGVydmFsKGlkKVxyXG4gICAgICAgICAgd2luZG93LnJlbW92ZUV2ZW50TGlzdGVuZXIoV0VCQ0xBV19PUEVOX0xJVkVfRVZFTlQsIG9uT3BlbkxpdmUpXHJcbiAgICAgICAgfVxyXG4gICAgICB9LCAnd2ViY2xhdzogbGl2ZSBmb2N1cyBwb2xsJylcclxuICAgIH0pXHJcbiAgfSlcclxufVxyXG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFB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O0FBQUEsUUFDekM7QUFDQSxlQUFPLGlCQUFpQix5QkFBeUIsVUFBVTtBQUUzRCxjQUFNLE9BQU8sWUFBWTtBQUN2QixjQUFJLFVBQVc7QUFDZixjQUFJLENBQUMsS0FBTSxRQUFPLE1BQU0sYUFBYTtBQUNyQyxjQUFJLENBQUMsUUFBUSxVQUFXO0FBQ3hCLGNBQUk7QUFDRixrQkFBTSxNQUFNLE1BQU0sTUFBTSxHQUFHLElBQUksaUJBQWlCO0FBQ2hELGtCQUFNLElBQUssTUFBTSxJQUFJLEtBQUs7QUFJMUIsa0JBQU0sUUFBUSxFQUFFO0FBQ2hCLGtCQUFNLE1BQU0sT0FBTyxPQUFPLFFBQVEsV0FBVyxNQUFNLE1BQU07QUFDekQsa0JBQU0sU0FBUyxPQUFPLFFBQVEsS0FBSyxLQUFLO0FBQ3hDLGdCQUFJLENBQUMsT0FBUTtBQUViLGdCQUFJLENBQUMsdUJBQXVCLENBQUMsWUFBWTtBQUN2QyxvQ0FBc0I7QUFDdEIsOEJBQWdCLE1BQU0sSUFBSSxNQUFNO0FBQ2hDLGlDQUFtQjtBQUNuQjtBQUFBLFlBQ0Y7QUFFQSxnQkFBSSxXQUFXLG9CQUFvQixPQUFPLGVBQWU7QUFDdkQsOEJBQWdCO0FBQUEsWUFDbEI7QUFDQSxnQkFBSSxPQUFPLGlCQUFpQixXQUFXLG9CQUFvQixDQUFDLGVBQWU7QUFDekU7QUFBQSxZQUNGO0FBQ0Esb0JBQVEsUUFBUSxNQUFNLElBQUksTUFBTSxnQkFBZ0IsR0FBRyxDQUFDLGlCQUFpQjtBQUFBLFVBQ3ZFLFFBQVE7QUFDTixtQkFBTztBQUFBLFVBQ1Q7QUFBQSxRQUNGO0FBQ0EsYUFBSyxLQUFLO0FBQ1YsY0FBTSxLQUFLLE9BQU8sWUFBWSxNQUFNO0FBQ2xDLGVBQUssS0FBSztBQUFBLFFBQ1osR0FBRyxHQUFHO0FBQ04sZUFBTyxNQUFNO0FBQ1gsc0JBQVk7QUFDWixpQkFBTyxjQUFjLEVBQUU7QUFDdkIsaUJBQU8sb0JBQW9CLHlCQUF5QixVQUFVO0FBQUEsUUFDaEU7QUFBQSxNQUNGLEdBQUcsMEJBQTBCO0FBQUEsSUFDL0IsQ0FBQztBQUFBLEVBQ0gsQ0FBQztBQUNIOzs7QWIxU08sSUFBTSxPQUFPO0FBR2IsSUFBTSxTQUFTLENBQUMsU0FBUyxRQUFRO0FBTWpDLFNBQVMsTUFBTSxLQUFvQjtBQUN4Qyx5QkFBdUIsR0FBRztBQUM1QjsiLAogICJuYW1lcyI6IFsiemgiLCAiZW4iLCAiemgiLCAiZW4iLCAiemgiLCAiZW4iLCAiaW1wb3J0X3JlYWN0IiwgImltcG9ydF9yZWFjdCIsICJpbXBvcnRfanN4X3J1bnRpbWUiLCAiaW1wb3J0X2pzeF9ydW50aW1lIiwgIkNBTkRJREFURV9QT1JUUyIsICJmaW5kQmFzZSIsICJuYW1lIiwgImltcG9ydF9qc3hfcnVudGltZSIsICJpbXBvcnRfcmVhY3QiLCAiaW1wb3J0X2pzeF9ydW50aW1lIiwgIkNBTkRJREFURV9QT1JUUyIsICJmaW5kQmFzZSIsICJDQU5ESURBVEVfUE9SVFMiLCAiemgiLCAiZW4iXQp9Cg==

    return module.exports;
  }
});
