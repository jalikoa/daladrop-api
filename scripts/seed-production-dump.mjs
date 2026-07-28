#!/usr/bin/env node
/**
 * Production-style catalog dump for local / staging UI testing.
 *
 * Defaults (override with env):
 *   SEED_USERS=50
 *   SEED_STORES=50              # per vertical: RESTAURANT / MARKET / LIQUOR / GAS
 *   SEED_MODULE_CATS=12
 *   SEED_STORE_CATS=12
 *   SEED_PRODUCTS_PER_STORE=50
 *   SEED_MENU_CATS=12
 *   SEED_MENU_ITEMS_PER_CAT=50
 *   SEED_EVENTS=50
 *   SEED_RIDERS=25
 *
 * Password for every seeded user: Pass@123
 *
 * Usage:
 *   node scripts/seed-production-dump.mjs
 *   SEED_LITE=1 node scripts/seed-production-dump.mjs   # smaller dump
 */
import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { config as loadEnv } from 'dotenv';

loadEnv();

const prisma = new PrismaClient();

const LITE = process.env.SEED_LITE === '1';
const USERS = Number(process.env.SEED_USERS || (LITE ? 20 : 50));
const STORES = Number(process.env.SEED_STORES || (LITE ? 10 : 50));
const MODULE_CATS = Number(process.env.SEED_MODULE_CATS || (LITE ? 10 : 12));
const STORE_CATS = Number(process.env.SEED_STORE_CATS || (LITE ? 10 : 12));
const PRODUCTS_PER_STORE = Number(
  process.env.SEED_PRODUCTS_PER_STORE || (LITE ? 20 : 50),
);
const MENU_CATS = Number(process.env.SEED_MENU_CATS || (LITE ? 10 : 12));
const MENU_ITEMS_PER_CAT = Number(
  process.env.SEED_MENU_ITEMS_PER_CAT || (LITE ? 8 : 50),
);
const EVENTS = Number(process.env.SEED_EVENTS || (LITE ? 15 : 50));
const RIDERS = Number(process.env.SEED_RIDERS || (LITE ? 10 : 25));
const PASSWORD = 'Pass@123';
const BATCH = 500;

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

/** Deterministic UUID v4-shaped id from a label (idempotent re-runs). */
function uid(label) {
  const h = createHash('sha256').update(`daladrop:prod-dump:${label}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function img(seed, w = 1200, h = 800) {
  // Stable high-res placeholders (picsum seeds are deterministic).
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`;
}

function unsplash(photoId, w = 1200) {
  return `https://images.unsplash.com/${photoId}?auto=format&fit=crop&w=${w}&q=80`;
}

const FOOD_PHOTOS = [
  'photo-1517248135467-4c7edcad34c4',
  'photo-1555939594-58d7cb561ad1',
  'photo-1565299624946-b28f40a0ae38',
  'photo-1540189549336-e6e99c3679fe',
  'photo-1567620905732-2d1ec7ab7445',
  'photo-1476224203421-9ac39bcb3327',
  'photo-1504674900247-0877df9cc836',
  'photo-1414235077428-338989a2e8c0',
];
const MARKET_PHOTOS = [
  'photo-1488459716781-31db52582fe9',
  'photo-1542838132-92c53300491e',
  'photo-1579113800032-c38bd7638194',
  'photo-1610348725531-843dff563e2c',
  'photo-1604719312566-8912e9227c6a',
];
const LIQUOR_PHOTOS = [
  'photo-1510812431401-41d2bd2722f3',
  'photo-1551538827-9c037cb4f32a',
  'photo-1569529465841-dfecdab7503b',
  'photo-1618885472179-5e474019f2a9',
];
const GAS_PHOTOS = [
  'photo-1581094794329-c8112a89af12',
  'photo-1621905252507-b35492cc74b4',
  'photo-1504328345603-a4e9d3b3f6e3',
];
const EVENT_PHOTOS = [
  'photo-1492684223066-81342ee5ff30',
  'photo-1459749411175-04bf5292ceea',
  'photo-1470229722913-7c0e2dbb096d',
  'photo-1501281668745-f7f57925c3b4',
];

function pick(arr, i) {
  return arr[i % arr.length];
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

function cityPoint(i) {
  // Default hub: 77RV+3QR, Changach (full OLC 6GGQ77RV+3QR).
  // Places points in a 1–15 km ring around the hub for local device GPS testing.
  // Override with SEED_CENTER_LAT / SEED_CENTER_LNG if needed.
  const baseLat = Number(process.env.SEED_CENTER_LAT || 0.2902375);
  const baseLng = Number(process.env.SEED_CENTER_LNG || 35.294390625);
  const distKm = Math.min(
    15,
    Math.max(1, 1 + (i % 15) + ((i * 7) % 10) / 10),
  );
  const bearing = (i * 137.508) % 360;
  const br = (bearing * Math.PI) / 180;
  const latRad = (baseLat * Math.PI) / 180;
  const dLat = (distKm / 111.32) * Math.cos(br);
  const dLng = (distKm / (111.32 * Math.cos(latRad))) * Math.sin(br);
  return {
    lat: Number((baseLat + dLat).toFixed(7)),
    lng: Number((baseLng + dLng).toFixed(7)),
    distKm: Number(distKm.toFixed(2)),
    bearing: Math.round(bearing),
  };
}

async function createMany(model, rows, label) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    await model.createMany({ data: chunk, skipDuplicates: true });
    process.stdout.write(
      `\r  ${label}: ${Math.min(i + chunk.length, rows.length)}/${rows.length}`,
    );
  }
  process.stdout.write('\n');
}

const FOOD_MODULE_CATS = [
  ['Fast Food', 'fast-food-outline'],
  ['Nyama Choma', 'flame-outline'],
  ['Seafood', 'fish-outline'],
  ['Breakfast', 'cafe-outline'],
  ['Healthy', 'leaf-outline'],
  ['Pizza', 'pizza-outline'],
  ['Burgers', 'fast-food-outline'],
  ['African', 'restaurant-outline'],
  ['Indian', 'nutrition-outline'],
  ['Chinese', 'restaurant-outline'],
  ['Desserts', 'ice-cream-outline'],
  ['Drinks', 'wine-outline'],
  ['Vegetarian', 'leaf-outline'],
  ['Street Food', 'bicycle-outline'],
];

const MARKET_MODULE_CATS = [
  ['Groceries', 'basket-outline'],
  ['Fresh Produce', 'nutrition-outline'],
  ['Dairy', 'water-outline'],
  ['Meat & Fish', 'fish-outline'],
  ['Bakery', 'cafe-outline'],
  ['Household', 'home-outline'],
  ['Personal Care', 'sparkles-outline'],
  ['Snacks', 'cube-outline'],
  ['Beverages', 'beer-outline'],
  ['Spices', 'flame-outline'],
  ['Frozen', 'snow-outline'],
  ['Organic', 'leaf-outline'],
  ['Baby Care', 'happy-outline'],
  ['Cleaning', 'brush-outline'],
];

const LIQUOR_MODULE_CATS = [
  ['Spirits', 'wine-outline'],
  ['Beer', 'beer-outline'],
  ['Wine', 'wine-outline'],
  ['Whisky', 'flask-outline'],
  ['Vodka', 'flask-outline'],
  ['Gin', 'flask-outline'],
  ['Rum', 'flask-outline'],
  ['Champagne', 'sparkles-outline'],
  ['Ciders', 'leaf-outline'],
  ['Ready-to-Drink', 'cube-outline'],
  ['Mixers', 'water-outline'],
  ['Local Brews', 'home-outline'],
  ['Tequila', 'flask-outline'],
  ['Liqueurs', 'wine-outline'],
];

const GAS_MODULE_CATS = [
  ['Cooking Gas', 'flame-outline'],
  ['6kg Cylinders', 'cube-outline'],
  ['13kg Cylinders', 'cube-outline'],
  ['Refills', 'refresh-outline'],
  ['New Cylinders', 'add-circle-outline'],
  ['Exchanges', 'swap-horizontal-outline'],
  ['Accessories', 'construct-outline'],
  ['Regulators', 'settings-outline'],
  ['Hoses', 'git-branch-outline'],
  ['Burners', 'flame-outline'],
  ['Safety Kits', 'shield-checkmark-outline'],
  ['Bulk LPG', 'business-outline'],
  ['Commercial', 'storefront-outline'],
  ['Emergency Delivery', 'flash-outline'],
];

const MENU_CAT_NAMES = [
  'Starters',
  'Soups',
  'Salads',
  'Mains',
  'Grills',
  'Seafood',
  'Sides',
  'Burgers & Wraps',
  'Pasta & Rice',
  'Desserts',
  'Hot Drinks',
  'Cold Drinks',
  'Kids Menu',
  'Chef Specials',
];

const DISH_BASES = [
  'Tilapia Fry',
  'Ugali Plate',
  'Chicken Biryani',
  'Beef Stew',
  'Chapati Wrap',
  'Vegetable Curry',
  'Fish Fingers',
  'Nyama Choma Platter',
  'Pilau Rice',
  'Samosa Trio',
  'Club Sandwich',
  'Caesar Salad',
  'Mango Smoothie',
  'Espresso',
  'Chocolate Cake',
  'Goat Soup',
  'Prawn Skewers',
  'BBQ Wings',
  'Mandazi Basket',
  'Fresh Juice',
];

const MARKET_PRODUCTS = [
  'Fresh Tomatoes',
  'Sukuma Wiki Bundle',
  'Ripe Bananas',
  'Irish Potatoes',
  'Maize Flour 2kg',
  'Cooking Oil 1L',
  'Fresh Milk 500ml',
  'Eggs Tray',
  'White Bread',
  'Rice 2kg',
  'Onions 1kg',
  'Carrots 1kg',
  'Avocado Pack',
  'Sugar 1kg',
  'Tea Leaves 500g',
  'Soap Bar',
  'Tissue Pack',
  'Mineral Water 6pk',
  'Yoghurt Cup',
  'Frozen Chicken',
];

const LIQUOR_PRODUCTS = [
  'Tusker Lager 500ml',
  'Guinness Smooth 500ml',
  'White Cap Can',
  'Johnnie Walker Red',
  'Jameson Irish Whiskey',
  'Smirnoff Vodka 750ml',
  'Gilbeys Gin 750ml',
  'Captain Morgan Spiced',
  'Four Cousins Wine',
  'Drostdy Hof',
  'Amarula Cream',
  'Heineken Bottle',
  'Balozi Lager',
  'Chrome Gin',
  'Konyagi 750ml',
  'Robertson Chenin',
  'Prosecco Bottle',
  'Savanna Dry',
  'Red Bull 4pk',
  'Soda Mixer Pack',
];

const GAS_PRODUCTS = [
  ['K-Gas 6kg Refill', 'REFILL', 'CYL_6KG', '6kg'],
  ['K-Gas 13kg Refill', 'REFILL', 'CYL_13KG', '13kg'],
  ['Total 6kg Refill', 'REFILL', 'CYL_6KG', '6kg'],
  ['Total 13kg Refill', 'REFILL', 'CYL_13KG', '13kg'],
  ['Hashi 6kg New', 'NEW', 'CYL_6KG', '6kg'],
  ['Hashi 13kg New', 'NEW', 'CYL_13KG', '13kg'],
  ['ProGas 6kg Exchange', 'EXCHANGE', 'CYL_6KG', '6kg'],
  ['ProGas 13kg Exchange', 'EXCHANGE', 'CYL_13KG', '13kg'],
  ['Regulator Kit', 'STANDARD', null, null],
  ['LPG Hose 1.5m', 'STANDARD', null, null],
  ['Double Burner', 'STANDARD', null, null],
  ['Safety Cap Pack', 'STANDARD', null, null],
];

const RESTAURANT_NAMES = [
  'Lakeview Grill',
  'Kisumu Spice Kitchen',
  'Sunset Tilapia House',
  'Green Leaf Bistro',
  'Mama Atieno Kitchen',
  'Portside Pizza',
  'Safari Burger Co',
  'Nyanza Flavours',
  'CBD Coffee Lab',
  'Riverside Ramen',
  'Harvest Table',
  'Flame & Coal',
];

const MARKET_NAMES = [
  'Kibuye Fresh Mart',
  'Oginga Groceries',
  'Lake Basin Market',
  'Sunrise Provisions',
  'Family Basket Store',
  'Green Basket Hub',
];

const LIQUOR_NAMES = [
  'Lakeside Wines',
  'Nyanza Spirits',
  'VIP Cellar',
  'Bottle & Cork',
  'Harbour Liquor',
];

const GAS_NAMES = [
  'QuickGas Kisumu',
  'FlameFast LPG',
  'SafeFlame Gas',
  'CityGas Depot',
  'Ring Road Refills',
];

const EVENT_TITLES = [
  'Kisumu Jazz Night',
  'Lake Victoria Food Fest',
  'Afrobeats Live',
  'Startup Pitch Evening',
  'Open Air Cinema',
  'Cultural Dance Showcase',
  'Tech Meetup Nyanza',
  'Gospel Praise Night',
  'Comedy Under the Stars',
  'Farmers Market Fair',
];

const EVENT_CATS = [
  ['Music', 'musical-notes-outline'],
  ['Food & Drink', 'restaurant-outline'],
  ['Business', 'briefcase-outline'],
  ['Culture', 'color-palette-outline'],
  ['Sports', 'football-outline'],
  ['Tech', 'hardware-chip-outline'],
  ['Faith', 'heart-outline'],
  ['Comedy', 'happy-outline'],
  ['Family', 'people-outline'],
  ['Nightlife', 'moon-outline'],
  ['Outdoor', 'sunny-outline'],
  ['Education', 'school-outline'],
];

const FIRST = [
  'Amina',
  'Brian',
  'Carol',
  'Daniel',
  'Esther',
  'Felix',
  'Grace',
  'Hassan',
  'Irene',
  'James',
  'Kevin',
  'Linda',
  'Michael',
  'Naomi',
  'Oscar',
  'Patience',
  'Quinn',
  'Ruth',
  'Samuel',
  'Tina',
];
const LAST = [
  'Otieno',
  'Wanjiku',
  'Ochieng',
  'Achieng',
  'Kamau',
  'Mutua',
  'Okoth',
  'Njeri',
  'Owino',
  'Mwangi',
];

async function seedFoundation(roles) {
  console.log('→ Cylinder types + pricing rules');
  const cyl6 = uid('cyl:6kg');
  const cyl13 = uid('cyl:13kg');
  await prisma.cylinderType.createMany({
    data: [
      {
        id: cyl6,
        code: 'CYL_6KG',
        name: '6 kg cylinder',
        weightKg: 6,
        description: 'Standard household 6kg LPG',
        isActive: true,
      },
      {
        id: cyl13,
        code: 'CYL_13KG',
        name: '13 kg cylinder',
        weightKg: 13,
        description: 'Standard household 13kg LPG',
        isActive: true,
      },
    ],
    skipDuplicates: true,
  });

  // Re-read in case codes already existed with different ids
  const cylinders = await prisma.cylinderType.findMany({
    where: { code: { in: ['CYL_6KG', 'CYL_13KG'] } },
  });
  const byCode = Object.fromEntries(cylinders.map((c) => [c.code, c.id]));

  const effectiveFrom = new Date('2026-01-01T00:00:00+03:00');
  const pricing = [
    ['Normal 0-3km', 'NORMAL_DELIVERY', 0, 3, 120, 100, 20, null],
    ['Normal >3-6km', 'NORMAL_DELIVERY', 3, 6, 170, 140, 30, null],
    ['Normal >6-9km', 'NORMAL_DELIVERY', 6, 9, 220, 180, 40, null],
    ['Normal >9-15km', 'NORMAL_DELIVERY', 9, 15, 300, 240, 60, null],
    ['Gas 6kg 0-3km', 'GAS_DELIVERY', 0, 3, 150, 120, 30, byCode.CYL_6KG],
    ['Gas 6kg >3-6km', 'GAS_DELIVERY', 3, 6, 200, 170, 30, byCode.CYL_6KG],
    ['Gas 6kg >6-9km', 'GAS_DELIVERY', 6, 9, 250, 220, 30, byCode.CYL_6KG],
    ['Gas 13kg 0-3km', 'GAS_DELIVERY', 0, 3, 200, 150, 50, byCode.CYL_13KG],
    ['Gas 13kg >3-6km', 'GAS_DELIVERY', 3, 6, 250, 200, 50, byCode.CYL_13KG],
    ['Gas 13kg >6-9km', 'GAS_DELIVERY', 6, 9, 300, 250, 50, byCode.CYL_13KG],
    ['Ride 0-3km', 'RIDE', 0, 3, 180, 140, 40, null],
    ['Ride >3-6km', 'RIDE', 3, 6, 250, 200, 50, null],
    ['Ride >6-12km', 'RIDE', 6, 12, 350, 280, 70, null],
  ];

  await prisma.deliveryPricingRule.createMany({
    data: pricing.map((row, i) => ({
      id: uid(`pricing:${row[0]}`),
      name: row[0],
      serviceType: row[1],
      vehicleType: 'BIKE',
      distanceMinKm: row[2],
      distanceMaxKm: row[3],
      customerCharge: BigInt(row[4]),
      riderPay: BigInt(row[5]),
      platformCommission: BigInt(row[6]),
      cylinderTypeId: row[7],
      currency: 'KES',
      baseCurrency: 'KES',
      exchangeRate: 1,
      effectiveFrom,
      priority: 100 - i,
      enabled: true,
    })),
    skipDuplicates: true,
  });

  // Required by DeliveryQuoteService before pricing rules apply.
  await prisma.deliveryConstraint.createMany({
    data: [
      {
        id: 'd0000000-0000-4000-8000-000000000001',
        name: 'Normal bike delivery',
        serviceType: 'NORMAL_DELIVERY',
        vehicleType: 'BIKE',
        maxDistanceKm: 15,
        maxWeightKg: 9,
        maxLengthCm: 40,
        maxWidthCm: 40,
        maxHeightCm: 30,
        overflowServiceType: 'PARCEL',
        effectiveFrom,
        enabled: true,
      },
      {
        id: 'd0000000-0000-4000-8000-000000000002',
        name: 'Gas bike delivery',
        serviceType: 'GAS_DELIVERY',
        vehicleType: 'BIKE',
        maxDistanceKm: 15,
        maxWeightKg: 15,
        maxLengthCm: 40,
        maxWidthCm: 40,
        maxHeightCm: 80,
        overflowServiceType: 'PARCEL',
        effectiveFrom,
        enabled: true,
      },
      {
        id: 'd0000000-0000-4000-8000-000000000003',
        name: 'Ride bike constraint',
        serviceType: 'RIDE',
        vehicleType: 'BIKE',
        maxDistanceKm: 30,
        maxWeightKg: 20,
        maxLengthCm: 50,
        maxWidthCm: 50,
        maxHeightCm: 50,
        overflowServiceType: null,
        effectiveFrom,
        enabled: true,
      },
    ],
    skipDuplicates: true,
  });

  return { byCode, roles };
}

async function seedUsers(roles) {
  console.log(`→ Users (${USERS}) password=${PASSWORD}`);
  const passwordHash = await hash(PASSWORD, 12);
  const now = new Date();
  const users = [];
  const credentials = [];
  const security = [];
  const userRoles = [];

  // Keep demo user in sync with Pass@123
  const demoId = '11111111-1111-4111-8111-111111111111';
  await prisma.user.upsert({
    where: { id: demoId },
    create: {
      id: demoId,
      email: 'demo@daladrop.test',
      phone: '0712345678',
      phoneE164: '254712345678',
      firstName: 'Demo',
      lastName: 'Customer',
      displayName: 'Demo Customer',
      status: 'ACTIVE',
      photoUrl: img('user-demo', 400, 400),
      emailVerifiedAt: now,
      phoneVerifiedAt: now,
    },
    update: {
      status: 'ACTIVE',
      photoUrl: img('user-demo', 400, 400),
    },
  });
  await prisma.userCredential.upsert({
    where: { userId: demoId },
    create: {
      id: uid('cred:demo'),
      userId: demoId,
      passwordHash,
      algorithm: 'bcrypt',
      passwordSetAt: now,
    },
    update: { passwordHash, passwordSetAt: now },
  });
  await prisma.userSecuritySettings.upsert({
    where: { userId: demoId },
    create: { userId: demoId, mfaEnabled: false },
    update: {},
  });
  await prisma.userRole.createMany({
    data: [{ id: uid('role:demo:customer'), userId: demoId, roleId: roles.CUSTOMER }],
    skipDuplicates: true,
  });

  for (let i = 1; i <= USERS; i++) {
    const id = uid(`user:${i}`);
    const first = pick(FIRST, i);
    const last = pick(LAST, i * 3);
    const email = `user${String(i).padStart(2, '0')}@daladrop.test`;
    const phoneLocal = `07${String(10000000 + i).slice(0, 8)}`;
    const phoneE164 = `2547${String(10000000 + i).slice(0, 8)}`;
    users.push({
      id,
      email,
      phone: phoneLocal,
      phoneE164,
      firstName: first,
      lastName: last,
      displayName: `${first} ${last}`,
      status: 'ACTIVE',
      photoUrl: img(`user-${i}`, 400, 400),
      emailVerifiedAt: now,
      phoneVerifiedAt: now,
    });
    credentials.push({
      id: uid(`cred:${i}`),
      userId: id,
      passwordHash,
      algorithm: 'bcrypt',
      passwordSetAt: now,
    });
    security.push({ userId: id, mfaEnabled: false });

    // Role mix: customers, merchants, riders, organizers
    const roleCodes = ['CUSTOMER'];
    if (i <= STORES * 4) roleCodes.push('MERCHANT_OWNER');
    if (i <= RIDERS) roleCodes.push('RIDER');
    if (i <= EVENTS) roleCodes.push('ORGANIZER');
    for (const code of roleCodes) {
      userRoles.push({
        id: uid(`urole:${i}:${code}`),
        userId: id,
        roleId: roles[code],
      });
    }
  }

  await createMany(prisma.user, users, 'users');
  await createMany(prisma.userCredential, credentials, 'credentials');
  await createMany(prisma.userSecuritySettings, security, 'security');
  await createMany(prisma.userRole, userRoles, 'user_roles');
  return users.map((u) => u.id);
}

async function seedModuleCategories() {
  console.log(`→ Module categories (${MODULE_CATS}+ per vertical)`);
  const rows = [];
  const packs = [
    ['FOOD', FOOD_MODULE_CATS],
    ['MARKET', MARKET_MODULE_CATS],
    ['LIQUOR', LIQUOR_MODULE_CATS],
    ['GAS', GAS_MODULE_CATS],
  ];
  for (const [moduleType, list] of packs) {
    const take = Math.max(MODULE_CATS, 10);
    list.slice(0, take).forEach(([name, icon], i) => {
      rows.push({
        id: uid(`modcat:${moduleType}:${slugify(name)}`),
        storeId: null,
        moduleType,
        name,
        slug: slugify(name),
        iconKey: icon,
        imageUrl: unsplash(
          pick(
            moduleType === 'FOOD'
              ? FOOD_PHOTOS
              : moduleType === 'MARKET'
                ? MARKET_PHOTOS
                : moduleType === 'LIQUOR'
                  ? LIQUOR_PHOTOS
                  : GAS_PHOTOS,
            i,
          ),
          800,
        ),
        sortOrder: i + 1,
        isActive: true,
      });
    });
  }
  await createMany(prisma.category, rows, 'module_categories');
}

async function seedVertical({
  storeType,
  moduleType,
  names,
  photos,
  productMode,
  userIds,
  navPrefix,
  ageRestricted = false,
  cylinderByCode,
}) {
  console.log(`→ ${storeType}: ${STORES} stores × catalog`);
  const merchants = [];
  const stores = [];
  const hours = [];
  const storeCategories = [];
  const products = [];
  const menuCategories = [];
  const menuItems = [];

  for (let i = 1; i <= STORES; i++) {
    const ownerId = userIds[(i - 1) % userIds.length];
    const merchantId = uid(`merchant:${storeType}:${i}`);
    const storeId = uid(`store:${storeType}:${i}`);
    const baseName = pick(names, i);
    const name = `${baseName} #${i}`;
    const point = cityPoint(i + storeType.length * 50);
    const featured = i % 5 === 0;
    const rating = Number((3.8 + (i % 12) * 0.1).toFixed(2));

    merchants.push({
      id: merchantId,
      ownerUserId: ownerId,
      name: `${baseName} Merchant ${i}`,
      legalName: `${baseName} Ltd`,
      status: 'ACTIVE',
      taxId: `P05${String(1000000 + i).slice(0, 7)}A`,
      featured,
      isOrganizer: storeType === 'RESTAURANT' ? false : i % 7 === 0,
    });

    stores.push({
      id: storeId,
      merchantId,
      storeType,
      name,
      slug: slugify(`${baseName}-${i}`),
      description: `${name} — quality ${storeType.toLowerCase()} service in Changach (Elgeyo-Marakwet). Hub: 77RV+3QR.`,
      city: 'Changach',
      address: `77RV+3QR, Changach · ~${point.distKm}km · bearing ${point.bearing}°`,
      phone: `0712${String(100000 + i).slice(0, 6)}`,
      whatsapp: `254712${String(100000 + i).slice(0, 6)}`,
      email: `${slugify(baseName)}${i}@merchant.daladrop.test`,
      imageUrl: unsplash(pick(photos, i), 800),
      coverImageUrl: unsplash(pick(photos, i + 3), 1400),
      latitude: point.lat,
      longitude: point.lng,
      deliveryFeeHint: BigInt(100 + (i % 5) * 20),
      currency: 'KES',
      minimumOrderAmount: BigInt(storeType === 'LIQUOR' ? 500 : 200),
      deliveryTimeMin: 20 + (i % 10),
      deliveryTimeMax: 40 + (i % 20),
      ratingAvg: rating,
      reviewCount: 20 + i * 3,
      isOpen: true,
      isActive: true,
      ageRestricted,
      tags: [storeType, pick(['Popular', 'Fast', 'Top Rated', 'New'], i)],
      navigationRoute: `/${navPrefix}/${storeId}`,
    });

    const openHour = 7 + (i % 3);
    const closeHour = 20 + (i % 4);
    for (const day of DAYS) {
      const isClosed = day === 'SUN' && i % 11 === 0;
      hours.push({
        id: uid(`hours:${storeId}:${day}`),
        storeId,
        day,
        openTime: isClosed ? null : `${String(openHour).padStart(2, '0')}:00`,
        closeTime: isClosed
          ? null
          : `${String(Math.min(closeHour, 23)).padStart(2, '0')}:00`,
        isClosed,
      });
    }

    if (productMode === 'menu') {
      for (let c = 0; c < MENU_CATS; c++) {
        const catName = MENU_CAT_NAMES[c % MENU_CAT_NAMES.length];
        const catId = uid(`menucat:${storeId}:${c}`);
        menuCategories.push({
          id: catId,
          storeId,
          name: catName,
          description: `${catName} at ${name}`,
          sortOrder: c + 1,
          isActive: true,
        });
        for (let p = 0; p < MENU_ITEMS_PER_CAT; p++) {
          const dish = `${pick(DISH_BASES, p + c * 3)} ${p + 1}`;
          menuItems.push({
            id: uid(`menuitem:${storeId}:${c}:${p}`),
            storeId,
            menuCategoryId: catId,
            name: dish,
            description: `House ${dish.toLowerCase()} prepared fresh daily.`,
            priceAmount: BigInt(150 + ((p * 37 + c * 19 + i) % 900)),
            currency: 'KES',
            imageUrl: unsplash(pick(FOOD_PHOTOS, p + c), 900),
            isAvailable: true,
            preparationTime: 10 + (p % 25),
            calories: 200 + (p % 40) * 10,
            tags: [catName, 'Popular'],
            sortOrder: p + 1,
          });
        }
      }
    } else {
      const catIds = [];
      for (let c = 0; c < STORE_CATS; c++) {
        const label =
          storeType === 'MARKET'
            ? MARKET_MODULE_CATS[c % MARKET_MODULE_CATS.length][0]
            : storeType === 'LIQUOR'
              ? LIQUOR_MODULE_CATS[c % LIQUOR_MODULE_CATS.length][0]
              : GAS_MODULE_CATS[c % GAS_MODULE_CATS.length][0];
        const catId = uid(`storecat:${storeId}:${c}`);
        catIds.push(catId);
        storeCategories.push({
          id: catId,
          storeId,
          moduleType,
          name: label,
          slug: slugify(`${label}-${c}`),
          iconKey: 'pricetag-outline',
          imageUrl: unsplash(pick(photos, c), 700),
          sortOrder: c + 1,
          isActive: true,
        });
      }

      for (let p = 0; p < PRODUCTS_PER_STORE; p++) {
        const catId = catIds[p % catIds.length];
        if (storeType === 'GAS') {
          const gp = GAS_PRODUCTS[p % GAS_PRODUCTS.length];
          const cylId = gp[2] ? cylinderByCode[gp[2]] : null;
          products.push({
            id: uid(`prod:${storeId}:${p}`),
            storeId,
            categoryId: catId,
            cylinderTypeId: cylId,
            name: `${gp[0]} ${Math.floor(p / GAS_PRODUCTS.length) + 1}`,
            description: `${gp[0]} — safe LPG delivery across Changach.`,
            brand: pick(['K-Gas', 'Total', 'Hashi', 'ProGas'], p),
            sku: `GAS-${i}-${p}`,
            priceAmount: BigInt(
              gp[2] === 'CYL_13KG' ? 2800 + (p % 5) * 50 : gp[2] === 'CYL_6KG' ? 1400 + (p % 5) * 40 : 350 + (p % 8) * 50,
            ),
            currency: 'KES',
            imageUrl: unsplash(pick(GAS_PHOTOS, p), 900),
            inStock: true,
            isActive: true,
            ageRestricted: false,
            sizeLabel: gp[3],
            serviceType: gp[1],
            tags: ['LPG', gp[1]],
            sortOrder: p + 1,
          });
        } else if (storeType === 'LIQUOR') {
          const pname = pick(LIQUOR_PRODUCTS, p);
          products.push({
            id: uid(`prod:${storeId}:${p}`),
            storeId,
            categoryId: catId,
            name: `${pname} #${p + 1}`,
            description: `${pname} — chilled & ready for delivery.`,
            brand: pname.split(' ')[0],
            sku: `LIQ-${i}-${p}`,
            priceAmount: BigInt(250 + ((p * 41 + i) % 4500)),
            currency: 'KES',
            imageUrl: unsplash(pick(LIQUOR_PHOTOS, p), 900),
            inStock: true,
            isActive: true,
            ageRestricted: true,
            volumeLabel: pick(['330ml', '500ml', '750ml', '1L'], p),
            abv: Number((4 + (p % 40) * 0.5).toFixed(2)),
            country: pick(['Kenya', 'Scotland', 'France', 'South Africa'], p),
            tags: ['18+', 'Liquor'],
            sortOrder: p + 1,
          });
        } else {
          const pname = pick(MARKET_PRODUCTS, p);
          products.push({
            id: uid(`prod:${storeId}:${p}`),
            storeId,
            categoryId: catId,
            name: `${pname} #${p + 1}`,
            description: `Fresh ${pname.toLowerCase()} from local suppliers.`,
            brand: pick(['FarmFresh', 'LakeBasin', 'DalaMart', 'NyanzaSelect'], p),
            sku: `MKT-${i}-${p}`,
            priceAmount: BigInt(40 + ((p * 17 + i) % 900)),
            currency: 'KES',
            imageUrl: unsplash(pick(MARKET_PHOTOS, p), 900),
            inStock: true,
            isActive: true,
            ageRestricted: false,
            unitLabel: pick(['kg', 'pack', 'bundle', 'piece'], p),
            tags: ['Market', 'Fresh'],
            sortOrder: p + 1,
          });
        }
      }
    }
  }

  await createMany(prisma.merchant, merchants, `${storeType} merchants`);
  await createMany(prisma.store, stores, `${storeType} stores`);
  await createMany(prisma.storeOpeningHour, hours, `${storeType} hours`);
  if (storeCategories.length) {
    await createMany(prisma.category, storeCategories, `${storeType} store cats`);
  }
  if (products.length) {
    await createMany(prisma.product, products, `${storeType} products`);
  }
  if (menuCategories.length) {
    await createMany(prisma.menuCategory, menuCategories, `${storeType} menu cats`);
  }
  if (menuItems.length) {
    await createMany(prisma.menuItem, menuItems, `${storeType} menu items`);
  }

  return stores.map((s) => s.id);
}

async function seedRiders(userIds) {
  console.log(`→ Riders (${RIDERS})`);
  const rows = [];
  for (let i = 1; i <= RIDERS; i++) {
    const userId = userIds[i - 1] || userIds[0];
    const point = cityPoint(i * 3);
    rows.push({
      id: uid(`rider:${i}`),
      userId,
      isAvailable: i % 4 !== 0,
      currentLatitude: point.lat,
      currentLongitude: point.lng,
      vehicleType: pick(['BIKE', 'BIKE', 'CAR', 'VAN'], i),
      ratingAvg: Number((4.0 + (i % 10) * 0.08).toFixed(2)),
      reviewCount: 10 + i * 2,
    });
  }
  // Rider.userId is unique — skip if already assigned
  await createMany(prisma.rider, rows, 'riders');
}

async function seedEvents(userIds, roles) {
  console.log(`→ Events (${EVENTS})`);
  const cats = [];
  EVENT_CATS.slice(0, Math.max(MODULE_CATS, 10)).forEach(([name, icon], i) => {
    cats.push({
      id: uid(`eventcat:${slugify(name)}`),
      name,
      slug: slugify(name),
      iconKey: icon,
      imageUrl: unsplash(pick(EVENT_PHOTOS, i), 900),
      sortOrder: i + 1,
      isActive: true,
    });
  });
  await createMany(prisma.eventCategory, cats, 'event_categories');

  const organizers = [];
  const merchants = [];
  const events = [];
  const tickets = [];
  const now = Date.now();

  for (let i = 1; i <= EVENTS; i++) {
    const userId = userIds[(i + 5) % userIds.length];
    const organizerId = uid(`organizer:${i}`);
    const merchantId = uid(`event-merchant:${i}`);
    const eventId = uid(`event:${i}`);
    const title = `${pick(EVENT_TITLES, i)} ${i}`;
    const start = new Date(now + i * 86400000 * 2);
    const end = new Date(start.getTime() + 4 * 3600000);
    const point = cityPoint(i + 200);

    organizers.push({
      id: organizerId,
      userId,
      orgName: `${pick(FIRST, i)} Events Co`,
      phone: `0713${String(100000 + i).slice(0, 6)}`,
      email: `events${i}@daladrop.test`,
      website: 'https://daladrop.test/events',
    });

    merchants.push({
      id: merchantId,
      ownerUserId: userId,
      name: `Event Host ${i}`,
      legalName: `Event Host ${i} Ltd`,
      status: 'ACTIVE',
      featured: i % 4 === 0,
      isOrganizer: true,
    });

    events.push({
      id: eventId,
      merchantId,
      organizerId,
      categoryId: cats[(i - 1) % cats.length].id,
      name: title,
      description: `${title} — live experience in Changach with curated tickets and venue access.`,
      venue: `Changach Grounds ${i}`,
      address: `77RV+3QR, Changach · venue ~${point.distKm}km`,
      city: 'Changach',
      bannerUrl: unsplash(pick(EVENT_PHOTOS, i), 1600),
      coverImageUrl: unsplash(pick(EVENT_PHOTOS, i + 1), 1200),
      gallery: [
        unsplash(pick(EVENT_PHOTOS, i), 1000),
        unsplash(pick(EVENT_PHOTOS, i + 2), 1000),
      ],
      startAt: start,
      endAt: end,
      status: 'PUBLISHED',
      latitude: point.lat,
      longitude: point.lng,
      ratingAvg: Number((4.0 + (i % 8) * 0.1).toFixed(2)),
      reviewCount: 5 + i,
      isFeatured: i % 5 === 0,
      navigationRoute: `/events/${eventId}`,
    });

    for (const [ti, tname, price, qty] of [
      [0, 'Early Bird', 500, 200],
      [1, 'General Admission', 1000, 500],
      [2, 'VIP', 2500, 80],
    ]) {
      tickets.push({
        id: uid(`ticket:${eventId}:${ti}`),
        eventId,
        name: tname,
        priceAmount: BigInt(price + (i % 5) * 50),
        currency: 'KES',
        totalQty: qty,
        soldQty: i % 20,
        isActive: true,
      });
    }

    await prisma.userRole.createMany({
      data: [
        {
          id: uid(`urole:org:${i}:ORGANIZER`),
          userId,
          roleId: roles.ORGANIZER,
        },
      ],
      skipDuplicates: true,
    });
  }

  // organizers.userId is unique — create carefully
  for (const org of organizers) {
    try {
      await prisma.eventOrganizer.create({ data: org });
    } catch {
      // already exists for user
    }
  }
  await createMany(prisma.merchant, merchants, 'event merchants');
  // Fix organizerId if create failed — look up by user
  for (let i = 0; i < events.length; i++) {
    const org = await prisma.eventOrganizer.findUnique({
      where: { userId: organizers[i].userId },
    });
    if (org) events[i].organizerId = org.id;
  }
  await createMany(prisma.event, events, 'events');
  await createMany(prisma.eventTicketType, tickets, 'ticket types');
  return events.map((e) => e.id);
}

async function seedDiscovery(storeIdsByType, eventIds) {
  console.log('→ Home discovery sections');
  const sections = [
    {
      key: 'featured_restaurants',
      title: 'Featured Restaurants',
      subtitle: 'Top-rated kitchens near you',
      iconKey: 'restaurant-outline',
      iconColor: '#E85D04',
      itemType: 'STORE',
      ids: storeIdsByType.RESTAURANT.slice(0, 12),
    },
    {
      key: 'local_markets',
      title: 'Local Markets',
      subtitle: 'Fresh produce & household essentials',
      iconKey: 'basket-outline',
      iconColor: '#2A9D8F',
      itemType: 'STORE',
      ids: storeIdsByType.MARKET.slice(0, 12),
    },
    {
      key: 'liquor_picks',
      title: 'Liquor Picks',
      subtitle: 'Wines, spirits & chilled beers',
      iconKey: 'wine-outline',
      iconColor: '#7B2CBF',
      itemType: 'STORE',
      ids: storeIdsByType.LIQUOR.slice(0, 12),
    },
    {
      key: 'gas_delivery',
      title: 'Gas Delivery',
      subtitle: 'Refills & new cylinders on demand',
      iconKey: 'flame-outline',
      iconColor: '#F4A261',
      itemType: 'STORE',
      ids: storeIdsByType.GAS.slice(0, 12),
    },
    {
      key: 'upcoming_events',
      title: 'Upcoming Events',
      subtitle: 'Concerts, festivals & meetups',
      iconKey: 'calendar-outline',
      iconColor: '#264653',
      itemType: 'EVENT',
      ids: eventIds.slice(0, 12),
    },
    {
      key: 'near_you',
      title: 'Near You',
      subtitle: 'Open now around Changach',
      iconKey: 'navigate-outline',
      iconColor: '#E76F51',
      itemType: 'STORE',
      ids: [
        ...storeIdsByType.RESTAURANT.slice(0, 4),
        ...storeIdsByType.MARKET.slice(0, 4),
        ...storeIdsByType.GAS.slice(0, 4),
      ],
    },
  ];

  for (let s = 0; s < sections.length; s++) {
    const sec = sections[s];
    const sectionId = uid(`discovery:${sec.key}`);
    await prisma.discoverySection.upsert({
      where: { sectionKey: sec.key },
      create: {
        id: sectionId,
        sectionKey: sec.key,
        title: sec.title,
        subtitle: sec.subtitle,
        iconKey: sec.iconKey,
        iconColor: sec.iconColor,
        carousel: true,
        recommendationReason: 'Curated for Changach test dump (77RV+3QR)',
        sortOrder: s + 1,
        isActive: true,
      },
      update: {
        title: sec.title,
        subtitle: sec.subtitle,
        iconKey: sec.iconKey,
        iconColor: sec.iconColor,
        isActive: true,
        sortOrder: s + 1,
      },
    });
    const existing = await prisma.discoverySection.findUnique({
      where: { sectionKey: sec.key },
    });
    if (!existing) continue;
    await prisma.discoverySectionItem.deleteMany({
      where: { sectionId: existing.id },
    });
    await prisma.discoverySectionItem.createMany({
      data: sec.ids.map((targetId, idx) => ({
        id: uid(`discovery-item:${sec.key}:${idx}`),
        sectionId: existing.id,
        itemType: sec.itemType,
        targetId,
        sortOrder: idx + 1,
        metadata: { seed: 'production-dump' },
      })),
      skipDuplicates: true,
    });
  }
}

async function main() {
  console.log('DalaDrop production dump seed');
  console.log(
    JSON.stringify(
      {
        LITE,
        USERS,
        STORES,
        MODULE_CATS,
        STORE_CATS,
        PRODUCTS_PER_STORE,
        MENU_CATS,
        MENU_ITEMS_PER_CAT,
        EVENTS,
        RIDERS,
      },
      null,
      2,
    ),
  );

  const roleRows = await prisma.role.findMany();
  if (!roleRows.length) {
    throw new Error('Roles missing — run migrations / 001_chart_of_accounts.sql first');
  }
  const roles = Object.fromEntries(roleRows.map((r) => [r.code, r.id]));

  const { byCode } = await seedFoundation(roles);
  const userIds = await seedUsers(roles);
  await seedModuleCategories();

  const restaurantIds = await seedVertical({
    storeType: 'RESTAURANT',
    moduleType: 'FOOD',
    names: RESTAURANT_NAMES,
    photos: FOOD_PHOTOS,
    productMode: 'menu',
    userIds,
    navPrefix: 'restaurant',
  });
  const marketIds = await seedVertical({
    storeType: 'MARKET',
    moduleType: 'MARKET',
    names: MARKET_NAMES,
    photos: MARKET_PHOTOS,
    productMode: 'products',
    userIds,
    navPrefix: 'market',
  });
  const liquorIds = await seedVertical({
    storeType: 'LIQUOR',
    moduleType: 'LIQUOR',
    names: LIQUOR_NAMES,
    photos: LIQUOR_PHOTOS,
    productMode: 'products',
    userIds,
    navPrefix: 'liquor',
    ageRestricted: true,
  });
  const gasIds = await seedVertical({
    storeType: 'GAS',
    moduleType: 'GAS',
    names: GAS_NAMES,
    photos: GAS_PHOTOS,
    productMode: 'products',
    userIds,
    navPrefix: 'gas',
    cylinderByCode: byCode,
  });

  await seedRiders(userIds);
  const eventIds = await seedEvents(userIds, roles);
  await seedDiscovery(
    {
      RESTAURANT: restaurantIds,
      MARKET: marketIds,
      LIQUOR: liquorIds,
      GAS: gasIds,
    },
    eventIds,
  );

  const summary = {
    users: await prisma.user.count(),
    merchants: await prisma.merchant.count(),
    stores: await prisma.store.groupBy({
      by: ['storeType'],
      _count: true,
    }),
    menuItems: await prisma.menuItem.count(),
    products: await prisma.product.count(),
    events: await prisma.event.count(),
    riders: await prisma.rider.count(),
    pricingRules: await prisma.deliveryPricingRule.count({
      where: { enabled: true },
    }),
    discoverySections: await prisma.discoverySection.count(),
  };
  console.log('\n✓ Seed complete');
  console.log(JSON.stringify(summary, null, 2));
  console.log(`\nLogin any seeded user with password: ${PASSWORD}`);
  console.log('Examples: demo@daladrop.test / user01@daladrop.test');
}

main()
  .catch((err) => {
    console.error('\nSeed failed:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
