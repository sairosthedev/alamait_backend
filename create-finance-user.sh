#!/bin/bash

# Create a finance user script
# Usage: ./create-finance-user.sh [email] [role] [password]

# Check if the correct number of arguments are provided
if [ "$#" -ne 3 ]; then
    echo "Error: Missing arguments"
    echo "Usage: ./create-finance-user.sh [email] [role] [password]"
    echo "Roles: finance_admin, finance_user"
    exit 1
fi

# Run the finance user creation script
node src/scripts/createFinanceUser.js "$1" "$2" "$3" 