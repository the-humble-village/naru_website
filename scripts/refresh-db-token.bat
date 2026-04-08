@echo off
setlocal

:: Configuration
set RDS_HOSTNAME=naru-website-cluster.cluster-cspumw4c8drx.us-east-1.rds.amazonaws.com
set RDS_PORT=5432
set RDS_REGION=us-east-1
set DB_USER=postgres
set DB_NAME=postgres

echo 🔐 Generating RDS IAM Authentication Token...

:: Generate the token using AWS CLI
for /f "tokens=*" %%i in ('aws rds generate-db-auth-token --hostname %RDS_HOSTNAME% --port %RDS_PORT% --region %RDS_REGION% --username %DB_USER%') do set TOKEN=%%i

if "%TOKEN%"=="" (
    echo ❌ Error: Failed to generate AWS RDS token. Are you logged in to AWS CLI?
    exit /b 1
)

echo ✅ Token generated successfully (expires in 15 minutes^).

:: We'll use a temporary powershell command to update the .env file safely with the long token
powershell -Command "$path = 'packages/backend/.env'; $content = Get-Content $path; $newContent = $content -replace '^DATABASE_URL=.*', 'DATABASE_URL=postgresql://%DB_USER%:' + [uri]::EscapeDataString('%TOKEN%') + '@%RDS_HOSTNAME%:%RDS_PORT%/%DB_NAME%?sslmode=verify-full'; $newContent | Set-Content $path"

echo 📝 Updated packages/backend/.env with the new temporary token.
echo.
echo 🚀 You can now run:
echo    pnpm --filter @naru/backend dev
echo    or
echo    npx prisma migrate status
