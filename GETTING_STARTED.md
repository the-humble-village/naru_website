# Getting Started

## Prerequisites

Install the following before cloning the repository:

| Tool | Required version | macOS install |
|------|------------------|--------------|
| Node.js | v24 or later | `brew install node` |
| pnpm | v9 or later | `npm install -g pnpm` |
| PostgreSQL | v14 or later | `brew install postgresql@16 && brew services start postgresql@16` |

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd NaruProject
pnpm install
```

This installs all dependencies across the monorepo (shared, backend, and web packages).

### 2. Create PostgreSQL databases

```bash
createdb naru
createdb naru_test
```

`naru` is for local development, `naru_test` is used by the backend test suite.

### 3. Configure environment variables

```bash
cd packages/backend
cp .env.example .env
```

Edit `packages/backend/.env`:

```env
DATABASE_URL=postgresql://<your-pg-username>:<your-pg-password>@127.0.0.1:5432/naru
JWT_SECRET=pick-any-secret-string
JWT_REFRESH_SECRET=pick-a-different-secret-string
PORT=3000
```
Replace `<your-pg-username>` and `<your-pg-password>` with your local PostgreSQL username and password (password can be omitted if your setup uses peer/ident authentication). For many macOS local installs the username is your macOS username — run `whoami` if unsure.


### 5. Build and verify

```bash
# From the project root
pnpm build
pnpm test
```

### 6. Start development servers

Run both development servers from the project root with:

```bash
make dev
```

This starts the backend and web apps together.


## Create SSH keys (ed25519)

Generate a new ed25519 SSH key pair:

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
```

Press Enter to accept the default file location (~/.ssh/id_ed25519), and optionally set a passphrase for added security. To access EC2 instance, send your public key (~/.ssh/id_ed25519.pub) to a current team member who has server access and ask them to add it to the instance's authorized_keys.

## Adding a public SSH key to the server

To grant server access, add the user's public key to the target account on the EC2 instance.

1. Open the public key file, usually `~/.ssh/id_ed25519.pub`.
2. SSH into the server with an account that already has access.
3. Append the public key to `~/.ssh/authorized_keys` for the target user. Make sure to add a comment so we know whose public key it is.
4. Test the login from a new terminal using the corresponding private key.

## Production Database (Prisma Studio)

To inspect the production database with Prisma Studio:

1. SSH into the production server and go to the backend directory:

```bash
cd ~/var/www/backend
```

2. Start Prisma Studio on the server:

```bash
npx prisma studio --port 5555
```

3. From your local machine, create an SSH tunnel to forward port `5555`:

```bash
ssh -i /path/to/pem_file.pem -L 5555:localhost:5555 ec2-user@<server-host>
```

4. Open Prisma Studio locally at:

`http://localhost:5555`
