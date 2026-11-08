//! 菜谱动词同义词：解析期表面词 → 中文 canonical keyword。
//!
//! 执行期硬编码只认中文 canonical；英文别名在 parse_one_segment 归一后写入 Step.keyword。
//! MVP：打开/open、点击/click、等待/wait、输入/type、采集/collect、刷新/reload、
//! 截图/screenshot、滚动/scroll、按/press、参数/param。

/// (surface alias, canonical Chinese keyword)
pub const VERB_SYNONYMS: &[(&str, &str)] = &[
    ("open", "打开"),
    ("click", "点击"),
    ("wait", "等待"),
    ("type", "输入"), // 主英文别名；不用 type_in
    ("collect", "采集"),
    ("reload", "刷新"),
    ("screenshot", "截图"),
    ("scroll", "滚动"),
    ("press", "按"),
    ("param", "参数"),
];

/// 若 `surface` 是已注册英文别名，返回中文 canonical；否则原样返回。
pub fn canonical_keyword(surface: &str) -> &str {
    let s = surface.trim();
    for &(alias, canon) in VERB_SYNONYMS {
        if s == alias {
            return canon;
        }
    }
    s
}

/// 全部表面词（仅别名侧）；`all_keywords` 会与 CommandDef.keyword 合并。
pub fn alias_keywords() -> Vec<&'static str> {
    VERB_SYNONYMS.iter().map(|(a, _)| *a).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn maps_mvp_aliases() {
        assert_eq!(canonical_keyword("open"), "打开");
        assert_eq!(canonical_keyword("click"), "点击");
        assert_eq!(canonical_keyword("wait"), "等待");
        assert_eq!(canonical_keyword("type"), "输入");
        assert_eq!(canonical_keyword("collect"), "采集");
        assert_eq!(canonical_keyword("reload"), "刷新");
        assert_eq!(canonical_keyword("screenshot"), "截图");
        assert_eq!(canonical_keyword("scroll"), "滚动");
        assert_eq!(canonical_keyword("press"), "按");
        assert_eq!(canonical_keyword("param"), "参数");
    }

    #[test]
    fn chinese_passthrough() {
        assert_eq!(canonical_keyword("打开"), "打开");
        assert_eq!(canonical_keyword("点击"), "点击");
        assert_eq!(canonical_keyword("等待"), "等待");
    }
}
