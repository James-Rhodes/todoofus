use axum::{Json, extract::State, http::StatusCode};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;

use crate::{db::DB, errors::TodoofusError};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoForCreate {
    pub parent_id: Option<i64>,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct TodoItem {
    // TODO: Actually embed what a todo item contains
    id: i64,
    description: String,
    completed: bool,
    created_at: chrono::DateTime<chrono::Utc>,
}

impl TodoItem {
    pub fn id(&self) -> i64 {
        self.id
    }
}

pub async fn create_todo(
    State(db): State<DB>,
    Json(todo_for_create): Json<TodoForCreate>,
) -> Result<(StatusCode, Json<TodoItem>), TodoofusError> {
    let new_todo = db.create_todo(todo_for_create).await?;

    Ok((StatusCode::CREATED, Json(new_todo)))
}
