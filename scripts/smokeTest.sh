#!/bin/bash
#  Copyright (c) 2025. Deutsche Telekom AG
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#  http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#
#  SPDX-License-Identifier: Apache-2.0
#

# Function to delete a directory if it exists
cleanup_directory() {
    TARGET_DIR="playwright/.auth"

    if [ -d "$TARGET_DIR" ]; then
        echo "Directory '$TARGET_DIR' exists. Deleting it..."
        rm -rf "$TARGET_DIR"
        if [ $? -eq 0 ]; then
            echo "Successfully deleted directory '$TARGET_DIR'."
        else
            echo "Error: Failed to delete directory '$TARGET_DIR'."
            exit 1
        fi
    else
        echo "Directory '$TARGET_DIR' does not exist. Skipping cleanup."
    fi
}


# Check if an argument is passed
if [ -z "$1" ]; then
    echo "Error: Please provide a cluster argument."
    echo "Usage: ./run_playwright_tests.sh <cluster>"
    exit 1
fi

# Cluster argument
CLUSTER=$1

# Detect operating system type
OS_TYPE=""

if [[ "$OSTYPE" == "darwin"* ]]; then
    OS_TYPE="mac"
elif [[ "$OSTYPE" == "msys"* || "$OSTYPE" == "cygwin"* || "$OSTYPE" == "win32"* ]]; then
    OS_TYPE="win"
elif [[ "$OSTYPE" == "linux"* ]]; then
    OS_TYPE="linux"
else
    echo "Error: Unsupported operating system '$OSTYPE'. This script supports MacOS, Windows and Linux."
    exit 1
fi

# Call the cleanup function before running tests
cleanup_directory

# Execute the Playwright command. No --grep needed: every cluster project pins
# `grep: /@smokeTest/` in playwright.config.ts, so the tag filter also holds for a direct
# `npx playwright test --project=<cluster>-<os>` that bypasses this script.
echo "Running tests for cluster '$CLUSTER' on OS '$OS_TYPE'..."
remote=true npx playwright test --project="${CLUSTER}-${OS_TYPE}" --trace=on

# Check if the command was successful
if [ $? -eq 0 ]; then
    echo "Tests completed successfully!"
else
    echo "Error: Tests failed to execute."
    exit 1
fi
