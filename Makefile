# Slack Relay Bot - Docker Commands

.PHONY: help build up down logs restart status clean dev dev-build test

# Default target
help:
	@echo "Available commands:"
	@echo "  build      - Build the Docker image"
	@echo "  up         - Start the application in production mode"
	@echo "  down       - Stop the application"
	@echo "  logs       - Show application logs"
	@echo "  restart    - Restart the application"
	@echo "  status     - Show container status"
	@echo "  clean      - Remove containers and images"
	@echo "  dev        - Start in development mode with live reload"
	@echo "  dev-build  - Build and start in development mode"
	@echo "  test       - Test the application endpoint"

# Production commands
build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f slack-relay-bot

restart:
	docker compose restart slack-relay-bot

status:
	docker compose ps

# Development commands
dev:
	docker compose -f docker-compose.dev.yml up

dev-build:
	docker compose -f docker-compose.dev.yml up --build

# Maintenance commands
clean:
	docker compose down --rmi all --volumes --remove-orphans
	docker compose -f docker-compose.dev.yml down --rmi all --volumes --remove-orphans

# Test command
test:
	@echo "Testing health endpoint..."
	curl -f http://localhost:8005/health || echo "Health check failed"
	@echo ""
	@echo "Testing status endpoint..."
	curl -f http://localhost:8005/status || echo "Status check failed"
	@echo ""
	@echo "Testing message endpoint..."
	curl -X POST http://localhost:8005/test/message \
		-H "Content-Type: application/json" \
		-d '{"userId": "test_user", "message": "Hello, bot!"}' || echo "Message test failed"
