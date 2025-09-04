use axum::{Json, http::StatusCode};
use serde::{Deserialize, Serialize};

use crate::errors::TodoofusError;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTodo {
    parent_id: Option<usize>,
    description: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TodoItem {
    // TODO: Actually embed what a todo item contains
    id: usize,
}

pub async fn create_todo(
    Json(payload): Json<CreateTodo>,
) -> Result<(StatusCode, Json<TodoItem>), TodoofusError> {
    println!("Received: {:?}", payload);

    Ok((StatusCode::CREATED, Json(TodoItem { id: 10 })))
}
