use crate::db::DB;

mod db;
mod errors;
mod routes;
mod todos;

const DB_PATH: &str = "todoofus.db";

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let db = DB::new(DB_PATH).await?;
    let app = routes::app(db);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    tracing::info!("Listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await?;

    Ok(())
}
