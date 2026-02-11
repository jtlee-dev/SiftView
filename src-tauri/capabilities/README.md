# Tauri capabilities

Permission and capability identifiers must follow Tauri’s ACL rules:

- **Characters:** lowercase ASCII letters `a-z` and hyphens `-` only. No underscores, digits, or uppercase.
- **Colon:** at most one `:` when using a plugin prefix (e.g. `dialog:allow-open`).
- **Hyphens:** not allowed as first or last character of the identifier.

Capability **identifier** (e.g. `main-window`) and each entry in **permissions** must match.

**App-defined commands:** Each custom command needs a permission file in `src-tauri/permissions/` (e.g. `allow-read-file.toml`) with `identifier = "allow-read-file"` and `commands.allow = ["read_file"]`. Then reference that identifier in this capability's `permissions` array.

**Rust:** In the same file as `tauri::generate_handler![]`, command functions must not be `pub` or you get "`__cmd__*` defined multiple times". Use `fn` (no `pub`) or move commands to a separate module and use `mod::command_name` in the handler.
