# push_to_git.py
import subprocess
import sys
from datetime import datetime

def run_command(command):
    """Runs a command, prints its output, and handles errors."""
    print(f"Running command: {' '.join(command)}")
    try:
        # Using text=True to get stdout/stderr as strings
        result = subprocess.run(
            command, check=True, capture_output=True, text=True, encoding='utf-8'
        )
        if result.stdout:
            print(result.stdout)
        if result.stderr:
            # git often prints to stderr for non-error info, so we print it
            print(result.stderr)
        print(f"Successfully executed: {' '.join(command)}\n")
        return True
    except FileNotFoundError:
        print(f"Error: The command '{command[0]}' was not found.")
        print("Please ensure that Git is installed and in your system's PATH.")
        return False
    except subprocess.CalledProcessError as e:
        print(f"Error executing command: {' '.join(command)}")
        print(f"Return code: {e.returncode}")
        if e.stdout:
            print(f"Output:\n{e.stdout}")
        if e.stderr:
            print(f"Error output:\n{e.stderr}")
        return False

def main():
    """Main function to add, commit, and push changes to Git."""
    print("--- Starting Git Push Script ---")

    # 1. Add all files to staging
    if not run_command(["git", "add", "."]):
        print("Failed to add files. Aborting.")
        sys.exit(1)

    # 2. Commit the changes
    if len(sys.argv) > 1:
        commit_message = sys.argv[1]
    else:
        commit_message = f"Automated commit on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"

    # The commit command might fail if there's nothing to commit.
    # We'll proceed to push anyway, as there might be previous unpushed commits.
    run_command(["git", "commit", "-m", commit_message])

    # 3. Push to the remote repository (assuming 'origin' and 'main' branch)
    if not run_command(["git", "push", "origin", "main"]):
        print("Failed to push changes. Please check your connection and repository permissions.")
        sys.exit(1)

    print("--- Git Push Completed Successfully ---")

if __name__ == "__main__":
    main()