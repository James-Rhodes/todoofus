use axum::{Router, routing::post};
use tower_http::services::{ServeDir, ServeFile};

use crate::{db::DB, todos::create_todo};

pub fn app(db: DB) -> Router {
    let serve_dir = ServeDir::new("assets").not_found_service(ServeFile::new("assets/index.html"));

    Router::new()
        .route("/todos", post(create_todo))
        .fallback_service(serve_dir)
        .with_state(db)
}
