.PHONY: backend frontend dev

dev: 
	pnpm dev &
	pnpm --filter @naru/backend exec prisma studio

backend:
	pnpm --filter @naru/backend exec prisma studio

frontend:
	pnpm dev
