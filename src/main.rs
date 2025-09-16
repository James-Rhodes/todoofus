use crate::db::DB;

mod db;
mod errors;
mod routes;
mod todos;

const DB_PATH: &str = "./data/";

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();
    tracing::info!("Beginning todoofus");

    if let Err(e) = run().await {
        eprintln!("Application error: {:?}", e);
        std::process::exit(1);
    }
}

async fn run() -> anyhow::Result<()> {
    let db = DB::new(DB_PATH).await?;
    tracing::info!("Created DB");
    let app = routes::app(db);
    tracing::info!("Created App");

    let listener = tokio::net::TcpListener::bind("0.0.0.0:3000").await?;
    tracing::info!("Listening on {}", listener.local_addr().unwrap());
    axum::serve(listener, app).await?;

    Ok(())
}
