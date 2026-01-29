#!/bin/bash

# Meeting Room Assistant Installer (GitHub CLI version)
# For private repositories - requires GitHub CLI authentication
# Usage: bash <(gh api repos/dvdpearson/mtg/contents/install-gh.sh --jq -r .content | base64 -d)

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
GITHUB_REPO="dvdpearson/mtg"
INSTALL_DIR="$HOME/.local/bin"
BINARY_NAME="mtg"
VERSION="${VERSION:-v1.0.0}"

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

# Check if user is authenticated
if ! gh auth status &> /dev/null; then
  echo -e "${RED}✗ Error: Not authenticated with GitHub CLI${NC}"
  echo -e "${YELLOW}Run: gh auth login${NC}"
  exit 1
fi

# Detect OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin)
    PLATFORM="macos"
    ;;
  Linux)
    PLATFORM="linux"
    ;;
  *)
    echo -e "${RED}✗ Unsupported operating system: $OS${NC}"
    echo -e "${YELLOW}This tool only supports macOS and Linux${NC}"
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64 | amd64)
    ARCH="x64"
    ;;
  arm64 | aarch64)
    ARCH="arm64"
    ;;
  *)
    echo -e "${RED}✗ Unsupported architecture: $ARCH${NC}"
    exit 1
    ;;
esac

echo -e "${YELLOW}Detected platform: ${PLATFORM}-${ARCH}${NC}"
echo -e "${CYAN}Installing version: ${VERSION}${NC}\n"

# Create install directory if it doesn't exist
mkdir -p "$INSTALL_DIR"

# Download binary using gh CLI
BINARY_FILE="mtg-${PLATFORM}-${ARCH}"

echo -e "${CYAN}Downloading Meeting Room Assistant...${NC}\n"

if ! gh release download "${VERSION}" \
  -R "$GITHUB_REPO" \
  -p "$BINARY_FILE" \
  -O "$INSTALL_DIR/$BINARY_NAME" \
  --clobber; then
  echo -e "${RED}✗ Error: Download failed${NC}"
  echo -e "${YELLOW}Please check that you have access to the repository and the release exists${NC}"
  exit 1
fi

# Make binary executable
chmod +x "$INSTALL_DIR/$BINARY_NAME"

echo -e "${GREEN}✓ Binary downloaded and installed to $INSTALL_DIR/$BINARY_NAME${NC}\n"

# Check if install directory is in PATH
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  echo -e "${YELLOW}⚠ Warning: $INSTALL_DIR is not in your PATH${NC}"
  echo -e "${YELLOW}Add this line to your ~/.bashrc, ~/.zshrc, or ~/.profile:${NC}\n"
  echo -e "  ${CYAN}export PATH=\"\$PATH:$INSTALL_DIR\"${NC}\n"

  # Offer to add to shell config
  SHELL_CONFIG=""
  if [ -f "$HOME/.zshrc" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
  elif [ -f "$HOME/.bashrc" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
  elif [ -f "$HOME/.bash_profile" ]; then
    SHELL_CONFIG="$HOME/.bash_profile"
  fi

  if [ -n "$SHELL_CONFIG" ]; then
    read -p "Would you like to add it automatically to $SHELL_CONFIG? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
      echo "" >> "$SHELL_CONFIG"
      echo "# Meeting Room Assistant" >> "$SHELL_CONFIG"
      echo "export PATH=\"\$PATH:$INSTALL_DIR\"" >> "$SHELL_CONFIG"
      echo -e "${GREEN}✓ Added to $SHELL_CONFIG${NC}"
      echo -e "${YELLOW}Please restart your shell or run: source $SHELL_CONFIG${NC}\n"
    fi
  fi
else
  echo -e "${GREEN}✓ $INSTALL_DIR is already in your PATH${NC}\n"
fi

# Setup instructions
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Installation complete!${NC}\n"
echo -e "${CYAN}Next steps:${NC}\n"
echo -e "  1. Run the setup wizard:"
echo -e "     ${CYAN}mtg setup${NC}\n"
echo -e "  2. Start using the tool:"
echo -e "     ${CYAN}mtg${NC}\n"
echo -e "${CYAN}═══════════════════════════════════════════════════════════${NC}\n"
echo -e "For help, run: ${CYAN}mtg --help${NC}\n"
