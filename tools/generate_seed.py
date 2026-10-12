"""Generates backend/src/main/resources/db/migration/V2__seed_catalog.sql.

Run:  python3 tools/generate_seed.py
Images: image_url holds an emoji for the built-in illustrated tiles. Replace it with an
https:// or /path image URL at any time (admin or SQL) and the storefront renders the photo.
"""
import json, random, pathlib

random.seed(42)

STORES = [
    ("BLR-KOR-01", "Koramangala Hub", "80 Feet Rd, 4th Block, Koramangala", "Bengaluru", "560034", 12.9352, 77.6245),
    ("BLR-IND-02", "Indiranagar Hub", "100 Feet Rd, HAL 2nd Stage", "Bengaluru", "560038", 12.9719, 77.6412),
    ("MUM-AND-01", "Andheri West Hub", "Lokhandwala Complex, Andheri West", "Mumbai", "400053", 19.1364, 72.8296),
    ("DEL-SAK-01", "Saket Hub", "Press Enclave Marg, Saket", "New Delhi", "110017", 28.5245, 77.2066),
    ("HYD-MAD-01", "Madhapur Hub", "Hitech City Rd, Madhapur", "Hyderabad", "500081", 17.4483, 78.3915),
    ("CHE-TNG-01", "T. Nagar Hub", "Usman Rd, T. Nagar", "Chennai", "600017", 13.0418, 80.2341),
    ("PUN-KOT-01", "Kothrud Hub", "Karve Rd, Kothrud", "Pune", "411038", 18.5074, 73.8077),
]

# slug, name, emoji, department, theme colour
CATEGORIES = [
    ("fruits-vegetables", "Fruits & Vegetables", "🥦", "Grocery & Kitchen", "#E3F1DA"),
    ("dairy-bread-eggs", "Milk & Dairies", "🥛", "Grocery & Kitchen", "#E6F0FA"),
    ("atta-rice-dal", "Food Grains & Oils", "🌾", "Grocery & Kitchen", "#F6EBD4"),
    ("masala-oils-ghee", "Masala, Oil & Ghee", "🫙", "Grocery & Kitchen", "#FBE7D6"),
    ("meat-seafood", "Meat & Seafood", "🍗", "Grocery & Kitchen", "#FBE3E1"),
    ("breakfast-instant", "Breakfast & Instant Food", "🥣", "Grocery & Kitchen", "#FFF1CF"),
    ("frozen-ice-cream", "Ice Creams & Frozen", "🍦", "Grocery & Kitchen", "#E8ECFB"),
    ("snacks-munchies", "Snacks & Branded Foods", "🍟", "Snacks & Drinks", "#D6F1F4"),
    ("sweets-chocolates", "Sweets & Chocolates", "🍫", "Snacks & Drinks", "#F2E3DA"),
    ("beverages", "Cold Drinks & Juices", "🧃", "Snacks & Drinks", "#E1F4E6"),
    ("tea-coffee", "Tea, Coffee & Health Drinks", "☕", "Snacks & Drinks", "#EFE4D8"),
    ("brews-mixers", "Brewery, Brews & Mixers", "🍺", "Snacks & Drinks", "#FFF3C9"),
    ("skin-care", "Skin Care", "🧴", "Beauty & Personal Care", "#FCE9EE"),
    ("hair-care", "Hair Care", "💆", "Beauty & Personal Care", "#EFE6F8"),
    ("mens-grooming", "Men's Grooming", "🪒", "Beauty & Personal Care", "#E5ECF1"),
    ("bath-body", "Bath & Body", "🛁", "Beauty & Personal Care", "#E2F3F6"),
    ("oral-care", "Oral Care", "🪥", "Beauty & Personal Care", "#E4F4F0"),
    ("makeup", "Makeup & Beauty", "💄", "Beauty & Personal Care", "#FBE4EA"),
    ("baby-care", "Baby Care & Accessories", "🍼", "Household & Lifestyle", "#FDF0DC"),
    ("health-wellness", "Health & Wellness", "💊", "Household & Lifestyle", "#E7F5E9"),
    ("cleaning-household", "Cleaning & Household", "🧽", "Household & Lifestyle", "#E3EEF9"),
    ("home-kitchen", "Crockery & Cutlery", "🍳", "Household & Lifestyle", "#F1EEE8"),
    ("pet-care", "Pet Care", "🐾", "Household & Lifestyle", "#F6ECDF"),
    ("seeds-saplings", "Seeds & Saplings", "🌱", "Farm & Garden", "#E4F2DC"),
    ("fertilizers-plant-care", "Fertilizers & Plant Protection", "🧪", "Farm & Garden", "#EEF3D9"),
    ("farm-garden-tools", "Farm & Garden Tools", "🧑‍🌾", "Farm & Garden", "#F3EAD8"),
]

# title, brand, unit, mrp, emoji, tags
P = {
 "fruits-vegetables": [
  ("Fresh Tomato (Hybrid)", "Fresho", "500 g", 40, "🍅", "vegetable,fresh"),
  ("Onion", "Fresho", "1 kg", 55, "🧅", "vegetable"),
  ("Potato", "Fresho", "1 kg", 45, "🥔", "vegetable"),
  ("Robusta Banana", "Fresho", "6 pcs", 60, "🍌", "fruit"),
  ("Shimla Apple", "Fresho", "4 pcs (~600 g)", 180, "🍎", "fruit"),
  ("Broccoli", "Fresho", "250 g", 90, "🥦", "exotic,vegetable"),
  ("Carrot (Ooty)", "Fresho", "500 g", 48, "🥕", "vegetable"),
  ("Cucumber", "Fresho", "500 g", 35, "🥒", "vegetable,salad"),
  ("Coriander Leaves", "Fresho", "100 g", 20, "🌿", "herbs"),
  ("Pineapple", "Fresho", "1 pc (~1 kg)", 99, "🍍", "fruit"),
  ("Green Grapes", "Fresho", "500 g", 110, "🍇", "fruit"),
  ("Hass Avocado", "Fresho", "1 pc", 149, "🥑", "exotic,fruit"),
 ],
 "dairy-bread-eggs": [
  ("Toned Fresh Milk", "Amul Taaza", "500 ml", 28, "🥛", "milk"),
  ("Full Cream Milk", "Nandini", "1 L", 64, "🥛", "milk"),
  ("Salted Butter", "Amul", "100 g", 58, "🧈", "butter"),
  ("Fresh Paneer", "Milky Mist", "200 g", 95, "🧀", "paneer"),
  ("Farm Fresh Brown Eggs", "Eggoz", "Pack of 6", 84, "🥚", "eggs,protein"),
  ("Whole Wheat Bread", "Harvest Gold", "400 g", 50, "🍞", "bread"),
  ("Greek Yogurt Plain", "Epigamia", "90 g", 45, "🥣", "curd,protein"),
  ("Cheese Slices", "Britannia", "200 g", 150, "🧀", "cheese"),
  ("Masti Dahi Cup", "Amul", "400 g", 35, "🥛", "curd"),
 ],
 "atta-rice-dal": [
  ("Whole Wheat Atta", "Aashirvaad", "5 kg", 285, "🌾", "atta,flour"),
  ("Basmati Rice Classic", "India Gate", "1 kg", 165, "🍚", "rice"),
  ("Toor Dal", "Tata Sampann", "1 kg", 195, "🫘", "dal,pulses"),
  ("Moong Dal Yellow", "Tata Sampann", "500 g", 92, "🫘", "dal"),
  ("Kabuli Chana", "Fortune", "500 g", 88, "🫘", "pulses"),
  ("Sona Masoori Rice", "Daawat", "5 kg", 420, "🍚", "rice"),
  ("Besan (Gram Flour)", "Rajdhani", "500 g", 70, "🌾", "flour"),
  ("Sugar", "Madhur", "1 kg", 58, "🧂", "sugar"),
 ],
 "masala-oils-ghee": [
  ("Refined Sunflower Oil", "Fortune", "1 L", 165, "🫗", "oil"),
  ("Cold Pressed Groundnut Oil", "Anveshan", "1 L", 399, "🫗", "oil,organic"),
  ("Pure Cow Ghee", "Amul", "500 ml", 330, "🧈", "ghee"),
  ("Turmeric Powder", "Everest", "100 g", 38, "🟡", "masala"),
  ("Garam Masala", "MDH", "100 g", 82, "🌶️", "masala"),
  ("Kashmiri Chilli Powder", "Catch", "100 g", 70, "🌶️", "masala"),
  ("Iodised Salt", "Tata", "1 kg", 28, "🧂", "salt"),
  ("Extra Virgin Olive Oil", "Figaro", "500 ml", 699, "🫒", "oil,exotic"),
 ],
 "meat-seafood": [
  ("Chicken Curry Cut (Skinless)", "Licious", "500 g", 229, "🍗", "chicken"),
  ("Chicken Breast Boneless", "Licious", "450 g", 289, "🍗", "chicken,protein"),
  ("Mutton Curry Cut", "FreshToHome", "500 g", 549, "🥩", "mutton"),
  ("Rohu Fish Steaks", "FreshToHome", "500 g", 259, "🐟", "fish"),
  ("Tiger Prawns (Medium)", "Licious", "250 g", 399, "🦐", "seafood"),
  ("Chicken Seekh Kebab", "Zorabian", "250 g", 199, "🍢", "ready to cook"),
 ],
 "breakfast-instant": [
  ("Corn Flakes Original", "Kellogg's", "475 g", 199, "🥣", "cereal"),
  ("Rolled Oats", "Quaker", "1 kg", 199, "🥣", "oats,healthy"),
  ("Masala Instant Noodles", "Maggi", "Pack of 4", 56, "🍜", "noodles"),
  ("Instant Poha Mix", "MTR", "180 g", 55, "🍛", "ready to eat"),
  ("Peanut Butter Crunchy", "Pintola", "350 g", 229, "🥜", "spread,protein"),
  ("Mixed Fruit Jam", "Kissan", "500 g", 175, "🍓", "spread"),
  ("Pure Honey", "Dabur", "500 g", 225, "🍯", "honey"),
  ("Dark Chocolate Muesli", "Yoga Bar", "400 g", 349, "🥣", "muesli,healthy"),
 ],
 "frozen-ice-cream": [
  ("Vanilla Ice Cream Tub", "Kwality Wall's", "700 ml", 199, "🍨", "ice cream"),
  ("Choco Bar Stick", "Amul", "Pack of 4", 120, "🍫", "ice cream"),
  ("Frozen Green Peas", "Safal", "500 g", 99, "🫛", "frozen veg"),
  ("French Fries Crinkle", "McCain", "420 g", 140, "🍟", "frozen snack"),
  ("Veg Aloo Tikki", "McCain", "360 g", 120, "🥔", "frozen snack"),
  ("Belgian Chocolate Gelato", "Hocco", "125 ml", 90, "🍦", "ice cream"),
 ],
 "snacks-munchies": [
  ("Classic Salted Potato Chips", "Lay's", "52 g", 20, "🥔", "chips"),
  ("Magic Masala Chips Party Size", "Lay's", "150 g", 60, "🍟", "chips"),
  ("Salsa Con Queso Dip", "Tostitos", "425 g", 450, "🫙", "dip"),
  ("Nacho Cheese Tortilla Chips", "Doritos", "150 g", 99, "🔺", "nachos"),
  ("Aloo Bhujia", "Haldiram's", "400 g", 110, "🥨", "namkeen"),
  ("Deluxe Whole Cashews, Salted", "Happilo", "200 g", 330, "🥜", "dry fruits,nuts"),
  ("Baked Snack Cheese Crackers", "Cheez-It", "200 g", 249, "🧀", "crackers"),
  ("Cream & Onion Pringles", "Pringles", "107 g", 115, "🥫", "chips"),
  ("Salted Makhana", "Farmley", "60 g", 99, "⚪", "healthy snack"),
  ("Good Day Cashew Cookies", "Britannia", "200 g", 40, "🍪", "biscuits"),
 ],
 "sweets-chocolates": [
  ("Dairy Milk Silk", "Cadbury", "150 g", 175, "🍫", "chocolate"),
  ("KitKat 4 Finger", "Nestle", "37.3 g", 30, "🍫", "chocolate"),
  ("Dark 70% Cocoa", "Amul", "150 g", 200, "🍫", "dark chocolate"),
  ("Kaju Katli", "Haldiram's", "250 g", 290, "🔷", "mithai"),
  ("Rasgulla Tin", "Haldiram's", "1 kg", 199, "⚪", "mithai"),
  ("Ferrero Rocher", "Ferrero", "16 pcs", 699, "🟤", "gifting,chocolate"),
  ("Gummy Bears", "Haribo", "80 g", 99, "🐻", "candy"),
 ],
 "beverages": [
  ("Coca-Cola", "Coca-Cola", "750 ml", 40, "🥤", "soft drink"),
  ("Sprite Lime", "Sprite", "750 ml", 40, "🥤", "soft drink"),
  ("100% Orange Juice", "Tropicana", "1 L", 130, "🍊", "juice"),
  ("Mixed Fruit Juice", "Real", "1 L", 115, "🧃", "juice"),
  ("Tender Coconut Water", "Raw Pressery", "200 ml", 55, "🥥", "healthy"),
  ("Energy Drink", "Red Bull", "250 ml", 125, "⚡", "energy"),
  ("Packaged Drinking Water", "Bisleri", "1 L", 20, "💧", "water"),
  ("Masala Chaas", "Amul", "200 ml", 15, "🥛", "buttermilk"),
 ],
 "tea-coffee": [
  ("Premium Tea", "Tata Tea Gold", "500 g", 290, "🍵", "tea"),
  ("Green Tea Classic", "Lipton", "25 bags", 175, "🍵", "green tea"),
  ("Classic Instant Coffee", "Nescafe", "100 g", 330, "☕", "coffee"),
  ("Filter Coffee Powder", "Bru", "200 g", 190, "☕", "coffee"),
  ("Chocolate Health Drink", "Bournvita", "500 g", 245, "🥤", "health drink"),
  ("Masala Chai Blend", "Society", "250 g", 145, "🫖", "tea"),
  ("Arabica Coffee Beans", "Blue Tokai", "250 g", 525, "🫘", "coffee,premium"),
 ],
 "brews-mixers": [
  ("Cold Brew Coffee Original", "Sleepy Owl", "Pack of 3 (200 ml)", 285, "🧋", "cold brew"),
  ("Non-Alcoholic Wheat Beer", "Bira 91 Zero", "330 ml", 99, "🍺", "brewery,non-alcoholic"),
  ("Craft Ginger Ale", "Svami", "250 ml", 70, "🫧", "mixer"),
  ("Indian Tonic Water", "Svami", "250 ml", 70, "🫧", "mixer"),
  ("Raw Kombucha Hibiscus", "Bhu Kombucha", "330 ml", 175, "🌺", "brew,probiotic"),
  ("Club Soda", "Kinley", "750 ml", 20, "🫧", "mixer"),
  ("Virgin Mojito Mix", "Monin", "700 ml", 499, "🍹", "mixer"),
  ("Home Brew Beer Kit (Malt)", "Brewhouse", "1 kit", 1899, "🍻", "brewery,diy"),
 ],
 "skin-care": [
  ("Vitamin C Face Serum", "Minimalist", "30 ml", 599, "🧪", "serum,face"),
  ("Hydrating Moisturiser", "Cetaphil", "80 g", 399, "🧴", "moisturiser"),
  ("SPF 50 Sunscreen Gel", "Neutrogena", "88 ml", 699, "☀️", "sunscreen"),
  ("Neem Face Wash", "Himalaya", "150 ml", 190, "🍃", "face wash"),
  ("Aloe Vera Gel", "WOW", "130 ml", 249, "🌵", "gel"),
  ("Niacinamide 10% Serum", "The Derma Co", "30 ml", 599, "🧪", "serum"),
  ("Cocoa Butter Body Lotion", "Vaseline", "400 ml", 425, "🧴", "lotion"),
  ("Lip Balm Strawberry", "Nivea", "4.8 g", 199, "💋", "lip care"),
 ],
 "hair-care": [
  ("Anti-Dandruff Shampoo", "Head & Shoulders", "340 ml", 380, "🧴", "shampoo"),
  ("Onion Hair Oil", "Mamaearth", "250 ml", 449, "🧅", "hair oil"),
  ("Coconut Hair Oil", "Parachute", "300 ml", 150, "🥥", "hair oil"),
  ("Smooth & Silky Conditioner", "Dove", "180 ml", 245, "🧴", "conditioner"),
  ("Keratin Hair Mask", "L'Oreal Paris", "200 ml", 599, "💆", "hair mask"),
  ("Wide Tooth Wooden Comb", "Vega", "1 pc", 175, "🪮", "accessory"),
  ("Natural Black Hair Colour", "Garnier", "1 pack", 199, "🖤", "hair colour"),
 ],
 "mens-grooming": [
  ("Mach3 Razor", "Gillette", "1 pc", 299, "🪒", "shaving"),
  ("Shaving Foam Sensitive", "Gillette", "418 g", 299, "🫧", "shaving"),
  ("Beard Growth Oil", "Beardo", "30 ml", 349, "🧔", "beard"),
  ("Charcoal Face Wash", "Nivea Men", "100 g", 199, "⚫", "face wash"),
  ("Cordless Beard Trimmer", "Philips", "1 pc", 1499, "🔋", "trimmer"),
  ("Deodorant Body Spray", "Park Avenue", "150 ml", 250, "💨", "deo"),
  ("Matte Hair Wax", "Ustraa", "100 g", 299, "💈", "styling"),
  ("After Shave Lotion", "Old Spice", "100 ml", 299, "🌊", "after shave"),
 ],
 "bath-body": [
  ("Moisturising Beauty Bar", "Dove", "Pack of 3", 195, "🧼", "soap"),
  ("Sandal Soap", "Mysore Sandal", "Pack of 3", 210, "🧼", "soap"),
  ("Shower Gel Deep Sea", "Nivea", "250 ml", 275, "🚿", "body wash"),
  ("Lemon Handwash Refill", "Dettol", "750 ml", 99, "🍋", "handwash"),
  ("Loofah Sponge", "Bodycare", "1 pc", 120, "🧽", "accessory"),
  ("Coffee Body Scrub", "mCaffeine", "100 g", 399, "☕", "scrub"),
 ],
 "oral-care": [
  ("Toothpaste MaxFresh", "Colgate", "150 g", 110, "🪥", "toothpaste"),
  ("Sensitive Toothpaste", "Sensodyne", "75 g", 175, "🦷", "toothpaste"),
  ("Soft Bristle Toothbrush", "Oral-B", "Pack of 3", 99, "🪥", "toothbrush"),
  ("Mouthwash Cool Mint", "Listerine", "250 ml", 185, "🫧", "mouthwash"),
  ("Dental Floss Mint", "Oral-B", "50 m", 199, "🧵", "floss"),
 ],
 "makeup": [
  ("Colossal Kajal", "Maybelline", "0.35 g", 199, "🖊️", "eyes"),
  ("Matte Liquid Lipstick", "Sugar", "4.5 ml", 499, "💄", "lips"),
  ("Fit Me Compact Powder", "Maybelline", "8 g", 330, "🪞", "face"),
  ("Nail Enamel Red", "Lakme", "9 ml", 150, "💅", "nails"),
  ("Makeup Remover Micellar Water", "Garnier", "125 ml", 299, "💧", "remover"),
  ("BB Cream Natural", "Pond's", "30 g", 249, "🧴", "face"),
 ],
 "baby-care": [
  ("Baby Diapers Pants (M)", "Pampers", "Pack of 56", 999, "👶", "diapers"),
  ("Baby Wipes Aloe", "Himalaya", "72 wipes", 199, "🧻", "wipes"),
  ("Baby Shampoo No Tears", "Johnson's", "200 ml", 225, "🧴", "baby bath"),
  ("Stage 1 Infant Formula", "Nan Pro", "400 g", 850, "🍼", "baby food"),
  ("Wheat Apple Cerelac", "Nestle", "300 g", 280, "🥣", "baby food"),
  ("Feeding Bottle 250 ml", "Philips Avent", "1 pc", 499, "🍼", "accessory"),
 ],
 "health-wellness": [
  ("Multivitamin Men", "HealthKart", "60 tabs", 699, "💊", "vitamins"),
  ("Chyawanprash", "Dabur", "500 g", 245, "🍯", "ayurveda,immunity"),
  ("Whey Protein Chocolate", "MuscleBlaze", "1 kg", 2499, "💪", "protein"),
  ("Digital Thermometer", "Dr Trust", "1 pc", 299, "🌡️", "device"),
  ("Hand Sanitizer", "Lifebuoy", "500 ml", 250, "🧴", "hygiene"),
  ("ORS Orange Drink", "Electral", "Pack of 5", 110, "🍊", "hydration"),
  ("Omega 3 Fish Oil", "WOW", "60 caps", 599, "🐟", "supplement"),
 ],
 "cleaning-household": [
  ("Matic Top Load Detergent", "Surf Excel", "2 kg", 460, "🧺", "laundry"),
  ("Dishwash Gel Lemon", "Vim", "750 ml", 199, "🍋", "dishwash"),
  ("Toilet Cleaner", "Harpic", "1 L", 199, "🚽", "cleaner"),
  ("Floor Cleaner Lavender", "Lizol", "975 ml", 219, "🧴", "cleaner"),
  ("Garbage Bags Medium", "Ezee", "30 bags", 99, "🗑️", "bags"),
  ("Scrub Pad", "Scotch-Brite", "Pack of 3", 60, "🧽", "kitchen"),
  ("Mosquito Repellent Refill", "Good Knight", "45 ml", 85, "🦟", "repellent"),
  ("Fabric Conditioner", "Comfort", "860 ml", 235, "🌸", "laundry"),
 ],
 "home-kitchen": [
  ("Non-Stick Tawa 28 cm", "Prestige", "1 pc", 899, "🍳", "cookware"),
  ("Steel Water Bottle 1 L", "Milton", "1 pc", 599, "🍶", "bottle"),
  ("Ceramic Dinner Plate Set", "Cello", "Set of 6", 999, "🍽️", "crockery"),
  ("Aluminium Foil 9 m", "Freshwrapp", "1 roll", 99, "📜", "kitchen"),
  ("Glass Storage Jars", "Borosil", "Set of 3", 749, "🫙", "storage"),
  ("LED Bulb 9W", "Philips", "1 pc", 120, "💡", "electrical"),
  ("Stainless Steel Spoon Set", "FNS", "Set of 6", 299, "🥄", "cutlery"),
 ],
 "pet-care": [
  ("Adult Dog Food Chicken", "Pedigree", "3 kg", 899, "🐕", "dog food"),
  ("Cat Food Ocean Fish", "Whiskas", "1.2 kg", 499, "🐈", "cat food"),
  ("Dog Chew Sticks", "Drools", "450 g", 299, "🦴", "treats"),
  ("Pet Shampoo", "Himalaya", "200 ml", 225, "🧴", "grooming"),
  ("Cat Litter Lavender", "Kitty Kat", "5 kg", 450, "🪣", "litter"),
 ],
 "seeds-saplings": [
  ("Tomato Hybrid Seeds", "Ugaoo", "100 seeds", 99, "🌱", "vegetable seeds,agri"),
  ("Chilli Seeds (Guntur)", "Kraft Seeds", "50 g", 149, "🌶️", "vegetable seeds,agri"),
  ("Paddy Seeds BPT 5204", "Nuziveedu", "10 kg", 650, "🌾", "paddy,agri,field crop"),
  ("Hybrid Maize Seeds", "Pioneer", "4 kg", 1350, "🌽", "maize,agri,field crop"),
  ("Cotton Bt Seeds", "Rasi", "450 g", 864, "☁️", "cotton,agri,field crop"),
  ("Tulsi Plant Sapling", "Nurserylive", "1 plant", 199, "🌿", "sapling"),
  ("Microgreens Seed Kit", "Ugaoo", "6 varieties", 299, "🥬", "kitchen garden"),
  ("Mango Grafted Sapling (Banganapalli)", "Nurserylive", "1 plant", 449, "🥭", "sapling,fruit plant"),
 ],
 "fertilizers-plant-care": [
  ("Vermicompost Organic Manure", "TrustBasket", "5 kg", 299, "🪱", "organic,fertilizer"),
  ("NPK 19:19:19 Water Soluble", "IFFCO", "1 kg", 180, "🧪", "fertilizer"),
  ("Urea (Neem Coated)", "IFFCO", "45 kg", 267, "⚪", "fertilizer,agri"),
  ("Neem Oil Pesticide", "Ugaoo", "250 ml", 249, "🍃", "organic pesticide"),
  ("Cocopeat Block", "Ugaoo", "5 kg", 349, "🟫", "potting mix"),
  ("Seaweed Growth Promoter", "Biostadt", "500 ml", 399, "🌊", "growth promoter"),
  ("Trichoderma Bio Fungicide", "T. Stanes", "1 kg", 220, "🦠", "bio,agri"),
 ],
 "farm-garden-tools": [
  ("Garden Hand Trowel", "Falcon", "1 pc", 249, "🧑‍🌾", "tool"),
  ("Pruning Secateurs", "Falcon", "1 pc", 499, "✂️", "tool"),
  ("Knapsack Sprayer 16 L", "Neptune", "1 pc", 1899, "🚿", "sprayer,agri"),
  ("Garden Hose Pipe 15 m", "Gardenia", "1 pc", 899, "🪢", "watering"),
  ("Plastic Grow Bags 12x12", "Ugaoo", "Pack of 10", 299, "🪴", "planter"),
  ("Watering Can 5 L", "Kraft Seeds", "1 pc", 349, "🚰", "watering"),
  ("Drip Irrigation Kit", "Jain Irrigation", "1 kit", 1499, "💧", "irrigation,agri"),
 ],
}

DISCOUNTS = [0, 0.05, 0.08, 0.1, 0.12, 0.15, 0.2, 0.25, 0.3, 0.4]

def q(s):
    return "'" + str(s).replace("'", "''") + "'"

out = ["-- AUTO-GENERATED by tools/generate_seed.py. Do not edit by hand.\n"]

out.append("INSERT INTO dark_stores (id, store_code, name, address, city, pincode, latitude, longitude, is_active) VALUES")
out.append(",\n".join(
    f"({i+1}, {q(c)}, {q(n)}, {q(a)}, {q(city)}, {q(pin)}, {lat}, {lng}, TRUE)"
    for i, (c, n, a, city, pin, lat, lng) in enumerate(STORES)) + ";")
out.append(f"SELECT setval('dark_stores_id_seq', {len(STORES)});\n")

out.append("INSERT INTO categories (id, name, slug, image_url, department, theme_color, sort_order) VALUES")
out.append(",\n".join(
    f"({i+1}, {q(name)}, {q(slug)}, {q(emoji)}, {q(dept)}, {q(color)}, {i+1})"
    for i, (slug, name, emoji, dept, color) in enumerate(CATEGORIES)) + ";")
out.append(f"SELECT setval('categories_id_seq', {len(CATEGORIES)});\n")

cat_id = {slug: i + 1 for i, (slug, *_rest) in enumerate(CATEGORIES)}
products, inventory = [], []
pid = 0
for slug, items in P.items():
    for (title, brand, unit, mrp, emoji, tags) in items:
        pid += 1
        rating = round(random.uniform(3.8, 4.9), 1)
        desc = f"{brand} {title} ({unit}). Sourced for your nearest dark store and delivered in minutes."
        attrs = {"shelfLife": random.choice(["3 days", "7 days", "6 months", "12 months", "24 months"]),
                 "countryOfOrigin": "India", "veg": slug not in ("meat-seafood",)}
        products.append(
            f"({pid}, {cat_id[slug]}, {q(title)}, {q(brand)}, {q(desc)}, {q(unit)}, {mrp:.2f}, {q(emoji)}, "
            f"{rating}, {q(tags)}, {q(json.dumps(attrs))}::jsonb, TRUE)")
        for sid in range(1, len(STORES) + 1):
            disc = random.choice(DISCOUNTS)
            sale = max(1, round(mrp * (1 - disc)))
            r = random.random()
            stock = 0 if r < 0.05 else (random.randint(1, 9) if r < 0.2 else random.randint(15, 120))
            inventory.append(f"({sid}, {pid}, {stock}, {sale:.2f}, TRUE)")

out.append("INSERT INTO products (id, category_id, title, brand, description, unit_quantity, base_price, image_url, rating, tags, attributes, is_active) VALUES")
out.append(",\n".join(products) + ";")
out.append(f"SELECT setval('products_id_seq', {pid});\n")

out.append("INSERT INTO store_inventories (dark_store_id, product_id, stock_quantity, sale_price, is_available) VALUES")
out.append(",\n".join(inventory) + ";\n")

out.append("""INSERT INTO coupons (code, description, discount_type, discount_value, min_cart_value, max_discount, usage_limit, is_active) VALUES
('WELCOME50', '50% off up to ₹100 on orders above ₹199', 'PERCENTAGE', 50, 199, 100, 10000, TRUE),
('FLAT75', 'Flat ₹75 off on orders above ₹499', 'FLAT', 75, 499, NULL, NULL, TRUE),
('FRESH20', '20% off up to ₹60 on orders above ₹299', 'PERCENTAGE', 20, 299, 60, NULL, TRUE),
('FARM100', 'Flat ₹100 off farm & garden orders above ₹999', 'FLAT', 100, 999, NULL, NULL, TRUE);
""")

path = pathlib.Path(__file__).resolve().parent.parent / "backend/src/main/resources/db/migration/V2__seed_catalog.sql"
path.write_text("\n".join(out), encoding="utf-8")
print(f"Wrote {path} with {len(STORES)} stores, {len(CATEGORIES)} categories, {pid} products, {len(inventory)} inventory rows")
