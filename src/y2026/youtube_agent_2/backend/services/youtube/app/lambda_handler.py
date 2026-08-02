from src.y2026.youtube_agent_2.backend.services.youtube.app.main import app
from src.y2026.youtube_agent_2.backend.shared.platform.lambda_runtime import LambdaApplication

handler = LambdaApplication(app)
