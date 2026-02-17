//! Cron scheduler with SQLite persistence.
//!
//! Provides scheduled task execution with cron expressions.
//! Uses SQLite with WAL mode for persistence.

use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use cron::Schedule;
use rusqlite::{params, Connection};
use std::path::PathBuf;
use std::str::FromStr;
use uuid::Uuid;

/// A scheduled cron job.
#[derive(Debug, Clone)]
pub struct CronJob {
    pub id: String,
    pub expression: String,
    pub command: String,
    pub next_run: DateTime<Utc>,
    pub last_run: Option<DateTime<Utc>>,
    pub last_status: Option<String>,
    pub paused: bool,
    pub one_shot: bool,
}

/// Cron scheduler with SQLite persistence.
pub struct CronScheduler {
    db_path: PathBuf,
    max_tasks: usize,
}

impl CronScheduler {
    /// Create a new cron scheduler with the given database path.
    pub fn new(db_path: PathBuf, max_tasks: usize) -> Self {
        Self { db_path, max_tasks }
    }

    /// Add a new cron job.
    pub fn add_job(&self, expression: &str, command: &str) -> Result<CronJob> {
        self.check_max_tasks()?;
        let now = Utc::now();
        let next_run = self.next_run_for(expression, now)?;
        let id = Uuid::new_v4().to_string();

        self.with_connection(|conn| {
            conn.execute(
                "INSERT INTO cron_jobs (id, expression, command, created_at, next_run, paused, one_shot)
                 VALUES (?1, ?2, ?3, ?4, ?5, 0, 0)",
                params![
                    id,
                    expression,
                    command,
                    now.to_rfc3339(),
                    next_run.to_rfc3339()
                ],
            )
            .context("Failed to insert cron job")?;
            Ok(())
        })?;

        Ok(CronJob {
            id,
            expression: expression.to_string(),
            command: command.to_string(),
            next_run,
            last_run: None,
            last_status: None,
            paused: false,
            one_shot: false,
        })
    }

    /// Add a one-shot job that runs at a specific time.
    pub fn add_one_shot_job(&self, run_at: DateTime<Utc>, command: &str) -> Result<CronJob> {
        self.add_one_shot_job_with_expression(run_at, command, "@once".to_string())
    }

    /// Add a one-shot job that runs after a delay.
    pub fn add_once(&self, delay: &str, command: &str) -> Result<CronJob> {
        let duration = parse_duration(delay)?;
        let run_at = Utc::now() + duration;
        self.add_one_shot_job_with_expression(run_at, command, format!("@once:{delay}"))
    }

    /// Add a one-shot job that runs at a specific time.
    pub fn add_once_at(&self, at: DateTime<Utc>, command: &str) -> Result<CronJob> {
        self.add_one_shot_job_with_expression(at, command, format!("@at:{}", at.to_rfc3339()))
    }

    fn add_one_shot_job_with_expression(
        &self,
        run_at: DateTime<Utc>,
        command: &str,
        expression: String,
    ) -> Result<CronJob> {
        self.check_max_tasks()?;
        let now = Utc::now();
        if run_at <= now {
            anyhow::bail!("Scheduled time must be in the future");
        }

        let id = Uuid::new_v4().to_string();

        self.with_connection(|conn| {
            conn.execute(
                "INSERT INTO cron_jobs (id, expression, command, created_at, next_run, paused, one_shot)
                 VALUES (?1, ?2, ?3, ?4, ?5, 0, 1)",
                params![id, expression, command, now.to_rfc3339(), run_at.to_rfc3339()],
            )
            .context("Failed to insert one-shot task")?;
            Ok(())
        })?;

        Ok(CronJob {
            id,
            expression,
            command: command.to_string(),
            next_run: run_at,
            last_run: None,
            last_status: None,
            paused: false,
            one_shot: true,
        })
    }

    /// Get a job by ID.
    pub fn get_job(&self, id: &str) -> Result<Option<CronJob>> {
        self.with_connection(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, expression, command, next_run, last_run, last_status, paused, one_shot
                 FROM cron_jobs WHERE id = ?1",
            )?;

            let mut rows = stmt.query_map(params![id], |row| Ok(parse_job_row(row)))?;

            match rows.next() {
                Some(Ok(job_result)) => Ok(Some(job_result?)),
                Some(Err(e)) => Err(e.into()),
                None => Ok(None),
            }
        })
    }

    /// Pause a job.
    pub fn pause_job(&self, id: &str) -> Result<()> {
        let changed = self.with_connection(|conn| {
            conn.execute("UPDATE cron_jobs SET paused = 1 WHERE id = ?1", params![id])
                .context("Failed to pause cron job")
        })?;

        if changed == 0 {
            anyhow::bail!("Cron job '{id}' not found");
        }

        Ok(())
    }

    /// Resume a paused job.
    pub fn resume_job(&self, id: &str) -> Result<()> {
        let changed = self.with_connection(|conn| {
            conn.execute("UPDATE cron_jobs SET paused = 0 WHERE id = ?1", params![id])
                .context("Failed to resume cron job")
        })?;

        if changed == 0 {
            anyhow::bail!("Cron job '{id}' not found");
        }

        Ok(())
    }

    /// List all jobs.
    pub fn list_jobs(&self) -> Result<Vec<CronJob>> {
        self.with_connection(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, expression, command, next_run, last_run, last_status, paused, one_shot
                 FROM cron_jobs ORDER BY next_run ASC",
            )?;

            let rows = stmt.query_map([], |row| Ok(parse_job_row(row)))?;

            let mut jobs = Vec::new();
            for row in rows {
                jobs.push(row??);
            }
            Ok(jobs)
        })
    }

    /// Remove a job.
    pub fn remove_job(&self, id: &str) -> Result<()> {
        let changed = self.with_connection(|conn| {
            conn.execute("DELETE FROM cron_jobs WHERE id = ?1", params![id])
                .context("Failed to delete cron job")
        })?;

        if changed == 0 {
            anyhow::bail!("Cron job '{id}' not found");
        }

        Ok(())
    }

    /// Get jobs that are due to run.
    pub fn due_jobs(&self, now: DateTime<Utc>) -> Result<Vec<CronJob>> {
        self.with_connection(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, expression, command, next_run, last_run, last_status, paused, one_shot
                 FROM cron_jobs WHERE next_run <= ?1 AND paused = 0 ORDER BY next_run ASC",
            )?;

            let rows = stmt.query_map(params![now.to_rfc3339()], |row| Ok(parse_job_row(row)))?;

            let mut jobs = Vec::new();
            for row in rows {
                jobs.push(row??);
            }
            Ok(jobs)
        })
    }

    /// Reschedule a job after it has been run.
    pub fn reschedule_after_run(
        &self,
        job: &CronJob,
        success: bool,
        output: &str,
    ) -> Result<()> {
        if job.one_shot {
            self.with_connection(|conn| {
                conn.execute("DELETE FROM cron_jobs WHERE id = ?1", params![job.id])
                    .context("Failed to remove one-shot task after execution")?;
                Ok(())
            })?;
            return Ok(());
        }

        let now = Utc::now();
        let next_run = self.next_run_for(&job.expression, now)?;
        let status = if success { "ok" } else { "error" };

        self.with_connection(|conn| {
            conn.execute(
                "UPDATE cron_jobs
                 SET next_run = ?1, last_run = ?2, last_status = ?3, last_output = ?4
                 WHERE id = ?5",
                params![
                    next_run.to_rfc3339(),
                    now.to_rfc3339(),
                    status,
                    output,
                    job.id
                ],
            )
            .context("Failed to update cron job run state")?;
            Ok(())
        })
    }

    fn check_max_tasks(&self) -> Result<()> {
        let count = self.with_connection(|conn| {
            let mut stmt = conn.prepare("SELECT COUNT(*) FROM cron_jobs")?;
            let count: i64 = stmt.query_row([], |row| row.get(0))?;
            usize::try_from(count).context("Unexpected negative task count")
        })?;

        if count >= self.max_tasks {
            anyhow::bail!(
                "Maximum number of scheduled tasks ({}) reached",
                self.max_tasks
            );
        }

        Ok(())
    }

    fn next_run_for(&self, expression: &str, from: DateTime<Utc>) -> Result<DateTime<Utc>> {
        let normalized = normalize_expression(expression)?;
        let schedule = Schedule::from_str(&normalized)
            .with_context(|| format!("Invalid cron expression: {expression}"))?;
        schedule
            .after(&from)
            .next()
            .ok_or_else(|| anyhow::anyhow!("No future occurrence for expression: {expression}"))
    }

    fn with_connection<T>(&self, f: impl FnOnce(&Connection) -> Result<T>) -> Result<T> {
        if let Some(parent) = self.db_path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("Failed to create cron directory: {}", parent.display()))?;
        }

        let conn = Connection::open(&self.db_path)
            .with_context(|| format!("Failed to open cron DB: {}", self.db_path.display()))?;

        // Production-grade PRAGMA tuning
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous  = NORMAL;
             PRAGMA mmap_size    = 8388608;
             PRAGMA cache_size   = -2000;
             PRAGMA temp_store   = MEMORY;",
        )
        .context("Failed to set cron DB PRAGMAs")?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS cron_jobs (
                id          TEXT PRIMARY KEY,
                expression  TEXT NOT NULL,
                command     TEXT NOT NULL,
                created_at  TEXT NOT NULL,
                next_run    TEXT NOT NULL,
                last_run    TEXT,
                last_status TEXT,
                last_output TEXT,
                paused      INTEGER NOT NULL DEFAULT 0,
                one_shot    INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_cron_jobs_next_run ON cron_jobs(next_run);",
        )
        .context("Failed to initialize cron schema")?;

        for column in ["paused", "one_shot"] {
            let alter = format!("ALTER TABLE cron_jobs ADD COLUMN {column} INTEGER NOT NULL DEFAULT 0");
            let _ = conn.execute_batch(&alter);
        }

        f(&conn)
    }
}

fn normalize_expression(expression: &str) -> Result<String> {
    let expression = expression.trim();
    let field_count = expression.split_whitespace().count();

    match field_count {
        5 => Ok(format!("0 {expression}")),
        6 | 7 => Ok(expression.to_string()),
        _ => anyhow::bail!(
            "Invalid cron expression: {expression} (expected 5, 6, or 7 fields, got {field_count})"
        ),
    }
}

fn parse_job_row(row: &rusqlite::Row<'_>) -> Result<CronJob> {
    let id: String = row.get(0)?;
    let expression: String = row.get(1)?;
    let command: String = row.get(2)?;
    let next_run_raw: String = row.get(3)?;
    let last_run_raw: Option<String> = row.get(4)?;
    let last_status: Option<String> = row.get(5)?;
    let paused: bool = row.get(6)?;
    let one_shot: bool = row.get(7)?;

    Ok(CronJob {
        id,
        expression,
        command,
        next_run: parse_rfc3339(&next_run_raw)?,
        last_run: match last_run_raw {
            Some(raw) => Some(parse_rfc3339(&raw)?),
            None => None,
        },
        last_status,
        paused,
        one_shot,
    })
}

fn parse_rfc3339(raw: &str) -> Result<DateTime<Utc>> {
    let parsed = DateTime::parse_from_rfc3339(raw)
        .with_context(|| format!("Invalid RFC3339 timestamp in cron DB: {raw}"))?;
    Ok(parsed.with_timezone(&Utc))
}

fn parse_duration(input: &str) -> Result<chrono::Duration> {
    let input = input.trim();
    if input.is_empty() {
        anyhow::bail!("Empty delay string");
    }

    let (num_str, unit) = if input.ends_with(|c: char| c.is_ascii_alphabetic()) {
        let split = input.len() - 1;
        (&input[..split], &input[split..])
    } else {
        (input, "m")
    };

    let n: u64 = num_str
        .trim()
        .parse()
        .with_context(|| format!("Invalid duration number: {num_str}"))?;

    let multiplier: u64 = match unit {
        "s" => 1,
        "m" => 60,
        "h" => 3600,
        "d" => 86400,
        "w" => 604_800,
        _ => anyhow::bail!("Unknown duration unit '{unit}', expected s/m/h/d/w"),
    };

    let secs = n
        .checked_mul(multiplier)
        .filter(|&s| i64::try_from(s).is_ok())
        .ok_or_else(|| anyhow::anyhow!("Duration value too large: {input}"))?;

    #[allow(clippy::cast_possible_wrap)]
    Ok(chrono::Duration::seconds(secs as i64))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn test_scheduler(tmp: &TempDir) -> CronScheduler {
        let db_path = tmp.path().join("cron").join("jobs.db");
        CronScheduler::new(db_path, 100)
    }

    #[test]
    fn add_job_accepts_five_field_expression() {
        let tmp = TempDir::new().unwrap();
        let scheduler = test_scheduler(&tmp);

        let job = scheduler.add_job("*/5 * * * *", "echo ok").unwrap();

        assert_eq!(job.expression, "*/5 * * * *");
        assert_eq!(job.command, "echo ok");
        assert!(!job.one_shot);
        assert!(!job.paused);
    }

    #[test]
    fn add_job_rejects_invalid_field_count() {
        let tmp = TempDir::new().unwrap();
        let scheduler = test_scheduler(&tmp);

        let err = scheduler.add_job("* * * *", "echo bad").unwrap_err();
        assert!(err.to_string().contains("expected 5, 6, or 7 fields"));
    }

    #[test]
    fn add_list_remove_roundtrip() {
        let tmp = TempDir::new().unwrap();
        let scheduler = test_scheduler(&tmp);

        let job = scheduler.add_job("*/10 * * * *", "echo roundtrip").unwrap();
        let listed = scheduler.list_jobs().unwrap();
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].id, job.id);

        scheduler.remove_job(&job.id).unwrap();
        assert!(scheduler.list_jobs().unwrap().is_empty());
    }

    #[test]
    fn add_once_creates_one_shot_job() {
        let tmp = TempDir::new().unwrap();
        let scheduler = test_scheduler(&tmp);

        let job = scheduler.add_once("30m", "echo once").unwrap();
        assert!(job.one_shot);
        assert!(job.expression.starts_with("@once:"));

        let fetched = scheduler.get_job(&job.id).unwrap().unwrap();
        assert!(fetched.one_shot);
        assert!(!fetched.paused);
    }

    #[test]
    fn add_once_at_rejects_past_timestamp() {
        let tmp = TempDir::new().unwrap();
        let scheduler = test_scheduler(&tmp);

        let run_at = Utc::now() - chrono::Duration::minutes(1);
        let err = scheduler.add_once_at(run_at, "echo past").unwrap_err();
        assert!(err.to_string().contains("future"));
    }

    #[test]
    fn get_job_found_and_missing() {
        let tmp = TempDir::new().unwrap();
        let scheduler = test_scheduler(&tmp);

        let job = scheduler.add_job("*/5 * * * *", "echo found").unwrap();
        let found = scheduler.get_job(&job.id).unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().id, job.id);

        let missing = scheduler.get_job("nonexistent").unwrap();
        assert!(missing.is_none());
    }

    #[test]
    fn pause_resume_roundtrip() {
        let tmp = TempDir::new().unwrap();
        let scheduler = test_scheduler(&tmp);

        let job = scheduler.add_job("*/5 * * * *", "echo pause").unwrap();
        scheduler.pause_job(&job.id).unwrap();
        assert!(scheduler.get_job(&job.id).unwrap().unwrap().paused);

        scheduler.resume_job(&job.id).unwrap();
        assert!(!scheduler.get_job(&job.id).unwrap().unwrap().paused);
    }

    #[test]
    fn due_jobs_filters_by_timestamp_and_skips_paused() {
        let tmp = TempDir::new().unwrap();
        let scheduler = test_scheduler(&tmp);

        let active = scheduler.add_job("* * * * *", "echo due").unwrap();
        let paused = scheduler.add_job("* * * * *", "echo paused").unwrap();
        scheduler.pause_job(&paused.id).unwrap();

        let due_now = scheduler.due_jobs(Utc::now()).unwrap();
        assert!(due_now.is_empty(), "new jobs should not be due immediately");

        let far_future = Utc::now() + chrono::Duration::days(365);
        let due_future = scheduler.due_jobs(far_future).unwrap();
        assert_eq!(due_future.len(), 1);
        assert_eq!(due_future[0].id, active.id);
    }

    #[test]
    fn reschedule_after_run_persists_last_status_and_last_run() {
        let tmp = TempDir::new().unwrap();
        let scheduler = test_scheduler(&tmp);

        let job = scheduler.add_job("*/15 * * * *", "echo run").unwrap();
        scheduler.reschedule_after_run(&job, false, "failed output").unwrap();

        let listed = scheduler.list_jobs().unwrap();
        let stored = listed.iter().find(|j| j.id == job.id).unwrap();
        assert_eq!(stored.last_status.as_deref(), Some("error"));
        assert!(stored.last_run.is_some());
    }

    #[test]
    fn reschedule_after_run_removes_one_shot_jobs() {
        let tmp = TempDir::new().unwrap();
        let scheduler = test_scheduler(&tmp);

        let run_at = Utc::now() + chrono::Duration::minutes(1);
        let job = scheduler.add_one_shot_job(run_at, "echo once").unwrap();
        scheduler.reschedule_after_run(&job, true, "ok").unwrap();

        assert!(scheduler.get_job(&job.id).unwrap().is_none());
    }

    #[test]
    fn scheduler_columns_migrate_from_old_schema() {
        let tmp = TempDir::new().unwrap();
        let db_path = tmp.path().join("cron").join("jobs.db");
        std::fs::create_dir_all(db_path.parent().unwrap()).unwrap();

        {
            let conn = rusqlite::Connection::open(&db_path).unwrap();
            conn.execute_batch(
                "CREATE TABLE cron_jobs (
                    id TEXT PRIMARY KEY,
                    expression TEXT NOT NULL,
                    command TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    next_run TEXT NOT NULL,
                    last_run TEXT,
                    last_status TEXT,
                    last_output TEXT
                );",
            )
            .unwrap();
            conn.execute(
                "INSERT INTO cron_jobs (id, expression, command, created_at, next_run)
                 VALUES ('old-job', '* * * * *', 'echo old', '2025-01-01T00:00:00Z', '2030-01-01T00:00:00Z')",
                [],
            )
            .unwrap();
        }

        let scheduler = CronScheduler::new(db_path, 100);
        let jobs = scheduler.list_jobs().unwrap();
        assert_eq!(jobs.len(), 1);
        assert_eq!(jobs[0].id, "old-job");
        assert!(!jobs[0].paused);
        assert!(!jobs[0].one_shot);
    }

    #[test]
    fn max_tasks_limit_is_enforced() {
        let tmp = TempDir::new().unwrap();
        let scheduler = CronScheduler::new(tmp.path().join("cron").join("jobs.db"), 1);

        let _first = scheduler.add_job("*/10 * * * *", "echo first").unwrap();
        let err = scheduler.add_job("*/11 * * * *", "echo second").unwrap_err();
        assert!(err
            .to_string()
            .contains("Maximum number of scheduled tasks"));
    }
}
