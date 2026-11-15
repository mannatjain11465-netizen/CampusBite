import heroFoodImg from '../assets/images/hero_campus_food_feast_1794579762910.jpg';
import burgerImg from '../assets/images/food_smash_burger_1794579764199.jpg';
import dosaImg from '../assets/images/food_masala_dosa_bowl_1794579763985.jpg';
import pizzaImg from '../assets/images/food_woodfired_pizza_1794579764475.jpg';
import coffeeImg from '../assets/images/food_iced_coffee_cafe_1794579764575.jpg';
import wrapImg from '../assets/images/food_paneer_tikka_wrap_1794579765696.jpg';
import ramenImg from '../assets/images/food_korean_ramen_bowl_1794579765988.jpg';
import waffleImg from '../assets/images/food_berry_waffle_dessert_1794579766579.jpg';
import samosaChaiImg from '../assets/images/food_samosa_chai_1794580910303.jpg';
import choleBhatureImg from '../assets/images/food_chole_bhature_1794580910865.jpg';
import momosImg from '../assets/images/food_steamed_momos_1794580912999.jpg';
import sandwichImg from '../assets/images/food_grilled_sandwich_1794580911407.jpg';

export const HERO_FOOD_IMAGE = heroFoodImg;
export const FEATURED_DOSA_IMAGE = dosaImg;
export const FEATURED_SAMOSA_IMAGE = samosaChaiImg;
export const FEATURED_CHOLE_IMAGE = choleBhatureImg;
export const FEATURED_MOMOS_IMAGE = momosImg;
export const FEATURED_SANDWICH_IMAGE = sandwichImg;
export const FEATURED_COFFEE_IMAGE = coffeeImg;

const IMAGE_ASSET_MAP: Record<string, string> = {
  '/src/assets/images/hero_campus_food_feast_1794579762910.jpg': heroFoodImg,
  '/src/assets/images/food_smash_burger_1794579764199.jpg': burgerImg,
  '/src/assets/images/food_masala_dosa_bowl_1794579763985.jpg': dosaImg,
  '/src/assets/images/food_woodfired_pizza_1794579764475.jpg': pizzaImg,
  '/src/assets/images/food_iced_coffee_cafe_1794579764575.jpg': coffeeImg,
  '/src/assets/images/food_paneer_tikka_wrap_1794579765696.jpg': wrapImg,
  '/src/assets/images/food_korean_ramen_bowl_1794579765988.jpg': ramenImg,
  '/src/assets/images/food_berry_waffle_dessert_1794579766579.jpg': waffleImg,
  '/src/assets/images/food_samosa_chai_1794580910303.jpg': samosaChaiImg,
  '/src/assets/images/food_chole_bhature_1794580910865.jpg': choleBhatureImg,
  '/src/assets/images/food_steamed_momos_1794580912999.jpg': momosImg,
  '/src/assets/images/food_grilled_sandwich_1794580911407.jpg': sandwichImg,
};

export const PRESET_FOOD_GALLERY = [
  { label: 'Samosa & Masala Chai', url: '/src/assets/images/food_samosa_chai_1794580910303.jpg', preview: samosaChaiImg },
  { label: 'Chole Bhature', url: '/src/assets/images/food_chole_bhature_1794580910865.jpg', preview: choleBhatureImg },
  { label: 'Steamed Momos', url: '/src/assets/images/food_steamed_momos_1794580912999.jpg', preview: momosImg },
  { label: 'Bombay Grilled Sandwich', url: '/src/assets/images/food_grilled_sandwich_1794580911407.jpg', preview: sandwichImg },
  { label: 'Masala Dosa', url: '/src/assets/images/food_masala_dosa_bowl_1794579763985.jpg', preview: dosaImg },
  { label: 'Paneer Tikka Roll', url: '/src/assets/images/food_paneer_tikka_wrap_1794579765696.jpg', preview: wrapImg },
  { label: 'Smash Burger', url: '/src/assets/images/food_smash_burger_1794579764199.jpg', preview: burgerImg },
  { label: 'Cold Coffee & Latte', url: '/src/assets/images/food_iced_coffee_cafe_1794579764575.jpg', preview: coffeeImg },
  { label: 'Wood-Fired Pizza', url: '/src/assets/images/food_woodfired_pizza_1794579764475.jpg', preview: pizzaImg },
  { label: 'Ramen Bowl', url: '/src/assets/images/food_korean_ramen_bowl_1794579765988.jpg', preview: ramenImg },
  { label: 'Berry Waffle', url: '/src/assets/images/food_berry_waffle_dessert_1794579766579.jpg', preview: waffleImg },
];

export function resolveFoodImage(url?: string | null): string {
  if (!url) return samosaChaiImg;
  return IMAGE_ASSET_MAP[url] || url;
}
