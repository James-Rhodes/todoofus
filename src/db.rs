use sqlx::{
    SqlitePool,
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
};

use crate::todos::{TodoForCreate, TodoItem};

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

        sqlx::migrate!("./migrations").run(&pool).await?;
        Ok(Self { pool })
    }

    // Poor mans repository pattern

    pub async fn create_todo(&self, todo_for_create: TodoForCreate) -> anyhow::Result<TodoItem> {
        let mut tx = self.pool.begin().await?;

        let todo_item: TodoItem = sqlx::query_as(
            "INSERT INTO todos(description, completed, created_at) VALUES(?, ?, ?) RETURNING *;",
        )
        .bind(todo_for_create.description)
        .bind(false)
        .bind(chrono::Utc::now())
        .fetch_one(&mut *tx)
        .await?;

        if let Some(parent_id) = todo_for_create.parent_id {
            sqlx::query("INSERT INTO todo_relations(parent_id, child_id) VALUES (?, ?);")
                .bind(parent_id)
                .bind(todo_item.id())
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;
        Ok(todo_item)
    }
}
