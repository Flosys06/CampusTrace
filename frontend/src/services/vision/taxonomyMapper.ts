import { Category } from '../../types';

export interface CategoryMapping {
  categoryName: string;
  cleanName: string;
  defaultDescriptor: string;
}

// 80 standard COCO classes supported by YOLO
export const COCO_CLASSES = [
  'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus', 'train', 'truck', 'boat', 'traffic light',
  'fire hydrant', 'stop sign', 'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
  'elephant', 'bear', 'zebra', 'giraffe', 'backpack', 'umbrella', 'handbag', 'tie', 'suitcase', 'frisbee',
  'skis', 'snowboard', 'sports ball', 'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard',
  'tennis racket', 'bottle', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl', 'banana', 'apple',
  'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza', 'donut', 'cake', 'chair', 'couch',
  'potted plant', 'bed', 'dining table', 'toilet', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone',
  'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'book', 'clock', 'vase', 'scissors', 'teddy bear',
  'hair drier', 'toothbrush'
];

export const COCO_CAMPUS_MAP: Record<string, CategoryMapping> = {
  'cell phone': {
    categoryName: 'Electronics',
    cleanName: 'Smartphone',
    defaultDescriptor: 'mobile device with glass screen and camera module'
  },
  'laptop': {
    categoryName: 'Electronics',
    cleanName: 'Laptop',
    defaultDescriptor: 'portable laptop computer with keyboard and trackpad'
  },
  'mouse': {
    categoryName: 'Electronics',
    cleanName: 'Computer Mouse',
    defaultDescriptor: 'computer optical mouse / peripheral device'
  },
  'keyboard': {
    categoryName: 'Electronics',
    cleanName: 'Computer Keyboard',
    defaultDescriptor: 'computer keyboard accessory'
  },
  'remote': {
    categoryName: 'Electronics',
    cleanName: 'Scientific Calculator / Remote',
    defaultDescriptor: 'handheld digital device / calculator'
  },
  'tv': {
    categoryName: 'Electronics',
    cleanName: 'Electronic Display / Tablet',
    defaultDescriptor: 'display screen or tablet device'
  },
  'backpack': {
    categoryName: 'Bags & Backpacks',
    cleanName: 'Backpack',
    defaultDescriptor: 'campus backpack with shoulder straps and zippered compartments'
  },
  'handbag': {
    categoryName: 'Bags & Backpacks',
    cleanName: 'Handbag / Tote',
    defaultDescriptor: 'carry bag or tote with handles'
  },
  'suitcase': {
    categoryName: 'Bags & Backpacks',
    cleanName: 'Travel Bag / Suitcase',
    defaultDescriptor: 'luggage or duffel bag'
  },
  'bottle': {
    categoryName: 'Water Bottles & Flasks',
    cleanName: 'Water Bottle',
    defaultDescriptor: 'reusable water bottle or insulated flask with cap'
  },
  'cup': {
    categoryName: 'Water Bottles & Flasks',
    cleanName: 'Mug / Thermal Tumbler',
    defaultDescriptor: 'travel mug or beverage tumbler'
  },
  'book': {
    categoryName: 'Books & Stationery',
    cleanName: 'Book / Notebook',
    defaultDescriptor: 'textbook, study notes, or spiral-bound notebook'
  },
  'scissors': {
    categoryName: 'Books & Stationery',
    cleanName: 'Stationery Scissors',
    defaultDescriptor: 'craft or stationery scissors'
  },
  'umbrella': {
    categoryName: 'Eyewear & Accessories',
    cleanName: 'Umbrella',
    defaultDescriptor: 'rain umbrella with canopy and handle'
  },
  'clock': {
    categoryName: 'Eyewear & Accessories',
    cleanName: 'Wristwatch / Clock',
    defaultDescriptor: 'watch dial or timekeeping accessory'
  },
  'tie': {
    categoryName: 'Apparel & Outerwear',
    cleanName: 'Tie / Scarf',
    defaultDescriptor: 'formal necktie or uniform accessory'
  },
  'sports ball': {
    categoryName: 'Other Belongings',
    cleanName: 'Sports Equipment',
    defaultDescriptor: 'athletic sports gear'
  },
  'tennis racket': {
    categoryName: 'Other Belongings',
    cleanName: 'Badminton / Tennis Racket',
    defaultDescriptor: 'sports racket with strung head and grip'
  },
  'skateboard': {
    categoryName: 'Other Belongings',
    cleanName: 'Skateboard',
    defaultDescriptor: 'campus skateboard or cruiser'
  }
};

// Curated ImageNet campus whitelist for secondary verification
export const IMAGENET_CAMPUS_MAP: Record<string, CategoryMapping> = {
  // Wallets, IDs & Cards
  'wallet': { categoryName: 'IDs, Cards & Wallets', cleanName: 'Wallet', defaultDescriptor: 'pocket wallet or folded cardholder' },
  'purse': { categoryName: 'IDs, Cards & Wallets', cleanName: 'Coin Purse / Wallet', defaultDescriptor: 'small pouch or cardholder' },
  'mailbag': { categoryName: 'Bags & Backpacks', cleanName: 'Messenger Bag', defaultDescriptor: 'shoulder strap messenger bag' },
  'plastic_bag': { categoryName: 'Bags & Backpacks', cleanName: 'Tote Bag', defaultDescriptor: 'carry tote or bag' },

  // Electronics & Audio
  'cellular_telephone': { categoryName: 'Electronics', cleanName: 'Smartphone', defaultDescriptor: 'handheld smartphone device' },
  'laptop': { categoryName: 'Electronics', cleanName: 'Laptop', defaultDescriptor: 'portable laptop computer' },
  'hand-held_computer': { categoryName: 'Electronics', cleanName: 'Tablet / Smart Device', defaultDescriptor: 'tablet device with touchscreen' },
  'ipod': { categoryName: 'Audio & Headphones', cleanName: 'Earbuds Case / Audio Device', defaultDescriptor: 'portable audio device or case' },
  'loudspeaker': { categoryName: 'Audio & Headphones', cleanName: 'Bluetooth Speaker', defaultDescriptor: 'wireless audio speaker' },
  'hard_disc': { categoryName: 'Electronics', cleanName: 'External Storage Drive', defaultDescriptor: 'external hard drive or storage unit' },
  'mouse': { categoryName: 'Electronics', cleanName: 'Computer Mouse', defaultDescriptor: 'optical computer mouse' },
  'computer_keyboard': { categoryName: 'Electronics', cleanName: 'Computer Keyboard', defaultDescriptor: 'keyboard peripheral' },

  // Water bottles & cups
  'water_bottle': { categoryName: 'Water Bottles & Flasks', cleanName: 'Water Bottle', defaultDescriptor: 'hydration bottle or insulated flask' },
  'pop_bottle': { categoryName: 'Water Bottles & Flasks', cleanName: 'Beverage Bottle', defaultDescriptor: 'drink bottle with seal cap' },
  'beer_bottle': { categoryName: 'Water Bottles & Flasks', cleanName: 'Bottle / Flask', defaultDescriptor: 'beverage bottle' },
  'coffee_mug': { categoryName: 'Water Bottles & Flasks', cleanName: 'Coffee Mug', defaultDescriptor: 'ceramic or travel coffee mug' },
  'cup': { categoryName: 'Water Bottles & Flasks', cleanName: 'Drinking Tumbler', defaultDescriptor: 'reusable beverage cup' },

  // Keys & Locks
  'padlock': { categoryName: 'Keys & Access Badges', cleanName: 'Keys / Padlock', defaultDescriptor: 'security padlock or key set' },
  'combination_lock': { categoryName: 'Keys & Access Badges', cleanName: 'Combination Lock / Keys', defaultDescriptor: 'dial lock or campus keys' },

  // Eyewear & Watches
  'sunglasses': { categoryName: 'Eyewear & Accessories', cleanName: 'Sunglasses', defaultDescriptor: 'eyewear frames with tinted lenses' },
  'sunglass': { categoryName: 'Eyewear & Accessories', cleanName: 'Spectacles / Glasses', defaultDescriptor: 'prescription glasses or frames' },
  'digital_watch': { categoryName: 'Eyewear & Accessories', cleanName: 'Smartwatch / Digital Watch', defaultDescriptor: 'digital wrist timepiece or fitness band' },
  'analog_clock': { categoryName: 'Eyewear & Accessories', cleanName: 'Analog Watch', defaultDescriptor: 'analog wristwatch with strap' },
  'digital_clock': { categoryName: 'Eyewear & Accessories', cleanName: 'Digital Watch / Clock', defaultDescriptor: 'digital timekeeping display' },
  'stopwatch': { categoryName: 'Eyewear & Accessories', cleanName: 'Sports Watch / Stopwatch', defaultDescriptor: 'timekeeping watch or device' },
  'umbrella': { categoryName: 'Eyewear & Accessories', cleanName: 'Umbrella', defaultDescriptor: 'compact folding umbrella' },
  'crash_helmet': { categoryName: 'Eyewear & Accessories', cleanName: 'Riding Helmet', defaultDescriptor: 'two-wheeler safety helmet' },

  // Books & Stationery (Enhanced with pens, notebooks, textbooks, erasers, rulers)
  'ballpoint': { categoryName: 'Books & Stationery', cleanName: 'Ballpoint Pen', defaultDescriptor: 'ballpoint pen or writing instrument' },
  'fountain_pen': { categoryName: 'Books & Stationery', cleanName: 'Pen / Marker', defaultDescriptor: 'fountain pen, marker, or stylus' },
  'book_jacket': { categoryName: 'Books & Stationery', cleanName: 'Textbook / Book', defaultDescriptor: 'academic textbook, hardcover, or study book' },
  'comic_book': { categoryName: 'Books & Stationery', cleanName: 'Book / Study Material', defaultDescriptor: 'book, study notes, or reading material' },
  'notebook': { categoryName: 'Books & Stationery', cleanName: 'Notebook / Study Notes', defaultDescriptor: 'spiral-bound study notebook, diary, or journal' },
  'binder': { categoryName: 'Books & Stationery', cleanName: 'Folder / Binder', defaultDescriptor: 'document binder, file folder, or study portfolio' },
  'pencil_box': { categoryName: 'Books & Stationery', cleanName: 'Pencil Case / Pouch', defaultDescriptor: 'stationery pouch or pencil case' },
  'pencil_sharpener': { categoryName: 'Books & Stationery', cleanName: 'Pencil Sharpener', defaultDescriptor: 'desk or study supply item' },
  'rubber_eraser': { categoryName: 'Books & Stationery', cleanName: 'Stationery Eraser', defaultDescriptor: 'rubber eraser or stationery correction tool' },
  'slide_rule': { categoryName: 'Books & Stationery', cleanName: 'Scale / Ruler', defaultDescriptor: 'measuring ruler, scale, or engineering drafter' },
  'envelope': { categoryName: 'Books & Stationery', cleanName: 'Document Envelope / Folder', defaultDescriptor: 'paper envelope or document folder' },

  // Apparel & Jackets
  'cardigan': { categoryName: 'Apparel & Outerwear', cleanName: 'Cardigan / Jacket', defaultDescriptor: 'buttoned outerwear or light jacket' },
  'sweatshirt': { categoryName: 'Apparel & Outerwear', cleanName: 'Hoodie / Sweatshirt', defaultDescriptor: 'pullover hoodie or sweatshirt' },
  'lab_coat': { categoryName: 'Apparel & Outerwear', cleanName: 'College Lab Coat', defaultDescriptor: 'white academic lab coat' },
  'suit': { categoryName: 'Apparel & Outerwear', cleanName: 'Blazer / Formal Coat', defaultDescriptor: 'tailored blazer or formal coat' },
  'trench_coat': { categoryName: 'Apparel & Outerwear', cleanName: 'Jacket / Overcoat', defaultDescriptor: 'long jacket or outerwear' }
};

/**
 * Builds clean, factual item title without fabricating brand or model.
 * e.g. "Blue Smartphone", "Black Backpack", "Stainless Steel Water Bottle", "Brown Wallet"
 */
export function generateFactualTitle(cleanName: string, color: string): string {
  if (!color || color === 'Unknown') {
    return cleanName;
  }

  if (color === 'Silver / Gray') {
    if (cleanName.toLowerCase().includes('bottle')) {
      return `Stainless Steel ${cleanName}`;
    }
    return `Silver ${cleanName}`;
  }

  if (color === 'Multi-color') {
    return `Multi-color ${cleanName}`;
  }

  return `${color} ${cleanName}`;
}

/**
 * Generates factual, objective description using only visible features.
 * Avoids inventing brand names, ownership, or invisible damage.
 */
export function generateFactualDescription(
  cleanName: string,
  color: string,
  descriptor: string,
  _confidencePercent?: string
): string {
  const colorPhrase = color && color !== 'Unknown' ? `${color.toLowerCase()} ` : '';
  return `Photographed ${colorPhrase}${cleanName.toLowerCase()} on campus (${descriptor}).`;
}

/**
 * Maps predicted category name to database category ID.
 */
export function matchCategoryId(categoryName: string, categories: Category[]): number | null {
  if (!categories || categories.length === 0) return null;

  const target = categoryName.trim().toLowerCase();
  
  // Exact match
  const exact = categories.find((c) => c.name.toLowerCase() === target);
  if (exact) return exact.id;

  // Substring match
  const partial = categories.find((c) => {
    const cName = c.name.toLowerCase();
    return cName.includes(target) || target.includes(cName);
  });
  if (partial) return partial.id;

  // Fallback to "Other" or first active category
  const fallbackOther = categories.find((c) => c.name.toLowerCase().includes('other'));
  return fallbackOther ? fallbackOther.id : categories[0].id;
}
