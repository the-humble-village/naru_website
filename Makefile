.PHONY: dev-backend dev-web dev

dev-backend:
	cd packages/backend && pnpm dev

dev-web:
	cd packages/web && pnpm dev

dev:
	make -j 2 dev-backend dev-web
