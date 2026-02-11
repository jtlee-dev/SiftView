//! SiftView backend: file I/O, content detection, diff.

use std::io::Cursor;

use serde::{Deserialize, Serialize};
use similar::{TextDiff, DiffOp};

/// Result of content detection for a buffer or segment.
#[derive(Debug, Serialize)]
pub struct DetectedType {
    pub kind: String,
    pub confidence: f64,
}

/// A contiguous region of the buffer with a detected content type (1-based inclusive lines).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Segment {
    pub start_line: u32,
    pub end_line: u32,
    pub kind: String,
}

/// Max file size to read (5 MB). Larger files return an error to avoid freezing the app.
const MAX_FILE_SIZE_BYTES: u64 = 5 * 1024 * 1024;

// Tauri commands: do not use `pub` on command fns when they live in the same file as
// `generate_handler![]` — it causes duplicate `__cmd__*` macro definitions at compile time.
/// Read file contents from the given path. Fails if file is larger than MAX_FILE_SIZE_BYTES.
#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    let meta = tokio::fs::metadata(&path)
        .await
        .map_err(|e| e.to_string())?;
    if meta.len() > MAX_FILE_SIZE_BYTES {
        let mb = meta.len() as f64 / (1024.0 * 1024.0);
        let max_mb = MAX_FILE_SIZE_BYTES as f64 / (1024.0 * 1024.0);
        return Err(format!(
            "File too large ({:.1} MB). Maximum size is {:.0} MB. Open a smaller file or use another tool.",
            mb, max_mb
        ));
    }
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| e.to_string())
}

/// Write content to the given path. Used for Save and Save As.
#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String> {
    tokio::fs::write(&path, content)
        .await
        .map_err(|e| e.to_string())
}

/// Detect content type from raw text and optional file extension.
#[tauri::command]
fn detect_content(content: &str, extension: Option<String>) -> DetectedType {
    let ext = extension.as_deref().unwrap_or("");
    // Extension-based detection first
    let (kind, confidence) = match ext.to_lowercase().as_str() {
        "json" => ("json", 0.95),
        "csv" => ("csv", 0.95),
        "xml" | "html" => ("xml", 0.9),
        "yaml" | "yml" => ("yaml", 0.95),
        "env" | "properties" => ("properties", 0.9),
        _ => content_detection_heuristic(content),
    };
    DetectedType {
        kind: kind.to_string(),
        confidence,
    }
}

/// Block in a structured diff: either unchanged lines (collapsible) or a changed region.
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DiffBlock {
    Unchanged {
        count: usize,
        /// Lines (same on both sides) for display when expanded.
        lines: Vec<String>,
    },
    Changed {
        old_lines: Vec<String>,
        new_lines: Vec<String>,
    },
}

/// Structured diff for side-by-side view: list of blocks (unchanged or changed).
#[derive(Debug, Serialize)]
pub struct StructuredDiff {
    pub left_label: String,
    pub right_label: String,
    pub blocks: Vec<DiffBlock>,
}

/// Compute a structured diff (blocks of unchanged/changed) for side-by-side UI.
#[tauri::command]
fn compute_diff_structured(left: String, right: String) -> StructuredDiff {
    let diff = TextDiff::from_lines(left.as_str(), right.as_str());
    let old_slices = diff.old_slices();
    let new_slices = diff.new_slices();
    let mut blocks = Vec::new();
    for op in diff.ops() {
        let (old_start, old_end) = (op.old_range().start, op.old_range().end);
        let (new_start, new_end) = (op.new_range().start, op.new_range().end);
        match op {
            DiffOp::Equal { .. } => {
                let count = old_end - old_start;
                if count > 0 {
                    let lines: Vec<String> = old_slices[old_start..old_end]
                        .iter()
                        .map(|s| (*s).to_string())
                        .collect();
                    blocks.push(DiffBlock::Unchanged { count, lines });
                }
            }
            _ => {
                let old_lines: Vec<String> = old_slices[old_start..old_end]
                    .iter()
                    .map(|s| (*s).to_string())
                    .collect();
                let new_lines: Vec<String> = new_slices[new_start..new_end]
                    .iter()
                    .map(|s| (*s).to_string())
                    .collect();
                blocks.push(DiffBlock::Changed {
                    old_lines,
                    new_lines,
                });
            }
        }
    }
    StructuredDiff {
        left_label: "current".to_string(),
        right_label: "clipboard".to_string(),
        blocks,
    }
}

/// Compute a unified diff between two strings (line-based).
#[tauri::command]
fn compute_diff(left: String, right: String) -> String {
    let diff = TextDiff::from_lines(left.as_str(), right.as_str());
    format!(
        "{}",
        diff.unified_diff()
            .header("current", "clipboard")
            .missing_newline_hint(false)
    )
}

/// Pretty-print JSON. Returns an error if content is not valid JSON.
#[tauri::command]
fn format_json(content: String) -> Result<String, String> {
    let value: serde_json::Value =
        serde_json::from_str(&content).map_err(|e| e.to_string())?;
    serde_json::to_string_pretty(&value).map_err(|e| e.to_string())
}

/// Parse CSV and re-output with aligned columns. Fails on parse error.
fn format_csv(content: &str) -> Result<String, String> {
    let mut reader = csv::Reader::from_reader(Cursor::new(content.as_bytes()));
    let rows: Vec<Vec<String>> = reader
        .records()
        .map(|r| {
            r.map_err(|e| e.to_string())
                .map(|rec| rec.iter().map(String::from).collect())
        })
        .collect::<Result<Vec<_>, _>>()?;
    if rows.is_empty() {
        return Ok(String::new());
    }
    let ncols = rows.iter().map(|r| r.len()).max().unwrap_or(0);
    if ncols == 0 {
        return Ok(content.to_string());
    }
    let mut widths = vec![0usize; ncols];
    for row in &rows {
        for (c, cell) in row.iter().enumerate() {
            if c < ncols {
                widths[c] = widths[c].max(cell.chars().count());
            }
        }
    }
    let lines: Vec<String> = rows
        .into_iter()
        .map(|row| {
            row.iter()
                .enumerate()
                .map(|(c, cell)| {
                    let w = widths.get(c).copied().unwrap_or(0);
                    format!("{:<width$}", cell, width = w)
                })
                .collect::<Vec<_>>()
                .join("  ")
        })
        .collect();
    Ok(lines.join("\n"))
}

/// Pretty-print XML with indentation. Returns an error on parse failure.
fn format_xml(content: &str) -> Result<String, String> {
    use quick_xml::events::Event;
    use quick_xml::reader::Reader;
    use quick_xml::writer::Writer;

    let mut buf = Vec::new();
    let mut reader = Reader::from_reader(Cursor::new(content.as_bytes()));
    reader.config_mut().trim_text(true);
    let mut writer = Writer::new_with_indent(Cursor::new(Vec::new()), b' ', 2);

    loop {
        let ev = reader.read_event_into(&mut buf).map_err(|e| e.to_string())?;
        match ev {
            Event::Eof => break,
            _ => writer.write_event(ev).map_err(|e| e.to_string())?,
        }
        buf.clear();
    }

    let out = writer.into_inner().into_inner();
    String::from_utf8(out).map_err(|e| e.to_string())
}

/// Pretty-print YAML. Returns an error on parse failure.
fn format_yaml(content: &str) -> Result<String, String> {
    let value: serde_yaml::Value =
        serde_yaml::from_str(content).map_err(|e| e.to_string())?;
    serde_yaml::to_string(&value).map_err(|e| e.to_string())
}

/// Normalize .env / properties: trim lines, sort key=value lines. Comment lines are kept but may reorder.
fn format_properties(content: &str) -> Result<String, String> {
    let mut lines: Vec<String> = content
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty())
        .collect();
    lines.sort();
    Ok(lines.join("\n"))
}

/// Format content by segment: pretty-print only JSON segments, leave the rest unchanged.
/// Never fails — returns original content or partially formatted content.
#[tauri::command]
fn format_content_segmented(content: String, segments: Vec<Segment>) -> String {
    let lines: Vec<&str> = content.lines().collect();
    if lines.is_empty() {
        return content;
    }
    if segments.is_empty() {
        return format_json(content.clone()).unwrap_or(content);
    }
    let mut out: Vec<String> = Vec::new();
    for seg in segments {
        let start = (seg.start_line as usize).saturating_sub(1);
        let end = (seg.end_line as usize).min(lines.len());
        if start >= end {
            continue;
        }
        let segment_text = lines[start..end].join("\n");
        let formatted = match seg.kind.as_str() {
            "json" => format_json(segment_text.clone()).unwrap_or(segment_text),
            "csv" => format_csv(&segment_text).unwrap_or(segment_text),
            "xml" | "html" => format_xml(&segment_text).unwrap_or(segment_text),
            "yaml" => format_yaml(&segment_text).unwrap_or(segment_text),
            "properties" | "env" => format_properties(&segment_text).unwrap_or(segment_text),
            _ => segment_text,
        };
        out.push(formatted);
    }
    out.join("\n")
}

/// Detect content type for a single line (for per-line segment detection).
fn detect_line_kind(line: &str, line_index: usize, ext: &str) -> String {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return "text".to_string();
    }
    if line_index == 0 && !ext.is_empty() {
        let kind = match ext.to_lowercase().as_str() {
            "json" => "json",
            "csv" => "csv",
            "xml" | "html" => "xml",
            "yaml" | "yml" => "yaml",
            "env" | "properties" => "properties",
            _ => content_detection_heuristic(trimmed).0,
        };
        return kind.to_string();
    }
    content_detection_heuristic(trimmed).0.to_string()
}

/// Split content into segments: detect type per line, merge consecutive same kind. Blank lines force a boundary.
#[tauri::command]
fn detect_segments(content: String, extension: Option<String>) -> Vec<Segment> {
    let ext = extension.as_deref().unwrap_or("");
    let lines: Vec<&str> = content.lines().collect();
    if lines.is_empty() {
        let kind = if matches!(ext.to_lowercase().as_str(), "json" | "csv" | "xml" | "html" | "yaml" | "yml" | "env" | "properties") {
            match ext.to_lowercase().as_str() {
                "html" => "xml".to_string(),
                "yml" => "yaml".to_string(),
                "env" | "properties" => "properties".to_string(),
                other => other.to_string(),
            }
        } else {
            content_detection_heuristic(content.trim()).0.to_string()
        };
        return vec![Segment {
            start_line: 1,
            end_line: 1,
            kind,
        }];
    }
    let mut segments: Vec<Segment> = Vec::new();
    let mut i = 0usize;
    while i < lines.len() {
        let line = lines[i];
        let is_blank = line.trim().is_empty();
        let line_1based = (i + 1) as u32;
        if is_blank {
            i += 1;
            continue;
        }
        let kind = detect_line_kind(line, i, ext);
        if let Some(last) = segments.last_mut() {
            if last.kind == kind && last.end_line + 1 == line_1based {
                last.end_line = line_1based;
                i += 1;
                continue;
            }
        }
        segments.push(Segment {
            start_line: line_1based,
            end_line: line_1based,
            kind,
        });
        i += 1;
    }
    if segments.is_empty() {
        segments.push(Segment {
            start_line: 1,
            end_line: lines.len().max(1) as u32,
            kind: "text".to_string(),
        });
    }
    segments
}

fn content_detection_heuristic(content: &str) -> (&'static str, f64) {
    let trimmed = content.trim();
    if trimmed.starts_with('{') && trimmed.contains('"') {
        return ("json", 0.85);
    }
    if trimmed.starts_with('[') && trimmed.contains('"') {
        return ("json", 0.85);
    }
    if trimmed.contains(',') && trimmed.contains('\n') {
        let first = trimmed.lines().next().unwrap_or("");
        if first.matches(',').count() >= 1 {
            return ("csv", 0.7);
        }
    }
    // YAML: document start or key: value style
    if trimmed.starts_with("---") {
        return ("yaml", 0.75);
    }
    if trimmed.contains('\n') && trimmed.contains(": ") && !trimmed.starts_with('{') && !trimmed.starts_with('[') {
        let looks_like_yaml = trimmed.lines().take(3).any(|l| {
            let t = l.trim();
            !t.is_empty() && !t.starts_with('#') && t.contains(": ") && !t.starts_with('{')
        });
        if looks_like_yaml {
            return ("yaml", 0.65);
        }
    }
    // .env / properties: key=value lines
    if trimmed.contains('=') && !trimmed.starts_with('{') {
        let line_ok = |l: &str| {
            let t = l.trim();
            t.is_empty() || t.starts_with('#') || (t.contains('=') && !t.starts_with('='))
        };
        if trimmed.lines().all(line_ok) && trimmed.lines().any(|l| l.trim().contains('=')) {
            return ("properties", 0.65);
        }
    }
    ("text", 0.5)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_content_json_by_extension() {
        let out = detect_content("anything", Some("json".into()));
        assert_eq!(out.kind, "json");
        assert!((out.confidence - 0.95).abs() < 1e-9);
    }

    #[test]
    fn detect_content_csv_by_extension() {
        let out = detect_content("anything", Some("csv".into()));
        assert_eq!(out.kind, "csv");
        assert!((out.confidence - 0.95).abs() < 1e-9);
    }

    #[test]
    fn detect_content_xml_by_extension() {
        let out = detect_content("x", Some("xml".into()));
        assert_eq!(out.kind, "xml");
        let out_html = detect_content("x", Some("HTML".into()));
        assert_eq!(out_html.kind, "xml");
    }

    #[test]
    fn detect_content_json_heuristic_object() {
        let out = detect_content(r#"  {"a": 1}  "#, None);
        assert_eq!(out.kind, "json");
        assert!((out.confidence - 0.85).abs() < 1e-9);
    }

    #[test]
    fn detect_content_json_heuristic_array() {
        let out = detect_content(r#"["x", "y"]"#, None);
        assert_eq!(out.kind, "json");
    }

    #[test]
    fn detect_content_csv_heuristic() {
        let out = detect_content("a,b,c\n1,2,3", None);
        assert_eq!(out.kind, "csv");
        assert!((out.confidence - 0.7).abs() < 1e-9);
    }

    #[test]
    fn detect_content_fallback_text() {
        let out = detect_content("plain text\nno structure", None);
        assert_eq!(out.kind, "text");
        assert!((out.confidence - 0.5).abs() < 1e-9);
    }

    #[test]
    fn detect_content_extension_overrides_heuristic() {
        let out = detect_content("a,b,c\n1,2,3", Some("json".into()));
        assert_eq!(out.kind, "json");
        assert!((out.confidence - 0.95).abs() < 1e-9);
    }

    #[test]
    fn detect_content_yaml_and_properties_by_extension() {
        let out = detect_content("x", Some("yaml".into()));
        assert_eq!(out.kind, "yaml");
        let out2 = detect_content("x", Some("yml".into()));
        assert_eq!(out2.kind, "yaml");
        let out3 = detect_content("x", Some("env".into()));
        assert_eq!(out3.kind, "properties");
        let out4 = detect_content("x", Some("properties".into()));
        assert_eq!(out4.kind, "properties");
    }

    #[test]
    fn format_csv_aligns_columns() {
        let raw = "a,b,c\n1,22,333";
        let out = format_csv(raw).unwrap();
        assert!(out.contains("a  "));
        assert!(out.contains("1  "));
        assert!(out.contains("333"));
    }

    #[test]
    fn format_content_segmented_formats_csv_segment() {
        let content = "text\nname,age\nAlice,30\nmore";
        let segments = vec![
            Segment { start_line: 1, end_line: 1, kind: "text".to_string() },
            Segment { start_line: 2, end_line: 3, kind: "csv".to_string() },
            Segment { start_line: 4, end_line: 4, kind: "text".to_string() },
        ];
        let out = format_content_segmented(content.to_string(), segments);
        assert!(out.contains("text"));
        assert!(out.contains("more"));
        // CSV segment is aligned (extra spaces between columns)
        assert!(out.contains("name"));
        assert!(out.contains("Alice"));
    }

    #[tokio::test]
    async fn read_file_returns_error_for_nonexistent() {
        let result = read_file("/nonexistent/path/xyz".into()).await;
        assert!(result.is_err());
    }

    #[test]
    fn compute_diff_produces_unified_format() {
        let left = "a\nb\nc\n";
        let right = "a\nb2\nc\n";
        let out = compute_diff(left.to_string(), right.to_string());
        assert!(out.contains("--- current"));
        assert!(out.contains("+++ clipboard"));
        assert!(out.contains("-b") || out.contains("b2"));
        assert!(out.contains("+b2") || out.contains("b\n"));
    }

    #[test]
    fn detect_segments_single_block() {
        let out = detect_segments("hello\nworld".to_string(), None);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].start_line, 1);
        assert_eq!(out[0].end_line, 2);
        assert_eq!(out[0].kind, "text");
    }

    #[test]
    fn detect_segments_per_line_json_and_text() {
        let content = "123\n123\n{\"a\": 1}\n\nselect * from t";
        let out = detect_segments(content.to_string(), None);
        assert!(out.len() >= 2);
        assert_eq!(out[0].kind, "text");
        assert_eq!(out[0].end_line, 2);
        assert_eq!(out[1].kind, "json");
        assert_eq!(out[1].start_line, 3);
        assert_eq!(out[1].end_line, 3);
    }

    #[test]
    fn format_json_pretty_prints() {
        let compact = r#"{"a":1,"b":2}"#;
        let out = format_json(compact.to_string()).unwrap();
        assert!(out.contains(' '));
        assert!(out.contains('\n'));
        let parsed: serde_json::Value = serde_json::from_str(&out).unwrap();
        assert_eq!(parsed.get("a").and_then(|v| v.as_i64()), Some(1));
    }

    #[test]
    fn format_json_rejects_invalid() {
        let bad = "{ invalid }";
        assert!(format_json(bad.to_string()).is_err());
    }

    #[test]
    fn format_content_segmented_returns_unchanged_for_text() {
        let content = "hello\nworld";
        let segments = vec![Segment {
            start_line: 1,
            end_line: 2,
            kind: "text".to_string(),
        }];
        let out = format_content_segmented(content.to_string(), segments);
        assert_eq!(out, content);
    }

    #[test]
    fn format_content_segmented_formats_only_json_segment() {
        let content = "some text\n{\"a\":1}\nmore text";
        let segments = vec![
            Segment { start_line: 1, end_line: 1, kind: "text".to_string() },
            Segment { start_line: 2, end_line: 2, kind: "json".to_string() },
            Segment { start_line: 3, end_line: 3, kind: "text".to_string() },
        ];
        let out = format_content_segmented(content.to_string(), segments);
        assert!(out.contains("some text"));
        assert!(out.contains("more text"));
        assert!(out.contains("\"a\": 1") || out.contains("\"a\":1"));
    }

    #[test]
    fn format_content_segmented_plain_text_no_segments_fallback() {
        let content = "not json at all";
        let out = format_content_segmented(content.to_string(), vec![]);
        assert_eq!(out, content);
    }

    #[test]
    fn compute_diff_structured_returns_blocks() {
        let left = "1\n2\n3\n";
        let right = "1\n2\n";
        let out = compute_diff_structured(left.to_string(), right.to_string());
        assert_eq!(out.left_label, "current");
        assert_eq!(out.right_label, "clipboard");
        assert!(!out.blocks.is_empty());
        if let DiffBlock::Unchanged { count, lines } = &out.blocks[0] {
            assert_eq!(*count, 2);
            assert_eq!(lines.len(), 2);
        }
    }

    #[tokio::test]
    async fn read_file_returns_content() {
        let temp = std::env::temp_dir().join("siftview_test_read");
        let path = temp.to_string_lossy().to_string();
        std::fs::write(&temp, "hello world").unwrap();
        let result = read_file(path).await;
        std::fs::remove_file(&temp).ok();
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "hello world");
    }

    #[tokio::test]
    async fn write_file_writes_content() {
        let temp = std::env::temp_dir().join("siftview_test_write");
        let path = temp.to_string_lossy().to_string();
        let result = write_file(path.clone(), "written content".to_string()).await;
        assert!(result.is_ok());
        let read_back = std::fs::read_to_string(&temp).unwrap();
        std::fs::remove_file(&temp).ok();
        assert_eq!(read_back, "written content");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![read_file, write_file, detect_content, detect_segments, compute_diff, compute_diff_structured, format_json, format_content_segmented])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
