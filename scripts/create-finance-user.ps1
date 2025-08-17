# Create a finance user script
# Usage: .\create-finance-user.ps1 [email] [role] [password]

# Check if the correct number of arguments are provided
if ($args.Length -ne 3) {
    Write-Host "Error: Missing arguments" -ForegroundColor Red
    Write-Host "Usage: .\create-finance-user.ps1 [email] [role] [password]"
    Write-Host "Roles: finance_admin, finance_user"
    exit 1
}

# Extract arguments
$email = $args[0]
$role = $args[1]
$password = $args[2]

# Run the finance user creation script
node src/scripts/createFinanceUser.js $email $role $password 