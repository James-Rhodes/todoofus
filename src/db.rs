use std::collections::HashMap;

use sqlx::{
    SqlitePool,
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
};

use crate::todos::{
    TodoForCreate, TodoForSetCompletion, TodoForSetDescription, TodoInfo, TodoRelationRow, TodoRow,
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

        sqlx::migrate!("./migrations").run(&pool).await?;
        Ok(Self { pool })
    }

    // Poor mans repository pattern

    pub async fn create_todo(&self, todo_for_create: TodoForCreate) -> anyhow::Result<TodoRow> {
        let mut tx = self.pool.begin().await?;

        let todo_item: TodoRow = sqlx::query_as(
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

    pub async fn get_todo_info_for_display(&self) -> anyhow::Result<TodoInfo> {
        // Get all todos that fit any of the following categories:
        // 1. Unfinished
        // 2. An ancestor is unfinished
        // 3. Any from the last week

        let mut con = self.pool.acquire().await?;

        let todo_rows: Vec<TodoRow> = sqlx::query_as(
            r#"
            WITH RECURSIVE related_todos(id) AS (
                -- 1. Base case: start with todos that match condition
                SELECT t.id
                FROM todos t
                WHERE t.completed = 0
                   OR t.created_at >= ?

                UNION

                -- 2. Walk "upwards" to parents
                SELECT tr.parent_id
                FROM todo_relations tr
                JOIN related_todos rt ON rt.id = tr.child_id

                UNION

                -- 3. Walk "downwards" to children
                SELECT tr.child_id
                FROM todo_relations tr
                JOIN related_todos rt ON rt.id = tr.parent_id
            )
            SELECT DISTINCT t.*
            FROM todos t
            JOIN related_todos rt ON t.id = rt.id;
            "#,
        )
        .bind(
            chrono::Utc::now()
                .checked_sub_days(chrono::Days::new(7))
                .expect("Should always be able to subtract 7 days from the current date."),
        )
        .fetch_all(&mut *con)
        .await?;

        let todo_relation_rows: Vec<TodoRelationRow> = sqlx::query_as(
            r#"
            WITH RECURSIVE related_todos(id) AS (
                -- 1. Base case: start with todos that match condition
                SELECT t.id
                FROM todos t
                WHERE t.completed = 0
                   OR t.created_at >= ?

                UNION

                -- 2. Walk "upwards" to parents
                SELECT tr.parent_id
                FROM todo_relations tr
                JOIN related_todos rt ON rt.id = tr.child_id

                UNION

                -- 3. Walk "downwards" to children
                SELECT tr.child_id
                FROM todo_relations tr
                JOIN related_todos rt ON rt.id = tr.parent_id
            )
            SELECT * FROM todo_relations tr
            WHERE parent_id IN (SELECT id FROM related_todos) AND child_id IN (SELECT id FROM related_todos);
            "#,
        )
        .bind(
            chrono::Utc::now()
                .checked_sub_days(chrono::Days::new(7))
                .expect("Should always be able to subtract 7 days from the current date."),
        )
        .fetch_all(&mut *con)
        .await?;

        let mut parent_children_map = HashMap::new();
        for todo_relation in todo_relation_rows {
            let children = parent_children_map
                .entry(todo_relation.parent_id())
                .or_insert(Vec::new());

            children.push(todo_relation.child_id());
        }

        Ok(TodoInfo::new(todo_rows, parent_children_map))
    }

    pub async fn set_todo_completed(
        &self,
        todo_for_completion: Vec<TodoForSetCompletion>,
    ) -> anyhow::Result<()> {
        let mut tx = self.pool.begin().await?;

        for completion in todo_for_completion {
            sqlx::query("UPDATE todos SET completed = ? WHERE id = ?")
                .bind(completion.completed)
                .bind(completion.id)
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;
        Ok(())
    }

    pub async fn set_todo_description(
        &self,
        todo_for_description: TodoForSetDescription,
    ) -> anyhow::Result<()> {
        let mut tx = self.pool.begin().await?;

        sqlx::query("UPDATE todos SET description = ? WHERE id = ?")
            .bind(todo_for_description.description)
            .bind(todo_for_description.id)
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;
        Ok(())
    }
}
