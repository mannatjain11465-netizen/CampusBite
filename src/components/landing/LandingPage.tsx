import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  ChefHat,
  Clock,
  Layers,
  MapPin,
  PackageCheck,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Store,
  Timer,
  Utensils,
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import {
  FEATURED_CHOLE_IMAGE,
  FEATURED_COFFEE_IMAGE,
  FEATURED_DOSA_IMAGE,
  FEATURED_MOMOS_IMAGE,
  FEATURED_SAMOSA_IMAGE,
  FEATURED_SANDWICH_IMAGE,
  HERO_FOOD_IMAGE,
} from '../../lib/foodAssets';
import { formatCurrency } from '../../lib/format';
import { FoodStall, MenuItem, OrderStatus } from '../../types';
import { FoodImage } from '../common/FoodImage';
import { MenuCardSkeleton } from '../common/Skeletons';
import { TopNav } from '../common/TopNav';

interface LandingPageProps {
  onExploreFood: (preselectedStallId?: string, preselectedCategory?: string) => void;
  onOpenAuth: (mode?: 'login' | 'register') => void;
  currentUserRole?: string | null;
}

const POPULAR_CATEGORIES = [
  { name: 'Snacks & Samosa', subtitle: 'Crispy samosas & kulhad chai', image: FEATURED_SAMOSA_IMAGE },
  { name: 'Dosa & South Indian', subtitle: 'Ghee roast dosas & sambar', image: FEATURED_DOSA_IMAGE },
  { name: 'North Indian Meals', subtitle: 'Amritsari chole bhature', image: FEATURED_CHOLE_IMAGE },
  { name: 'Momos', subtitle: 'Steamed dumplings & chili dip', image: FEATURED_MOMOS_IMAGE },
  { name: 'Sandwiches', subtitle: 'Bombay masala cheese toasties', image: FEATURED_SANDWICH_IMAGE },
  { name: 'Cold Coffee & Chai', subtitle: 'Iced cold brew & masala chai', image: FEATURED_COFFEE_IMAGE },
];

const CAMPUS_OFFERS = [
  {
    code: 'CHAI-SAMOSA',
    title: 'Morning Break Combo at ₹55',
    detail: 'Two hot Punjabi samosas with mint chutney and spiced ginger masala chai ready in 5 minutes.',
    category: 'Snacks & Samosa',
  },
  {
    code: 'LUNCH-SPECIAL',
    title: 'Lecture Hall Break Priority',
    detail: 'Schedule your 01:15 PM pickup before your 12:00 PM lab ends and skip the midday queue.',
    category: 'North Indian Meals',
  },
  {
    code: 'NIGHT-OWL',
    title: 'Library Late-Evening Brews',
    detail: 'Cold coffee, Belgian waffles, and grilled sandwiches served until 11:45 PM during project sprints.',
    category: 'Cold Coffee & Chai',
  },
];

const HOW_IT_WORKS_STEPS = [
  {
    num: '01.',
    title: 'Discover Live Stall Menus',
    description:
      'Check what is freshly cooked and actually in stock across IIIT Allahabad demo food court bays before walking over from the lecture hall.',
  },
  {
    num: '02.',
    title: 'Reserve Stock & Pick a Slot',
    description:
      'Choose ASAP (15 mins) or a scheduled break window. Inventory deducts atomically on confirmation so your meal is never oversold.',
  },
  {
    num: '03.',
    title: 'Track Kitchen & Collect',
    description:
      'Watch live updates from Placed to Ready on your phone and walk straight to the counter when your order code is called.',
  },
];

const WHY_STUDENTS_LOVE = [
  {
    icon: Timer,
    title: 'Built Around 15-Min Breaks',
    detail: 'Order while exiting CC-3 or Lecture Hall Complex so your food is plated by the time you reach the plaza.',
  },
  {
    icon: Layers,
    title: 'Zero Stockout Surprises',
    detail: 'Live quantity caps prevent paying for sold-out samosas or dosas, and eligible cancellations restore stock automatically.',
  },
  {
    icon: ShieldCheck,
    title: 'Transparent ₹ Pricing & Receipts',
    detail: 'Clear subtotal, 5% campus GST, and simulated payment receipts with instant order history.',
  },
];

const DEMO_TRACK_STEPS: { status: OrderStatus; note: string; eta: string }[] = [
  { status: 'Placed', note: 'Order CB-2026-1042 received & stock reserved', eta: '01:02 PM' },
  { status: 'Accepted', note: 'Demo Counter 02 confirmed kitchen slot', eta: '01:03 PM' },
  { status: 'Preparing', note: 'Ghee Roast Masala Dosa & Momos being prepared', eta: '01:06 PM' },
  { status: 'Ready', note: 'Packed & waiting at Pickup Counter Bay 02', eta: '01:12 PM' },
  { status: 'Completed', note: 'Collected by student at counter', eta: '01:14 PM' },
];

const TESTIMONIALS = [
  {
    quote:
      'Between back-to-back morning labs in Prayagraj, waiting 20 minutes for a dosa meant skipping lunch. Scheduling my 1:15 PM pickup on CampusBite gives me my full break back.',
    author: 'Aarav Sharma',
    role: 'B.Tech IT, 3rd Year · IIIT Allahabad',
  },
  {
    quote:
      'Having automatic stock deduction and low-stock alerts means our demo counter never accidentally accepts 30 paneer rolls when only 6 remain in the kitchen.',
    author: 'Rohan Malhotra',
    role: 'Vendor Lead · Demo Counter 01 (Editable)',
  },
  {
    quote:
      'One centralized dashboard tracks daily stall revenue, active orders, and inventory logs across every food court bay with instant CSV exports.',
    author: 'Dr. Kavita Rao',
    role: 'Faculty Coordinator · IIITA Campus Dining Demo',
  },
];

export function LandingPage({
  onExploreFood,
  onOpenAuth,
  currentUserRole,
}: LandingPageProps) {
  const [stalls, setStalls] = useState<FoodStall[]>([]);
  const [bestsellers, setBestsellers] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [demoTrackIdx, setDemoTrackIdx] = useState<number>(2);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadLandingData() {
      try {
        const [stallRes, menuRes] = await Promise.all([
          apiRequest<{ stalls: FoodStall[] }>('/api/stalls'),
          apiRequest<{ items: MenuItem[]; categories: string[] }>('/api/menu?bestsellersOnly=true'),
        ]);
        if (!active) return;
        setStalls(stallRes.stalls);
        setBestsellers(menuRes.items);
        setCategories(['All', ...menuRes.categories]);
      } catch {
        // graceful fallback
      } finally {
        if (active) setLoading(false);
      }
    }
    loadLandingData();
    return () => {
      active = false;
    };
  }, []);

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const filteredBestsellers =
    selectedCategory === 'All'
      ? bestsellers
      : bestsellers.filter((item) => item.category === selectedCategory);

  return (
    <div id="top" className="min-h-screen bg-[#FAF6EE] text-[#1C1917]">
      <TopNav
        onNavigateSection={scrollToSection}
        onExploreFood={() => onExploreFood()}
        onPrimaryAction={() =>
          currentUserRole ? onExploreFood() : onOpenAuth('login')
        }
        primaryLabel={currentUserRole ? 'Open Dashboard' : 'Sign In'}
      />

      {/* HERO SECTION: Deep Midnight Navy + Saffron + Gold */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0B132B] via-[#111C3A] to-[#1A274A] text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -right-24 w-96 h-96 rounded-full bg-[#F97316]/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-1/3 w-80 h-80 rounded-full bg-[#D4A017]/10 blur-3xl"
        />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-16 lg:pt-16 lg:pb-20">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* Left Column */}
            <div className="lg:col-span-6 space-y-6">
              <div className="text-xs font-bold tracking-[0.14em] text-[#FBBF24]">
                MADE FOR IIIT ALLAHABAD · PRAYAGRAJ, UP
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight leading-[1.07] text-balance text-white">
                Your Campus Cravings, One Click Away.
              </h1>

              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
                Your Campus. Your Cravings. One Click. Skip crowded counters between Jhalwa campus lectures—order fresh samosas, dosas, rolls, chole bhature, and cold coffee with live stock visibility and instant pickup tracking.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={() => onExploreFood()}
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-sm font-semibold shadow-lg shadow-[#F97316]/25 transition-all cursor-pointer whitespace-nowrap"
                >
                  <span>Explore Food</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAuth('register')}
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-white/25 bg-white/5 hover:bg-white/10 text-white text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>Join CampusBite</span>
                </button>
              </div>

              {/* Trust Indicators */}
              <div className="pt-4 border-t border-white/10 grid grid-cols-3 gap-4 max-w-lg">
                <div>
                  <div className="text-lg font-bold font-mono tabular-nums text-[#FBBF24]">
                    100% Atomic
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">Live Stock Sync</div>
                </div>
                <div>
                  <div className="text-lg font-bold font-mono tabular-nums text-white">
                    ₹55+ Meals
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">Student Friendly</div>
                </div>
                <div>
                  <div className="text-lg font-bold font-mono tabular-nums text-white">
                    ~10 mins
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">Break Pickup ETA</div>
                </div>
              </div>
            </div>

            {/* Right Column: Layered Food Composition + Floating Status & Pickup Cards */}
            <div className="lg:col-span-6 relative">
              <div className="relative rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-[#111C3A] aspect-[16/11]">
                <img
                  src={HERO_FOOD_IMAGE}
                  alt="IIIT Allahabad campus dining spread with burgers, pizza, bowls, and cold coffee"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0B132B]/85 via-[#0B132B]/20 to-transparent" />

                {/* Bottom Overlay Info */}
                <div className="absolute bottom-4 left-4 right-4 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div className="rounded-xl bg-[#0B132B]/90 backdrop-blur-md border border-white/15 p-3.5 max-w-xs">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#FBBF24]">
                      <ChefHat className="w-3.5 h-3.5" />
                      <span>Live Order · CB-2026-1006</span>
                    </div>
                    <p className="text-sm font-bold text-white mt-1">
                      Preparing Steamed Veg Momos
                    </p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Demo Counter 02 · Pickup ASAP (15 mins)
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#FFFDF9] text-[#1C1917] p-3.5 shadow-xl border border-[#E6DEC8] max-w-[210px]">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-[#EA580C]">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>IIITA Campus Pickup</span>
                    </div>
                    <p className="text-xs font-bold mt-1">Zero Counter Queue</p>
                    <p className="text-[11px] text-[#57534E] mt-0.5">
                      Prayagraj Demo Food Court Bays
                    </p>
                  </div>
                </div>
              </div>

              {/* Layered Secondary Dish Thumbnails */}
              <div className="mt-4 grid grid-cols-3 gap-3">
                {[
                  { img: FEATURED_SAMOSA_IMAGE, name: 'Samosa & Chai', price: '₹55' },
                  { img: FEATURED_DOSA_IMAGE, name: 'Masala Dosa', price: '₹90' },
                  { img: FEATURED_CHOLE_IMAGE, name: 'Chole Bhature', price: '₹110' },
                ].map((card) => (
                  <button
                    key={card.name}
                    type="button"
                    onClick={() => onExploreFood()}
                    className="group rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 p-2 flex items-center gap-2.5 text-left transition-colors cursor-pointer"
                  >
                    <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0">
                      <FoodImage src={card.img} alt={card.name} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        {card.name}
                      </div>
                      <div className="text-xs font-mono font-bold text-[#FBBF24] tabular-nums">
                        {card.price}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 1: POPULAR CAMPUS FOOD CATEGORIES */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-10">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-bold tracking-wider text-[#EA580C]">
              CURATED FOR IIIT ALLAHABAD
            </p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-[#0B132B]">
              Popular Campus Cravings
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onExploreFood()}
            className="text-sm font-semibold text-[#EA580C] hover:text-[#C2410C] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <span>Browse Full Menu</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {POPULAR_CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              type="button"
              onClick={() => onExploreFood(undefined, cat.name)}
              className="group rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] overflow-hidden text-left hover:-translate-y-0.5 hover:shadow-md hover:border-[#F97316]/60 transition-all cursor-pointer flex flex-col"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-[#F2EAE0]">
                <FoodImage
                  src={cat.image}
                  alt={cat.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              </div>
              <div className="p-3">
                <h3 className="text-xs font-bold text-[#0B132B] group-hover:text-[#EA580C] transition-colors truncate">
                  {cat.name}
                </h3>
                <p className="text-[11px] text-[#57534E] truncate mt-0.5">{cat.subtitle}</p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* SECTION 2: FEATURED DEMO FOOD STALLS */}
      <section id="stalls" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-bold tracking-wider text-[#EA580C]">
              IIIT ALLAHABAD DEMO COUNTERS (EDITABLE BY ADMIN / VENDOR)
            </p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-[#0B132B]">
              Featured Campus Food Stalls
            </h2>
            <p className="mt-1 text-sm text-[#57534E]">
              Sample demonstration counters configured for evaluation. Vendors can customize stall names, hours, and live menus anytime.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stalls.map((stall) => (
            <button
              key={stall.id}
              type="button"
              onClick={() => onExploreFood(stall.id)}
              className="group text-left rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all duration-150 flex flex-col cursor-pointer"
            >
              <div className="aspect-[4/3] w-full overflow-hidden bg-[#F2EAE0] relative">
                <FoodImage
                  src={stall.image_url}
                  alt={stall.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs text-white font-semibold">
                  <span>{stall.is_open ? 'Open Now' : 'Closed'}</span>
                  <span className="font-mono tabular-nums inline-flex items-center gap-1 bg-[#0B132B]/80 px-2 py-0.5 rounded-md">
                    <Star className="w-3 h-3 text-[#FBBF24] fill-[#FBBF24]" />
                    {stall.rating.toFixed(1)}
                  </span>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="text-xs font-medium text-[#EA580C]">{stall.cuisine_type}</div>
                <h3 className="mt-1 text-base font-bold text-[#0B132B] group-hover:text-[#EA580C] transition-colors">
                  {stall.name}
                </h3>
                <p className="mt-1.5 text-xs text-[#57534E] line-clamp-2 leading-relaxed flex-1">
                  {stall.description}
                </p>
                <div className="mt-4 pt-3 border-t border-[#F2EAE0] flex items-center justify-between text-xs text-[#57534E]">
                  <span className="inline-flex items-center gap-1 truncate">
                    <MapPin className="w-3.5 h-3.5 shrink-0 text-[#EA580C]" />
                    <span className="truncate">{stall.location.split('(')[0].trim()}</span>
                  </span>
                  <span className="font-mono tabular-nums font-semibold text-[#0B132B] whitespace-nowrap">
                    ~{stall.avg_prep_minutes}m
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* SECTION 3: TRENDING & BESTSELLING DISHES */}
      <section id="menu" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-bold tracking-wider text-[#EA580C]">
              REAL-TIME KITCHEN INVENTORY
            </p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-[#0B132B]">
              Trending & Bestselling Dishes
            </h2>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-[#F2EAE0] rounded-xl overflow-x-auto max-w-full">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#0B132B] text-white shadow-xs'
                    : 'text-[#57534E] hover:text-[#0B132B]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <MenuCardSkeleton />
            <MenuCardSkeleton />
            <MenuCardSkeleton />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBestsellers.slice(0, 6).map((item) => (
              <div
                key={item.id}
                className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] overflow-hidden hover:-translate-y-1 hover:shadow-lg transition-all duration-150 flex flex-col"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-[#F2EAE0]">
                  <FoodImage src={item.image_url} alt={item.name} />
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 text-xs text-[#57534E]">
                    <span className="truncate">{item.stall_name}</span>
                    <span aria-hidden="true">·</span>
                    <span className={item.is_veg ? 'text-emerald-700 font-semibold' : 'text-rose-700 font-semibold'}>
                      {item.is_veg ? 'Pure Veg' : 'Non-Veg'}
                    </span>
                  </div>
                  <h3 className="mt-1.5 text-base font-bold text-[#0B132B]">{item.name}</h3>
                  <p className="mt-1.5 text-sm text-[#57534E] line-clamp-2 leading-relaxed flex-1">
                    {item.description}
                  </p>
                  <div className="mt-4 pt-3.5 border-t border-[#F2EAE0] flex items-center justify-between gap-3">
                    <div>
                      <span className="text-lg font-bold text-[#0B132B] font-mono tabular-nums">
                        {formatCurrency(item.price)}
                      </span>
                      <span className="ml-2.5 text-xs text-[#57534E] font-mono tabular-nums">
                        {item.stock_qty > 0 ? `${item.stock_qty} left` : 'Sold out'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onExploreFood(item.stall_id)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Order Now</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* SECTION 4: SPECIAL CAMPUS OFFERS BANNER */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="rounded-3xl bg-gradient-to-br from-[#0B132B] via-[#132044] to-[#1E2E5C] text-white p-8 sm:p-10 border border-white/10 shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold tracking-wider text-[#FBBF24]">
                <Sparkles className="w-4 h-4" />
                <span>CAMPUS BREAK HIGHLIGHTS</span>
              </div>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">
                Special IIIT Allahabad Break Picks
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onExploreFood()}
              className="px-5 py-2.5 rounded-xl bg-[#F97316] hover:bg-[#EA580C] text-white text-xs font-semibold whitespace-nowrap self-start lg:self-auto cursor-pointer"
            >
              Explore All Combos
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {CAMPUS_OFFERS.map((offer) => (
              <button
                key={offer.code}
                type="button"
                onClick={() => onExploreFood(undefined, offer.category)}
                className="text-left rounded-2xl bg-white/8 hover:bg-white/12 border border-white/12 p-5 transition-colors cursor-pointer"
              >
                <div className="text-[11px] font-mono font-semibold text-[#FBBF24]">
                  {offer.code}
                </div>
                <h3 className="mt-1.5 text-base font-bold text-white">{offer.title}</h3>
                <p className="mt-2 text-xs text-slate-300 leading-relaxed">{offer.detail}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* SECTION 5: HOW CAMPUSBITE WORKS + INTERACTIVE ORDER TRACKING DEMO */}
      <section id="how-it-works" className="bg-[#FFFDF9] border-t border-b border-[#E6DEC8] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          <div>
            <p className="text-xs font-bold tracking-wider text-[#EA580C]">
              END-TO-END WORKFLOW
            </p>
            <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-[#0B132B]">
              How CampusBite Works
            </h2>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
              {HOW_IT_WORKS_STEPS.map((step) => (
                <div key={step.num} className="pt-5 border-t-2 border-[#E6DEC8]">
                  <p className="text-sm font-mono font-bold text-[#EA580C]">{step.num}</p>
                  <h3 className="mt-2 text-lg font-bold text-[#0B132B]">{step.title}</h3>
                  <p className="mt-2 text-sm text-[#57534E] leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Interactive Order Tracking Demonstration */}
          <div className="rounded-2xl bg-[#FAF6EE] border border-[#E6DEC8] p-6 sm:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <p className="text-xs font-bold tracking-wider text-[#EA580C]">
                  LIVE ORDER LIFECYCLE DEMONSTRATION
                </p>
                <h3 className="mt-1 text-xl font-bold text-[#0B132B]">
                  Click any stage to preview real-time student tracking
                </h3>
              </div>
              <span className="font-mono text-xs font-semibold text-[#0B132B] bg-[#FFFDF9] border border-[#E6DEC8] px-3 py-1.5 rounded-lg">
                Order CB-2026-1042 · {DEMO_TRACK_STEPS[demoTrackIdx].eta}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {DEMO_TRACK_STEPS.map((step, idx) => {
                const reached = idx <= demoTrackIdx;
                const active = idx === demoTrackIdx;
                return (
                  <button
                    key={step.status}
                    type="button"
                    onClick={() => setDemoTrackIdx(idx)}
                    className={`text-left rounded-xl p-3.5 border transition-all cursor-pointer ${
                      active
                        ? 'bg-[#0B132B] text-white border-[#0B132B] shadow-md'
                        : reached
                          ? 'bg-[#FFFDF9] text-[#0B132B] border-[#F97316]'
                          : 'bg-[#FFFDF9] text-[#57534E] border-[#E6DEC8]'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span>{step.status}</span>
                      {reached && (
                        <Check
                          className={`w-3.5 h-3.5 ${
                            active ? 'text-[#FBBF24]' : 'text-[#EA580C]'
                          }`}
                        />
                      )}
                    </div>
                    <p
                      className={`mt-1.5 text-[11px] leading-snug ${
                        active ? 'text-slate-300' : 'text-[#57534E]'
                      }`}
                    >
                      {step.note}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 6: WHY STUDENTS LOVE CAMPUSBITE & TESTIMONIALS */}
      <section id="reviews" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-14">
        <div>
          <p className="text-xs font-bold tracking-wider text-[#EA580C]">
            BUILT FOR CAMPUS LIFE
          </p>
          <h2 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-[#0B132B]">
            Why Students Love CampusBite
          </h2>
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {WHY_STUDENTS_LOVE.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-6"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#0B132B] text-[#FBBF24] flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-[#0B132B]">{item.title}</h3>
                  <p className="mt-2 text-sm text-[#57534E] leading-relaxed">{item.detail}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold tracking-tight text-[#0B132B] mb-6">
            Campus Voices · IIIT Allahabad
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.author}
                className="rounded-2xl bg-[#FFFDF9] border border-[#E6DEC8] p-6 flex flex-col justify-between"
              >
                <blockquote className="text-sm text-[#1C1917] leading-relaxed">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-5 pt-4 border-t border-[#F2EAE0]">
                  <div className="text-sm font-bold text-[#0B132B]">{t.author}</div>
                  <div className="text-xs text-[#57534E] mt-0.5">{t.role}</div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* MIDNIGHT NAVY FOOTER */}
      <footer className="bg-[#0B132B] text-white border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <div className="text-xl font-extrabold tracking-tight font-display">
              CampusBite
            </div>
            <p className="mt-1.5 text-xs text-slate-300">
              Indian Institute of Information Technology Allahabad (IIIT Allahabad), Prayagraj, UP
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Your Campus. Your Cravings. One Click. · Demo Hours 07:30 AM – 11:45 PM IST
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs font-medium text-slate-300">
            <button
              type="button"
              onClick={() => onExploreFood()}
              className="hover:text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Utensils className="w-3.5 h-3.5 text-[#F97316]" />
              <span>Student Ordering</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="hover:text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Store className="w-3.5 h-3.5 text-[#F97316]" />
              <span>Vendor Portal</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth('login')}
              className="hover:text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#F97316]" />
              <span>Admin Console</span>
            </button>
            <span className="inline-flex items-center gap-1.5 text-slate-400">
              <PackageCheck className="w-3.5 h-3.5" />
              <span>Simulated Payments for Demo</span>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
