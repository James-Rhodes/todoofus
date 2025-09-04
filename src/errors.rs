use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};

pub struct TodoofusError(anyhow::Error);

impl IntoResponse for TodoofusError {
    fn into_response(self) -> Response {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Internal Server Error: {}", self.0),
        )
            .into_response()
    }
}

impl<E> From<E> for TodoofusError
where
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        Self(err.into())
    }
}
