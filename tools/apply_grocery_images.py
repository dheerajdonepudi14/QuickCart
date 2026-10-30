import csv
import re
import shutil
from pathlib import Path

root = Path(__file__).resolve().parents[1]
dataset = root / "tools" / "GroceryStoreDataset" / "dataset"
out = root / "frontend" / "public" / "product-images"
out.mkdir(parents=True, exist_ok=True)

classes = []
with (dataset / "classes.csv").open(newline="", encoding="utf-8-sig") as f:
    for row in csv.DictReader(f):
        class_id = int(row["Class ID (int)"]) 
        image = dataset / row["Iconic Image Path (str)"].lstrip("/")
        if image.exists():
            target = out / f"class-{class_id}.jpg"
            shutil.copy2(image, target)
            classes.append((class_id, row["Class Name (str)"], row["Coarse Class Name (str)"], target))

if classes:
    shutil.copy2(classes[0][3], out / "grocery-default.jpg")

seed = root / "backend" / "src" / "main" / "resources" / "db" / "migration" / "V2__seed_catalog.sql"
sql = seed.read_text(encoding="utf-8")
updates = []
mapped = 0
for match in re.finditer(r"\((\d+),\s*(\d+),\s*'([^']*(?:''[^']*)*)',.*?image_url\s*\)", sql, re.S):
    pass

# Product rows have a stable id followed by category id and title.
for match in re.finditer(r"^\((\d+),\s*(\d+),\s*'([^']+(?:''[^']+)*)'.*$", sql, re.M):
    product_id = int(match.group(1))
    title = match.group(3).replace("''", "'").lower()
    normalized = re.sub(r"[^a-z0-9]+", " ", title).strip()
    found = None
    aliases = {
        "apple": ["apple", "fruit"], "banana": ["banana"], "avocado": ["avocado"],
        "carrot": ["carrot", "cabbage"], "tomato": ["tomato", "cherry tomato"],
        "onion": ["onion", "shallot"], "potato": ["potato"], "cucumber": ["cucumber"],
        "broccoli": ["broccoli"], "mushroom": ["mushroom"], "lemon": ["lemon"],
        "lime": ["lime"], "orange": ["orange"], "pineapple": ["pineapple"],
        "grape": ["grape"], "milk": ["milk", "cheese", "paneer", "curd", "yogurt", "yoghurt"],
        "bread": ["bread", "brown bread"], "egg": ["egg"], "juice": ["juice", "beverage", "drink"],
        "rice": ["rice"], "pasta": ["pasta"], "bread": ["atta", "flour", "bread", "bun"]
    }
    candidates = sorted(classes, key=lambda c: len(c[1]), reverse=True)
    for class_id, class_name, coarse_name, _ in candidates:
        words = {class_name.lower().replace("-", " "), coarse_name.lower().replace("-", " ")}
        if class_name.lower() == "carrots": words |= {"carrot"}
        if "tomato" in class_name.lower(): words |= {"tomato"}
        if "yellow onion" in class_name.lower(): words |= {"onion"}
        words |= set(aliases.get(class_name.lower().replace("-", " ").split()[-1], []))
        if any(word in normalized.split() or word in normalized for word in words):
            found = class_id
            break
    if found is None:
        found = product_id % len(classes)
    mapped += 1
    updates.append(f"WHEN {product_id} THEN '/product-images/class-{found}.jpg'")

migration = root / "backend" / "src" / "main" / "resources" / "db" / "migration" / "V7__fix_grocery_dataset_images.sql"
case_sql = "\n            ".join(updates)
migration.write_text(f"""-- Ensure each product has a deterministic, product-appropriate grocery image.
UPDATE products
SET image_url = CASE id
            {case_sql}
            ELSE '/product-images/grocery-default.jpg'
END;
""", encoding="utf-8")
print(f"Copied {len(classes)} dataset images; mapped {mapped} seeded products.")
