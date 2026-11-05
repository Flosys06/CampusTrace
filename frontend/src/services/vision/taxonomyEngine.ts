import { Category } from '../../types';

export interface CanonicalCategoryDefinition {
  canonicalName: string;
  defaultDescriptor: string;
}

export interface TaxonomyMappingResult {
  normalizedLabel: string;
  categoryName: string;
  categoryId: number | null;
  defaultDescriptor: string;
  isKnown: boolean;
  confidencePrior: number; // 0..1 confidence in this taxonomy mapping
}

export const CANONICAL_CATEGORIES: Record<string, CanonicalCategoryDefinition> = {
  'Electronics': {
    canonicalName: 'Electronics',
    defaultDescriptor: 'electronic device or digital campus accessory',
  },
  'Bags & Backpacks': {
    canonicalName: 'Bags & Backpacks',
    defaultDescriptor: 'carry bag, backpack, or campus storage tote',
  },
  'IDs, Cards & Wallets': {
    canonicalName: 'IDs, Cards & Wallets',
    defaultDescriptor: 'identification card, wallet, or personal credentials',
  },
  'Audio & Headphones': {
    canonicalName: 'Audio & Headphones',
    defaultDescriptor: 'personal audio device, earphones, or speakers',
  },
  'Keys & Access Badges': {
    canonicalName: 'Keys & Access Badges',
    defaultDescriptor: 'campus keys, lanyard, access badge, or padlock',
  },
  'Water Bottles & Flasks': {
    canonicalName: 'Water Bottles & Flasks',
    defaultDescriptor: 'reusable water bottle, tumbler, or beverage flask',
  },
  'Apparel & Outerwear': {
    canonicalName: 'Apparel & Outerwear',
    defaultDescriptor: 'clothing item, jacket, sweater, or wearable accessory',
  },
  'Books & Stationery': {
    canonicalName: 'Books & Stationery',
    defaultDescriptor: 'textbook, study notes, notebook, or writing instrument',
  },
  'Eyewear & Accessories': {
    canonicalName: 'Eyewear & Accessories',
    defaultDescriptor: 'eyeglasses, sunglasses, wristwatch, or umbrella',
  },
  'Other Belongings': {
    canonicalName: 'Other Belongings',
    defaultDescriptor: 'personal item or miscellaneous campus belonging',
  },
};

interface NormalizedRule {
  patterns: (string | RegExp)[];
  normalizedLabel: string;
  categoryName: string;
  defaultDescriptor: string;
}

const TAXONOMY_RULES: NormalizedRule[] = [
  // 1. Electronics
  {
    patterns: ['cell phone', 'cellular_telephone', 'smartphone', 'mobile', 'iphone', 'android', 'phone'],
    normalizedLabel: 'Smartphone',
    categoryName: 'Electronics',
    defaultDescriptor: 'handheld touchscreen mobile device',
  },
  {
    patterns: ['laptop', 'notebook computer', 'macbook', 'chromebook', 'thinkpad'],
    normalizedLabel: 'Laptop',
    categoryName: 'Electronics',
    defaultDescriptor: 'portable laptop computer with keyboard and trackpad',
  },
  {
    patterns: ['tablet', 'ipad', 'hand-held_computer', 'kindle', 'e-reader'],
    normalizedLabel: 'Tablet / E-Reader',
    categoryName: 'Electronics',
    defaultDescriptor: 'touchscreen tablet or reading device',
  },
  {
    patterns: ['mouse', 'optical mouse', 'wireless mouse'],
    normalizedLabel: 'Computer Mouse',
    categoryName: 'Electronics',
    defaultDescriptor: 'computer optical mouse / peripheral device',
  },
  {
    patterns: ['keyboard', 'computer_keyboard', 'mechanical keyboard'],
    normalizedLabel: 'Computer Keyboard',
    categoryName: 'Electronics',
    defaultDescriptor: 'computer keyboard accessory',
  },
  {
    patterns: ['remote', 'calculator', 'scientific calculator'],
    normalizedLabel: 'Scientific Calculator / Device',
    categoryName: 'Electronics',
    defaultDescriptor: 'handheld scientific calculator or digital remote',
  },
  {
    patterns: ['charger', 'adapter', 'power bank', 'usb', 'cable', 'hard_disc', 'hard drive', 'flash drive', 'pendrive'],
    normalizedLabel: 'Charger / Cable / Storage',
    categoryName: 'Electronics',
    defaultDescriptor: 'electronic charger, cable, or storage device',
  },
  {
    patterns: ['tv', 'monitor', 'display'],
    normalizedLabel: 'Display / Monitor',
    categoryName: 'Electronics',
    defaultDescriptor: 'digital display screen or monitor',
  },

  // 2. Audio & Headphones
  {
    patterns: ['headphones', 'earphones', 'earbuds', 'airpods', 'headset', 'ipod'],
    normalizedLabel: 'Headphones / Earbuds',
    categoryName: 'Audio & Headphones',
    defaultDescriptor: 'personal audio earphones or headphones',
  },
  {
    patterns: ['speaker', 'loudspeaker', 'bluetooth speaker'],
    normalizedLabel: 'Bluetooth Speaker',
    categoryName: 'Audio & Headphones',
    defaultDescriptor: 'wireless audio speaker',
  },

  // 3. Bags & Backpacks
  {
    patterns: ['backpack', 'bookbag', 'schoolbag', 'rucksack'],
    normalizedLabel: 'Backpack',
    categoryName: 'Bags & Backpacks',
    defaultDescriptor: 'campus backpack with shoulder straps and zippered compartments',
  },
  {
    patterns: ['handbag', 'tote', 'tote bag', 'shoulder bag', 'plastic_bag'],
    normalizedLabel: 'Handbag / Tote Bag',
    categoryName: 'Bags & Backpacks',
    defaultDescriptor: 'carry bag or tote with handles',
  },
  {
    patterns: ['suitcase', 'luggage', 'duffel', 'duffel bag', 'briefcase', 'mailbag'],
    normalizedLabel: 'Duffel / Travel Bag',
    categoryName: 'Bags & Backpacks',
    defaultDescriptor: 'travel duffel or messenger bag',
  },

  // 4. IDs, Cards & Wallets
  {
    patterns: ['wallet', 'billfold', 'money clip'],
    normalizedLabel: 'Wallet',
    categoryName: 'IDs, Cards & Wallets',
    defaultDescriptor: 'pocket wallet or folded billfold',
  },
  {
    patterns: ['purse', 'coin purse', 'pouch'],
    normalizedLabel: 'Purse / Cardholder',
    categoryName: 'IDs, Cards & Wallets',
    defaultDescriptor: 'small pouch or cardholder',
  },
  {
    patterns: ['id card', 'id', 'student id', 'badge', 'smart card', 'access card', 'debit card', 'credit card'],
    normalizedLabel: 'ID Card / Campus Card',
    categoryName: 'IDs, Cards & Wallets',
    defaultDescriptor: 'campus identification card or credentials',
  },

  // 5. Keys & Access Badges
  {
    patterns: ['keys', 'key', 'keychain', 'car key', 'bike key', 'lanyard'],
    normalizedLabel: 'Keys / Keychain',
    categoryName: 'Keys & Access Badges',
    defaultDescriptor: 'set of campus keys or keychain with lanyard',
  },
  {
    patterns: ['padlock', 'lock', 'combination_lock'],
    normalizedLabel: 'Padlock / Security Lock',
    categoryName: 'Keys & Access Badges',
    defaultDescriptor: 'security padlock or combination lock',
  },

  // 6. Water Bottles & Flasks
  {
    patterns: ['bottle', 'water_bottle', 'pop_bottle', 'flask', 'thermos', 'insulated bottle'],
    normalizedLabel: 'Water Bottle / Flask',
    categoryName: 'Water Bottles & Flasks',
    defaultDescriptor: 'reusable water bottle or insulated flask with cap',
  },
  {
    patterns: ['cup', 'coffee_mug', 'mug', 'tumbler'],
    normalizedLabel: 'Travel Mug / Tumbler',
    categoryName: 'Water Bottles & Flasks',
    defaultDescriptor: 'travel mug or beverage tumbler',
  },

  // 7. Books & Stationery
  {
    patterns: ['ballpoint', 'ballpoint pen', 'pen', 'fountain_pen', 'gel pen', 'marker', 'stylus', 'highlighter'],
    normalizedLabel: 'Pen / Writing Instrument',
    categoryName: 'Books & Stationery',
    defaultDescriptor: 'ballpoint pen, marker, or writing instrument',
  },
  {
    patterns: ['pencil', 'mechanical pencil'],
    normalizedLabel: 'Pencil',
    categoryName: 'Books & Stationery',
    defaultDescriptor: 'writing or sketching pencil',
  },
  {
    patterns: ['book', 'book_jacket', 'textbook', 'study book', 'hardcover', 'paperback', 'comic_book'],
    normalizedLabel: 'Textbook / Study Material',
    categoryName: 'Books & Stationery',
    defaultDescriptor: 'academic textbook, hardcover, or study book',
  },
  {
    patterns: ['notebook', 'spiral notebook', 'diary', 'journal', 'notepad'],
    normalizedLabel: 'Notebook / Study Notes',
    categoryName: 'Books & Stationery',
    defaultDescriptor: 'spiral-bound study notebook, diary, or journal',
  },
  {
    patterns: ['binder', 'folder', 'file folder', 'envelope'],
    normalizedLabel: 'Document Folder / Binder',
    categoryName: 'Books & Stationery',
    defaultDescriptor: 'document file folder or binder portfolio',
  },
  {
    patterns: ['pencil_box', 'pencil case', 'stationery pouch', 'geometry box'],
    normalizedLabel: 'Pencil Case / Pouch',
    categoryName: 'Books & Stationery',
    defaultDescriptor: 'stationery pouch or pencil case',
  },
  {
    patterns: ['rubber_eraser', 'eraser'],
    normalizedLabel: 'Stationery Eraser',
    categoryName: 'Books & Stationery',
    defaultDescriptor: 'stationery rubber eraser',
  },
  {
    patterns: ['slide_rule', 'ruler', 'scale', 'drafter'],
    normalizedLabel: 'Measuring Scale / Ruler',
    categoryName: 'Books & Stationery',
    defaultDescriptor: 'measuring ruler or engineering scale',
  },
  {
    patterns: ['scissors', 'stationery scissors'],
    normalizedLabel: 'Stationery Scissors',
    categoryName: 'Books & Stationery',
    defaultDescriptor: 'craft or stationery scissors',
  },

  // 8. Eyewear & Accessories
  {
    patterns: ['sunglasses', 'sunglass', 'spectacles', 'glasses', 'eyeglass', 'frames'],
    normalizedLabel: 'Eyeglasses / Sunglasses',
    categoryName: 'Eyewear & Accessories',
    defaultDescriptor: 'eyewear frames with lenses',
  },
  {
    patterns: ['watch', 'smartwatch', 'digital_watch', 'analog_clock', 'digital_clock', 'stopwatch', 'clock'],
    normalizedLabel: 'Wristwatch',
    categoryName: 'Eyewear & Accessories',
    defaultDescriptor: 'wrist timepiece or fitness band',
  },
  {
    patterns: ['umbrella', 'parasol'],
    normalizedLabel: 'Umbrella',
    categoryName: 'Eyewear & Accessories',
    defaultDescriptor: 'compact rain umbrella with canopy and handle',
  },
  {
    patterns: ['crash_helmet', 'helmet'],
    normalizedLabel: 'Riding Helmet',
    categoryName: 'Eyewear & Accessories',
    defaultDescriptor: 'two-wheeler safety helmet',
  },

  // 9. Apparel & Outerwear
  {
    patterns: ['jacket', 'cardigan', 'sweatshirt', 'hoodie', 'coat', 'sweater', 'lab_coat', 'suit', 'trench_coat', 'blazer'],
    normalizedLabel: 'Jacket / Outerwear',
    categoryName: 'Apparel & Outerwear',
    defaultDescriptor: 'outerwear jacket, hoodie, or sweater',
  },
  {
    patterns: ['tie', 'necktie', 'scarf'],
    normalizedLabel: 'Tie / Scarf',
    categoryName: 'Apparel & Outerwear',
    defaultDescriptor: 'formal necktie or uniform accessory',
  },
  {
    patterns: ['hat', 'cap', 'beanie'],
    normalizedLabel: 'Cap / Hat',
    categoryName: 'Apparel & Outerwear',
    defaultDescriptor: 'campus headwear or cap',
  },
  {
    patterns: ['shoe', 'shoes', 'sneaker', 'boots'],
    normalizedLabel: 'Footwear / Shoes',
    categoryName: 'Apparel & Outerwear',
    defaultDescriptor: 'campus shoes or sneakers',
  },

  // 10. Sports Gear under Other Belongings
  {
    patterns: ['sports ball', 'basketball', 'football', 'soccer ball', 'volleyball'],
    normalizedLabel: 'Sports Ball',
    categoryName: 'Other Belongings',
    defaultDescriptor: 'athletic sports ball',
  },
  {
    patterns: ['tennis racket', 'badminton racket', 'racket'],
    normalizedLabel: 'Sports Racket',
    categoryName: 'Other Belongings',
    defaultDescriptor: 'sports racket with strung head and grip',
  },
  {
    patterns: ['skateboard', 'longboard'],
    normalizedLabel: 'Skateboard',
    categoryName: 'Other Belongings',
    defaultDescriptor: 'campus skateboard or cruiser',
  },
];

export class TaxonomyEngine {
  /**
   * Maps an arbitrary raw model label (COCO, ImageNet, Cloud AI) to the canonical taxonomy.
   */
  public mapModelLabel(rawLabel: string, categories: Category[] = []): TaxonomyMappingResult {
    const cleanRaw = rawLabel.trim().toLowerCase().replace(/_/g, ' ');

    // 1. Direct rule pattern matching
    for (const rule of TAXONOMY_RULES) {
      for (const pattern of rule.patterns) {
        if (typeof pattern === 'string') {
          if (cleanRaw === pattern || cleanRaw.includes(pattern) || pattern.includes(cleanRaw)) {
            const categoryId = this.matchCategoryId(rule.categoryName, categories);
            return {
              normalizedLabel: rule.normalizedLabel,
              categoryName: rule.categoryName,
              categoryId,
              defaultDescriptor: rule.defaultDescriptor,
              isKnown: true,
              confidencePrior: 0.95,
            };
          }
        } else if (pattern.test(cleanRaw)) {
          const categoryId = this.matchCategoryId(rule.categoryName, categories);
          return {
            normalizedLabel: rule.normalizedLabel,
            categoryName: rule.categoryName,
            categoryId,
            defaultDescriptor: rule.defaultDescriptor,
            isKnown: true,
            confidencePrior: 0.90,
          };
        }
      }
    }

    // 2. Fallback for unknown / unmapped label
    // Clean up label: capitalize words
    const capitalized = cleanRaw
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ') || 'Campus Item';

    const categoryId = this.matchCategoryId('Other Belongings', categories);

    return {
      normalizedLabel: capitalized,
      categoryName: 'Other Belongings',
      categoryId,
      defaultDescriptor: 'personal belongings or campus item',
      isKnown: false,
      confidencePrior: 0.40,
    };
  }

  /**
   * Matches a predicted category name against available database Category entities.
   * Never throws or invents IDs.
   */
  public matchCategoryId(categoryName: string, categories: Category[]): number | null {
    if (!categories || categories.length === 0) return null;

    const target = categoryName.trim().toLowerCase();

    // 1. Exact match
    const exact = categories.find((c) => c.name.toLowerCase() === target);
    if (exact) return exact.id;

    // 2. Substring match
    const partial = categories.find((c) => {
      const cName = c.name.toLowerCase();
      return cName.includes(target) || target.includes(cName);
    });
    if (partial) return partial.id;

    // 3. Fallback to "Other" or first active category
    const fallbackOther = categories.find((c) => c.name.toLowerCase().includes('other'));
    return fallbackOther ? fallbackOther.id : categories[0].id;
  }

  /**
   * Constructs an objective, grounded title without fabricating brand or model.
   * e.g., "Blue Backpack", "Stainless Steel Water Bottle", "Black Smartphone"
   */
  public generateFactualTitle(normalizedLabel: string, color?: string): string {
    if (!color || color === 'Unknown') {
      return normalizedLabel;
    }

    if (color === 'Silver / Gray') {
      if (normalizedLabel.toLowerCase().includes('bottle') || normalizedLabel.toLowerCase().includes('flask')) {
        return `Stainless Steel ${normalizedLabel}`;
      }
      return `Silver ${normalizedLabel}`;
    }

    if (color === 'Multi-color') {
      return `Multi-color ${normalizedLabel}`;
    }

    return `${color} ${normalizedLabel}`;
  }

  /**
   * Constructs an objective, grounded description from observable image facts.
   */
  public generateFactualDescription(
    normalizedLabel: string,
    color?: string,
    descriptor?: string
  ): string {
    const colorText = color && color !== 'Unknown' ? `${color.toLowerCase()} ` : '';
    const descText = descriptor ? ` (${descriptor})` : '';
    return `Photographed ${colorText}${normalizedLabel.toLowerCase()} on campus${descText}.`;
  }
}

export const taxonomyEngine = new TaxonomyEngine();
