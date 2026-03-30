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
        conn.execute_batch(
            "CREATE VIRTUAL TABLE IF NOT EXISTS documents_fts USING fts5(
                project,
                path,
                title,
                content,
                tags,
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
    ) -> Result<()> {
        // Remove existing entry
        self.conn.execute(
            "DELETE FROM documents_fts WHERE project = ?1 AND path = ?2",
            rusqlite::params![project, path],
        )?;
        // Insert new
        self.conn.execute(
            "INSERT INTO documents_fts (project, path, title, content, tags) VALUES (?1, ?2, ?3, ?4, ?5)",
            rusqlite::params![project, path, title, content, tags.join(", ")],
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

    pub fn remove_document(&self, project: &str, path: &str) -> Result<()> {
        self.conn.execute(
            "DELETE FROM documents_fts WHERE project = ?1 AND path = ?2",
            rusqlite::params![project, path],
        )?;
        Ok(())
    }
}
