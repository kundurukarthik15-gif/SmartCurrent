# build_render.py
import os
import shutil
import subprocess

def run_cmd(args, cwd=None):
    # On Windows, we need shell=True to find npm/pip in PATH
    use_shell = os.name == 'nt'
    print(f"Running: {' '.join(args)} in {cwd or '.'}")
    subprocess.run(args, cwd=cwd, check=True, shell=use_shell)

def main():
    # 1. Install backend requirements and run setup (only in Render environment)
    if os.getenv("RENDER") == "true":
        print("Render Environment Detected: Installing backend requirements...")
        run_cmd(["pip", "install", "-r", "backend/requirements.txt"])
        print("Running project setup...")
        run_cmd(["python", "setup_project.py"])
    else:
        print("Local Environment Detected: Skipping pip install and setup_project (already configured locally).")
    
    # 2. Build React frontend
    print("Installing frontend dependencies...")
    run_cmd(["npm", "install"], cwd="frontend")
    
    print("Building frontend assets...")
    run_cmd(["npm", "run", "build"], cwd="frontend")
    
    # 3. Copy frontend build output to backend static directory
    src_dir = os.path.join("frontend", "dist")
    dst_dir = os.path.join("backend", "app", "static")
    
    print(f"Copying built assets from {src_dir} to {dst_dir}...")
    if os.path.exists(dst_dir):
        try:
            shutil.rmtree(dst_dir)
        except Exception as e:
            print(f"Warning: could not delete existing static folder: {e}")
            
    os.makedirs(dst_dir, exist_ok=True)
    
    # Copy all files recursively
    for item in os.listdir(src_dir):
        s = os.path.join(src_dir, item)
        d = os.path.join(dst_dir, item)
        if os.path.isdir(s):
            shutil.copytree(s, d)
        else:
            shutil.copy2(s, d)
            
    print("Build and static asset deployment completed successfully!")

if __name__ == "__main__":
    main()
