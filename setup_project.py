# setup_project.py
import os
import shutil
import subprocess
import sys

def main():
    print("--- Starting Project Setup ---")
    
    # 1. Create dataset folder and copy images
    print("Creating dataset directory and copying images...")
    src_dir = os.path.join("database", "uploads")
    dst_dir = "dataset"
    os.makedirs(dst_dir, exist_ok=True)
    if os.path.exists(src_dir):
        for item in os.listdir(src_dir):
            s = os.path.join(src_dir, item)
            d = os.path.join(dst_dir, item)
            if os.path.isdir(s):
                shutil.copytree(s, d, dirs_exist_ok=True)
            else:
                shutil.copy2(s, d)
        print(f"Successfully copied images to {dst_dir}/")
    else:
        print("Warning: database/uploads folder not found!")

    # 2. Re-seed database
    print("Re-seeding database...")
    db_path = os.path.join("backend", "smart_bill.db")
    if os.path.exists(db_path):
        try:
            os.remove(db_path)
            print("Deleted old database file.")
        except Exception as e:
            print(f"Warning: could not delete {db_path}: {e}")
            
    # Run seed script inside backend venv if active, or using global python
    # We will try running it using sys.executable first (which is the current python),
    # or fallback to "python"
    try:
        python_bin = sys.executable or "python"
        subprocess.run([python_bin, "database/seed_data.py"], check=True)
        print("Database seeded successfully.")
    except Exception as e:
        print(f"Error seeding database: {e}")

    # 3. Train tabular model
    print("Training ML model...")
    try:
        python_bin = sys.executable or "python"
        subprocess.run([python_bin, "ml/train.py"], check=True)
        print("Model trained successfully.")
    except Exception as e:
        print(f"Error training model: {e}")

    print("--- Project Setup Completed ---")

if __name__ == "__main__":
    main()
