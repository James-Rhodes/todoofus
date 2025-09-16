use axum::{
    Router,
    routing::{get, patch, post},
};
use tower_http::services::{ServeDir, ServeFile};

use crate::{
    db::DB,
    todos::{create_todo, get_all_todos, set_todo_completed, set_todo_description},
};

pub fn app(db: DB) -> Router {
    let serve_dir = ServeDir::new("assets").not_found_service(ServeFile::new("assets/index.html"));

    Router::new()
        .route("/todos", get(get_all_todos))
        .route("/todos", post(create_todo))
        .route("/todos/completed", patch(set_todo_completed))
        .route("/todos/description", patch(set_todo_description))
        .fallback_service(serve_dir)
        .with_state(db)
}
