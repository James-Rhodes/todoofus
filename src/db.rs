use sqlx::{
    SqlitePool,
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
};

#[derive(Clone)]
pub struct DB {
    pool: SqlitePool,
}

impl DB {
    pub async fn new(db_path: &str) -> anyhow::Result<DB> {
        // NOTE: Another common option I usually set is cache_size to -256000. Probably not needed
        // for this
        let connect_opts = SqliteConnectOptions::new()
            .filename(db_path)
            .journal_mode(sqlx::sqlite::SqliteJournalMode::Wal)
            .foreign_keys(true)
            .synchronous(sqlx::sqlite::SqliteSynchronous::Normal)
            .create_if_missing(true);

        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(connect_opts)
            .await?;
        Ok(Self { pool })
    }
}
