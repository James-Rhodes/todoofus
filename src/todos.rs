use std::collections::HashMap;

use axum::{Json, extract::State, http::StatusCode};
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;

use crate::{db::DB, errors::TodoofusError};

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct TodoRow {
    id: i64,
    description: String,
    completed: bool,
    created_at: chrono::DateTime<chrono::Utc>,
}

impl TodoRow {
    pub fn id(&self) -> i64 {
        self.id
    }
}

#[derive(Debug, FromRow)]
pub struct TodoRelationRow {
    parent_id: i64,
    child_id: i64,
}

impl TodoRelationRow {
    pub fn parent_id(&self) -> i64 {
        self.parent_id
    }

    pub fn child_id(&self) -> i64 {
        self.child_id
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TodoForDisplay {
    id: i64,
    description: String,
    completed: bool,
    children: Vec<TodoForDisplay>,
    created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug)]
pub struct TodoInfo {
    todos: Vec<TodoRow>,
    parent_children_map: HashMap<i64, Vec<i64>>, // Parent ID to child ID
}

impl TodoInfo {
    pub fn new(mut todos: Vec<TodoRow>, parent_children_map: HashMap<i64, Vec<i64>>) -> Self {
        todos.sort_by_key(|todo| todo.id()); // Ensure we have the todos sorted by key to start so we can do binary search when creating todo for display
        Self {
            todos,
            parent_children_map,
        }
    }

    fn get_root_nodes(&self) -> Vec<i64> {
        let mut root_nodes = Vec::new();

        let mut all_child_ids: Vec<i64> = self
            .parent_children_map
            .values()
            .flatten()
            .copied()
            .collect();

        all_child_ids.sort();

        for todo in self.todos.iter() {
            let parent_id = todo.id();
            if all_child_ids.binary_search(&parent_id).is_err() {
                // This node is never a child, therefore it is a root
                root_nodes.push(parent_id);
            };
        }

        root_nodes
    }

    fn build_tree(&self, parent_id: i64) -> TodoForDisplay {
        let todo_idx = self
            .todos
            .binary_search_by_key(&parent_id, |todo| todo.id())
            .expect("Parent IDs should always be a part of the todo list");

        let todo_row = &self.todos[todo_idx];

        let mut children = match self.parent_children_map.get(&parent_id) {
            Some(children_ids) => children_ids
                .iter()
                .map(|child_id| self.build_tree(*child_id))
                .collect(),
            None => Vec::new(), // Leaf node so there are no children
        };

        children.sort_by_key(|child| child.created_at);
        children.reverse();

        TodoForDisplay {
            id: todo_row.id,
            description: todo_row.description.clone(),
            completed: todo_row.completed,
            children,
            created_at: todo_row.created_at,
        }
    }

    pub fn into_display(self) -> Vec<TodoForDisplay> {
        let root_nodes = self.get_root_nodes();

        let mut tree: Vec<TodoForDisplay> =
            root_nodes.iter().map(|id| self.build_tree(*id)).collect();

        tree.sort_by_key(|root_node| root_node.created_at);
        tree.reverse();

        tree
    }
}

pub async fn get_all_todos(
    State(db): State<DB>,
) -> Result<(StatusCode, Json<Vec<TodoForDisplay>>), TodoofusError> {
    // Steps:
    // 1. Get all unfinished todos or todos from the last week or the parent is incomplete
    // 2. Create the tree data structure

    tracing::info!("getting all todos");
    let todo_info = db.get_todo_info_for_display().await?;

    Ok((StatusCode::OK, Json(todo_info.into_display())))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoForCreate {
    pub parent_id: Option<i64>,
    pub description: String,
}

pub async fn create_todo(
    State(db): State<DB>,
    Json(todo_for_create): Json<TodoForCreate>,
) -> Result<(StatusCode, Json<TodoRow>), TodoofusError> {
    tracing::info!("creating todo: {:?}", todo_for_create);
    let new_todo = db.create_todo(todo_for_create).await?;

    Ok((StatusCode::CREATED, Json(new_todo)))
}

#[derive(Debug, Deserialize)]
pub struct TodoForSetCompletion {
    pub id: i64,
    pub completed: bool,
}

pub async fn set_todo_completed(
    State(db): State<DB>,
    Json(todo_for_set_completion): Json<Vec<TodoForSetCompletion>>,
) -> Result<StatusCode, TodoofusError> {
    tracing::info!(
        "updating completion of todos: {:?}",
        todo_for_set_completion
    );
    db.set_todo_completed(todo_for_set_completion).await?;

    Ok(StatusCode::CREATED)
}

#[derive(Debug, Deserialize)]
pub struct TodoForSetDescription {
    pub id: i64,
    pub description: String,
}

pub async fn set_todo_description(
    State(db): State<DB>,
    Json(todo_for_set_description): Json<TodoForSetDescription>,
) -> Result<StatusCode, TodoofusError> {
    tracing::info!("updating todo description: {:?}", todo_for_set_description);

    db.set_todo_description(todo_for_set_description).await?;

    Ok(StatusCode::CREATED)
}
