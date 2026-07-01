#!/usr/bin/env python3
"""
GitHub Pusher Utility
=====================
A generic, zero-dependency Python utility script to automate initializing,
committing, and pushing local directories/files to GitHub.

Features:
- Validates Git installation and configuration (user.name/email).
- Initializes Git repositories if not already initialized.
- Creates remote repositories on GitHub directly via API (if Personal Access Token provided).
- Adds/updates remote origin URLs (supports SSH, HTTPS, or HTTPS with Token auth).
- Stages files, handles commits, and pushes to remote branches.
- Provides both a rich interactive menu and CLI arguments.
"""

import os
import sys
import subprocess
import argparse
import json
import urllib.request
import urllib.error
from datetime import datetime

# ANSI Color Codes for terminal formatting
class Colors:
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    UNDERLINE = '\033[4m'

def print_status(message, level="info"):
    """Prints formatted logs to the console."""
    if level == "info":
        print(f"{Colors.BLUE}[INFO]{Colors.ENDC} {message}")
    elif level == "success":
        print(f"{Colors.GREEN}[SUCCESS]{Colors.ENDC} {Colors.BOLD}{message}{Colors.ENDC}")
    elif level == "warning":
        print(f"{Colors.WARNING}[WARNING]{Colors.ENDC} {message}")
    elif level == "error":
        print(f"{Colors.FAIL}[ERROR]{Colors.ENDC} {Colors.BOLD}{message}{Colors.ENDC}")
    elif level == "header":
        print(f"\n{Colors.HEADER}{Colors.BOLD}=== {message} ==={Colors.ENDC}\n")

def run_cmd(cmd, cwd=None, input_str=None):
    """Runs a system command using subprocess and returns status and output."""
    try:
        res = subprocess.run(
            cmd,
            cwd=cwd,
            input=input_str,
            capture_output=True,
            text=True,
            encoding='utf-8',
            errors='ignore'
        )
        return res.returncode == 0, res.stdout.strip(), res.stderr.strip()
    except FileNotFoundError:
        return False, "", f"Command not found: {cmd[0]}"
    except Exception as e:
        return False, "", str(e)

def check_git_installed():
    """Checks if Git is installed on the system."""
    success, stdout, _ = run_cmd(["git", "--version"])
    if success:
        print_status(f"Git is installed: {stdout}", "info")
        return True
    else:
        print_status("Git is not found in the system PATH. Please install Git first.", "error")
        return False

def check_git_config(path):
    """Ensures git user.name and user.email are configured, prompting if necessary."""
    # Check user.name
    ok_name, name, _ = run_cmd(["git", "config", "user.name"], cwd=path)
    # Check user.email
    ok_email, email, _ = run_cmd(["git", "config", "user.email"], cwd=path)

    if not name or not email:
        print_status("Git user name or email is not configured.", "warning")
        if not name:
            new_name = input("Enter your Git name (e.g., John Doe): ").strip()
            if new_name:
                run_cmd(["git", "config", "--global", "user.name", new_name], cwd=path)
        if not email:
            new_email = input("Enter your Git email (e.g., john@example.com): ").strip()
            if new_email:
                run_cmd(["git", "config", "--global", "user.email", new_email], cwd=path)
    else:
        print_status(f"Git configured with user: {name} <{email}>", "info")

def create_github_repo(token, repo_name, description="", private=True):
    """Creates a new repository on GitHub via REST API using urllib."""
    print_status(f"Attempting to create GitHub repository '{repo_name}'...", "info")
    url = "https://api.github.com/user/repos"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
    }
    data = {
        "name": repo_name,
        "description": description,
        "private": private,
        "auto_init": False
    }
    
    req = urllib.request.Request(
        url, 
        data=json.dumps(data).encode('utf-8'), 
        headers=headers, 
        method='POST'
    )
    
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            clone_url = res_data.get("clone_url")
            ssh_url = res_data.get("ssh_url")
            print_status(f"Repository created successfully on GitHub!", "success")
            print_status(f"Clone URL: {clone_url}", "info")
            return clone_url, ssh_url
    except urllib.error.HTTPError as e:
        err_body = e.read().decode('utf-8')
        try:
            err_json = json.loads(err_body)
            err_msg = err_json.get("message", err_body)
            # If repo already exists, check errors list
            if "errors" in err_json:
                for error in err_json["errors"]:
                    if error.get("message") == "name already exists on this account":
                        print_status("Repository already exists on your GitHub account.", "warning")
                        # Construct guess clone URL
                        # Requires getting username from API
                        return None, "exists"
            print_status(f"GitHub API Error ({e.code}): {err_msg}", "error")
        except Exception:
            print_status(f"GitHub API Error ({e.code}): {err_body}", "error")
        return None, None
    except Exception as e:
        print_status(f"Failed to connect to GitHub API: {e}", "error")
        return None, None

def get_github_username(token):
    """Fetches GitHub username using the PAT."""
    url = "https://api.github.com/user"
    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json"
    }
    req = urllib.request.Request(url, headers=headers, method='GET')
    try:
        with urllib.request.urlopen(req) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            return res_data.get("login")
    except Exception as e:
        print_status(f"Failed to fetch user profile: {e}", "warning")
        return None

def main():
    parser = argparse.ArgumentParser(
        description="Automate pushing local project directories to GitHub."
    )
    parser.add_argument("--path", default=".", help="Local path to the repository directory (default: current directory)")
    parser.add_argument("--repo-name", help="GitHub repository name")
    parser.add_argument("--token", help="GitHub Personal Access Token (PAT) for auth and/or repo creation")
    parser.add_argument("--remote", help="Git remote URL (HTTPS or SSH)")
    parser.add_argument("--branch", default="main", help="Target branch name (default: main)")
    parser.add_argument("--message", help="Commit message (default: timestamped auto commit)")
    parser.add_argument("--create-private", action="store_true", help="Create GitHub repository as private")
    parser.add_argument("--create-public", action="store_true", help="Create GitHub repository as public")
    parser.add_argument("--interactive", "-i", action="store_true", help="Force interactive mode")

    args = parser.parse_args()
    
    print_status("GitHub Pusher Utility", "header")

    # Determine if we should run interactively
    # We default to interactive if no remote/repo args are provided
    is_interactive = args.interactive or (not args.remote and not args.repo_name and not args.token)
    
    target_path = os.path.abspath(args.path)
    if not os.path.exists(target_path):
        print_status(f"Target path does not exist: {target_path}", "error")
        sys.exit(1)

    print_status(f"Working Directory: {target_path}", "info")

    if not check_git_installed():
        sys.exit(1)

    # 1. Initialize Git repository if not already done
    git_dir = os.path.join(target_path, ".git")
    if not os.path.isdir(git_dir):
        print_status("Git repository not initialized. Initializing git...", "info")
        ok, out, err = run_cmd(["git", "init"], cwd=target_path)
        if not ok:
            print_status(f"Failed to initialize git repository: {err}", "error")
            sys.exit(1)
        print_status("Initialized empty Git repository.", "success")
    else:
        print_status("Existing Git repository detected.", "info")

    # Verify and set configuration
    check_git_config(target_path)

    # Gather inputs
    remote_url = args.remote
    token = args.token
    repo_name = args.repo_name
    branch = args.branch
    commit_msg = args.message
    
    is_private = True
    if args.create_public:
        is_private = False
    elif args.create_private:
        is_private = True

    if is_interactive:
        print_status("Interactive Configuration Prompt", "header")
        
        # Branch
        user_branch = input(f"Enter branch name [{branch}]: ").strip()
        if user_branch:
            branch = user_branch

        # GitHub token
        user_token = input("Enter GitHub Personal Access Token (PAT) [Leave blank if SSH or HTTPS cached]: ").strip()
        if user_token:
            token = user_token

        # Ask to create new repo or push to existing
        choice = input("Do you want to create a NEW repository on GitHub? (y/n) [n]: ").strip().lower()
        if choice in ('y', 'yes'):
            # Fetch repo name
            default_repo_name = os.path.basename(target_path)
            user_repo_name = input(f"Enter GitHub Repository Name [{default_repo_name}]: ").strip()
            repo_name = user_repo_name if user_repo_name else default_repo_name
            
            # Privacy
            priv_choice = input("Make repository private? (y/n) [y]: ").strip().lower()
            is_private = priv_choice not in ('n', 'no')
            
            if not token:
                print_status("A GitHub PAT (Token) is required to automatically create a repository.", "error")
                token = input("Please enter GitHub Personal Access Token (PAT): ").strip()
                if not token:
                    print_status("Token not provided. Cannot auto-create. Will proceed with manual remote URL.", "warning")
        
        # Remote URL (if not creating repo, or fallback)
        if not repo_name or not token:
            default_remote = ""
            ok, current_remotes, _ = run_cmd(["git", "remote", "-v"], cwd=target_path)
            if ok and current_remotes:
                lines = current_remotes.split('\n')
                for line in lines:
                    if 'origin' in line:
                        default_remote = line.split()[1]
                        break
            
            prompt_str = f"Enter Remote Git URL (HTTPS or SSH) [{default_remote}]: " if default_remote else "Enter Remote Git URL (HTTPS or SSH): "
            user_remote = input(prompt_str).strip()
            if user_remote:
                remote_url = user_remote
            elif default_remote:
                remote_url = default_remote

        # Commit message
        default_msg = f"Automated commit: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        user_msg = input(f"Enter commit message [{default_msg}]: ").strip()
        commit_msg = user_msg if user_msg else default_msg

    else:
        # Default commit message if not provided in non-interactive mode
        if not commit_msg:
            commit_msg = f"Automated commit: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

    # 2. Handle GitHub repository creation
    if repo_name and token:
        clone_url, ssh_url = create_github_repo(token, repo_name, description="Created via python helper", private=is_private)
        if clone_url:
            # We construct HTTPS URL with token embedded to allow credential-less push if token is provided
            remote_url = clone_url.replace("https://", f"https://oauth2:{token}@")
        elif ssh_url == "exists":
            # If repo exists, let's construct HTTPS URL based on username
            username = get_github_username(token)
            if username:
                remote_url = f"https://oauth2:{token}@github.com/{username}/{repo_name}.git"
                print_status(f"Targeting existing repository at: https://github.com/{username}/{repo_name}", "info")
            else:
                print_status("Could not resolve username. Please provide the remote URL manually.", "error")
        else:
            if not remote_url:
                print_status("Failed to auto-create repository. Please specify the remote URL manually.", "error")
                sys.exit(1)

    if not remote_url:
        print_status("No remote URL specified or resolved. Cannot push changes.", "error")
        sys.exit(1)

    # 3. Configure Git Remote Origin
    print_status(f"Configuring remote URL: {remote_url.split('@')[-1] if '@' in remote_url else remote_url}", "info")
    ok, current_remotes, _ = run_cmd(["git", "remote"], cwd=target_path)
    if ok and "origin" in current_remotes.split():
        # Update existing origin
        ok, _, err = run_cmd(["git", "remote", "set-url", "origin", remote_url], cwd=target_path)
        if not ok:
            print_status(f"Failed to update remote origin: {err}", "error")
            sys.exit(1)
    else:
        # Add new origin
        ok, _, err = run_cmd(["git", "remote", "add", "origin", remote_url], cwd=target_path)
        if not ok:
            print_status(f"Failed to add remote origin: {err}", "error")
            sys.exit(1)

    # 4. Handle Staging and Comitting
    print_status("Staging all changes (git add .)...", "info")
    ok, _, err = run_cmd(["git", "add", "."], cwd=target_path)
    if not ok:
        print_status(f"Failed to stage changes: {err}", "error")
        sys.exit(1)

    # Check status before committing
    ok, status_out, _ = run_cmd(["git", "status", "--porcelain"], cwd=target_path)
    if not status_out:
        print_status("No modifications to commit. Check remote push anyway...", "info")
    else:
        print_status(f"Committing changes with message: '{commit_msg}'", "info")
        ok, _, err = run_cmd(["git", "commit", "-m", commit_msg], cwd=target_path)
        if not ok:
            print_status(f"Failed to commit changes: {err}", "error")
            # We don't abort here because there might be unpushed commits already

    # 5. Branch management
    # Ensure current branch has the correct name (e.g. main)
    print_status(f"Configuring local branch name to '{branch}'...", "info")
    ok, _, err = run_cmd(["git", "checkout", "-b", branch], cwd=target_path)
    if not ok:
        # If branch already exists, switch to it
        ok, _, err = run_cmd(["git", "checkout", branch], cwd=target_path)
        if not ok:
            print_status(f"Failed to check out branch '{branch}': {err}", "error")
            sys.exit(1)

    # 6. Pushing to GitHub
    print_status(f"Pushing commits to remote branch '{branch}' (origin)...", "info")
    # Hide token in print
    print_status("Executing: git push -u origin <branch>", "info")
    ok, stdout, err = run_cmd(["git", "push", "-u", "origin", branch], cwd=target_path)
    if ok:
        print_status("Push successful!", "success")
        if stdout:
            print(stdout)
    else:
        print_status(f"Failed to push to remote: {err}", "error")
        if "credential" in err or "Permission denied" in err or "fatal: Authentication failed" in err:
            print_status("Authentication failed. Please verify your token or SSH keys.", "warning")
        sys.exit(1)

    print_status("All Git operations completed successfully!", "success")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.")
        sys.exit(1)
