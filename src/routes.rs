use axum::Router;
use tower_http::services::{ServeDir, ServeFile};

use crate::db::DB;

pub fn app(db: DB) -> Router {
    let serve_dir = ServeDir::new("assets").not_found_service(ServeFile::new("assets/index.html"));

    Router::new().fallback_service(serve_dir).with_state(db)
}
