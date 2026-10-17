use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Conversation {
    pub id: String,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub model: String,
    pub pinned: i32,
    pub draft: String,
    pub last_preview: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessageRecord {
    pub id: String,
    pub conversation_id: String,
    pub role: String,
    pub content: String,
    pub created_at: i64,
    pub tokens: Option<i64>,
    pub attachments: Option<String>,
    pub tool_calls: Option<String>,
    pub version_index: Option<i32>,
    pub versions: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryEntry {
    pub id: String,
    pub kind: String, // "fact" | "preference" | "project"
    pub text: String,
    pub created_at: i64,
    pub updated_at: i64,
    pub source: String,
    pub pinned: i32,
    pub deleted_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatSearchResult {
    pub conversation_id: String,
    pub message_id: Option<String>,
    pub title: String,
    pub snippet: String,
    pub role: Option<String>,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogEntry {
    pub id: i64,
    pub timestamp: i64,
    pub tool_name: String,
    pub params_summary: String,
    pub status: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReminderEntry {
    pub id: i64,
    pub text: String,
    pub due_time: i64,
    pub status: String,
    pub created_at: i64,
}

pub struct StorageManager {
    conn: Mutex<Connection>,
}

impl StorageManager {
    pub fn new(db_path: PathBuf) -> Result<Self, String> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;
        conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;")
            .map_err(|e| e.to_string())?;

        let manager = Self {
            conn: Mutex::new(conn),
        };
        manager.run_migrations()?;
        Ok(manager)
    }

    fn run_migrations(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let user_version: i32 = conn
            .query_row("PRAGMA user_version;", [], |row| row.get(0))
            .unwrap_or(0);

        if user_version < 1 {
            conn.execute_batch(
                "
                CREATE TABLE IF NOT EXISTS conversations (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    model TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    conversation_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    tokens INTEGER,
                    attachments TEXT,
                    tool_calls TEXT,
                    FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
                );

                CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, created_at);
                PRAGMA user_version = 1;
                ",
            )
            .map_err(|e| e.to_string())?;
        }

        if user_version < 2 {
            conn.execute_batch(
                "
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp INTEGER NOT NULL,
                    tool_name TEXT NOT NULL,
                    params_summary TEXT NOT NULL,
                    status TEXT NOT NULL,
                    error TEXT
                );

                CREATE TABLE IF NOT EXISTS reminders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    text TEXT NOT NULL,
                    due_time INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'pending',
                    created_at INTEGER NOT NULL
                );

                CREATE INDEX IF NOT EXISTS idx_audit_logs_time ON audit_logs(timestamp DESC);
                CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(status, due_time ASC);
                PRAGMA user_version = 2;
                ",
            )
            .map_err(|e| e.to_string())?;
        }

        if user_version < 3 {
            // Milestone 5: Chat management fields, FTS5 tables, Memory & embeddings tables
            let _ = conn.execute("ALTER TABLE conversations ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;", []);
            let _ = conn.execute("ALTER TABLE conversations ADD COLUMN draft TEXT NOT NULL DEFAULT '';", []);
            let _ = conn.execute("ALTER TABLE messages ADD COLUMN version_index INTEGER DEFAULT 1;", []);
            let _ = conn.execute("ALTER TABLE messages ADD COLUMN versions TEXT DEFAULT '';", []);

            conn.execute_batch(
                "
                -- FTS5 full text search for messages and conversation titles
                CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
                    content,
                    conversation_id UNINDEXED,
                    message_id UNINDEXED
                );

                CREATE VIRTUAL TABLE IF NOT EXISTS conversations_fts USING fts5(
                    title,
                    conversation_id UNINDEXED
                );

                -- Memory tables (Milestone 5 Part 2)
                CREATE TABLE IF NOT EXISTS memories (
                    id TEXT PRIMARY KEY,
                    kind TEXT NOT NULL,
                    text TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    source TEXT NOT NULL,
                    pinned INTEGER NOT NULL DEFAULT 0,
                    deleted_at INTEGER
                );

                CREATE TABLE IF NOT EXISTS memory_embeddings (
                    memory_id TEXT PRIMARY KEY,
                    vector BLOB NOT NULL,
                    model_id TEXT NOT NULL,
                    dimension INTEGER NOT NULL,
                    FOREIGN KEY(memory_id) REFERENCES memories(id) ON DELETE CASCADE
                );

                CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
                    text,
                    memory_id UNINDEXED,
                    kind UNINDEXED
                );

                CREATE INDEX IF NOT EXISTS idx_memories_kind ON memories(kind, deleted_at);
                CREATE INDEX IF NOT EXISTS idx_memories_pinned ON memories(pinned DESC, updated_at DESC);

                PRAGMA user_version = 3;
                ",
            )
            .map_err(|e| e.to_string())?;

            // Populate initial FTS5 index if not empty
            let _ = conn.execute(
                "INSERT OR IGNORE INTO messages_fts(content, conversation_id, message_id)
                 SELECT content, conversation_id, id FROM messages;",
                [],
            );
            let _ = conn.execute(
                "INSERT OR IGNORE INTO conversations_fts(title, conversation_id)
                 SELECT title, id FROM conversations;",
                [],
            );
        }

        Ok(())
    }

    // ==========================================
    // Conversation Management (Milestone 5 Part 1)
    // ==========================================

    pub fn list_conversations(&self) -> Result<Vec<Conversation>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT c.id, c.title, c.created_at, c.updated_at, c.model,
                        COALESCE(c.pinned, 0), COALESCE(c.draft, ''),
                        (SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_preview
                 FROM conversations c
                 ORDER BY c.pinned DESC, c.updated_at DESC",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                Ok(Conversation {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    created_at: row.get(2)?,
                    updated_at: row.get(3)?,
                    model: row.get(4)?,
                    pinned: row.get(5)?,
                    draft: row.get(6)?,
                    last_preview: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for r in rows {
            if let Ok(c) = r {
                list.push(c);
            }
        }
        Ok(list)
    }

    pub fn create_conversation(
        &self,
        id: String,
        title: String,
        model: String,
    ) -> Result<Conversation, String> {
        let now = chrono_now_ms();
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO conversations (id, title, created_at, updated_at, model, pinned, draft)
             VALUES (?1, ?2, ?3, ?4, ?5, 0, '')",
            params![id, title, now, now, model],
        )
        .map_err(|e| e.to_string())?;

        let _ = conn.execute(
            "INSERT INTO conversations_fts(title, conversation_id) VALUES (?1, ?2)",
            params![title, id],
        );

        Ok(Conversation {
            id,
            title,
            created_at: now,
            updated_at: now,
            model,
            pinned: 0,
            draft: String::new(),
            last_preview: None,
        })
    }

    pub fn rename_conversation(&self, id: String, new_title: String) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono_now_ms();
        conn.execute(
            "UPDATE conversations SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![new_title, now, id],
        )
        .map_err(|e| e.to_string())?;

        let _ = conn.execute(
            "DELETE FROM conversations_fts WHERE conversation_id = ?1",
            params![id],
        );
        let _ = conn.execute(
            "INSERT INTO conversations_fts(title, conversation_id) VALUES (?1, ?2)",
            params![new_title, id],
        );

        Ok(())
    }

    pub fn pin_conversation(&self, id: String, pinned: bool) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let val = if pinned { 1 } else { 0 };
        conn.execute(
            "UPDATE conversations SET pinned = ?1 WHERE id = ?2",
            params![val, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn save_draft(&self, id: String, draft: String) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE conversations SET draft = ?1 WHERE id = ?2",
            params![draft, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn duplicate_conversation(&self, id: String, new_id: String) -> Result<Conversation, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono_now_ms();

        // 1. Get original conversation
        let mut orig_stmt = conn
            .prepare("SELECT title, model FROM conversations WHERE id = ?1")
            .map_err(|e| e.to_string())?;
        let (title, model): (String, String) = orig_stmt
            .query_row(params![id], |r| Ok((r.get(0)?, r.get(1)?)))
            .map_err(|e| e.to_string())?;

        let new_title = format!("{} (Copy)", title);

        // 2. Insert new conversation
        conn.execute(
            "INSERT INTO conversations (id, title, created_at, updated_at, model, pinned, draft)
             VALUES (?1, ?2, ?3, ?4, ?5, 0, '')",
            params![new_id, new_title, now, now, model],
        )
        .map_err(|e| e.to_string())?;

        let _ = conn.execute(
            "INSERT INTO conversations_fts(title, conversation_id) VALUES (?1, ?2)",
            params![new_title, new_id],
        );

        // 3. Copy all messages
        let mut msg_stmt = conn
            .prepare("SELECT role, content, created_at, tokens, attachments, tool_calls, version_index, versions FROM messages WHERE conversation_id = ?1 ORDER BY created_at ASC")
            .map_err(|e| e.to_string())?;

        let msgs = msg_stmt
            .query_map(params![id], |r| {
                Ok((
                    r.get::<_, String>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, i64>(2)?,
                    r.get::<_, Option<i64>>(3)?,
                    r.get::<_, Option<String>>(4)?,
                    r.get::<_, Option<String>>(5)?,
                    r.get::<_, Option<i32>>(6)?,
                    r.get::<_, Option<String>>(7)?,
                ))
            })
            .map_err(|e| e.to_string())?;

        let mut idx = 0;
        for m in msgs.flatten() {
            idx += 1;
            let msg_id = format!("msg-copy-{}-{}", now, idx);
            let _ = conn.execute(
                "INSERT INTO messages (id, conversation_id, role, content, created_at, tokens, attachments, tool_calls, version_index, versions)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![msg_id, new_id, m.0, m.1, m.2, m.3, m.4, m.5, m.6, m.7],
            );
            let _ = conn.execute(
                "INSERT INTO messages_fts(content, conversation_id, message_id) VALUES (?1, ?2, ?3)",
                params![m.1, new_id, msg_id],
            );
        }

        Ok(Conversation {
            id: new_id,
            title: new_title,
            created_at: now,
            updated_at: now,
            model,
            pinned: 0,
            draft: String::new(),
            last_preview: None,
        })
    }

    pub fn clear_messages(&self, conversation_id: String) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM messages WHERE conversation_id = ?1", params![conversation_id])
            .map_err(|e| e.to_string())?;
        let _ = conn.execute("DELETE FROM messages_fts WHERE conversation_id = ?1", params![conversation_id]);
        let now = chrono_now_ms();
        let _ = conn.execute("UPDATE conversations SET updated_at = ?1, draft = '' WHERE id = ?2", params![now, conversation_id]);
        Ok(())
    }

    pub fn delete_conversation(&self, id: String) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        // Delete messages first to clean FTS
        let _ = conn.execute("DELETE FROM messages_fts WHERE conversation_id = ?1", params![id]);
        let _ = conn.execute("DELETE FROM conversations_fts WHERE conversation_id = ?1", params![id]);
        conn.execute("DELETE FROM messages WHERE conversation_id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM conversations WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn search_chats(&self, query: String) -> Result<Vec<ChatSearchResult>, String> {
        let trimmed = query.trim();
        if trimmed.is_empty() {
            return Ok(Vec::new());
        }

        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let fts_query = format!("*{}*", trimmed.replace('"', "\"\""));

        let mut results = Vec::new();

        // 1. Search messages content via FTS5
        let mut msg_stmt = conn
            .prepare(
                "SELECT m.conversation_id, m.id, c.title, m.content, m.role, c.updated_at
                 FROM messages_fts f
                 JOIN messages m ON m.id = f.message_id
                 JOIN conversations c ON c.id = m.conversation_id
                 WHERE messages_fts MATCH ?1
                 ORDER BY m.created_at DESC LIMIT 15",
            )
            .map_err(|e| e.to_string())?;

        let rows = msg_stmt
            .query_map(params![fts_query], |row| {
                let full_content: String = row.get(3)?;
                // Generate a concise snippet around matched term
                let snippet = if full_content.len() > 120 {
                    format!("{}...", &full_content[..117])
                } else {
                    full_content
                };

                Ok(ChatSearchResult {
                    conversation_id: row.get(0)?,
                    message_id: Some(row.get(1)?),
                    title: row.get(2)?,
                    snippet,
                    role: Some(row.get(4)?),
                    updated_at: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?;

        for r in rows.flatten() {
            results.push(r);
        }

        // 2. Search conversation titles via FTS5
        let mut conv_stmt = conn
            .prepare(
                "SELECT c.id, c.title, c.updated_at,
                        COALESCE((SELECT m.content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1), 'Empty chat')
                 FROM conversations_fts f
                 JOIN conversations c ON c.id = f.conversation_id
                 WHERE conversations_fts MATCH ?1
                 LIMIT 5",
            )
            .map_err(|e| e.to_string())?;

        let conv_rows = conv_stmt
            .query_map(params![fts_query], |row| {
                let conv_id: String = row.get(0)?;
                let title: String = row.get(1)?;
                let updated_at: i64 = row.get(2)?;
                let last_content: String = row.get(3)?;

                let snippet = if last_content.len() > 100 {
                    format!("{}...", &last_content[..97])
                } else {
                    last_content
                };

                Ok(ChatSearchResult {
                    conversation_id: conv_id,
                    message_id: None,
                    title,
                    snippet,
                    role: None,
                    updated_at,
                })
            })
            .map_err(|e| e.to_string())?;

        for r in conv_rows.flatten() {
            // Avoid duplicates if conversation already matched by message
            if !results.iter().any(|existing| existing.conversation_id == r.conversation_id && existing.message_id.is_none()) {
                results.push(r);
            }
        }

        Ok(results)
    }

    pub fn get_messages(&self, conversation_id: String) -> Result<Vec<MessageRecord>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, conversation_id, role, content, created_at, tokens, attachments, tool_calls,
                        version_index, versions
                 FROM messages WHERE conversation_id = ?1 ORDER BY created_at ASC",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![conversation_id], |row| {
                Ok(MessageRecord {
                    id: row.get(0)?,
                    conversation_id: row.get(1)?,
                    role: row.get(2)?,
                    content: row.get(3)?,
                    created_at: row.get(4)?,
                    tokens: row.get(5)?,
                    attachments: row.get(6)?,
                    tool_calls: row.get(7)?,
                    version_index: row.get(8).unwrap_or(Some(1)),
                    versions: row.get(9).unwrap_or(None),
                })
            })
            .map_err(|e| e.to_string())?;

        let mut msgs = Vec::new();
        for r in rows.flatten() {
            msgs.push(r);
        }
        Ok(msgs)
    }

    pub fn save_message(&self, msg: MessageRecord) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono_now_ms();
        conn.execute(
            "INSERT OR REPLACE INTO messages (id, conversation_id, role, content, created_at, tokens, attachments, tool_calls, version_index, versions)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                msg.id,
                msg.conversation_id,
                msg.role,
                msg.content,
                msg.created_at,
                msg.tokens,
                msg.attachments,
                msg.tool_calls,
                msg.version_index.unwrap_or(1),
                msg.versions.unwrap_or_default()
            ],
        )
        .map_err(|e| e.to_string())?;

        // Update FTS index
        let _ = conn.execute(
            "DELETE FROM messages_fts WHERE message_id = ?1",
            params![msg.id],
        );
        let _ = conn.execute(
            "INSERT INTO messages_fts(content, conversation_id, message_id) VALUES (?1, ?2, ?3)",
            params![msg.content, msg.conversation_id, msg.id],
        );

        // Update conversation updated_at
        let _ = conn.execute(
            "UPDATE conversations SET updated_at = ?1 WHERE id = ?2",
            params![now, msg.conversation_id],
        );

        Ok(())
    }

    pub fn export_markdown(&self, conversation_id: String) -> Result<String, String> {
        let convs = self.list_conversations()?;
        let conv = convs
            .into_iter()
            .find(|c| c.id == conversation_id)
            .ok_or_else(|| "Conversation not found".to_string())?;

        let msgs = self.get_messages(conversation_id)?;
        let mut md = format!("# {}\n\n*Model: {}*\n\n---\n\n", conv.title, conv.model);

        for m in msgs {
            let role_name = match m.role.as_str() {
                "user" => "**User**",
                "assistant" => "**Mintu**",
                _ => "**System**",
            };
            md.push_str(&format!("### {}\n\n{}\n\n", role_name, m.content));
        }

        Ok(md)
    }

    // ==========================================
    // Memory Management (Milestone 5 Part 2)
    // ==========================================

    pub fn save_memory(&self, memory: MemoryEntry) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono_now_ms();
        conn.execute(
            "INSERT OR REPLACE INTO memories (id, kind, text, created_at, updated_at, source, pinned, deleted_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                memory.id,
                memory.kind,
                memory.text,
                memory.created_at,
                now,
                memory.source,
                memory.pinned,
                memory.deleted_at
            ],
        )
        .map_err(|e| e.to_string())?;

        // Update FTS5
        let _ = conn.execute("DELETE FROM memories_fts WHERE memory_id = ?1", params![memory.id]);
        if memory.deleted_at.is_none() {
            let _ = conn.execute(
                "INSERT INTO memories_fts(text, memory_id, kind) VALUES (?1, ?2, ?3)",
                params![memory.text, memory.id, memory.kind],
            );
        }

        Ok(())
    }

    pub fn list_memories(&self) -> Result<Vec<MemoryEntry>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, kind, text, created_at, updated_at, source, pinned, deleted_at
                 FROM memories
                 WHERE deleted_at IS NULL
                 ORDER BY pinned DESC, updated_at DESC",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                Ok(MemoryEntry {
                    id: row.get(0)?,
                    kind: row.get(1)?,
                    text: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                    source: row.get(5)?,
                    pinned: row.get(6)?,
                    deleted_at: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for r in rows.flatten() {
            list.push(r);
        }
        Ok(list)
    }

    pub fn search_memories(&self, query: String) -> Result<Vec<MemoryEntry>, String> {
        let trimmed = query.trim();
        if trimmed.is_empty() {
            return self.list_memories();
        }

        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let fts_query = format!("*{}*", trimmed.replace('"', "\"\""));

        let mut stmt = conn
            .prepare(
                "SELECT m.id, m.kind, m.text, m.created_at, m.updated_at, m.source, m.pinned, m.deleted_at
                 FROM memories_fts f
                 JOIN memories m ON m.id = f.memory_id
                 WHERE memories_fts MATCH ?1 AND m.deleted_at IS NULL
                 ORDER BY m.pinned DESC, m.updated_at DESC LIMIT 10",
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![fts_query], |row| {
                Ok(MemoryEntry {
                    id: row.get(0)?,
                    kind: row.get(1)?,
                    text: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                    source: row.get(5)?,
                    pinned: row.get(6)?,
                    deleted_at: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for r in rows.flatten() {
            list.push(r);
        }
        Ok(list)
    }

    pub fn pin_memory(&self, id: String, pinned: bool) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let val = if pinned { 1 } else { 0 };
        conn.execute(
            "UPDATE memories SET pinned = ?1 WHERE id = ?2",
            params![val, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_memory(&self, id: String) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono_now_ms();
        // Soft delete
        conn.execute(
            "UPDATE memories SET deleted_at = ?1 WHERE id = ?2",
            params![now, id],
        )
        .map_err(|e| e.to_string())?;

        let _ = conn.execute("DELETE FROM memories_fts WHERE memory_id = ?1", params![id]);
        Ok(())
    }

    pub fn forget_all_memories(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM memories", [])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM memories_fts", [])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM memory_embeddings", [])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn export_memories_markdown(&self) -> Result<String, String> {
        let memories = self.list_memories()?;
        let mut md = String::from("# Mintu User Memories\n\n*Exported from Mintu Desktop Companion*\n\n---\n\n");

        if memories.is_empty() {
            md.push_str("*No memories saved yet.*\n");
            return Ok(md);
        }

        for m in memories {
            let pin_tag = if m.pinned == 1 { " [PINNED]" } else { "" };
            md.push_str(&format!(
                "### [{}] {}{}\n- **Saved:** {}\n- **Source:** {}\n\n",
                m.kind.to_uppercase(),
                m.text,
                pin_tag,
                m.created_at,
                m.source
            ));
        }

        Ok(md)
    }

    // ==========================================
    // Audit Logs & Reminders (Milestones 2 & 4)
    // ==========================================

    pub fn save_audit_log(
        &self,
        tool_name: String,
        params_summary: String,
        status: String,
        error: Option<String>,
    ) -> Result<i64, String> {
        let now = chrono_now_ms();
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO audit_logs (timestamp, tool_name, params_summary, status, error) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![now, tool_name, params_summary, status, error],
        )
        .map_err(|e| e.to_string())?;
        Ok(conn.last_insert_rowid())
    }

    pub fn list_audit_logs(&self, limit: u32) -> Result<Vec<AuditLogEntry>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, timestamp, tool_name, params_summary, status, error FROM audit_logs ORDER BY timestamp DESC LIMIT ?1")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![limit], |row| {
                Ok(AuditLogEntry {
                    id: row.get(0)?,
                    timestamp: row.get(1)?,
                    tool_name: row.get(2)?,
                    params_summary: row.get(3)?,
                    status: row.get(4)?,
                    error: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for r in rows.flatten() {
            list.push(r);
        }
        Ok(list)
    }

    pub fn clear_audit_logs(&self) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM audit_logs", [])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn create_reminder(&self, text: String, due_time: i64) -> Result<ReminderEntry, String> {
        let now = chrono_now_ms();
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "INSERT INTO reminders (text, due_time, status, created_at) VALUES (?1, ?2, 'pending', ?3)",
            params![text, due_time, now],
        )
        .map_err(|e| e.to_string())?;
        let id = conn.last_insert_rowid();
        Ok(ReminderEntry {
            id,
            text,
            due_time,
            status: "pending".to_string(),
            created_at: now,
        })
    }

    pub fn list_reminders(&self) -> Result<Vec<ReminderEntry>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, text, due_time, status, created_at FROM reminders ORDER BY due_time ASC")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                Ok(ReminderEntry {
                    id: row.get(0)?,
                    text: row.get(1)?,
                    due_time: row.get(2)?,
                    status: row.get(3)?,
                    created_at: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for r in rows.flatten() {
            list.push(r);
        }
        Ok(list)
    }

    pub fn get_due_reminders(&self) -> Result<Vec<ReminderEntry>, String> {
        let now = chrono_now_ms();
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, text, due_time, status, created_at FROM reminders WHERE status = 'pending' AND due_time <= ?1")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(params![now], |row| {
                Ok(ReminderEntry {
                    id: row.get(0)?,
                    text: row.get(1)?,
                    due_time: row.get(2)?,
                    status: row.get(3)?,
                    created_at: row.get(4)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut list = Vec::new();
        for r in rows.flatten() {
            list.push(r);
        }
        Ok(list)
    }

    pub fn update_reminder_status(&self, id: i64, status: String) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE reminders SET status = ?1 WHERE id = ?2",
            params![status, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn delete_reminder(&self, id: i64) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM reminders WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

fn chrono_now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}
