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
JWT_SECRET=<paste the first generated secret>
JWT_REFRESH_SECRET=<paste the second generated secret>
PORT=3000
```
Replace `<your-pg-username>` and `<your-pg-password>` with your local PostgreSQL username and password (password can be omitted if your setup uses peer/ident authentication). For many macOS local installs the username is your macOS username — run `whoami` if unsure.

Generate the two secrets — run this twice and use a different output for each:

```bash
openssl rand -base64 48
```

The server checks both at boot and exits with a message if either is under 32 characters or if the two are identical, so made-up placeholder strings will not start it.

### 4. Apply database migrations

Both databases start empty. Create the schema in each:

```bash
cd packages/backend

# Development database (uses DATABASE_URL from .env)
npx prisma migrate dev

# Test database — the suite defaults to your OS username, not "postgres"
DATABASE_URL="postgresql://$(whoami)@127.0.0.1:5432/naru_test" npx prisma migrate deploy
```

Re-run both whenever you pull a branch that adds a migration. If the test suite
reports that a table or column is missing, this is the fix.

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

### 7. Create your first user

There is no self-service signup — accounts are created by an admin at `/admin/users`
in the web UI. On a brand new database there is no admin yet, so seed one by hand.

Generate a password hash:

```bash
cd packages/backend
node -e "require('bcrypt').hash('yourpassword', 12).then(console.log)"
```

Then insert the row, pasting the hash from above:

```bash
psql "$DATABASE_URL" -c "INSERT INTO users (login, password_hash, role, lang, created_at, updated_at) \
  VALUES ('admin', '<paste-hash-here>', 'ADMIN', 'en', now(), now());"
```

(`npx prisma studio` works too, but it can't hash the password for you — you still
need the `node -e` step above.)

Log in at http://localhost:5173 with that login and password. Every user after this
one is created through the admin UI.


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
