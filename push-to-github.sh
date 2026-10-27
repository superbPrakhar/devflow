#!/usr/bin/env bash
set -e

REPO_URL="https://github.com/superbPrakhar/devflow.git"
BRANCH="main"

echo "=========================================================="
echo "  🚀 Pushing DevFlow to GitHub ($REPO_URL)"
echo "=========================================================="

# Check if git is initialized
if [ ! -d ".git" ]; then
  echo "Initializing git repository..."
  git init -b "$BRANCH"
fi

# Ensure branch is main
git branch -M "$BRANCH"

# Check if remote exists
if git remote | grep -q "^origin$"; then
  echo "Updating origin URL to $REPO_URL..."
  git remote set-url origin "$REPO_URL"
else
  echo "Adding remote origin $REPO_URL..."
  git remote add origin "$REPO_URL"
fi

# Stage and commit
echo "Staging files..."
git add .

if git status --porcelain | grep -q .; then
  echo "Committing files..."
  git commit -m "feat: DevFlow – Full-Stack Issue and Task Tracker initial release"
else
  echo "Working tree is clean, nothing new to commit."
fi

echo ""
echo "Attempting to push to $REPO_URL ($BRANCH)..."
echo "NOTE: If https://github.com/superbPrakhar/devflow has not been created yet,"
echo "create it first at: https://github.com/new"
echo ""

git push -u origin "$BRANCH"

echo ""
echo "=========================================================="
echo "  ✓ Successfully pushed DevFlow to GitHub!"
echo "  URL: https://github.com/superbPrakhar/devflow"
echo "=========================================================="
