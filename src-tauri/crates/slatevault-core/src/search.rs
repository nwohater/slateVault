use rusqlite::Connection;

use crate::error::Result;

pub struct SearchIndex {
    conn: Connection,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct SearchResult {
    pub project: String,
    pub path: String,
    pub title: String,
    pub snippet: String,
    pub rank: f64,
}

impl SearchIndex {
    pub fn open(db_path: &std::path::Path) -> Result<Self> {
        let conn = Connection::open(db_path)?;

        // Enable WAL mode for concurrent access (app + external MCP server)
        let _ = conn.execute_batch("PRAGMA journal_mode=WAL;");
        let _ = conn.execute_batch("PRAGMA busy_timeout=5000;");

        // Check if the table has the new columns, drop and recreate if not
        let has_author = conn
            .prepare("SELECT author FROM documents_fts LIMIT 0")
            .is_ok();

        if !has_author {
            let _ = conn.execute_batch("DROP TABLE IF EXISTS documents_fts;");
        }

        conn.execute_batch(
            "CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
                project,
                path,
                title,
                content,
                tags,
                author,
                status,
                canonical,
                tokenize='porter'
            );",
        )?;
        Ok(Self { conn })
    }

    pub fn index_document(
        &self,
        project: &str,
        path: &str,
        title: &str,
        content: &str,
        tags: &[String],
        author: &str,
        status: &str,
        canonical: bool,
    ) -> Result<()> {
        // Remove existing entry
        self.conn.execute(
            "DELETE FROM documents_fts WHERE project = ?1 AND path = ?2",
            rusqlite::params![project, path],
        )?;
        // Insert new
        self.conn.execute(
            "INSERT INTO documents_fts (project, path, title, content, tags, author, status, canonical) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![project, path, title, content, tags.join(", "), author, status, if canonical { "true" } else { "false" }],
        )?;
        Ok(())
    }

    pub fn search(
        &self,
        query: &str,
        project: Option<&str>,
        limit: usize,
    ) -> Result<Vec<SearchResult>> {
        let (sql, params): (String, Vec<Box<dyn rusqlite::types::ToSql>>) = match project {
            Some(p) => (
                "SELECT project, path, title, snippet(documents_fts, 3, '<b>', '</b>', '...', 32), rank
                 FROM documents_fts
                 WHERE documents_fts MATCH ?1 AND project = ?2
                 ORDER BY rank
                 LIMIT ?3"
                    .to_string(),
                vec![
                    Box::new(query.to_string()),
                    Box::new(p.to_string()),
                    Box::new(limit as i64),
                ],
            ),
            None => (
                "SELECT project, path, title, snippet(documents_fts, 3, '<b>', '</b>', '...', 32), rank
                 FROM documents_fts
                 WHERE documents_fts MATCH ?1
                 ORDER BY rank
                 LIMIT ?2"
                    .to_string(),
                vec![
                    Box::new(query.to_string()),
                    Box::new(limit as i64),
                ],
            ),
        };

        let mut stmt = self.conn.prepare(&sql)?;
        let results = stmt
            .query_map(rusqlite::params_from_iter(params.iter()), |row| {
                Ok(SearchResult {
                    project: row.get(0)?,
                    path: row.get(1)?,
                    title: row.get(2)?,
                    snippet: row.get(3)?,
                    rank: row.get(4)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(results)
    }

    pub fn search_filtered(
        &self,
        query: &str,
        project: Option<&str>,
        author: Option<&str>,
        status: Option<&str>,
        canonical_only: bool,
        limit: usize,
    ) -> Result<Vec<SearchResult>> {
        let mut conditions = vec!["documents_fts MATCH ?1".to_string()];
        let mut params: Vec<Box<dyn rusqlite::types::ToSql>> =
            vec![Box::new(query.to_string())];
        let mut idx = 2;

        if let Some(p) = project {
            conditions.push(format!("project = ?{}", idx));
            params.push(Box::new(p.to_string()));
            idx += 1;
        }
        if let Some(a) = author {
            conditions.push(format!("author = ?{}", idx));
            params.push(Box::new(a.to_string()));
            idx += 1;
        }
        if let Some(s) = status {
            conditions.push(format!("status = ?{}", idx));
            params.push(Box::new(s.to_string()));
            idx += 1;
        }
        if canonical_only {
            conditions.push(format!("canonical = ?{}", idx));
            params.push(Box::new("true".to_string()));
            idx += 1;
        }

        let where_clause = conditions.join(" AND ");
        let sql = format!(
            "SELECT project, path, title, snippet(documents_fts, 3, '<b>', '</b>', '...', 32), rank
             FROM documents_fts
             WHERE {}
             ORDER BY rank
             LIMIT ?{}",
            where_clause, idx
        );
        params.push(Box::new(limit as i64));

        let mut stmt = self.conn.prepare(&sql)?;
        let results = stmt
            .query_map(rusqlite::params_from_iter(params.iter()), |row| {
                Ok(SearchResult {
                    project: row.get(0)?,
                    path: row.get(1)?,
                    title: row.get(2)?,
                    snippet: row.get(3)?,
                    rank: row.get(4)?,
                })
            })?
            .collect::<std::result::Result<Vec<_>, _>>()?;

        Ok(results)
    }

    pub fn remove_document(&self, project: &str, path: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM documents_fts WHERE project = ?1 AND path = ?2",
            rusqlite::params![project, path],
        )?;
        Ok(())
    }
}
