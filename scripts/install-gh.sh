#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Error handling
set -e
trap 'echo -e "${RED}✗ Installation failed${NC}"; exit 1' ERR

echo -e "${CYAN}"
echo "  ███╗   ███╗████████╗ ██████╗ "
echo "  ████╗ ████║╚══██╔══╝██╔════╝ "
echo "  ██╔████╔██║   ██║   ██║  ███╗"
echo "  ██║╚██╔╝██║   ██║   ██║   ██║"
echo "  ██║ ╚═╝ ██║   ██║   ╚██████╔╝"
echo "  ╚═╝     ╚═╝   ╚═╝    ╚═════╝ "
echo -e "${NC}"
echo -e "${CYAN}Meeting Room Assistant Installer${NC}\n"

# Check if gh is installed
if ! command -v gh &> /dev/null; then
  echo -e "${RED}✗ Error: GitHub CLI (gh) is not installed${NC}"
  echo -e "${YELLOW}Install it from: https://cli.github.com/${NC}"
  exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo -e "${RED}✗ Error: Node.js is not installed${NC}"
  echo -e "${YELLOW}Please install Node.js from https://nodejs.org/${NC}"
  exit 1
fi

# Check Node.js version (need v18 or higher for ES modules)
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
  echo -e "${RED}✗ Error: Node.js v18 or higher is required${NC}"
  echo -e "${YELLOW}Current version: $(node -v)${NC}"
  echo -e "${YELLOW}Please upgrade Node.js from https://nodejs.org/${NC}"
  exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
  echo -e "${RED}✗ Error: npm is not installed${NC}"
  exit 1
fi

echo -e "${CYAN}Installing mtg using GitHub CLI...${NC}"

# Clone the repo
gh repo clone dvdpearson/mtg /tmp/mtg-install

# Install globally
cd /tmp/mtg-install
npm install -g .

# Cleanup
cd -
rm -rf /tmp/mtg-install

echo -e "${GREEN}✓ Installation complete!${NC}\n"
echo -e "${CYAN}Run 'mtg setup' to configure Google Calendar credentials${NC}"
echo -e "${CYAN}Run 'mtg' to start using the tool${NC}"
